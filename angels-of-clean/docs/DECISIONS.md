# Angels of Clean — Key Decisions & Context

Extracted from the Claude references directory (`ClaudeReferences/`), project memory, and planning docs.

---

## Project Context

- **Course:** CISY 5233 — Human Computer Interaction (capstone, solo project by Kayden)
- **Client:** Angels of Clean — a small residential + commercial cleaning company in Syracuse, NY (~15 field employees, 3-person admin team)
- **Deliverables (600 pts total):** Precedence Review (60), Discovery Paper (60), Design & Evaluation Doc (120), Figma Prototype (180), Usability Testing (90), Results Paper (90)
- **Grading note:** Professor interviews after submission; grade = Raw Score x Understanding Score — student must explain every decision

---

## Design Decisions

### Dual-path homepage (HeroSplit)
Residential and commercial have different decision-making structures. Residential is a household impulse buy with instant self-service booking. Commercial is a single SMB decision-maker who needs a quote, not a price. A single homepage presents exactly two CTAs — "Book Now" and "Get a Quote" — satisfying Hick's Law (minimize choices).

### No registration before booking
26% of users abandon when forced to create an account before purchasing (Baymard Institute, 2023). Adopted the Square Appointments pattern: optional account creation *after* booking confirmation, never before.

### 6-step residential flow (reordered from original 5)
Address was moved to Step 2 so ZIP service-area validation gates progress before property details. Multi-step forms convert 86% higher than single-page forms (13.85% vs 4.53%). Each step presents 1–3 fields max.

### Pricing is quote-based, not calculated
Pricing depends on equipment and resources evaluated by a manager per job. The static "From $X" labels are intentional starting estimates, not computed totals. **Do not build automated price calculation features.**

### Mobile-first 390px frames
60% of global web traffic is mobile (Statcounter, 2024). Primary residential client persona (Diane, 52, Cicero) is mobile-primary and books outside business hours.

### Touch targets: 44px standard, 56px employee actions
44px meets Apple HIG (exceeds WCAG 2.2 AA minimum of 24x24px). Employee primary action buttons are 56px because field conditions include gloves, outdoor light, wet hands, and time pressure.

### Inter font throughout
System-level in Figma, excellent mobile legibility, professional aesthetic. Scale: Display 32px / H1 24px / H2 20px / Body 16px / Caption 14px / Micro 12px.

### Primary color: #1A6B5A (deep teal-green)
5.8:1 contrast ratio on white — passes WCAG 2.2 AA. Earlier builds incorrectly used #1A6B6B; Agent 6 corrected the Figma paint style to the spec value.

### Nielsen's 10 Heuristics as primary framework
Chosen over Shneiderman's 8 Golden Rules — more granular for usability testing. Both are referenced in the academic papers.

---

## Tech Stack Conflicts

### BACKEND_PLAN.md vs actual implementation
The original `BACKEND_PLAN.md` specifies Prisma + Auth.js (NextAuth v5) + Vercel Postgres (Neon). The actual implementation uses **Supabase** (PostgreSQL + Auth + RLS) with raw SQL schema and the Supabase JS SDK. No Prisma, no Auth.js.

### Tech stack recommendation vs actual implementation
`tech_stack_recommendation.md` recommends the "Pragmatic Monolith" — Next.js 15 + Drizzle + Auth.js on Render with Neon Postgres. The actual build uses Next.js 16 + Supabase (not Drizzle, not Auth.js, not Render). The recommendation was written before implementation began; the actual stack diverged toward Supabase for faster development.

### Admin calendar: monthly vs weekly
The design spec calls for a weekly drag-and-drop calendar with employee lane columns (ZenMaid-style). The Figma prototype's original Admin — Calendar shows a monthly grid. Desktop frames (458:414) show a weekly view. The Next.js implementation uses FullCalendar with daygrid + timegrid. The prototype audit flagged this as NTH2 — H6 (admin drag-and-drop discoverability) is tested verbally for now.

---

## Known Prototype Issues (from April 30 audit)

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| B1 | Blocking | Employee job cards on Jobs List have ON_HOVER but no ON_CLICK → Job Detail. Blocks H3 testing. | Fix: add ON_CLICK connections to 3 JobCard instances |
| NB1 | Non-blocking | Step 3 Notes Focused — "Next BG" routes to Step 5 instead of Step 4. "Next Label" is correct. | Fix: change destination from 120:147 to 120:106 |
| NTH2 | Nice-to-have | Admin calendar is monthly, spec calls for weekly employee-lane drag-and-drop | H6 tested verbally |

---

## Usability Hypotheses

| ID | Hypothesis | Success Metric |
|----|-----------|----------------|
| H1 | Dual-path routing — clients self-identify correct path from homepage | >=90% correct on first attempt |
| H2 | 6-step booking form meets tolerance threshold | >=80% completion; no one rates it "too long" |
| H3 | Employee status update requires fewer actions than phone call | <=3 taps, <=10 seconds |
| H4 | Localized trust signals sufficient for first-time visitor confidence | >=75% report "confident" or "very confident" |
| H5 | Commercial clients complete B2B quote form with professional language and response commitment | >=75% task completion |
| H6 | Admin discovers drag-and-drop calendar without instruction | >=80% discover drag affordance without verbal prompting |

---

## Competitor Analysis (from Precedence Review)

### Adopted patterns
- **ZenMaid:** Drag-and-drop weekly calendar with employee lane columns
- **Housecall Pro:** Bidirectional real-time status flow (employee <-> admin)
- **Handy:** Instant self-service booking, "from $X" pricing on cards, three-touch notification sequence
- **Booksy:** Availability-first time slot display with visual states
- **Square Appointments:** Post-booking optional account creation, Add to Calendar

### Rejected patterns
- Forced registration before booking (26% abandonment)
- Marketplace contractor model (commoditizes local brand)
- GPS vehicle tracking (excessive for small team)
- AI-assisted dispatch (over-engineered for 3-admin operation)
- Browse-first navigation (clients already chose the company)

---

## Design System Tokens

| Token | Hex | Contrast | Use |
|-------|-----|----------|-----|
| Primary | #1A6B5A | 5.8:1 | Main CTA, active states |
| Primary Dark | #124D41 | 8.2:1 | Pressed states |
| Secondary | #2C7873 | 4.9:1 | Trust badges, info tags |
| Error | #C0392B | 4.9:1 | Form errors, unavailable |
| On-Surface | #1C1C1E | 16.8:1 | Body text |
| On-Surface Light | #5C5C5E | 7.1:1 | Captions, secondary text |

30 color styles total, 19 text styles. 8px spacing grid. Border radius: 12px (buttons/cards), 8px (inputs/chips).

---

## Agent Pipeline History

The Figma prototype was built by a multi-agent pipeline (Agents 1–6) running in Claude Code CLI between April 3–14, 2026:

| Agent | Role | Output |
|-------|------|--------|
| Agent 1 | Design brief synthesis | `design_brief.md` |
| Agent 2 | Screen planning | `screen_plan.json` (30 screens) |
| Agent 3 | Figma builder | `figma_build_log.md` (frame IDs, connections) |
| Agent 4 | Validation | `validation_report.md` (55 issues) |
| Agent 5 | Prototype wiring | Reordered to 6 steps, added connections |
| Agent 6 | Polish | Fixed 8 issues including primary color correction |

Post-pipeline: Validation Orchestrator confirmed 55 connections. Prototype audit (April 30) found 463 connections on the Usability Test Prototype page.

---

## Accessibility Requirements (WCAG 2.2 AA)

- Text contrast: >=4.5:1 normal, >=3:1 large text
- UI component contrast: >=3:1
- Touch targets: >=44px (standard), >=56px (employee primary actions)
- Target spacing: >=8px between adjacent targets
- Body text: >=16px
- Labels above inputs (never placeholder-only)
- Error states: color AND icon (never color alone)
- Field-specific plain-language error messages

---

## Open Questions (from tech stack recommendation)

1. Could a PWA replace a native employee app for v1? iOS push reliability is spotty but 15 cleaners on a graded project might be enough.
2. Does Angels actually take payment up front or bill after cleaning? Affects whether Stripe is needed in v1.
3. A2P 10DLC SMS registration takes 2–4 weeks — must start early if SMS is in v1.
