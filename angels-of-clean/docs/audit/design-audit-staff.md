# Design Audit — Staff-Facing Flows (Employee App + Admin Tools)

Date: 2026-09-18 · Scope: Figma file `Puf4bVpEq4KAkUhK0nnGtw`, staff frames only (employee 390px, admin 768px, admin 1440px), compared against the implementation via `docs/FIGMA_MAP.md`. Findings only; nothing was changed.

Contrast ratios below were **measured** by pixel-sampling 1:1 PNG exports of the frames (WCAG relative-luminance formula). Companion doc: `docs/audit/code-audit.md` (behavioral issues in code); this audit avoids repeating those.

What's working: employee primary actions (Sign In, Update Status, Confirm Status Update, Mark Complete) all measure exactly **56px tall**, matching the field-conditions standard in DECISIONS.md. Labels sit above inputs, the Edit Phone error state uses icon + color + specific message (465:274), the Complete confirmation sheet (429:274) guards the riskiest tap, and the desktop weekly calendar's employee-lane layout (458:414) is the right model for conflict prevention.

---

## Critical

### C1. The three staff surfaces use three different status vocabularies, and employee-reported statuses are invisible to the admin
**Frames:** Employee — Status Update (120:489), Employee — Jobs List (120:422), Admin — Dashboard (120:581), Admin Dashboard — Desktop (458:292), Admin Calendar — Weekly View (458:414), Admin Booking Detail — Desktop (458:604)
**Problem:** Employees set: On My Way, Arrived, In Progress, Complete, Issue — Needs Attention (120:489), plus Assigned/Cancelled chips (120:422) and an "Unable to Access" outcome (435:274). The admin dashboard shows Pending / Confirmed / In Progress / Complete (458:292), while the admin weekly calendar shows **Done / Active / Confirmed** for the same jobs (458:414) — two label sets within the admin alone (faithfully duplicated in code: `app/admin/data/mock.ts:41-42` vs `:49-50`). The DB enum is pending/confirmed/active/done/cancelled (`supabase/001_initial_schema.sql`). "On My Way", "Arrived", "Issue", and "Unable to Access" exist nowhere in the schema and appear on no admin surface except four lines of the desktop activity log (458:604). An employee tapping "Issue — Needs Attention" ("Flag a problem for your dispatcher") has no dispatcher-side destination: no alert, no dashboard indicator, no job badge.
**Who it hurts:** Admin (blind to field state, especially problems); employee (reports vanish); customer (nobody follows up).
**Suggested change:** Define one canonical status model with an explicit employee-substate track (assigned → en-route → on-site → done) plus an `issue` flag, use identical labels/colors on every surface, and give Issue/Unable-to-Access a visible admin queue.

### C2. Staff primary color #3BBBAD fails WCAG AA everywhere it carries text (measured 2.36:1)
**Frames:** Employee Sign In (120:922), Employee — Jobs List (120:422), Employee — Job Detail (120:461), Employee — Status Update (120:489), Employee — Schedule (524:319), Admin — Booking Detail (120:776), Admin — Employee Assignment (120:835)
**Problem:** The employee app and the admin **tablet** frames are built on `#3BBBAD`, not the spec primary `#1A6B5A` (5.8:1, DECISIONS.md — the "Agent 6 color correction" evidently only reached the desktop frames). Measured:
| Element | Frame | Colors | Ratio | Needs |
|---|---|---|---|---|
| Sign In button label | 120:922 | #FFF on #3BBBAD | **2.36:1** | 4.5:1 |
| Update Status button label | 120:461 | #FFF on #3BBBAD | **2.36:1** | 4.5:1 |
| Header title, segmented "Today", selected day chip | 120:422, 524:319 | #FFF on #3BBBAD | **2.36:1** | 4.5:1 |
| Assign Employee / Assign to this Job (tablet) | 120:776, 120:835 | #FFF on #3BBBAD | **2.36:1** | 4.5:1 |
| Active tab label, outline "Assigned" chip, "Internal Access Only" | 120:422, 524:319, 120:922 | #3BBBAD on #FFF | **2.36:1** | 4.5:1 |
The same actions on **desktop** use #1A6B5A and pass (measured 6.37:1, 458:604/458:693). Employees work in the explicitly-designed-for conditions of bright outdoor light — the one context where 2.36:1 is most unusable.
**Who it hurts:** Employee (can't read their primary actions in sunlight), admin on tablet, business (WCAG 2.2 AA target missed).
**Suggested change:** Replace #3BBBAD with #1A6B5A (or #124D41 for pressed) on every filled control and every teal-on-white text element across employee and tablet frames; keep #3BBBAD only for non-text accents.

### C3. "Pending Confirmation — Action required" has no corresponding action anywhere
**Frames:** Admin — Dashboard (120:581), Admin Dashboard — Desktop (458:292), Admin — Booking Detail (120:776), Admin Booking Detail — Desktop (458:604)
**Problem:** Both dashboards lead with a KPI card demanding action on pending bookings, but Booking Detail offers only Assign Employee / Reschedule / Mark Complete / Cancel — there is **no Confirm control** in any frame. The desktop activity log even shows "Confirmed by Jordan L." (458:604), so the act exists in the story but not in the UI. Code matches: `updateBookingStatus` is only ever called with `"done"` or `"cancelled"` (`app/admin/bookings/[id]/BookingActions.tsx:45,55`). The pending→confirmed transition — the first step of every single booking's lifecycle — cannot be performed.
**Who it hurts:** Admin (core workflow dead-ends), customer (booking never gets confirmed).
**Suggested change:** Add a primary "Confirm Booking" action to Booking Detail for pending status (and ideally a one-click confirm on the dashboard row), wired to the `confirmed` enum value.

### C4. Unassigned jobs are invisible or misplaced on the scheduling calendar
**Frames:** Admin Calendar — Weekly View (458:414), Admin Dashboard — Desktop (458:292), Admin — Calendar (120:664)
**Problem:** The weekly calendar is organized as one lane per employee, but there is **no lane for unassigned jobs**. Of the dashboard's two Unassigned/Pending jobs (458:292): Lisa K.'s 5:00–8:00 Move-Out appears nowhere on the weekly view, and Northside Dental — Unassigned, *today*, per the dashboard — appears in **Ana V.'s lane on Wednesday as "Confirmed"** (458:414). The tablet monthly calendar (120:664) shows only per-day dot counts, so it can't surface unassigned work either. The jobs most in need of scheduling attention are exactly the ones the scheduling surface cannot show.
**Who it hurts:** Admin (jobs fall through), customer (no one shows up), business.
**Suggested change:** Add a pinned "Unassigned" lane (or sidebar tray) to the weekly view from which jobs can be dragged onto an employee lane, and a distinct unassigned indicator on month cells.

---

## High

### H1. Employee Assignment doesn't give the admin what the conflict decision needs
**Frames:** Admin — Employee Assignment (120:835), Admin Employee Assignment — Desktop (458:693)
**Problem:** The header scopes availability to "April 14, 1:00–4:00 PM", but cards show only day-level "2 jobs today / 1 job today" with **no times** — the admin can't tell whether Marcus's 2 jobs overlap 1:00–4:00 or whether travel from his previous address is feasible. Rosa C. is "Unavailable" with no reason (and with "3 jobs today" — unavailable yet triple-booked?). The screen doesn't show that Ana V. is already assigned to this booking (per 120:776/458:604), so "Assign to this Job" is ambiguous: replace her or add a second cleaner? Only single-assignment exists although `booking_employees` and the code's multi-select support teams. Star ratings (4.9★) and zones have no backing data anywhere (`employees` table: name, initials, phone, hired_date), and Marcus's admin zone "North Syracuse" contradicts his own profile's service area "Cicero, Baldwinsville, Liverpool" (447:274).
**Who it hurts:** Admin (double-books; per code-audit H3 nothing server-side stops it either), employee (impossible schedules).
**Suggested change:** Show each candidate's jobs for that day *with time ranges* and flag overlaps with the target slot; display the current assignee with explicit Replace/Add; either build zones/ratings for real or remove them.

### H2. Job lifecycle has no design for mid-flight changes: cancellation, reassignment, or an employee who can't finish
**Frames:** Employee — Jobs List (120:422), Push Notification — Job Update (120:984), Admin Booking Detail — Desktop (458:604), Admin Employee Assignment — Desktop (458:693), Employee — Complete Confirmation Sheet (429:274)
**Problem:** Cancellation reaches the employee only as a passive strikethrough card on the list (120:422) — the sole push notification designed is "New Job Assigned" (120:984), so a cleaner already driving to (or standing inside) a cancelled job is never actively told. Reassigning an **In Progress** booking (Ana started at 1:04 PM per 458:604) is possible from the assignment screen with no warning, and nothing shows what the displaced or new employee experiences. There is no state for "employee started but can't finish" (the Status Update list is forward-only), no no-show/late-arrival state, and no undo after "Mark Complete" ("close this job" is final, 429:274) — a glove mis-tap permanently closes a job with no recovery path (Nielsen: user control & freedom).
**Who it hurts:** Employee, admin, customer — this is where real operations live.
**Suggested change:** Design push + in-app interrupt states for cancelled/rescheduled/reassigned jobs; add a confirmation-with-context when acting on an in-progress booking; add a short undo window (or admin-side reopen) after completion.

### H3. Entry/access information has no home in the data model, and PII shows up where it shouldn't
**Frames:** Employee — Job Detail (120:461), Admin — Booking Detail (120:776), Admin Booking Detail — Desktop (458:604), Push Notification — Job Update (120:984)
**Problem:** The employee sees two fields — "Access Instructions: Key under the mat…" and "Special Notes" (120:461) — but the customer form and the DB collect a single `notes` field, and admin Booking Detail displays only "Notes" (120:776/458:604). So the most safety-critical field data (keys, codes, dogs) has no capture UI for the admin and no storage column; the employee screen displays data that cannot exist. Meanwhile the push notification prints the client's full street address on the lock screen (120:984), access instructions are readable any time (not just day-of/en-route), and a cancelled job's card still exposes the client address after cancellation (120:422).
**Who it hurts:** Customer (door codes/addresses over-exposed), employee (missing entry info on real jobs = lockouts), admin.
**Suggested change:** Add a distinct `access_notes` field captured in booking/admin-edit and shown to the assigned employee only around the job window; keep street addresses out of lock-screen notification text ("New job assigned for Tuesday 9:00 AM — open app").

### H4. Offline is a banner, not a behavior: no queued-update or sync-conflict design
**Frames:** Employee — Today's Jobs (Offline) (433:274), Employee — Profile (Offline) (467:274), Employee — Unable to Access (435:274)
**Problem:** The offline frames show stale data with a banner, but never answer the operative question: can a cleaner in a no-signal basement tap "Complete" and have it queue? No pending-sync state, no "reconnected — your update conflicts with a dispatcher change" state (the exact scenario the strikethrough cancelled card sets up), and "Unable to Access" asserts "The admin team has been notified" — which is false offline, with no failed/queued variant. The banner itself measures **2.85:1** (white on #E67E22) — sub-AA for the one message that must be legible in a basement doorway. The 433:274 frame also has stray artifacts: an orphaned clock and hourglass icon floating over cards, the cancelled card's text overlapping its time line, and the bottom nav clipped at the frame edge.
**Who it hurts:** Employee (H3 hypothesis — status update in ≤3 taps — is untestable offline), admin (silently missing updates).
**Suggested change:** Design the queue: optimistic status chips with a "pending sync" marker, a reconciliation state on reconnect, and honest copy on notification-dependent screens; darken the banner (e.g., #B45309+white).

### H5. Tablet and desktop admin are different products
**Frames:** Admin — Dashboard (120:581) vs Admin Dashboard — Desktop (458:292); Admin — Calendar (120:664) vs Admin Calendar — Weekly View (458:414); Admin — Booking Detail (120:776) vs Admin Booking Detail — Desktop (458:604)
**Problem:** Desktop has, and tablet lacks: the address column, per-row View buttons, the "+ New Booking" button, Confirmed-status rows, the Week/Month toggle, the entire weekly employee-lane view, and the Activity Log panel on Booking Detail. The tablet calendar is month-dots only — a 3-person admin team on iPads gets no way to see who is working when, and (since code already renders an activity log, `app/admin/bookings/[id]/page.tsx:160-166`, and a New Booking modal, `app/admin/NewBookingModal.tsx`) the tablet frames are behind both the desktop design *and* the shipped code. Button colors also diverge: tablet Assign Employee is #3BBBAD (2.36:1), desktop is #1A6B5A (6.37:1).
**Who it hurts:** Admin; developers (no single source of truth for the 768–1440 range).
**Suggested change:** Declare desktop the canonical feature set and update the tablet frames to match (responsive reflow, not feature removal) — or explicitly document tablet as read-mostly.

### H6. The employee app and its push channel exist only in Figma, while the admin design depends on them
**Frames:** all 21 employee frames + Employee Sign In (120:922) + Push Notification (120:984) — `docs/FIGMA_MAP.md:39-61,87,97` marks every one NOT IMPLEMENTED
**Problem:** The assignment screens promise "Employee will be notified automatically via push notification" (120:835, 458:693) and the dashboard renders live field statuses — but no employee surface, no employee auth, and no push infrastructure exist in code, and the role model to support them is a prerequisite flagged in code-audit C2. Statuses like "In Progress" shown on the admin dashboard can currently originate from nowhere.
**Who it hurts:** Admin (UI implies capabilities the launch won't have), business (launch-scope decision hiding inside design polish).
**Suggested change:** Decide the v1 boundary explicitly: either scope the employee PWA + push into launch, or strip employee-status affordances from the admin v1 design so it doesn't promise a data flow that doesn't exist.

---

## Medium

### M1. Admin status-chip and status-banner colors fail AA on both breakpoints (measured)
**Frames:** Admin Dashboard — Desktop (458:292), Admin — Booking Detail (120:776), Admin Booking Detail — Desktop (458:604), Employee — Jobs List (120:422), Employee — Schedule (524:319), Employee — Job Detail (120:461)
**Problem:** Measured small-text ratios: Pending chip #9CA3AF on #F7F9F8 **2.40:1**; In Progress chip #D97706 on #FEF2E8 **2.55:1**; Complete chip #15803D on #E1F2E7 **4.31:1** (borderline fail); the "Current Status: In Progress · Employee: Ana V." banner **2.89:1** desktop / **2.41:1** tablet; employee-side Cancelled chip white on #9CA3AF **2.54:1**, "Starting in 25 min" badge **3.19:1**, and the orange 14px time text on Schedule/Offline cards **3.19:1**. These exact values ship in code (`app/admin/data/mock.ts:49-53`). Passing examples to converge on: Confirmed chip 5.79:1, Unassigned red 5.44:1.
**Who it hurts:** Admin and employee; the failing chips are precisely the "needs attention" states.
**Suggested change:** Darken chip text one step (e.g., Pending → #6B7280 on #E5E7EB, orange → #B45309, green → #166534) and reuse the same chip component across all staff surfaces.

### M2. Two competing schedule designs, and a segmented control whose "selected" state flips meaning
**Frames:** Employee — Schedule (524:319) vs Employee — This Week Mon–Fri (412:274, 412:332, 412:398, 412:448, 412:506); Employee — Tomorrow (No Jobs) (411:274)
**Problem:** The file contains two parallel week views: the This Week set (title "My Schedule", "← Jobs" back arrow, job-count badges on day chips, black times, outline chips) and the newer Schedule tab (title "My Jobs", no back arrow, no badges, orange times). On Jobs List (120:422) the *current* segment ("Today") is the teal-filled one; on Schedule (524:319) the current segment ("Schedule") is the white one; and the Tomorrow screen (411:274) highlights "Today" while showing tomorrow's content — there is no state a user can learn. Three navigation devices (back arrow, segmented control, bottom tabs) point at the same two screens, and copy alternates between "contact your admin" (411:274), "contact your dispatcher" (120:560, 120:489).
**Who it hurts:** Employee; usability-test validity (H3 participants will stumble on navigation, not status updates).
**Suggested change:** Delete one week-view pattern (keep 524:319, add its missing badges), fix selected-segment styling to one rule, and pick one word for the office.

### M3. Mock data contradicts itself across roles — the prototype tells four different stories about the same day
**Frames:** Employee — Jobs List (120:422), Employee — Job Detail (120:461), Employee — This Week (Tue) (412:332), Admin — Dashboard (120:581), Admin Dashboard — Desktop (458:292), Admin Calendar — Weekly View (458:414), Employee — Profile (447:274), Employee — Job History (120:518)
**Problem:** Booking #1042 (Deep Clean, 47 Elm Drive, 1:00–4:00) belongs to client *Sarah M.* on the employee side (120:461) but client *James R.* with employee *Ana V.* on the admin side (120:776/458:604) — while the whole employee app is Marcus's phone. Marcus's 9:00–11:00 job is at 9 Briar Lane, Baldwinsville (120:422) vs 14 Maple St, Cicero (458:292); its status is Assigned (employee) vs Complete (admin). This Week (Tue) lists three entirely different Tuesday jobs than Today/Schedule (412:332 vs 120:422). The weekly calendar labels **Apr 14 "Mon"** while every other frame — including that frame's own header — says Tuesday, April 14 (458:414). Job Detail says "In Progress — Started 1:04 PM" above a card saying "Starting in 25 min" (120:461). Counts disagree (KPI 8 jobs / 7 desktop rows / 5 tablet rows / month-cell "8 jobs ·3", 120:664); Rosa C. is Unavailable yet has 3 jobs and a completed one; the profile is "Marcus Johnson" vs "Marcus T." everywhere else, with a mini-history that matches nothing in Job History (447:274 vs 120:518).
**Who it hurts:** Usability testing and the professor walkthrough — participants reason about the data, and the data lies; any developer using frames as seed-data spec.
**Suggested change:** Build one canonical fixture day (one employee, 3 jobs, consistent clients/addresses/statuses) and propagate it through every staff frame.

### M4. Admin destructive actions have no confirmation, in an undifferentiated six-button stack
**Frames:** Admin — Booking Detail (120:776), Admin Booking Detail — Desktop (458:604)
**Problem:** "Cancel Booking" sits directly adjacent to "Mark Complete" in a column of six similar buttons, and neither design has a confirmation step (the employee's Mark Complete does — 429:274 — so the safety pattern exists but is applied to the wrong role asymmetrically; admins juggle many bookings and cancel on the customer's behalf). Two of the six buttons (Reschedule, Send Client Message) have no designed flow at all and no code handlers (`BookingActions.tsx:104,124`) — a Reschedule *button* in both breakpoints but a reschedule *flow* in neither Figma nor code.
**Who it hurts:** Admin (mis-click cancels a real job), customer.
**Suggested change:** Add confirm dialogs to Cancel Booking and Mark Complete, visually separate destructive from primary actions, and remove or design the Reschedule / Send Message flows before launch.

### M5. Issue reporting is scattered across three entry points, one of which is an undiscoverable gesture
**Frames:** Employee — Jobs List (120:422), Employee — Status Update (120:489), Employee — Unable to Access (435:274)
**Problem:** Problems are reported via (a) "Long-press any job card" — a hint in 12px text for a hidden gesture that fails discoverability, is hostile to gloves, and has no visible-control equivalent; (b) "Issue — Needs Attention" in Status Update — which accepts no description or photo; and (c) "Unable to Access" on Job Detail. The Unable to Access confirmation doesn't say *which job* was flagged, its escalation action "Call Admin" is a small text link (~18px) rather than a 44px+ button, and "Please do not attempt re-entry" reads as an accusation (and is odd for someone who never got in).
**Who it hurts:** Employee under time pressure; admin receiving detail-free reports.
**Suggested change:** One "Report a problem" button on Job Detail with a short reason list + optional note/photo; make Call Admin a full-width button; name the job on the confirmation.

### M6. Staff screens display job shapes the booking system cannot produce
**Frames:** Employee — Jobs List (120:422), Employee — This Week (Tue) (412:332), Admin Dashboard — Desktop (458:292), Admin Calendar — Weekly View (458:414)
**Problem:** Frames show 5:00–7:00, 4:00–7:00, 5:00–8:00, and 3:00–6:00 PM jobs and 3–4-hour windows, but customers can only book Morning/Afternoon (evening is explicitly rejected — frame 402:247 — and code stores fixed 09:00–11:00 / 13:00–15:00 slots). Commercial jobs (Northside Dental, First Class Auto) appear throughout the staff UI while commercial submission is a stub that saves nothing (code-audit C3). Either the staff design is the real spec (variable-length, evening, commercial jobs) and the booking/data layer must grow to match, or staff screens are showing impossible data.
**Who it hurts:** Developers (two contradictory specs); admin expectations at launch.
**Suggested change:** Decide the real scheduling model (recommended: admin-created jobs may have arbitrary windows; self-serve bookings keep slots) and state it in DECISIONS.md so both sides are built to it.

### M7. Employee Job Detail omits the scope information the job was priced on
**Frames:** Employee — Job Detail (120:461) vs Admin — Booking Detail (120:776)
**Problem:** Admin sees "4 Bedrooms · 2.5 Bathrooms"; the employee sees only service type, time, client, and notes — a cleaner can't gauge scope or supplies before walking in. Phone and address render as plain text with no tap-to-call / tap-to-navigate affordance, the two actions a cleaner actually performs in a vehicle. (Also: 2.5 bathrooms is unstorable — `bathrooms` is a 1–5 smallint.)
**Who it hurts:** Employee (arrives unprepared, dials manually while driving).
**Suggested change:** Add a property line (beds/baths/sqft for commercial) to Job Detail and make address/phone explicit tappable rows (map + tel links).

### M8. Weekends exist for admins but not for employees
**Frames:** Employee — This Week (Mon) (412:274; tap overlays 423:282-288 cover Mon–Fri only), Employee — Schedule (524:319), Admin Calendar — Weekly View (458:414), Admin — Calendar (120:664)
**Problem:** The This Week day strips render Sat/Sun but give them no tap targets and no frames; the admin weekly view runs Mon–Sat; the monthly calendar is Sun–Sat. If Angels of Clean ever books a Saturday job (the admin calendar implies it can), the assigned cleaner cannot see it in the This Week pattern.
**Who it hurts:** Employee (invisible weekend jobs → no-shows), admin.
**Suggested change:** Make all seven days tappable in whichever week view survives M2, and align the admin weekly view to the same week span.

---

## Low

### L1. No focus states are designed for any staff surface
**Frames:** all admin frames (458:274 – 458:693, 120:581 – 120:835); hover overlays exist only for the customer flow (358:207-237)
**Problem:** Admin desktop is a keyboard-heavy surface, and WCAG 2.2 adds focus-not-obscured; no frame shows a focus ring, and there's no keyboard spec for the weekly calendar's drag-and-drop (H6 hypothesis) — drag needs a keyboard/menu alternative anyway (WCAG 2.5.7).
**Suggested change:** Add one "focus visible" annotation/spec (e.g., 2px #1A6B5A offset ring) and a non-drag alternative (card menu → "Move to…") for assignment.

### L2. Emoji are used as UI icons throughout the staff frames
**Frames:** Employee — Jobs List (120:422; tab bar node 412:392 is literally the text "📋"), Employee — Status Update (120:489: 🚗📍🧹✅⚠️), Employee — Unable to Access (435:274: 🏠❌), Employee — Profile (447:274: ✏️)
**Problem:** Emoji render differently per OS, can't inherit state color (the "active" tab is indicated only by a 2.36:1 teal label — see C2), read inconsistently at small sizes, and clash with the icon style of the customer flow. The Jobs tab icon is even a different emoji on different frames (clipboard on 120:422, briefcase on 469:274).
**Suggested change:** Swap to a single icon set (e.g., Lucide, already in the shadcn stack) with proper active/inactive states.

### L3. Time formats are inconsistent and sometimes ambiguous
**Frames:** Admin Dashboard — Desktop (458:292: "11:00–2:00" — crosses noon with no AM/PM), Employee — Job History (120:518: "9:00–11:00"), Employee — Jobs List (120:422: "9:00 AM – 11:00 AM"), Admin Calendar — Weekly View (458:414: "10am–1pm")
**Problem:** Four formats across staff surfaces; "11:00–2:00" forces the reader to infer meridiem for a scheduling-critical value.
**Suggested change:** One format everywhere, always with meridiem on spans that could be ambiguous ("11:00 AM–2:00 PM").

### L4. Employee Sign In routes to a client login that doesn't exist
**Frame:** Employee Sign In (120:922)
**Problem:** "← Back to Client Login" points at Client Login (120:899), which is NOT IMPLEMENTED and not in launch scope (no client portal); placeholder text also measures 2.54:1 (#9CA3AF), low for the sunlight context even if placeholders are technically exempt when labels exist.
**Suggested change:** Link to the public homepage instead; darken placeholder text.

---

## Needs verification

- **Prototype interactions:** screenshots can't confirm click-through wiring — e.g., whether admin table rows, month-view day cells, and the This Week Sat/Sun chips are connected. The April 30 audit's B1 (job cards lacking ON_CLICK) may extend to these.
- **Profile toggle states (447:274):** the "New job assigned" toggle renders differently from the other four (solid vs knob-visible); may be an intentional pressed state or a stray variant.
- **Profile (30min Toggle Off) (471:274)** was not individually inspected (assumed a single-toggle variant of 447:274).
- **Weekly calendar chip fills (458:414):** chip text colors match the dashboard palette (#15803D / #D97706 / #1D4ED8); exact fills sampled near edges, so per-chip ratios are reported from the dashboard equivalents in M1.

---

## Design-to-code gap summary

**In Figma, not in code** (beyond H6's whole employee app): weekly employee-lane calendar with unassigned/drag affordances (458:414 — code uses plain `timeGridWeek`, `app/admin/calendar/CalendarView.tsx:146-152`, no resource lanes); employee availability metadata — ratings, zones, "Unavailable" (120:835 — no such columns in `employees`); Confirm action (C3 — absent in both, but the KPI demanding it is designed); employee profile fields email / Emp # / service areas (447:274 — schema has none); reschedule and client-message flows (buttons exist in both, flows in neither); the 6th employee ("5/6", 120:581 — DB seeds 5).

**In code, not in Figma:** Bookings list page with filters + search (`app/admin/bookings/page.tsx`, `BookingsSearch.tsx`); Employees roster page (`app/admin/employees/`); Settings page (`app/admin/settings/`); New Booking modal (`app/admin/NewBookingModal.tsx` — desktop Figma has only the button, tablet not even that); activity log on booking detail (`app/admin/bookings/[id]/page.tsx:160-166` — desktop Figma has it, tablet doesn't); cancelled-status rendering in admin UI (`app/admin/data/mock.ts:45,53` — no admin Figma frame shows a cancelled booking); "Unassigned" badge on calendar events (`CalendarView.tsx:60`). These five code-only screens/states have no design source of truth — they'll drift visually with every edit.

---

## Top 5 to fix before launch

1. **C1 — Unify the status model** across employee, admin, and DB, and give employee-reported Issue/Unable-to-Access states an admin destination. Everything else (notifications, dashboards, testing) builds on this.
2. **C2 + M1 — Fix the staff color system:** replace #3BBBAD with the spec primary on all employee/tablet controls and darken the failing status-chip/banner text (the chip values are already shipping in `mock.ts`).
3. **C3 — Add the Confirm Booking action** so the pending→confirmed step the dashboard demands can actually be performed.
4. **C4 + H1 — Make scheduling conflicts visible:** an Unassigned lane on the weekly calendar and time-scoped availability (with current assignee) on the assignment screen.
5. **H2 — Design the mid-flight lifecycle:** cancellation/reassignment interrupts on the employee side, guarded actions on in-progress bookings, and an undo path after Complete.
