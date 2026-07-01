# AGENTS.md

For code conventions and change discipline, see `CLAUDE.md`, `PROJECT_MAP.md`, and `CHANGE_PROTOCOL.md`.

## Cursor Cloud specific instructions

This repo is a white-label car-rental platform with **three dev services** (commands live in `README.md` and each `package.json`):

| Service | Dir | Dev command | Port |
|---|---|---|---|
| Customer site (React 19 + Vite 6) | repo root | `npm run dev:site` | 3000 |
| Admin dashboard (React 18 + Vite 5) | `dashboard/` | `npm run dev` | 5173 (auto-bumps if taken) |
| Backend API (Express) | `backend/` | `npm run dev` | 3001 |

Note: the root `npm run dev` runs **backend + dashboard** concurrently — it does NOT start the customer site. Use `npm run dev:site` for the customer site.

### Non-obvious caveats (discovered during setup)

- **Backend won't boot without well-formed Supabase env.** `backend/middleware/auth.js` creates a Supabase client at import time, so `SUPABASE_URL` and `SUPABASE_ANON_KEY` must be present and URL-valid or the process crashes on startup. For local dev, put placeholder values (e.g. `https://placeholder.supabase.co`) in a gitignored `backend/.env`.
- **Backend also needs a non-empty `STRIPE_SECRET_KEY`.** `backend/services/cardOnFileService.js` initializes Stripe at import time; without a key the process crashes on startup. A placeholder like `sk_test_placeholder` is enough to boot; real payments need a real key.
- **Dashboard SPA throws at init without well-formed Supabase env.** `dashboard/src/auth/supabaseClient.js` calls `createClient` at module load; missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` yields a blank white screen. Put placeholders in a gitignored `dashboard/.env.local` to render the login screen.
- **`npm run lint` (root = `tsc --noEmit`) has pre-existing type errors** because `@types/react` is not a declared dependency. `npm run build` and the dev servers work fine (Vite/esbuild don't typecheck). Only worry about new errors your change introduces.
- **Vite must be restarted to pick up new/changed env vars.** Hot reload won't reload them.
- **Full functionality (fleet listing, admin login, bookings, payments) requires real Supabase + Stripe keys.** Without them all three servers still run, but the fleet shows empty and login fails.
- `.env*` files are gitignored (except `*.env.example`), so local dev env files are never committed.

### Sibling repo

The workspace also contains `JDCoastal`, a downstream white-label clone of this template with an identical structure and the same three-service setup.
