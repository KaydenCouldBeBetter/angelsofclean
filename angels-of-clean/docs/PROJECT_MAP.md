# Angels of Clean — Project Map

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.10 |
| Language | TypeScript | 5 |
| React | React + React DOM | 19.2.4 |
| Database | Supabase (PostgreSQL) | SDK 2.110.8 |
| Auth | Supabase Auth (email/password) | via @supabase/ssr 0.12.3 |
| Styling | Tailwind CSS | 4 |
| UI components | shadcn/ui (Button, Card, Input, Label, Textarea) | — |
| Calendar | FullCalendar | 6.1.21 |
| State | Zustand (sessionStorage persistence) | 5.0.14 |
| Testing | Vitest | 3.2.1 |
| Bundler | React Compiler enabled | — |

## Run / Build / Test

```bash
npm run dev      # dev server on localhost:3000
npm run build    # production build
npm start        # serve production build
npm run lint     # ESLint
npm run test     # Vitest (run mode)
```

Requires `.env.local` with Supabase keys (see Environment Variables).
Database must be initialized with `supabase/001_initial_schema.sql`.

## Folder Structure

```
app/                        Next.js App Router root, home page
app/residential/            Multi-step residential booking form (6 steps)
app/commercial/             Multi-step commercial quote form (5 steps)
app/admin/                  Admin login + protected dashboard area
app/admin/dashboard/        KPI cards, today's jobs, pending/completed counts
app/admin/bookings/         Job list with filters, search; [id] detail/edit view
app/admin/calendar/         FullCalendar schedule view
app/admin/employees/        Employee roster and today's assignments
app/admin/settings/         Settings page (UI-only, not persisted)
app/admin/data/             Status config constants (STATUS_CONFIG, etc.)
app/actions/                Server Actions: submitBooking, submitCommercialQuote
app/api/admin/jobs/         Route handler — calendar event fetch by date range
components/ui/              shadcn primitives
components/booking/         Shared booking form components (Stepper, ProgressDots, etc.)
lib/                        Utilities
lib/supabase/               Supabase clients (server, service-role, middleware), queries, types
lib/constants.ts            Service labels, pricing labels, facility types, ZIP allowlists
store/bookingStore.ts       Zustand store for multi-step form state
supabase/                   001_initial_schema.sql — DDL, RLS policies, seed data
public/                     Logo, favicons
```

## Data Model

Source: `supabase/001_initial_schema.sql`, types: `lib/supabase/types.ts`

### bookings

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| booking_number | int | Auto-increment from 1000 |
| client_name, email, phone | text | Contact info |
| service_type | text | "standard", "deep", "moveinout" |
| frequency | text | "one-time", "weekly", "bi-weekly", "monthly" |
| address, city, zip | text | Location |
| bedrooms, bathrooms | smallint | 1–5 |
| notes | text | Nullable |
| scheduled_date | date | — |
| time_slot | text | "morning" or "afternoon" |
| start_at, end_at | timestamptz | Computed from time_slot |
| status | booking_status | Enum: pending, confirmed, active, done, cancelled |
| submitted_at, created_at, updated_at | timestamptz | — |

### employees

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| name | text | — |
| initials | text | e.g. "MT" |
| phone | text | — |
| hired_date | date | — |

5 seed employees: Marcus T., Ana V., Rosa C., Devon M., Lisa P.

### booking_employees

Join table. PK: (booking_id, employee_id). Cascade delete on booking, restrict on employee.

### activity_log

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| booking_id | UUID | FK |
| description | text | e.g. "Confirmed by admin@example.com" |
| created_at | timestamptz | — |

## Auth & Roles

### Admin

- Login at `/admin` with email/password (Supabase Auth).
- `middleware.ts` matches `/admin/:path*` — calls `supabase.auth.getUser()`; redirects to `/admin` if unauthenticated.
- Session managed via HTTP-only cookies (`lib/supabase/middleware.ts`).
- Server Actions (`app/admin/auth-actions.ts`): `signIn()`, `signOut()`.
- Admin can: view/filter bookings, change booking status, assign employees, view calendar and dashboard.

### Client (unauthenticated)

- Residential and commercial forms require no login.
- Booking inserted via service-role client (bypasses RLS).
- Client portal planned but not implemented.

### RLS enforcement

- Defined in `001_initial_schema.sql`.
- Authenticated (admin): SELECT + UPDATE on bookings, SELECT on employees, full access to booking_employees and activity_log.
- Anon: blocked from all tables.
- Service-role key used server-side only (`lib/supabase/service.ts`) for guest booking inserts.

## External Services

| Service | Status | Purpose |
|---------|--------|---------|
| Supabase | Integrated | Database, auth, RLS |
| FullCalendar | Integrated | Admin calendar view (`/admin/calendar`) |
| Resend | Planned | Transactional email (booking confirmations, status updates) |
| Twilio | Planned | SMS notifications |
| Stripe / payments | None | Pricing is quote-based, not automated |

## Environment Variables

| Name | Scope |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public — Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public — anon role JWT |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only — bypasses RLS for guest inserts |

Future (not yet required):
`RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`

## Unfinished / Known Issues

| Item | Location | Status |
|------|----------|--------|
| Commercial quote submission | `app/actions/submitCommercialQuote.ts` | Stubbed — `setTimeout` placeholder, no DB insert |
| Email/SMS notifications | — | Not implemented; planned via Resend + Twilio |
| Admin settings persistence | `app/admin/settings/page.tsx` | UI-only — `alert("Settings saved")`, nothing stored |
| Client portal | — | Not started; planned at `/account/bookings` |
| Service area ZIP validation | `lib/constants.ts` | Hardcoded ZIP list; should eventually query DB |
| Time slot windows | `app/actions/submitBooking.ts` | Hardcoded morning 09–11, afternoon 13–15 |
| Pricing | `app/residential/page.tsx` | Static "From $X" labels (intentional — quote-based) |
| BACKEND_PLAN.md | Root | Planning doc references Prisma + Auth.js; actual impl uses Supabase + raw SQL |
| Tests | 3 test files | Cover submitBooking validation, bookingStore, constants |
