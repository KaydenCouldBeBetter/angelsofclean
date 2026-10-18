# Performance Diagnosis: Why the App Is Slow Locally

**Measured:** 2026-10-14 · **Code at:** `5b7f22e` (branch `v2`) · **Status:** diagnosis only, nothing fixed yet

**How to read this**
- Section 1 answers "is this just dev mode?"
- Section 2 ranks the causes by how much time each costs, with the fix proposed for each.
- Section 5 explains how to re-measure, so a fix can be checked against these numbers.
- Every number was measured unless it is marked **inference**.

**Test machine:** Apple M2 (8 cores), 24 GB RAM, Node 20.20.2, Next.js 16.2.10 (Turbopack), local Chrome, home network near Syracuse, NY.

---

## 1. Short answer: is this mostly dev mode?

**Mostly yes.** The biggest dev cost, though, is not Next.js compiling. It is the **repo sitting in an iCloud-synced Desktop on a disk that is 96% full**, which makes Turbopack's file reads and its cache very slow.

| Same 18 public routes, first visit | Server time |
|---|---|
| Dev, repo in `~/Desktop` (iCloud), restart with existing cache | **38.3 s** (13.8 s to "Ready", 16.5 s for the first page) |
| Dev, identical copy outside iCloud, restart with existing cache | 7.3 s (0.28 s to "Ready") |
| Dev, outside iCloud, no cache at all | 5.0–6.3 s |
| **Production** (`next build && next start`) | **0.22 s** (3–5 ms per public page) |
| Any mode, repeat visit | ~20 ms per page |

In a real browser against the production build:
- Wizard pages fully load in **15–80 ms**.
- Clicking "Next" between steps takes **10–34 ms**.
- `next build` takes 7.7 s.
- **All customer-facing pages are prerendered as static files.**

What still costs time in production:
- **Admin pages and actions** make several Supabase round trips one after another, at about 100+ ms each (cause 3).
- **The occasional 25–51 s auth hang** (cause 2).

---

## 2. Causes, ranked by cost

### Cause 1: Repo inside iCloud Drive, with Optimize Mac Storage on and the disk nearly full

| | |
|---|---|
| **Affects** | Dev (and build); not deployed users |
| **Where** | `~/Desktop/AngelsOfClean`. Desktop is synced to iCloud (`FXICloudDriveDesktop = 1`). That includes `node_modules` (34,213 files, 592 MB) and `.next/dev` (Turbopack cache, ~1.4 GB). The disk had 8.8 GB free of 228 GB (96% used), and "Optimize storage" is enabled. |
| **Confidence** | High (A/B test on identical code) |

**Measured, same code in both locations:**

| Run | Ready | First `/` | 18 routes, first visit | iCloud daemon CPU |
|---|---|---|---|---|
| iCloud, restart with existing cache | 13.8 s | 16.5 s | **38.3 s** | 62 s |
| Outside iCloud, restart with existing cache | 0.28 s | 1.8 s | 7.3 s | 1.7 s |
| iCloud, no cache (run 2) | 0.27 s | 1.6 s | **18.9 s** (one route took 12.4 s) | 27 s |
| Outside iCloud, no cache (run 2) | 0.29 s | 1.5 s | 6.6 s | 6.7 s |

- With the dev server idle, the iCloud sync processes were the top CPU users: `fileproviderd` at 133%, `bird` at 58%, `cloudd` at 35%.
- macOS had removed the local copies of some `node_modules` files, keeping them only in iCloud. **Reading `node_modules/next/dist` (8k files) took 220 s the first time**, against 1.5 s outside iCloud. Once the files had downloaded again, reads took 0.17 s.
- Copying `node_modules` out of the folder took ~10 minutes for the same reason.
- The dev trace (`.next/dev/trace`) has compile outliers of 42 s (`/`) and 60 s (`/_not-found`). It also has "Ready in 17.1 s" starts.
- This explains why slowness comes and goes: it depends on what macOS has removed since the last run.

**Proposed fix:**
- Move the repo out of Desktop/Documents (for example `~/dev/AngelsOfClean`), or turn off "Desktop & Documents Folders" in iCloud Drive settings.
- Free disk space; aim for at least 15–20% free.
- Re-measure with section 5.

### Cause 2: Auth refresh retries make admin requests hang for 25–51 s

| | |
|---|---|
| **Affects** | Dev **and production**, intermittent |
| **Where** | `getUser()` at `lib/supabase/middleware.ts:32`, `app/admin/page.tsx:9`, `lib/supabase/require-admin.ts:26`. The retry loop itself is in `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:3936-3961` (auth-js 2.110.8). |
| **Confidence** | Mechanism: high (reproduced). What triggers it: medium (inference). |

**Mechanism:**
- When the access token has expired, `getUser()` first refreshes the session.
- If that refresh request fails with a network error or a 5xx/52x status, auth-js retries it, waiting 200 ms, 400 ms, 800 ms and so on, for up to 30 s.
- The last retry is sent at 25.4 s.
- Every `getUser()` call on a request pays this separately, so the waits add up.

**Measured:**
- The dev trace has **8 renders of `/admin?_rsc` taking 25.5–28.1 s**: five on 2026-09-06, two on 2026-09-18, and one on 2026-10-13 at 23:16 local. The last one was a 29.3 s request (1.1 s compile, 28.1 s render).
- **Reproduced** with an expired fake session and the Supabase URL pointed at an unreachable port:
  - `/admin` took **51.0 s**: 25.5 s in middleware, then 25.5 s in the page.
  - `/admin/dashboard` took **25.4 s** before redirecting.
- **Inference:** an admin action (Confirm/Assign) can wait about 51 s, because both middleware and `requireAdmin` call `getUser()`.

**Likely triggers (inference):** the laptop waking with Wi-Fi not yet back, a network drop, or Supabase returning 5xx (for example a free-tier project being paused or resumed).

**Proposed fix:**
- Put a timeout (about 3–5 s, for example with `Promise.race`) around auth calls. On timeout, show the "couldn't verify" or error state quickly instead of waiting.
- Check auth once per request, in middleware, and pass the result to the page instead of calling `getUser()` again in `app/admin/page.tsx`.
- Turn on `auth: { debug: true }` temporarily to catch the real trigger when it happens again.

### Cause 3: Supabase is far away on the network (round-trip latency)

| | |
|---|---|
| **Affects** | Dev **and production** |
| **Where** | Every Supabase call. The ones that run one after another are listed below. |
| **Confidence** | High for per-request cost; medium for exact page totals (see note) |

**Measured:**
- Supabase's gateway reports `x-envoy-upstream-service-time: 1–2 ms`. That is the time PostgREST and Postgres actually spend.
- End to end, each request takes **140–190 ms with curl**, and 95 ms minimum (100–290 ms median) from Node with a reused connection.
- So **about 99% of every query is network distance**. The nearest Cloudflare edge is Newark (`EWR`); the project's own region is about 100 ms of round trip beyond it.
- Connecting to the edge is only ~20 ms, so the distance lies past the edge.

| Path (Node, same calls and order as the app) | Median | Range |
|---|---|---|
| Admin page, dashboard-shaped (middleware `getUser`, then 5 queries in parallel) | 434 ms | 261–467 ms |
| Admin page, booking-detail-shaped (`getUser`, then 3 in parallel) | 216 ms | 197–345 ms |
| **Confirm** (middleware `getUser` → `requireAdmin` `getUser` → update → activity insert → dashboard re-render), see `app/admin/actions.ts:90-122` | **699 ms** | 554–952 ms |
| Residential submit in production (rate-limit RPC → booking insert → activity insert), see `app/actions/submitBooking.ts:151,169,194` and `lib/rate-limit.ts:46` | 307 ms | 297–314 ms |

**Notes:**
- Assign (`app/admin/actions.ts:53-85`) adds one more trip (delete, then insert). That cost is inferred.
- Dev skips the rate-limit RPC (`lib/rate-limit.ts:41`), so submits in dev are one trip shorter.
- These numbers were timed with the **public anon key**. RLS returns empty results to anon, so no customer data was read. Real signed-in pages were not measured (section 4).
- Your own dev trace agrees: admin page renders with no compile had a median of 76–355 ms and a p90 of 0.5–1.6 s.

**Proposed fix (biggest production lever first):**
1. **Run the server in the same region as the Supabase project** (check the region in the Supabase dashboard; on Vercel, set the function region to match). That turns ~100 ms per trip into a few ms.
2. Use `getClaims()` instead of `getUser()` in middleware. This project signs tokens with ES256 (the JWKS lists one ES256 key), so `getClaims()` verifies locally without a network call. It saves one trip on every `/admin` request, including link prefetches. If you need to detect revoked sessions, `getUser()` can stay in `requireAdmin` for actions.
3. Do each status change and its activity-log insert in one Postgres function call (RPC) instead of two trips. The same goes for the booking insert plus its log insert.

### Cause 4: Dev compiles each route on first visit

| | |
|---|---|
| **Affects** | Dev only |
| **Confidence** | High |

**Measured outside iCloud:**
- The first page compiles in ~1.5–2 s. That covers the root layout, Tailwind and the framework.
- Each later route compiles in 0.2–0.7 s. Your trace shows 0.4–3 s for admin routes.
- The first client-side visit to a route also compiles: `/residential/contact` took 3.3 s and `/residential/review` 2.0 s. The next pass took ~50 ms.
- Repeat visits take ~20 ms.

**Turbopack (the default) is already the faster bundler.** With `next dev --webpack`, all 18 routes took 14.6 s, against 6.3 s with Turbopack.

**Proposed fix:** none needed. This is how dev works. Turbopack's disk cache makes restarts fast, but only once cause 1 stops iCloud from removing and re-downloading the cache.

### Cause 5: No loading UI, so every navigation looks frozen

| | |
|---|---|
| **Affects** | How slow the app feels, in dev and production |
| **Where** | There are no `loading.tsx` files anywhere in `app/` |
| **Confidence** | High that there is no feedback (it's in the code); its effect on how slow it feels is an inference |

When you click an admin link, the old page stays on screen with no indicator until the new route has finished compiling (in dev), rendering, and every Supabase round trip.

**Proposed fix:** add `app/admin/loading.tsx` (a skeleton for the content area), or one per route.

### Cause 6: React Compiler adds a small compile cost and causes one production hydration bug

| | |
|---|---|
| **Affects** | Compile time: dev only. Hydration bug: dev **and production**. |
| **Where** | `next.config.ts` (`reactCompiler: true`); the bug is at `app/commercial/page.tsx:193` |
| **Confidence** | High (compared with the compiler on and off) |

**Compile cost:** on a cold dev start, all 18 routes took 6.2–6.3 s with the compiler and 5.0–5.2 s without it, about 1.1–1.3 s (~22%) more. It makes no difference to repeat visits.

**Hydration bug:**
- On line 193, `</span> if you&apos;re` compiles differently in the two builds:
  - The **server** build (SWC) drops the leading space: `"if you're unsure…"`.
  - The **client** build (React Compiler, which runs through Babel) keeps it: `" if you're unsure…"`.
- Every `/commercial` load throws "Hydration failed", which shows as React error #418 in production, and React re-renders that page in the browser from scratch. That costs about 10 ms of CPU locally.
- With the compiler off, the error is gone, but the phone number renders as "0100if you're" with no space.

**Proposed fix:** keep the compiler, and make the space explicit: `</span>{" "}if you&apos;re`.

---

## 3. Related finding: wizard guards redirect on refresh (a bug, not a slowdown)

This checks one of the original leads: the deep-link guards interacting with Zustand's sessionStorage hydration.

**Mechanism:**
- During hydration, Zustand v5 returns `getInitialState()`, i.e. all defaults (`node_modules/zustand/react.js:11`, the `useSyncExternalStore` server snapshot).
- The guard effects therefore see an empty store and call `router.replace("/residential")` (or `/commercial`).
- This happens even when sessionStorage holds a complete booking.
- Guards: `app/residential/address/page.tsx:22`, `app/residential/review/page.tsx:28`, `app/commercial/services/page.tsx:22`, `app/commercial/contact/page.tsx:30`, `app/commercial/review/page.tsx:37` (and the other residential steps).

**Measured:**
- **Dev:** refreshing or deep-linking any of steps 2–6 sends you back to step 1.
- **Production:** only `/residential/review` bounces. Residential steps 1–5 call `useSearchParams`, so the production build doesn't server-render them (the HTML contains `BAILOUT_TO_CLIENT_SIDE_RENDERING`), and their guards see the real state. `/residential/review` doesn't call it, so it is server-rendered and its guard redirects.
- The commercial steps don't call `useSearchParams` either, so they are probably affected the same way. **Not measured** with saved state.
- **Normal "Next" clicks are not affected.** Client-side navigation never redirected in either mode.

**Proposed fix:** don't run a guard until `useBookingStore.persist.hasHydrated()` is true (or `onFinishHydration` has fired). For example, keep a small `hydrated` flag and skip the redirect until it is set.

---

## 4. Not measured, and what it would take

| Gap | What's needed |
|---|---|
| Real signed-in admin pages, Confirm and Assign (numbers above are timed with the anon key) | A test admin account (`app_metadata.role = 'admin'`, see the `supabase/002` header) |
| A full end-to-end submission (Review → Confirmation) | Approval to write test rows, or a separate test Supabase project. Parts were timed (section 2, cause 3). |
| What actually triggers the 25 s auth hang | `auth: { debug: true }` on the server client, plus a note of network state when it happens |
| Production on the real host | A deployed copy and the Supabase project region (Cloudflare hides the region; check the dashboard) |
| Middleware cost of production link prefetches on admin pages | A signed-in production run with server request logs |
| Mobile and slow-network client performance | Chrome DevTools throttling or Lighthouse against the production build |

---

## 5. How to re-measure

Run these after a fix to compare against the numbers above.

**Dev route timing.** Next 16 prints compile time vs. your own code's time on every request:
```
GET /residential 200 in 956ms (next.js: 908ms, application-code: 48ms)
```
`next.js` is mostly compile; `application-code` is the render. To time all routes:
```bash
for r in / /residential /residential/address /commercial /admin; do
  for pass in first repeat; do
    curl -s -o /dev/null -w "$pass %{http_code} %{time_total}s $r\n" "http://localhost:3000$r"
  done
done
```

**Truly cold dev run:**
1. Stop every dev server and wait for its child processes to exit. Turbopack writes its cache on shutdown, and an overlapping shutdown skewed two early runs.
2. Run `rm -rf .next/dev`.
3. Start `npm run dev`.

**Your own history:**
- `.next/dev/trace` holds one JSON span list per line. The spans `compile-path`, `render-path`, `handle-request` and `navigation-to-hydration` give per-route compile and render times across every dev session.
- `.next/dev/logs/next-development.log` holds server and browser errors.

**Production:**
```bash
npm run build && npm start -- -p 3100
```
Then run the same curl loop against `:3100`.

**Is iCloud still involved?**
```bash
defaults read com.apple.finder FXICloudDriveDesktop          # 1 = Desktop synced
find node_modules -type f -flags dataless | wc -l             # files removed locally, still in iCloud
df -h /System/Volumes/Data                                    # free space
top -l 2 -o cpu -n 5 -stats command,cpu                       # watch fileproviderd / bird / cloudd
```

**Supabase server time vs. network time.** Compare the `x-envoy-upstream-service-time` response header (server-side ms) with curl's `%{time_starttransfer}` on any `/rest/v1/...` request.

**Browser timing:** Chrome DevTools → Performance, or Navigation Timing (`performance.getEntriesByType("navigation")`). Load the production build to keep dev overhead out of the numbers.
