# Project Analysis: Personal Expense Tracker

This document explains how the project actually works, based on reading the source code (backend, frontend,
migrations, tests, Docker and deploy files), not just the README. Its companion,
[`INTERVIEW_PREPARATION.md`](INTERVIEW_PREPARATION.md), turns this into spoken answers and practice questions.

Three labels are used throughout:

- **Implemented**: the code exists and is used.
- **Partial**: the code exists but has a gap.
- **Not implemented**: it is a suggestion, not something in the code.

> The analysis covers the working tree as of 2026-11-11. About 50 files have changes that are not committed
> yet (the "ledger" redesign, `Dates.java`, migrations V7 and V8, the LIKE-escaping fix, the 409 handler).
> They are described here because they are the code you would demo. The older `INTERVIEW_PREP.md` was
> written before those changes, so some of its "known weaknesses" are already fixed. See §13.4.

---

## 1. Project Overview

**What it is.** A full-stack, multi-user personal finance web application. A user records income and
expenses (by hand or by uploading a bank CSV file), the app sorts transactions into categories, compares
spending with monthly budgets, and shows charts of where the money went.

**The problem it solves.** Bank statements are hard to read and every bank exports a slightly different
file: different column names, different date formats, amounts written as `1,234.56`, `(12.34)` or `₹500`.
People who want to understand their spending end up cleaning spreadsheets by hand. This app accepts the
messy file, imports what is valid, tells the user exactly which rows were bad, and categorises the rest
automatically.

**Main objectives.**

1. Give each user a private ledger of income and expenses.
2. Make importing a bank statement painless and safe to repeat.
3. Categorise transactions automatically using rules the user controls.
4. Show budgets and trends so the user can act on the data.
5. Be a realistic, deployable system (authentication, tests, CI, Docker, cloud hosting), not a toy.

**Target users.** Individuals tracking their own money. The currency formatting is Indian Rupees
(`₹1,25,000`, in `frontend/src/utils/format.js`), so the natural audience is Indian users with bank CSV
exports.

**Main features (all implemented).**

| Feature | Where in the code |
| --- | --- |
| Register, login with username **or** email | `auth/AuthController`, `auth/AuthService` |
| Google sign-in (optional) | `auth/GoogleAuthService`, `components/auth/GoogleSignInButton.jsx` |
| Forgotten password with emailed 6-digit code | `auth/PasswordResetService`, `auth/ResetCodeMailer` |
| Profile (username, age) | `user/ProfileController`, `pages/Profile.jsx` |
| Income and expense CRUD, with search, filters, pagination | `expense/*`, `pages/Transactions.jsx` |
| CSV import with per-row error report and duplicate skipping | `importer/CsvImportService`, `pages/Import.jsx` |
| Keyword rules for auto-categorisation | `category/*`, `pages/Categories.jsx` |
| Monthly budgets per category | `budget/*`, `pages/Budgets.jsx` |
| Reports: summary, by category, monthly, daily | `report/*`, `pages/Dashboard.jsx`, `pages/Analytics.jsx` |
| Light and dark theme, responsive layout | `theme.js`, `components/layout/MainLayout.jsx` |

**What makes it different from a typical student expense tracker.**

- **Partial-success import.** One broken row does not fail the whole file; the response names the line
  number and the reason for each bad row.
- **Aggregation is done in SQL**, not by loading rows into Java and looping.
- **Money is exact**: `BigDecimal` in Java, `numeric(12,2)` in PostgreSQL.
- **The schema is owned by Flyway migrations** and Hibernate only validates it.
- **Tests run against a real PostgreSQL** (Testcontainers), not an in-memory substitute.
- **Security details most projects skip**: hashed reset codes, attempt limits, no account enumeration in
  the reset flow, a startup check that refuses the sample JWT secret in production.

---

## 2. Main Users and User Roles

**There is exactly one role: an authenticated user.** There is no admin, no moderator and no role column
in the `users` table. This is visible in `JwtAuthFilter`, which creates the authentication object with an
empty list of authorities:

```java
var auth = new UsernamePasswordAuthenticationToken(userId, null, List.of());
```

| Actor | What they can do |
| --- | --- |
| **Anonymous visitor** | Only `/api/auth/**` (register, login, Google sign-in, forgot/reset password, `GET /api/auth/config`) and `/actuator/health` |
| **Signed-in user** | Everything else, but **only on their own data**: transactions, their own categories and rules, budgets, reports, profile |

**How "own data only" is enforced.** Access control is by **ownership**, not by role. The user id comes
from the verified JWT and every query includes it. Examples: `expenses.findByIdAndUserId(id, userId)`,
`budgets.findByIdAndUserId(id, userId)`, and every report query has `where e.userId = :userId`. If user A
asks for user B's expense, the query finds nothing and the API returns **404**, so A cannot even tell that
the record exists.

**One special case: built-in categories.** Ten categories (Groceries, Dining, Transport, …) are seeded by
migration V2 with `user_id = NULL`. Every user can **see and use** them, but nobody can delete them,
because the delete uses `findByIdAndUserId(id, userId)` and a built-in category never matches a user id.

**Account types.** `users.provider` is `LOCAL` (registered with a password) or `GOOGLE` (created through
Google). This is not a role; both have the same permissions. A LOCAL account that later signs in with the
same Google email is **linked** (its `google_sub` is filled in) rather than duplicated.

**Not implemented:** admin role, role-based access control, account deletion, sharing a ledger between
users.

---

## 3. Complete User Flow

```mermaid
flowchart TD
    A[Open the app] --> B{Token in localStorage?}
    B -- no --> C[/login page/]
    B -- yes --> H[Dashboard]
    C --> D[Sign in with username or email]
    C --> E[Continue with Google]
    C --> F[Create an account]
    C --> G[Forgot password: email code, then new password]
    G --> C
    D --> H
    E --> H
    F --> H
    H --> I[Transactions: add, edit, delete, search, filter]
    H --> J[Categories: custom categories and keyword rules]
    H --> K[Import CSV]
    H --> L[Budgets]
    H --> M[Analytics]
    H --> N[Profile]
    H --> O[Sign out: token removed, back to /login]
    K --> I
```

What happens at each step, on both sides:

**1. Opening the application.**
The browser downloads `index.html` and the JavaScript bundle (from Vercel in production, nginx in Docker,
the Vite dev server locally). `main.jsx` renders `<BrowserRouter><AuthProvider><App/>`. `AuthProvider`
reads the token and the user object from `localStorage`. `App.jsx` defines the routes: `/login`,
`/register` and `/forgot-password` are public; everything else is wrapped in `<RequireAuth>`, which
redirects to `/login` when there is no token and remembers the page the user wanted (`state.from`).
Nothing is sent to the backend yet.

**2. Registration.**
*Frontend* (`pages/Register.jsx`): checks the username pattern, the email shape, password length 8–72 and
age 13–120 before sending. Then `POST /api/auth/register` with `{email, username, password, age}`.
*Backend*: `@Valid` checks the `RegisterRequest` record again. `AuthService.register` trims the email,
lower-cases the username, rejects a taken email or username with 400, hashes the password with BCrypt,
saves the user, and returns `{token, expiresAt, user}`. The user is signed in immediately; there is no
email verification step.

**3. Login.**
*Frontend* (`pages/Login.jsx`): `POST /api/auth/login` with `{identifier, password}`.
*Backend*: `AuthController.login` first checks the rate limiter (10 attempts per 15 minutes per IP).
`AuthService.login` looks the user up by email if the identifier contains `@`, otherwise by username, and
compares the password with `encoder.matches`. Any failure throws `BadCredentialsException` → **401** with
the same message, whichever part was wrong. On success a JWT is issued and the rate-limit counter is reset.

**4. Authentication on later requests.**
`AuthContext.store` saves the token and user in `localStorage`. From then on the Axios request interceptor
in `api/client.js` adds `Authorization: Bearer <token>` to every request. On the server, `JwtAuthFilter`
verifies the signature and expiry and puts the user id in the `SecurityContext`.

**5. Authorization.**
`SecurityConfig` says: `/api/auth/**` and `/actuator/health` are open, everything else needs
authentication. A request without a valid token gets a bare **401**. Controllers receive the user id with
`@AuthenticationPrincipal Long userId` and pass it to the service, which scopes every query by it.

**6. Dashboard.**
`pages/Dashboard.jsx` fires six requests in parallel with `Promise.all` for the selected month: report
summary, by-category totals, the last 6 months, daily totals, the 6 most recent transactions, and budgets.
While waiting it shows skeleton placeholders; on failure it shows an error state with a retry button.

**7. Main features.**
- *Transactions*: a paged list from `GET /api/expenses` with filters. The search box is debounced by
  300 ms so typing "uber" sends one request, not four. Add and edit use one dialog (`TransactionForm`),
  which does `POST /api/expenses` or `PUT /api/expenses/{id}`. Delete asks for confirmation first.
- *Categories*: create or delete your own categories, and create keyword rules such as `uber → Transport`.
- *Import*: pick or drop a CSV file; the page sends it as `multipart/form-data` and renders the returned
  summary (imported, duplicates, failed, per-row errors, ignored columns).
- *Budgets*: one monthly limit per category, shown with spent, remaining and a percentage bar.
- *Analytics*: the same report endpoints over any date range.

**8. Profile management.**
`GET /api/profile` loads the profile. `PUT /api/profile` updates username and age (the username must stay
unique). The page then calls `setUser` from `AuthContext` so the sidebar shows the new name immediately.
The email cannot be changed, and there is no "change password" form for a signed-in user; the forgot
password flow is the only way to change a password.

**9. Logout.**
Purely a frontend action: `logout()` in `AuthContext` removes the token and user from `localStorage` and
clears the React state, so `RequireAuth` redirects to `/login`. **No request is sent to the backend**,
because the server keeps no session. The consequence: the token itself stays valid until it expires (24
hours by default). See §10.

**10. Expired session.**
When the token expires the backend answers 401. The Axios response interceptor catches a 401 from any
non-auth URL, clears storage and sends the browser to `/login`.

---

## 4. How Data Travels Through the Application

### 4.1 The full lifecycle of one request

Example: the user adds an expense of ₹420 for "Uber to office".

```mermaid
sequenceDiagram
    autonumber
    participant UI as TransactionForm.jsx
    participant AX as Axios client.js
    participant F as JwtAuthFilter
    participant C as ExpenseController
    participant S as ExpenseService
    participant R as ExpenseRepository
    participant DB as PostgreSQL

    UI->>AX: client.post('/expenses', payload)
    AX->>F: POST /api/expenses + Authorization: Bearer token + JSON body
    F->>F: verify signature and expiry, userId into SecurityContext
    F->>C: request continues down the filter chain
    C->>C: JSON to ExpenseRequest record, @Valid runs
    C->>S: service.create(userId, request)
    S->>R: categories.findVisibleTo(categoryId, userId)
    R->>DB: SELECT ... FROM categories WHERE id = ? AND (user_id IS NULL OR user_id = ?)
    S->>R: expenses.save(new Expense(...))
    R->>DB: INSERT INTO expenses (...) VALUES (...) RETURNING id
    DB-->>R: generated id
    R-->>S: managed Expense entity
    S-->>C: ExpenseDto
    C-->>AX: 201 Created + JSON body
    AX-->>UI: promise resolves
    UI->>UI: onSaved(): close dialog, toast, bump revision so the list refetches
```

**Step 1: the frontend creates the request.** `TransactionForm.submit` validates the form, builds a plain
object and calls Axios:

```js
const payload = { amount: Number(form.amount), spentOn: form.spentOn,
                  description: form.description.trim(), categoryId: form.categoryId || null, kind: form.kind }
if (transaction.id) await client.put(`/expenses/${transaction.id}`, payload)
else await client.post('/expenses', payload)
```

Axios turns the object into a JSON string, sets `Content-Type: application/json`, and the request
interceptor adds the `Authorization` header.

**Step 2: the request reaches the backend.** The base URL is `VITE_API_URL` or `/api`. In production the
browser calls `/api/expenses` on the Vercel domain and `vercel.json` rewrites it to the Render API. In
Docker, nginx proxies `/api/` to the `backend` container. Locally the browser calls the backend port
directly (a cross-origin call, which is why CORS exists, §5). Inside Spring Boot the embedded Tomcat
server accepts the connection and passes the request through the Spring Security filter chain.

**Step 3: the filter.** `JwtAuthFilter` reads the header, asks `JwtService.userIdOf(token)` to verify it,
and stores the user id as the principal. If the token is missing or invalid it does nothing, and Spring
Security later rejects the request with 401 because the route requires authentication.

**Step 4: the controller.** Spring's `DispatcherServlet` matches `POST /api/expenses` to
`ExpenseController.create`. Jackson converts the JSON body into an `ExpenseRequest` record
(`@RequestBody`). `@Valid` runs Bean Validation (`@NotNull @Positive` on amount, `@NotBlank @Size(max=255)`
on description). `@AuthenticationPrincipal Long userId` injects the id from step 3. The controller holds
no business logic; it calls the service.

**Step 5: the service layer, and why it exists.** `ExpenseService.create`:

```java
@Transactional
public ExpenseDto create(Long userId, ExpenseRequest req) {
    requireNotInFuture(req.spentOn());
    Long categoryId = resolveCategory(userId, req.categoryId());
    Expense saved = expenses.save(new Expense(userId, categoryId, req.amount(), req.spentOn(),
            req.description().trim(), Expense.Source.MANUAL, req.kindOrDefault()));
    return toDto(saved, categoriesById(userId));
}
```

The service is where the rules live: "no future dates", "the category must be one this user is allowed to
use", "kind defaults to EXPENSE". It also defines the **transaction boundary** (`@Transactional`): all
database work in the method commits together or rolls back together. Keeping this out of the controller
means the same rules apply no matter who calls it (the CSV importer reuses the repositories, tests call
the same services through HTTP), and the controller stays a thin HTTP adapter.

**Step 6: the repository talks to the database.** `ExpenseRepository` is an interface that extends
`JpaRepository<Expense, Long>`. Spring Data generates the implementation at startup. `save()` hands the
entity to Hibernate.

**Step 7: SQL is executed.** Hibernate translates the entity into an `INSERT` statement and sends it over
JDBC through a HikariCP connection pool to PostgreSQL. Because the id uses `GenerationType.IDENTITY`
(a `bigserial` column), the insert runs immediately and returns the generated id. PostgreSQL checks its
own constraints too (`amount > 0`, foreign keys). When the service method returns, the transaction commits.

**Step 8: data goes back.** The service converts the entity to an `ExpenseDto` record (adding the category
name and colour). The controller returns it; Jackson writes it as JSON; `@ResponseStatus(HttpStatus.CREATED)`
sets status **201**.

**Step 9: the frontend processes the response.** The awaited promise resolves. `onSaved` runs in
`Transactions.jsx`: it closes the dialog, shows a snackbar ("Transaction added") through `useFeedback`,
and calls `reload()`, which increments a `revision` state value.

**Step 10: the UI updates.** `revision` is a dependency of the fetching `useEffect`, so React re-runs it,
`GET /api/expenses` is called again, `setResult(data)` stores the new page, and React re-renders the table.
The app refetches rather than patching the list locally, so totals, ordering and pagination are always
what the server says.

**If something fails**: a validation error or a `BadRequestException` is turned by `ApiExceptionHandler`
into a JSON body with a `message`; the promise rejects; `errorMessage(e)` pulls out that message and the
dialog shows it in an `Alert`.

### 4.2 HTTP methods as used in this project

| Method | Meaning | Real example | Success status |
| --- | --- | --- | --- |
| **GET** | Read. Safe, no body, can be repeated freely | `GET /api/expenses?kind=EXPENSE&page=0&size=25` | 200 |
| **POST** | Create, or run an action | `POST /api/expenses`, `POST /api/auth/login`, `POST /api/expenses/import` | 201 for creates, 200 for actions |
| **PUT** | Replace a resource with the body sent. Repeating it gives the same result (idempotent) | `PUT /api/expenses/42`, `PUT /api/budgets/7`, `PUT /api/profile` | 200 |
| **PATCH** | Change only some fields | **Not used.** Every update sends the whole object, so PUT is the honest choice. CORS does not even allow PATCH | n/a |
| **DELETE** | Remove | `DELETE /api/expenses/42`, `DELETE /api/categories/rules/3` | 204 (no body) |
| **OPTIONS** | CORS preflight, sent automatically by the browser | permitted for `/**` in `SecurityConfig` | 200 |

### 4.3 Status codes this API returns

| Code | When | Produced by |
| --- | --- | --- |
| 200 OK | Successful read, update, login, import | default |
| 201 Created | New expense, category, rule, budget | `@ResponseStatus(HttpStatus.CREATED)` |
| 204 No Content | Successful delete | `@ResponseStatus(HttpStatus.NO_CONTENT)` |
| 400 Bad Request | Validation failure, business rule failure, bad sort field | `ApiExceptionHandler` |
| 401 Unauthorized | Missing/invalid/expired token, wrong password | `HttpStatusEntryPoint`, `BadCredentialsException` handler |
| 404 Not Found | Record does not exist **or belongs to someone else** | `NotFoundException` handler |
| 409 Conflict | A database unique index caught a race | `DataIntegrityViolationException` handler |
| 413 Payload Too Large | Upload over the 5 MB multipart limit (nginx allows 6 MB) | Spring/nginx; handled in `Import.jsx` |
| 429 Too Many Requests | Rate limit hit on login or password reset | `TooManyRequestsException` handler |
| 500 | Anything unhandled | Spring Boot default |

### 4.4 The parts of a request and a response

- **Request headers**: `Authorization: Bearer eyJ…` (who you are), `Content-Type: application/json` (what
  the body is), `Origin` (added by the browser, used for CORS), `X-Forwarded-For` (added by proxies, read by
  `AuthController.clientIp` for rate limiting).
- **Request body**: JSON for normal calls; `multipart/form-data` for the CSV upload
  (`FormData.append('file', selected)` → `@RequestParam("file") MultipartFile file`).
- **Query parameters**: optional filters after `?`. In `ExpenseController.list`: `from`, `to`, `kind`,
  `categoryId`, `q`, plus `page`, `size`, `sort`, which Spring binds into a `Pageable`
  (default: 25 rows, newest `spentOn` first).
- **Path variables**: the id inside the URL. `@DeleteMapping("/{id}")` with `@PathVariable Long id`.
- **Response headers**: `Content-Type: application/json`, the CORS header
  `Access-Control-Allow-Origin`, and Spring Security's default headers.
- **Response body**: JSON.

A real exchange:

```http
POST /api/expenses HTTP/1.1
Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
Content-Type: application/json

{"amount":420,"spentOn":"2026-11-10","description":"Uber to office","categoryId":3,"kind":"EXPENSE"}
```

```http
HTTP/1.1 201 Created
Content-Type: application/json

{"id":57,"amount":420.00,"spentOn":"2026-11-10","description":"Uber to office","categoryId":3,
 "categoryName":"Transport","categoryColor":"#3D6B8E","source":"MANUAL","kind":"EXPENSE"}
```

An error body (built in `ApiExceptionHandler.body`):

```json
{"timestamp":"2026-11-11T05:10:00Z","status":400,"error":"Bad Request",
 "message":"amount must be greater than 0","path":"/api/expenses"}
```

A paged response is Spring's `Page` object: `{"content":[…], "totalElements":143, "totalPages":6, …}`.
The frontend reads `content`, `totalElements` and `totalPages`.

---

## 5. Frontend and Backend Communication

**How they are connected.** They are two separate programs that only share an HTTP/JSON contract. The
frontend is static files running in the browser; the backend is a Java process. All calls go through one
Axios instance, `frontend/src/api/client.js`:

```js
const client = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401 && !error.config.url.includes('/auth/')) {
    localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY)
    window.location.assign('/login')
  }
  return Promise.reject(error)
})
```

**How Axios works here.** `client.get(url, {params})` returns a Promise. Axios serialises `params` into
the query string, serialises object bodies to JSON, parses JSON responses into `response.data`, and
**rejects the promise for any non-2xx status** (the built-in `fetch` does not; it only rejects on network
failure). Interceptors are functions that run on every request and every response, which is how the token
and the 401 handling are written once instead of in every page.

**How endpoints are defined.** On the backend with annotations: `@RestController` +
`@RequestMapping("/api/expenses")` on the class, then `@GetMapping`, `@PostMapping`, `@PutMapping("/{id}")`,
`@DeleteMapping("/{id}")` on methods.

**All endpoints** (every one below was checked in the controllers):

| Method and path | Auth | Purpose | Called from |
| --- | --- | --- | --- |
| `POST /api/auth/register` | open | Create account, returns token | `AuthContext.register` |
| `POST /api/auth/login` | open, rate limited | Returns token | `AuthContext.login` |
| `POST /api/auth/google` | open | Google ID token → our token | `AuthContext.loginWithGoogle` |
| `POST /api/auth/password/forgot` | open, rate limited | Email a reset code | `ForgotPassword.jsx` |
| `POST /api/auth/password/reset` | open, rate limited | Code + new password | `ForgotPassword.jsx` |
| `GET /api/auth/config` | open | `{googleEnabled, passwordResetEmailConfigured}` | `GoogleSignInButton.jsx` |
| `GET /api/profile`, `PUT /api/profile` | token | Read / update username and age | `Profile.jsx` |
| `GET /api/expenses` | token | Paged, filtered list | `Transactions.jsx`, `Dashboard.jsx` |
| `GET /api/expenses/{id}` | token | One transaction | *not called by the frontend* |
| `POST /api/expenses`, `PUT /api/expenses/{id}`, `DELETE /api/expenses/{id}` | token | Create, update, delete | `TransactionForm.jsx`, `Transactions.jsx` |
| `POST /api/expenses/import` | token | Multipart CSV upload | `Import.jsx` |
| `GET /api/categories`, `POST /api/categories`, `DELETE /api/categories/{id}` | token | Categories | `Categories.jsx` and others |
| `GET /api/categories/rules`, `POST /api/categories/rules`, `DELETE /api/categories/rules/{id}` | token | Keyword rules | `Categories.jsx` |
| `GET /api/budgets?month=YYYY-MM`, `POST`, `PUT /{id}`, `DELETE /{id}` | token | Budgets | `Budgets.jsx`, `Dashboard.jsx` |
| `GET /api/reports/summary`, `/by-category`, `/daily` (`?from&to`), `/monthly` (`?months`) | token | Aggregates | `Dashboard.jsx`, `Analytics.jsx` |
| `GET /actuator/health` | open | Health check for Docker and Render | infrastructure |

**How JSON is transferred.** Java `record` classes are the request and response shapes. Jackson maps JSON
field names to record components by name: `{"spentOn":"2026-11-10"}` ↔ `LocalDate spentOn`. `BigDecimal`
becomes a JSON number, `Instant` an ISO string, enums their names (`"EXPENSE"`).

**CORS: what it is and why it is needed.** Browsers apply the *same-origin policy*: JavaScript on
`http://localhost:5173` may not read a response from `http://localhost:8081` unless that server says it is
allowed. CORS is how the server says so. For a request with a JSON body or an `Authorization` header the
browser first sends an `OPTIONS` *preflight*; the server answers with `Access-Control-Allow-Origin`,
`-Methods` and `-Headers`, and only then does the browser send the real request. In `SecurityConfig`:

```java
config.setAllowedOrigins(props.cors().allowedOrigins());   // from CORS_ORIGINS
config.setAllowedMethods(List.of("GET", "POST", "PUT", "DELETE", "OPTIONS"));
config.setAllowedHeaders(List.of("*"));
```

Two things worth knowing:

1. CORS protects **browser users**, not the API. curl or Postman ignore it. The API is protected by the JWT.
2. **In production and in Docker, CORS is not even involved**, because the browser only ever talks to one
   origin: Vercel rewrites `/api/*` to Render (`vercel.json`), and nginx proxies `/api/` to the backend
   container (`nginx.conf`). CORS only matters for local development, where the Vite server and the API
   run on different ports.

**How authentication information travels.** In the `Authorization: Bearer <jwt>` header on every request.
No cookies are used.

**How errors are handled.** The backend always answers with `{message: …}`; `errorMessage(error, fallback)`
in `client.js` reads `error.response.data.message`. Pages show it either in an inline `Alert` (forms) or a
snackbar (`notify(message, 'error')`), or as a full `ErrorState` with a Retry button when a page load fails.

**How responses become UI.** Each page keeps `data`, `loading` and `error` in `useState`, fetches inside
`useEffect`, and renders one of four states: skeleton, error, empty, or content.

---

## 6. Project Architecture

### 6.1 The big picture

```mermaid
flowchart LR
    subgraph Browser
      SPA[React SPA<br/>React Router, MUI, Recharts, Axios]
    end
    subgraph Static host
      V[Vercel or nginx<br/>serves index.html and assets<br/>forwards /api]
    end
    subgraph API[Spring Boot API, one deployable JAR]
      SEC[Security filter chain<br/>CORS, JwtAuthFilter]
      CTRL[Controllers]
      SVC[Services]
      REPO[Repositories<br/>Spring Data JPA]
    end
    DB[(PostgreSQL 16<br/>schema owned by Flyway)]
    G[Google<br/>public signing keys]
    M[SMTP server<br/>optional]

    SPA -- HTTPS JSON + Bearer JWT --> V --> SEC --> CTRL --> SVC --> REPO -- JDBC --> DB
    SVC -. verify ID token .-> G
    SVC -. reset code email .-> M
```

**Client-server architecture.** The browser (client) asks; the API (server) answers. The server never
pushes; there are no WebSockets. The two sides can be built, tested and deployed independently.

**Three tiers.** Presentation (React), application logic (Spring Boot), data (PostgreSQL).

**Monolith.** The backend is one Spring Boot application with one database. It is a *modular* monolith:
the code is split by feature into packages.

### 6.2 Backend: layered, packaged by feature

Each feature package contains its own layers:

```
com.expensetracker
├── auth      controller, services, JWT filter, security config, reset-code entity
├── user      User entity, repository, profile controller + service
├── expense   controller, service, repository, entity, DTOs
├── category  controller, service, 2 repositories, 2 entities
├── budget    controller, service, repository, entity
├── importer  CsvImportService, ImportSummary
├── report    controller, service, result records/projections
└── common    exception handler, exceptions, config properties, rate limiter, Dates
```

The dependency direction inside a feature is always **Controller → Service → Repository → Database**.

| Layer | Job | Knows about HTTP? | Knows about SQL? |
| --- | --- | --- | --- |
| Controller (`@RestController`) | Map URL + JSON to a method call, validate shape, pick status code | yes | no |
| Service (`@Service`) | Business rules, transactions, entity ↔ DTO conversion | no | no |
| Repository (interface) | Queries | no | yes |
| Entity (`@Entity`) | One row of one table | no | mapping only |

**Is it MVC?** Partly. Spring MVC is the web framework in use (`spring-boot-starter-webmvc`), and the
controllers are the "C". But the server renders no HTML, so there is no server-side "V". The accurate
description is: *a REST API built on Spring MVC with a layered architecture; the view is a separate React
application.*

**REST.** Resources are nouns (`/expenses`, `/budgets`, `/categories/rules`), HTTP methods are the verbs,
status codes carry the outcome, and the server is stateless (each request carries its own token). A few
endpoints are actions rather than resources (`/auth/login`, `/expenses/import`), which is normal.

### 6.3 Frontend architecture

A single-page application: one HTML page, and React Router swaps components when the URL changes.

```
main.jsx        BrowserRouter > AuthProvider > App
App.jsx         ThemeProvider > FeedbackProvider > ErrorBoundary > Routes
pages/          one component per route; each owns its data fetching
components/     reusable pieces: layout, charts, transactions, common, auth, dashboard
auth/           AuthContext: token + user, login/register/logout, RequireAuth guard
api/client.js   the single Axios instance
utils/format.js currency, percent and date formatting
theme.js        MUI theme, light and dark palettes, fonts
```

**State management.** No Redux and no data-fetching library. Two React Contexts hold what is truly global
(`AuthContext` for the session, `FeedbackContext` for the snackbar); everything else is local `useState`
inside the page that needs it. The app is small enough that pages do not need to share server data.

### 6.4 Authentication architecture

Stateless JWT. The server stores no sessions; the signed token *is* the session. Details in §10.

### 6.5 Database architecture

One PostgreSQL database, six tables, every user-owned row carries `user_id` (a shared-schema multi-tenant
design). Details in §7.

### 6.6 Deployment architecture

```mermaid
flowchart LR
    U[User's browser] -->|HTTPS| VC[Vercel<br/>static React build]
    VC -->|rewrite /api/*| RN[Render web service<br/>Docker: Spring Boot JAR]
    RN -->|JDBC, private network| PG[(Render PostgreSQL)]
    GH[GitHub repo] -->|push to main| CI[GitHub Actions<br/>build + test]
```

Three ways to run it exist in the repo: local dev, `docker compose` (db + backend + nginx frontend), and
cloud (Vercel + Render, with `render.yaml` as a blueprint). Details in §12.

### 6.7 Why this architecture

- A **separate SPA + REST API** lets the frontend be hosted for free on a CDN and gives the API a clean
  contract that could later serve a mobile app.
- **Layering** keeps HTTP, rules and SQL apart, so each can be tested and changed alone.
- **Package by feature** means a change to budgets touches one folder.
- A **monolith** is the right size: one developer, one database, features that share the same tables
  (budgets and reports both read `expenses`). Microservices would add network calls, separate deployments
  and distributed transactions with no benefit at this scale.
- **Stateless JWT** means any API instance can serve any request.

---

## 7. Database Analysis

### 7.1 Why PostgreSQL

The data is relational (users own transactions, transactions belong to categories, budgets join the two)
and money needs exact arithmetic and strong guarantees. PostgreSQL gives: the exact `numeric` type; real
transactions; foreign keys and CHECK constraints; **expression indexes** (`lower(username)`), **partial
indexes** (`where source = 'CSV'`) and the `sum(...) filter (where ...)` clause, all of which this project
uses. It is also free and offered as a managed service by Render.

### 7.2 ER diagram

```mermaid
erDiagram
    USERS ||--o{ EXPENSES : owns
    USERS ||--o{ CATEGORIES : "creates (user_id NULL = built-in)"
    USERS ||--o{ CATEGORY_RULES : defines
    USERS ||--o{ BUDGETS : sets
    USERS ||--o{ PASSWORD_RESET_CODES : requests
    CATEGORIES ||--o{ EXPENSES : classifies
    CATEGORIES ||--o{ CATEGORY_RULES : "target of"
    CATEGORIES ||--o{ BUDGETS : limits

    USERS {
        bigserial id PK
        varchar email UK
        varchar password_hash "nullable"
        varchar username "unique on lower()"
        integer age "13 to 120 or null"
        varchar provider "LOCAL or GOOGLE"
        varchar google_sub UK
        varchar avatar_url
        timestamptz created_at
    }
    CATEGORIES {
        bigserial id PK
        bigint user_id FK "null = built-in"
        varchar name
        varchar color "hex"
    }
    EXPENSES {
        bigserial id PK
        bigint user_id FK
        bigint category_id FK "nullable"
        numeric amount "12,2 and > 0"
        date spent_on
        varchar description
        varchar source "MANUAL or CSV"
        varchar kind "EXPENSE or INCOME"
        timestamptz created_at
    }
    CATEGORY_RULES {
        bigserial id PK
        bigint user_id FK
        varchar keyword
        bigint category_id FK
    }
    BUDGETS {
        bigserial id PK
        bigint user_id FK
        bigint category_id FK
        numeric monthly_limit "12,2 and > 0"
        timestamptz created_at
    }
    PASSWORD_RESET_CODES {
        bigserial id PK
        bigint user_id FK
        varchar code_hash
        timestamptz expires_at
        integer attempts
        timestamptz used_at
        timestamptz created_at
    }
```

### 7.3 Tables

| Table | Purpose | Notes |
| --- | --- | --- |
| `users` | Accounts | `password_hash` is nullable because Google-only accounts have no password. A CHECK guarantees `password_hash IS NOT NULL OR google_sub IS NOT NULL`, so an account can never have *no* way to sign in |
| `categories` | Labels for transactions | `user_id NULL` marks the 10 built-in categories shared by everyone |
| `expenses` | Every transaction, **income and expense in one table** | `kind` tells them apart. They have the same shape, and one table lets the monthly report compute both in a single pass |
| `category_rules` | keyword → category, per user | Used only by the CSV import |
| `budgets` | Monthly limit for one category | One row per `(user_id, category_id)`; the same limit applies to every month |
| `password_reset_codes` | One-time reset codes | Stores a BCrypt **hash** of the code, never the code |

### 7.4 Keys and relationships

- **Primary keys**: every table has `id bigserial` (an auto-incrementing 64-bit integer).
- **Foreign keys and what happens on delete**:
  - Deleting a **user** cascades to all of their rows (`on delete cascade` everywhere).
  - Deleting a **category** sets `expenses.category_id` to NULL (`on delete set null`), so transactions
    survive and show as "Uncategorized", while its rules and budgets are deleted (`cascade`).
- **Relationship types**: all are **one-to-many** (one user → many expenses, one category → many
  expenses, and so on). There is **no one-to-one** and **no many-to-many** relationship. A transaction has
  at most one category, so no join table is needed.

### 7.5 Constraints

| Constraint | Purpose |
| --- | --- |
| `amount > 0`, `monthly_limit > 0` | No zero or negative money. Direction is carried by `kind` |
| `age is null or age between 13 and 120` | Same rule as the Java validation, enforced again in the database |
| `email` UNIQUE | One account per email |
| `unique (user_id, category_id)` on budgets | One budget per category per user |
| `password_hash is not null or google_sub is not null` | Every account has a way in |
| NOT NULL on required columns | Basic integrity |

### 7.6 Indexes (all implemented in the migrations)

| Index | Type | Why |
| --- | --- | --- |
| `expenses_user_date_idx (user_id, spent_on desc)` | composite | The most common query: "this user's transactions in a date range, newest first" |
| `expenses_user_kind_date_idx (user_id, kind, spent_on desc)` | composite | Report queries filter by kind as well |
| `expenses_dedupe_uq (user_id, spent_on, amount, lower(description)) where source = 'CSV'` | unique, expression, **partial** | Makes re-uploading the same bank file harmless, without blocking two identical hand-typed entries (changed in V7) |
| `categories_user_name_uq (coalesce(user_id, 0), lower(name))` | unique, expression | Case-insensitive unique names. `coalesce` is needed because PostgreSQL treats NULLs as different from each other in a unique index, so without it two built-in "Rent" rows would be allowed |
| `category_rules_user_keyword_uq (user_id, lower(keyword))` | unique, expression | One rule per keyword per user |
| `users_username_uq (lower(username))` | unique, expression | Case-insensitive usernames |
| `users_google_sub_uq (google_sub)` | unique | One account per Google identity |
| `password_reset_codes_user_idx (user_id, created_at desc)` | composite | "Newest code for this user" |

### 7.7 Flyway migrations

The schema is created only by SQL files in `backend/src/main/resources/db/migration`. Flyway runs any file
it has not run before, in version order, at startup, and records it in the `flyway_schema_history` table.

| File | What it does |
| --- | --- |
| `V1__init.sql` | `users`, `categories`, `expenses`, `category_rules` and their indexes |
| `V2__seed_categories.sql` | Inserts the 10 built-in categories |
| `V3__income_and_budgets.sql` | Adds `expenses.kind`, creates `budgets` |
| `V4__recolour_categories.sql` | Data update: new colours |
| `V5__user_profile_and_google.sql` | Adds username, age, provider, google_sub, avatar_url. **Backfills** usernames for existing rows from the email, *then* makes the column NOT NULL |
| `V6__password_reset_codes.sql` | Reset codes table |
| `V7__dedupe_only_imported_rows.sql` | Rebuilds the dedupe index as a partial index (uncommitted) |
| `V8__ledger_category_colours.sql` | Data update: colours for the new design (uncommitted) |

`application.yml` sets `spring.jpa.hibernate.ddl-auto: validate`: at startup Hibernate compares the entity
classes with the real tables and **refuses to start** if they disagree. Hibernate never changes the schema.

### 7.8 Entities and mapping

Each table has a class annotated `@Entity` and `@Table(name = "...")`. Example, `expense/Expense.java`:

```java
@Entity
@Table(name = "expenses")
public class Expense {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "user_id", nullable = false) private Long userId;
    @Column(name = "category_id") private Long categoryId;
    @Column(nullable = false) private BigDecimal amount;
    @Column(name = "spent_on", nullable = false) private LocalDate spentOn;
    @Enumerated(EnumType.STRING) @Column(nullable = false) private Kind kind;
    @Column(name = "created_at", insertable = false, updatable = false) private Instant createdAt;
```

Points an interviewer may probe:

- **Foreign keys are plain `Long` fields, not `@ManyToOne` objects.** This is a deliberate choice. There
  are no lazy-loaded associations, so there is no N+1 query problem and no `LazyInitializationException`,
  and every query is explicit. The cost: the code must fetch related data itself (`categoriesById(userId)`
  builds a map of categories to fill in names), and there is no JPA cascading (the database's
  `ON DELETE` rules do that job).
- `@Enumerated(EnumType.STRING)` stores `"EXPENSE"`, not `0`. Reordering the enum later cannot corrupt data.
- `created_at` is `insertable = false, updatable = false`: the database default `now()` fills it in.
  In `User` it also has `@Generated(event = EventType.INSERT)` so Hibernate reads the value back after
  inserting and the registration response can include it.
- The `protected` no-argument constructor exists because JPA requires one; application code uses the public
  constructor or the factory methods (`User.local(...)`, `User.google(...)`).
- Entities have no public setters for most fields. State changes go through named methods
  (`expense.update(...)`, `user.linkGoogle(...)`, `code.markUsed(now)`).

### 7.9 How data is inserted, read, updated and deleted

Spring Data JPA offers four ways to define a query. This project uses all four:

1. **Inherited methods** from `JpaRepository`: `save`, `findById`, `delete`.
2. **Derived queries**, where the method name *is* the query:
   `findByIdAndUserId(Long id, Long userId)` → `select … from expenses where id = ? and user_id = ?`;
   `existsByUserIdAndKeywordIgnoreCase(...)` → `select … where user_id = ? and upper(keyword) = upper(?)`.
3. **JPQL with `@Query`** (queries written against entity and field names):
   ```java
   @Query("""
       select new com.expensetracker.report.CategoryTotal(
                coalesce(c.name, 'Uncategorized'), coalesce(c.color, '#8A857A'), sum(e.amount), count(e))
       from Expense e left join Category c on c.id = e.categoryId
       where e.userId = :userId and e.kind = :kind and e.spentOn between :from and :to
       group by c.name, c.color
       order by sum(e.amount) desc
       """)
   ```
   `select new …` (a constructor expression) builds a result record straight from the query.
4. **Native SQL** with `nativeQuery = true`, where PostgreSQL features are needed:
   ```sql
   select to_char(date_trunc('month', spent_on), 'YYYY-MM')        as month,
          coalesce(sum(amount) filter (where kind = 'INCOME'), 0)  as income,
          coalesce(sum(amount) filter (where kind = 'EXPENSE'), 0) as expense
   from expenses where user_id = :userId and spent_on >= :from
   group by 1 order by 1
   ```
   The result is mapped to an **interface projection** (`MonthlyTotal` with `getMonth()`, `getIncome()`,
   `getExpense()`); Spring matches column aliases to getter names.

**How Hibernate executes them.**

- **Insert**: `save(newEntity)` → `INSERT`. With IDENTITY ids the insert happens at once to obtain the id.
- **Read**: the query runs as a JDBC `PreparedStatement` with `?` placeholders. Values are sent separately
  from the SQL text, which is why SQL injection is not possible here.
- **Update**: `findByIdAndUserId` loads a *managed* entity. `expense.update(...)` changes its fields. At
  commit, Hibernate's **dirty checking** notices the change and issues an `UPDATE`. The explicit
  `expenses.save(expense)` in the service is not strictly needed, but it makes the intent clear.
- **Delete**: load the entity (scoped by user), then `delete(entity)` → `DELETE … where id = ?`.
- **Pagination**: passing a `Pageable` makes Spring add `ORDER BY … LIMIT ? OFFSET ?` and run a second
  `select count(…)` to know the total.
- **Bulk update**: `retireAllFor` in `PasswordResetCodeRepository` uses `@Modifying` + `@Query("update …")`
  to mark all of a user's old codes as used in one statement.
- **Transactions**: `@Transactional` on service methods. `readOnly = true` on reads is a hint that lets
  Hibernate skip dirty checking.
- `spring.jpa.open-in-view: false`: the database session is closed when the service method returns, not
  kept open while the JSON is written. Controllers therefore only ever handle DTOs.
- `hibernate.jdbc.time_zone: UTC`: timestamps are written and read in UTC whatever the server's time zone.

---

## 8. Codebase and File Structure

### 8.1 Top level

| Path | Responsibility |
| --- | --- |
| `backend/` | Spring Boot API (Maven project) |
| `frontend/` | React SPA (Vite project) |
| `docker-compose.yml` | Runs PostgreSQL + backend + nginx frontend together |
| `render.yaml` | Render "blueprint": API, static site, database |
| `.github/workflows/ci.yml` | CI: build and test both halves on every push to `main` and every pull request |
| `.env.example` | Documents every environment variable. The real `.env` is git-ignored |
| `sample-data/transactions.csv`, `seed-demo.sh` | A sample bank file and a script that fills a demo account through the public API |
| `docs/*.jpg` | Screenshots for the README |
| `README.md`, `INTERVIEW_PREP.md` | Documentation (the latter is the older prep notes) |

### 8.2 Backend (`backend/src/main/java/com/expensetracker`)

**Entry point.** `BackendApplication.java`: `@SpringBootApplication` + `SpringApplication.run(...)`. That
one annotation turns on component scanning (find every `@Service`, `@RestController`, … under this
package), auto-configuration (set up Tomcat, the DataSource, Hibernate, Security, Flyway based on the
dependencies present), and marks the class as a configuration source.

**`auth/`**

| File | Responsibility | Connected to |
| --- | --- | --- |
| `SecurityConfig` | Defines the security filter chain (CSRF off, CORS on, stateless, which URLs are open), the `PasswordEncoder` bean (BCrypt) and the CORS rules. Also enables `AppProperties` | Uses `JwtAuthFilter`, `AppProperties` |
| `JwtService` | Creates and verifies JWTs with the JJWT library | Used by `AuthService`, `JwtAuthFilter` |
| `JwtAuthFilter` | Runs once per request; turns a valid `Bearer` token into an authenticated principal (the user id) | Registered in `SecurityConfig` |
| `AuthController` | `/api/auth/*` endpoints, rate limiting, and the request/response records (`RegisterRequest`, `LoginRequest`, `AuthResponse`, …) | Calls the three auth services and `RateLimiter` |
| `AuthService` | Register and login rules; `token(user)` builds the `AuthResponse` | `UserRepository`, `PasswordEncoder`, `JwtService` |
| `GoogleAuthService` | Verifies a Google ID token, then finds, links or creates the user | `UserRepository`, `AuthService.token` |
| `PasswordResetService` | Request a code; exchange a code for a new password | `PasswordResetCodeRepository`, `ResetCodeMailer` |
| `PasswordResetCode` + repository | Entity and queries for reset codes | |
| `ResetCodeMailer` | Sends the email, or logs the code when SMTP is not configured | `JavaMailSender` (optional) |

**`user/`**: `User` (entity with factory methods `local` and `google`), `UserRepository` (derived queries
such as `findByEmailIgnoreCase`), `ProfileController` + `ProfileService` (read/update profile, and the
shared `toDto`), `Usernames` (the allowed pattern, `normalise`, and `fromEmail`, which derives a free
username for Google sign-ups by appending 2, 3, …).

**`expense/`**: `Expense` (entity with enums `Source` and `Kind`), `ExpenseRequest` (input record with
validation annotations), `ExpenseDto` (output record), `ExpenseController`, `ExpenseService`,
`ExpenseRepository` (**every aggregate query in the app lives here**, because they all read the `expenses`
table; `report` and `budget` call it).

**`category/`**: `Category`, `CategoryRule` (entities), their repositories, `CategoryService`,
`CategoryController` (categories and rules, with DTO records nested inside the controller).

**`budget/`**: `Budget`, `BudgetRepository`, `BudgetService` (joins budgets with one grouped spend query in
memory), `BudgetController`.

**`importer/`**: `CsvImportService` (header mapping, date and amount parsing, duplicate check, rule
matching; contains the small nested records `Columns` and `Rules`), `ImportSummary` (the response).

**`report/`**: `ReportController` (four GET endpoints and the response records), `ReportService` (averages,
savings rate, percentage change, previous-period logic), and the query result types `CategoryTotal`,
`CategorySpend` (records for JPQL constructor expressions), `MonthlyTotal`, `DailyTotal` (interface
projections for native queries).

**`common/`**

| File | Responsibility |
| --- | --- |
| `ApiExceptionHandler` | `@RestControllerAdvice`: turns exceptions from any controller into a consistent JSON error |
| `BadRequestException`, `NotFoundException`, `TooManyRequestsException` | Small unchecked exceptions that services throw to signal 400 / 404 / 429 |
| `AppProperties` | `@ConfigurationProperties(prefix = "app")`: a typed record view of the `app.*` settings (JWT secret and TTL, CORS origins, Google client id) |
| `ProductionConfigCheck` | `@PostConstruct` check at startup: fails if the JWT secret is shorter than 32 bytes, or is the sample secret outside the dev/test/default profiles |
| `RateLimiter` | In-memory fixed-window counter keyed by a string such as `login:1.2.3.4` |
| `Dates` | `latestToday()`: UTC today + 1 day, the latest date that is already "today" somewhere on Earth |

**Where DTOs live.** As Java `record`s, either in their own file (`ExpenseDto`, `ExpenseRequest`,
`ImportSummary`) or nested in the controller that uses them (`BudgetDto`, `CategoryDto`, `ProfileDto`).
Entities are never returned from controllers.

**Resources**: `application.yml` (all configuration, each value overridable by an environment variable
through `${NAME:default}`), `db/migration/*.sql` (§7.7).

**Tests** (`backend/src/test`): §8.4.

**Build and packaging**: `pom.xml` (dependencies; parent `spring-boot-starter-parent` 4.1.1; Java 21),
`mvnw` (Maven wrapper, so no local Maven install is needed), `Dockerfile` (§12).

### 8.3 Frontend (`frontend/src`)

| File | Responsibility | Depends on / used by |
| --- | --- | --- |
| `main.jsx` | Entry point. Mounts React into `#root`, wraps the app in `StrictMode`, `BrowserRouter`, `AuthProvider` | `index.html` loads it |
| `App.jsx` | Theme (light/dark, remembered in `localStorage`, defaulting to the OS setting), providers, and the route table | All pages |
| `api/client.js` | The Axios instance, both interceptors, `errorMessage` helper, storage key names | Every page that talks to the API |
| `auth/AuthContext.jsx` | `AuthProvider` (token + user state, `login`, `register`, `loginWithGoogle`, `logout`, `setUser`), the `useAuth` hook, the `RequireAuth` route guard | `main.jsx`, `App.jsx`, auth pages, layout |
| `theme.js` | MUI theme factory `createAppTheme(mode)`, fonts, the `mono` style for numbers | `App.jsx`, charts |
| `utils/format.js` | `formatCurrency` (the only place money becomes text), dates, `today()` in the user's local time zone, `monthRange` | Most pages |
| `pages/Login.jsx`, `Register.jsx`, `ForgotPassword.jsx` | Public auth screens | `AuthLayout`, `GoogleSignInButton` |
| `pages/Dashboard.jsx` | Month picker, stat cards, charts, budget bars, recent transactions | `Charts`, `StatCard`, `BudgetBar` |
| `pages/Transactions.jsx` | Filters, debounced search, pagination, add/edit/delete | `TransactionFilters`, `TransactionForm`, `TransactionList` |
| `pages/Budgets.jsx`, `Categories.jsx`, `Analytics.jsx`, `Import.jsx`, `Profile.jsx` | One feature each | shared components |
| `components/layout/MainLayout.jsx` | Sidebar on desktop, drawer on mobile, theme toggle, sign-out, and the `<Outlet/>` where the current page renders | `App.jsx` |
| `components/layout/AuthLayout.jsx`, `Wordmark.jsx` | Frame and logo for the auth screens | |
| `components/common/States.jsx` | `PageHeader`, `EmptyState`, `ErrorState`, skeletons, `SectionCard` | All pages |
| `components/common/Feedback.jsx` | `FeedbackProvider` + `useFeedback().notify(...)`: one snackbar for the whole app | All pages |
| `components/common/ErrorBoundary.jsx` | Class component that catches render crashes and shows a fallback | `App.jsx` |
| `components/common/ConfirmDialog.jsx` | "Are you sure?" dialog with a busy state | Delete actions |
| `components/charts/Charts.jsx` | `IncomeExpenseChart`, `CategoryDonut`, `SpendTrendChart` (Recharts) | Dashboard, Analytics |
| `components/transactions/*` | Filter bar, form dialog, table (desktop) and cards (mobile) | `Transactions.jsx` |
| `components/auth/GoogleSignInButton.jsx` | Loads Google's script once, asks the server whether Google is enabled, renders Google's button | Login, Register |
| `test/Login.test.jsx`, `test/setup.js` | Vitest + React Testing Library | |

**Hooks.** There are two custom hooks, `useAuth()` and `useFeedback()`, both thin wrappers over
`useContext` that throw if used outside their provider. Built-in hooks in use: `useState`, `useEffect`,
`useCallback`, `useMemo`, `useRef`, `useContext`, plus `useNavigate`, `useLocation` (router) and `useTheme`,
`useMediaQuery` (MUI). There is no `hooks/` folder.

**Frontend config files**: `package.json` (scripts and dependencies), `vite.config.js` (React plugin and
Vitest settings), `.env.development` (`VITE_API_URL=http://localhost:8081/api`, the Google client id),
`.env.production` (empty, so the base URL falls back to `/api`), `vercel.json` (rewrites), `nginx.conf` and
`Dockerfile` (container build), `.oxlintrc.json` (lint rules).

### 8.4 Tests

| Test class | Kind | What it proves |
| --- | --- | --- |
| `ExpenseApiIntegrationTest` (11) | Full stack: MockMvc → real PostgreSQL in Docker | 401 without a token; validation; user A cannot see or delete user B's data; import + categorisation + row errors; report totals; income and savings rate; budgets; identical manual entries allowed; time-zone-tolerant "today"; `%` and `_` in search are literal; one over-long row does not fail the file |
| `PasswordResetTest` (8) | Full stack | Code works once; only a hash is stored; wrong codes are counted and lock; a new code retires the old; unknown email looks identical; request limit; login throttling |
| `ProfileApiTest` (6) | Full stack | Registration returns the profile; unique/valid usernames; age limits; own profile only; login by username or email; Google endpoint fails cleanly when not configured |
| `CsvParsingTest` (9) | Unit | Date formats, amount formats, longest keyword wins, header mapping |
| `ReportServiceTest` (2) | Unit | `previousPeriod` for whole months and other ranges |
| `UsernamesTest` (4) | Unit | Deriving usernames from emails |
| `BackendApplicationTests` (1) | Smoke | The Spring context starts |
| `Login.test.jsx` (2) | Frontend component | Successful login stores the token; failed login shows the server's message |

Total: **41 backend tests, 2 frontend tests.** `TestcontainersConfiguration` starts a `postgres:16-alpine`
container and `@ServiceConnection` points the application's DataSource at it automatically.

---

## 9. Technology Stack and Design Decisions

Versions are taken from `pom.xml` and `package.json`.

### 9.1 Backend

**Java 21**
- *What / why*: a statically typed, compiled language running on the JVM; version 21 is a long-term
  support release. Used for the whole backend.
- *Features this project uses*: `record` (all DTOs), text blocks `"""` (JPQL and SQL), `var`, `Optional`,
  streams, `List.of` / `Set.of`.
- *Advantages*: type safety catches mistakes at compile time; mature ecosystem; strong tooling; good
  performance under load.
- *Limitations*: more verbose than Python or JavaScript; slower startup and higher memory use (relevant on
  Render's free tier).
- *Alternatives*: Node.js (one language for both halves, lighter, but weaker typing unless TypeScript is
  added, and less built-in structure); Python with Django/FastAPI (faster to write, slower at runtime).
- *Why Java here*: the project handles money and security, where strict types, `BigDecimal` and a
  battle-tested security framework matter more than writing speed.

**Spring Boot 4.1.1**
- *What*: a framework that assembles a production-ready Spring application with almost no configuration.
- *Problem solved*: without it you would wire the web server, JSON conversion, connection pool, ORM,
  security and transactions by hand.
- *How it works*: **starters** pull in groups of libraries; **auto-configuration** creates beans based on
  what is on the classpath and in `application.yml`; the **IoC container** creates objects ("beans") and
  injects them where needed (dependency injection); an **embedded Tomcat** means the app is one runnable JAR.
- *Where*: everywhere in `backend/`.
- *Limitations*: a lot happens "by magic", which makes debugging harder when you do not know the
  conventions; heavy startup.
- *Alternatives*: plain Spring MVC (same framework, manual XML/Java configuration and an external
  Tomcat); Django (Python, includes an ORM and admin UI); Express/NestJS (Node).
- *Why*: it is the standard for Java REST APIs and gives security, validation and data access that work
  together.

**Spring MVC (`spring-boot-starter-webmvc`)**: the web layer. `DispatcherServlet` routes each request to a
controller method, converts JSON with Jackson, and resolves arguments such as `@RequestBody`,
`@PathVariable`, `@RequestParam`, `Pageable`. It is blocking: one thread per request. The alternative,
Spring WebFlux (non-blocking), would not help because JDBC is blocking anyway.

**Spring Security + JJWT 0.12.6**: see §10. Alternative: Spring's own OAuth2 resource-server support could
replace the hand-written filter; server-side sessions could replace JWT entirely.

**Spring Data JPA / Hibernate**
- *What*: JPA is the standard Java API for mapping objects to tables; Hibernate implements it; Spring Data
  JPA generates repository implementations from interfaces.
- *Problem solved*: removes the repetitive JDBC code (open connection, prepare statement, set parameters,
  loop over the result set, map columns to fields, close everything).
- *Advantages*: CRUD with no code; derived queries; pagination; dirty checking; still allows hand-written
  JPQL and native SQL.
- *Limitations*: hides the SQL, which can produce inefficient queries (N+1) if you are not careful; a
  learning curve around the persistence context.
- *Alternatives*: plain JDBC / `JdbcTemplate` (full control, much more code); MyBatis (you write all SQL in
  mapper files, it maps results); jOOQ (type-safe SQL builder).
- *Why JPA here*: most operations are simple CRUD, where JPA saves the most code, and for the reporting
  queries the project drops down to `@Query` and native SQL. It avoids JPA's usual trap by not using
  entity associations at all.

**PostgreSQL 16**: see §7.1. *Alternatives*: MySQL (would also work; no `FILTER` clause, weaker expression
and partial index support); MongoDB (a document store; poor fit because the data is relational, reports
need joins and grouping, and multi-row consistency matters for money). *Limitation accepted*: the native
queries tie the app to PostgreSQL.

**Flyway**: versioned SQL migrations. *Alternative*: Liquibase (XML/YAML changelogs, built-in rollback
support); `ddl-auto: update` (Hibernate guesses the changes: cannot backfill data, cannot be reviewed,
unsafe in production). *Why*: plain SQL files are easy to read and review.

**Bean Validation (`spring-boot-starter-validation`)**: declarative input rules (`@NotBlank`, `@Email`,
`@Size`, `@Positive`, `@Digits`, `@Pattern`, `@Min`, `@Max`) on request records, triggered by `@Valid`.

**OpenCSV 5.9**: CSV parsing that correctly handles quoted fields containing commas and line breaks.
Splitting each line on `,` would break on `"Dinner, drinks",450`.

**spring-security-oauth2-jose (Nimbus)**: used only for `NimbusJwtDecoder`, to verify Google's ID tokens
against Google's public keys.

**spring-boot-starter-mail**: `JavaMailSender` for reset emails. Optional at runtime.

**spring-boot-starter-actuator**: provides `/actuator/health`. Only `health` is exposed, with
`show-details: never`.

**Maven**
- *What*: build tool and dependency manager; `pom.xml` declares dependencies, Maven downloads them and
  runs compile → test → package.
- *Alternative*: Gradle (faster incremental builds, Groovy/Kotlin scripts, more flexible, harder to read).
- *Why*: it is the Spring Initializr default, declarative, and the project has no custom build logic.

**Testing**: JUnit 5 (test runner), MockMvc (sends fake HTTP requests through the real filter chain and
controllers without opening a network port), Testcontainers (starts a real PostgreSQL in Docker for the
tests). *Alternative*: the H2 in-memory database, which is faster but does not support `FILTER`,
`date_trunc`, `to_char`, or partial/expression indexes the way PostgreSQL does, so the tests would either
fail or pass misleadingly.

### 9.2 Frontend

**React 19**
- *What*: a JavaScript library for building user interfaces from components. The UI is a function of
  state: when state changes, React re-renders the affected components and updates the page efficiently.
- *Alternatives*: Angular (a full framework with TypeScript, dependency injection, forms and HTTP built
  in; heavier, steeper learning curve); Vue (similar component model, template syntax, smaller job market).
- *Why React*: the largest ecosystem (MUI, Recharts, React Router), simple mental model with hooks, and
  only the libraries you choose.
- *Limitation*: it is only the view layer, so routing, HTTP and state patterns are your own choices.

**Vite 8**: development server with instant hot reload and a production bundler. Replaces the deprecated
Create React App. Variables prefixed `VITE_` are **inlined at build time**; they are public, never secret.

**Material UI (MUI) 9 + Emotion**: a library of ready-made, accessible components (buttons, dialogs,
tables, drawers) with a theme system. *Alternatives*: Tailwind CSS (utility classes, you build components
yourself), Bootstrap. *Why*: complete components, theming for light/dark, responsive helpers
(`useMediaQuery`, the `sx` breakpoints). *Limitation*: larger bundle; a recognisable look unless themed
(this project themes it heavily in `theme.js`).

**React Router 7**: client-side routing. `<Routes>`, nested routes with `<Outlet/>`, `<Navigate>`,
`useNavigate`, `useLocation`.

**Axios**: HTTP client. *Versus the built-in Fetch API*: Axios has interceptors, parses JSON automatically,
rejects on HTTP error statuses, and serialises query params. Fetch needs no dependency but you would write
a wrapper to get the same behaviour. *Why Axios*: the two interceptors in `client.js` are central to how
authentication works.

**Recharts**: chart components built on SVG, used declaratively as React components. *Alternatives*:
Chart.js (canvas-based, imperative), D3 (maximum control, much more code).

**Vitest + React Testing Library + jsdom**: test runner that reuses the Vite config; RTL renders components
and queries them the way a user would (by label and role); jsdom is a fake browser DOM for Node.

**oxlint**: a fast linter (the script `npm run lint`), run in CI.

### 9.3 Infrastructure

**Docker**
- *What*: packages an application with everything it needs into an image; a container is a running image.
- *Docker vs virtual machines*: a VM includes a whole guest operating system and takes minutes and
  gigabytes; a container shares the host's kernel, starts in seconds and is much smaller.
- *Where*: `backend/Dockerfile`, `frontend/Dockerfile`, `docker-compose.yml`, and Testcontainers.
- *Why*: "works on my machine" becomes "works everywhere"; Render deploys the backend image directly.

**Docker Compose**: starts several containers together with one command and wires their network.

**nginx**: serves the built frontend, compresses responses, sets cache and security headers, and
reverse-proxies `/api/` to the backend. Used only in the Docker setup.

**GitHub Actions**: CI. **Vercel**: hosts the static frontend. **Render**: hosts the API container and the
PostgreSQL database.

### 9.4 Design decisions

| Decision | Chosen | Alternative | Reason |
| --- | --- | --- | --- |
| API style | REST | GraphQL | Fixed screens with known data needs; REST is simpler, cacheable, and needs no extra server library. GraphQL pays off when many different clients need different shapes |
| Backend shape | Modular monolith | Microservices | One developer, one database, shared tables. Splitting would add network hops and distributed transactions |
| Session | Stateless JWT | Server-side sessions | No session store; any instance can serve any request. Cost: no instant revocation |
| Aggregation | SQL `GROUP BY` | Load rows, loop in Java | The database does it faster, with indexes, and sends back a few rows instead of thousands |
| Money | `BigDecimal` / `numeric(12,2)` | `double` | Binary floating point cannot represent 0.1 exactly, so sums drift |
| Schema | Flyway + `validate` | `ddl-auto: update` | Reviewable, repeatable, supports data backfills, and catches entity/schema drift at startup |
| Entity links | Plain id fields | `@ManyToOne` associations | No lazy loading surprises, no N+1 |
| Frontend state | Context + local state | Redux / React Query | Only the session is global; pages do not share server data |
| Import errors | Partial success | All-or-nothing | Real bank files contain junk rows; the user should not have to fix the file by hand |
| Categorisation | Longest matching keyword | Machine learning | Predictable, explainable, controlled by the user |

---

## 10. Authentication and Security

### 10.1 Authentication vs authorization

- **Authentication** = *who are you?* Answered by a password, a Google ID token, or afterwards by the JWT.
- **Authorization** = *what may you do?* Here: "you must be signed in" (`.anyRequest().authenticated()`)
  plus "you may only touch rows whose `user_id` is yours" (enforced in every query).

### 10.2 Registration and password handling

`AuthService.register` → `encoder.encode(request.password())` → `BCryptPasswordEncoder`.

BCrypt is a deliberately slow, salted, one-way hash. *One-way*: the password cannot be recovered from the
hash. *Salted*: a random salt is generated per password and stored inside the hash string, so two users
with the same password have different hashes and precomputed tables are useless. *Slow*: a work factor
(default 10, about 2¹⁰ rounds) makes brute force expensive. Login uses `encoder.matches(raw, hash)`, which
re-hashes with the stored salt and compares.

The password length limit of **72** exists because BCrypt only reads the first 72 bytes.

### 10.3 Login and token generation

```mermaid
sequenceDiagram
    participant B as Browser
    participant C as AuthController
    participant RL as RateLimiter
    participant S as AuthService
    participant J as JwtService
    participant DB as PostgreSQL
    B->>C: POST /api/auth/login {identifier, password}
    C->>RL: check("login:" + ip, 10, 15 min)
    C->>S: login(identifier, password)
    S->>DB: find by email (if it has @) or by username
    S->>S: BCrypt matches?
    alt wrong user or password
        S-->>B: 401 "Invalid username, email or password"
    else correct
        S->>J: issue(userId, email)
        J-->>S: signed JWT + expiresAt
        C->>RL: reset(key)
        C-->>B: 200 {token, expiresAt, user}
        B->>B: save token and user in localStorage
    end
```

`JwtService.issue` builds a token with `sub` = user id, an `email` claim, `iat`, and `exp` = now + 24 h
(`JWT_TTL_HOURS`), and signs it with HMAC-SHA using the secret key (`Keys.hmacShaKeyFor`; JJWT picks
HS256/384/512 from the key length).

**What a JWT is.** Three Base64URL parts joined by dots: `header.payload.signature`. The payload is
**readable by anyone** (it is encoded, not encrypted), so it must not contain secrets. The signature is
computed from the header and payload with the server's secret; change one character of the payload and the
signature no longer matches. So the server can trust the user id inside without looking anything up.

### 10.4 Token validation: the security filter

`SecurityConfig.filterChain`:

```java
http.csrf(csrf -> csrf.disable())
    .cors(Customizer.withDefaults())
    .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
    .authorizeHttpRequests(a -> a
        .requestMatchers("/api/auth/**", "/actuator/health").permitAll()
        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
        .anyRequest().authenticated())
    .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
    .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
```

`JwtAuthFilter` (a `OncePerRequestFilter`) reads the header; `JwtService.userIdOf` calls
`Jwts.parser().verifyWith(key).build().parseSignedClaims(jwt)`, which checks the signature **and** the
expiry, and returns `null` on any failure. On success the filter stores a
`UsernamePasswordAuthenticationToken(userId, null, List.of())` in the `SecurityContextHolder`. Later,
`@AuthenticationPrincipal Long userId` in a controller reads it back.

Note that validation does **not** query the database. That is what makes it stateless, and also why a
token cannot be revoked.

### 10.5 Google sign-in

1. The browser loads Google Identity Services and shows Google's button (`GoogleSignInButton.jsx`).
2. After the user picks an account, Google gives the browser an **ID token** (a JWT signed by Google).
3. The browser posts it to `POST /api/auth/google` as `{credential}`.
4. `GoogleAuthService.verify` checks the signature against Google's public keys
   (`https://www.googleapis.com/oauth2/v3/certs`), that the **audience** is this app's client id (so a
   token issued for another website is rejected), and that the **issuer** is Google. `signIn` also
   requires `email_verified = true`.
5. The user is found by `google_sub`, or by email (and linked), or created with a derived username.
6. The backend issues **its own** JWT. From here on Google is not involved.

No client secret exists anywhere in this flow. The feature switches itself off when `GOOGLE_CLIENT_ID` is
empty: `/api/auth/config` reports `googleEnabled: false` and the button does not render.

### 10.6 Password reset

`PasswordResetService`:

- `requestCode`: generates a 6-digit code with `SecureRandom`, retires older codes, stores only the
  **BCrypt hash** with a 15-minute expiry, and emails the code. It returns silently if the email is unknown
  or if 3 codes were already requested in 15 minutes, so the response is identical in every case.
- `reset`: takes the newest live code, refuses after 5 wrong attempts, counts each wrong attempt, and on
  success stores the new password hash and marks the code used.
- `@Transactional(noRollbackFor = BadRequestException.class)`: the method increments `attempts` and then
  throws. By default a runtime exception rolls the transaction back, which would undo the increment and
  silently disable the attempt limit. `noRollbackFor` makes the increment commit.
- Without SMTP configured, `ResetCodeMailer` writes the code to the server log instead. The code is never
  returned through the API.

### 10.7 CSRF and why it is disabled

CSRF attacks work because browsers attach **cookies** automatically to requests, even ones triggered by
another website. This API uses no cookies: the token is added to a header by JavaScript, which a foreign
site cannot do. So there is nothing for CSRF protection to defend, and it is switched off. If the token
were ever moved into a cookie, CSRF protection would have to be turned back on.

### 10.8 Security features: implemented vs missing

**Implemented**

| Risk | How the project handles it |
| --- | --- |
| Stolen password database | BCrypt hashes, per-password salt |
| Accessing another user's data (IDOR) | User id only from the token; `findByIdAndUserId`; 404 instead of 403; covered by tests |
| SQL injection | Only parameterised queries; the search term is a bound parameter, and `%`/`_` are escaped in `ExpenseService.likePattern` |
| Password guessing | Per-IP limits: login 10, forgot 5, reset 10 per 15 minutes → 429 |
| Reset code guessing | 6 digits, hashed, 15-minute expiry, single use, 5 attempts per code, 3 codes per 15 minutes |
| Account enumeration | Login gives one message for every failure; forgot/reset responses do not reveal whether an email exists |
| Forged Google tokens | Signature, audience, issuer and `email_verified` are all checked |
| Weak configuration | `ProductionConfigCheck` stops the app from starting with a short or sample JWT secret in production |
| Invalid input | Bean Validation on every request body, with database CHECK constraints behind it |
| XSS | React escapes everything it renders; the code never uses `dangerouslySetInnerHTML` |
| Information leakage | Constraint names are logged, not returned; mail errors are logged, not returned; actuator shows only `health` |
| Large uploads | 5 MB multipart limit, 10,000 row limit |
| Container compromise | Runs as non-root user `appuser` (uid 10001) |
| Clickjacking, MIME sniffing | nginx sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` (Docker setup) |

**Missing or weak** (each is visible in the code)

| Gap | Why it matters | Fix |
| --- | --- | --- |
| JWT stored in `localStorage` | Any XSS bug could read the token | Short-lived access token in memory + refresh token in an `HttpOnly; Secure; SameSite` cookie |
| No token revocation; no server-side logout | A stolen token works until it expires, even after a password reset (noted in a code comment in `PasswordResetService`) | A `token_version` column on `users`, included in the JWT and checked; bump it on reset/logout |
| No refresh token | The user is signed out after 24 h | Refresh-token flow |
| `X-Forwarded-For` is trusted as-is | A client can send a fake header and get a fresh rate-limit bucket each time | Trust only the platform's proxy (`server.forward-headers-strategy`) |
| Successful login resets the IP's counter | An attacker with their own account can log in between guesses to reset the limit | Key the limit on IP **and** target account; do not reset on success for other accounts |
| Rate limiter is in memory | Lost on restart; separate per instance | Redis or a gateway rule (noted in a code comment) |
| Registration is not rate limited and says "Email already registered" | Reveals which emails have accounts; allows mass sign-ups | Rate limit; neutral response plus email |
| No email verification at registration | Anyone can register with someone else's address | Confirmation email |
| Login is faster for unknown users (no BCrypt run) | A timing difference can reveal whether an account exists | Compare against a dummy hash |
| No roles | Fine today; an admin feature would need them | Role column + `@PreAuthorize` |
| No change-password or delete-account endpoint | Missing account management | Add endpoints |
| Password rules are length-only | Weak passwords are accepted | Strength or breached-password check |
| No Content-Security-Policy; nginx headers do not apply on Vercel | Less defence in depth | Add headers in `vercel.json` |
| Token is not checked against the database | A deleted user's token still passes the filter (requests then fail or return empty data) | Covered by the token-version fix |

---

## 11. Error Handling and Validation

### 11.1 Three lines of defence

| Rule | Frontend | Backend (Bean Validation / service) | Database |
| --- | --- | --- | --- |
| Amount is positive | `Number(form.amount) > 0` in `TransactionForm` | `@NotNull @Positive @Digits(integer=10, fraction=2)` | `check (amount > 0)`, `numeric(12,2)` |
| Description present, ≤ 255 | trim check, `maxLength: 255` | `@NotBlank @Size(max = 255)` | `varchar(255) not null` |
| Date not in the future | `form.spentOn > today()` and `max` on the input | `requireNotInFuture` in `ExpenseService` | none |
| Username format | regex in `Register.jsx` | `@Pattern(regexp = Usernames.PATTERN)` | unique index on `lower(username)` |
| Age 13–120 | range check | `@Min(13) @Max(120)` | `check (age between 13 and 120)` |
| Password 8–72 | length check | `@Size(min = 8, max = 72)` | none |

Frontend validation exists for **user experience** (instant feedback, no wasted request). Backend
validation exists for **safety**, because anyone can call the API directly and skip the frontend. Database
constraints are the **last guarantee**, and they also catch race conditions the application cannot see.

### 11.2 Global exception handler

`common/ApiExceptionHandler` is annotated `@RestControllerAdvice`, so its `@ExceptionHandler` methods apply
to every controller:

| Exception | Status | Example |
| --- | --- | --- |
| `MethodArgumentNotValidException` (from `@Valid`) | 400 | `"amount must be greater than 0; description must not be blank"` |
| `BadRequestException` | 400 | "That username is taken", "spentOn cannot be in the future" |
| `PropertyReferenceException` | 400 | `?sort=notAField` → "Cannot sort by notAField" |
| `BadCredentialsException` | 401 | "Invalid username, email or password" |
| `NotFoundException` | 404 | "Expense not found" |
| `DataIntegrityViolationException` | 409 | "That conflicts with something that already exists" |
| `TooManyRequestsException` | 429 | "Too many attempts. Try again in 840 seconds." |

Services simply throw; they never build HTTP responses. Every error has the same JSON shape, so the
frontend needs only one function (`errorMessage`) to read them.

**Not handled explicitly** (they fall through to Spring Boot's defaults): unreadable JSON, a wrong type in
a query parameter such as `?from=abc`, and the 413 for oversized uploads. The response is still an error,
but not in this handler's shape. Any other unexpected exception becomes Spring Boot's default 500 response.

### 11.3 Database errors

- **Unique index violations** are checked first in the service (for a friendly 400) and, if two requests
  race past that check, caught by the handler as 409. The real constraint name goes to the log only.
- **CSV import** validates description length and amount size *before* inserting, because a database error
  inside the single import transaction would fail the whole file instead of one row.
- **If the database is down**, queries throw, the request gets a 500, and `/actuator/health` reports DOWN.

### 11.4 Import errors: partial success

Inside the row loop, parsing problems throw `IllegalArgumentException`, which is caught **per row** and
added to `errors` as `RowError(lineNumber, message)`. Problems with the file as a whole (empty, missing a
required column, more than 10,000 rows, unreadable) throw `BadRequestException`, which fails the request.

### 11.5 Frontend error handling

- Every API call is in `try/catch` or `.catch`, and uses `errorMessage(e, fallback)`.
- Page-level failures show `ErrorState` with a Retry button; action failures show a snackbar or inline alert.
- A 401 on a protected call signs the user out (response interceptor).
- `ErrorBoundary` catches rendering crashes and shows "Something went wrong" instead of a blank page.
- In `Transactions.jsx`, a `stale` flag in the effect cleanup stops a slow, older response from overwriting
  a newer one (a race condition when filters change quickly).
- Buttons are disabled while a request is running (`busy`), which prevents double submits.

### 11.6 Logging and debugging

**Implemented**: SLF4J loggers in three places: `ApiExceptionHandler` (constraint violations),
`ResetCodeMailer` (mail failures, and the reset code when SMTP is off), `ProductionConfigCheck` (config
warnings). Output goes to the console, which Docker and Render capture. The frontend logs render crashes
with `console.error`.

**Not implemented**: request logging, request/correlation ids, structured (JSON) logs, metrics, tracing,
error reporting (e.g. Sentry), log aggregation.

---

## 12. Deployment and Execution Flow

### 12.1 Requirements

Java 21, Node.js 22, Docker (for the database and for the backend tests). Maven is not needed (`./mvnw`).

### 12.2 Option A: everything in Docker

```bash
docker compose up --build
# App: http://localhost:5173    API: http://localhost:8080/api
```

Startup order is enforced with health checks: `db` (waits for `pg_isready`) → `backend` (waits for the db
to be healthy; its own check calls `/actuator/health`) → `frontend` (waits for the backend to be healthy).
Database files live in the named volume `db-data`, so data survives restarts.

### 12.3 Option B: local development

```bash
docker compose up -d db                  # PostgreSQL on localhost:5433

cd backend
./mvnw spring-boot:run                   # API on http://localhost:8080
./mvnw verify                            # tests (needs Docker running)

cd frontend
npm install
npm run dev                              # http://localhost:5173
npm test                                 # Vitest
npm run lint                             # oxlint
npm run build                            # production build into dist/
```

> **Port note.** `frontend/.env.development` points at `http://localhost:8081/api`, but the backend's
> default port is 8080. On this machine the backend is started with `SERVER_PORT=8081` (in PowerShell:
> `$env:SERVER_PORT=8081; ./mvnw spring-boot:run`). The two must match.

`sample-data/seed-demo.sh` creates a `demo` account with rules, an imported CSV, manual transactions and
budgets, using only the public API.

### 12.4 How the database connects

`application.yml`:

```yaml
spring:
  datasource:
    url: ${DB_URL:jdbc:postgresql://localhost:5433/expenses}
    username: ${DB_USER:expenses}
    password: ${DB_PASSWORD:expenses}
```

At startup Spring Boot creates a HikariCP connection pool with these values, Flyway applies pending
migrations, then Hibernate validates the entities against the tables. The syntax `${NAME:default}` means
"use the environment variable `NAME`, otherwise the default".

### 12.5 Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `SERVER_PORT` | 8080 | API port |
| `DB_URL`, `DB_USER`, `DB_PASSWORD` | local Docker database | Database connection |
| `JWT_SECRET` | a sample dev secret | Signing key; must be 32+ bytes; the sample is refused in production |
| `JWT_TTL_HOURS` | 24 | Token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed browser origins, comma separated |
| `GOOGLE_CLIENT_ID` | empty | Enables Google sign-in |
| `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_FROM` | empty | SMTP for reset emails |
| `SPRING_PROFILES_ACTIVE` | none (= `default`) | `prod` makes `ProductionConfigCheck` strict |
| `VITE_API_URL` (frontend, build time) | `/api` | Where the SPA sends API calls |
| `VITE_GOOGLE_CLIENT_ID` (frontend, build time) | empty | Shows the Google button |

Secrets are never committed: `.env` is in `.gitignore` and `.env.example` documents the names. The Google
*client id* in `.env.development` is public by design; it is not a secret.

### 12.6 Build process

**Backend image** (`backend/Dockerfile`, multi-stage):

```dockerfile
FROM maven:3.9-eclipse-temurin-21 AS build
COPY pom.xml .
RUN mvn -B -q dependency:go-offline        # cached layer: only re-runs when pom.xml changes
COPY src ./src
RUN mvn -B -q clean package -DskipTests

FROM eclipse-temurin:21-jre                # runtime image has a JRE only, no Maven, no source
COPY --from=build /build/target/*.jar app.jar
RUN useradd --system --uid 10001 appuser && chown -R appuser /app
USER appuser
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
```

**Frontend image** (`frontend/Dockerfile`): stage 1 runs `npm ci` and `npm run build` on Node 22; stage 2
copies `dist/` into `nginx:1.27-alpine` with `nginx.conf`. The Google client id is passed as a build `ARG`
because Vite inlines environment variables at build time.

**nginx.conf** does five things: SPA fallback (`try_files $uri $uri/ /index.html`, so refreshing
`/budgets` works), one-year caching of the hashed `/assets/` files, `no-cache` for `index.html` (so a new
deploy is picked up at once), gzip, and the `/api/` reverse proxy with `X-Forwarded-For`.

### 12.7 Cloud deployment

- **Frontend on Vercel.** `frontend/vercel.json` rewrites `/api/:path*` to
  `https://expense-tracker-api-le9k.onrender.com/api/:path*` and every other path to `/index.html`.
  The browser therefore sees a single origin and no CORS is involved.
- **API on Render** as a Docker web service, with `SPRING_PROFILES_ACTIVE=prod`, a generated `JWT_SECRET`
  and `healthCheckPath: /actuator/health`.
- **PostgreSQL on Render.** One manual step: Render supplies a `postgresql://…` URL but the JDBC driver
  needs `jdbc:postgresql://…`, so `DB_URL` is entered by hand (explained in a comment in `render.yaml`).
- `render.yaml` also describes a Render static site for the frontend, as an alternative to Vercel.
- The free Render instance sleeps when idle, so the first request after a pause takes around 45 seconds.

**How a deployed request flows**: browser → Vercel (`/api/expenses`) → rewrite → Render (TLS ends at
Render's proxy) → Spring Boot container → Render PostgreSQL over the private network → back the same way.

### 12.8 CI/CD

`.github/workflows/ci.yml` runs two parallel jobs on every push to `main` and every pull request:

- **backend**: JDK 21 (Temurin) with Maven cache → `./mvnw -B verify` (compiles, runs all 41 tests with
  Testcontainers on the runner's Docker, packages the JAR).
- **frontend**: Node 22 with npm cache → `npm ci` → `npm run lint` → `npm test` → `npm run build`.

**Implemented**: continuous integration. **Not in the repository**: a deployment step. Any automatic
deployment is configured in the Vercel and Render dashboards (both can deploy on push), not in code, and it
is not gated on CI passing.

---

## 13. Limitations and Improvements

### 13.1 Functional limitations

| Limitation | Evidence | Improvement |
| --- | --- | --- |
| CSV import records every row as an EXPENSE | `parseAmount` takes `abs()`; `Expense.Kind.EXPENSE` is hard-coded in `importCsv` | Use the sign, or a credit/debit column, to set `kind` |
| Categories cannot be renamed or recoloured | `Category.rename()` exists but nothing calls it; there is no PUT endpoint | Add `PUT /api/categories/{id}` |
| Rules run only during import | `Rules.categoryFor` is called only in `CsvImportService` | Offer "apply rules to existing transactions"; suggest a category in the manual form |
| Budgets are the same every month | `budgets` has no month column | A per-month budget table, rollover |
| One currency, fixed to INR | `utils/format.js` | A currency setting on the profile |
| No change of email or password while signed in; no account deletion | No such endpoints | Add them |
| No export, no recurring transactions, no attachments | Not present | Possible features |
| No bulk edit/delete of transactions | One at a time in the UI | Multi-select |

### 13.2 Performance

| Issue | Evidence | Improvement |
| --- | --- | --- |
| One `exists` query **and** one `INSERT` per CSV row | The loop in `importCsv`; up to 20,000 round trips for a full file | Load existing keys for the file's date range into a `Set`; batch inserts or `INSERT … ON CONFLICT DO NOTHING` |
| The summary endpoint runs about 8 queries | `ReportService.summary`: 2 totals, 2 counts, 1 category list (just to read the top one), 2 previous totals, 1 max | Combine into one query using `FILTER` |
| The dashboard sends 6 HTTP requests | `Promise.all` in `Dashboard.jsx` | Acceptable (they run in parallel); a single dashboard endpoint would cut round trips |
| All categories are loaded on each expense request | `categoriesById(userId)` in `ExpenseService` | Fine at this size (tens of rows); a SQL join or a small cache otherwise |
| Search cannot use an index | `lower(description) like '%q%'` (leading wildcard) | `pg_trgm` GIN index |
| Deep pages get slower | `LIMIT/OFFSET` pagination | Keyset pagination on `(spent_on, id)` |
| No frontend caching or code splitting | All pages are imported eagerly in `App.jsx`; each visit refetches | `React.lazy` per route; React Query |
| Cold start on the free tier | Render free plan | A paid instance or a keep-alive ping |

Overall the application is efficient for its purpose: queries are scoped by an indexed `user_id`,
aggregation runs in the database, and lists are paginated.

### 13.3 Scalability and reliability

- **Scales horizontally in principle**: the API holds no session state, so more instances can sit behind a
  load balancer. **Blocker**: the in-memory `RateLimiter` (move it to Redis).
- **The database is the single point of failure** and the eventual bottleneck. Next steps: connection pool
  tuning, read replicas for reports, pre-computed monthly aggregates.
- **Large imports run inside the HTTP request.** A background job with progress reporting would scale better.
- **Reliability when things fail**: database down → 500 responses and health DOWN, and the app recovers by
  itself when the database returns (the pool reconnects). SMTP down → the error is logged and the user still
  sees the neutral message. Google unreachable → Google sign-in fails with 401, password login still works.
  `restart: unless-stopped` restarts crashed containers. **Missing**: database backup strategy in the repo,
  retries, timeouts tuned explicitly, graceful degradation in the UI beyond a retry button.

### 13.4 Code quality and maintainability

**Strengths**: consistent feature packages; thin controllers; constructor injection everywhere (no field
`@Autowired`); records for DTOs; comments that explain *why*, not *what*; deliberate shortcuts marked with
`ponytail:` comments naming the limit and the upgrade path; tests named as behaviours.

**Issues found**

| Issue | Where |
| --- | --- |
| Dead code | `Category.rename()`, `ExpenseService.toDtos()`, `GET /api/expenses/{id}` (unused by the frontend) |
| Server-time-zone dates in a few places | `LocalDate.now()` in `ReportService.summary` and `.monthly`, `YearMonth.now()` in `BudgetController`/`BudgetService`, while the rest uses `Dates.latestToday()`. Around midnight, "this month" can differ between a UTC server and a user in India. The frontend mostly sends explicit dates, which hides it |
| `BudgetService.create`/`update` rebuild the whole budget list to return one DTO | Simple but wasteful |
| `RateLimiter` cleans up expired entries only after 10,000 keys | Bounded memory, but unusual |
| Email uniqueness is case-insensitive in Java but case-sensitive in the database | `existsByEmailIgnoreCase` vs the plain `unique` on `email`; two racing requests with different letter case could both succeed. A `lower(email)` unique index would close it |
| JavaScript without types | A wrong field name is only found at runtime; TypeScript would catch it |
| README is slightly out of date | It says Material UI 7; `package.json` has MUI 9 |
| `INTERVIEW_PREP.md` is out of date | It lists as open four issues the working tree has fixed: LIKE wildcards (now escaped), unhandled `DataIntegrityViolationException` (now 409), identical manual entries merged (V7), and the server-time-zone "today" (`Dates`) |

### 13.5 Testing

**Implemented**: 41 backend tests (integration against real PostgreSQL plus unit tests), 2 frontend tests,
all run in CI.

**Missing**: tests for a *successful* Google sign-in (it would need a fake token signer); frontend tests
beyond the login page; end-to-end browser tests (Playwright or Cypress); load tests; a coverage report
(JaCoCo); tests for the CORS configuration.

### 13.6 API documentation

**Implemented**: a hand-written endpoint table in `README.md`. **Missing**: OpenAPI/Swagger. Adding
`springdoc-openapi` would generate interactive documentation from the controllers and records.

### 13.7 Logging and monitoring

**Implemented**: `/actuator/health`, console logs, platform health checks. **Missing**: metrics
(Micrometer/Prometheus), request logs with correlation ids, alerts, error tracking, uptime monitoring.

### 13.8 Accessibility and usability

**Implemented**: `lang="en"` and a viewport meta tag; semantic landmarks (`component="header"`,
`<nav aria-label="Main">`, `role="search"`); `aria-label` on icon buttons; `aria-current="page"` on the
active link; `aria-hidden` on decorative icons; `aria-live="polite"` in the reset flow; real `<form>`
elements with labels and `autoComplete` hints; MUI's keyboard and focus handling; responsive from 320 px
(tables become cards, the sidebar becomes a drawer); dark mode that follows the OS setting; loading
skeletons, empty states that say what to do next, and confirmation before deleting.

**Not verified / missing**: no automated accessibility test (axe, Lighthouse); colour contrast has not
been measured; charts have no text alternative; no keyboard shortcuts; no internationalisation.

### 13.9 Version control

**Current state**: a GitHub repository (`origin`), 9 commits, all directly on `main`; no feature branches
or pull requests; `origin/master` also exists as a leftover branch. Commit messages are descriptive but
not in one consistent style, and the first commits are very large. `.gitignore` correctly excludes build
output and `.env`. **About 50 modified files are currently uncommitted**, the result of roughly two months
of work since the last commit.

**Improvements**: commit the pending work in logical pieces; use short-lived feature branches and pull
requests so CI runs before merging; adopt one message convention; delete the stale `master` branch; tag
releases.

### 13.10 Suggested priority order

1. Commit the outstanding work.
2. Security: token versioning (revocation), trusted proxy for `X-Forwarded-For`, rate limit registration.
3. Import: honour credits as income; batch the duplicate check and inserts.
4. Category editing; apply rules to existing transactions.
5. OpenAPI documentation; request logging and metrics.
6. More frontend tests and one end-to-end test of the import flow.
7. Gate deployment on CI.
