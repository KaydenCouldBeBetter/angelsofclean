# Angels of Clean: project instructions

Angels of Clean is a residential and commercial cleaning company in Syracuse, NY. This Next.js 16 + Supabase app is headed to production: customers book cleanings and request commercial quotes; admins manage bookings, the calendar and staff.

- The app lives in angels-of-clean/. Run npm commands there.
- Branches: all work goes into v2 (pull requests target v2). main is a frozen "before" snapshot for a course write-up. Never commit to it, merge into it or base work on it.
- docs/BACKLOG.md, docs/FIGMA_MAP.md and docs/audit/ are not in git (the repo is public). In a worktree they are read-only copies: never edit them; report a "Backlog note" in your summary instead.
- Before exploring, read docs/PROJECT_MAP.md, docs/DECISIONS.md and docs/BACKLOG.md. docs/PERFORMANCE_DIAGNOSIS.md explains known slowdowns.
- Business timezone is America/New_York. All date and time logic goes through lib/datetime.ts.
- Security: admin access requires app_metadata.role = 'admin', checked in middleware, in requireAdmin() for every server action, and in RLS. Public signups are ON (customer accounts are planned), so never grant access for "signed in" alone. The service-role client is only for the public booking and quote inserts.
- Database: never edit an applied migration; add a new one. If package.json has a db:types script, run it after schema changes.
- Accessibility target: WCAG 2.2 AA. Brand primary #1A6B5A.
- Before finishing any task, run npm run lint, npx tsc --noEmit and npm test.
- Design source of truth: Figma file Puf4bVpEq4KAkUhK0nnGtw, page 120:2.
