# Angels of Clean

Booking and operations app for Angels of Clean, a residential and commercial cleaning company in Syracuse, NY.

- **Customers** book a residential cleaning in a 6-step flow (`/residential`) or request a commercial quote in a 4-step flow (`/commercial`). No account is needed.
- **Admins** sign in at `/admin` to manage bookings, the calendar, crew assignments and commercial quote requests.

Built with Next.js 16 (App Router, React 19, React Compiler), TypeScript, Tailwind CSS v4, shadcn/ui, FullCalendar and Supabase (Postgres, Auth, RLS). Tests run on Vitest.

The business timezone is **America/New_York**. All date and time logic goes through `lib/datetime.ts`; `lib/__tests__/time-format-usage.test.ts` fails on `toLocaleDateString` or `toLocaleTimeString` anywhere else.

For a tour of the code see [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md); for design rationale see [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Requirements

- **Node.js 22**, pinned in `.nvmrc` and in `engines` in `package.json` (and what CI builds and tests with). Run `nvm use` (or your version manager's equivalent) in `angels-of-clean/`. Next.js 16 itself needs at least Node 20.9.
- npm (comes with Node). The lockfile is `package-lock.json`; use `npm ci`.
- A Supabase project, plus Docker only if you want the local Supabase stack or the database tests.

The Supabase CLI is a dev dependency, so run it as `npx supabase …` (no global install).

## Getting started

```bash
cd angels-of-clean
npm ci
# create .env.local with the variables below
npm run dev                  # http://localhost:3000
```

### Environment variables

Set these in `.env.local` (never commit it). Names only:

| Name | Where it is used |
|------|------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. Browser and server. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key for session-bound clients. Browser and server. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server only.** Bypasses RLS. Used only for the public booking and quote inserts and the rate limiter. Never prefix it with `NEXT_PUBLIC_`. |

## npm scripts

Run these from `angels-of-clean/`.

| Script | What it does |
|--------|--------------|
| `npm run dev` | Dev server on localhost:3000. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint. |
| `npm test` | Vitest, single run. Forces `TZ=UTC` so timezone bugs show up. |
| `npm run db:types` | Regenerate `lib/supabase/database.types.ts` from the linked Supabase project. |

Type-check with `npx tsc --noEmit`. Before you finish any change, run `npm run lint`, `npx tsc --noEmit` and `npm test`.

## Database and the Supabase CLI

Schema changes are Supabase CLI migrations in `supabase/migrations/`, named `<14-digit version>_<name>.sql` and applied in version order.

### Rules

- Create a migration with `npx supabase migration new <name>`.
- **Never edit or rename a migration that has been applied.** `supabase/__tests__/migrations.test.ts` fails if an applied file changes or if a new one sorts before them. Fix mistakes with a new migration.
- One-off data fixes (not schema) go in `supabase/scripts/` and are run by hand.
- Do not run anything against the remote database from a coding session (`db push`, `migration repair`, SQL). The owner does that.
- Never hand-edit `lib/supabase/database.types.ts`. `lib/supabase/types.ts` re-exports row types from it under the names the app imports, and narrows columns that have CHECK constraints.

### Workflow for a schema change

1. `npx supabase migration new <name>`, then write the SQL in the new file.
2. Optionally try it locally: `npx supabase start` (Docker), then `npx supabase db reset`.
3. Add or update tests. `npx supabase test db` runs the pgTAP tests in `supabase/tests/database/` against the local stack.
4. Open a PR. CI does not apply migrations.
5. After merge, the owner links the project once (`npx supabase login`, `npx supabase link --project-ref <ref>`), then applies it with `npx supabase db push`.
6. Then regenerate types with `npm run db:types` and commit `lib/supabase/database.types.ts` in a follow-up PR.

If a migration has not been applied yet, the app fails safely: the affected action shows "Something went wrong" and never falls back to an unsafe path (the rate limiter fails open by design).

### Granting the admin role

Admin access requires `app_metadata.role = 'admin'` on the user. It is checked in the proxy (`proxy.ts`, Next.js 16's name for middleware), in `requireAdmin()` for every server action, and in RLS. `app_metadata` can only be set server-side, so a user cannot grant it to themselves. Being signed in is never enough: public signups are on.

Create the user first (Supabase dashboard, Authentication, Users), then run this in the Supabase SQL Editor (SQL from `20260918194509_admin_role_rls.sql`):

```sql
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
                        || '{"role": "admin"}'::jsonb
where email = 'YOUR_ADMIN_EMAIL';
```

Then sign out of the admin panel and back in so the session token picks up the new claim. Grant the role before relying on the RLS policies, or you will lock yourself out of the admin panel.

## CI and branch protection

CI is `.github/workflows/ci.yml`, one job named **`verify`**. It runs on every pull request and on every push to `v2`, on Node 22, in `angels-of-clean/`:

1. `npm ci`
2. `npm run lint`
3. `npx tsc --noEmit`
4. `npm test`
5. `npm run build` (with placeholder Supabase env values; the build does not contact Supabase)

CI uses placeholder environment values only. Never put real secrets in the workflow.

**Branches**

- `v2` is the working branch. All work goes into `v2` through pull requests that target it.
- `main` is a frozen "before" snapshot for a course write-up. Never commit to it, merge into it or base work on it.

**Branch protection on `v2`** should be:

- Changes only by pull request, no direct pushes.
- The `verify` check must pass before merging.
- The branch must be up to date with `v2` before merging.

This is configured in GitHub (Settings, Branches), not in the repo. Check it there if a PR can merge with a red `verify`.

## Working in a git worktree

Each task (a backlog item or chore) is done in its own git worktree on its own branch, so several tasks can run side by side without touching each other or the main checkout.

1. **Start.** Create a worktree from `v2` with a branch named for the task, for example `worktree-w5b-docs`. Worktrees live under `.claude/worktrees/`. `.worktreeinclude` copies the git-ignored files a worktree needs (`.env.local`, `docs/BACKLOG.md`, `docs/FIGMA_MAP.md`, `docs/audit/*.md`).
2. **Install.** `cd angels-of-clean && npm ci`.
3. **Read first.** `CLAUDE.md`, `docs/PROJECT_MAP.md`, `docs/DECISIONS.md` and the backlog entries for the task, then open only the files you need.
4. **Stay in scope.** Change only the files the task lists. No unrelated refactors, no new features, no new dependencies without asking first. If something needs an owner decision or is ambiguous, stop and ask.
5. **Database.** Schema changes go in a new migration (see above). Never run anything against the remote database. Write down what the owner must run instead.
6. **Tests.** Add or update tests that would have caught the problem.
7. **Verify.** Run `npm run lint`, `npx tsc --noEmit` and `npm test`. If anything fails, say so plainly with the output.
8. **Backlog.** `docs/BACKLOG.md`, `docs/FIGMA_MAP.md` and `docs/audit/` are not in git because the repo is public. In a worktree they are read-only copies: never edit them. Report a "Backlog note" in the summary and the owner updates the real file.
9. **Commit.** `fix: B<n> <short title>`, or `chore:` / `perf:` for non-backlog work.
10. **Hand off.** Open a PR into `v2`. The summary says what changed, lists the files, and lists every manual step for the owner (for example, a migration to apply and then `npm run db:types`).

## Accessibility and design

The target is WCAG 2.2 AA. Brand primary is `#1A6B5A`. The design source of truth is Figma file `Puf4bVpEq4KAkUhK0nnGtw`, page `120:2`.

## Security notes

- The service-role client (`lib/supabase/service.ts`) is only for the public booking and quote inserts and the rate limiter.
- The public booking and quote forms are guarded by a honeypot, a minimum fill time and a per-IP rate limit.
- Never log customer data; log an error code and a correlation id only.
