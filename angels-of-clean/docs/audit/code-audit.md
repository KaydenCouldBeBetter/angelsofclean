# Production Readiness Audit — Angels of Clean

Date: 2026-09-18 · Scope: `angels-of-clean/` app code, schema, and middleware. Findings only; nothing was changed.
Paths are relative to `angels-of-clean/`.

One positive note up front: payment handling is a non-issue — no card data is collected anywhere (pricing is quote-based by design, per `docs/PROJECT_MAP.md`), and `.env.local` is gitignored and not tracked, so no secrets are committed.

---

## Critical

### C1. `adminCreateBooking` is a publicly callable server action with the service-role client and no auth check
**Evidence:** `app/actions/submitBooking.ts:138-220` — the function is exported from a `"use server"` file, never calls `auth.getUser()`, and writes via `createServiceRoleClient()` (`lib/supabase/service.ts:8`, whose own comment says it should only be imported by `submitBooking`). `adminEmail` is a plain caller-supplied string logged to `activity_log` (line 212).
**Why it matters:** Next.js server actions are public POST endpoints. Anyone on the internet can invoke this without logging in, bypassing RLS entirely, and forge audit-log entries like "Booking created by owner@angelsofclean.com". The middleware only guards `/admin` page routes, not this action.
**Suggested fix:** Inside the action, create the session-bound client, call `auth.getUser()`, and reject if there is no user; derive `adminEmail` from the session instead of accepting it as a parameter.

### C2. No admin role — any authenticated Supabase user gets full access to all customer PII
**Evidence:** RLS policies grant access on `auth.role() = 'authenticated'` alone (`supabase/001_initial_schema.sql:63-77`); `app/api/admin/jobs/route.ts:10` and the admin server actions (`app/admin/actions.ts:43-99`) likewise check only that *a* user exists, not that they are an admin. Nothing in the codebase distinguishes admin from employee or future client accounts.
**Why it matters:** Bookings contain names, home addresses, phones, and free-text notes (which customers will use for door codes and alarm instructions). If Supabase's default self-signup is enabled on the project — the anon key is public by design — anyone can create an account and read every booking. This also blocks the planned employee and client logins: the moment those exist, they inherit full admin data access. **Needs verification:** whether email signups are enabled in the Supabase dashboard (not determinable from code).
**Suggested fix:** Disable public signups now; add a role claim (e.g., `app_metadata.role = 'admin'`) and rewrite RLS policies and server-side checks against it before adding any other user type.

### C3. All commercial quote submissions fail validation, and even valid ones are silently discarded
**Evidence:** `app/actions/submitCommercialQuote.ts:28-30` validates against `["small","medium","large","enterprise"]` and `["office","retail","medical","warehouse/shop","other"]`, but the form actually sends sqft values `"<1k"|"1k-2k"|"2k-5k"|"5k+"` and facility types including `"school"`/`"restaurant"` (`lib/constants.ts:52-73`); frequencies `"daily"`/`"2-3x"` (`lib/constants.ts:91-101`) are also rejected. If validation somehow passed, line 84 is a `setTimeout` stub — no DB insert — yet the customer is shown a quote reference (`CQR-…`, line 86-88) and a confirmation page.
**Why it matters:** Every commercial lead either hits a confusing validation error or believes a quote was requested when the business never received anything. That is silent, unrecoverable lead loss.
**Suggested fix:** Align the validation enums with `lib/constants.ts` / the store types, and persist quotes to a table (plus notification) before launch — or remove the commercial flow until it works.

### C4. Booking times are computed in the server's local time zone, not America/New_York
**Evidence:** `app/actions/submitBooking.ts:89-90` — `new Date(\`${data.date}T09:00:00\`)` parses in the server's local zone before `.toISOString()`. Same pattern at lines 178-179. `localDateStr()` (`lib/supabase/queries.ts:193-196`) similarly uses server-local "today" for dashboard/bookings/employees filters.
**Why it matters:** On any UTC-hosted deployment (Vercel default), a 9:00 AM Syracuse booking is stored as 09:00 UTC = 4/5 AM Eastern. The admin calendar shows wrong times, "today's jobs" flips to the wrong day after 7/8 PM Eastern, and DST transitions shift every stored slot by an hour. This corrupts the schedule the whole business runs on.
**Suggested fix:** Compute `start_at`/`end_at` explicitly in `America/New_York` (e.g., a small tz-aware helper or a library), and derive "today" in that zone everywhere; add a test pinned to a non-Eastern TZ.

---

## High

### H1. No availability check anywhere — double-booking is guaranteed, and the shown availability is fake
**Evidence:** `submitBooking` inserts unconditionally with no query for existing bookings in the slot (`app/actions/submitBooking.ts:92-114`). The date picker hardcodes the third day as "Full" — `isFull: i === 2, // 3rd day marked as "Full" per Figma` (`app/residential/datetime/page.tsx:32`) — offers only the next 6 days, and the desktop month-navigation arrows do nothing (`page.tsx:76-78`).
**Why it matters:** Unlimited customers can book the same slot while a genuinely free day is shown as "Full". Real capacity is invented by the UI, not the database — the core promise of a booking system is broken.
**Suggested fix:** Query real slot capacity to drive the picker, and enforce it server-side at insert time (capacity check inside a transaction, or a DB constraint/RPC) so two simultaneous submissions can't both succeed.

### H2. Server accepts any date, including past dates
**Evidence:** `app/actions/submitBooking.ts:68-70` — the only date validation is non-empty; no format, past-date, or horizon check before it becomes `scheduled_date`/`start_at`. A malformed date string also produces `Invalid Date` → `toISOString()` throws an unhandled exception (line 110).
**Why it matters:** A tampered or buggy request creates bookings for yesterday or 2031, polluting the calendar; a malformed date crashes the action with an opaque 500 instead of a validation message.
**Suggested fix:** Validate `YYYY-MM-DD` format and enforce a bookable window (e.g., tomorrow through +60 days, business timezone) server-side.

### H3. Employees can be assigned to overlapping jobs; assignment save is non-atomic
**Evidence:** `app/admin/actions.ts:49-68` — `assignEmployees` deletes all rows then inserts the new set with no check that the employee is free at the booking's time; if the insert fails after the delete succeeds, the booking is left silently unassigned. The picker UI (`app/admin/bookings/[id]/BookingActions.tsx:65-92`) shows no conflict information either.
**Why it matters:** An admin can schedule the same cleaner on two 9 AM jobs across town with no warning, and a transient DB error can strip a job's crew the day before service.
**Suggested fix:** Check for overlapping assignments (`booking_employees` joined to `bookings` on time range) and warn/block; perform delete+insert in a single RPC/transaction or use an upsert-and-prune approach.

### H4. Customer-facing time windows don't match what is stored and scheduled
**Evidence:** UI promises Morning "8:00 AM–12:00 PM" and Afternoon "12:00 PM–4:00 PM" (`app/residential/datetime/page.tsx:12-13`, `lib/constants.ts:26-29`), but the server stores 09:00–11:00 and 13:00–15:00 (`app/actions/submitBooking.ts:37-40`).
**Why it matters:** A customer told "8 AM–12 PM" whose job the admin calendar shows at 9:00–11:00 will experience missed arrivals in both directions. Compounded by C4, the stored numbers are wrong twice.
**Suggested fix:** Pick one definition of each slot, put it in a single shared constant, and use it for both display and storage.

### H5. No confirmation email/SMS, and no way for a customer to cancel or reschedule
**Evidence:** `submitBooking` returns only an on-screen ref (`app/actions/submitBooking.ts:130-134`); Resend/Twilio are "Planned" (`docs/PROJECT_MAP.md:133-134`). Admin-side "Reschedule", "Send Client Message", and "Print / Export" buttons have no handlers (`app/admin/bookings/[id]/BookingActions.tsx:103-105, 123-127`). No client portal exists.
**Why it matters:** If the customer closes the tab, `AOC-1042` on screen is their only artifact — no record, no reminder, no cancellation path except phoning. Dead buttons in the admin UI look functional and will be clicked during real operations. This is the "booking saved but confirmation fails" scenario made permanent: confirmation always fails.
**Suggested fix:** Wire Resend for booking confirmation and cancellation emails before launch; remove or clearly disable the dead admin buttons; treat email failure as retryable (log it against the booking), not silent.

### H6. Public booking endpoint has no rate limiting or abuse protection
**Evidence:** `submitBooking` (`app/actions/submitBooking.ts:42`) is unauthenticated by design and inserts via service-role with no rate limit, CAPTCHA, or dedupe.
**Why it matters:** A script can flood the bookings table with plausible-looking fake jobs (all validation is satisfiable), burying real jobs and making the calendar unusable; combined with H1 there is no capacity ceiling to stop it.
**Suggested fix:** Add per-IP rate limiting (middleware or Vercel WAF) and a lightweight bot check on the residential flow; consider a soft duplicate check on email+date.

---

## Medium

### M1. All admin queries swallow errors and render as "no data"
**Evidence:** every query returns `[]`/`null` on error with only a `console.error` (`lib/supabase/queries.ts:20-23, 88-93, 125-128, 147-150, 183-186, 271-274`).
**Why it matters:** During a Supabase outage the dashboard shows zero jobs today — an admin may believe the day is empty rather than that the system is down. Wrong-but-confident data is worse than an error page.
**Suggested fix:** Distinguish "empty" from "failed" in the return type and surface an error banner in the admin UI.

### M2. Activity-log and status flows have integrity gaps
**Evidence:** `updateBookingStatus` accepts any status with no transition rules (`app/admin/actions.ts:79-99`) — a cancelled booking can be re-marked pending/confirmed with stale employee assignments intact; activity-log insert failures are ignored (`app/admin/actions.ts:37-41`, `app/actions/submitBooking.ts:126-128`), and the audit trail lives in a free-text `description` column with no actor/action fields (`supabase/001_initial_schema.sql:48-53`).
**Why it matters:** The audit trail is best-effort and unparseable, and illegal status jumps can quietly resurrect cancelled jobs onto the calendar.
**Suggested fix:** Validate allowed status transitions server-side; add `actor` and `action` columns to `activity_log`.

### M3. Supabase error objects are logged and may include row data (PII)
**Evidence:** `console.error("submitBooking: insert failed", insertError)` (`app/actions/submitBooking.ts:117`) and equivalents throughout `queries.ts` — PostgREST error `details`/`message` can echo constraint values from the failing row (e.g., a phone or address that violated a check).
**Why it matters:** Production logs (Vercel) would retain customer PII outside the database's access controls.
**Suggested fix:** Log only `error.code` and a request correlation id, not the full error object, on insert paths.

### M4. Validation duplication between `submitBooking` and `adminCreateBooking`
**Evidence:** ~70 lines of validation and insert logic are copy-pasted (`app/actions/submitBooking.ts:44-135` vs `143-220`).
**Why it matters:** Flagged because it directly endangers the fixes above — a timezone or availability fix applied to one path and not the other reintroduces C4/H1 through the admin modal.
**Suggested fix:** Extract one validate+insert function; the two exports differ only in auth check and activity-log message.

### M5. Employee app does not exist, though operations depend on it
**Evidence:** all 21 employee frames are `NOT IMPLEMENTED` (`docs/FIGMA_MAP.md:39-61`, incl. offline states `433:274`, `467:274`); no employee auth exists (`FIGMA_MAP.md:87` — Employee Sign In `120:922` NOT IMPLEMENTED).
**Why it matters:** Scoping, not a bug — but "employees see and update jobs" (CLAUDE.md) is currently impossible, and offline behavior can't be audited because there is no employee surface. Launch plan should assume dispatch by phone/text.
**Suggested fix:** Decide explicitly whether launch includes the employee app; if yes, C2's role model is a prerequisite.

---

## Low

### L1. Settings page fakes persistence
**Evidence:** `app/admin/settings/page.tsx` ends in `alert("Settings saved")` with no storage (`docs/PROJECT_MAP.md:154`).
**Why it matters:** An admin who "changes business hours" will believe it took effect.
**Suggested fix:** Hide the page or label it non-functional until backed by data.

### L2. Customer PII persisted in `sessionStorage` during the booking flow
**Evidence:** `store/bookingStore.ts:131-155` — zustand `persist` to `sessionStorage` includes address, phone, and notes.
**Why it matters:** Low risk (cleared on tab close), but door-code notes linger on shared/public computers for the tab's lifetime.
**Suggested fix:** Clear the store on confirmation; acceptable otherwise.

### L3. Stale planning docs and mock-data module in production paths
**Evidence:** `BACKEND_PLAN.md` describes a Prisma/Auth.js stack that was never built (`docs/PROJECT_MAP.md:159`); admin types are still imported from `app/admin/data/mock.ts` (`lib/supabase/queries.ts:2`).
**Why it matters:** Misleads future contributors; the mock import is types-only today but invites accidental use of mock data.
**Suggested fix:** Delete or archive `BACKEND_PLAN.md`; move `Job`/`Employee` types out of `data/mock.ts`.

---

## Top 5 to fix before launch

1. **C1** — Add an auth check to `adminCreateBooking` (public service-role write path).
2. **C2** — Disable public Supabase signups and introduce a real admin role in RLS and server checks.
3. **C4 + H4** — Store booking times correctly in America/New_York and make displayed slot windows match stored ones.
4. **H1 + H2** — Replace fake availability with real capacity: server-side slot validation, past-date rejection, and a race-safe insert.
5. **C3** — Fix or remove the commercial quote flow (validation enums mismatch every real submission, and nothing is saved).

---

## Second pass (xhigh)

Date: 2026-09-18 · Deeper verification pass over the same scope. First-pass IDs (C/H/M/L) retained; new findings are numbered S1+. Paths relative to `angels-of-clean/`.

### Verification of first-pass Critical/High findings

- **C1 — Confirmed.** `adminCreateBooking` lives in the `"use server"` module (`app/actions/submitBooking.ts:1, 138-141`), contains no auth call (the file's only client is service-role, line 181), and logs caller-supplied `adminEmail` verbatim (`:210-213`). The middleware matcher `["/admin/:path*"]` (`middleware.ts:19-21`) does not protect it — server actions are public endpoints invocable by POSTing the action ID to any route, and the JS chunks embedding those IDs are served from `/_next/static`, which the matcher never covers. Note the legitimate UI already round-trips the admin email through the browser (`app/admin/bookings/page.tsx:160-162` → `app/admin/NewBookingModal.tsx:94-97`), so even the honest path is client-forgeable.

- **C2 — Confirmed** (the Supabase dashboard signup setting remains **Needs verification** — not determinable from code). RLS grants on `auth.role() = 'authenticated'` alone (`supabase/001_initial_schema.sql:63-77`); `app/api/admin/jobs/route.ts:8-12` checks only that *some* user exists. Stronger than first pass stated: `assignEmployees` and `updateBookingStatus` perform **no authorization check at all** — the only `auth.getUser()` in `app/admin/actions.ts` (`:33-36`) merely decorates the activity-log message.

- **C3 — Confirmed outcome; mechanism corrected.** The enum mismatch is real (`app/actions/submitCommercialQuote.ts:28-30` expects `"small"`/`"warehouse/shop"` etc. vs. the actual form values `"<1k"…"5k+"`, `"school"`, `"restaurant"`, `"daily"`, `"2-3x"` — `lib/constants.ts:52-101`, `store/bookingStore.ts:10-30`) but it is **unreachable dead code**: repo-wide grep shows `submitCommercialQuote` is imported by no other file. The review page's `handleSubmit` only navigates (`app/commercial/review/page.tsx:42-46`), and the confirmation page fabricates a reference `COM-{year}-{random}` client-side (`app/commercial/confirmation/page.tsx:16-20, 25`) while promising follow-up "within one business day" (`:86-88`). So no commercial submission ever leaves the browser — there is no validation error to hit; every lead is silently discarded behind a success screen. Severity unchanged (Critical). First-pass detail error: the action's `CQR-…` ref is never displayed anywhere.

- **C4 — Confirmed.** Server-local parsing at `app/actions/submitBooking.ts:88-90` and `:177-179`; server-local "today" in `localDateStr()` (`lib/supabase/queries.ts:193-196`) and the dashboard week window (`:210-220`). Compounding effect found: the admin calendar renders events in the *viewer's browser* timezone with `slotMinTime="07:00:00"` (`app/admin/calendar/CalendarView.tsx:172`), so a morning booking stored as 09:00 UTC renders at 4–5 AM Eastern — before the grid starts, i.e. effectively invisible on the week view.

- **H1 — Confirmed.** No capacity/availability query in the insert path (`app/actions/submitBooking.ts:92-114`); hardcoded "Full" day (`app/residential/datetime/page.tsx:32`), 6-day window (`:22`), dead month arrows (`:76-78`).

- **H2 — Confirmed.** Only a truthiness check on `date` (`app/actions/submitBooking.ts:68-70`); a malformed string produces `Invalid Date`, and `.toISOString()` throws unhandled (`:110-111`, same at `:199-200`). See also S2 — the UI itself offers a bookable "today" with no cutoff.

- **H3 — Confirmed.** Non-atomic delete-then-insert, no overlap check (`app/admin/actions.ts:49-68`); the picker is plain checkboxes with no conflict info (`app/admin/bookings/[id]/BookingActions.tsx:66-92`).

- **H4 — Confirmed, and worse.** Customer sees 8–12 / 12–4 (`app/residential/datetime/page.tsx:12-13`, `lib/constants.ts:26-29`); the DB stores 9–11 / 1–3 (`app/actions/submitBooking.ts:37-40`); and the admin's New Booking modal shows those stored windows as its labels (`app/admin/NewBookingModal.tsx:24-27`) — so admin and customer are told **different windows for the same slot value**.

- **H5 — Confirmed.** No notification code exists anywhere; dead admin buttons at `app/admin/bookings/[id]/BookingActions.tsx:103-105` (Reschedule) and `:123-128` (Send Client Message, Print/Export). The customer confirmation explicitly claims "We'll send a confirmation to {email}" (`app/residential/confirmation/page.tsx:51-53`, `:106-108`) — false today.

- **H6 — Confirmed.** No rate limiting, CAPTCHA, or dedupe anywhere (`middleware.ts` does auth redirects only; no WAF/vercel config in repo). Additional exposure: no maximum length on any text field (`app/actions/submitBooking.ts:44-86` checks format/nonempty only), so a flood can also carry multi-megabyte `notes`/`address` values.

### New findings

**S1 · High — Every admin-facing timestamp is rendered in the server's timezone, independently of the storage bug (C4)**
Evidence: `app/admin/bookings/page.tsx:36-42` (`getHours()` on the server; also omits AM/PM — "9:00–11:00" is ambiguous), `app/admin/dashboard/page.tsx:7-12` (same, renders midnight as "0:xx"), `app/admin/bookings/[id]/page.tsx:15-22`, activity-log timestamps `lib/supabase/queries.ts:292-299` (`toLocaleString` with no `timeZone`).
Why it matters: fixing C4's storage alone is not enough — on a UTC host, every time an admin sees (dashboard, list, detail, activity log) is still shifted 4–5 hours, and crews get dispatched off a wrong schedule. FullCalendar separately renders in the viewer's browser TZ (no `timeZone` prop, `CalendarView.tsx:145-186`).
Suggested fix: format all server-rendered times with an explicit `timeZone: "America/New_York"` (and add AM/PM), and pin FullCalendar to the business timezone; land this in the same change as C4, with a test run under a non-Eastern server TZ.

**S2 · Medium — The date picker offers "today," so a customer can book a slot that has already passed**
Evidence: `app/residential/datetime/page.tsx:22` (day loop starts at `i = 0`, today), selectable at `:91-97`; no time-of-day or cutoff check server-side (`app/actions/submitBooking.ts:68-70`).
Why it matters: a customer booking at 5 PM can pick today's "Morning (8–12)" and receive a confirmation for a visit that cannot happen — a guaranteed no-show experience with no tampering involved.
Suggested fix: exclude today (or enforce a same-day cutoff hour in America/New_York) in both the picker and the H2 server-side date-window validation.

**S3 · Medium — Calendar API and pages ship full customer PII (including entry notes) to the browser when only display fields are needed**
Evidence: `BOOKING_COLUMNS` includes `email,phone,notes` (`lib/supabase/queries.ts:11-12`); `/api/admin/jobs` returns raw `Job[]` JSON (`app/api/admin/jobs/route.ts:25-26`); the calendar page serializes full jobs into client props (`app/admin/calendar/page.tsx:28`) while the calendar UI renders only name/service/status/employee (`CalendarView.tsx:130-141`). Related: the bookings search puts whatever the admin types — often a customer email or phone — into the URL query string (`app/admin/bookings/BookingsSearch.tsx:22`), which lands in server/CDN access logs.
Why it matters: combined with C2 ("any authenticated user"), a single GET yields every customer's contact details and door-code-bearing notes for an arbitrary date range; it also spreads PII into logs and payloads that never needed it.
Suggested fix: expose a slim calendar projection (id, client name, start/end, status, service, assigned employee) from the API and calendar page; keep contact info and notes to the booking detail page.

**S4 · Medium (Needs verification) — Service-area ZIP list appears wrong: the "Camillus" entry is 13035, which is Canastota**
Evidence: `lib/constants.ts:39` (`"13035", // Camillus`). Camillus NY is 13031, which is absent. Both flows and both server actions gate on this list (`app/residential/address/page.tsx:34`, `app/commercial/page.tsx:48`, `app/actions/submitBooking.ts:60, 155`).
Why it matters: if the label is the intent, every resident of Camillus — an inner-ring Syracuse suburb — is told "We don't currently serve this area," while a Madison County town ~25 miles east can book. Silent, systematic lead loss in a core service area. Marked Needs verification because ZIP↔place mappings weren't confirmed against USPS data here.
Suggested fix: have the owner verify the whole list against USPS (also check omissions such as North Syracuse 13212); add a test asserting each ZIP/label pair.

**S5 · Medium — Customer-facing dead buttons, and the admin login's only password-recovery affordance does nothing**
Evidence: confirmation-page "Add to Google Calendar" / "Add to Apple Calendar" / "Create Account" have no handlers (`app/residential/confirmation/page.tsx:70-75, 84, 125-131, 139-141`) — and no account system exists at all; "Forgot password?" is a non-interactive `<p>` with no route behind it (`app/admin/LoginForm.tsx:79-81`); also dead: bookings status/employee filter dropdowns (`app/admin/bookings/page.tsx:236-241`), employees "+ Add Employee" and "View Schedule" (`app/admin/employees/page.tsx:110-112, 73-75`).
Why it matters: customers will click these (DECISIONS.md cites add-to-calendar and post-booking accounts as adopted patterns) and silently get nothing; and a 3-person admin team has no self-service way back in after a forgotten password.
Suggested fix: wire Supabase's password-reset email flow for admins before launch; remove or visibly disable every control that has no handler (the calendar links are cheap to implement as `.ics` downloads).

**S6 · Low — Admin mutations report success when zero rows were affected**
Evidence: `updateBookingStatus` runs `.update().eq(id)` without checking affected rows (`app/admin/actions.ts:85-93`); with a stale/wrong id — or when invoked without a session, where RLS filters the update to zero rows — PostgREST returns no error and the action replies `{ success: true }`; the activity-log insert failure is also swallowed (`:37-41`).
Why it matters: "Mark Complete" can claim success while changing nothing, which quietly corrupts operational trust and the audit trail.
Suggested fix: as part of the C1/C2 auth work, add `.select()` to the update and treat zero returned rows as a failure.

**S7 · Low — CSP is simultaneously too loose and (likely) too tight**
Evidence: `next.config.ts:18-21` — `script-src` allows `'unsafe-inline' 'unsafe-eval'`; no `connect-src` is declared, so it falls back to `default-src 'self'`, which blocks any direct browser call to the Supabase origin. The admin layout creates a browser Supabase client (`app/admin/layout.tsx:21-36`); today it only reads the local session, but any future browser-side Supabase call (token refresh, realtime) will fail silently under this policy. Needs verification in a deployed environment.
Suggested fix: drop `'unsafe-eval'` if the production build permits, and add the Supabase project origin to an explicit `connect-src` before any browser-side Supabase use.

### Top 5 to fix before launch (updated — supersedes the list above)

1. **C1** — Require a server-verified session in `adminCreateBooking` (and every admin action); derive the actor's email from the session, never from arguments.
2. **C2** — Disable public Supabase signups and enforce a real admin role in RLS and in every server entry point (fold in S6's affected-row check).
3. **C4 + H4 + S1** — One authoritative America/New_York slot definition used for storage, display, and FullCalendar; fix all server-side formatters; test under a non-Eastern server TZ.
4. **C3** — The commercial flow sends nothing at all: wire the review page to a corrected `submitCommercialQuote` (enums aligned with `lib/constants.ts`) that persists the quote and notifies the business — or remove the flow until it does.
5. **H1 + H2 + S2** — Real slot capacity enforced race-safely at insert time, plus server-side date validation (format, bookable window, same-day cutoff).
