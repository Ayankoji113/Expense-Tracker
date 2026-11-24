# Interview Preparation: Personal Expense Tracker

How to use this file:

- Facts, diagrams and code references live in [`PROJECT_ANALYSIS.md`](PROJECT_ANALYSIS.md). This file does
  not repeat them; it turns them into answers you can say out loud. "PA §7" means section 7 of that file.
- Answers are written in the first person, in plain English. Read them aloud, then say them in your own
  words. Do not memorise them word for word.
- **F/U** marks a follow-up question the interviewer is likely to ask next.
- Be honest about the gaps. Section 6 and the "what would you change" answers are where you show judgment.

---

## 1. Project Explanation

### 30 seconds

> I built a full-stack personal expense tracker. Users record income and expenses, or upload a bank
> statement as a CSV file. The app categorises the transactions with keyword rules, compares spending with
> monthly budgets, and shows charts. The backend is a Spring Boot REST API in Java 21 with JWT
> authentication and PostgreSQL. The frontend is React with Material UI. It runs in Docker, has automated
> tests and CI, and is deployed on Vercel and Render.

### 1 minute

> It is a personal finance dashboard for more than one user. The main problem it solves is that bank
> statements are messy: banks name columns differently and write dates and amounts in different ways. My
> import reads the file, imports every valid row, skips rows it has already imported, and reports each bad
> row with its line number, so one broken line does not fail the whole upload. Each user can define rules
> like "uber means Transport", and the import applies them.
>
> Around that there is the usual set of features: add, edit and delete transactions with search, filters
> and pagination; monthly budgets per category; and a dashboard with income, expense, savings rate and
> trends.
>
> Technically it is a React single-page app that talks to a Spring Boot REST API over JSON. The API is
> stateless and uses JWT. Data is in PostgreSQL, the schema is managed with Flyway, and the tests run
> against a real PostgreSQL using Testcontainers.

### 2 minutes

Say the 1-minute version, then add:

> The backend is organised by feature: auth, user, expense, category, budget, importer and report. Inside
> each feature I follow the usual layers. The controller handles HTTP and validation, the service holds
> the business rules and the transaction, and the repository runs the queries through Spring Data JPA.
>
> A few decisions I am happy with. All totals and groupings are calculated in SQL, not in Java loops.
> Money is `BigDecimal` in Java and `numeric(12,2)` in the database, so there are no rounding errors.
> Every query is scoped by the user id from the token, so one user can never read another user's data, and
> I have an integration test that proves it. Hibernate is set to `validate`, so if an entity and a table
> disagree, the application refuses to start.
>
> For security I store passwords with BCrypt, rate limit login attempts, and implemented a forgotten
> password flow with a six-digit emailed code that is hashed, expires in fifteen minutes and locks after
> five wrong tries. Google sign-in is optional and the Google token is verified on the server.
>
> It is deployed with the frontend on Vercel and the API and database on Render. GitHub Actions builds
> and tests both parts on every push.
>
> If I had more time, I would add refresh tokens with revocation, move the rate limiter to Redis, and make
> the import faster by batching.

### Complete technical explanation (5 minutes, for "walk me through the whole thing")

Use this order. Each step is one or two sentences.

1. **Purpose**: private ledger per user, CSV import, rules, budgets, reports.
2. **Shape**: React SPA → REST/JSON → Spring Boot → PostgreSQL. A monolith, split by feature.
3. **Frontend**: Vite + React 19. React Router with public routes and a `RequireAuth` guard.
   `AuthContext` keeps the token and user. One Axios instance adds the token and handles 401. Pages fetch
   their own data in `useEffect` and render loading, error, empty or content.
4. **Request path**: Axios → (Vercel rewrite or nginx proxy) → Tomcat → Spring Security filters →
   `JwtAuthFilter` → controller → service → repository → Hibernate → JDBC → PostgreSQL, then back as a
   DTO serialised to JSON.
5. **Authentication**: BCrypt for passwords; a signed JWT with the user id as subject; stateless; CSRF
   off because there are no cookies; CORS limited to configured origins.
6. **Data model**: six tables, everything owned by a user, all one-to-many; built-in categories are rows
   with a null `user_id`; income and expense share one table with a `kind` column.
7. **Interesting logic**: the CSV import (header mapping, date and amount parsing, duplicates, per-row
   errors), longest-keyword rule matching, report queries with `FILTER`, previous-period comparison.
8. **Quality**: Flyway migrations, Bean Validation plus database constraints, one global exception
   handler, 41 backend tests with Testcontainers, CI.
9. **Deployment**: multi-stage Docker images, docker compose with health checks, Vercel + Render.
10. **Limits and next steps**: token in `localStorage`, no revocation, in-memory rate limiter, per-row
    import queries, imports always become expenses.

---

## 2. Complete Technical Working

Short spoken answers. The detailed version of each is in the analysis file.

**How does the application work internally?** (PA §6)
> The browser loads a React app. React shows pages and sends HTTP requests to a Spring Boot API. The API
> checks who the user is from a token, runs the business rules, reads or writes PostgreSQL through
> Hibernate, and returns JSON. React stores the result in state and re-renders the page.

**How does data travel?** (PA §4.1)
> Take adding an expense. The form builds a JavaScript object and Axios posts it as JSON with the token in
> the Authorization header. On the server a security filter verifies the token and extracts my user id.
> Spring converts the JSON to an `ExpenseRequest` record and validates it. The controller calls
> `ExpenseService.create`, which checks the date and the category, creates an `Expense` entity and saves
> it through the repository. Hibernate runs an INSERT. The service returns an `ExpenseDto`, Spring writes
> it as JSON with status 201, and the page refetches the list.

**How do requests and responses work?** (PA §4.2–4.4)
> A request has a method, a URL, headers and sometimes a body. I use GET to read, POST to create, PUT to
> update and DELETE to remove. Filters go in query parameters, ids go in the path, and data goes in a JSON
> body. The response has a status code, headers and a JSON body. I return 200, 201 and 204 for success,
> and 400, 401, 404, 409 and 429 for errors, always with a `message` field.

**How does the frontend communicate with the backend?** (PA §5)
> Through one Axios instance in `api/client.js`. A request interceptor adds the Bearer token. A response
> interceptor signs the user out on a 401. The base URL is `/api`, which Vercel or nginx forwards to the
> backend, so in production everything is same-origin.

**How is the database connected?** (PA §12.4)
> Spring Boot reads the JDBC URL, username and password from environment variables and creates a HikariCP
> connection pool. At startup Flyway runs any new migration files, and then Hibernate validates that my
> entities match the tables. Repositories borrow a connection from the pool for each transaction.

**How does authentication work?** (PA §10)
> On login I look up the user, check the password with BCrypt, and return a JWT signed with a secret key.
> The token contains the user id and an expiry. The browser sends it on every request. A filter verifies
> the signature and expiry and puts the user id into the security context. There is no session on the
> server.

**How do the components interact?**
> On the backend, Spring creates every controller, service and repository as a bean and injects them
> through constructors. On the frontend, `AuthProvider` and `FeedbackProvider` sit at the top and pages
> use them through the `useAuth` and `useFeedback` hooks. Pages compose smaller components and pass data
> down as props and callbacks.

**What is the complete flow?** (PA §3)
> Open the app, get redirected to login if there is no token, sign in, land on the dashboard, which loads
> six reports in parallel. From there the user manages transactions, categories and rules, imports a CSV,
> sets budgets and edits the profile. Signing out just deletes the token in the browser.

---

## 3. Topic-Wise Interview Questions

### 3.1 Beginner

**What is this project?** Use the 30-second pitch.

**Why did you build it?**
> *(Give your own reason; see §6.3.)* The technical reason: I wanted one project that covers a full
> production path, including authentication, a relational data model, a file import with real-world
> messiness, testing and deployment.

**What technologies did you use?**
> Java 21 and Spring Boot for the API, Spring Security with JWT, Spring Data JPA with Hibernate,
> PostgreSQL, and Flyway for migrations. On the frontend React, Vite, Material UI, React Router, Axios and
> Recharts. Docker, GitHub Actions, Vercel and Render for running and shipping it.

**What is the purpose of each layer?**
> The controller translates HTTP into a method call and back. The service contains the rules and the
> transaction. The repository contains the queries. The entity represents a table row. DTOs are the shapes
> that go over the network, so I never expose entities directly.

**How does the application work?** Use §2, first answer.

### 3.2 Intermediate

**Explain the complete request-response lifecycle.** Use §2 "How does data travel", and name the classes.
F/U: *Where is the transaction opened and committed?* At the `@Transactional` service method: opened on
entry, committed on normal return, rolled back on a runtime exception.

**How does React communicate with Spring Boot?**
> Over HTTP with JSON. React never touches the database. Axios sends requests to `/api/...`, Spring maps
> them to controller methods with annotations like `@GetMapping`, and Jackson converts between JSON and
> Java records.

F/U: *Why did you need CORS?* In development the React dev server and the API are on different ports, which
the browser treats as different origins. In production I avoid it with a proxy rewrite.

**Why REST?**
> My screens have fixed data needs, the resources map naturally to URLs, and REST needs nothing extra on
> either side. GraphQL would be useful if many clients needed different shapes of the same data.

**How does Hibernate communicate with the database?**
> My repository interfaces extend `JpaRepository`. Spring Data generates the implementation. Hibernate
> turns method calls and JPQL into SQL prepared statements and sends them over JDBC using a pooled
> connection. It maps result rows back into entities or records. For updates it uses dirty checking: I
> change a loaded entity and Hibernate writes the UPDATE at commit.

**How do you handle exceptions?**
> Services throw small exceptions like `NotFoundException` and `BadRequestException`. One class,
> `ApiExceptionHandler`, annotated with `@RestControllerAdvice`, converts each type into a status code and
> a JSON body with a message. The frontend has one helper, `errorMessage`, that reads it.

**How does authentication work?** Use §2. F/U: *Where do you store the token and is that safe?*
> In `localStorage`. It is simple and survives a refresh, but JavaScript can read it, so an XSS bug could
> steal it. A safer design is a short-lived token in memory with a refresh token in an HttpOnly cookie.

### 3.3 Advanced

**Why this architecture?**
> A separate SPA and REST API lets me host the frontend on a CDN and keeps a clean contract. Layers keep
> HTTP, rules and SQL apart. I package by feature so a change stays in one folder. It is a monolith
> because there is one developer, one database, and the features share tables; microservices would add
> cost without a benefit.

**What happens when many users use it at the same time?**
> Tomcat handles each request on its own thread. My services and controllers are singletons but hold no
> per-request state, so that is safe. User identity lives in the `SecurityContext`, which is per thread.
> Each request takes its own connection from the pool and runs in its own database transaction.
> PostgreSQL isolates transactions from each other. For conflicts, such as two requests creating the same
> username at the same moment, the unique index in the database is the final guard, and I return a 409.
> The one piece of shared mutable state is the rate limiter, and it uses `ConcurrentHashMap` and
> `AtomicInteger`.

F/U: *What is the limit?* The thread pool (200 by default) and the connection pool (10 by default). Past
that, requests queue.

F/U: *Two browser tabs edit the same expense?* The last write wins; there is no optimistic locking. I could
add a `@Version` column so the second save fails with a conflict.

**How would you improve performance?**
> First measure. From reading the code, the candidates are: the import does two queries per row, so I
> would load existing keys once and batch the inserts; the summary endpoint runs about eight queries that
> could be one using `FILTER`; text search uses a leading wildcard, so a trigram index would help; and the
> frontend could split code by route and cache responses.

**How would you scale it?**
> The API is stateless, so I can run more instances behind a load balancer once the rate limiter moves to
> Redis. Then the database: tune the pool, add read replicas for reports, and pre-compute monthly totals.
> Imports would move to a background job.

**What happens if the database becomes unavailable?**
> Requests that need it fail with a 500, and the health endpoint reports DOWN so the platform knows. The
> frontend shows an error state with a retry button. Because the connection pool reconnects by itself, the
> app recovers when the database comes back. Login also fails, because it needs the users table; but a
> token check alone does not need the database. What I do not have is a backup and restore plan in the
> repo, or a friendlier 503 response.

**How would you handle a security vulnerability?**
> Confirm and reproduce it, judge the impact, fix it with a test that fails before the fix, deploy, and if
> tokens or secrets could be exposed, rotate the JWT secret, which invalidates every token. For
> dependencies I would add Dependabot or an OWASP dependency check to CI.

**What would you change if you rebuilt it?**
> TypeScript on the frontend. Refresh tokens with revocation from the start. OpenAPI documentation
> generated from the code. A data-fetching library such as React Query. Use the amount's sign in the
> import so credits become income. And smaller commits on feature branches.

### 3.4 Scenario questions

**A user says "my import shows 0 imported".**
> I would look at the summary first. If duplicates is high, they uploaded a file they already imported.
> If failed is high, the row errors say why, usually a date format I do not support. If the request
> failed outright, the message names the missing column, which means their header is not one of the names
> I recognise.

**The dashboard is slow for one user with 200,000 transactions.**
> Check which request is slow in the browser's network tab. Then run `EXPLAIN ANALYZE` on that query. The
> report queries filter on `user_id`, `kind` and a date range, which matches my composite index, so I
> would expect index scans. If a specific query is slow I would combine the summary queries or add a
> summary table.

**After deploying, users on the old tab see a blank page.**
> That is the stale `index.html` problem: the old page asks for JavaScript files that no longer exist. My
> nginx config sends `no-cache` for `index.html` and long caching only for hashed assets to prevent this.

**The product owner wants shared household budgets.**
> Today every row belongs to exactly one user. I would add a `households` table and a membership table,
> which is a many-to-many relationship, and scope queries by household instead of user. That is a
> significant change because the ownership rule is in every query.

**Login works locally but returns 401 in production for every request.**
> Check that the Authorization header reaches the backend through the proxy, that the token was signed
> with the same `JWT_SECRET` the server is using now (a new secret invalidates old tokens), and the server
> clock, since expiry depends on it.

### 3.5 Debugging questions

**The browser console shows a CORS error.**
> The API is being called from an origin not in `CORS_ORIGINS`, or the preflight failed. I check the
> `Origin` header of the request against the configured list, and make sure it has no trailing slash and
> the right scheme and port.

**The app fails at startup with "Schema-validation: missing column".**
> An entity has a field with no matching column. Hibernate is in `validate` mode, so I need a new Flyway
> migration; I must not edit an old one, because Flyway checks checksums of applied migrations.

**You get `LazyInitializationException`.**
> It cannot happen in this project, because I do not use entity associations and I have
> `open-in-view: false`. In general it means a lazy relation was accessed after the session closed, and
> the fix is to fetch what you need inside the transaction or use a DTO query.

**A POST returns 400 with no obvious reason.**
> Read the `message` in the response: my handler lists each field and its problem. If the body is Spring's
> default instead, the JSON itself could not be parsed, for example a date not in `yyyy-MM-dd` form.

**Search with an empty filter throws a PostgreSQL error about `bytea`.**
> I hit a version of this. When a null is passed for an optional parameter, PostgreSQL cannot tell its
> type and assumes `bytea`, and then `lower()` fails. I fixed it by never passing nulls for those: the
> service turns "no filter" into a real value, such as the pattern `%`.

---

## 4. Technology-Specific Questions

### 4.1 Java

| Question | Answer tied to this project |
| --- | --- |
| What is a `record`? | An immutable data class; the compiler generates the constructor, accessors, `equals`, `hashCode`, `toString`. All my DTOs are records, e.g. `ExpenseDto`, `AuthResponse` |
| Why `BigDecimal` and not `double`? | `double` is binary floating point; `0.1 + 0.2` is not exactly `0.3`. `BigDecimal` is exact decimal arithmetic. I set scale and rounding explicitly: `setScale(2, RoundingMode.HALF_UP)` |
| Why `compareTo` and not `equals` for `BigDecimal`? | `equals` also compares scale, so `2.0` is not equal to `2.00`. I use `compareTo` and `signum()` |
| What is `Optional`? | A container that may be empty, used instead of returning null. `findByIdAndUserId(...).orElseThrow(() -> new NotFoundException(...))` |
| Streams? | A pipeline over a collection. `categories.findVisibleTo(userId).stream().collect(Collectors.toMap(Category::getId, Function.identity()))` builds a lookup map |
| `LocalDate` vs `Instant`? | `LocalDate` is a calendar date without time zone (`spent_on`). `Instant` is an exact moment in UTC (`created_at`, token expiry) |
| Checked vs unchecked exceptions? | My exceptions extend `RuntimeException` (unchecked), so they pass through layers without `throws`, and Spring rolls back transactions on them |
| Enums? | `Expense.Kind { EXPENSE, INCOME }`, stored as strings with `@Enumerated(EnumType.STRING)` |
| Thread safety example? | `RateLimiter` uses `ConcurrentHashMap.compute` and `AtomicInteger`, because many request threads call it at once |
| Why `SecureRandom`? | Reset codes must be unpredictable. `Random` is predictable from its seed |
| `final` fields + constructor? | Dependencies are `private final` and set in the constructor, so a bean can never be half-built |
| Text blocks? | `"""` multi-line strings, used for readable JPQL and SQL |

### 4.2 Spring Boot and dependency injection

**What is dependency injection, and where do you use it?**
> A class does not create the objects it needs; it receives them. Spring creates one instance of each
> bean and passes it in. `ExpenseService` declares `ExpenseRepository` and `CategoryRepository` in its
> constructor and Spring supplies them.

**Why constructor injection over `@Autowired` fields?**
> Fields can be `final`, the dependencies are visible in the constructor, and I can create the class in a
> unit test with plain `new`. With a single constructor, Spring needs no `@Autowired` annotation.

**What does `@SpringBootApplication` do?**
> It combines `@Configuration`, `@EnableAutoConfiguration` and `@ComponentScan`. It scans my package for
> beans and configures Tomcat, the DataSource, JPA, Security and Flyway from what is on the classpath.

**`@Component` vs `@Service` vs `@Repository` vs `@RestController`?**
> All register a bean. The names state the role. `@RestController` also means return values are written
> to the response body as JSON. `@Repository` adds exception translation; my repositories are interfaces
> so Spring Data handles that.

**What scope are your beans?** Singleton, one per application. So they must not keep per-request state.

**How is configuration loaded?**
> `application.yml` with `${ENV_VAR:default}` placeholders. `AppProperties` is a record annotated with
> `@ConfigurationProperties(prefix = "app")`, which gives typed access like `props.jwt().secret()`.

**What is `@PostConstruct`?**
> A method Spring calls after creating the bean. `ProductionConfigCheck.verify` uses it to stop startup
> when the JWT secret is unsafe.

**What is `ObjectProvider`?**
> A way to ask for a bean that may not exist. `ResetCodeMailer` takes `ObjectProvider<JavaMailSender>`
> because mail is optional.

**What is Actuator?** Production endpoints. I expose only `/actuator/health`.

**What is a profile?** A named set of configuration. Render sets `SPRING_PROFILES_ACTIVE=prod`, which makes
my startup check strict.

### 4.3 Spring MVC and REST

| Question | Answer |
| --- | --- |
| `@RequestBody` vs `@RequestParam` vs `@PathVariable`? | JSON body → object; `?name=value`; a segment of the URL. All three appear in `ExpenseController` |
| What does `@Valid` do? | Runs Bean Validation on the argument. Failure throws `MethodArgumentNotValidException` before my method runs |
| How do you return 201? | `@ResponseStatus(HttpStatus.CREATED)` on the method |
| How does pagination work? | A `Pageable` parameter is filled from `?page=&size=&sort=`; `@PageableDefault(size = 25, sort = "spentOn", direction = DESC)` sets defaults; the repository returns a `Page` |
| PUT vs PATCH? | PUT replaces the whole resource; PATCH changes some fields. My forms always send every field, so I use PUT |
| Idempotent? | Repeating the call gives the same result. GET, PUT and DELETE are; POST is not |
| What makes it RESTful? | Resource URLs, standard methods and status codes, JSON, stateless |
| 401 vs 403? | 401: not authenticated. 403: authenticated but not allowed. I return 404 for other users' records so their existence is hidden |
| File upload? | `multipart/form-data`; `@RequestParam("file") MultipartFile file`; size limit in `application.yml` |
| What is `DispatcherServlet`? | Spring MVC's front controller: it receives every request and routes it to the right method |

### 4.4 Hibernate and JPA

**JPA vs Hibernate vs Spring Data JPA?**
> JPA is the specification. Hibernate is the implementation. Spring Data JPA sits on top and generates
> repositories.

**How does a derived query work?**
> Spring parses the method name. `findByIdAndUserId` becomes `where id = ? and user_id = ?`.

**JPQL vs native SQL? When did you use each?**
> JPQL is written against entities and is database independent; I use it for most queries. I use native
> SQL for the monthly and daily reports because they need PostgreSQL's `date_trunc`, `to_char` and
> `FILTER`.

**What is a projection?**
> Returning something smaller than a whole entity. I use records with `select new ...` in JPQL, and
> interfaces (`MonthlyTotal`) for native queries.

**What is the N+1 problem and how did you avoid it?**
> Loading a list with one query, and then one more query per row for a related object. I avoid it by
> storing foreign keys as plain ids and loading related data in one query, for example all visible
> categories into a map, or one grouped query for all budgets' spending.

**Why no `@ManyToOne`?**
> To keep every query explicit and avoid lazy loading. The cost is that I map names myself and rely on
> database `ON DELETE` rules rather than JPA cascades.

**What does `@Transactional` do?**
> Spring wraps the bean in a proxy that begins a transaction before the method and commits after it, or
> rolls back on a runtime exception. `readOnly = true` lets Hibernate skip dirty checking.

F/U: *Any pitfall?* Calling a `@Transactional` method from another method in the same class bypasses the
proxy. In `BudgetService.create` I call `list(...)` internally; that is fine because it simply joins the
transaction that is already open.

**What is dirty checking?**
> Hibernate keeps a snapshot of each loaded entity and at commit writes an UPDATE for any that changed.

**`GenerationType.IDENTITY`?**
> The database generates the id (`bigserial`). Hibernate must run the INSERT immediately to learn the id,
> which means it cannot batch inserts. That is one reason my import is row by row.

**What does `ddl-auto: validate` mean? Other values?**
> Hibernate checks entities against the schema and fails on a mismatch. `update` alters tables
> automatically, `create` and `create-drop` rebuild them, `none` does nothing. I use `validate` because
> Flyway owns the schema.

**`open-in-view: false`?**
> The session closes at the end of the service method. It stops accidental queries during JSON
> serialisation.

**`@Modifying`?** Marks a `@Query` as an UPDATE or DELETE. Used in `retireAllFor`.

### 4.5 SQL and database design

| Question | Answer |
| --- | --- |
| Primary key vs foreign key? | A primary key identifies a row (`expenses.id`). A foreign key points at another table's key (`expenses.user_id → users.id`) and the database guarantees the target exists |
| What relationships do you have? | All one-to-many. No many-to-many, because a transaction has at most one category |
| `ON DELETE CASCADE` vs `SET NULL`? | Deleting a user deletes their data (cascade). Deleting a category keeps the transactions and clears their category (set null) |
| What is an index? | A sorted structure that lets the database find rows without scanning the table. It speeds up reads and slows down writes slightly |
| Why a composite index on `(user_id, spent_on desc)`? | My main query filters by user and date range and sorts by date. Column order matters: the equality column first |
| What is a partial index? | An index over only some rows. My dedupe index applies only `where source = 'CSV'` |
| What is an expression index? | An index on a computed value, e.g. `lower(username)` for case-insensitive uniqueness |
| What does `FILTER (WHERE …)` do? | Conditional aggregation: income and expense totals in one pass over the table |
| `WHERE` vs `HAVING`? | `WHERE` filters rows before grouping; `HAVING` filters groups after. I only need `WHERE` |
| Why `LEFT JOIN` in the category report? | So transactions with no category still appear, labelled "Uncategorized" through `coalesce` |
| What is a transaction? ACID? | A group of statements that succeed or fail together. Atomic, Consistent, Isolated, Durable. The CSV import is one transaction |
| How do you prevent SQL injection? | Only bound parameters, never string concatenation. I also escape `%` and `_` in the search term so they are treated as text |
| Is the schema normalised? | Yes, to third normal form: category names live only in `categories`, and expenses reference them by id |
| Why `numeric(12,2)`? | Exact decimal; up to 9,999,999,999.99 |
| Why does a unique index treat NULLs as different? | In SQL, NULL is "unknown", so two NULLs are not equal. That is why I use `coalesce(user_id, 0)` in the category index |
| How do you change the schema? | A new Flyway file, `V9__...sql`. Never edit an applied one |

### 4.6 React

**What is a component? Props vs state?**
> A function that returns UI. Props are inputs from the parent and are read-only. State is data the
> component owns; changing it causes a re-render. `TransactionForm` receives `transaction` and
> `categories` as props and keeps `form`, `error` and `busy` as state.

**`useState`?**
> Declares state. `const [busy, setBusy] = useState(false)`. I use the function form when the new value
> depends on the old one: `setRevision((current) => current + 1)`.

**`useEffect`?**
> Runs side effects after render, such as fetching. The dependency array says when to run again. The
> returned function is cleanup. In `Transactions.jsx` the cleanup sets `stale = true` so an old response
> cannot overwrite a newer one.

**`useCallback` and `useMemo`?**
> They keep the same function or value between renders unless dependencies change. In `AuthContext` the
> context value is memoised so consumers do not re-render needlessly; in `Login.jsx` the Google callback
> is wrapped in `useCallback` because it is a dependency of an effect in the button component.

**`useRef`?** A mutable box that survives renders without causing one. It holds the DOM node where Google
renders its button.

**What is Context? Why not Redux?**
> Context passes a value to any component below a provider without threading props. I use it for the
> session and for notifications. Only those are global, so Redux would be extra code.

**What is a custom hook?** A function starting with `use` that uses other hooks. `useAuth()` and
`useFeedback()`.

**Controlled components?** Form inputs whose value comes from state and whose `onChange` updates state.
All my forms work this way.

**How does routing and route protection work?**
> React Router maps URLs to components in `App.jsx`. Protected pages are nested under `RequireAuth`,
> which redirects to `/login` when there is no token and remembers where the user was going.

F/U: *Is that real security?* No. It is only user experience. The real protection is the API rejecting
requests without a valid token.

**Why `key` in lists?** So React can match items between renders. I use database ids.

**What is debouncing?** Waiting for a pause before acting. The search box waits 300 ms using `setTimeout`
and clears the timer in the effect cleanup.

**What is an error boundary and why is it a class?** A component that catches render errors below it.
React only supports this through class lifecycle methods (`getDerivedStateFromError`, `componentDidCatch`).

**What does `StrictMode` do?** In development it runs effects twice to expose missing cleanup.

**Virtual DOM?** React builds a lightweight description of the UI, compares it with the previous one, and
changes only what differs in the real page.

### 4.7 JavaScript and asynchronous programming

| Question | Answer |
| --- | --- |
| What is a Promise? | An object representing a result that arrives later: pending, fulfilled or rejected. `client.get(...)` returns one |
| `async/await`? | Syntax over promises. `await` pauses the function, not the browser. Errors are caught with `try/catch` |
| `Promise.all`? | Runs promises in parallel and resolves when all succeed; rejects on the first failure. The dashboard uses it for six requests |
| F/U: one of the six fails? | The whole dashboard shows an error. `Promise.allSettled` would allow partial display |
| The event loop? | JavaScript is single-threaded; network calls are handed to the browser, and their callbacks are queued to run when the call stack is empty |
| Optional chaining, nullish coalescing? | `error?.response?.data?.message`, `data.age ?? ''` |
| Spread operator? | `setForm({ ...form, amount: e.target.value })` copies and overrides one field; state must not be mutated |
| `localStorage`? | Key-value storage per origin that persists across restarts. Strings only, readable by any script on the page |
| `FormData`? | Builds a multipart body for file upload |
| Modules? | `import`/`export`; Vite bundles them |
| `==` vs `===`? | `===` compares without type conversion; I use it throughout |

### 4.8 HTTP, networking and security

| Question | Answer |
| --- | --- |
| HTTP is stateless. How do you keep a user signed in? | The client sends the JWT on every request |
| What is in a JWT? | Header, payload and signature. Payload has `sub`, `email`, `iat`, `exp`. It is signed, not encrypted |
| Can a user edit their token to become someone else? | No. Changing the payload breaks the signature, which needs the server's secret |
| Session vs JWT? | Session: server stores state, client holds an id in a cookie; easy to revoke. JWT: nothing stored; scales simply; hard to revoke |
| Hashing vs encryption? | Hashing is one-way; encryption can be reversed with a key. Passwords are hashed |
| Why BCrypt and not SHA-256? | SHA-256 is fast, which helps attackers. BCrypt is slow by design and salts automatically |
| What is a salt? | Random data mixed into each hash so equal passwords give different hashes |
| CORS? | A browser rule: a page may call another origin only if that server allows it. Preflight is an OPTIONS request |
| CSRF? | Another site makes the browser send a request with the user's cookies. I have no cookies, so I disabled the protection |
| XSS? | Injected script running in the page. React escapes output. It matters to me because the token is in `localStorage` |
| HTTPS? | HTTP over TLS: encrypted and authenticated. Vercel and Render terminate TLS |
| What is a reverse proxy? | A server in front of the app that forwards requests. nginx and the Vercel rewrite play this role |
| What is `X-Forwarded-For`? | A header a proxy adds with the client's original IP. I use it for rate limiting, and I know it can be spoofed if the app is reachable directly |
| What is rate limiting? | Capping requests per key per time window. Mine is a fixed window per IP |

### 4.9 Docker, CI and deployment

| Question | Answer |
| --- | --- |
| Image vs container? | An image is a read-only template; a container is a running instance |
| Why multi-stage builds? | The build stage has Maven and the source; the final image has only a JRE and the JAR. Smaller and safer |
| Why copy `pom.xml` before `src`? | Docker caches layers. Dependencies re-download only when `pom.xml` changes |
| Why a non-root user? | If the app is compromised, the attacker has limited rights in the container |
| `-XX:MaxRAMPercentage=75`? | The JVM sizes its heap from the container's memory limit |
| What does docker compose give you? | One command for the database, API and frontend, with a shared network and start order through health checks |
| `depends_on` with `service_healthy`? | Waits until the dependency passes its health check, not merely until it starts |
| What is a volume? | Storage outside the container's lifecycle. `db-data` keeps the database across restarts |
| Docker vs VM? | Containers share the host kernel: lighter and faster. VMs run a full guest OS: stronger isolation |
| What does your CI do? | On each push and pull request: backend `./mvnw verify` with Testcontainers; frontend install, lint, test, build |
| CI vs CD? | CI builds and tests each change. CD deploys it automatically. I have CI in the repo; deployment is set up on the platforms |
| Why are Vite variables set at build time? | Vite replaces `import.meta.env.VITE_*` with literal values in the bundle. Changing one needs a rebuild |
| Why Testcontainers? | My SQL is PostgreSQL-specific. H2 would give false results |

---

## 5. Code-Level Interview Questions

### 5.1 `SecurityConfig.filterChain`

- *Why `csrf.disable()`?* No cookies; the token is in a header.
- *Why `SessionCreationPolicy.STATELESS`?* So Spring never creates an HTTP session or stores the security
  context between requests.
- *What if you remove `.addFilterBefore(jwtAuthFilter, …)`?* No request would ever be authenticated; every
  protected endpoint would return 401.
- *Why `HttpStatusEntryPoint(UNAUTHORIZED)`?* The default would be a 403 or a redirect to a login page. An
  API should answer a plain 401, which my Axios interceptor relies on.
- *Why permit OPTIONS?* Preflight requests carry no token.
- *What if you remove `@EnableConfigurationProperties(AppProperties.class)`?* `AppProperties` would not be
  a bean and the application would fail to start.

### 5.2 `JwtAuthFilter`

- *Why extend `OncePerRequestFilter`?* It guarantees one execution per request, even with internal forwards.
- *Why does it not return 401 itself when the token is bad?* It only authenticates when it can. The
  authorization rules decide afterwards. That keeps public endpoints working even if a stale token is sent.
- *Why is the principal a `Long`?* I only need the user id. It avoids a database lookup on every request.
- *Edge case?* A token for a user who no longer exists still authenticates. I do not check the database.
- *Different implementation?* Spring's OAuth2 resource server could do this with configuration only.

### 5.3 `JwtService`

- *Why must the secret be 32+ bytes?* HMAC-SHA256 needs a 256-bit key; JJWT throws otherwise, and
  `ProductionConfigCheck` gives a clear message first.
- *Why does `userIdOf` catch `Exception` and return null?* Bad signature, expired, malformed, or a
  non-numeric subject are all the same outcome: not authenticated.
- *What happens if the secret changes?* Every existing token becomes invalid. It is an emergency
  "sign everyone out" switch.
- *HS256 vs RS256?* HS256 uses one shared secret, fine for a single service. RS256 uses a private/public
  pair, better when other services need to verify tokens.

### 5.4 `AuthService.login`

```java
User user = (trimmed.contains("@") ? users.findByEmailIgnoreCase(trimmed)
        : users.findByUsernameIgnoreCase(trimmed))
        .filter(candidate -> candidate.getPasswordHash() != null)
        .filter(candidate -> encoder.matches(rawPassword, candidate.getPasswordHash()))
        .orElseThrow(() -> new BadCredentialsException("Invalid username, email or password"));
```

- *Why can `@` decide email vs username?* The username pattern does not allow `@`.
- *Why the first filter?* Google-only accounts have no password hash.
- *Why one error message?* So an attacker cannot learn whether the account exists.
- *Weakness?* For an unknown user, BCrypt never runs, so the response is faster. That timing difference
  could reveal which accounts exist. Fix: compare against a dummy hash.
- *Why `readOnly = true`?* Login changes nothing.

### 5.5 `ExpenseRepository.search` and `ExpenseService.likePattern`

- *Why resolve nulls in the service?* The PostgreSQL `bytea` problem (§3.5).
- *Why is `:categoryId is null or …` still allowed?* It is compared with a numeric column in the same
  expression, so the type can be inferred. *(Say this as your understanding; the fix was targeted at the
  parameters that failed.)*
- *Why `escape '!'`?* So a user searching for `50%` finds that text instead of matching everything.
- *Why `kind in :kinds`?* "No filter" becomes "all kinds", again avoiding a null.
- *Optimise?* A trigram index for the `like '%…%'`.

### 5.6 `PasswordResetService.reset`

- *What if `noRollbackFor` is removed?* The failed-attempt increment is rolled back with the exception, so
  the five-attempt lock never triggers. It is a silent security bug, which is why there is a test for it.
- *Why hash a six-digit code?* If the table leaked, live codes could be used directly.
- *Why does an unknown email say "code is not valid"?* To avoid revealing whether the account exists.
- *Edge case?* After a reset, old JWTs still work until they expire.

### 5.7 `CsvImportService.importCsv`

- *Why catch `IllegalArgumentException` inside the loop?* To record the row error and keep going.
- *Why check description length in Java when the column already limits it?* A database error would fail
  the whole transaction, not just the row.
- *Why one transaction for the whole file?* The file is applied as a unit. The trade-off is a long
  transaction for large files.
- *Why load the rules once?* To avoid a query per row.
- *Why strip `﻿`?* Excel adds a byte-order mark at the start of UTF-8 files, which would make the
  first header not match.
- *Edge cases?* `03/04/2026` is read as day/month first, so US-style files with ambiguous dates are
  misread. Credits become expenses. Decimal commas (`1.234,56`) are not supported. Only UTF-8.
- *Optimise?* Pre-load existing keys; batch inserts.

### 5.8 `ReportService`

- *Why does `savingsRate` return null?* Without income, a percentage is meaningless. The UI shows `--`.
- *Why does `previousPeriod` treat whole months specially?* Months have different lengths, so "the same
  number of days before" would not be the previous month.
- *Why `Dates.latestToday()`?* The server runs in UTC. A user in India is a day ahead for part of the
  night, and their transaction dated "today" must not be rejected or hidden.
- *Edge case?* `summary` still uses `LocalDate.now()` for the daily average.

### 5.9 `RateLimiter`

- *Why `compute`?* It is atomic per key, so two threads cannot both create a new window.
- *Fixed window vs sliding window vs token bucket?* Fixed window is simplest but allows a burst at the
  boundary (up to twice the limit). A token bucket is smoother.
- *Weaknesses?* In memory; per instance; the IP comes from a header the client can set; a successful
  login clears the counter for that IP.

### 5.10 `ApiExceptionHandler`

- *What does `@RestControllerAdvice` do?* Applies these handlers to all controllers and writes the return
  value as JSON.
- *What if it is removed?* Spring Boot's default error responses: my custom exceptions would become 500s.
- *Why log the constraint name but not return it?* It reveals schema details.

### 5.11 `User` and `Expense` entities

- *Why a protected no-arg constructor?* JPA needs one to create instances by reflection.
- *Why static factories `User.local` / `User.google`?* They make the two valid kinds of account explicit.
- *Why `@Generated(event = EventType.INSERT)` on `createdAt`?* The database sets it; Hibernate reads it
  back so the response is not null.
- *What if `@Enumerated(EnumType.STRING)` is removed?* Hibernate would use the ordinal and expect a number;
  with `validate` the app would fail to start because the column is `varchar`.

### 5.12 `api/client.js` and `AuthContext.jsx`

- *Why read the token inside the interceptor, not once?* So a login or logout is picked up immediately.
- *Why exclude `/auth/` from the 401 redirect?* A wrong password returns 401 too, and the login page must
  show the message instead of reloading.
- *Why `window.location.assign` and not `navigate`?* This file is outside React, and a full reload also
  clears all in-memory state.
- *Why `useState(() => localStorage.getItem(TOKEN_KEY))`?* The function form runs only on the first
  render.
- *Edge case?* The frontend never checks the token's expiry itself. It finds out on the next 401.

### 5.13 `Transactions.jsx`

- *Why a `revision` counter?* A simple way to re-run the fetch effect after a save or delete.
- *Why the `stale` flag?* Responses can arrive out of order when filters change quickly.
- *Why reset to page 0 when filters change?* The old page number may not exist in the new result.
- *What happens when you delete the last row on the last page?* The page would be empty, so the code steps
  back one page.
- *Different implementation?* React Query would handle caching, refetching and cancellation.

---

## 6. Challenges and Problem-Solving

### 6.1 Challenges that are visible in the code and commit history

These are real: each one is backed by a comment, a migration, a test or a commit. Check that the story
matches your memory before telling it.

| Challenge | Evidence | How to tell it |
| --- | --- | --- |
| **PostgreSQL inferred `bytea` for null parameters** | Comment on `ExpenseRepository.search` | "Optional filters passed as null made PostgreSQL guess the wrong type and `lower()` failed. I now resolve every optional filter to a real value in the service." |
| **CI failed on Linux because `mvnw` was not executable** | Commit `d1d3332` | "It worked on Windows, where the execute bit does not exist. I set it in git." |
| **The frontend called the wrong API host in production** | Commit `db182c3` | "The Vercel rewrite pointed at a hostname that was not my service. I corrected it to the real Render URL." |
| **Render gives a `postgresql://` URL but JDBC needs `jdbc:postgresql://`** | Comment in `render.yaml` | "The app could not connect until I entered the JDBC form by hand." |
| **The duplicate guard blocked real transactions** | `V7__dedupe_only_imported_rows.sql`, test `theSameCoffeeTwiceInOneDay…` | "The unique index meant two identical coffees on one day could not both be saved. I made it a partial index that applies only to imported rows." |
| **Time zones: "today" in India was "tomorrow" for a UTC server** | `Dates.latestToday()`, `today()` in `format.js`, test `acceptsTodayInTimezonesAhead…` | "Early-morning entries were rejected as future dates. The server now accepts up to UTC tomorrow, and the frontend uses the local date instead of `toISOString()`." |
| **Failed reset attempts were not being counted** | `noRollbackFor` and its comment | "Throwing rolled back the counter. `noRollbackFor` fixed it." |
| **Search treated `%` and `_` as wildcards** | `likePattern`, test `searchTreatsPercent…` | "I escape them and declare an escape character in the query." |
| **A database error on one CSV row failed the whole file** | Comment in `importCsv`, test `anOverlongDescription…` | "I validate length and size before inserting." |
| **Two racing requests could pass the uniqueness check** | `DataIntegrityViolationException` handler | "The unique index catches it and I return 409 instead of 500." |
| **An unconfigured mail server marked the app unhealthy** | `management.health.mail.enabled: false` | "Mail is optional, so I excluded it from the health check." |
| **Browsers requested deleted asset files after a deploy** | Comment in `nginx.conf` | "`index.html` is never cached; hashed assets are cached for a year." |
| **Google's button overflowed a 320 px phone** | Comment in `GoogleSignInButton.jsx` | "Google needs a pixel width, so I compute it from the container." |
| **Port 8080 was already in use locally** | `.env.development` uses 8081 | "I run the API on 8081 and point the dev frontend at it." |

### 6.2 Likely questions

- *What was the hardest bug?* The `bytea` one: it only failed when a filter was left empty.
- *Tell me about a production issue.* The wrong API host, or the JDBC URL.
- *A bug caused by your own design?* The dedupe index blocking legitimate duplicates.
- *A security issue you found yourself?* The attempt counter being rolled back.
- *How do you debug a failing request?* Browser network tab (status, payload, response message) → server
  log → reproduce with curl or a test → fix with a test.
- *Did you face performance problems?* Say honestly that none have been measured at current data sizes,
  then name the hot spots you can see in the code (import loop, summary queries).

### 6.3 Questions only you can answer

I could not find these in the code. Please tell me, and I will write them into this section:

1. Why did you choose to build an expense tracker? Was there a personal need?
2. How long did it take, and did you work alone?
3. Which part was hardest **for you** to understand or implement?
4. Did you use AI tools or tutorials, and how would you describe that honestly in an interview?
5. Which of the bugs in §6.1 do you personally remember debugging, and how did you find the cause?
6. Have real people used the deployed app? Any feedback?
7. What did you learn that you did not know before?
8. Which role are you interviewing for (backend, frontend, full-stack; fresher or experienced)? That
   changes which sections to emphasise.

---

## 7. Comparison and "Why Not" Questions

**Why Spring Boot instead of Node.js?**
> For money and authentication I wanted static typing, `BigDecimal`, and a mature security framework.
> Node would give me one language across the stack and a lighter runtime, which is a real advantage for a
> small app, and it would have been a valid choice. The costs of my choice are slower startup and more
> memory.

**Why Java instead of Python?**
> Compile-time checks and performance. Python with FastAPI would be quicker to write.

**Why PostgreSQL instead of MongoDB?**
> My data is relational and my reports need joins, grouping and exact sums. I also rely on foreign keys
> and unique constraints. MongoDB fits flexible, document-shaped data; here I would have had to rebuild
> integrity in application code.

**Why PostgreSQL instead of MySQL?**
> Either would work. I use `FILTER`, partial indexes and expression indexes, which PostgreSQL supports
> well. The cost is that my native queries are tied to PostgreSQL.

**Why React instead of Angular?**
> Smaller surface, hooks, and the libraries I wanted. Angular brings more structure, which helps big
> teams, but it is heavier for one developer.

**Why JPA instead of JDBC?**
> Most of my operations are simple CRUD, where JPA removes boilerplate, and it gives me pagination and
> dirty checking. Where I need control, I write the query myself. Plain JDBC would mean hand-mapping every
> result.

**Why REST instead of GraphQL?**
> Few screens, fixed data needs, simple caching and tooling. One place GraphQL would help is the
> dashboard, which makes six calls.

**Why a monolith instead of microservices?**
> One developer, one database, shared tables. Microservices solve team and scaling problems I do not
> have, and they add network failures and distributed transactions. If one part needed to scale alone,
> the import would be the first candidate to split out, as a background worker.

**Why JWT instead of sessions?**
> Stateless and easy to scale. Honest downside: I cannot revoke a token. For a single-instance app,
> sessions would actually have been simpler and safer; I chose JWT knowing that trade-off.

**Why `localStorage` instead of a cookie?**
> Simplicity, and no CSRF concerns. The downside is XSS exposure. An HttpOnly cookie with CSRF protection
> is the stronger design.

**Why Flyway instead of `ddl-auto: update`?**
> Migrations are reviewable and repeatable and can transform data, like the username backfill in V5.

**Why Maven instead of Gradle?** Simpler, declarative, and the default; I had no custom build logic.

**Why Axios instead of fetch?** Interceptors and automatic error rejection.

**Why Context instead of Redux?** Only the session is global.

**Why Material UI instead of Tailwind?** Ready-made accessible components and theming.

**Why Testcontainers instead of H2?** PostgreSQL-specific SQL.

**Why one table for income and expenses?**
> Same columns, and a single scan gives both totals. Two tables would need a UNION for every list and
> report.

**Why is `user_id` null for built-in categories instead of copying them per user?**
> No duplication, and a new built-in category reaches everyone with one row. The cost is that every
> category query needs `user_id is null or user_id = ?`, and the unique index needs `coalesce`.

**Why keyword rules instead of machine learning?**
> Predictable, explainable, no training data, and the user is in control.

**Why store foreign keys as ids instead of entity relationships?** See §4.4.

**Why offset pagination instead of keyset?** Simple and supports jumping to a page. Keyset is faster on
deep pages; my data sizes do not need it.

**Why Vercel and Render instead of AWS?** Free tiers and almost no operations work. AWS gives more control
at the cost of setup.

---

## 8. Mock Interview

### 8.1 Beginner (30)

1. **Introduce your project.** → 30-second pitch.
2. **What problem does it solve?** → Messy bank exports and no clear view of spending.
3. **Who uses it?** → Individuals tracking personal money; each has a private account.
4. **What are the main features?** → Auth, transactions, CSV import, rules, budgets, reports.
5. **What is the tech stack?** → Java 21, Spring Boot, PostgreSQL, React, MUI, Docker.
6. **What is a REST API?** → An HTTP interface where URLs are resources and methods are actions, exchanging JSON.
7. **What is the frontend's job? The backend's?** → Frontend shows data and collects input. Backend enforces rules and stores data.
8. **What is JSON?** → A text format of key-value pairs and arrays; the format both sides exchange.
9. **Name the HTTP methods you used.** → GET, POST, PUT, DELETE (and OPTIONS automatically).
10. **What does status 201 mean? 204? 404?** → Created; success with no body; not found.
11. **What is a controller?** → The class that receives HTTP requests, e.g. `ExpenseController`.
12. **What is a service?** → Where business rules and transactions live, e.g. `ExpenseService`.
13. **What is a repository?** → The data access interface, e.g. `ExpenseRepository`.
14. **What is an entity?** → A class mapped to a table, e.g. `Expense` ↔ `expenses`.
15. **What is a DTO and why use one?** → A network-facing shape. It hides internal fields like `passwordHash` and decouples the API from the tables.
16. **Which database and why?** → PostgreSQL: relational data, exact numbers, strong constraints.
17. **How many tables?** → Six: users, categories, expenses, category_rules, budgets, password_reset_codes.
18. **What is a primary key?** → A unique identifier for a row; `id bigserial` here.
19. **What is a foreign key?** → A reference to another table's key; `expenses.user_id`.
20. **How are passwords stored?** → As BCrypt hashes, never plain text.
21. **What is a JWT?** → A signed token containing the user id and expiry.
22. **Where is the token stored in the browser?** → `localStorage`.
23. **What is React?** → A library for building UIs from components driven by state.
24. **What is a component?** → A reusable function that returns UI.
25. **What is state?** → Data owned by a component; changing it re-renders.
26. **What is `useEffect` used for in your app?** → Fetching data when a page loads or filters change.
27. **What is Axios?** → The HTTP client the frontend uses.
28. **What is Maven?** → The build and dependency tool; `pom.xml`.
29. **What is Docker used for here?** → Running the database, packaging the API and frontend, and tests.
30. **How do you run the project?** → `docker compose up --build`, or database in Docker plus `./mvnw spring-boot:run` and `npm run dev`.

F/U to expect at this level: "show me that in the code", "what happens if that field is missing", "what
status code would that return".

### 8.2 Intermediate (30)

1. **Trace `POST /api/expenses` end to end.** → §2.
   F/U: where does validation happen? → `@Valid` before the controller method body runs.
2. **How does the server know which user is calling?** → `JwtAuthFilter` puts the id from the token into the `SecurityContext`; `@AuthenticationPrincipal` reads it.
   F/U: can the client send a different user id? → There is no user id in any request body or URL.
3. **How do you stop user A reading user B's data?** → Every query includes `user_id`; `findByIdAndUserId`; tested.
   F/U: why 404 and not 403? → So existence is not revealed.
4. **Explain BCrypt.** → Salted, slow, one-way. `matches` re-hashes with the stored salt.
5. **Why is CSRF disabled?** → No cookies.
6. **What is CORS and how did you configure it?** → Allowed origins from `CORS_ORIGINS`, methods GET/POST/PUT/DELETE/OPTIONS.
   F/U: is CORS a security feature for the API? → It protects browser users; it does not stop curl.
7. **How does `@Transactional` work?** → A proxy begins, commits or rolls back.
8. **Derived query vs `@Query`?** → Name-based vs written JPQL/SQL. Examples of both.
9. **Why native queries for reports?** → `date_trunc`, `to_char`, `FILTER`.
10. **How does pagination work?** → `Pageable` in, `Page` out; LIMIT/OFFSET plus a count query.
11. **How does the frontend handle an expired token?** → Response interceptor on 401.
12. **How is validation done on both sides, and why both?** → UX on the client, safety on the server, constraints in the database.
13. **Explain your global exception handling.** → `@RestControllerAdvice`.
14. **What does Flyway do?** → Runs versioned SQL files once, in order, and records them.
    F/U: what if you edit an old migration? → Checksum mismatch; startup fails.
15. **What does `ddl-auto: validate` protect against?** → Entities and schema drifting apart.
16. **How does the CSV import work?** → Header mapping, parse, validate, dedupe, categorise, summarise.
17. **How are duplicates detected?** → Same user, date, amount, description (case-insensitive), by a query and backed by a partial unique index.
18. **How does auto-categorisation work?** → Longest keyword contained in the description; fallback "Uncategorized".
19. **How is the savings rate computed?** → (income − expense) ÷ income × 100; null without income.
20. **How are budgets calculated?** → One grouped query for the month's spend per category, joined to budgets in memory.
    F/U: why not a query per budget? → That would be N+1.
21. **How does Google sign-in work?** → ID token verified with Google's public keys; audience, issuer, verified email; then our own JWT.
22. **How does password reset work?** → Hashed six-digit code, 15 minutes, single use, five attempts.
23. **How does routing work in React?** → `Routes`, nested routes, `RequireAuth`, `Outlet`.
24. **How do you share the logged-in user across components?** → `AuthContext` + `useAuth`.
25. **How did you avoid sending a request per keystroke?** → 300 ms debounce.
26. **How do you handle loading and error states?** → `loading`/`error` state; skeleton, `ErrorState`, `EmptyState`.
27. **What tests did you write?** → 41 backend (integration + unit), 2 frontend.
    F/U: what is MockMvc? → Simulated HTTP through the real filter chain.
28. **What does your CI pipeline do?** → Build and test both halves on push and PR.
29. **Explain your Dockerfile.** → Multi-stage, cached dependencies, JRE-only runtime, non-root.
30. **How is configuration different between local and production?** → Environment variables; `prod` profile; startup check on the secret.

### 8.3 Advanced (20)

1. **What are the weaknesses of your JWT design?** → `localStorage`, no revocation, no refresh, not checked against the database.
   F/U: design revocation. → `token_version` on the user, in the token, compared on each request (costs one lookup, cacheable), or a short-lived token plus refresh.
2. **Can your rate limiter be bypassed?** → Yes: spoofed `X-Forwarded-For`, reset on own successful login, per instance.
   F/U: fix? → Trusted proxy config, key on IP + account, Redis.
3. **Two requests register the same username at the same moment. What happens?** → Both pass the `exists` check; the unique index rejects the second; handler returns 409.
4. **What isolation level do you run at, and does it matter?** → PostgreSQL's default, READ COMMITTED. It is enough because correctness relies on unique constraints, not on read-then-write logic.
5. **The import is one transaction with up to 20,000 statements. Problems?** → Long transaction, connection held, slow request. Batch, or background job.
6. **Why can Hibernate not batch your inserts?** → IDENTITY ids. A sequence generator would allow batching.
7. **How would you make search fast at 10 million rows?** → `pg_trgm` GIN index, or full-text search; always scoped by `user_id`.
8. **How would you cache?** → Reports per user and range with invalidation on writes; categories are near-static. Only after measuring.
9. **How would you run three API instances?** → Works for requests; rate limiter must move; Flyway takes a lock so concurrent startups are safe.
10. **How do you deploy a breaking schema change with zero downtime?** → Expand, migrate, contract: add nullable column, backfill, switch code, then drop. V5 shows the first steps.
11. **What would you monitor?** → Error rate, latency percentiles, pool usage, JVM memory, login failures, 429 counts.
12. **What is the risk of a UTC server for a date-based app?** → "Today" and "this month" differ by user time zone. Handled in most places via `Dates.latestToday()`; a few `LocalDate.now()` calls remain.
13. **Is your duplicate rule correct?** → It is a heuristic. Two real identical imported transactions on one day are merged. A bank reference id would be better.
14. **How does account linking with Google create risk?** → If an attacker pre-registers a victim's email with a password, the victim's later Google sign-in links to that account, which the attacker can also access. Email verification at registration closes it.
15. **How do you prevent enumeration, and where does it still leak?** → Neutral login and reset responses. Leaks: registration message and login timing.
16. **What happens to in-flight requests during a deploy?** → No graceful shutdown is configured; `server.shutdown=graceful` would let them finish.
17. **How would you add roles?** → A role column, authorities in the token/filter, `@PreAuthorize` or matcher rules.
18. **Where is your code hard to change?** → The ownership rule is repeated in every query; changing to shared ledgers touches all of them.
19. **How would you test Google sign-in?** → Inject the `JwtDecoder` as a bean and replace it in tests with one that trusts a test key.
20. **What is the worst thing an attacker could do today?** → With an XSS, steal a token valid for 24 hours. Or, with a stolen token, keep access after the victim resets the password.

### 8.4 Project-specific scenarios (20)

1. **A CSV has columns `Txn Date, Narration, Withdrawal`.** → Rejected with "missing required column(s): date, description, amount", because those header names are not in my lists. Fix: add aliases, or let the user map columns.
2. **A CSV row has `(1,250.00)`.** → Commas removed, brackets stripped, stored as 1250.00, as an expense.
3. **The same file is uploaded twice.** → Second time: 0 imported, all duplicates.
4. **A file has 15,000 rows.** → Rejected with 400 after row 10,000, and because it is one transaction, nothing is saved.
5. **Row 40 has an invalid date.** → Rows 1–39 and 41+ import; the summary lists line 40 and the reason.
6. **A description contains "amazon prime video" with rules `amazon → Shopping` and `prime video → Entertainment`.** → Entertainment: the longer keyword wins.
7. **The user deletes a category that has transactions, a rule and a budget.** → Transactions stay and become Uncategorized; the rule and budget are deleted by the database.
8. **The user tries to delete "Groceries".** → 404: built-in categories do not belong to them. The UI should not offer it (`builtIn: true`).
9. **The user creates a category named "groceries".** → 400: names are compared case-insensitively against visible categories.
10. **A user sets a budget for a category that already has one.** → 400 "That category already has a budget".
11. **A user at 1 a.m. in India adds an expense dated today.** → Accepted: the server allows up to UTC tomorrow.
12. **A user enters a date next week via curl.** → 400 "spentOn cannot be in the future".
13. **A user forgets their password but SMTP is not configured.** → The code is written to the server log and the UI says email is not set up.
14. **Someone requests a reset for an email that is not registered.** → Same message, no code created.
15. **Someone guesses the reset code six times.** → Fifth wrong attempt locks the code; they must request a new one, and only three requests per 15 minutes produce codes.
16. **A user who registered with a password clicks "Continue with Google" using the same email.** → The account is linked; no duplicate.
17. **A user changes their username.** → Saved if free; the sidebar updates through `setUser`; the token stays valid because it carries the id, not the username.
18. **A user signs out on a shared computer.** → Token removed from that browser. The token would still be valid if someone had copied it.
19. **The user opens `/budgets` directly in a new tab.** → The host serves `index.html` (SPA fallback), React Router renders the page, or `RequireAuth` redirects to login and returns them afterwards.
20. **The first request of the day takes 45 seconds.** → The free Render instance was asleep and had to start the JVM, run Flyway and validate the schema.

---

## 9. Rapid Revision Sheet

Numbers worth remembering:

| Item | Value |
| --- | --- |
| JWT lifetime | 24 hours |
| Minimum JWT secret | 32 bytes |
| Login limit | 10 per 15 minutes per IP |
| Forgot / reset limits | 5 / 10 per 15 minutes per IP; 3 codes per 15 minutes per user |
| Reset code | 6 digits, 15 minutes, 5 attempts, single use |
| Password length | 8 to 72 |
| Username | 3 to 30: letters, digits, dot, underscore; stored lower-case |
| Age | 13 to 120, optional |
| Upload limits | 5 MB, 10,000 rows |
| Default page size | 25, newest first |
| Money | `numeric(12,2)`, `BigDecimal`, `HALF_UP` |
| Tables / migrations | 6 tables, V1 to V8 |
| Built-in categories | 10 |
| Tests | 41 backend, 2 frontend |
| Ports | API 8080 (8081 locally), frontend 5173, database 5433 |

Five things to mention without being asked:

1. Partial-success CSV import with line-numbered errors.
2. Every query scoped by the user id from the token, and a test that proves it.
3. Aggregation in SQL and exact money types.
4. Flyway plus `validate`, and tests on real PostgreSQL.
5. An honest list of weaknesses with fixes.
