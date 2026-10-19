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
| Testing | Vitest + @vitejs/plugin-react + jsdom (unit); pgTAP via `supabase test db` (database) | vitest ^4.1.9 |
| Tooling | Supabase CLI (dev dependency, run as `npx supabase …`) | supabase ^2.121.0 |

**Scripts:** `dev` (`next dev`), `build` (`next build`), `start` (`next start`), `lint` (`eslint`), `test` (`vitest run`), `db:types` (`supabase gen types typescript --linked > lib/supabase/database.types.ts`). Node 22 is what CI uses; the README lists the requirements and setup.

**tsconfig:** strict mode, `moduleResolution: bundler`, path alias `@/* → ./*`, Next plugin. **components.json:** aliases `@/components`, `@/lib`, `@/components/ui`, `@/lib/utils`, `@/hooks`.

**next.config.ts:** enables React Compiler and sets global security headers on `/(.*)`: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo disabled), and, for every route except `/admin` and `/admin/*`, a `Content-Security-Policy` from `lib/csp.ts` `buildCsp()`. Public pages are prerendered, so their policy allows inline scripts but no `'unsafe-eval'` outside dev; `connect-src` allows only `'self'` and the Supabase project origin; `object-src 'none'`, `base-uri`/`form-action 'self'`, `frame-ancestors 'none'`. Admin pages get a per-request nonce policy from `middleware.ts` instead.

**vitest.config.ts:** forces `process.env.TZ = "UTC"` by default so timezone bugs surface in CI; jsdom environment; `@` alias.

**Environment variables** (names only, referenced in code — `.env.local` present but not read for this survey):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL (client + server).
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon key for session-bound clients.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only** (no `NEXT_PUBLIC_` prefix); bypasses RLS, used only for the public booking and quote inserts and their rate limiter (where it also keys the hash of the caller's IP).

**CI:** `.github/workflows/ci.yml` (at the git root), one job named `verify`, on every pull request and every push to `v2`. On Node 22 in `angels-of-clean/` it runs `npm ci`, `npm run lint`, `npx tsc --noEmit`, `npm test` and `npm run build` (placeholder Supabase env values; the build never contacts Supabase). It does not apply migrations or run the pgTAP tests (those need Docker). GitHub branch protection for `v2` is a repository setting, not a file in the repo; the README says what it should require.

---

## 2. Database (supabase/)

Schema changes are **Supabase CLI migrations** in `supabase/migrations/`, named `<14-digit version>_<name>.sql` and applied in version order (`npx supabase migration new <name>`, `npx supabase db push`). Applied migrations are never edited or renamed: `supabase/__tests__/migrations.test.ts` pins the applied list and fails on a rename, an out-of-order file or a loose `.sql` the CLI would ignore. After the owner applies a schema change, `npm run db:types` regenerates `lib/supabase/database.types.ts` (never hand-edited). `lib/supabase/types.ts` re-exports the row types from it under the names the app imports, and narrows the columns that have CHECK constraints and the jsonb results of the two RPCs below (`lib/supabase/__tests__/types.test.ts`). One-off data fixes live in `supabase/scripts/` and are run by hand. `supabase/config.toml` configures the local stack (Postgres 17); `supabase/tests/database/` holds pgTAP tests, run with `npx supabase start` then `npx supabase test db` (needs Docker, not part of CI).

### `20260726221400_initial_schema.sql`
Enum `booking_status`: `pending | confirmed | active | done | cancelled`.

**Tables**
- **employees** — `id uuid pk`, `name`, `initials`, `phone`, `hired_date date`, `created_at`. Seeded with 5 real employees (Marcus T., Ana V., Rosa C., Devon M., Lisa P.). No booking rows seeded.
- **bookings** — `id uuid pk`; `booking_number int identity` (starts at 1000, unique); `client_name`, `email`, `phone`; `service_type` (`standard|deep|moveinout`); `frequency` (`one-time|weekly|bi-weekly|monthly`); `address`, `city`, `zip`; `bedrooms smallint` (CHECK 1–5); `bathrooms numeric(2,1)` (CHECK 1–5 in steps of 0.5, since `20261019225200_half_bathrooms.sql`); `notes`; `scheduled_date date`; `time_slot` (`morning|afternoon`); `start_at`/`end_at timestamptz`; `status` (default `pending`); `submitted_at`, `created_at`, `updated_at`. Index on `start_at`.
- **booking_employees** — join table; PK `(booking_id, employee_id)`; `booking_id` FK → bookings **ON DELETE CASCADE**, `employee_id` FK → employees **ON DELETE RESTRICT**; `assigned_at`. Index on `employee_id`.
- **activity_log** — `id`, `booking_id` FK → bookings ON DELETE CASCADE, `description`, `created_at`. Index on `booking_id`.

**RLS (as originally shipped):** enabled on all four tables, granting access on `auth.role() = 'authenticated'` — any signed-in account could read all customer PII. Deliberately **no INSERT/DELETE policy on bookings** (customer inserts go through the service-role client, which bypasses RLS). Replaced by the next migration.

### `20260918194509_admin_role_rls.sql` (tightens the first; the effective policy base)
Drops the `authenticated`-based policies and recreates them keyed on the JWT claim `app_metadata.role = 'admin'`:
- **bookings** — SELECT + UPDATE for admins only.
- **employees** — SELECT for admins only.
- **booking_employees** — ALL for admins only.
- **activity_log** — ALL for admins only (narrowed again by the status-flow migration below).

`app_metadata` can only be set server-side (dashboard or service role); clients cannot self-grant it (unlike `user_metadata`). An account must be granted the role first: the migration header holds the `update auth.users … raw_app_meta_data` SQL, repeated in the README. Public booking flow is unaffected (service-role insert). Still no INSERT/DELETE policy on bookings and no anon policy anywhere.

### `20261013224928_rate_limits.sql` (rate limiting for the public forms)
Table `rate_limits` (`bucket`, `window_start`, `hits`; PK on the first two; RLS enabled with **no policies**, so service-role only) and function `check_rate_limit(p_bucket, p_limit, p_window_seconds) returns boolean`, an atomic fixed-window counter (upsert + increment) that also prunes windows older than a day. `EXECUTE` is revoked from `public`/`anon`/`authenticated` and granted to `service_role` only. Buckets hold a keyed hash of the client IP, never the IP itself. Until this is applied the app's limiter fails open (logs and allows).

### `20261013230608_commercial_quotes.sql` (commercial quote requests)
Table `commercial_quotes`: `id`, `quote_number int identity` (starts at 1000, shown as `COM-{n}`), `business_name`, `contact_name`, `email`, `phone`, `facility_type`, `sqft_range`, `address`, `city`, `zip`, `floors smallint` (1–20), `service_areas text[]` (≥1), `frequency`, `schedule_preference` (nullable), `notes`, `submitted_at`; CHECK constraints mirror the option lists in `lib/constants.ts`. RLS: admins (`app_metadata.role = 'admin'`) may SELECT; there is no insert/update/delete policy for any role, so rows are written only by the service-role client and are read-only in the admin UI.

### `20261018142718_assign_booking_employees.sql` (backlog B14)
Function `assign_booking_employees(p_booking_id, p_employee_ids, p_expected_employee_ids, p_allow_overlap) returns jsonb`: changes a job's crew in one transaction. It checks the admin claim, refuses cancelled and done jobs, refuses the save if the crew changed since the admin loaded the page (`stale`), reports overlapping jobs for each newly added cleaner unless `p_allow_overlap` (`conflicts`), and applies only the difference. Result `status`: `saved | conflicts | stale | closed | not_found`. `EXECUTE` is revoked from `public`/`anon` and granted to `authenticated`.

### `20261019033138_db_defense_in_depth.sql`
Makes the database enforce what the actions already validate: length CHECKs on the free-text columns of `bookings` and `commercial_quotes` (must equal `FIELD_MAX_LENGTHS` in `lib/constants.ts`; `supabase/__tests__/field-lengths.test.ts` fails if they drift), ZIP and email format CHECKs, `bookings_end_after_start`, a `commercial_quotes.updated_at` column, and a `set_updated_at()` trigger function on both tables. Also trims the default table privileges Supabase grants the API roles. Whether a ZIP is in the service area stays an app rule.

### `20261019035418_booking_status_flow.sql` (backlog B12)
One status flow, enforced in Postgres: `pending → confirmed → active → done`, and `pending | confirmed | active → cancelled`; `done` and `cancelled` are final. A trigger on `bookings` refuses every other status change, whoever makes it (`booking_status_transition_allowed()` / `enforce_booking_status_transition()`). `app/admin/status-config.ts` mirrors the list as `STATUS_TRANSITIONS`, and a test keeps the two equal. Function `set_booking_status(p_booking_id, p_status, p_description) returns jsonb` changes the status and writes the activity entry in one transaction (`status`: `changed | refused | not_found`). `activity_log` gains `actor` (taken from the caller's JWT, never a parameter) and `action`, and becomes append-only: admins may read and insert, nobody can edit or delete an entry through the API. pgTAP coverage is in `supabase/tests/database/booking_status_flow.test.sql`.

### `20261019152751_booking_access.sql` (entry instructions — backlog B38)
Table `booking_access` (`booking_id uuid pk` FK → bookings **ON DELETE CASCADE**, `instructions text` ≤ 500 chars and never blank, `updated_at`): door codes, gate and pet notes, kept apart from `bookings` so no list, calendar or dashboard query can select them. RLS: admins only, for select/insert/update/delete; anon has no privileges; the service role inserts on the public booking path (and, since the next migration, can do nothing else on this table). Function `set_booking_access(p_booking_id, p_instructions)` (security invoker, checks the admin claim) saves, replaces or, when blank, removes them and appends an activity entry ("Entry instructions added/updated/removed by {email}") that never repeats the text; returns `saved | removed | unchanged | not_found`. Until applied, bookings with entry instructions fail and the detail page shows "couldn't be loaded". Employee visibility waits for the owner's decision on the employee app.

### `20261019162530_verification_cleanup.sql` (verification pass #1)
- **Admin-created bookings use the admin's session, not the service role.** Admin-only INSERT policy on `bookings`, with an insert grant to `authenticated` on only the columns `createBooking` writes, so `status` always starts at `pending` and `submitted_at` can't be backdated. The activity entry already had an admin insert policy and grant (actor = the admin's own email). Admins still have no DELETE on `bookings`.
- **`booking_access`:** the service role keeps only INSERT. The public path's rollback deletes the booking, and the foreign key's cascade removes the access row as the table owner.
- **`booking_status_transition_allowed` moves to a `private` schema** that PostgREST doesn't expose, so nobody can call it over `/rpc`. `authenticated` keeps EXECUTE and USAGE on `private`, because the status trigger and `set_booking_status` are security invoker and call it as the admin; both now have `search_path = public, private`.

Until applied, the admin New Booking form fails with "Something went wrong. Please try again." pgTAP coverage is in `supabase/tests/database/verification_cleanup.test.sql`.

### `20261019225200_half_bathrooms.sql` (backlog B42, data part)
`bookings.bathrooms` changes from `smallint` to `numeric(2,1)`, and `bookings_bathrooms_check` becomes `bathrooms between 1 and 5 and (bathrooms * 2) = trunc(bathrooms * 2)`, so 1, 1.5 … 5 are allowed. Existing rows are whole numbers and stay valid; column grants carry over. `numeric(2,1)` rounds to a tenth before the CHECK, so `createBooking` refuses anything that isn't an exact half step. The app's limits are `BATHROOM_LIMITS` in `lib/constants.ts`. Until applied, a booking with a half-bathroom fails with "Something went wrong. Please try again." pgTAP coverage is in `supabase/tests/database/half_bathrooms.test.sql`.

### `supabase/scripts/003_fix_booking_times_tz.sql` (data backfill — **not** a migration)
A DIAGNOSTIC `SELECT` + a commented-out `UPDATE`. Fixes rows created before the B8 timezone fix, where `new Date(\`${date}T08:00:00\`)` parsed the slot window in the *server's* local zone (a UTC server stored NY 8 AM as 08:00Z, 4–5 h too early). The correction rebuilds `start_at`/`end_at` from `scheduled_date + time_slot` interpreted `AT TIME ZONE 'America/New_York'`. Idempotent; meant to be reviewed and run by hand only if the diagnostic returns rows.

**Types:** `lib/supabase/database.types.ts` is generated (`npm run db:types`); `lib/supabase/types.ts` is the hand-written layer on top of it described above.

---

## 3. Routes & pages (app/)

Root `app/layout.tsx` sets Geist fonts and the `%s | Angels of Clean` title template. `app/error.tsx` is the global error boundary (Try Again / Return Home). `app/page.tsx` is the homepage (backlog B27, Figma HeroSplit `120:3`), a static server page built from `components/home/*`: header (logo, business phone), hero (h1, a trust strip and exactly two paths: "Book a cleaning" → `/residential`, "Get a commercial quote" → `/commercial`), services (the three residential cleanings plus commercial, no prices), service area (towns from `SERVICE_AREA_TOWNS`), how it works, reviews, trust facts, team photos, and a footer with the phone and the Privacy Policy and Terms of Service links. There is no admin link. Reviews, trust facts and team photos all come from `lib/homepage-content.ts`; every entry is still a placeholder and renders with a visible "Placeholder" label (§5).

### Legal (`app/privacy/`, `app/terms/`)
Static server pages sharing `components/legal/LegalPage.tsx` (header with home + Privacy/Terms links, title, effective date). The text describes what the code actually does (fields collected by each flow, `sessionStorage` wizard state, the hashed-IP rate limiter, Supabase + hosting provider, no analytics); keep it in step when data collection changes. Owner-supplied details (legal name, contact email/phone, mailing address, effective date, record retention, cancellation, payment and damage policies) come from `LEGAL_INFO` in `lib/legal.ts`; each missing one renders as a visible "[To be provided: …]" placeholder. While `isLegalDraft()` is true (any value missing, or `reviewed: false`), both pages show a "Draft — not yet in effect" banner and are `noindex, nofollow`. Linked from the homepage, both contact steps (`PrivacyNote`), and both review steps above the submit button (`AgreementNote`, "By selecting {button}, you agree to our Terms of Service…"), all in `components/booking/PolicyNotes.tsx`.

### Customer-facing — Residential (`app/residential/`, 6-step wizard)
Wrapped by `layout.tsx` → `ResidentialShell` (desktop navbar + stepper + live `BookingSummary` sidebar; mobile is a stacked `max-w-sm` column). All steps are `"use client"`, read/write the Zustand store, and guard against deep-linking by `router.replace("/residential")` if prerequisite state is missing. A `?returnTo=review` param makes each step's CTA jump back to Review after editing.

| Route | Step | Purpose |
|-------|------|---------|
| `/residential` | 1 | Service type (standard/deep/moveinout) + frequency. |
| `/residential/address` | 2 | Address/city/ZIP. Validates 5-digit ZIP; on submit, if ZIP ∉ `SERVICE_AREA_ZIPS` → `/residential/error`. |
| `/residential/property` | 3 | Bedrooms stepper (1–5) and bathrooms stepper (1–5 in steps of 0.5, announced as "1.5 bathrooms") + notes + optional entry instructions (door code, gate, pets; sent to `booking_access`, shown on Review). |
| `/residential/datetime` | 4 | Date chips (next ~6 NY days) + morning/afternoon slots. Enforces same-day cutoff via `isNyWallClockInFuture`. Evening slot always disabled; 3rd day hardcoded "Full" (Figma placeholder). |
| `/residential/contact` | 5 | Name/email/phone with regex validation. |
| `/residential/review` | 6 | Summary cards + **calls `submitBooking`** server action; on success → confirmation. Shows "Quote provided after confirmation" (no price). |
| `/residential/confirmation` | — | Success screen. Copies the booking into local state, then clears the store and `sessionStorage` (backlog B50); a reload shows only the `?ref=` number with a privacy note. The Add to Google Calendar link and Apple Calendar `.ics` download work (`lib/calendar-links.ts`); Create Account is a non-functional placeholder. |
| `/residential/error` | — | Out-of-service-area screen; "Try a Different Address" → back to step 2. |

### Customer-facing — Commercial (`app/commercial/`, 4-step quote request)
Wrapped by `layout.tsx` (Suspense). Each step uses the shared `DesktopNavbar` (with the "Commercial Services" tagline) + `DesktopStepper` (desktop, fed `COMMERCIAL_STEP_LABELS`) and `StepHeader`/`ProgressDots` (mobile).

| Route | Step | Purpose |
|-------|------|---------|
| `/commercial` | 1 | Facility type + sqft range + service address/ZIP. Off-area ZIP → `/commercial/error`. |
| `/commercial/services` | 2 | Floors stepper + service-area checkboxes (≥1 required) + notes. |
| `/commercial/contact` | 3 | Contact name, business name, email/phone, frequency, schedule preference. |
| `/commercial/review` | 4 | Summary + **calls `submitCommercialQuote`**; on success → `/commercial/confirmation?ref=COM-…`. A refusal, a failed insert, or a request that never reaches the server shows a "Your request was not sent" alert and stays on the page. |
| `/commercial/confirmation` | — | Success screen; shows the server-issued reference from `?ref=` (redirects to `/commercial` without one). Copies the request into local state, then clears the store and `sessionStorage` (backlog B50); a reload shows only the reference. |
| `/commercial/error` | — | Out-of-area screen with call-to-phone. |

### Admin (`app/admin/`, all under middleware guard)
`layout.tsx` is a server component that calls `connection()` so every admin page renders per request (required for the CSP nonce), then renders `AdminShell.tsx`: the sidebar shell (Dashboard / Calendar / Bookings / Quotes / Employees / Settings) for every route except the auth pages. `AdminShell` reads the display name via a **browser** Supabase client. `loading.tsx` is the skeleton shown inside the shell while a page's data loads (`role="status"`, motion-safe).

| Route | Type | Purpose |
|-------|------|---------|
| `/admin` | server | If already admin → redirect to dashboard; else render `LoginForm` (links to Forgot password). |
| `/admin/forgot-password` | server → client | Public. Email form → `requestPasswordReset`; always shows the same "Check your email" result whether or not the account exists. Shows an expired-link notice with `?error=link`. |
| `/admin/reset-password/confirm` | route handler (GET) | Public. Landing point of the reset email: verifies `token_hash` + `type=recovery` (custom template, any device) or exchanges `code` (Supabase's default template, same browser only), which signs the admin in; then redirects to `/admin/reset-password`, or to `/admin/forgot-password?error=link` on failure. The destination is fixed — any `next` param is ignored. |
| `/admin/reset-password` | server → client | Admin session required (the reset link provides one). New password + confirmation → `updatePassword`, which redirects to the dashboard. |
| `/admin/dashboard` | server | Stat cards (today's bookings, pending, active employees, completed this week) + today's jobs table; each row ends in the client `JobRowActions` (View link, plus one-click Confirm on pending rows). Data from `getDashboardStats` + `getEmployees`. |
| `/admin/calendar` | server → client | `getJobsInRange()` (±2 months) + employees → `CalendarView` (FullCalendar; week view by default, month view, a Today button and a New booking button that opens `NewBookingModal`). An "Unassigned" tray and per-day counts in month cells list jobs still needing a crew (pending, confirmed or active with nobody assigned; backlog B15). |
| `/admin/bookings` | server | Filter tabs (today/upcoming/past/all via `?filter=`); `getJobsByDateFilter` → `BookingsList`. The All Status and All Employees filters are disabled and labelled "Coming soon". |
| `/admin/bookings/[id]` | server | An id that isn't a UUID shows "Booking not found" without querying. Booking detail: details card, status banner, `EntryInstructions` (view/add/edit/remove), `BookingActions` (only the buttons the status flow allows; Reschedule, Send Client Message and Print / Export are disabled and labelled "Coming soon"), activity log. `getJobById` + `getActivityLog` + `getEmployees` + `getBookingAccess` (a failed access lookup affects only its own card). |
| `/admin/employees` | server | Employee cards with derived today-status. `getEmployees` + `getTodayJobs`. View Schedule and Add Employee are disabled and labelled "Coming soon". |
| `/admin/quotes` | server | Commercial quote requests, newest first, one card each: business, contact (mailto/tel links), reference, received time, facility, address, areas, frequency, preference, notes. Read-only. Data from `getCommercialQuotes`. |
| `/admin/settings` | server | Placeholder: Notifications card marked "Coming soon" with both toggles disabled and no Save button, since the app can't send email or SMS yet. |

### API (`app/api/`)
- **`GET /api/admin/jobs`** — requires admin (`requireAdmin`; 401 if signed out, 403 if not admin, 503 if Auth is unreachable). Requires `from`/`to` (YYYY-MM-DD) query params (400 otherwise). Returns `getJobsInRange(from, to)` as JSON, or 503 if the query failed (never an empty list). Consumed by `CalendarView` when the visible range changes.

### Middleware (`middleware.ts`, matcher `/admin/:path*`)
Runs `updateSession` (refreshes the Supabase cookie and verifies the session with `auth.getClaims()`, which checks the JWT signature locally against the project's cached signing key, so a page load costs no Auth round trip). Then for any `/admin/*` route except the public ones (`/admin`, `/admin/forgot-password`, `/admin/reset-password/confirm` — exact matches), redirects to `/admin` unless the verified claims have `app_metadata.role === "admin"`; an admin visiting `/admin` goes on to the dashboard. The Auth call is bounded at 4 s (`lib/supabase/auth-timeout.ts`): if it times out or fails with a network/5xx error the session is `unavailable`, which never grants access, and protected pages (and `/admin` itself) redirect to a "couldn't verify your sign-in" retry screen that is part of the public sign-in page. `getClaims()` does not see a session revoked before its token expires; `requireAdmin` does. This guards **page loads only**; server actions and the API route each re-verify with `requireAdmin`. It also sets the admin `Content-Security-Policy`: a fresh nonce per request with `'strict-dynamic'` and no `'unsafe-inline'` for scripts, put on the forwarded request (Next.js stamps the nonce on its `<script>` tags while rendering) and on the response.

---

## 4. Server actions & data access

### Server actions
| Action | File | Auth | Client | Notes |
|--------|------|------|--------|-------|
| `submitBooking` | `app/actions/submitBooking.ts` | none (public) | service-role | Takes a second `BotCheck` argument (`lib/bot-check.ts`); a filled honeypot, a fill time under 3 s, or a missing/malformed check returns the generic "Something went wrong" error before anything else, with nothing logged. Then validates, then checks the per-IP rate limit (`allowPublicSubmission("booking")`, 5 per hour), then inserts a booking, then any entry instructions into `booking_access` (if that insert fails the booking is deleted again and the customer sees the generic error); logs "Booking submitted by client". |
| `adminCreateBooking` | same file | `requireAdmin` | session-bound | Same shared `createBooking` (never rate-limited), writing through the admin's own session under the admin-only insert policies (never the service role). Refuses entry instructions ("Add entry instructions from the booking's page.": an admin session can't delete a booking, so it couldn't roll back); the admin form has no such field. Actor email from verified session; logs "Booking created by {email}". |
| `submitCommercialQuote` | `app/actions/submitCommercialQuote.ts` | none (public) | service-role | Same `BotCheck` gate as `submitBooking`, first. Validates (payload shape, length caps, and enums derived from the same `lib/constants.ts` lists the form renders), checks the per-IP rate limit (`allowPublicSubmission("quote")`), inserts into `commercial_quotes`, and returns `COM-{quote_number}`. Never returns success unless the row was stored. |
| `updateEntryInstructions` | `app/admin/bookings/[id]/actions.ts` | `requireAdmin` | session-bound | Length check, then `set_booking_access` RPC (write + activity entry in one transaction); revalidates only the detail page. Logs only `{code, correlationId}`. |
| `assignEmployees` | `app/admin/actions.ts` | `requireAdmin` | session-bound | Calls the `assign_booking_employees` RPC with the new crew and the crew the admin saw (`expectedEmployeeIds`), so the whole change is one transaction. Maps its result: `not_found`, `closed` (done/cancelled), `stale` (someone else changed the crew), `conflicts` (overlapping jobs, returned as readable lines until the admin picks "Assign anyway" → `allowOverlap`), `saved` (logs "Assigned … / unassigned …" to the activity log; revalidates admin paths). |
| `updateBookingStatus` | `app/admin/actions.ts` | `requireAdmin` | session-bound | Rejects any target not in `STATUS_ACTIVITY_LABEL`, then calls the `set_booking_status` RPC, which applies the status flow and writes the activity entry in one transaction. Maps `not_found` / `refused` (explains why from the booking's real status and revalidates so the admin sees it) / `changed`. |
| `confirmBooking` | `app/admin/actions.ts` | `requireAdmin` | session-bound | `updateBookingStatus(id, "confirmed")`. Called by the "Confirm Booking" button in `BookingActions` and the per-row "Confirm" button in `dashboard/JobRowActions` (both shown only while pending). |
| `signIn` / `signOut` | `app/admin/auth-actions.ts` | — | session-bound | `signIn` rejects non-admin accounts and signs them back out; redirects to dashboard / `/admin`. |
| `requestPasswordReset` | `app/admin/auth-actions.ts` | none (public) | session-bound | Validates the email, calls `auth.resetPasswordForEmail` with `redirectTo` = `{origin}/admin/reset-password/confirm`. Never reveals whether the account exists; maps Supabase's email rate limit to a readable message; logs only the error code. |
| `updatePassword` | `app/admin/auth-actions.ts` | `requireAdmin` | session-bound | Length check (`PASSWORD_MIN_LENGTH` 8 from `lib/constants.ts`, ≤ 72 bytes for bcrypt), `auth.updateUser({ password })`, readable messages for `same_password` / `weak_password`, then redirects to the dashboard. |

`createBooking` (shared by both booking actions) validates, in order: payload shape (every field the right runtime type), free-text length caps (`FIELD_MAX_LENGTHS` in `lib/constants.ts`, mirrored as `maxLength` on the inputs), service type, frequency, address/city non-empty, 5-digit ZIP, ZIP ∈ `SERVICE_AREA_ZIPS`, bedrooms 1–5, bathrooms 1–5 in half steps (`BATHROOM_LIMITS`), `isValidDateStr`, valid time slot, `isNyWallClockInFuture` (past-date + same-day cutoff), name, email regex, phone regex. Only then converts the slot window to UTC instants via `nyWallClockToInstant` and inserts, with the client each action passes in (service role for `submitBooking`, the admin's session for `adminCreateBooking`). DB errors are logged as `{code, correlationId}` only — never the row — to keep PII out of logs.

### Query helpers (`lib/supabase/queries.ts`, all session-bound `createClient`, RLS-gated to admins)
- `getEmployees()` — roster, `hired_date` formatted in NY.
- `getJobs()` — all bookings (full projection incl. email/phone/notes).
- `getJobsByDateFilter("today"|"upcoming"|"past"|"all")` — pushes the NY-today date filter to Postgres; past sorted desc, else asc. Uses a list projection (`LIST_BOOKING_COLUMNS`) that keeps `email`/`phone` for the client list's search but omits `notes`, which the list never renders, so entry/access notes aren't serialized to the browser.
- `getTodayJobs()` — today's non-cancelled bookings.
- `getJobsInRange(from?, to?)` — calendar; defaults to ±2 months; **slim projection** (`CALENDAR_BOOKING_COLUMNS`) that omits email/phone/notes so contact PII never reaches the calendar surface / API response.
- `getDashboardStats()` — parallel queries: today's jobs, all-pending count, completed-this-week count (Mon–Sun anchored on NY today), employee count.
- `getJobById(id)` / `getActivityLog(bookingId)`.
- `getBookingAccess(bookingId)` — the booking's entry instructions from `booking_access` (`data: null` if none). Called only by the booking detail page; no other helper touches that table.

Rows are mapped to the UI `Job`/`Employee`/`ActivityEntry` shapes from `lib/admin-types.ts`. Every helper returns `QueryResult<T>` — `{ ok: true, data }` or `{ ok: false }` — so a failed query is never reported as an empty result (`getJobById` uses `data: null` for "not found"; `getDashboardStats` fails as a whole if any of its four queries fails). Query errors log only `{code, correlationId}`. Each admin page renders `app/admin/LoadError.tsx` (alert banner + "Try again", which calls `router.refresh()`) in place of its content when any query it depends on fails; `CalendarView` shows its own retry banner when an in-page range fetch fails.

### Supabase clients (`lib/supabase/`)
- **`server.ts` `createClient()`** — `@supabase/ssr` server client bound to the request cookies; acts as the logged-in admin; RLS applies. Used by all query helpers, admin actions, auth actions, and `requireAdmin`.
- **`service.ts` `createServiceRoleClient()`** — service-role client that **bypasses RLS**. Only imported by the two public submit actions (`submitBooking.ts`, used only by `submitBooking`, and `submitCommercialQuote.ts`) and `lib/rate-limit.ts`. Key is server-only.
- **`lib/rate-limit.ts` `allowPublicSubmission(kind)`** — `kind` is `"booking"` or `"quote"`, each with its own allowance. Reads the caller's IP from `x-forwarded-for` (first entry) or `x-real-ip`, HMACs it with the service-role key, and calls the `check_rate_limit` RPC with `SUBMISSION_RATE_LIMIT` (5 per hour) on bucket `{kind}:{hash}`. Fails open (logs `{code, correlationId}`, allows the submission) if the RPC errors or throws; skipped when `NODE_ENV === "development"`.
- **`middleware.ts` `updateSession()`** — refreshes the session cookie and returns `{ supabaseResponse, session }`, where `session` is `signed-in` (with the role claim), `signed-out` or `unavailable`.
- **`require-admin.ts` `requireAdmin()`** — calls `auth.getUser()` (validates the token with Supabase Auth, doesn't trust the cookie, so it also catches a revoked session) under the same 4 s `withAuthTimeout`, and requires `app_metadata.role === "admin"`; returns a discriminated `AdminAuthResult`. Exports `NOT_SIGNED_IN_ERROR` / `NOT_AUTHORIZED_ERROR` / `AUTH_UNAVAILABLE_ERROR` (timeout or network failure: refused with a retry message, never granted).
- **`auth-timeout.ts`** — `withAuthTimeout()` / `AUTH_TIMEOUT_MS` (4 s) and the retry-screen URL helpers `authRetryUrl()` / `isAuthRetryUrl()`. Exists because auth-js retries a failed token refresh for up to 30 s (`docs/PERFORMANCE_DIAGNOSIS.md`, cause 2).

---

## 5. Shared code

- **`lib/constants.ts`** — single source of truth for labels and options: `SERVICE_LABELS`, `FREQUENCY_LABELS`, `TIME_SLOT_WINDOWS` (morning 08:00–12:00, afternoon 12:00–16:00; `TIME_LABELS` derived from it), `PRICE_MAP` (`$85/$149/$199`), `SERVICE_AREA_ZIPS`, and the commercial dictionaries/step labels.
- **`lib/datetime.ts`** — all NY-zone date math via `Intl` (zone-independent, DST-correct): `nyWallClockToInstant`, `isValidDateStr`, `addDaysToDateStr`, `isNyWallClockInFuture`, `nyDateStr`/`nyTodayStr`, `nyWallClockISO` (offset-less ISO for FullCalendar's UTC-coercion mode), and formatters `formatNy`, `formatNyTime`, `formatWallClockTime`, `formatNyTimeRange`, `formatNyDateTime`. Times are always shown with AM/PM (`lib/__tests__/time-format-usage.test.ts` guards against ad-hoc formatting).
- **`store/bookingStore.ts`** — Zustand store persisted to `sessionStorage` (key `booking-store`); holds the full residential + commercial wizard state and `setStep*` / `setCommercial*` / `reset` actions.
- **`lib/admin-types.ts`** — the admin UI shapes `Job`/`Employee`/`ActivityEntry`/`EmployeeStatus` that queries map rows into; `JobStatus` is an alias of the database's `BookingStatus`. `StaffMember` (id, name, initials) with `toStaffMember()`/`toStaffMap()` is what pages pass to client components (`CalendarView`, `BookingsList`, `BookingActions`), so staff phone numbers stay on the server; only the employees page, a server component, shows them.
- **`app/admin/status-config.ts`** — status label/color dictionaries (`STATUS_CONFIG`, `DASHBOARD_STATUS`, `EMPLOYEE_STATUS_CONFIG`). Replaces the old `app/admin/data/mock.ts`, which no longer holds any mock data.
- **`lib/bot-check.ts`** — bot check for the two public submits (backlog B5, no third-party service): `looksLikeBot()` fails a non-empty honeypot (`website`), a fill time under `MIN_FILL_MS` (3 s), or any missing/malformed value. `components/booking/HoneypotField.tsx` is the hidden field on both contact steps (off-screen, `aria-hidden`, `tabIndex -1`). The store's `formStartedAt` is stamped by the first step of either flow (`setStep1` / `setCommercialStep1`, persisted); the review pages send `{ website, elapsedMs }` (measured on the client's clock) with the submit, and send the customer back to step 1 if `formStartedAt` is missing. A script written for this site can still send a valid pair, so the rate limit remains the bound on that.
- **`lib/csp.ts`** — `buildCsp()` and `createNonce()` for the Content-Security-Policy described in §1 and §3 (public pages: static policy from `next.config.ts`; admin pages: per-request nonce from `middleware.ts`).
- **`lib/calendar-links.ts`** — `googleCalendarUrl()` and `buildIcs()` for the residential confirmation page's "Add to Google Calendar" link and "Add to Apple Calendar" `.ics` download.
- **`lib/use-is-client.ts`**, **`components/booking/WhenHydrated.tsx`** — step forms mount only after the persisted booking store has rehydrated, so a refresh keeps saved answers (`__tests__/wizard-guards.test.tsx`).
- **`lib/utils.ts`** — `cn()` (clsx + tailwind-merge).
- **`lib/legal.ts`** — `LEGAL_INFO` (owner-supplied business details and policies for `/privacy` and `/terms`, all `null` until provided), `missingLegalFields()`, `isLegalDraft()`.
- **`lib/homepage-content.ts`** (backlog B27) — all homepage trust content in one file: `HOMEPAGE_REVIEWS`, `HOMEPAGE_TRUST_FACTS` and `HOMEPAGE_TEAM_PHOTOS`, each entry carrying `placeholder: boolean`. Every entry starts as `placeholder: true` with obvious bracketed text ("[Customer review — add real text]") or, for photos, `src: null` (a grey box labelled "Team photo"); the header comment tells the owner how to replace each one (photos go in `public/home/`, then set `placeholder: false`). `listPlaceholders()` and `hasPlaceholders` report what remains; nothing in the build depends on them. It also holds `SERVICE_AREA_TOWNS` (town → ZIPs, real data, order from the Figma frame), which a test keeps equal to `SERVICE_AREA_ZIPS`.
- **Homepage components (`components/home/`)** — `HomeHeader`, `Hero`, `Services`, `ServiceArea`, `HowItWorks`, `Reviews`, `TrustFacts`, `TeamPhotos`, `HomeFooter`, plus `Section` (an `h2`-headed region; the hero holds the page's one `h1`, card headings are `h3`) and `PlaceholderBadge` (the amber "Placeholder" label, same look as the legal pages' placeholders). They use the shared `buttonVariants` and `Card`, the brand tokens and the global focus ring. `HomeHeader` and `HomeFooter` do not reuse `DesktopNavbar` (desktop-only, with a dead Log In button).
- **Booking components (`components/booking/`)** — `ResidentialShell`, `DesktopNavbar` and `DesktopStepper` (one desktop navbar and stepper for both flows; the stepper takes the step labels, the navbar an optional tagline and shows `BUSINESS_PHONE` as a `tel:` link), `Selectable` + `SelectableGroup` (the one selected style for every choice control: solid `bg-primary`, white text, a check mark, on a visually hidden native radio or checkbox; the group gives each rendered copy its own input name because the residential shell renders every step twice), `StepHeader`, `ProgressDots`, `BottomCTA`, `BookingSummary`, plus the shared failure and notice pieces `SubmitErrorAlert`, `ServiceUnavailable`, `DateExpiredNotice` and `ConfirmedWithoutDetails`. `BookingSummary` re-declares its own label maps rather than importing `lib/constants`.
- **UI primitives (`components/ui/`)** — shadcn `button`, `card`, `input`, `label`, `textarea`. The default `Button` variant is brand teal (`bg-primary`, hover `bg-primary-pressed`).
- **Brand color and focus ring (`app/globals.css`, backlog B21 / B25)** — the brand teal is one token: `--primary` (#1A6B5A) and `--primary-pressed` (#124D41), exposed to Tailwind as `bg-primary`, `text-primary`, `border-primary` and `hover:bg-primary-pressed`. No hex or `teal-*` class appears outside `globals.css`; tints are `bg-primary/5` and `border-primary/20`. Non-brand colors (status chips in `status-config.ts`, error red, amber, greys, the admin sidebar and calendar greens) stay as they are. One `:focus-visible` rule (2px `--primary-pressed`, 2px offset, outside any `@layer` so it beats `outline-none`) is the only focus style: components don't add `focus:ring-*` or `outline-none`. Special cases, all in `globals.css`: it is restated under `.admin-calendar` because FullCalendar sets its own outline; a visually hidden (`sr-only`) checkbox or radio rings its `label`; `[data-focus-surface="dark"]` (the admin sidebar) takes a white ring; `tabindex="-1"` non-form elements get no ring; and `html:has([data-bottom-cta])` adds `scroll-padding-bottom: 6rem` so the sticky `BottomCTA` never covers the focused element (WCAG 2.4.11). Don't write the `:has()` selector with a leading `>`: the build drops it.

---

## 6. Tests

`vitest run` runs under `TZ=UTC`. Files:
- **`lib/__tests__/datetime.test.ts`** — NY conversion, both DST boundaries, `isValidDateStr`, `addDaysToDateStr`, same-day cutoff, formatters. ✅ passing.
- **`lib/__tests__/constants.test.ts`** — label maps, `TIME_SLOT_WINDOWS`, `PRICE_MAP`, `SERVICE_AREA_ZIPS` (each town pinned to its ZIPs, plus an exact-set check). ✅ passing.
- **`app/actions/__tests__/submitCommercialQuote.test.ts`** — stored row shape and `COM-` reference, every option the form offers is accepted, validation matrix, length caps, malformed payloads, no success on a failed insert, PII-safe logging, rate limiting. ✅ passing.
- **`app/admin/__tests__/auth-actions.test.ts`** — reset request (redirect target, no-origin fallback, invalid input, rate-limit message, PII-safe logging) and password update (admin session required, length limits incl. bcrypt's 72 bytes, Supabase error mapping, redirect). ✅ passing.
- **`app/admin/reset-password/confirm/__tests__/route.test.ts`** — token-hash and code paths, expired/failed links, non-recovery tokens refused, `next` ignored. ✅ passing.
- **`__tests__/middleware.test.ts`** — public admin routes reachable signed out (exact match only), everything else requires the admin role; an unavailable Auth sends protected pages and `/admin` to the retry screen. ✅ passing.
- **`components/booking/__tests__/Selectable.test.tsx`**, **`DesktopChrome.test.tsx`** and **`__tests__/shared-booking-controls.test.tsx`** — the shared choice control (native radio/checkbox semantics, check mark, solid fill), the shared navbar and stepper in both flows, the selected state on every choice step, and the same least-to-most frequency order in both flows. ✅ passing.
- **`components/booking/__tests__/ProgressDots.test.tsx`** — dot labels (completed / current / plain) and a single `aria-current="step"`. ✅ passing.
- **`app/admin/__tests__/status-contrast.test.ts`** — every status chip and banner text/background pair in `status-config.ts` meets WCAG AA 4.5:1. ✅ passing.
- **`app/admin/settings/__tests__/page.test.tsx`** — notifications are labeled "Coming soon" with an explanation, every toggle is disabled and off, and there is no Save button. ✅ passing.
- **`__tests__/legal-pages.test.tsx`** — draft logic (missing/blank values, `reviewed`), both pages render with the banner and placeholders, a filled-in and reviewed `LEGAL_INFO` drops them and links email/phone, the policy notes link to the right pages, and the residential contact step no longer claims "we never share your data". ✅ passing.
- **`__tests__/confirmation-privacy.test.tsx`** — both confirmation pages show the details, then clear them from the store and `sessionStorage`; reloads show only the reference; no reference redirects. ✅ passing.
- **`lib/__tests__/rate-limit.test.ts`** — limit/window passed to the RPC, refusal, raw IP never sent, bucket stability, header precedence, fail-open on error and on throw, dev skip. ✅ passing.
- **`app/actions/__tests__/submitBooking.test.ts`** — validation matrix (run against both `submitBooking` and `adminCreateBooking`), success insert, window→UTC storage, DST offsets, PII-safe logging, admin auth gating; the admin path writes through the session and never creates a service-role client (the public path still does), and refuses entry instructions. ✅ passing.
- **`app/admin/__tests__/actions.test.ts`** — `assignEmployees`/`confirmBooking`/`updateBookingStatus`: auth gating, each RPC result (`saved`, `conflicts`, `stale`, `closed`, `refused`, `not_found`) mapped to the right message, an unknown status target refused before any query, activity logging, revalidation. ✅ passing.
- **`lib/supabase/__tests__/queries.test.ts`** — asserts the calendar projection omits email/phone/notes; `getJobsByDateFilter` (client list) keeps email/phone for search but omits notes; `getJobs` keeps all contact fields; PII-safe error logging; every helper returns `{ ok: false }` on a database error and an empty/`null` result only when there genuinely is none; no list, calendar, dashboard or `getJobById` query reads or embeds `booking_access`, and `getBookingAccess` reads only `instructions` for one booking. ✅ passing.
- **`__tests__/entry-instructions-flow.test.tsx`**, **`app/admin/bookings/[id]/__tests__/actions.test.ts`**, **`EntryInstructions.test.tsx`** and the entry-instruction cases in `submitBooking.test.ts` — B38: the property-step field (label, hint, limit, no autocomplete/spell-check), stored apart from notes, shown on Review and sent with the booking but never in a URL; stored only in `booking_access`, rolled back with the booking on failure, never logged; admin edit auth, trim, length, RPC results. ✅ passing.
- **`supabase/tests/database/booking_access.test.sql`** (pgTAP, `npx supabase test db` on the local stack) — admin read/add/change/remove, activity entries without the text, non-admin/`user_metadata`/anon refused, service-role insert, cascade on delete.
- **`supabase/tests/database/verification_cleanup.test.sql`** (pgTAP) — an admin session can create a booking (always pending) and its activity entry, but can't set the status, backdate it or delete it; non-admin/`user_metadata`/anon refused; the service role can only insert entry instructions, and the public rollback leaves no orphan; `booking_status_transition_allowed` is out of `public`, and the trigger and `set_booking_status` still work.
- **`app/api/admin/jobs/__tests__/route.test.ts`** — 200 with jobs, 200 with an empty range, 503 on query failure, 401 / 403 / 503 (Auth unreachable) without querying. ✅ passing.
- **`app/admin/__tests__/staff-props.test.tsx`** — the calendar, bookings list and booking detail pages pass client components staff without phone numbers. **`app/admin/bookings/__tests__/BookingsList.test.tsx`** — the two filters are disabled and say "Coming soon". **`app/admin/bookings/[id]/__tests__/page.test.tsx`** — a malformed id shows "not found" without querying; a failed lookup still shows "couldn't load". ✅ passing.
- **`lib/supabase/__tests__/require-admin.test.ts`** — signed-out, token error, no-role, `user_metadata` ignored, admin accepted. ✅ passing.
- **`store/__tests__/bookingStore.test.ts`** — defaults, each setter, reset. ✅ passing.
- **Admin status flow:** `app/admin/__tests__/status-flow.test.ts` (the allowed-transition list pair by pair; `STATUS_TRANSITIONS` equals the one in the migration), `status-buttons.test.tsx` and `app/admin/bookings/[id]/__tests__/BookingActions.test.tsx` (which buttons each status shows; unbuilt buttons say "Coming soon"). ✅ passing.
- **Admin pages:** `app/admin/__tests__/page.test.tsx` (sign-in page makes no second auth call), `loading.test.tsx` (skeleton is a labelled status region), `app/admin/calendar/__tests__/unassigned.test.tsx` (unassigned tray and counts), `app/admin/employees/__tests__/page.test.tsx` (unbuilt buttons disabled and labelled). ✅ passing.
- **Auth timeouts:** `lib/supabase/__tests__/auth-timeout.test.ts`, `middleware.test.ts` and `middleware-expired-session.test.ts` (the real Supabase client against an expired token: the call is bounded, never grants access). ✅ passing.
- **Customer flow:** `__tests__/wizard-guards.test.tsx` (steps redirect when earlier answers are missing, and wait for the store to rehydrate), `__tests__/review-submit-errors.test.tsx` and `components/booking/__tests__/submit-failure.test.tsx` (failed or unreachable submits show the alert and stay put). ✅ passing.
- **Shared libs:** `lib/__tests__/csp.test.ts`, `calendar-links.test.ts`, `time-format-usage.test.ts` (no ad-hoc time formatters outside `lib/datetime.ts`), and `lib/supabase/__tests__/types.test.ts` (type-level checks, enforced by `tsc --noEmit`). ✅ passing.
- **Brand token and focus ring:** `lib/__tests__/brand-token-usage.test.ts` (no `#1a6b5a`, `#124d41`, `#155a4b` or `teal-*` outside `globals.css`; `--primary` / `--primary-pressed` are defined and exposed to Tailwind) and `lib/__tests__/focus-ring.test.ts` (the `:focus-visible` rule, its calendar, hidden-input and dark-surface variants, the bottom-CTA scroll padding, and no per-component `focus:ring-*` / `outline-none`). ✅ passing.
- **Database files:** `supabase/__tests__/migrations.test.ts` (naming, unique versions, applied migrations pinned and first, no loose `.sql`), `supabase/__tests__/field-lengths.test.ts` (SQL length CHECKs equal `FIELD_MAX_LENGTHS`). The pgTAP files in `supabase/tests/database/` (`booking_status_flow.test.sql`, `booking_access.test.sql`, `verification_cleanup.test.sql`, `half_bathrooms.test.sql`) are **not** part of `npm test` or CI; they need the local Supabase stack (`npx supabase test db`).

- **Homepage (B27):** `__tests__/homepage.test.tsx` (one `h1` and no skipped heading level, exactly the two booking paths, a header, one `main` and a footer with the privacy and terms links, the `tel:` link and no `/admin` link, every service-area town, no prices, a visible "Placeholder" badge for every placeholder, labelled team photos, every section named by its heading) and `lib/__tests__/homepage-content.test.ts` (prints which placeholders remain without failing; an entry still marked placeholder is obviously fake; an entry marked real has no bracketed text left and a valid `/home/…` image path; `SERVICE_AREA_TOWNS` equals `SERVICE_AREA_ZIPS`). ✅ passing.

- **`lib/__tests__/bot-check.test.ts`**, **`__tests__/bot-check-flow.test.tsx`** and the bot-check cases in both action tests — filled honeypot, too fast, normal, malformed checks, identical generic error, nothing logged; the honeypot's accessibility (aria-hidden, tabIndex -1, off-screen not display:none); contact steps store it; review pages send it; the store's fill-time clock. ✅ passing.

- **Half-bathrooms (B42):** `__tests__/half-bathrooms.test.tsx` (the bathrooms stepper goes 1, 1.5 … 5 and announces "1.5 bathrooms", stops at both ends and saves 2.5; bedrooms stay whole; Review and the confirmation show "2.5 Bathrooms" and keep "1 Bathroom" singular; Review and the admin New Booking form send 2.5, and the form offers every half step), the bathroom cases in `submitBooking.test.ts` (half steps accepted and stored, out of range and non-half values like 1.49 refused before the insert, NaN/Infinity refused as malformed), `formatBathroomCount` / `BATHROOM_LIMITS` / `BATHROOM_OPTIONS` in `constants.test.ts`, and the admin detail/list text in `queries.test.ts`. pgTAP: `supabase/tests/database/half_bathrooms.test.sql` (column type, CHECK validated, every half step accepted, 0/0.5/5.5/1.3/2.7/1.25 refused, 10 overflows). ✅ passing (pgTAP not run in CI).

### Current test status: 780 passing (54 of 54 files green)
Passes under both `TZ=UTC` and `TZ=America/Los_Angeles`; `tsc --noEmit` clean. CI runs lint, `tsc`, tests and a build on every pull request (§1).

**History — the B16 ZIP swap.** Commit `fe85cd2` meant to change Camillus from `13035` (actually Cazenovia) to `13031`, but edited the Cicero line instead (`13039` → `13031`), which rejected Cicero customers and turned 26 tests red. Corrected 2026-10-13: Cicero is `13039`, Camillus is `13031`, and `13035` is no longer served.

---

## 7. Notable findings (report-only; no code changed)

1. **CI exists, but only a branch-protection rule makes it a gate.** `ci.yml` runs on every PR and every push to `v2` (§1). The suite once sat red for three weeks after the mis-applied ZIP swap (§6); a required `verify` check on `v2` (a GitHub setting, not a file) is what stops that from happening again.
2. **Admin password reset email is in demo mode (deferred).** There is no domain yet (school project), so there is no custom SMTP: reset emails come from Supabase's built-in sender (a few per hour, best effort) with the default template, and the link only works in the browser that requested it. Revisit once a domain exists: custom SMTP, then the `token_hash` template described under backlog B31. No code change is needed.
3. **Commercial quotes need the `commercial_quotes` migration applied.** The flow is wired end to end (backlog B3); until `20261013230608_commercial_quotes.sql` is applied, every submission fails with "Something went wrong. Please try again." Admins see leads only on `/admin/quotes`; there is no email notification and no way to mark a lead as handled yet (the `updated_at` column is ready for one).
4. **Conflicting prices.** `app/residential/page.tsx` advertises "From $120 / $200 / $250" while `PRICE_MAP` in constants is `$85 / $149 / $199`. (Backlog B28.)
5. **The original backend plan was never built** — it described Prisma + Vercel/Neon Postgres + Auth.js/NextAuth + Zod + Resend/Twilio. The app actually uses Supabase (Postgres + Auth) with generated database types and no ORM/email/SMS. The plan is archived locally at `docs/archive/BACKEND_PLAN.md` (untracked) with a banner saying so (backlog B51).
6. **Fake availability & dead controls.** The datetime step hardcodes the 3rd offered day as "Full" (`isFull: i === 2`, a Figma placeholder). Admin buttons that are not built are disabled and labelled "Coming soon" (Reschedule, Send Client Message, Print / Export, Add Employee, View Schedule, and the bookings list's All Status / All Employees filters). On the residential confirmation page the calendar buttons now work (Google Calendar link, `.ics` download); Create Account is still a non-functional placeholder.
7. **Settings are a placeholder** — `/admin/settings` shows email/SMS notification toggles disabled and labeled "Coming soon" (backlog B49). Building them needs outbound email/SMS first.
8. Backlog work is tracked as **B1–B52** in `docs/BACKLOG.md`; recent commits (B5/B12/B14/B15/B30/B43/B47 and earlier) reference those IDs. Design rationale lives in `docs/DECISIONS.md`; Figma mapping in `docs/FIGMA_MAP.md`.

---

## Run / build / test

```bash
npm ci               # install (CI and worktrees use this)
npm run dev          # dev server on localhost:3000
npm run build        # production build
npm start            # serve production build
npm run lint         # ESLint
npx tsc --noEmit     # type-check
npm test             # Vitest (run mode; TZ=UTC by default)
npm run db:types     # regenerate lib/supabase/database.types.ts after a schema change
```

Requires `.env.local` with the three Supabase keys (§1). The database comes from the migrations in `supabase/migrations/`, applied by the owner with `npx supabase db push` (never from a coding session), followed by `npm run db:types`. An admin account must be granted `app_metadata.role = 'admin'` (SQL in the README and in the header of `20260918194509_admin_role_rls.sql`) before the admin panel is usable. See the README for the full Supabase CLI, CI and worktree workflow.
