# NEW_CLIENT.md — Onboarding a White-Label Car-Rental Client

This codebase is **clone-per-client**, not multi-tenant. The customer site reads
`VITE_BRAND_*` from `.env` **at build time** and bakes the brand into the bundle — it
never looks up a brand at runtime. So each client = its own deployment + its own data.

The `brands` table (`backend/migrations/022_create_brands.sql`) + `BrandsTab` +
`GET /api/v1/brands/:id/env` are a **config registry**: store a client's settings, then
generate their `.env`. They do **not** make the app multi-tenant.

> Rule of thumb: never share a database, Stripe account, or Twilio/Resend sender across
> clients. Bookings, payments, and SMS liability must be fully isolated per client.

---

## What's isolated per client (all separate)

| Resource | Why separate |
|---|---|
| Vercel projects (customer site, dashboard, backend) | Independent domains + env vars |
| Supabase project | Bookings/vehicles/customers are **not** `brand_id`-scoped — shared DB would mix clients |
| Stripe account/keys | Money must land in the client's account |
| Twilio number + Resend domain | SMS/email sender identity + deliverability per brand |
| `.env` (frontend `VITE_BRAND_*`, backend secrets) | The brand config itself |

## What's shared

- **The codebase.** This repo is the template. Clone from the unified `main` (the
  integration branch), never from an old fork — older forks are missing either the Sprint
  feature set or the white-label layer (see the 2026-06-05 CHANGELOG entry).

---

## Steps

### 1. Capture the client's config
Either add them in the dashboard (**Settings → Brands**) and call
`GET /api/v1/brands/:id/env` to generate the `.env`, or fill in `.env.example` by hand.
Frontend keys (baked at build): `VITE_BRAND_NAME`, `VITE_BRAND_LEGAL_NAME`,
`VITE_BRAND_DOMAIN`, `VITE_BRAND_PHONE`, `VITE_BRAND_EMAIL`, `VITE_BRAND_CITY/STATE/ADDRESS/ZIP`,
`VITE_BRAND_META_DESCRIPTION`, `VITE_BRAND_COLOR_ACCENT(_DARK)`, `VITE_BRAND_REVIEW_LINK`,
`VITE_BRAND_ADMIN_URL`, `VITE_CHAT_WIDGET_ID`, `VITE_RECAPTCHA_SITE_KEY`, `VITE_API_URL`.
Optional per-brand toggles: `VITE_FEATURE_*` (default off — see `src/brands/README.md`).
These env vars drive `src/config/brand.ts`, the `index.html` title/description/app name
(via the `brand-html-inject` Vite plugin), the footer admin link, and the SW push title —
all with no code edits.

### 2. New Supabase project
- Create the project; in the SQL editor run, **in order**:
  1. Every file in **`backend/db/migrations/`** `001…024` — this is the real schema.
     ⚠️ NOT `backend/migrations/` (a stale partial set: only 001–005, 022). Running
     that folder gives you a broken schema.
  2. The config seeds in **`backend/db/seeds/`** — `seed_templates.sql` +
     `seed_rental_ops_templates.sql`. These create the 19+ email/SMS templates =
     your "same config". (`business_settings`'s default singleton is already
     inserted by migration `018`.)
  3. **Do NOT** run `backend/db/seed-vehicles.js` — a new brand starts with an
     empty fleet. Add vehicles later in the dashboard.
- Set backend env: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, etc.

### 3. New Stripe + Twilio + Resend
- Stripe: client's account → `STRIPE_SECRET_KEY`, webhook secret, `VITE_*` publishable key.
- Twilio: client's number → `TWILIO_*`.
- Resend: verify the client's sending domain → `RESEND_API_KEY`, `EMAIL_FROM`.

### 4. Deploy (3 Vercel projects)
- **Backend** (`backend/`, entry `api/index.js`) → set all backend env vars + Sentry DSN.
- **Customer site** (root) → set `VITE_BRAND_*` + `VITE_API_URL` (backend URL) + reCAPTCHA site key.
- **Dashboard** (`dashboard/`) → set its `VITE_*` + Sentry DSN. Run `npm install` (pulls `@sentry/react`).

### 5. Reskin (assets + brand-owned data)
Env covers identity/colors/text. The rest is files in the clone:
- **`public/`:** `logo.png`, `logo-icon.png`, `favicon.ico`, `favicon-96x96.png`,
  `apple-touch-icon.png`, the `apple-splash-*` set, `hero-*`/`happy-driver`/`rideshare-*`
  images, `fleet/`, and `site.webmanifest`.
- **`src/data/vehicles.ts`:** empty the list — it's the offline fallback for `useVehicles`;
  left as-is a no-vehicle brand can flash Annie's cars.
- **`src/data/reviews.ts`:** replace with the brand's reviews (or empty).
- **`src/data/rentalTerms.ts` + `src/components/legal/*`:** review legal copy.
- **Custom features** (anything beyond a reskin): use the brand seam, not scattered
  edits — `brand.features` flag (shared) or `src/brands/<slug>/` (one-off). See
  `src/brands/README.md`.

### 6. Domains
- Point the client's domain at the customer site; `admin.<domain>` (or similar) at the dashboard.
- Update `CORS_ORIGINS` on the backend to include both.

### 7. Smoke test before handing over
Booking request → admin approval → agreement/counter-sign → payment → insurance review
(`pending_review` approve/reject) → portal → return/deposit. Confirm email + SMS + (if
enabled) web-push fire. Confirm the footer "admin" link reaches the right dashboard URL.

---

## Pre-flight checklist

- [ ] `.env` generated and all `VITE_BRAND_*` correct (incl. `VITE_BRAND_ADMIN_URL`; build bakes these in)
- [ ] Own Supabase project — `backend/db/migrations/` 001–024 run, `backend/db/seeds/` templates seeded, **no** vehicle seed
- [ ] Own Stripe / Twilio / Resend, keys set, webhooks registered
- [ ] 3 Vercel projects deployed, env vars set, `CORS_ORIGINS` updated
- [ ] Domains pointed, SSL live
- [ ] Assets swapped in `public/`; `src/data/vehicles.ts` + `reviews.ts` emptied/replaced
- [ ] Footer admin link resolves to the right dashboard (now driven by `VITE_BRAND_ADMIN_URL`)
- [ ] Full booking → payment → return flow smoke-tested

---

## If you ever outgrow clone-per-client

True multi-tenant (one deployment, route by domain) only pays off around ~15–20 clients.
It would require: `brand_id` on bookings/vehicles/customers/payments + Supabase RLS per
tenant, runtime brand resolution by hostname (the customer site would fetch the brand
instead of reading build-time env), and per-tenant Stripe Connect. That's a multi-week
refactor — don't start it until the N-deployments update burden actually hurts.
