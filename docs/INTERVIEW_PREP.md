# Interview Prep: Personal Expense Tracker

Everything I need to explain, defend and demo this project. The answers are written in the first person so
they can be said out loud more or less as written.

---

## 1. The pitch

### 30 seconds
> A full-stack personal finance dashboard. You upload a bank CSV, per-user keyword rules categorize each
> transaction, and you set monthly budgets and see where the money went. The backend is a Java 21 / Spring
> Boot REST API with stateless JWT auth on PostgreSQL. The frontend is React with Material UI. The whole
> thing runs with one `docker compose up`, has CI on GitHub Actions, and its integration tests run against
> a real Postgres through Testcontainers.

### 2 minutes (add this detail)
- **The problem:** bank exports are messy. Columns are named differently, dates come in several formats,
  and amounts show up as `1,234.56`, `(12.34)` or `-12.34`. Some rows are simply broken.
- **The core feature is the CSV import.** It maps headers by name, tries several date formats, imports every
  valid row, skips duplicates, and returns a summary with the line number and reason for each bad row.
  One bad line never fails the whole upload.
- **Around it:** income and expense tracking, budgets per category, analytics (category split, income vs
  expense, daily spend), month-over-month trends, username or email login, Google sign-in, and password
  reset with an emailed code.
- **Engineering I care about:** all aggregation happens in SQL, money is `BigDecimal` / `numeric(12,2)` all
  the way through, Flyway owns the schema, every query is scoped to the logged-in user, and the app refuses
  to start in production with the dev JWT secret.

---

## 2. Tech stack and why

| Layer | Choice | Why I picked it |
| --- | --- | --- |
| Language | Java 21 | LTS release. Records for DTOs, text blocks for JPQL, pattern matching |
| Framework | Spring Boot 4 | Standard for Java REST APIs; security, validation and data access are built in |
| Auth | Spring Security + JJWT | Stateless JWT means no server session store, and the API scales horizontally |
| Persistence | Spring Data JPA / Hibernate | Simple CRUD through repositories, with `@Query` for real SQL when needed |
| Database | PostgreSQL 16 | `numeric` for money, `FILTER` clauses, functional unique indexes like `lower(name)` |
| Migrations | Flyway | Versioned, reviewable schema changes. Hibernate is set to `validate` so the entities can't drift from the schema |
| CSV | OpenCSV | Handles quoted fields and embedded commas correctly. Splitting on commas yourself gets this wrong |
| Frontend | React 19 + Vite | Fast dev server, standard SPA tooling |
| UI | Material UI 9 | Accessible components, theming for light and dark mode |
| Charts | Recharts | Declarative, React-native charts |
| HTTP | Axios | Interceptors attach the token and handle 401s in one place |
| Tests | JUnit 5, MockMvc, Testcontainers, Vitest, RTL | Real Postgres in tests, because H2 behaves differently (see §9) |
| Ops | Docker, nginx, GitHub Actions, Render / Vercel | Multi-stage images, SPA plus `/api` proxy, CI on every push |

---

## 3. Architecture

```
┌──────────────┐  HTTP/JSON   ┌───────────────────────────────┐   JDBC   ┌──────────────┐
│ React SPA    │ ───────────▶ │ Spring Boot API               │ ───────▶ │ PostgreSQL   │
│ (nginx or    │  Bearer JWT  │ JwtAuthFilter → Controller →  │          │ Flyway-owned │
│  Vercel)     │              │ Service → Repository          │          │ schema       │
└──────────────┘              └───────────────────────────────┘          └──────────────┘
```

**Package by feature, not by layer:** `auth · user · expense · category · budget · importer · report · common`.
Each feature folder holds its own controller, service, repository and entity, so a change to budgets stays
inside `budget/`.

### What happens on one request (`GET /api/expenses?kind=EXPENSE&page=0`)
1. Axios's request interceptor reads the token from `localStorage` and adds `Authorization: Bearer …`.
2. nginx (or the Vercel rewrite) forwards `/api/*` to the backend.
3. `JwtAuthFilter` (a `OncePerRequestFilter`) verifies the HMAC signature and expiry, pulls out the user id
   (the `sub` claim), and puts it in the `SecurityContext` as the principal.
4. `SecurityConfig`: everything except `/api/auth/**` and `/actuator/health` requires authentication.
   An unauthenticated request gets a plain **401** through `HttpStatusEntryPoint`, not a login redirect.
5. The controller takes the principal's user id. **The client never sends the user id.**
6. The service turns optional filters into concrete values, then calls a JPQL query that always includes
   `where e.userId = :userId`.
7. Errors come back through `ApiExceptionHandler` (`@RestControllerAdvice`) as a consistent `{message}`
   body with 400 / 401 / 404 / 429.
8. If the frontend gets a 401 on a non-auth endpoint, the interceptor clears the token and redirects to
   `/login`.

---

## 4. Data model

```
users ──< expenses >── categories ──< category_rules
  │                        │
  └──< budgets >───────────┘
  └──< password_reset_codes
```

| Table | Key points |
| --- | --- |
| `users` | `email` unique, `username` unique on `lower(username)`, nullable `password_hash` (Google-only users have none), a CHECK that `password_hash` or `google_sub` is present, `age` CHECK 13–120 |
| `categories` | `user_id NULL` means a **built-in category shared by everyone**. Unique index on `(coalesce(user_id,0), lower(name))` |
| `expenses` | One table for income and expenses (`kind` column). `amount numeric(12,2) CHECK > 0`. Indexes on `(user_id, spent_on desc)` and `(user_id, kind, spent_on desc)`. **Unique dedupe index** on `(user_id, spent_on, amount, lower(description))` |
| `category_rules` | Per-user keyword → category, unique on `(user_id, lower(keyword))` |
| `budgets` | One monthly limit per `(user_id, category_id)` |
| `password_reset_codes` | Stores a **BCrypt hash** of the code, plus `expires_at`, `attempts`, `used_at` |

**Migrations V1–V6** tell the project's history: initial schema → seed categories → income and budgets →
recolour → profiles and Google → reset codes. V5 shows a careful migration on existing data: add a nullable
`username`, backfill it from the email's local part plus the id, *then* make it `NOT NULL` and add the
unique index.

**Why income and expenses share one table:** they have the same shape. Keeping them together lets the
monthly report compute both in one pass with `sum(amount) filter (where kind = 'INCOME')`.

---

## 5. Feature deep dives

### 5.1 Authentication (JWT)
- `JwtService` signs HMAC-SHA tokens (JJWT picks HS256/384/512 from the key length) with `sub = userId`, an `email` claim and `exp` (default 24h,
  `JWT_TTL_HOURS`).
- Passwords are stored as BCrypt hashes. Registration caps passwords at **72 characters** because BCrypt
  ignores everything after 72 bytes.
- **Login accepts a username or an email:** if the identifier contains `@` it looks up by email,
  otherwise by username. Every failure returns the same message, "Invalid email or password".
- `SessionCreationPolicy.STATELESS` and CSRF is disabled. That's safe here because the token travels in a
  header rather than a cookie, so the browser never attaches it automatically.
- CORS is limited to the origins in `CORS_ORIGINS`.

### 5.2 Password reset (a good security story)
- `POST /password/forgot` generates a 6-digit code with `SecureRandom` (leading zeros kept), stores **only
  its BCrypt hash**, retires any older codes, and emails it. The code expires after 15 minutes.
- **No account enumeration:** the response is identical whether or not the email exists. Past the
  per-user request limit (3 per 15 minutes) it also stays silent.
- `POST /password/reset` makes the code single-use, locks it after **5 wrong attempts**, and **the failed
  attempt counter must survive the exception.** That's why the method has
  `@Transactional(noRollbackFor = BadRequestException.class)`. Without it, throwing would roll back the
  attempt increment and brute-force protection would silently stop working. (Good detail to bring up.)
- With no SMTP configured, the code is logged instead of emailed, and the UI says so. That's handy for
  demos.
- Brute-force math: a 1-in-1,000,000 code, 5 tries per code, 3 codes per 15 minutes, plus a per-IP limit.

### 5.3 Google sign-in
- The browser gets an **ID token** from Google Identity Services. The backend verifies it with
  `NimbusJwtDecoder` against **Google's public JWKS**, then checks that **audience = our client id**, the
  **issuer** is Google, and **`email_verified` is true**. Only after that does it issue our own JWT.
- No client secret is involved anywhere, so none can leak to the browser.
- **Account linking:** it looks up by `google_sub` first, then by email (and links the account), and
  otherwise creates a user with a username derived from the email (`Usernames.fromEmail` adds 2, 3, … until
  the name is free).
- If `GOOGLE_CLIENT_ID` is missing, the feature turns itself off cleanly: the button doesn't render and the
  endpoint returns a clear 400.

### 5.4 CSV import (the core feature)
`CsvImportService.importCsv`:
1. **Header mapping by name, in any order:** `date | transaction date | posted date`,
   `description | memo | payee | …`, `amount | debit | value …`. It strips a UTF-8 BOM (`﻿`, which
   Excel adds). It reports unknown columns back to the user instead of guessing, and a missing required
   column gives a 400 that names the column.
2. **Dates:** tries ISO, `dd/MM/yyyy`, `MM/dd/yyyy`, `dd-MM-yyyy` and `d MMM yyyy` in order. The first one
   that parses wins.
3. **Amounts:** strips spaces, commas and currency symbols, treats `(12.34)` as negative (accounting
   style), takes the absolute value, rounds to scale 2 with `HALF_UP`, and rejects zero.
4. **Per-row errors** are collected as `RowError(lineNumber, message)` and the import keeps going.
5. **Duplicates:** a row matching an existing `(date, amount, description ignoring case)` is counted and
   skipped. The unique index backs this up at the database level.
6. **Safety limits:** 10,000 rows maximum and 5 MB multipart limit (nginx allows 6 MB).
7. Everything runs in one `@Transactional`, so it commits all together.

Returns `ImportSummary{imported, duplicates, failed, errors[], ignoredColumns[]}`.

### 5.5 Auto-categorization
- Keyword rules per user. **The longest matching keyword wins**, so `"whole foods"` beats `"food"`.
- Matching is a case-insensitive substring check. Rules are loaded **once per import** into a map, not
  queried per row.
- Rows with no match fall back to the built-in "Uncategorized" category.

### 5.6 Reports and dashboard
- **All aggregation happens in SQL:** `SUM`, `COUNT`, `MAX`, `GROUP BY` and the Postgres-specific
  `FILTER (WHERE …)` and `date_trunc`. Monthly and daily use native queries mapped to projection interfaces,
  and by-category uses a JPQL constructor expression (`select new …CategoryTotal(...)`).
- **Savings rate** = (income − expense) / income. It returns `null` when there's no income, because a
  number there would be meaningless.
- **Month-over-month trend:** `previousPeriod()` compares a whole calendar month with *the whole previous
  month*, because months differ in length. Any other range compares against an equally long window
  immediately before it. This is unit-tested.
- Monthly window is capped at 60 months.

### 5.7 Budgets
- One monthly limit per category. Spend is computed with **one grouped query** for the month
  (`spendByCategoryId`) and joined to budgets in memory. That's O(1) queries, not one per budget.
- Returns spent, remaining and used %, sorted by most used. The UI colours the bar green below 70%, amber from 70% and red from 90%.

### 5.8 Frontend
- **Routing:** public `/login`, `/register`, `/forgot-password`. Everything else sits under
  `<RequireAuth>` → `MainLayout` (a sidebar on desktop that becomes a drawer on mobile).
- **State:** `AuthContext` holds the token and user (kept in `localStorage`). There's no Redux; per-page
  data is fetched with Axios.
- **Cross-cutting pieces:** `ErrorBoundary`, a `FeedbackProvider` (snackbars), shared loading, empty and
  error states, and `ConfirmDialog`.
- **Consistency:** one theme file (separate light and dark palettes, chosen from `prefers-color-scheme` and
  remembered), and **one `formatCurrency`** using `Intl.NumberFormat('en-IN')`, which produces `₹1,25,000`.
- **Responsive from 320px:** tables become cards on small screens.

---

## 6. Security checklist (things I can point to)

| Concern | What's done |
| --- | --- |
| Password storage | BCrypt, 72-char cap |
| Broken access control / IDOR | Every repository call is `findByIdAndUserId`. Tests prove user A can't read or delete user B's data |
| Brute force | Per-IP fixed-window rate limit: login 10 / 15 min, forgot 5 / 15 min, reset 10 / 15 min → 429 |
| Account enumeration | Login and password reset give identical responses |
| Reset codes | Hashed, single-use, expiring, attempt-limited |
| Third-party tokens | Google ID token signature, audience, issuer and `email_verified` all checked |
| Secrets | `ProductionConfigCheck` **refuses to boot** outside dev with the sample secret or a secret under 32 bytes |
| Input validation | Bean Validation on every request record; DB CHECK constraints as a second line of defense |
| SQL injection | Parameterized JPQL / native queries only |
| Info leakage | Actuator exposes only `health`, with `show-details: never` |
| Headers | nginx sends `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy` |
| Container | Non-root user (uid 10001), JVM sized from the container memory limit (`MaxRAMPercentage=75`) |

---

## 7. Testing strategy

**About 36 backend tests and 2 frontend tests.** The test names read as specifications:

- **Integration (MockMvc + Testcontainers Postgres):**
  `oneUserCannotSeeOrDeleteAnotherUsersExpense`, `importsValidRowsCategorisesThemAndReportsTheBrokenOnes`,
  `reportsAddUpAndStayScopedToTheUser`, `budgetsReportSpendingAgainstTheirLimitAndStayPrivate`,
  `aWrongCodeIsCountedAndEventuallyLocksTheAttempt`, `anUnknownEmailLooksExactlyLikeAKnownOne`,
  `repeatedFailedLoginsFromOneAddressAreThrottled`, `signInWorksWithEitherTheUsernameOrTheEmail`, …
- **Unit:** CSV parsing (date formats, amount forms, header mapping, longest keyword),
  `previousPeriod` edge cases, username derivation.
- **Frontend (Vitest + React Testing Library):** login stores the token; a failed login shows the server's
  message and leaves the user signed out.

**Why Testcontainers and not H2?** The app uses Postgres-specific features: `FILTER`, `date_trunc`,
`to_char`, functional unique indexes and `timestamptz`. H2 would either fail on them or pass tests that
break in production. I also hit a real Postgres-only bug (see §9), which H2 would have hidden.

**CI (`.github/workflows/ci.yml`):** backend `./mvnw verify` (Testcontainers uses the runner's Docker);
frontend `npm ci → lint (oxlint) → test → build`.

---

## 8. DevOps and deployment

- **`docker compose up --build`:** Postgres (with healthcheck) → backend (waits for DB healthy, has its own
  `/actuator/health` healthcheck) → frontend (waits for backend healthy). `restart: unless-stopped`.
- **Backend Dockerfile:** multi-stage. Copies `pom.xml` and runs `dependency:go-offline` first so the
  dependency layer stays cached, then a slim JRE runtime image running as non-root.
- **Frontend:** built with Vite and served by nginx. Hashed `/assets/` are cached for a year
  (`immutable`) and `index.html` is `no-cache`, so users never request asset files that disappeared in a
  new deploy. SPA fallback via `try_files`, and `/api/` is proxied to the backend.
- **Render blueprint (`render.yaml`):** API (Docker), static site, and managed Postgres. `JWT_SECRET` is
  generated automatically. One gotcha: Render gives a `postgresql://` URL but JDBC needs
  `jdbc:postgresql://`, so `DB_URL` has to be pasted once by hand.
- **Vercel (`frontend/vercel.json`):** SPA rewrite to `index.html`, plus `/api/*` rewritten to the Render
  API. That keeps the browser on one origin, so CORS isn't involved at all.
- **12-factor config:** every setting can be overridden with an environment variable; `application.yml`
  defaults are for local development only.

---

## 9. Design decisions and trade-offs (the "why" questions)

1. **Aggregation in SQL, not Java streams.** The database is built for this, far less data goes over the
   wire, and indexes help. Trade-off: some native Postgres SQL, which ties the app to Postgres. That's an
   acceptable, deliberate lock-in.
2. **`BigDecimal` / `numeric(12,2)` for money.** Floating point can't represent 0.1 exactly. Rounding is
   explicit (`HALF_UP`) everywhere.
3. **Flyway plus `ddl-auto: validate`.** The schema is versioned and reviewed, and if an entity doesn't
   match the schema the app fails at startup instead of drifting silently.
4. **`open-in-view: false`.** No lazy loading during JSON serialization. Database work stays inside
   service transactions, so there are no hidden N+1 queries in controllers.
5. **Stateless JWT.** No session store, any instance can serve any request. Trade-off: tokens can't be
   revoked before they expire (see §10).
6. **Built-in categories as `user_id NULL` rows.** Shared seed data without copying it per user. The
   unique index uses `coalesce(user_id, 0)` because in Postgres unique indexes treat NULLs as distinct.
7. **Postgres null-parameter bug (war story).** Passing `null` for optional filters like
   `:q is null or …` made Postgres infer the type `bytea` for the untyped parameter, and `lower()` then
   failed. The fix: the service turns every optional filter into a concrete value (`from` → 1970-01-01,
   `to` → today, `q` → `%`, `kinds` → all). It's documented on the repository method.
8. **Import partial success.** Real bank files have junk rows. All-or-nothing would make users hand-fix
   their files; partial import plus a precise error report is more useful.
9. **Longest-keyword rule matching over ML.** It's predictable, the user controls it, and it's easy to
   explain. A comment marks where a classifier could go if rules stop being enough.
10. **Package by feature.** High cohesion: everything about budgets sits in one folder.

---

## 10. Known weaknesses and what I'd improve

Interviewers ask "what would you change?" Having honest, specific answers here counts in your favor.

| Weakness | Impact | Fix |
| --- | --- | --- |
| **JWT kept in `localStorage`** | Any XSS could steal the token | Short-lived access token in memory plus a refresh token in an `HttpOnly; Secure; SameSite` cookie |
| **No token revocation**: old JWTs stay valid after a password reset (flagged in a code comment) | A stolen token still works for up to 24h | Add a `token_version` column to users, put it in the JWT, bump it on reset or logout |
| **Rate limiter is in memory and per instance** | Several instances each get their own limits, and a restart resets them | Redis (e.g. Bucket4j + Redis) or a limit at the API gateway |
| **`X-Forwarded-For` first entry is trusted** | A client can send its own XFF header and rotate fake IPs to get around the limit | Trust only known proxies (`server.forward-headers-strategy` + `RemoteIpValve` with trusted proxies), use the right-most untrusted hop |
| **Register says "Email already registered"** | Reveals which emails have accounts (login and reset don't) | Accept-and-email flow, or just rate-limit registration |
| **Duplicate manual entry hits the dedupe unique index** → `DataIntegrityViolationException` isn't handled | Returns a 500 instead of a friendly 400/409 | Handle it in `ApiExceptionHandler`, or check before saving as the import does |
| **Dedupe key `(date, amount, description)`** | Two real identical coffees on the same day count as one | Add a bank transaction ID column when one is available, or let the user confirm duplicates |
| **CSV import stores every row as EXPENSE** (takes `abs()`) | Credits and refunds in a bank file become expenses | Use the sign or a credit/debit column to set `kind` |
| **One `exists` query per imported row** | Up to 10k round trips on a large file | Load existing keys for the file's date range into a `Set` first, or use `INSERT … ON CONFLICT DO NOTHING` in batches |
| **Search is `lower(description) like '%q%'`** | Can't use a b-tree index. `%` and `_` typed by the user act as wildcards | `pg_trgm` GIN index, and escape the LIKE wildcards |
| **`LocalDate.now()` uses the server's timezone** | "This month" can be wrong around midnight for users in other timezones | Send the user's timezone, or let the client send date ranges (it mostly does) |
| **Budgets are the same limit every month** | No per-month overrides, no rollover | A `budget_periods` table |
| **Thin frontend test coverage** (2 tests) | UI regressions go unnoticed | RTL tests for Transactions filters, Import summary, Budgets; Playwright E2E for the import flow |
| **No API docs** | Harder for others to integrate | springdoc-openapi / Swagger UI |
| **No observability beyond health** | Hard to debug in production | Structured logs, Micrometer metrics, request IDs |

**If I had another week:** refresh tokens in cookies plus token versioning, Redis rate limiting, OpenAPI docs,
batched import with `ON CONFLICT`, recurring transactions, and Playwright E2E tests.

---

## 11. Likely questions and answers

**Walk me through what happens when a user logs in.**
> The frontend posts `{identifier, password}` to `/api/auth/login`. The controller checks the per-IP rate
> limit first. `AuthService` decides whether the identifier is an email (contains `@`) or a username, finds
> the user, and checks the password with `BCrypt.matches`. On success `JwtService` signs a token with the
> user id as `sub` and a 24-hour expiry, and I reset the rate-limit counter. The frontend stores the token,
> and Axios adds it to every later request. On failure the message is always "Invalid email or password",
> so it doesn't reveal which part was wrong.

**How do you stop one user from seeing another user's data?**
> The user id always comes from the verified JWT, never from the request. Every repository method is
> scoped: `findByIdAndUserId`, and every aggregate query has `where user_id = :userId`. If someone asks for
> another user's expense id they get a 404, not a 403, so they can't even tell it exists. There's an
> integration test for exactly this: `oneUserCannotSeeOrDeleteAnotherUsersExpense`.

**Why JWT and not sessions? What are the downsides?**
> Stateless: no session store, and horizontal scaling is trivial. The downside is revocation. A token is
> valid until it expires, even after a password reset. I'd fix that with a `token_version` claim checked
> against the user row, or short-lived access tokens plus refresh tokens.

**Why did you disable CSRF?**
> CSRF attacks rely on the browser automatically attaching credentials, which means cookies. My token is
> sent explicitly in the `Authorization` header, so a cross-site form post has nothing to attach. If I moved
> the token into a cookie, I'd have to turn CSRF protection back on.

**How does the CSV import handle bad data?**
> *(Use §5.4.)* Parse the whole file, import the valid rows, skip duplicates, and report every bad row with
> its line number. One bad line doesn't fail the upload.

**How do you detect duplicates? What's the edge case?**
> Same user, date, amount and description (ignoring case). It's checked before each insert and also
> enforced by a unique index. The edge case: two genuinely identical transactions on the same day get
> merged. A bank transaction ID would solve that.

**Why BigDecimal?**
> Binary floating point can't represent values like 0.1 exactly, so sums drift. `BigDecimal` with explicit
> scale and rounding, stored as `numeric(12,2)`, keeps totals exact.

**How would this scale to a million users?**
> The API is stateless, so run several instances behind a load balancer. First fix: move the rate limiter
> to Redis. The database already has `(user_id, spent_on)` indexes; add `pg_trgm` for search, read replicas
> for reports, and maybe materialized monthly aggregates. Run imports as background jobs with batched
> `ON CONFLICT` inserts instead of synchronous per-row checks.

**What was the hardest bug?**
> The Postgres `bytea` inference problem with null parameters in an optional-filter query (§9, point 7).
> It passed on the happy path and only failed with filters left empty. The fix was to never pass untyped
> nulls: the service resolves every filter to a real value.

**Why Testcontainers over H2?**
> I use Postgres-specific SQL, and H2 would either fail or give false confidence. Tests run against the same
> engine as production.

**Why wouldn't a failed reset attempt be recorded without `noRollbackFor`?**
> Spring rolls back a transaction on a runtime exception. I increment `attempts` and then throw, so without
> `noRollbackFor` the increment would be rolled back and the 5-attempt lock would never trigger.

**Why is the rate limiter keyed on IP? Can it be bypassed?**
> Yes, as the code stands. It reads the first `X-Forwarded-For` value, which the client controls. The fix
> is to trust only known proxy hops. It's also per instance, so it belongs in Redis for multi-instance
> deployments.

**What does Flyway give you over `ddl-auto: update`?**
> Versioned, reviewable, repeatable migrations, including data backfills (V5). `update` can't rename or
> backfill safely, and it hides schema changes from code review.

**How is Google sign-in secure without a client secret?**
> The ID token is signed by Google. I verify the signature against Google's published keys and check that
> the audience is my client id (so a token issued for another app is rejected), that the issuer is Google,
> and that the email is verified. Then I issue my own JWT.

**Frontend: how do you handle an expired token?**
> The Axios response interceptor catches a 401 from any non-auth endpoint, clears storage, and redirects to
> `/login`. `RequireAuth` guards routes and redirects to `/login` when there is no token.

---

## 12. Demo script (about 5 minutes)

1. **Register** a user and show the username and optional age validation.
2. **Categories** → add rules: `big bazaar` → Groceries, `uber` → Transport, `swiggy` → Food.
3. **Import CSV** → upload `sample-data/transactions.csv`. Point out *imported / duplicates / failed* and the
   line-numbered errors, and that the extra `Balance` column is listed as ignored.
4. **Upload the same file again** → everything shows as duplicates.
5. **Dashboard** → stat cards with month-over-month trend, charts, budget progress.
6. **Transactions** → filters, search, pagination, then edit a transaction (for example change its category). Shrink the window to
   mobile width to show the card layout.
7. **Budgets** → set a limit and watch the colour grading. Toggle **dark mode**.
8. **Forgot password** → show the code in the server log (no SMTP), reset the password, then show that the
   same code fails a second time.
9. *(Optional)* Open the code: `CsvImportService`, `PasswordResetService.reset`, `ExpenseRepository`.

---

## 13. Pre-interview checklist

- [ ] `frontend/.env.development`: `VITE_GOOGLE_CLIENT_ID` must be a real client id or empty. A
      placeholder value makes the Google button render and then fail.
- [ ] `frontend/index.html` `<title>` is still `frontend`. Change it to "Expense Tracker" (it shows in the
      browser tab during the demo).
- [ ] If the Render API is on the free tier it sleeps when idle. Open `/actuator/health` a minute before
      the demo so it's awake.
- [ ] Run `docker compose up --build` locally the day before as a fallback in case the hosted demo fails.
- [ ] Run `./mvnw verify` and `npm test` and make sure CI is green on `main`.
- [ ] Be able to open these files quickly: `SecurityConfig`, `JwtAuthFilter`, `CsvImportService`,
      `PasswordResetService`, `ReportService.previousPeriod`, `ExpenseRepository`, `V1__init.sql`,
      `client.js`.
- [ ] Practise the 30-second pitch and the §10 weaknesses table out loud.
