# Design Audit — Customer-Facing Flows

Date: 2026-09-18 · Scope: entry/auth, residential booking, and commercial quote flows — Figma page `120:2` (file `Puf4bVpEq4KAkUhK0nnGtw`) plus their implementations under `app/`. Findings only; nothing was changed.

Method: every listed frame was rendered at 1:1 (390×844) and inspected; colors were sampled from flat fills and glyph cores of those renders, so measured hexes are exact for fills and accurate-to-the-pixel for text. Code paths relative to `angels-of-clean/`. Backend/runtime issues already covered in `code-audit.md` are cross-referenced by their IDs (C/H/S), not repeated.

**Top 5 (in order):**
1. The commercial flow's success screen is fiction — nothing is ever submitted (D1 / code-audit C3).
2. The Figma primary teal is `#3BBBAD`, not the documented `#1A6B5A` — nearly every CTA, link, and selected state in the prototype fails WCAG contrast, and the code ships three *other* primary colors (D2, D14).
3. Three conflicting price stories: Figma says From $85/$149/$199, step 1 in code says From $120/$200/$250, review in code says no number at all (D3).
4. The implemented homepage is a placeholder that discards every trust signal in HeroSplit and exposes an admin link to customers (D4).
5. Add-Ons is orphaned: outside the step count, its selections appear in no review or confirmation, unimplemented in code, and its own checkmark badge covers the price (D5).

---

## A. Critical logic & trust

### D1 · Critical — Commercial quote requests vanish behind a fabricated confirmation
**Evidence:** `app/commercial/review/page.tsx:42-46` — `handleSubmit` only calls `router.push("/commercial/confirmation")`; no action is invoked. The confirmation invents a reference client-side (`COM-{year}-{random}`, `app/commercial/confirmation/page.tsx:16-20`) — refresh the page and the "reference" changes — while promising follow-up "within one business day" (`:86-88`), matching Figma Com Quote Confirmation (`120:406`) "Confirmation sent to: …". No email exists (code-audit H5).
**Why it matters:** Every commercial lead is silently destroyed while the customer holds a reference number that references nothing. This is the H5 hypothesis ("professional language and response commitment") implemented as the commitment without the response. Already Critical in code-audit (C3); repeated here because it is also a *design* gap: Figma has no failure state for the quote submission at all, so even a wired-up action has nothing designed to fall back to.

### D2 · Critical — The prototype's primary color is `#3BBBAD`, not the spec'd `#1A6B5A`; the code uses three further colors
**Evidence (Figma, measured):** Book Now fill on Homepage — HeroSplit (`120:3`), selected service card and frequency chip on Step 1 (`120:20`), selected date on Step 4 (`120:106`), links and prices throughout all sample as `#3BBBAD`. `docs/DECISIONS.md:39-40` specifies Primary `#1A6B5A` (5.8:1) and claims "Agent 6 corrected the Figma paint style to the spec value" — the frames still render `#3BBBAD` (white on it: **2.36:1**).
**Evidence (code):** mobile primary CTAs (`BottomCTA` → shadcn `Button` default) render near-black `--primary: oklch(0.205 0 0)` (`app/globals.css:58`); residential desktop CTAs hardcode `#1a6b5a` (`app/residential/page.tsx:143`); selected chips use `bg-teal-600` in residential (`app/residential/page.tsx:128`) but `bg-teal-700` in commercial (`app/commercial/contact/page.tsx:179`).
**Why it matters:** a first-time customer sees a black button on the homepage, a teal-600 chip at step 1, a `#1a6b5a` button on desktop — and the usability-test prototype shows a fourth color that fails AA everywhere (Section E). Pick `#1A6B5A`, fix the Figma paint style for real, and map it to `--primary`.

### D3 · Critical — Three conflicting price stories across the same flow
**Evidence:**
- Figma Step 1 (`120:20`): From **$85 / $149 / $199**; Figma Review (`120:171`): "Estimated starting price: from $85".
- Code Step 1 (`app/residential/page.tsx:17,24,31`): From **$120 / $200 / $250**.
- Code Review (`app/residential/review/page.tsx:141`): no number — "Quote provided after confirmation".
- `PRICE_MAP` in `lib/constants.ts:31-35` still holds $85/$149/$199 and is referenced **only by its own test** (`lib/__tests__/constants.test.ts:37-41`) — a dead constant whose test enshrines prices the UI no longer shows.
**Why it matters:** a customer anchored at "From $120" at step 1 reaches review and the number disappears; if the Figma prototype is what was usability-tested, it tested prices the product doesn't show. Per DECISIONS.md pricing is quote-based — fine — but the *starting* anchor must be one number, shown consistently at step 1 and review, with one sentence about how the final price is set (see D7).

### D4 · High — Implemented homepage is a placeholder; every HeroSplit trust element is missing and an admin link is exposed
**Evidence:** `app/page.tsx:5-29` renders a centered card, "Select a booking flow to continue", two buttons, and "Admin Dashboard →" (`:21-23`). Figma `120:3` has: ★ 4.9 (127 reviews) · Insured & Bonded · Background-Checked, a customer testimonial, service list, the nine-town service area, and the phone header. `docs/FIGMA_MAP.md:13` marks `120:3` as implemented by `app/page.tsx` — it is not, in any meaningful sense.
**Why it matters:** H1 (dual-path routing) and H4 (localized trust signals) both live on this screen; the deployed page tests neither. "Select a booking flow to continue" is system language, not customer language. And the admin entry point doesn't belong on the customer homepage (defense-in-depth aside, it's noise per Hick's-Law rationale in DECISIONS.md). Note: if the review count/testimonial ship, they must be real — fabricated social proof on a production site is a trust and legal liability.

### D5 · High — Add-Ons & Extras is orphaned in the flow, and its badge covers the price
**Evidence:** Frame `120:223` has no "Step x of 6" counter and no progress dots — the only flow screen without them — just "← Back". Its selections appear nowhere downstream: Review (`120:171`) has only Service / Property / Date & Time / Contact cards, Confirmation (`120:202`) shows none. Not implemented in code (`docs/FIGMA_MAP.md:24`), and nothing in `store/bookingStore.ts` could hold add-ons. Visual: on the selected "Inside Refrigerator" card the circular checkmark badge overlaps the "+$…" price, truncating it (visible in the `120:223` render).
**Why it matters:** as designed, a customer can select paid extras that then silently disappear from their order summary — the exact "hidden charges" pattern that erodes trust. Also, fixed "+$30" prices sit oddly beside the quote-based-pricing decision (DECISIONS.md:27-28) unless labeled as estimates. Decide: either make Add-Ons a real numbered step whose selections render in Review/Confirmation (and in the data model), or cut the frame before usability testing bakes it in.

### D6 · High — Step 4's two error states contradict their own screens, and neither is reachable in code
**Evidence:**
- Date Unavailable (`386:225`): error reads "This date is fully booked" while the selected date (Tue 14) renders as a normal teal *selected* chip and the "Full" badge sits on a different, unselected day (Wed 15). Morning stays selected; Next stays enabled. If a date is known-full it should be disabled like Wed 15 — the state shown cannot arise.
- Evening Unavailable (`402:247`): error says "Evening appointments are currently unavailable. Please select Morning or Afternoon" — but the Evening card is already rendered disabled ("Unavailable"), and Morning is *already selected*. The error demands an action the screen already satisfies.
- Code: `app/residential/datetime/page.tsx` renders no error UI at all; full dates and Evening are `disabled` buttons (`:96,135`), so both designed errors are dead frames. `docs/FIGMA_MAP.md:19-20` claiming they map to this page "(error state)" is wrong.
- Evening itself is a permanently-unavailable option: `TimeSlot` is `"morning" | "afternoon"` (`store/bookingStore.ts:7`), DB `time_slot` likewise (PROJECT_MAP). Every frame shows it as unavailable.
**Why it matters:** the prototype will confuse usability-test participants with errors that can't logically occur, and showing a slot that can never be booked is pure noise — either drop Evening or add "Evenings coming soon" honesty. Availability itself is fake in code (hardcoded `isFull: i === 2`, 6-day window, dead month arrows — code-audit H1); the design should specify what *real* unavailability looks like at day- and slot-level, because that's the Booksy pattern DECISIONS.md says was adopted.

### D7 · High — At the moment of commitment, the customer isn't told what happens next
**Evidence:** Figma Confirmation (`120:202`) says "You're booked!" but the record lands as status `pending` awaiting admin confirmation (PROJECT_MAP bookings.status), and the price is set later by a manager. Neither `120:202` nor Review (`120:171`) nor the code (`app/residential/review/page.tsx`, `confirmation/page.tsx`) says: when the final price is confirmed, that no payment is taken now, or how to cancel/reschedule (no path exists — code-audit H5). The commercial confirmation (`120:406` / `app/commercial/confirmation/page.tsx:168-186`) does this well ("What happens next?" 1-2-3) — the residential flow, the one taking an actual calendar commitment, has nothing.
**Why it matters:** trust checklist ("know the price, when charged, how to cancel") fails exactly at Confirm Booking. Minimum fix is copy: a line on Review ("No payment now — we confirm your final quote before your cleaning") and a next-steps block + cancellation phone line on Confirmation. Note the Figma confirmation card also **omits the booked date** (shows service, time window, address only — `120:202`) and any reference number; the code version fixes both (`confirmation/page.tsx:58-65`) — update the frame to match.

### D8 · High — Service-area ZIP list rejects Camillus, a town the UI promises to serve
**Evidence:** `lib/constants.ts:39` — `"13035", // Camillus`. Verified: 13035 is **Cazenovia** (Madison County); Camillus is **13031**, absent from the list. Both flows gate on this list (`app/residential/address/page.tsx:34`, `app/commercial/page.tsx:48`, both server actions). Step 2 (`120:52` and `app/residential/address/page.tsx:108`) and the homepage (`120:3`) explicitly name Camillus as served.
**Why it matters:** every Camillus resident is told "We don't currently serve this area" while a town ~20 miles east outside the advertised area can book. This upgrades code-audit S4 from "Needs verification" to confirmed (sources: [zip-codes.com 13031 Camillus](https://www.zip-codes.com/zip-code/13031/zip-code-13031.asp), [Wikipedia — Cazenovia, NY](https://en.wikipedia.org/wiki/Cazenovia,_New_York)). Owner should still re-verify the full list against USPS.

---

## B. Residential vs. commercial consistency

### D9 · Medium — Same concepts, arbitrarily different controls and orders
- **Frequency:** residential = 4 horizontal chips, order One-time → Monthly, solid-fill selection (`120:20`); commercial = 4 stacked full-width radio cards, order Weekly → One-time, light-fill + checkmark selection (`120:347`). In code, commercial adds **Daily** and **2–3x / Week** (`lib/constants.ts:91-101`) that exist in no Figma frame.
- **Selected states:** residential selected = solid teal + white text (`120:20`, `120:106`); commercial selected = light teal + teal text + check (`120:314`, `120:347`). Code has a third pattern (facility type: `bg-teal-50 text-teal-700`, `app/commercial/page.tsx:97`) alongside `bg-teal-600` and `bg-teal-700` fills.
- **Desktop chrome (code only):** residential uses `DesktopNavbar` (logo image, phone, dot-style `DesktopStepper`, `#1a6b5a`); commercial uses `CommercialNav` (text wordmark, different phone, circle-style `CommercialStepper`, teal-600/700). Two navbars, two steppers, two phone numbers, one company.
**Why it matters:** none of these differences encode a real B2C/B2B distinction; they read as two different products and double the pattern surface to test and maintain.

### D10 · Medium — Address & service-area gating differs between flows in design, and design vs. code
**Evidence:** Figma commercial Step 1 (`120:286`) has a single free-text "Service Address" with no ZIP field and no outside-area state, while claiming "We serve small businesses across the Syracuse area"; residential gates hard on ZIP with a dedicated error screen (`120:260`). Code fixed commercial (street/city/ZIP + allowlist check → `/commercial/error`, `app/commercial/page.tsx:32-52`) — so the shipped flow diverges from its own prototype, and the prototype can't test the commercial rejection path at all.
**Note:** the outside-area error highlights the wrong field in Figma — `120:260` draws the red border on **Street Address** while ZIP (the thing actually validated) renders normal. Its step label also reads "Step 2b of 6", a numbering style used nowhere else. Code version (`app/residential/error/page.tsx:34`) copies the same wrong-field emphasis.

### D11 · Medium — Three different phone numbers face the customer; one screen makes the number untappable
**Evidence:** `(315) 555-CLEAN` — Figma throughout + `app/residential/error/page.tsx:44` (plain text, not a `tel:` link, on the exact screen that says "call us for a custom quote"); `(315) 555-0100` — all commercial code surfaces (`CommercialNav.tsx:10`, `app/commercial/error/page.tsx:88` etc., as tappable links) *and* as the placeholder inside phone inputs in both flows (`app/residential/contact/page.tsx:104`), so the company's advertised number doubles as the example of the customer's own number; `(315) 516-1266` — residential `DesktopNavbar.tsx:27`. 555 numbers cannot ship.
**Why it matters:** phone is the fallback for every error path in this design; it must be one real, tappable number everywhere.

### D12 · Low — Copy diverges between flows and between design and code
- Step titles: "Tell us about your home" (`120:76`) vs. code "Tell us about your property"; "What do you need cleaned?" (`120:314`) vs. code "Define the scope of service" (`app/commercial/services/page.tsx:59`). The code's B2B register is arguably better for H5 — but the tested prototype and the product should say the same thing.
- Commercial service-area taxonomies are **entirely different lists**: Figma `120:314` = Offices & Workstations / Restrooms / Break Room-Kitchen / Reception & Waiting Area / Hallways & Common Areas (5); code = Lobbies & Reception / Restrooms / Break Rooms-Kitchens / Conference Rooms / Open Office-Cubicles / Stairwells & Hallways (6) (`lib/constants.ts:82-89`). Only Restrooms survives intact.
- `PROJECT_MAP.md:37` calls the commercial form "5 steps"; Figma and code are 4 + confirmation.
- Figma Review (`120:171`) copy bugs that shipped from design: "Standard Clean ·One-time", "2 Bed,1 Bath", "Tue, April 14 ·Morning" (missing spaces); Step 4 mixes "8am–12pm" and "12pm – 4pm" dash spacing. Code has its own: "1 Bedrooms" / "2 Bathroom" — plural hardcoded on the wrong nouns (`app/residential/review/page.tsx:82`, `confirmation/page.tsx:120`).
- Commercial step 1 desktop back link reads "← Back to Commercial Services" but navigates to `/` (`app/commercial/page.tsx:204-209`).

---

## C. Missing states & dead ends

### D13 · High — Designed screens with no product behind them; product states with no design
**In Figma, not in code (per `FIGMA_MAP.md`, confirmed):** Client Login (`120:899`), Sign Up (`120:942`), Booking History — Empty (`120:250`), Add-Ons (`120:223`), Error — Global 503 (`120:967`).
- Booking History exists **only** as an empty state — no populated list, no cancel/reschedule affordances (the main reason a portal would exist), and no navigation path reaches it from any customer frame: an orphan screen requiring accounts that don't exist.
- Yet the product *advertises* the account loop everywhere: "Create Account" on both confirmations, "Log In" in both desktop navs — all dead buttons (`app/residential/confirmation/page.tsx:84,139-141`; `CommercialNav.tsx:12-17`; `DesktopNavbar.tsx:29-31`; code-audit S5). Either implement login → history → cancel/reschedule, or remove every entry point for v1.
- Sign Up (`120:942`) references "Terms of Service and Privacy Policy" — neither exists in design or code, while both contact steps promise "We never share your data" (`120:147`, `app/residential/contact/page.tsx:122`). Shipping a PII-collecting booking site without a privacy policy is a legal gap, not just a design one.
- Login (`120:899`) vs Sign Up (`120:942`) label the same escape hatch differently: "Continue as Guest" vs "Continue Without Account".
**In code, not in Figma:** every desktop layout of both customer flows (`ResidentialShell`, `BookingSummary` sidebar, both steppers, both navbars) — customer frames are 390px-only, so desktop shipped with no design source; commercial floors stepper, schedule preference, notes field, facility-type grid (`app/commercial/services/page.tsx:66-97,174-190`, `contact/page.tsx:190-247`); the commercial outside-area error page.
**Missing in both:** submission-in-progress design (code has text-swap "Submitting…", no designed state); residential submission-failure (code renders a bare red sentence, `app/residential/review/page.tsx:168-170`; the designed 503 screen `120:967` with Try Again is implemented nowhere — `FIGMA_MAP.md:96` maps it to `app/commercial/error/page.tsx`, which is actually an outside-area page); payment failure (n/a by design — fine, but say so in DECISIONS); session expiry (state persists in `sessionStorage`, `store/bookingStore.ts:155` — a tab reopened days later silently resubmits a stale date; combine with code-audit S2/H2).

---

## D. WCAG 2.2 AA (measured)

Ratios computed from 1:1 renders (Figma) and Tailwind/token hexes (code). AA thresholds: 4.5:1 normal text, 3:1 large text (≥24px, or ≥18.66px bold) and UI components.

### Figma frames — the `#3BBBAD` problem is systemic

| Element (frames) | Colors | Ratio | Verdict |
|---|---|---|---|
| White text on primary CTAs & selected chips/cards/dates (`120:3`, `120:20`, `120:106`, all steps) | #FFFFFF on #3BBBAD | **2.36:1** | Fail (all sizes; also fails 3:1 UI) |
| Teal links & prices on white: header phone (`120:3`), "From $149" (`120:20`), Edit links (`120:171`), "+$30" (`120:223`), "Forgot password?"/"Sign up" (`120:899`) | #3BBBAD on #FFFFFF | **2.36:1** | Fail |
| Selected-card subtext "Regular maintenance cleaning" (`120:20`) | #E5F9F7 on #3BBBAD | **2.16:1** | Fail |
| Selected "Bi-weekly" text (`120:347`) | #3BBBAD on #E5F9F7 | **2.16:1** | Fail |
| "Get a Quote — Commercial" text/border (`120:3`) | #FC6367 on #FFFFFF | **2.95:1** | Fail (text); border under 3:1 UI |
| Password hint & Terms line (`120:942`), privacy note (`120:147`) | #BDBDBD on #FFFFFF | **1.88:1** | Fail |
| "Full" date badge (`120:106`) | #A1A8B4 on #F7F9F8 | **2.26:1** | Fail — and it is the only textual signal a date is unavailable |
| Evening "Unavailable" (`120:106`) | #9CA3A0 on #F7FFFF | **2.54:1** | Disabled-control exemption arguable, but it conveys information |
| Error messages (`386:225`, `402:247`, `120:260`) | #C0392B on white/red-50 | **5.44:1** | **Pass** — matches the DECISIONS token; the one place the token system was used |

Also `#FC6367` collides semantically with the error red — the commercial CTA is the same hue family as every error banner, on the first screen a customer sees.

### Code

| Element | Colors | Ratio | Verdict |
|---|---|---|---|
| Inline validation errors, both flows (`app/residential/address/page.tsx:100`, `contact/page.tsx:73-117`, `app/commercial/contact/page.tsx:98-150`) | red-500 #EF4444 on white | **3.76:1** | Fail — use the token #C0392B (4.9:1) or red-600 (4.83:1) |
| Edit links (`app/residential/review/page.tsx:128`); white on teal-600 selected chips/dates (`page.tsx:128`, `datetime/page.tsx:102`) | teal-600 #0D9488 ↔ white | **3.74:1** | Fail at 14–18px (18px bold is still below the 18.66px-bold large-text line) |
| Helper text incl. the commercial validation instruction "Select at least one area to continue" (`app/commercial/services/page.tsx:168-170`), "Your information is secure…" (`app/residential/contact/page.tsx:121-123`), review card labels (`review/page.tsx:127`) | zinc-400 #A1A1AA on white | **2.56:1** | Fail |
| White on teal-700 (commercial selected chips, `contact/page.tsx:179`) | #FFFFFF on #0F766E | **5.47:1** | Pass |
| Secondary text zinc-500; brand #1A6B5A on white | — | 4.83:1 / 6.37:1 | Pass |

### Structure, targets, focus
- **Errors color-only-ish in code:** DECISIONS.md:141 requires icon + color; Figma complies (⚠/❗ icons), but code inline errors and the review submit error are icon-less red sentences (`app/residential/review/page.tsx:168-170` isn't even `role="alert"`, unlike the commercial ones which are).
- **Target size:** month-nav arrows are inline text glyphs in `120:106` (~14px, under the 24×24 minimum) and in code are desktop-only *and inert* (`app/residential/datetime/page.tsx:76-78`). Everything else checks out: date chips ≥52×64, CTAs 52-56px in frames and `h-14` in code, 44px back target (`StepHeader.tsx`).
- **Focus:** the only focus state designed in the entire customer set is the Notes textarea (`380:207`). No focus treatment exists for the radio-card/chip patterns that dominate the flows. In code, shadcn buttons have a `focus-visible` ring, but every hand-rolled `<button>` (service cards, chips, date chips, desktop CTAs) declares none — they inherit the browser default outline. **Needs verification** in-browser that the default outline survives on all of them; specify a visible focus style (e.g. 2px `#124D41` offset ring) either way.
- **Screen-reader bugs:** `ProgressDots.tsx:18` — the ternary marks `i < currentStep` "completed" first, so the *current* dot is announced "completed" and the "current" branch is unreachable. Commercial checkboxes render a decorative `role="checkbox"` div *plus* the real sr-only input (`app/commercial/services/page.tsx:124-155`) — assistive tech encounters two checkboxes per option; drop the role on the visual div.
- **Fake time windows:** design and code both promise Morning 8–12 / Afternoon 12–4 while storage schedules 9–11 / 1–3 (code-audit H4/C4) — a trust failure that will read as "the cleaner came at the wrong time."

---

## E. FIGMA_MAP corrections (so the map stays trustworthy)

| FIGMA_MAP entry | Reality |
|---|---|
| `120:3` → `app/page.tsx` (line 13) | Placeholder card only; HeroSplit not implemented (D4) |
| `386:225`, `402:247` → datetime "(error state)" (lines 19-20) | No error states exist in `app/residential/datetime/page.tsx` (D6) |
| `120:967` Error — Global → `app/commercial/error/page.tsx` (line 96) | That file is an *outside-service-area* page; the 503/Try-Again design is implemented nowhere; the commercial outside-area screen has no Figma frame (D13) |
| Customer desktop layouts | Exist in code only — no frames (D13) |

---

## F. Worth fixing while in there (low)

- Login frame (`120:899`) uses a placeholder sparkle glyph where the logo belongs; code has a real SVG logo (`DesktopNavbar.tsx:12-19`).
- Homepage "★ 4.9 (127 reviews)" and the Sarah M. testimonial (`120:3`) need real sources before production (see D4).
- Figma commercial Review (`120:377`) omits Service Address, Business Type, and phone that Step 1/3 collect; code review includes them (`app/commercial/review/page.tsx:91-96,148-150`) — update the frame, it's the better behavior.
- Booking History empty state (`120:250`) uses a red/brown calendar illustration that reads as an error at a glance; neutral would be calmer.
- `BACKEND_PLAN.md` at repo root still describes the abandoned Prisma/Auth.js stack (already noted in PROJECT_MAP); it sits beside these docs and will mislead the next reader.

## Suggested order of attack

1. **D1** — wire the commercial submit (with code-audit C3's enum fixes) or pull the flow.
2. **D8** — swap `13035` → `13031` after the owner verifies the list.
3. **D2 + Section D** — one primary (`#1A6B5A`) across Figma paint style, `--primary`, and both flows' selected states; replace red-500/zinc-400/teal-600 text with passing tokens. This closes most WCAG rows at once.
4. **D3 + D7** — one price story and a "what happens next / no payment now / how to cancel" block on Review + Confirmation.
5. **D4** — build the real homepage; drop the admin link.
6. **D5, D6, D13** — resolve Add-Ons and the account loop (implement or cut), fix the Step 4 error-state logic, and re-sync FIGMA_MAP.
