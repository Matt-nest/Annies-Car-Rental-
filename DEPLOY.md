# DEPLOY — Annie's Car Rental

> How this clone is deployed, and the rules that keep it from going down.
> Last verified 2026-06-15 via the Vercel API.

## Vercel projects (one repo, two projects)

| Project | What it serves | Root Directory | Production Branch | Domain |
|---|---|---|---|---|
| `annies-car-rental` | Customer site (Vite **static** SPA) | `./` (repo root) | `main` | `www.anniescarrental.com` (apex 307→www) |
| `dashboard` | Admin dashboard + backend API (`api/index.js`) | `dashboard` | `main` | `admin.dashboard.anniescarrental.com` |

- **Supabase project ref:** `yrerxvuyeglrypeufjpy` (NOT `asdhnzdjpweyntxmutum` — that's JD Coastal).
- The unified rebuild lives on branch **`integration/unify-all-functionality`**; production content is shipped by promoting/redeploying an `integration` **git** build (see below). `main` is the nominal production branch in Vercel settings.

## 🚨 The one rule that prevents outages

**Deploy by `git push` only. NEVER run `vercel deploy` (CLI) for these projects.**

Why: a CLI `vercel deploy` pins per-deployment build overrides (e.g. Root Directory → `backend`). When that happens to the customer project, it builds/serves the **backend function** instead of the static site → `db/supabase.js` can't find env vars → **`FUNCTION_INVOCATION_FAILED` on every route, whole site down.** Every `git`-sourced deployment is healthy; every outage we've had came from a CLI deploy.

## If the site is down (FUNCTION_INVOCATION_FAILED)

1. Vercel → the project → **Deployments**. Find the most recent deployment with a **git** source (branch icon), `READY`.
2. **⋯ → Promote to Production** (or **Redeploy**, uncheck "Use existing Build Cache").
3. If "Settings differ from current deployment" banner shows: that's the warning sign — a CLI/override deploy is live. Promote a git build to clear it.

## Health checks

```
curl -I https://www.anniescarrental.com/                 # expect 200 (static SPA)
curl -s  https://admin.dashboard.anniescarrental.com/api/v1/bookings/insurance/config   # expect 200 JSON
```
A `500 FUNCTION_INVOCATION_FAILED` on the customer domain = a non-git/override deployment is live → promote a git build.

## Backend resilience

`backend/db/supabase.js` initializes the Supabase client **lazily** (on first DB call), so a missing-env misconfig surfaces as a handled 500 on one route, not a site-wide cold-start crash. Don't revert that to a top-level `throw`.

## DB migrations

SQL files live in `backend/migrations/`. They are applied **manually** to the Supabase project (SQL Editor / CLI) — there is no auto-runner. Annie's project ref: `yrerxvuyeglrypeufjpy`.
