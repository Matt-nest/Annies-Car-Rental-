# AGENTS.md

For code-change rules, danger zones, and dependency tracing, read `CLAUDE.md`, `PROJECT_MAP.md`, and `CHANGE_PROTOCOL.md` (required reading before editing).

## Cursor Cloud specific instructions

This repo has **three** runnable surfaces plus static mockups. Standard install/run commands live in `README.md` and each `package.json`; the notes below only capture non-obvious startup caveats discovered during environment setup.

### Services

| Service | Dir | Dev command | Port | Needs secrets to be functional? |
|---------|-----|-------------|------|--------------------------------|
| Customer website (React 19 / Vite 6) | repo root | `npm run dev:site` | 3000 | No — browse + booking form work offline via `src/data/*` mocks |
| Admin dashboard (React 18 / Vite 5) | `dashboard/` | `npm run dev` | 5174 | Yes — Supabase Auth + backend for any real data |
| Backend API (Express + Supabase) | `backend/` | `npm run dev` | 3001 | Yes — Supabase (+ Stripe) for anything past `/health` |
| Ad mockups | `ads/` | static HTML | — | No |

### Non-obvious caveats

- **Customer site command:** use `npm run dev:site`. The root `npm run dev` runs the **backend + dashboard** concurrently (not the customer site), despite what the README implies. The customer site has **no hard env requirements** and gracefully falls back to `src/data/vehicles.ts` / `reviews.ts` when the API is unreachable — it is the fully-runnable product without any secrets.
- **Dashboard hard-fails at startup without `VITE_API_URL`:** `dashboard/vite.config.js` throws if `VITE_API_URL` is unset (dev *and* build). Create `dashboard/.env` with `VITE_API_URL` (and `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` for login) before running. `.env` in `dashboard/` is not gitignored, so keep real keys out of commits.
- **Backend hard-requires several env vars just to boot** (import-time, before listening): `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_ANON_KEY` (used by `middleware/auth.js`), and `STRIPE_SECRET_KEY` (eager `getStripe()` via `services/cardOnFileService.js`). With placeholders it boots and `/health` returns 200, but data endpoints return HTTP 500 (`fetch failed`) until pointed at a real Supabase project. `PORTAL_JWT_SECRET` is needed for the customer-portal routes.
- **Backend tests need Supabase env vars set (even dummy ones):** run `node --test tests/*.test.js` from `backend/`, but export `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` first (any non-empty value). Otherwise 3 suites (`interpolator`, `merge-field-coverage`, `inspectionService`) crash at import because they transitively load `db/supabase.js`, which throws on missing creds. With them set, all suites pass.
- **`npm run lint` (root `tsc --noEmit`) currently fails** and is not caused by the environment: root `package.json` does not declare `@types/react` / `@types/react-dom`, and `src/components/booking/ConfirmBooking.tsx` has a missing-prop error. This also fails CI's `tsc --noEmit` step. Vite/esbuild does not type-check, so `npm run build` and running the app are unaffected.
- **Node version:** an EBADENGINE warning appears (a dev dependency requests Node `>=24`); Node 22 builds/runs everything fine — the warning is safe to ignore.
