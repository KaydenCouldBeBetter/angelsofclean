# Angels of Clean — Project Map

_Survey of the repository as it stands. Report only; describes what the code does, not what it should do._

Angels of Clean is a residential + commercial cleaning company in Syracuse, NY. This app lets customers book residential cleanings, request commercial quotes, and lets admins manage bookings, the calendar, and staff. Business timezone is **America/New_York** and every stored/displayed time is anchored to it via `Intl` (never the server or browser zone).

> **Repo layout note:** the tracked Next.js app lives in the nested `angels-of-clean/` directory, not at the git root. All paths below are relative to `angels-of-clean/`.

---

## 1. Tech stack & configuration

| Layer | Technology | Version (package.json) |
|-------|-----------|------------------------|
| Framework | Next.js (App Router) | 16.2.10 |
| Language | TypeScript | ^5 |
| UI runtime | React + React DOM | 19.2.4 |
| React Compiler | `reactCompiler: true` (next.config) + `babel-plugin-react-compiler` | 1.0.0 |
| Database / Auth | Supabase (`@supabase/supabase-js`, `@supabase/ssr`) | 2.110.8 / 0.12.3 |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) + `tw-animate-css` | ^4 |
| UI components | shadcn/ui (style `base-nova`, base color neutral, lucide icons) | shadcn ^4.13.0 |
| Calendar | FullCalendar (core, react, daygrid, timegrid, interaction) | 6.1.21 |
| State | Zustand + `persist` (sessionStorage) | 5.0.14 |
| Utilities | clsx, tailwind-merge, class-variance-authority | — |
| Testing | Vitest + @vitejs/plugin-react + jsdom | vitest ^4.1.9 |

**Scripts:** `dev` (`next dev`), `build` (`next build`), `start` (`next start`), `lint` (`eslint`), `test` (`vitest run`).

**tsconfig:** strict mode, `moduleResolution: bundler`, path alias `@/* → ./*`, Next plugin. **components.json:** aliases `@/components`, `@/lib`, `@/components/ui`, `@/lib/utils`, `@/hooks`.

**next.config.ts:** enables React Compiler and sets global security headers on `/(.*)`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo disabled), and, for every route except `/admin` and `/admin/*`, a `Content-Security-Policy` from `lib/csp.ts` `buildCsp()`. Public pages are prerendered, so their policy allows inline scripts but no `'unsafe-eval'` outside dev; `connect-src` allows only `'self'` and the Supabase project origin; `object-src 'none'`, `base-uri`/`form-action 'self'`, `frame-ancestors 'none'`. Admin pages get a per-request nonce policy from `middleware.ts` instead.

**vitest.config.ts:** forces `process.env.TZ = "UTC"` by default so timezone bugs surface in CI; jsdom environment; `@` alias.

**Environment variables** (names only, referenced in code — `.env.local` present but not read for this survey):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (client + server).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key for session-bound clients.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only** (no `NEXT_PUBLIC_` prefix); bypasses RLS, used only for the booking insert path and its rate limiter (where it also keys the hash of the caller's IP).

**CI:** none. No `.github/workflows` or other CI config is present. Tests are run manually.

---

## 2. Database (supabase/, applied in numeric order)

### `001_initial_schema.sql`
Enum `booking_status`: `pending | confirmed | active | done | cancelled`.

**Tables**
- **employees** — `id uuid pk`, `name`, `initials`, `phone`, `hired_date date`, `created_at`. Seeded with 5 real employees (Marcus T., Ana V., Rosa C., Devon M., Lisa P.). No booking rows seeded.
- **bookings** — `id uuid pk`; `booking_number int identity` (starts at 1000, unique); `client_name`, `email`, `phone`; `service_type` (`standard|deep|moveinout`); `frequency` (`one-time|weekly|bi-weekly|monthly`); `address`, `city`, `zip`; `bedrooms`/`bathrooms smallint` (CHECK 1–5); `notes`; `scheduled_date date`; `time_slot` (`morning|afternoon`); `start_at`/`end_at timestamptz`; `status` (default `pending`); `submitted_at`, `created_at`, `updated_at`. Index on `start_at`.
- **booking_employees** — join table; PK `(booking_id, employee_id)`; `booking_id` FK → bookings **ON DELETE CASCADE**, `employee_id` FK → employees **ON DELETE RESTRICT**; `assigned_at`. Index on `employee_id`.
- **activity_log** — `id`, `booking_id` FK → bookings ON DELETE CASCADE, `description`, `created_at`. Index on `booking_id`.

**RLS (as originally shipped):** enabled on all four tables. Policies granted access on `auth.role() = 'authenticated'` — meaning *any* signed-in Supabase account could read all customer PII. Deliberately **no INSERT/DELETE policy on bookings** (customer inserts go through the service-role client, which bypasses RLS).

### `002_admin_role_rls.sql` (tightens 001 — this is the effective policy set)
Drops the `authenticated`-based policies and recreates them keyed on the JWT claim `app_metadata.role = 'admin'`:
- **bookings** — SELECT + UPDATE for admins only.
- **employees** — SELECT for admins only.
- **booking_employees** — ALL for admins only.
- **activity_log** — ALL for admins only.

`app_metadata` can only be set server-side (dashboard or service role); clients cannot self-grant it (unlike `user_metadata`). Requires manually granting an account the role first (SQL header documents the `update auth.users … raw_app_meta_data` step). Public booking flow is unaffected (service-role insert). Still no INSERT/DELETE policy on bookings and no anon policy anywhere.

### `004_rate_limits.sql` (rate limiting for the public booking form — run by hand, like the others)
Table `rate_limits` (`bucket`, `window_start`, `hits`; PK on the first two; RLS enabled with **no policies**, so service-role only) and function `check_rate_limit(p_bucket, p_limit, p_window_seconds) returns boolean`, an atomic fixed-window counter (upsert + increment) that also prunes windows older than a day. `EXECUTE` is revoked from `public`/`anon`/`authenticated` and granted to `service_role` only. Buckets hold a keyed hash of the client IP, never the IP itself. Until this file is run the app's limiter fails open (logs and allows).

### `005_commercial_quotes.sql` (commercial quote requests — run by hand, after 002)
Table `commercial_quotes`: `id`, `quote_number int identity` (starts at 1000, shown as `COM-{n}`), `business_name`, `contact_name`, `email`, `phone`, `facility_type`, `sqft_range`, `address`, `city`, `zip`, `floors smallint` (1–20), `service_areas text[]` (≥1), `frequency`, `schedule_preference` (nullable), `notes`, `submitted_at`; CHECK constraints mirror the option lists in `lib/constants.ts`. RLS: admins (`app_metadata.role = 'admin'`) may SELECT; there is no insert/update/delete policy for any role, so rows are written only by the service-role client and are read-only in the admin UI.

### `003_fix_booking_times_tz.sql` (data backfill — **not** an auto-run migration)
A DIAGNOSTIC `SELECT` + a commented-out `UPDATE`. Fixes rows created before the B8 timezone fix, where `new Date(\`${date}T08:00:00\`)` parsed the slot window in the *server's* local zone (a UTC server stored NY 8 AM as 08:00Z, 4–5 h too early). The correction rebuilds `start_at`/`end_at` from `scheduled_date + time_slot` interpreted `AT TIME ZONE 'America/New_York'`. Idempotent; meant to be reviewed and run by hand only if the diagnostic returns rows.

**Note:** there is no generated Supabase types file — `lib/supabase/types.ts` is hand-written and must be kept in sync manually.

---

## 3. Routes & pages (app/)

Root `app/layout.tsx` sets Geist fonts and the `%s | Angels of Clean` title template. `app/error.tsx` is the global error boundary (Try Again / Return Home). `app/page.tsx` is the dual-path homepage: Residential / Commercial / Admin links, with Privacy Policy and Terms of Service links underneath.

### Legal (`app/privacy/`, `app/terms/`)
Static server pages sharing `components/legal/LegalPage.tsx` (header with home + Privacy/Terms links, title, effective date). The text describes what the code actually does (fields collected by each flow, `sessionStorage` wizard state, the hashed-IP rate limiter, Supabase + hosting provider, no analytics); keep it in step when data collection changes. Owner-supplied details (legal name, contact email/phone, mailing address, effective date, record retention, cancellation, payment and damage policies) come from `LEGAL_INFO` in `lib/legal.ts`; each missing one renders as a visible "[To be provided: …]" placeholder. While `isLegalDraft()` is true (any value missing, or `reviewed: false`), both pages show a "Draft — not yet in effect" banner and are `noindex, nofollow`. Linked from the homepage, both contact steps (`PrivacyNote`), and both review steps above the submit button (`AgreementNote`, "By selecting {button}, you agree to our Terms of Service…"), all in `components/booking/PolicyNotes.tsx`.

### Customer-facing — Residential (`app/residential/`, 6-step wizard)
Wrapped by `layout.tsx` → `ResidentialShell` (desktop navbar + stepper + live `BookingSummary` sidebar; mobile is a stacked `max-w-sm` column). All steps are `"use client"`, read/write the Zustand store, and guard against deep-linking by `router.replace("/residential")` if prerequisite state is missing. A `?returnTo=review` param makes each step's CTA jump back to Review after editing.

| Route | Step | Purpose |
|-------|------|---------|
| `/residential` | 1 | Service type (standard/deep/moveinout) + frequency. |
| `/residential/address` | 2 | Address/city/ZIP. Validates 5-digit ZIP; on submit, if ZIP ∉ `SERVICE_AREA_ZIPS` → `/residential/error`. |
| `/residential/property` | 3 | Bedrooms/bathrooms steppers (1–5) + notes. |
| `/residential/datetime` | 4 | Date chips (next ~6 NY days) + morning/afternoon slots. Enforces same-day cutoff via `isNyWallClockInFuture`. Evening slot always disabled; 3rd day hardcoded "Full" (Figma placeholder). |
| `/residential/contact` | 5 | Name/email/phone with regex validation. |
| `/residential/review` | 6 | Summary cards + **calls `submitBooking`** server action; on success → confirmation. Shows "Quote provided after confirmation" (no price). |
| `/residential/confirmation` | — | Success screen. Copies the booking into local state, then clears the store and `sessionStorage` (backlog B50); a reload shows only the `?ref=` number with a privacy note. Calendar/create-account buttons are non-functional placeholders. |
| `/residential/error` | — | Out-of-service-area screen; "Try a Different Address" → back to step 2. |

### Customer-facing — Commercial (`app/commercial/`, 4-step quote request)
Wrapped by `layout.tsx` (Suspense). Each step uses `CommercialNav` + `CommercialStepper` (desktop) and `StepHeader`/`ProgressDots` (mobile).

| Route | Step | Purpose |
|-------|------|---------|
| `/commercial` | 1 | Facility type + sqft range + service address/ZIP. Off-area ZIP → `/commercial/error`. |
| `/commercial/services` | 2 | Floors stepper + service-area checkboxes (≥1 required) + notes. |
| `/commercial/contact` | 3 | Contact name, business name, email/phone, frequency, schedule preference. |
| `/commercial/review` | 4 | Summary + **calls `submitCommercialQuote`**; on success → `/commercial/confirmation?ref=COM-…`. A refusal, a failed insert, or a request that never reaches the server shows a "Your request was not sent" alert and stays on the page. |
| `/commercial/confirmation` | — | Success screen; shows the server-issued reference from `?ref=` (redirects to `/commercial` without one). Copies the request into local state, then clears the store and `sessionStorage` (backlog B50); a reload shows only the reference. |
| `/commercial/error` | — | Out-of-area screen with call-to-phone. |

### Admin (`app/admin/`, all under middleware guard)
`layout.tsx` is a server component that calls `connection()` so every admin page renders per request (required for the CSP nonce), then renders `AdminShell.tsx`: the sidebar shell (Dashboard / Calendar / Bookings / Quotes / Employees / Settings) for every route except the auth pages. `AdminShell` reads the display name via a **browser** Supabase client.

| Route | Type | Purpose |
|-------|------|---------|
| `/admin` | server | If already admin → redirect to dashboard; else render `LoginForm` (links to Forgot password). |
| `/admin/forgot-password` | server → client | Public. Email form → `requestPasswordReset`; always shows the same "Check your email" result whether or not the account exists. Shows an expired-link notice with `?error=link`. |
| `/admin/reset-password/confirm` | route handler (GET) | Public. Landing point of the reset email: verifies `token_hash` + `type=recovery` (custom template, any device) or exchanges `code` (Supabase's default template, same browser only), which signs the admin in; then redirects to `/admin/reset-password`, or to `/admin/forgot-password?error=link` on failure. The destination is fixed — any `next` param is ignored. |
| `/admin/reset-password` | server → client | Admin session required (the reset link provides one). New password + confirmation → `updatePassword`, which redirects to the dashboard. |
| `/admin/dashboard` | server | Stat cards (today's bookings, pending, active employees, completed this week) + today's jobs table; each row ends in the client `JobRowActions` (View link, plus one-click Confirm on pending rows). Data from `getDashboardStats` + `getEmployees`. |
| `/admin/calendar` | server → client | `getJobsInRange()` (±2 months) + employees → `CalendarView` (FullCalendar). |
| `/admin/bookings` | server | Filter tabs (today/upcoming/past/all via `?filter=`); `getJobsByDateFilter` → `BookingsList`. |
| `/admin/bookings/[id]` | server | Booking detail: details card, status banner, `BookingActions`, activity log. `getJobById` + `getActivityLog` + `getEmployees`. |
| `/admin/employees` | server | Employee cards with derived today-status. `getEmployees` + `getTodayJobs`. |
| `/admin/quotes` | server | Commercial quote requests, newest first, one card each: business, contact (mailto/tel links), reference, received time, facility, address, areas, frequency, preference, notes. Read-only. Data from `getCommercialQuotes`. |
| `/admin/settings` | server | Placeholder: Notifications card marked "Coming soon" with both toggles disabled and no Save button, since the app can't send email or SMS yet. |

### API (`app/api/`)
- **`GET /api/admin/jobs`** — requires admin (`requireAdmin`; 401 if signed out, 403 if not admin). Requires `from`/`to` (YYYY-MM-DD) query params (400 otherwise). Returns `getJobsInRange(from, to)` as JSON, or 503 if the query failed (never an empty list). Consumed by `CalendarView` when the visible range changes.

### Middleware (`middleware.ts`, matcher `/admin/:path*`)
Runs `updateSession` (refreshes the Supabase cookie), then for any `/admin/*` route except the public ones (`/admin`, `/admin/forgot-password`, `/admin/reset-password/confirm` — exact matches), redirects to `/admin` unless `user.app_metadata.role === "admin"`. This guards **page loads only**; server actions and the API route each re-verify with `requireAdmin`. It also sets the admin `Content-Security-Policy`: a fresh nonce per request with `'strict-dynamic'` and no `'unsafe-inline'` for scripts, put on the forwarded request (Next.js stamps the nonce on its `<script>` tags while rendering) and on the response.

---

## 4. Server actions & data access

### Server actions
| Action | File | Auth | Client | Notes |
|--------|------|------|--------|-------|
| `submitBooking` | `app/actions/submitBooking.ts` | none (public) | service-role | Validates, then checks the per-IP rate limit (`allowPublicSubmission("booking")`, 5 per hour), then inserts a booking; logs "Booking submitted by client". |
| `adminCreateBooking` | same file | `requireAdmin` | service-role | Same shared `createBooking` (never rate-limited); actor email from verified session; logs "Booking created by {email}". |
| `submitCommercialQuote` | `app/actions/submitCommercialQuote.ts` | none (public) | service-role | Validates (payload shape, length caps, and enums derived from the same `lib/constants.ts` lists the form renders), checks the per-IP rate limit (`allowPublicSubmission("quote")`), inserts into `commercial_quotes`, and returns `COM-{quote_number}`. Never returns success unless the row was stored. |
| `assignEmployees` | `app/admin/actions.ts` | `requireAdmin` | session-bound | Deletes then re-inserts `booking_employees`; logs activity; revalidates admin paths. |
| `confirmBooking` | `app/admin/actions.ts` | `requireAdmin` | session-bound | Moves a booking pending → confirmed. The update filters on `status = 'pending'`, so a booking cancelled or completed in the meantime matches 0 rows and is refused rather than brought back; logs activity; revalidates. Called by the "Confirm Booking" button in `BookingActions` and the per-row "Confirm" button in `dashboard/JobRowActions` (both shown only while pending). |
| `updateBookingStatus` | `app/admin/actions.ts` | `requireAdmin` | session-bound | Updates status with `.select()` to detect 0-row (missing/RLS-blocked) as failure; logs activity; revalidates. |
| `signIn` / `signOut` | `app/admin/auth-actions.ts` | — | session-bound | `signIn` rejects non-admin accounts and signs them back out; redirects to dashboard / `/admin`. |
| `requestPasswordReset` | `app/admin/auth-actions.ts` | none (public) | session-bound | Validates the email, calls `auth.resetPasswordForEmail` with `redirectTo` = `{origin}/admin/reset-password/confirm`. Never reveals whether the account exists; maps Supabase's email rate limit to a readable message; logs only the error code. |
| `updatePassword` | `app/admin/auth-actions.ts` | `requireAdmin` | session-bound | Length check (`PASSWORD_MIN_LENGTH` 8 from `lib/constants.ts`, ≤ 72 bytes for bcrypt), `auth.updateUser({ password })`, readable messages for `same_password` / `weak_password`, then redirects to the dashboard. |

`createBooking` (shared by both booking actions) validates, in order: payload shape (every field the right runtime type), free-text length caps (`FIELD_MAX_LENGTHS` in `lib/constants.ts`, mirrored as `maxLength` on the inputs), service type, frequency, address/city non-empty, 5-digit ZIP, ZIP ∈ `SERVICE_AREA_ZIPS`, bed/bath 1–5, `isValidDateStr`, valid time slot, `isNyWallClockInFuture` (past-date + same-day cutoff), name, email regex, phone regex. Only then converts the slot window to UTC instants via `nyWallClockToInstant` and inserts. DB errors are logged as `{code, correlationId}` only — never the row — to keep PII out of logs.

### Query helpers (`lib/supabase/queries.ts`, all session-bound `createClient`, RLS-gated to admins)
- `getEmployees()` — roster, `hired_date` formatted in NY.
- `getJobs()` — all bookings (full projection incl. email/phone/notes).
- `getJobsByDateFilter("today"|"upcoming"|"past"|"all")` — pushes the NY-today date filter to Postgres; past sorted desc, else asc. Uses a list projection (`LIST_BOOKING_COLUMNS`) that keeps `email`/`phone` for the client list's search but omits `notes`, which the list never renders, so entry/access notes aren't serialized to the browser.
- `getTodayJobs()` — today's non-cancelled bookings.
- `getJobsInRange(from?, to?)` — calendar; defaults to ±2 months; **slim projection** (`CALENDAR_BOOKING_COLUMNS`) that omits email/phone/notes so contact PII never reaches the calendar surface / API response.
- `getDashboardStats()` — parallel queries: today's jobs, all-pending count, completed-this-week count (Mon–Sun anchored on NY today), employee count.
- `getJobById(id)` / `getActivityLog(bookingId)`.

Rows are mapped to the UI `Job`/`Employee`/`ActivityEntry` shapes from `lib/admin-types.ts`. Every helper returns `QueryResult<T>` — `{ ok: true, data }` or `{ ok: false }` — so a failed query is never reported as an empty result (`getJobById` uses `data: null` for "not found"; `getDashboardStats` fails as a whole if any of its four queries fails). Query errors log only `{code, correlationId}`. Each admin page renders `app/admin/LoadError.tsx` (alert banner + "Try again", which calls `router.refresh()`) in place of its content when any query it depends on fails; `CalendarView` shows its own retry banner when an in-page range fetch fails.

### Supabase clients (`lib/supabase/`)
- **`server.ts` `createClient()`** — `@supabase/ssr` server client bound to the request cookies; acts as the logged-in admin; RLS applies. Used by all query helpers, admin actions, auth actions, and `requireAdmin`.
- **`service.ts` `createServiceRoleClient()`** — service-role client that **bypasses RLS**. Only imported by the two public submit actions (`submitBooking.ts`, `submitCommercialQuote.ts` — the sole insert paths for their tables) and `lib/rate-limit.ts`. Key is server-only.
- **`lib/rate-limit.ts` `allowPublicSubmission(kind)`** — `kind` is `"booking"` or `"quote"`, each with its own allowance. Reads the caller's IP from `x-forwarded-for` (first entry) or `x-real-ip`, HMACs it with the service-role key, and calls the `check_rate_limit` RPC with `SUBMISSION_RATE_LIMIT` (5 per hour) on bucket `{kind}:{hash}`. Fails open (logs `{code, correlationId}`, allows the submission) if the RPC errors or throws; skipped when `NODE_ENV === "development"`.
- **`middleware.ts` `updateSession()`** — refreshes the session cookie and returns `{ supabaseResponse, user }`.
- **`require-admin.ts` `requireAdmin()`** — calls `auth.getUser()` (validates token, doesn't trust cookie) and requires `app_metadata.role === "admin"`; returns a discriminated `AdminAuthResult`. Exports `NOT_SIGNED_IN_ERROR` / `NOT_AUTHORIZED_ERROR`.

---

## 5. Shared code

- **`lib/constants.ts`** — single source of truth for labels and options: `SERVICE_LABELS`, `FREQUENCY_LABELS`, `TIME_SLOT_WINDOWS` (morning 08:00–12:00, afternoon 12:00–16:00; `TIME_LABELS` derived from it), `PRICE_MAP` (`$85/$149/$199`), `SERVICE_AREA_ZIPS`, and the commercial dictionaries/step labels.
- **`lib/datetime.ts`** — all NY-zone date math via `Intl` (zone-independent, DST-correct): `nyWallClockToInstant`, `isValidDateStr`, `addDaysToDateStr`, `isNyWallClockInFuture`, `nyDateStr`/`nyTodayStr`, `nyWallClockISO` (offset-less ISO for FullCalendar's UTC-coercion mode), and formatters `formatNy`, `formatNyTime`, `formatNyTimeRange`, `formatNyDateTime`.
- **`store/bookingStore.ts`** — Zustand store persisted to `sessionStorage` (key `booking-store`); holds the full residential + commercial wizard state and `setStep*` / `setCommercial*` / `reset` actions.
- **`lib/admin-types.ts`** — the admin UI shapes `Job`/`Employee`/`ActivityEntry`/`EmployeeStatus` that queries map rows into; `JobStatus` is an alias of the database's `BookingStatus`.
- **`app/admin/status-config.ts`** — status label/color dictionaries (`STATUS_CONFIG`, `DASHBOARD_STATUS`, `EMPLOYEE_STATUS_CONFIG`). Replaces the old `app/admin/data/mock.ts`, which no longer holds any mock data.
- **`lib/utils.ts`** — `cn()` (clsx + tailwind-merge).
- **`lib/legal.ts`** — `LEGAL_INFO` (owner-supplied business details and policies for `/privacy` and `/terms`, all `null` until provided), `missingLegalFields()`, `isLegalDraft()`.
- **Booking components (`components/booking/`)** — `ResidentialShell`, `DesktopNavbar`, `DesktopStepper`, `CommercialNav`, `CommercialStepper`, `StepHeader`, `ProgressDots`, `BottomCTA`, `BookingSummary`. `BookingSummary` re-declares its own label maps rather than importing `lib/constants`.
- **UI primitives (`components/ui/`)** — shadcn `button`, `card`, `input`, `label`, `textarea`.

---

## 6. Tests

`vitest run` runs under `TZ=UTC`. Files:
- **`lib/__tests__/datetime.test.ts`** — NY conversion, both DST boundaries, `isValidDateStr`, `addDaysToDateStr`, same-day cutoff, formatters. ✅ passing.
- **`lib/__tests__/constants.test.ts`** — label maps, `TIME_SLOT_WINDOWS`, `PRICE_MAP`, `SERVICE_AREA_ZIPS` (each town pinned to its ZIPs, plus an exact-set check). ✅ passing.
- **`app/actions/__tests__/submitCommercialQuote.test.ts`** — stored row shape and `COM-` reference, every option the form offers is accepted, validation matrix, length caps, malformed payloads, no success on a failed insert, PII-safe logging, rate limiting. ✅ passing.
- **`app/admin/__tests__/auth-actions.test.ts`** — reset request (redirect target, no-origin fallback, invalid input, rate-limit message, PII-safe logging) and password update (admin session required, length limits incl. bcrypt's 72 bytes, Supabase error mapping, redirect). ✅ passing.
- **`app/admin/reset-password/confirm/__tests__/route.test.ts`** — token-hash and code paths, expired/failed links, non-recovery tokens refused, `next` ignored. ✅ passing.
- **`__tests__/middleware.test.ts`** — public admin routes reachable signed out (exact match only), everything else requires the admin role. ✅ passing.
- **`components/booking/__tests__/ProgressDots.test.tsx`** — dot labels (completed / current / plain) and a single `aria-current="step"`. ✅ passing.
- **`app/admin/__tests__/status-contrast.test.ts`** — every status chip and banner text/background pair in `status-config.ts` meets WCAG AA 4.5:1. ✅ passing.
- **`app/admin/settings/__tests__/page.test.tsx`** — notifications are labeled "Coming soon" with an explanation, every toggle is disabled and off, and there is no Save button. ✅ passing.
- **`__tests__/legal-pages.test.tsx`** — draft logic (missing/blank values, `reviewed`), both pages render with the banner and placeholders, a filled-in and reviewed `LEGAL_INFO` drops them and links email/phone, the policy notes link to the right pages, and the residential contact step no longer claims "we never share your data". ✅ passing.
- **`__tests__/confirmation-privacy.test.tsx`** — both confirmation pages show the details, then clear them from the store and `sessionStorage`; reloads show only the reference; no reference redirects. ✅ passing.
- **`lib/__tests__/rate-limit.test.ts`** — limit/window passed to the RPC, refusal, raw IP never sent, bucket stability, header precedence, fail-open on error and on throw, dev skip. ✅ passing.
- **`app/actions/__tests__/submitBooking.test.ts`** — validation matrix (run against both `submitBooking` and `adminCreateBooking`), success insert, window→UTC storage, DST offsets, PII-safe logging, admin auth gating. ✅ passing.
- **`app/admin/__tests__/actions.test.ts`** — `assignEmployees`/`confirmBooking`/`updateBookingStatus`: auth gating, 0-row-as-failure, pending-only confirm, activity logging. ✅ passing.
- **`lib/supabase/__tests__/queries.test.ts`** — asserts the calendar projection omits email/phone/notes; `getJobsByDateFilter` (client list) keeps email/phone for search but omits notes; `getJobs` keeps all contact fields; PII-safe error logging; every helper returns `{ ok: false }` on a database error and an empty/`null` result only when there genuinely is none. ✅ passing.
- **`app/api/admin/jobs/__tests__/route.test.ts`** — 200 with jobs, 200 with an empty range, 503 on query failure, 401/403 without querying. ✅ passing.
- **`lib/supabase/__tests__/require-admin.test.ts`** — signed-out, token error, no-role, `user_metadata` ignored, admin accepted. ✅ passing.
- **`store/__tests__/bookingStore.test.ts`** — defaults, each setter, reset. ✅ passing.

### Current test status: 268 passing (17 of 17 files green)
Passes under both `TZ=UTC` and `TZ=America/Los_Angeles`; `tsc --noEmit` clean.

**History — the B16 ZIP swap.** Commit `fe85cd2` meant to change Camillus from `13035` (actually Cazenovia) to `13031`, but edited the Cicero line instead (`13039` → `13031`), which rejected Cicero customers and turned 26 tests red. Corrected 2026-10-13: Cicero is `13039`, Camillus is `13031`, and `13035` is no longer served.

---

## 7. Notable findings (report-only; no code changed)

1. **No CI.** The suite is green now, but it sat red for three weeks after the mis-applied ZIP swap (§6) because nothing runs the tests automatically.
2. **Admin password reset email is in demo mode (deferred).** There is no domain yet (school project), so there is no custom SMTP: reset emails come from Supabase's built-in sender (a few per hour, best effort) with the default template, and the link only works in the browser that requested it. Revisit once a domain exists: custom SMTP, then the `token_hash` template described under backlog B31. No code change is needed.
3. **Commercial quotes depend on migration 005.** The flow is wired end to end (backlog B3), but until `supabase/005_commercial_quotes.sql` is run every submission fails with "Something went wrong. Please try again." Admins see leads only on `/admin/quotes`; there is no email notification and no way to mark a lead as handled yet.
4. **Conflicting prices.** `app/residential/page.tsx` advertises "From $120 / $200 / $250" while `PRICE_MAP` in constants is `$85 / $149 / $199`. (Backlog B28.)
5. **The original backend plan was never built** — it described Prisma + Vercel/Neon Postgres + Auth.js/NextAuth + Zod + Resend/Twilio. The app actually uses Supabase (Postgres + Auth) with hand-written types and no ORM/email/SMS. The plan is archived locally at `docs/archive/BACKEND_PLAN.md` (untracked) with a banner saying so (backlog B51).
6. **Fake availability & dead controls.** The datetime step hardcodes the 3rd offered day as "Full" (`isFull: i === 2`, a Figma placeholder). Several admin/customer buttons are non-functional placeholders: Reschedule, Send Client Message, Print/Export, Add Employee, View Schedule, calendar-export, Create Account.
7. **Settings are a placeholder** — `/admin/settings` shows email/SMS notification toggles disabled and labeled "Coming soon" (backlog B49). Building them needs outbound email/SMS first.
8. Backlog work is tracked as **B1–B52** in `docs/BACKLOG.md`; recent commits (B1/B2/B4/B8/B9/B11/B20) reference those IDs. Design rationale lives in `docs/DECISIONS.md`; Figma mapping in `docs/FIGMA_MAP.md`.

---

## Run / build / test

```bash
npm run dev      # dev server on localhost:3000
npm run build    # production build
npm start        # serve production build
npm run lint     # ESLint
npm run test     # Vitest (run mode; TZ=UTC by default)
```

Requires `.env.local` with the three Supabase keys (§1). The database must be initialized by running `supabase/001_initial_schema.sql` then `002_admin_role_rls.sql` in the Supabase SQL editor, and an admin account must be granted `app_metadata.role = 'admin'` (see the `002` header) before the admin panel is usable.
