# DEPLOY — Annie's Car Rental

> Production deploy rules and database identity. Last verified 2026-07-08.

## Vercel projects (one repo, multiple projects)

| Project | What it serves | Domain |
|---------|----------------|--------|
| Customer site | Vite SPA (`annies-car-rental`) | `anniescarrental.com` |
| Dashboard + API | `dashboard/` root (`admin.dashboard…`) | `admin.dashboard.anniescarrental.com` |

**Deploy by `git push origin main` only.** Do not use `vercel deploy` CLI for production.

## Supabase (critical)

| Brand | Project ref | URL pattern |
|-------|-------------|-------------|
| **Annie's** | `yrerxvuyeglrypeufjpy` | `https://yrerxvuyeglrypeufjpy.supabase.co` |
| JD Coastal (separate repo) | `asdhnzdjpweyntxmutum` | different project |

The dashboard at `admin.dashboard.anniescarrental.com` must use **Annie's** `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` in Vercel env vars. Using JD's keys will make agents/scripts mutate the wrong database.

## Health checks

```bash
curl -s https://admin.dashboard.anniescarrental.com/api/v1/health
```

## Purging test customers (owner only)

After deploy, owners can remove test bookings (Alain Lusma, Matthew Nestor, etc.) via:

```bash
# Requires owner JWT from dashboard login
curl -X POST https://admin.dashboard.anniescarrental.com/api/v1/system/purge-test-data \
  -H "Authorization: Bearer <owner-access-token>"
```

Or run locally with Annie's service key:

```bash
cd backend
SUPABASE_URL=https://yrerxvuyeglrypeufjpy.supabase.co \
SUPABASE_SERVICE_KEY=... \
node scripts/delete_test_customers.mjs
```

Preserves live booking `BK-20260703-YRK9` (Michael STOVER).
