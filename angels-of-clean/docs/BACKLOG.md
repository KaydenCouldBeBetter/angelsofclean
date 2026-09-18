# Backlog: Angels Of Clean

**Updated:** 2026-09-18 · **52 items** · Merged from `docs/audit/code-audit.md`, `docs/audit/design-audit-customer.md`, and `docs/audit/design-audit-staff.md`

**How to read this**
- Each item has an **ID (B1–B52)**, a plain-English **"Why it matters,"** and a **"Details"** section with file and frame evidence.
- **Tags:** `code` = app or database work · `design` = Figma or spec work · `both`
- **Effort:** **S** = half a day or less · **M** = 1–3 days · **L** = multi-day, or needs a decision first
- Source audit IDs (C1, D4, sH2…) are kept in each item's details for traceability.

---

## At a glance

| Section | Items | What's in it |
|---|---|---|
| [1. Critical security & data](#1-critical-security--data) | 7 | Unprotected admin actions, exposed customer data, lost commercial leads |
| [2. Booking correctness](#2-booking-correctness) | 13 | Timezones, fake availability, status model, double-booking |
| [3. Accessibility](#3-accessibility-wcag-22-aa) | 5 | Brand teal fails contrast, status chips, screen-reader bugs |
| [4. UX](#4-ux) | 19 | Placeholder homepage, conflicting prices, dead buttons, employee app scope |
| [5. Polish](#5-polish) | 8 | Copy, time formats, icons, cleanup |

---

## Decisions only you can make

These block other items. Decide them before (or while) the fixes run.

| # | Decision | Blocks |
|---|---|---|
| 1 | **Is the employee app in v1?** If not, remove employee statuses and "employee will be notified" from admin screens. | B26, B35, B36, B40–B42 |
| 2 | **Commercial quotes: fix now, or pull the flow until it works?** Pulling it is fast; right now every lead is lost. | B3 |
| 3 | **Scheduling model:** admin-created jobs get any time window, customers keep fixed slots? | B19, B9, B10 |
| 4 | **Real prices:** Figma says From $85/$149/$199; the code says $120/$200/$250. | B28 |
| 5 | **The one real business phone number.** 555 numbers can't ship. | B32 |
| 6 | **Add-Ons: cut it or make it a real step?** | B29 |
| 7 | **The owner verifies the service-area ZIP list** against USPS. | B16 |
| 8 | **Check the Supabase dashboard:** are public email signups on? Turn them off. | B2 |
| 9 | **Privacy policy and terms content** (template plus your details). | B6 |

---

## Suggested fix order for Fable

These are code items that need no decision, most important first. **One item per session.** Read the diff, then commit.

1. **B1**: Lock down admin server actions
2. **B2**: Admin role + RLS
3. **B4**: Stop exposing customer PII
4. **B20**: Merge the duplicated booking validation *(do this before B8 and B11 so the fixes only happen once)*
5. **B8**: America/New_York everywhere
6. **B11**: Server-side date validation
7. **B9**: One time-slot definition
8. **B16**: Swap the wrong ZIP (13035 → 13031)
9. **B13**: Add the Confirm Booking action
10. **B18**: Show errors instead of "no jobs"
11. **B5**: Rate-limit the booking form
12. **B3**: Pull or wire the commercial flow *(after decision 2)*

---

## 1. Critical security & data

- [x] **B1 · Require a logged-in admin for every admin action** · `code` · **M**
  **Why it matters:** Right now anyone on the internet can create bookings, assign staff, or change a booking's status without logging in.
  <details><summary>Details</summary>

  `adminCreateBooking` is a public endpoint using the service-role client with zero auth (`app/actions/submitBooking.ts:138-220`). `assignEmployees` and `updateBookingStatus` have no authorization check (`app/admin/actions.ts:49-99`); the only `auth.getUser()` just decorates a log message. Derive the actor's email from the session, never from arguments (`adminEmail` is caller-forgeable, `:210-213`). Also add `.select()` to updates and treat zero affected rows as failure (`app/admin/actions.ts:85-93`). *Source: code C1, C2-verify, S6*

  *Done 2026-09-18:* `requireAdmin()` (`lib/supabase/require-admin.ts`) verifies the session via `auth.getUser()` at the top of `adminCreateBooking`, `assignEmployees`, and `updateBookingStatus`; the actor email now comes from the session, and the forgeable `adminEmail` argument/prop was removed end-to-end (modal, calendar, and the three admin pages). `updateBookingStatus` uses `.select("id")` and returns "Booking not found." on zero affected rows. Tests: `app/actions/__tests__/submitBooking.test.ts`, `app/admin/__tests__/actions.test.ts`. Action-level auth only — B2 (role claim + RLS) is still open.
  </details>

- [ ] **B2 · Add a real admin role, lock down database rules, disable public signups** · `code` · **M**
  **Why it matters:** Anyone who creates any account can read every customer's address, phone, and door code.
  <details><summary>Details</summary>

  RLS grants on `auth.role() = 'authenticated'` alone (`supabase/001_initial_schema.sql:63-77`). Add a role claim (`app_metadata.role = 'admin'`) and rewrite the policies and server checks against it. Prerequisite for any employee or client login. *Needs verification:* whether email signups are enabled in the Supabase dashboard. *Source: code C2*
  </details>

- [ ] **B3 · Fix or pull the commercial quote flow** · `both` · **M**
  **Why it matters:** Every commercial quote request is silently thrown away, while the customer sees a success screen promising a reply in one business day.
  <details><summary>Details</summary>

  The review page only navigates (`app/commercial/review/page.tsx:42-46`). `submitCommercialQuote` is imported nowhere; its enum mismatches with `lib/constants.ts:52-101` are dead code now but must be fixed if wired. The confirmation fabricates a reference number client-side (`app/commercial/confirmation/page.tsx:16-20, 86-88`). Also design a submission-failure state; Figma has none (frame `120:406`). *Source: code C3, design D1*
  </details>

- [ ] **B4 · Stop sending customer PII where it isn't needed** · `code` · **S**
  **Why it matters:** Customer emails, phones, and notes are sent to the browser and written into server logs and URLs without need.
  <details><summary>Details</summary>

  `/api/admin/jobs` and the calendar page ship `email,phone,notes` that the UI never renders (`lib/supabase/queries.ts:11-12`, `app/api/admin/jobs/route.ts:25-26`, `app/admin/calendar/page.tsx:28`). Bookings search puts emails and phones into the URL query string, so they end up in server/CDN logs (`app/admin/bookings/BookingsSearch.tsx:22`). Full Supabase error objects are logged on insert paths (`app/actions/submitBooking.ts:117`, throughout `queries.ts`). Use a slim calendar projection; log only `error.code` + a correlation ID. *Source: code S3, M3*
  </details>

- [ ] **B5 · Rate-limit and size-limit the public booking form** · `code` · **M**
  **Why it matters:** A script could flood the database with thousands of fake bookings or multi-megabyte notes.
  <details><summary>Details</summary>

  `submitBooking` is unauthenticated by design, with no rate limit, CAPTCHA, dedupe, or max length on any text field (`app/actions/submitBooking.ts:42-86`). Add a per-IP rate limit, a lightweight bot check, and field length caps. *Source: code H6*
  </details>

- [ ] **B6 · Publish a privacy policy and terms** · `both` · **S**
  **Why it matters:** The site promises "We never share your data" and links to terms that don't exist. You can't collect addresses and phones without them.
  <details><summary>Details</summary>

  Contact steps (`120:147`, `app/residential/contact/page.tsx:122`) and Sign Up (`120:942`) reference ToS/Privacy; neither document exists in design or code. *Source: design D13*
  </details>

- [ ] **B7 · Fix the Content Security Policy** · `code` · **S**
  **Why it matters:** It's too loose to stop injected scripts, and too strict for future browser-side database calls, which would fail silently.
  <details><summary>Details</summary>

  `script-src` allows `'unsafe-inline' 'unsafe-eval'`, and there's no `connect-src` (`next.config.ts:18-21`, `app/admin/layout.tsx:21-36`). *Needs verification* in a deployed environment. *Source: code S7*
  </details>

---

## 2. Booking correctness

- [ ] **B8 · Store and show all times in America/New_York** · `code` · **M**
  **Why it matters:** Depending on the server's timezone, bookings can be saved at the wrong hour, and morning jobs can vanish from the admin calendar.
  <details><summary>Details</summary>

  `start_at`/`end_at` parse in the server's local zone (`app/actions/submitBooking.ts:89-90, 178-179`). `localDateStr()` uses server-local "today" (`lib/supabase/queries.ts:193-196`). Timestamps format without `timeZone` or AM/PM (`app/admin/bookings/page.tsx:36-42`, `app/admin/dashboard/page.tsx:7-12`, `queries.ts:292-299`). FullCalendar renders in the viewer's timezone with `slotMinTime="07:00"`, hiding mis-stored morning jobs (`app/admin/calendar/CalendarView.tsx:145-186`). Add a test pinned to a non-Eastern server timezone. *Source: code C4, S1*
  </details>

- [ ] **B9 · One definition of each time slot** · `both` · **S**
  **Why it matters:** Customers are told "Morning 8–12" but the database stores 9–11, and the admin sees the other window.
  <details><summary>Details</summary>

  Display: `app/residential/datetime/page.tsx:12-13`, `lib/constants.ts:26-29`. Storage: `app/actions/submitBooking.ts:37-40`. Admin modal: `app/admin/NewBookingModal.tsx:24-27`. Use a single shared constant. *Source: code H4, design §D*
  </details>

- [ ] **B10 · Real, race-safe availability** · `both` · **L**
  **Why it matters:** The date picker is fake (one day is always "Full") and nothing stops two customers from booking the same slot.
  <details><summary>Details</summary>

  No availability check at insert (`app/actions/submitBooking.ts:92-114`). The picker hardcodes day 3 as Full, offers only 6 days, and has dead month arrows (`app/residential/datetime/page.tsx:22, 32, 76-78`). Enforce capacity server-side (transaction/RPC), drive the picker from real data, and design day- and slot-level unavailability (Booksy pattern per DECISIONS.md). *Source: code H1, design D6*
  </details>

- [ ] **B11 · Validate dates on the server** · `code` · **S**
  **Why it matters:** Customers can book past dates, or book this morning's slot at 5pm. Malformed dates crash the request.
  <details><summary>Details</summary>

  Only a truthiness check exists (`app/actions/submitBooking.ts:68-70`); `.toISOString()` throws on bad input (`:110-111, 199-200`); the picker offers today with no cutoff (`app/residential/datetime/page.tsx:22, 91-97`). Enforce format + bookable window + same-day cutoff in America/New_York, in both the picker and the server. *Source: code H2, S2*
  </details>

- [ ] **B12 · One status model with enforced transitions** · `both` · **M**
  **Why it matters:** Employee, dashboard, calendar, and database each use different status names, and a cancelled booking can be brought back by accident.
  <details><summary>Details</summary>

  Employee: On My Way/Arrived/In Progress/Complete/Issue (`120:489`, `120:422`). Admin dashboard: Pending/Confirmed/In Progress/Complete; admin calendar: Done/Active/Confirmed (`458:292` vs `458:414`, also `app/admin/data/mock.ts:41-53`). DB: pending/confirmed/active/done/cancelled. Employee Issue/Unable-to-Access states have no admin destination. `updateBookingStatus` accepts any transition (`app/admin/actions.ts:79-99`). Needs one canonical model + employee substates + an admin issue queue + server-side transition rules. Add `actor`/`action` columns to `activity_log` (`supabase/001_initial_schema.sql:48-53`). *Source: staff sC1, code M2*
  </details>

- [ ] **B13 · Add the missing "Confirm Booking" action** · `both` · **S**
  **Why it matters:** Every booking starts as Pending, and there's no button or code that can confirm it.
  <details><summary>Details</summary>

  `updateBookingStatus` is only ever called with `"done"` or `"cancelled"` (`app/admin/bookings/[id]/BookingActions.tsx:45,55`). No frame shows it (`120:581`, `458:292`, `458:604`). *Source: staff sC3*
  </details>

- [ ] **B14 · Prevent double-booked staff and make assignment saves safe** · `both` · **M**
  **Why it matters:** An admin can assign a cleaner to overlapping jobs, and a failed save can silently remove the whole crew from a job.
  <details><summary>Details</summary>

  `assignEmployees` deletes all rows, then inserts, with no overlap check (`app/admin/actions.ts:49-68`). The assignment UI shows day-level counts with no times, no current assignee, contradictory availability, and unbacked ratings/zones (`120:835`, `458:693`, `app/admin/bookings/[id]/BookingActions.tsx:65-92`). Add an overlap check + a single transaction/RPC; redesign with time-scoped conflicts and explicit Replace/Add. *Source: code H3, staff sH1*
  </details>

- [ ] **B15 · Show unassigned jobs on the calendar** · `both` · **M**
  **Why it matters:** Jobs without a cleaner don't appear on the weekly calendar, so they're easy to forget.
  <details><summary>Details</summary>

  The weekly view has one lane per employee and none for unassigned (`458:414`, `458:292`, `120:664`). Add a pinned "Unassigned" lane/tray and a month-cell indicator. *Source: staff sC4*
  </details>

- [ ] **B16 · Fix the service-area ZIP list** · `code` · **S**
  **Why it matters:** Camillus customers are rejected: the code lists 13035 (actually Cazenovia) instead of 13031.
  <details><summary>Details</summary>

  `lib/constants.ts:39`, used by `app/residential/address/page.tsx:34`, `app/commercial/page.tsx:48`, `app/actions/submitBooking.ts:60, 155`. Swap the ZIP, have the owner verify the full list against USPS, and add a test per ZIP/label pair. *Source: code S4, design D8*
  </details>

- [ ] **B17 · Send real confirmation emails and add a cancel path** · `both` · **M**
  **Why it matters:** The confirmation page says "We'll send a confirmation to [email]," but no email is ever sent, and customers can only cancel by phone.
  <details><summary>Details</summary>

  `app/residential/confirmation/page.tsx:51-53, 106-108`. Wire Resend for confirm and cancel emails; treat send failure as retryable and log it against the booking. *Source: code H5*
  </details>

- [ ] **B18 · Tell "no jobs" apart from "database is down"** · `code` · **S**
  **Why it matters:** If Supabase has an outage, the admin sees "no jobs today" instead of an error.
  <details><summary>Details</summary>

  Every query swallows errors into `[]`/`null` (`lib/supabase/queries.ts:20-23, 88-93, 125-128, 147-150, 183-186, 271-274`). Show an error banner instead. *Source: code M1*
  </details>

- [ ] **B19 · Decide the real scheduling model** · `design` · **S**
  **Why it matters:** Staff screens show evening, 3–4-hour, and commercial jobs that the booking system can't create.
  <details><summary>Details</summary>

  Frames `120:422`, `412:332`, `458:292`, `458:414` vs slots 09–11/13–15 and evening rejected (`402:247`). Recommended: admin-created jobs allow any window; self-serve keeps slots. Record the decision in DECISIONS.md. *Source: staff sM6*
  </details>

- [ ] **B20 · Merge the duplicated booking validation** · `code` · **S**
  **Why it matters:** The customer and admin booking paths have about 70 copy-pasted lines, so every fix has to be made twice or the bug comes back.
  <details><summary>Details</summary>

  `app/actions/submitBooking.ts:44-135` vs `143-220`. Do this before B8 and B11. *Source: code M4*
  </details>

---

## 3. Accessibility (WCAG 2.2 AA)

- [ ] **B21 · Use the darker brand teal for anything with text** · `both` · **M**
  **Why it matters:** The light teal `#3BBBAD` fails contrast (2.36:1) on most customer and employee screens. The darker `#1A6B5A` (6.37:1) passes. This single change fixes the biggest batch of failures.
  <details><summary>Details</summary>

  Failing frames: `120:3`, `120:20`, `120:106`, `120:422`, `120:461`, `120:489`, `120:922`, `120:776`, `120:835`, `524:319`. Desktop admin already uses `#1A6B5A`. The code ships three other primaries: near-black `--primary` (`app/globals.css:58`), hardcoded `#1a6b5a` (`app/residential/page.tsx:143`), and teal-600/700 chips (`app/residential/page.tsx:128`, `app/commercial/contact/page.tsx:179`). Use one token mapped to `--primary` across the Figma paint style and both flows. *Source: design D2, staff sC2*
  </details>

- [ ] **B22 · Darken status chips and banners** · `both` · **S**
  **Why it matters:** Pending, In Progress, Cancelled, and the offline banner are too faint to read (about 2.4–2.9:1).
  <details><summary>Details</summary>

  Measured: Pending 2.40, In Progress 2.55, Complete 4.31, status banner 2.41–2.89, Cancelled 2.54, offline banner 2.85 (`458:292`, `120:776`, `120:422`, `433:274`; values in `app/admin/data/mock.ts:49-53`). Use one chip component with a darkened palette (e.g. orange → `#B45309`, green → `#166534`). *Source: staff sM1, sH4*
  </details>

- [ ] **B23 · Fix failing text colors in code** · `code` · **S**
  **Why it matters:** Error messages, helper text, and links are too light to read.
  <details><summary>Details</summary>

  - Red-500 errors: 3.76:1, so use `#C0392B` (4.9:1) instead (`app/residential/address/page.tsx:100`, `app/commercial/contact/page.tsx:98-150`).
  - Zinc-400 helper text: 2.56:1 (`app/commercial/services/page.tsx:168-170`, `app/residential/contact/page.tsx:121-123`).
  - Teal-600 links: 3.74:1 (`app/residential/review/page.tsx:128`, `datetime/page.tsx:102`).

  *Source: design §D*
  </details>

- [ ] **B24 · Fix screen-reader bugs** · `code` · **S**
  **Why it matters:** Screen readers announce the current step as "completed," read commercial checkboxes twice, and don't announce submit errors.
  <details><summary>Details</summary>

  - `ProgressDots.tsx:18`: the "current" branch is unreachable.
  - Decorative `role="checkbox"` div plus a real input (`app/commercial/services/page.tsx:124-155`).
  - Missing `role="alert"` and icon on the residential submit error (`app/residential/review/page.tsx:168-170`).

  *Source: design §D*
  </details>

- [ ] **B25 · Visible focus states everywhere** · `both` · **S**
  **Why it matters:** Keyboard users can't see where they are. Only one focus state is designed in the whole file.
  <details><summary>Details</summary>

  Only the Notes textarea is designed (`380:207`). Hand-rolled buttons in code declare no focus style. *Needs verification* in the browser. Spec one ring (e.g. 2px `#124D41` offset) and add a keyboard or menu alternative to calendar drag-and-drop (WCAG 2.5.7). *Source: design §D, staff sL1*
  </details>

---

## 4. UX

- [ ] **B26 · Decide what the employee app includes in v1** · `both` · **S** to decide, **L** to build
  **Why it matters:** All 21 employee screens are unbuilt, but the admin screens act as if employees get live updates.
  <details><summary>Details</summary>

  `docs/FIGMA_MAP.md:39-61, 87, 97`. Admin promises "Employee will be notified automatically" (`120:835`, `458:693`). Either scope the employee PWA into launch (B2 is a prerequisite) or strip employee-status features from admin v1. *Source: code M5, staff sH6*
  </details>

- [ ] **B27 · Build the real homepage** · `both` · **M**
  **Why it matters:** The live homepage is a placeholder with no trust signals, and it shows customers a link to the admin dashboard.
  <details><summary>Details</summary>

  `app/page.tsx:5-29` vs the HeroSplit frame `120:3` (ratings, insured/bonded, testimonial, service area, phone). Any reviews or testimonials that ship must be real. *Source: design D4*
  </details>

- [ ] **B28 · One price story + "what happens next"** · `both` · **S**
  **Why it matters:** Customers see different prices in different places, and nobody tells them whether they've been charged or how to cancel.
  <details><summary>Details</summary>

  Figma: From $85/$149/$199 (`120:20`, `120:171`). Code: $120/$200/$250 (`app/residential/page.tsx:17,24,31`). The review page shows no number (`review/page.tsx:141`). A dead `PRICE_MAP` holds old prices (`lib/constants.ts:31-35`). Add a next-steps / no-payment / cancel block to Review and Confirmation (`120:202`, `120:171`), modeled on the commercial one. *Source: design D3, D7*
  </details>

- [ ] **B29 · Cut or finish Add-Ons** · `design` · **S** (cut) / **L** (build)
  **Why it matters:** The Add-Ons screen sits outside the step flow, and whatever customers pick there is never saved or shown.
  <details><summary>Details</summary>

  Frame `120:223`. No store or schema home. Its checkmark badge covers the price. *Source: design D5*
  </details>

- [ ] **B30 · Remove or wire every dead button** · `both` · **M**
  **Why it matters:** Buttons that do nothing make the whole app feel broken.
  <details><summary>Details</summary>

  - Customer: Add to Google/Apple Calendar, Create Account, Log In (`app/residential/confirmation/page.tsx:70-75, 84, 125-141`, desktop navs).
  - Admin: Reschedule, Send Client Message, Print/Export (`BookingActions.tsx:103-105, 123-128`); filter dropdowns (`app/admin/bookings/page.tsx:236-241`); + Add Employee / View Schedule (`app/admin/employees/page.tsx:73-75, 110-112`).

  Calendar links are cheap as `.ics` downloads. *Source: code S5, H5, design D13, staff sM4*
  </details>

- [ ] **B31 · Working "Forgot password?" for admins** · `code` · **S**
  **Why it matters:** A locked-out admin has no way back in.
  <details><summary>Details</summary>

  It's a non-interactive `<p>` (`app/admin/LoginForm.tsx:79-81`). Use Supabase's reset-email flow. *Source: code S5*
  </details>

- [ ] **B32 · One real, tappable phone number** · `both` · **S**
  **Why it matters:** Customers see three different numbers, two of them fake 555 numbers, and the phone is the fallback for every error.
  <details><summary>Details</summary>

  - (315) 555-CLEAN: Figma and `app/residential/error/page.tsx:44`, as plain text.
  - (315) 555-0100: commercial pages and the phone input placeholder, `app/residential/contact/page.tsx:104`.
  - (315) 516-1266: `DesktopNavbar.tsx:27`.

  *Source: design D11*
  </details>

- [ ] **B33 · Confirm before Cancel Booking** · `both` · **S**
  **Why it matters:** Cancel sits right next to Mark Complete with no "Are you sure?" prompt.
  <details><summary>Details</summary>

  `120:776`, `458:604`. The employee side already has a confirm sheet (`429:274`). *Source: staff sM4*
  </details>

- [ ] **B34 · Fix the Step 4 error screens** · `design` · **S**
  **Why it matters:** The "date unavailable" and "evening unavailable" screens contradict themselves, and the code never shows them.
  <details><summary>Details</summary>

  `386:225`, `402:247`. `app/residential/datetime/page.tsx` has no error UI. Evening is unavailable everywhere, so drop it or label it "coming soon." *Source: design D6*
  </details>

- [ ] **B35 · Design what happens when a job changes mid-day** · `design` · **M**
  **Why it matters:** Cleaners only learn a job was cancelled from a strikethrough, reassigning in-progress jobs gives no warning, and "Complete" can't be undone.
  <details><summary>Details</summary>

  `120:422`, `120:984` (the only push is "New Job Assigned"), `429:274`. *Source: staff sH2*
  </details>

- [ ] **B36 · Design real offline behavior** · `design` · **M**
  **Why it matters:** Offline is just a banner, and "admin has been notified" is false when there's no signal.
  <details><summary>Details</summary>

  `433:274`, `467:274`, `435:274`. Needs queued-update, pending-sync, and reconnect-conflict states. Blocked on B26. *Source: staff sH4*
  </details>

- [ ] **B37 · Make tablet admin match desktop admin** · `design` · **M**
  **Why it matters:** The tablet designs are missing features that desktop and the shipped code already have.
  <details><summary>Details</summary>

  Missing on tablet: address column, View buttons, + New Booking, weekly view, activity log (`120:581` vs `458:292`, `120:664` vs `458:414`, `120:776` vs `458:604`). Declare desktop canonical. *Source: staff sH5*
  </details>

- [ ] **B38 · A proper home for door codes and entry info** · `both` · **M**
  **Why it matters:** Access instructions are shown to cleaners but never collected, and the push notification puts full addresses on the lock screen.
  <details><summary>Details</summary>

  `120:461`, `120:984`, `120:422`. Add `access_notes`, captured at booking or admin edit and shown only to the assigned employee around the job window. *Source: staff sH3*
  </details>

- [ ] **B39 · Make residential and commercial feel like one app** · `both` · **M**
  **Why it matters:** Same concepts, different controls: two navbars, two steppers, three selected styles. The ZIP error also highlights the wrong field.
  <details><summary>Details</summary>

  Design D9 (patterns). D10: address gating differs; the outside-area error highlights Street Address instead of ZIP (`120:260`, `app/residential/error/page.tsx:34`). *Source: design D9, D10*
  </details>

- [ ] **B40 · Merge the two employee week views** · `design` · **S**
  **Why it matters:** Two screens do the same job with opposite styling, and "Tomorrow" highlights "Today."
  <details><summary>Details</summary>

  `524:319` vs `412:274`–`412:506`, `411:274`. Sat/Sun aren't tappable even though the admin calendar implies weekend jobs. *Source: staff sM2, sM8*
  </details>

- [ ] **B41 · One "Report a problem" path for cleaners** · `design` · **S**
  **Why it matters:** Reporting an issue is split across a hidden long-press, a vague status, and a screen with a tiny "Call Admin" link.
  <details><summary>Details</summary>

  `120:422`, `120:489`, `435:274`. *Source: staff sM5*
  </details>

- [ ] **B42 · Add job scope and tap-to-call/navigate to Job Detail** · `design` · **S**
  **Why it matters:** Cleaners can't see beds/baths, and can't tap the address or phone number.
  <details><summary>Details</summary>

  `120:461` vs `120:776`. Also, 2.5 bathrooms can't be stored in the smallint schema. *Source: staff sM7*
  </details>

- [ ] **B43 · Design the missing loading and failure states** · `both` · **S**
  **Why it matters:** Submitting shows no progress, a failure shows a bare red sentence, and a stale date can be resubmitted by accident.
  <details><summary>Details</summary>

  `app/residential/review/page.tsx:168-170`. The designed 503 screen (`120:967`) is implemented nowhere. sessionStorage revival: `store/bookingStore.ts:155`. *Source: design D13*
  </details>

- [ ] **B44 · Use one consistent set of sample data in staff frames** · `design` · **S**
  **Why it matters:** The same booking has different clients, addresses, and statuses across screens, which confuses testers.
  <details><summary>Details</summary>

  Counts disagree, and Apr 14 is Mon in one frame and Tue elsewhere. Full list in staff audit sM3. *Source: staff sM3*
  </details>

---

## 5. Polish

- [ ] **B45 · Correct FIGMA_MAP.md** · `design` · **S**
  **Why it matters:** Future Claude sessions trust this map, and parts of it are wrong.
  <details><summary>Details</summary>

  - `120:3` isn't really implemented by `app/page.tsx`.
  - `386:225`/`402:247` map to states that don't exist.
  - `120:967` maps to an outside-area page.
  - Customer desktop layouts and five admin code-only screens have no frames.

  *Source: design §E, staff gap summary*
  </details>

- [ ] **B46 · Align copy between Figma and code** · `both` · **S**
  **Why it matters:** Step titles, service names, and labels don't match, and there are typos and pluralization bugs.
  <details><summary>Details</summary>

  - Commercial service-area lists share only "Restrooms."
  - PROJECT_MAP says "5 steps" (actually 4).
  - Missing spaces in Figma Review.
  - "1 Bedrooms"/"2 Bathroom" (`app/residential/review/page.tsx:82`).
  - "Back to Commercial Services" goes to `/` (`app/commercial/page.tsx:204-209`).

  *Source: design D12*
  </details>

- [ ] **B47 · One time format, always with AM/PM** · `both` · **S**
  **Why it matters:** Four different formats. "11:00–2:00" is ambiguous.
  <details><summary>Details</summary>

  `458:292`, `120:518`, `120:422`, `458:414`. *Source: staff sL3*
  </details>

- [ ] **B48 · Replace emoji icons with Lucide icons** · `design` · **S**
  **Why it matters:** Emoji render differently on every phone and can't change color with state.
  <details><summary>Details</summary>

  `120:422`, `120:489`, `435:274`, `447:274`. Lucide is already in the stack. *Source: staff sL2*
  </details>

- [ ] **B49 · Hide or label the fake Settings page** · `code` · **S**
  **Why it matters:** It says "Settings saved" but saves nothing.
  <details><summary>Details</summary>

  `app/admin/settings/page.tsx`. *Source: code L1*
  </details>

- [ ] **B50 · Clear booking data after confirmation** · `code` · **S**
  **Why it matters:** Addresses, phones, and door codes stay in the browser for as long as the tab is open.
  <details><summary>Details</summary>

  `store/bookingStore.ts:131-155`. *Source: code L2*
  </details>

- [ ] **B51 · Archive stale docs, move types out of mock.ts** · `code` · **S**
  **Why it matters:** An old plan describes a stack that was never built, and real code imports types from a mock-data file.
  <details><summary>Details</summary>

  `BACKEND_PLAN.md` (Prisma/Auth.js). `lib/supabase/queries.ts:2` imports from `app/admin/data/mock.ts`. *Source: code L3, design §F*
  </details>

- [ ] **B52 · Small design fixes** · `design` · **S**
  **Why it matters:** Several small rough edges add up.
  <details><summary>Details</summary>

  - Employee Sign In "Back to Client Login" should go to the homepage; its placeholder text is 2.54:1 (`120:922`, staff sL4).
  - The login frame has a placeholder sparkle instead of the logo (`120:899`).
  - Figma commercial Review is missing fields the code shows (`120:377`).
  - The Booking History empty illustration looks like an error (`120:250`).

  *Source: design §F*
  </details>

---

## Needs verification

- [ ] Supabase dashboard: are public email signups on? (B2)
- [ ] CSP behavior in a deployed environment. (B7)
- [ ] The full ZIP-to-town list against USPS, beyond the 13035/13031 fix. (B16)
- [ ] Browser-default focus outlines on hand-rolled buttons. (B25)
- [ ] Prototype click-through for admin table rows, month cells, Sat/Sun chips, and profile toggle variants `447:274`/`471:274`. (staff audit)

---

**Audit notes:** The second audit pass retracted no findings but corrected two details, both reflected above. First, the commercial flow fails because the form never calls the submit action; the enum bug is dead code behind it. Second, ZIP 13035 is Cazenovia (verified), not Canastota.
