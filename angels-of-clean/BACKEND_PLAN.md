# Angels of Clean — Backend Implementation Plan

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Database** | Vercel Postgres (Neon) | Native Vercel integration, serverless-friendly, SQL |
| **ORM** | Prisma | Type-safe queries, migrations, excellent Next.js DX |
| **Auth** | Auth.js (NextAuth v5) | Flexible providers, role-based access, supports admin + client |
| **API** | Next.js Server Actions + Route Handlers | Co-located with frontend, no separate server |
| **Validation** | Zod | Runtime schema validation, pairs with Prisma types |
| **Email** | Resend | Vercel marketplace integration, transactional emails |
| **SMS** | Twilio | Industry standard, reliable delivery |
| **Client-side data** | SWR | Polling/revalidation for admin real-time updates |

---

## Database Schema (PostgreSQL via Prisma)

### User

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| email | String | Unique |
| name | String | |
| phone | String? | |
| role | Enum: ADMIN, CLIENT | |
| passwordHash | String | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Employee

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| name | String | |
| email | String | Unique |
| phone | String | |
| initials | String | |
| zone | String | |
| rating | Float | |
| hiredDate | DateTime | |
| isActive | Boolean | Default true |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### Booking (Residential)

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| bookingNumber | String | Auto-generated, e.g. "AOC-2026-0042" |
| clientId | UUID? | FK → User (nullable for guests) |
| serviceType | Enum: STANDARD, DEEP, MOVEINOUT | |
| frequency | Enum: ONE_TIME, WEEKLY, BI_WEEKLY, MONTHLY | |
| address | String | |
| city | String | |
| state | String | Default "NY" |
| zip | String | |
| bedrooms | Int | |
| bathrooms | Int | |
| notes | String? | |
| scheduledDate | DateTime | |
| timeSlot | Enum: MORNING, AFTERNOON | |
| startTime | DateTime | |
| endTime | DateTime | |
| guestName | String? | For non-logged-in clients |
| guestEmail | String? | |
| guestPhone | String? | |
| status | Enum: PENDING, CONFIRMED, ACTIVE, DONE, CANCELLED | |
| submittedAt | DateTime | |
| confirmedAt | DateTime? | |
| completedAt | DateTime? | |
| cancelledAt | DateTime? | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### BookingAssignment (Many-to-Many)

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| bookingId | UUID | FK → Booking |
| employeeId | UUID | FK → Employee |
| assignedAt | DateTime | |

### BookingStatusLog (State Transitions)

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| bookingId | UUID | FK → Booking |
| fromStatus | String? | Null for initial creation |
| toStatus | String | |
| changedById | UUID? | FK → User (nullable for system actions) |
| note | String? | |
| createdAt | DateTime | |

### CommercialQuote

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| quoteNumber | String | Auto-generated |
| facilityType | String | |
| sqftRange | String | |
| floors | Int | |
| address | String | |
| city | String | |
| state | String | Default "NY" |
| zip | String | |
| serviceAreas | JSON | Array of area IDs |
| notes | String? | |
| contactName | String | |
| businessName | String | |
| email | String | |
| phone | String | |
| frequency | String | |
| schedulePreference | String | |
| status | Enum: SUBMITTED, REVIEWING, QUOTED, ACCEPTED, DECLINED | |
| submittedAt | DateTime | |
| createdAt | DateTime | |
| updatedAt | DateTime | |

### ServiceArea

| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| zip | String | Unique |
| city | String | |
| isActive | Boolean | Default true |

---

## API Layer

### Booking Submission (Server Actions)

- `submitResidentialBooking()` — validates ZIP against ServiceArea table, creates Booking with status PENDING, sends confirmation email + SMS, creates initial BookingStatusLog entry
- `submitCommercialQuote()` — creates CommercialQuote with status SUBMITTED, sends admin notification email

### Admin Operations (Route Handlers + Server Actions)

- `GET /api/bookings` — list/filter bookings (today, upcoming, past, by status, by employee)
- `PATCH /api/bookings/[id]/status` — transition status (validates allowed transitions)
- `POST /api/bookings/[id]/assign` — assign employee(s), creates BookingAssignment records
- `PATCH /api/bookings/[id]/reschedule` — update date/time
- `POST /api/bookings/[id]/cancel` — cancel with reason, logs status change
- `GET /api/employees` — list employees with today's job counts
- `POST /api/employees` — create employee
- `GET /api/bookings/[id]` — full detail with activity log (joined BookingStatusLog)
- `GET /api/dashboard/stats` — aggregated stats for dashboard cards

### Client Operations

- `GET /api/my/bookings` — authenticated client's booking history
- `POST /api/my/bookings/[id]/reschedule` — client-initiated reschedule
- `POST /api/my/bookings/[id]/cancel` — client-initiated cancel

### Calendar

- `GET /api/calendar/events` — jobs for FullCalendar, filtered by date range

---

## Frontend Integration — What Changes

| Current State | Becomes |
|---|---|---|
| `app/admin/data/mock.ts` (static arrays) | Prisma queries in Server Components |
| Zustand sessionStorage → nowhere | Zustand → Server Action on submit → database |
| Dashboard stat cards (hardcoded counts) | `SELECT COUNT(*)` queries with SWR refresh |
| Action buttons (no-ops) | Server Actions that mutate DB + revalidate cache |
| Admin job table | Server Component with filter params in URL |
| Calendar `FC_EVENTS` from mock | API route returning events for date range |
| "Confirm Booking" button (redirect only) | Server Action → insert booking → send notifications → redirect |
| Activity log (mock array) | `BookingStatusLog` table joined with users |

---

## Auth Flow

### Admin

- Email/password login at `/admin/login`
- Protected by middleware — all `/admin/*` routes require `role: ADMIN`
- Session stored in HTTP-only cookie (JWT or database sessions)

### Client (Optional)

- Sign up via email after booking (the "Create Account" upsell on confirmation page)
- Email/password (magic link can be added later)
- Can view/reschedule/cancel their bookings at `/account/bookings`
- Guest booking still works without an account

---

## Notification Flow

### On Booking Submission

1. Insert booking → status: PENDING
2. Send client confirmation email (Resend) with booking details
3. Send client confirmation SMS (Twilio)
4. Send admin notification email ("New booking received")

### On Status Change (Admin Action)

- CONFIRMED → email/SMS to client: "Your booking is confirmed"
- CANCELLED → email to client: "Your booking has been cancelled"
- DONE → email to client: "Cleaning complete — leave a review?"

---

## Implementation Phases

| Phase | Scope | Depends On |
|---|---|---|
| **1. Database + Prisma** | Schema, migrations, seed with current mock data | Vercel project + Postgres provisioned |
| **2. Auth** | Auth.js setup, admin login page, middleware, client signup | Phase 1 |
| **3. Admin API + frontend swap** | Replace mock data with DB queries, wire up action buttons | Phase 1 |
| **4. Booking submission** | Server Action for residential + commercial, ZIP validation against DB | Phase 1 |
| **5. Notifications** | Resend email + Twilio SMS on booking + status changes | Phase 4 |
| **6. Client portal** | `/account` routes, booking history, reschedule/cancel | Phase 2 + Phase 4 |

---

## Setup Steps (Interactive — Requires User)

1. Upgrade Vercel CLI: `npm i -g vercel@latest`
2. Link project: `vercel link`
3. Create Postgres database: Vercel Dashboard → Storage → Create Database → Postgres
4. Pull env vars: `vercel env pull .env.local`
5. Then Claude can: install Prisma, run migrations, seed data, set up Auth.js

---

## Decisions Made

- **Auth**: Start with email/password, add OAuth later
- **Payments**: None — pricing is quote-based, manager-evaluated per job
- **Deployment**: Vercel
- **Database**: SQL (Postgres)
- **Status logging**: Full state transition tracking per booking (BookingStatusLog)
