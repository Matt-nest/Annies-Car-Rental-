# AGENTS.md

See `CLAUDE.md`, `PROJECT_MAP.md`, and `CHANGE_PROTOCOL.md` for architecture, dependency map, and the change-discipline checklist. Those are the source of truth for how the code is organized and what is safe to touch.

## Cursor Cloud specific instructions

This is a 3-app monorepo. Dependencies for all three are installed by the startup update script (`npm install` in the repo root, `dashboard/`, and `backend/`). Node 22 works fine (CI pins Node 20; an `EBADENGINE` warning from `@zxing/library` wanting Node 24 is harmless).

### The three apps and how to run them (dev mode)

| App | Location | Dev command | Port | Notes |
|-----|----------|-------------|------|-------|
| Customer website | repo root | `npm run dev:site` | 3000 | React 19 / Vite 6. Runs standalone with no env or backend. |
| Admin dashboard | `dashboard/` | `npm run dev` | 5174 | React 18 / Vite 5. Requires a local env file (see below). |
| Backend API | `backend/` | `npm run dev` | 3001 | Express + nodemon. Requires Supabase env vars to boot (see below). |

Root `npm run dev` runs the backend + dashboard together via `concurrently` (backend still needs its env vars, or it crashes).

### Non-obvious gotchas

- **Customer site works with no backend.** `src/hooks/useVehicles.ts` fetches `${VITE_API_URL}/vehicles/catalog` but silently falls back to the bundled catalog in `src/data/vehicles.ts` when the API is unreachable. So the homepage, fleet grid, vehicle detail, and the full booking wizard render and are demonstrable without the backend or any secrets. This is the app to use for a quick end-to-end sanity check.
- **Dashboard hard-crashes at startup/build if `VITE_API_URL` is unset.** `dashboard/vite.config.js` throws a fatal error when `VITE_API_URL` is missing. Create `dashboard/.env.local` (gitignored) before running or building the dashboard:
  ```
  VITE_API_URL=http://localhost:3001/api/v1
  VITE_SUPABASE_URL=<supabase url>
  VITE_SUPABASE_ANON_KEY=<supabase anon key>
  VITE_PAYMENT_PROVIDER=square
  ```
  Placeholder values let the dashboard build and serve, but **logging in requires real Supabase credentials** (auth is Supabase-hosted).
- **Backend reads env only from `backend/.env`, not `.env.local`** (it uses `import 'dotenv/config'`, which loads `.env`). It also throws at import time if `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, or `SUPABASE_ANON_KEY` are missing (`backend/db/supabase.js` + `backend/middleware/auth.js`). Dummy values (e.g. `SUPABASE_URL=http://localhost`, `SUPABASE_SERVICE_KEY=dummy`, `SUPABASE_ANON_KEY=dummy`, `PAYMENT_PROVIDER=square`, `CORS_ORIGINS=http://localhost:3000,http://localhost:5174`) are enough to boot the server and hit `GET /health`, but any real data endpoint needs a real Supabase project/service key. `PAYMENT_PROVIDER` (`square` or `stripe`) selects which payment routes load at startup.
- Full functionality (dashboard login, backend data, payments, notifications) requires real third-party secrets (Supabase, Square/Stripe, Resend, Twilio, etc.) — see `PROJECT_MAP.md` for the full list. Provide these via Cursor Secrets / local env files when a task needs them.

### Lint / test / build

- **Lint:** root `npm run lint` (= `tsc --noEmit`). Dashboard (JSX) and backend have no lint/typecheck scripts.
- **Test:** backend `npm test` (= `node --test tests/*.test.js`); pass dummy `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`. No frontend tests exist.
- **Build:** root `npm run build`; dashboard `npm run build` (needs `VITE_API_URL`). Backend has no build step.
