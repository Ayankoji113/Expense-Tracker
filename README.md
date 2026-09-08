# Personal Expense Tracker

A full-stack personal finance dashboard: import a bank CSV, let keyword rules categorize it, set budgets,
and see where the money went. Java 21 / Spring Boot REST API with JWT auth and PostgreSQL, React + Material UI
frontend, all runnable with one `docker compose up`.

![Dashboard](docs/dashboard.jpg)

## Quick start

```bash
docker compose up --build
```

- App: <http://localhost:5173>
- API: <http://localhost:8080/api>

Register an account, add a few keyword rules on the **Categories** page (`big bazaar` → Groceries,
`uber` → Transport), then import [`sample-data/transactions.csv`](sample-data/transactions.csv) from the
**Import CSV** page and watch the dashboard fill in.

## What it does

| Feature | Detail |
| --- | --- |
| Multi-user auth | Register / login, BCrypt hashes, stateless JWT, every query scoped to the authenticated user |
| Google sign-in | Optional: Google Identity Services button, ID token verified server-side against Google's keys |
| User profile | Unique username and optional age, editable in-app; Google accounts get a username derived from their email |
| Income and expenses | Both tracked, with net balance and savings rate per month |
| Transactions | Server-side pagination, search, type / category / date-range filters, inline add-edit-delete |
| CSV import | Header mapping, several date formats, duplicate detection, per-row error reporting |
| Auto-categorization | Per-user keyword rules; the longest keyword found in a description wins |
| Budgets | Monthly limit per category with spent / remaining / percentage and semantic colour grading |
| Analytics | Category distribution, income vs expense, daily spend, per-category breakdown over any range |
| Dashboard | Stat cards with month-over-month trends, three charts, budget progress, recent transactions |

The import is the interesting part: it parses the whole file, imports every valid row, skips rows that
duplicate existing transactions, and returns a summary naming the line number and problem of each bad row —
one malformed line does not sink the upload.

## Interface

Responsive from 320px up: a persistent sidebar on desktop that becomes a drawer on mobile, tables that
turn into transaction cards on small screens, and charts that resize instead of shrinking to nothing.
Light and dark themes are separate palettes, not an inversion, and the choice is remembered per browser.
Amounts are formatted as Indian Rupees throughout (`₹1,25,000`) via a single `formatCurrency` utility.

![Transactions](docs/transactions.jpg)
![Budgets in dark mode](docs/budgets-dark.jpg)
![Profile](docs/profile.jpg)

## Stack

**Backend** — Java 21, Spring Boot 4, Spring Security + JJWT, Spring Data JPA / Hibernate, PostgreSQL 16,
Flyway migrations, Bean Validation, OpenCSV, Maven.

**Frontend** — React 19, Vite, Material UI 7, Recharts, Axios, React Router.

**Testing / ops** — JUnit 5 + MockMvc + Testcontainers (real Postgres, not H2), Vitest + React Testing
Library, GitHub Actions CI, multi-stage Docker builds, nginx serving the SPA and proxying `/api`.

## API

All endpoints except `/api/auth/**` need `Authorization: Bearer <token>`.

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login` | Get a JWT (register takes `username`, optional `age`) |
| POST | `/api/auth/google` | Trade a Google ID token for a JWT |
| GET | `/api/auth/config` | Whether Google sign-in is configured |
| GET / PUT | `/api/profile` | Read or update username and age |
| GET | `/api/expenses?from&to&kind&categoryId&q&page&size` | Paged, filtered transactions |
| POST / PUT / DELETE | `/api/expenses[/{id}]` | Create, update, delete (`kind` = `EXPENSE` or `INCOME`) |
| POST | `/api/expenses/import` | Multipart CSV upload, returns an import summary |
| GET / POST / DELETE | `/api/categories[/{id}]` | Categories (built-ins are shared, read-only) |
| GET / POST / DELETE | `/api/categories/rules[/{id}]` | Auto-categorization keyword rules |
| GET / POST / PUT / DELETE | `/api/budgets[/{id}]?month=YYYY-MM` | Budgets with spend measured against the limit |
| GET | `/api/reports/summary`, `/by-category`, `/monthly`, `/daily` | Dashboard and analytics aggregates |

## Google sign-in (optional)

The app runs on email and password out of the box. To add the "Continue with Google" button:

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials) create (or pick) a project,
   then **Create credentials → OAuth client ID → Web application**.
2. Under **Authorised JavaScript origins** add the origins you serve the app from — `http://localhost:5173`
   for local use, plus your deployed URL.
3. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`; the client secret is not needed).
4. Set it in both places and restart:

```bash
# docker compose picks up both from one variable
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com docker compose up --build

# or for local development
#   backend/  : GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com ./mvnw spring-boot:run
#   frontend/ : put VITE_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com in .env.development
```

The browser sends the Google ID token to `/api/auth/google`; the backend verifies its signature against
Google's published keys, checks the audience and issuer, and only then issues its own JWT. No client
secret ever reaches the browser. If the client id is missing on either side the button simply does not
render, and the endpoint returns a clear error rather than half-working.

A Google sign-in matching an existing email links to that account rather than creating a second one.

## Architecture

```
React SPA ──HTTP/JSON──▶ Spring Boot API ──JDBC──▶ PostgreSQL
   (nginx)                JwtAuthFilter               (Flyway-managed schema)
                          feature packages:
                          auth · user · expense · category · budget · importer · report
```

Aggregation happens in SQL, not in Java streams. Money is `BigDecimal(12,2)` end to end. The schema is
owned by Flyway migrations with Hibernate set to `validate`, so the entities and the database can never
quietly drift apart. On the frontend, colours live in one theme file and currency formatting in one utility.

## Development

Backend (needs a Postgres — `docker compose up -d db` gives you one on port 5433):

```bash
cd backend
./mvnw spring-boot:run     # http://localhost:8080
./mvnw verify              # tests, needs Docker for Testcontainers
```

Frontend:

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173, talks to VITE_API_URL
npm test
```

`SERVER_PORT`, `DB_URL`, `DB_USER`, `DB_PASSWORD`, `JWT_SECRET`, `JWT_TTL_HOURS`, `CORS_ORIGINS` and
`GOOGLE_CLIENT_ID`
are all environment-overridable; the defaults in `application.yml` are for local development only.
Set a real `JWT_SECRET` (32+ bytes) anywhere else.

## Deployment

The backend image is a plain `java -jar` container, so it deploys to Render / Fly / Railway from
`backend/Dockerfile` with `DB_URL` + `JWT_SECRET` set. The frontend is static output; build it with
`npm run build` and host `dist/` anywhere, or use `frontend/Dockerfile` for the nginx image that also
proxies `/api` to the backend.
