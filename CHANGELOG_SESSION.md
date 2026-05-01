# SESSION CHANGELOG

> One entry per work session. Newest session at top.
> Purpose: prevent regressions by tracking exactly what changed and what depends on it.

---

## 2026-05-01 — feat: dedicated Insurance page in dashboard + drop both bonzah emails

### Why
Bonzah/insurance UI previously lived in two places: Settings → Integrations (config-only) and the per-booking Insurance section. There was no way to see all policies, filter by status, or surface bind-failed reconciliation work without trawling individual bookings. Two emails were also being sent that the owner doesn't want — Bonzah handles policy issuance email to the customer directly, and the admin prefers in-app dashboard notifications over inbox alerts for bind failures.

### Changes
- `backend/services/stripeService.js` — `bindBonzahAfterPayment` no longer calls `sendBookingNotification` for `insurance_policy_issued` (customer) or `insurance_bind_failed` (admin). The in-app `bonzah_bind_failed` dashboard notification is preserved as the canonical reconciliation channel. Templates left in `notifyService.js` and `fallbackTemplates.js` for now (unwired but available — easier to re-enable than re-author).
- `backend/routes/bonzah.js` — added two endpoints:
  - `GET /admin/bonzah/policies?status=<insurance_status>` — bookings filtered to `insurance_provider='bonzah'` joined with customer + vehicle.
  - `GET /admin/bonzah/stats` — counts by insurance_status + markup revenue (this month + lifetime).
- `dashboard/src/api/bonzah.js` — added `listPolicies({ status })` and `stats()` methods.
- `dashboard/src/pages/InsurancePage.jsx` — **NEW**. Layout:
  - 4-tile stats header: Active count · Pending bind · Bind failed (with "Reconciliation needed" sublabel) · Markup this month (lifetime as sublabel).
  - Bind-failed alert banner that filters the table when clicked.
  - Status-filter chips (All / Active / Pending / Bind failed / Cancelled / Expired) with per-status counts.
  - Policies table: booking code (linked to detail) + policy_no, customer, vehicle, dates, tier, status badge, premium · markup · charged columns.
  - Recent Activity feed: last 20 Bonzah API calls, errors highlighted (same data source as Settings page activity feed).
- `dashboard/src/App.jsx` — registered `/insurance` route.
- `dashboard/src/components/layout/Sidebar.jsx` — added Shield-icon "Insurance" entry between Payments and Revenue.

### What's intentionally NOT included
- **No customer-facing policy display** — Bonzah's quote payload includes the customer's email; Bonzah issues their own policy email out-of-band. If a separate confirmation surface is wanted later (post-checkout or in a portal), that's a follow-up.
- **No bookings-list filter chip** for insurance status on `/bookings` — the dedicated Insurance page is the canonical reconciliation surface; cross-listing it would be redundant.

### Verification
- `node --check backend/routes/bonzah.js backend/services/stripeService.js` clean.
- `cd dashboard && npm run build` clean (3.44s, 3097 modules).
- Sidebar nav entry placement verified by reading `Sidebar.jsx` MAIN_NAV array.

---

## 2026-05-01 — UX: insurance step shows all 3 tier prices on load (parallel quote), per-day pricing prominent

**Why:** Customers shouldn't have to click each tier card to see its price — pricing IS already live (Bonzah quote API), so all three should populate immediately on the Insurance step. Per-day price is the easier number to compare across tiers; total for the trip belongs as the secondary line.

### Fix
- `src/components/booking/confirm-booking/wizard-steps/InsuranceStep.tsx`:
  - Replaced single `quoteLoadingTier` state with three per-tier maps: `tierQuotes`, `tierLoading`, `tierErrors`. Each card has its own loading/error state.
  - On mount (when config + bonzah-available + visible tiers are ready), kicks off `Promise.all(visibleTiers.map(fetchQuote))` so all three Bonzah quotes load in parallel. Auto-selects the default tier (`bonzah_tiers[].default === true`) once its quote returns.
  - `handleSelectTier` is now a pure cache lookup — selecting a tier just reads from `tierQuotes[id]` and updates the wizard draft. No additional Bonzah round-trip on click.
  - Card price block: per-day price ($X.XX/day) in larger accent-color type, total below as muted text ("$Y.YY for N days"). Failed tiers show a red "Unavailable" instead of a price; loading tiers show a spinner.
  - Disabled state on cards: `isLoading || tierError || !cardQuote` (so Essential is selectable as soon as its quote lands, independent of Standard/Complete).

### Verification
- `npm run build` clean (2138 modules, 11.16s).
- Backend `/insurance/quote` already returns standalone quotes per `tier_id`, so calling it 3× in parallel is safe (each call is its own Bonzah quote draft).

---

## 2026-05-01 — fix: clamp Bonzah trip_start_date by datetime, not just date

**Root cause:** Earlier today's clamp compared **dates** only. The booking under test had `pickup_date='2026-05-01'` (today) at `pickup_time='10:00:00'` ET — dates equal → no clamp → `trip_start_date='05/01/2026 10:00:00'` sent to Bonzah at 19:15 ET → Bonzah rejected because the **datetime** was 9 hours in the past. Live audit log confirmed: 6 quote attempts, all returning Bonzah `status: -201` "Invalid Policy Start date".

### Fix
- `backend/services/bonzahService.js` — replaced the date-only clamp in `buildQuoteBody` with a full datetime check.
  - Added `pickupIsPast(date, time)` helper that constructs an ISO-style timestamp in `DEFAULT_TIMEZONE` (Eastern) for both pickup and now, and compares lexically.
  - Added `nowInLocalTz()` helper that returns current ET time formatted as `MM/DD/YYYY HH:mm:ss` (Bonzah's expected shape).
  - When `pickupIsPast()` returns true (day-of bookings completed after the pickup_time, or stale test data), `trip_start_date` is set to "now" in ET. Otherwise the booking's pickup_date+pickup_time pass through unchanged.

### Verification
- Smoke-tested helpers locally: `nowInLocalTz()` returns `05/01/2026 19:18:06`, `pickupIsPast('2026-05-01', '10:00:00')` returns `true`, `pickupIsPast('2026-05-02', '10:00:00')` returns `false`, `pickupIsPast('2025-12-01', '10:00:00')` returns `true`.
- After deploy, retry the customer wizard. Expect a successful quote (and a `quote` row in `bonzah_events` with `status: 0`).

---

## 2026-05-01 — fix: clamp Bonzah trip_start_date to today when pickup is in the past

**Root cause:** Bonzah's `/Bonzah/quote` endpoint rejects `trip_start_date` values in the past with `Invalid Policy Start date - Kindly select today's <date> or any date in the future.` `buildQuoteBody` in `bonzahService.js` was sending `booking.pickup_date` verbatim. Hits in three scenarios: (1) test bookings with stale pickup dates, (2) genuine day-of-pickup wizard completion where the customer's already past the listed pickup_time, (3) any late completion of the wizard after the booked pickup window passed.

Insurance can't be backdated — "now" is the only legal coverage start for a past pickup.

### Fix
- `backend/services/bonzahService.js` — `buildQuoteBody` clamps `trip_start_date` to today's date in Annie's local TZ (`America/New_York`) when `booking.pickup_date` is earlier. Date comparison uses `toLocaleDateString('en-CA', { timeZone: DEFAULT_TIMEZONE })` which yields `YYYY-MM-DD` for clean string compare. `trip_end_date` left untouched.

### Verification
- `node --check backend/services/bonzahService.js` clean.
- Manual: today's date in ET resolves to `2026-05-01` (verified with one-liner).

---

## 2026-05-01 — fix: bonzah quote works before agreement is signed (DOB ordering)

**Root cause:** The booking wizard's order is Stage 1 (Agreement: address + DOB + license) → Stage 2 (Insurance: quote) → Stage 3 (Payment: submit). DOB / address / license fields are kept in the wizard's `sessionStorage` draft until the FINAL submit at Stage 3, which is when `/agreements/:code/sign` writes them to the customer record. So when Stage 2's `InsuranceStep` calls `POST /bookings/:code/insurance/quote`, the joined `booking.customers.date_of_birth` is still null and `validateBookingForBonzah` throws `customer.date_of_birth required for Bonzah`. Same problem latent for `address_line1`, `zip`, `state`, `driver_license_number`, `driver_license_state` — DOB just throws first.

User-visible: every customer reaching the Insurance step sees "customer.date_of_birth required for Bonzah" and can't see prices.

### Fix
- `backend/routes/bookings.js` — `POST /bookings/:code/insurance/quote` now accepts an optional `customer_overrides` object in the request body and merges it onto the loaded `booking.customers` for quote computation only. The Stripe-webhook bind path re-reads the persisted customer record (which by then is populated by `/agreements/:code/sign`), so overrides can't smuggle bad data into a real policy — they affect non-binding price display only.
- `src/components/booking/confirm-booking/wizard-steps/InsuranceStep.tsx` — `fetchQuote()` now sends `customer_overrides: { date_of_birth, address_line1, zip, state, driver_license_number, driver_license_state }` from the wizard draft.

### Verification
- `node --check backend/routes/bookings.js` clean.
- `npm run build` clean on customer site (2138 modules, 1.82s).
- After deploy, completing Stage 1 of the booking wizard and reaching Stage 2 should auto-load a Bonzah quote (default tier) instead of throwing.

---

## 2026-05-01 — fix: bonzah audit — remove writes to non-existent insurance_policy_number / insurance_email columns

**Root cause:** Migration 009 added all the `bonzah_*` columns to `bookings` but did NOT add `insurance_policy_number` or `insurance_email`. Multiple Bonzah code paths wrote to these phantom columns. Postgres rejects atomic UPDATEs when any column is missing, so when these writes executed:
- The customer wizard's PATCH `/bookings/:code/insurance` returned `{ success: true }` while writing nothing (errors not captured) — so `insurance_provider` stayed null and the Stripe webhook later skipped binding because of the `insurance_provider !== 'bonzah'` guard. **Customer would have paid for Bonzah insurance with no policy bound.**
- `stripeService.bindBonzahAfterPayment` post-bind UPDATE failed atomically — `bonzah_policy_id`, `bonzah_policy_no`, `bonzah_total_charged_cents`, `insurance_status: 'active'`, and `bonzah_last_synced_at` would have ALL failed to write after a successful Bonzah bind. Customer charged + Bonzah issued real policy + our DB had no link. Manual reconciliation only.
- `routes/bonzah.js` "Refresh from Bonzah" admin button silently failed when policy_no changed (the only time refresh actually matters).
- `jobs/bonzahPolling.js` polling job UPDATE silently failed when policy_no changed (the reconciliation case).

No live customer hit this — all sample bookings still have `insurance_provider: null` (the very signature of the silent failure). Discovered as part of an audit triggered by the auth bug fix earlier today; same misread/silent-failure pattern. Verified by querying the live Supabase schema: `insurance_policy_number` and `insurance_email` truly do not exist on `bookings`.

The "real" `insurance_policy_number` lives on `rental_agreements`, where it is correctly read/written by `routes/agreements.js` and the rental-agreement form. Untouched.

### Fix
- `backend/routes/bookings.js` — PATCH `/bookings/:code/insurance` (3 update sites): removed phantom-column writes; added `{ error: updErr }` capture on each `.update()` so future schema drift surfaces a 500 instead of silently swallowing.
- `backend/services/stripeService.js` — `bindBonzahAfterPayment` post-bind update: removed `insurance_policy_number: result.policy_no` (we already write `bonzah_policy_no` in the same payload). Added error capture with a CRITICAL log line for the rare case where Bonzah binding succeeds but our DB write fails.
- `backend/routes/bonzah.js` — `POST /admin/bonzah/booking/:id/refresh`: removed phantom-column write; added error capture.
- `backend/jobs/bonzahPolling.js` — `reconcileOne`: removed phantom-column write.
- Removed unused `bonzah_email` from req.body destructure.

### Audit results — what else was checked and is OK
- **Bonzah API response shape** — every `bonzahCall()` consumer in `services/bonzahService.js` correctly reads `res?.data` (the original auth bug was localized to `authenticate()` reading `body.token` instead of `body.data.token`).
- **Settings keys** — all 5 (`bonzah_enabled`, `bonzah_markup_percent`, `bonzah_tiers`, `bonzah_excluded_states`, `bonzah_pai_excluded_states`) seeded with sane defaults.
- **`bonzah_events` table** — schema matches code: `id, booking_id, event_type, request_json, response_json, status_code, duration_ms, error_text, created_at`.
- **Stripe webhook wiring** — `bindBonzahAfterPayment` invoked at both `payment_intent.succeeded` sites. Idempotency guards (`bonzah_policy_no`, `bind_failed`) intact.
- **Notification templates** — `insurance_policy_issued` and `insurance_bind_failed` exist in `fallbackTemplates.js` and `notifyService.js`. Untouched.
- **Customer wizard `ConfirmBooking.tsx:106`** — sends `insurance_policy_number` to `/agreements/:code/sign` (rental_agreements table where the column exists). Not the bug.
- **Polling job filter** — `WHERE bonzah_policy_id IS NOT NULL` correctly skips bookings without a bound policy.

### Verification
- `node --check` clean on all four edited files.
- `cd dashboard && npm run build` clean (3.01s, 3096 modules).
- After deploy, attempt a customer wizard insurance submission against staging — should write `insurance_provider='bonzah'` correctly. (Or hit PATCH directly with curl + the body shape from `ConfirmBooking.tsx:128-131`.)

---

## 2026-05-01 — fix: bonzah auth — read token from body.data.token, not body.token

**Root cause:** `authenticate()` in `backend/utils/bonzah.js` checked `body.token` and returned `body.token`. Bonzah actually nests the token at `body.data.token`. The auth call returned HTTP 200 + `status: 0` (success) with a real token — but our code never saw it, threw `Bonzah auth failed: HTTP 200`, and every downstream Bonzah call therefore broke (Test Connection, /admin/bonzah/health, /events, /settings GETs that proxy through Bonzah).

The bug was present from Phase 1 (`4a3e25b`) but never fired in production because the admin routes weren't mounted on the serverless entry point. After today's earlier fixes (route mount + Hobby-cron cleanup), this bug surfaced as the first real exercise of the auth path.

Verified by direct `curl POST https://bonzah.sb.insillion.com/api/v1/auth` with the production sandbox creds — Bonzah returns:
```json
{ "status": 0, "txt": "", "data": { "email": "...", "token": "...", ... } }
```
`bonzahService.js:570` already reads `res?.data` correctly elsewhere; only `authenticate()` was misreading the shape.

### Fix
- `backend/utils/bonzah.js` — extract token from `body?.data?.token`. Updated:
  - L57-58: pull token before the validation expression.
  - L60: friendlier fallback error text when `body.txt` is empty and `status === 0` ("No token in response (data.token missing)").
  - L69: `return token` (was `return body.token`).
  - L76: audit log token-presence check now reads `body?.data?.token`.

### Verification
- `node --check backend/utils/bonzah.js` clean.
- After deploy, "Test Connection" on Settings → Integrations should succeed (green checkmark instead of "Bonzah auth failed: HTTP 200" banner).

---

## 2026-05-01 — fix: remove bonzah-poll cron (Vercel Hobby 1-cron limit)

**Root cause:** Commit `32407ad` added `/api/v1/cron/bonzah-poll` to `dashboard/vercel.json` alongside the existing `/api/v1/cron/daily`. The project is on Vercel Hobby tier, which caps cron jobs at **1 per project**. Vercel rejected the deploy at config-validation time and (per the deploy list) never even produced a Failed entry — the webhook event for `32407ad` produced no deployment record at all, leaving the broken `4a3e25b` build live as Production: Current. Bonzah admin routes therefore stayed 404 in production.

### Fix
- `dashboard/vercel.json` — removed the `bonzah-poll` cron entry. Kept `cron/daily` only.

### Side effects / what's NOT scheduled anymore
- `/api/v1/cron/bonzah-poll` route handler (defined in `backend/routes/cron.js`) is **still live and reachable** — it just isn't being auto-fired every 15 min.
- Polling reconciliation (catching `bind_failed` / stuck policies) must now be triggered manually until one of:
  1. **Plan upgrade to Vercel Pro** — re-add the cron entry.
  2. **External scheduler** hits the URL with the `Authorization: Bearer $CRON_SECRET` header (cron-job.org, GitHub Actions, AWS EventBridge — all free tier viable).
  3. **Manual** — owner runs a daily `curl` from a saved snippet.

### Verification
- `cd dashboard && npm run build` clean (2.88s, 3096 modules).
- After redeploy, `curl https://admin.dashboard.anniescarrental.com/api/v1/admin/bonzah/health` should return **401** (auth required) — confirming the route mount from `32407ad` is now live in production.

---

## 2026-05-01 — fix: bonzah admin routes + polling cron not deployed to production

**Root cause:** The repo has TWO Express entry points:
- `backend/server.js` — local dev only (used when running `npm run dev` against the backend directly).
- `backend/api/index.js` — the production serverless entry point that Vercel actually runs (mounted via `dashboard/api/[...path].js`).

Phases 1–5 added `bonzahRoutes` to `backend/server.js` only. Result: every `/api/v1/admin/bonzah/*` endpoint returned 404 in production. Surfaced via the dashboard Settings → Integrations tab where `[Bonzah] events load failed: GET /api/v1/admin/bonzah/events not found`. The customer wizard worked fine because `/api/v1/bookings/insurance/config` lives inside `routes/bookings.js` (already imported by both entry points).

Same drift pattern applied to the polling cron — Phase 3 added the `*/15 * * * *` schedule to `backend/vercel.json`, but Vercel only reads `dashboard/vercel.json` for this project. Effect: the every-15-min reconciliation job was never firing.

### Fix
- `backend/api/index.js` — added `import bonzahRoutes from '../routes/bonzah.js'` + `app.use('/api/v1/admin/bonzah', bonzahRoutes)` mirroring `backend/server.js`.
- `dashboard/vercel.json` — added the `/api/v1/cron/bonzah-poll` cron entry (every 15 min).

### Verification
- `node --check backend/api/index.js` clean.
- `cd dashboard && npm run build` clean.
- After deploy, `curl https://admin.dashboard.anniescarrental.com/api/v1/admin/bonzah/health` should return 401 (auth required) instead of 404 — confirming the route exists.

### Note on `backend/vercel.json`
That file appears to be unused in production. The two entries already there (`/cron/daily` and `/cron/process-overage-charges`) are also defined in `dashboard/vercel.json`, so they fire correctly. Leaving `backend/vercel.json` in place but flagging that it's drift-prone — future cron additions should be made in `dashboard/vercel.json`.

---

## 2026-05-01 — Bonzah Insurance Integration · Phase 5 (PDF proxy + tier editor + runbook)

**Scope:** Closes the Phase 4 gaps. Per-coverage PDF downloads work end-to-end. Settings page now has a JSON tier editor with schema validation (replaces "edit via SQL only"). Operations runbook documents kill switch, reconciliation, credential rotation, and sandbox→prod cutover.

### Backend
- `backend/utils/bonzah.js` — **NEW** `bonzahCallBinary({ policyId, dataId, bookingId })`. Mirrors `bonzahCall()` (re-auth + audit log) but handles binary responses. Doesn't store the file body in `bonzah_events.response_json` — only a `{ content_type, size_bytes }` descriptor — so the events table doesn't bloat.

- `backend/services/bonzahService.js` — **NEW** `getPolicyPdf(policyId, coverageCode, bookingId)`. Two-step: GET `/Bonzah/policy` to look up the per-coverage `*_pdf_id`, then `bonzahCallBinary()` to fetch the file. We don't persist `pdf_id`s on the booking row — re-fetch on each download (admin-triggered, low frequency). Returns `{ buffer, contentType, filename }`. Filename format: `{policy_no}-{COVERAGE}.pdf`.

- `backend/routes/bonzah.js` — **NEW** `GET /admin/bonzah/booking/:id/pdf/:coverage`. Validates `coverage` against the four allowed codes, looks up booking, calls `getPolicyPdf()`, streams the buffer back with `Content-Disposition: inline; filename="..."`. Owner/admin-only via the router-level guard.

### Dashboard
- `dashboard/src/api/bonzah.js` — **NEW** `downloadBookingPdf(bookingId, coverage)`. Bearer auth fetch → blob → object URL → programmatic `<a download>` click → revoke. Single-use, no leaks.

- `dashboard/src/pages/BookingDetailPage.jsx` — **`BookingInsuranceSection`** now derives the list of opted coverages from `bonzah_coverage_json` via regex on `optional_addon_cover_name` (e.g. "Collision Damage Waiver (CDW)" → matches CDW). Renders one button per opted coverage under a "Policy documents" header. Per-button loading spinner via `downloadingCoverage` state.

- `dashboard/src/pages/SettingsPage.jsx` — **NEW** `BonzahTierEditor` component (replaces the prior read-only summary):
  - Read-only summary preserved as the default view (cards with default/recommended badges + coverage codes).
  - "Edit JSON" toggle reveals an auto-sized monospace textarea with the current `bonzah_tiers` value pretty-printed.
  - Live validation on every keystroke:
    - Must be a JSON array.
    - Each tier needs `id` (string), `label` (string), `coverages` (non-empty array).
    - Coverages must be one of `cdw|rcli|sli|pai`.
    - **SLI requires RCLI** — Bonzah constraint enforced client-side before save.
  - Green "Valid" indicator vs. red error with line description.
  - On valid input, propagates to `draft.bonzah_tiers` so the parent's Save Changes button works as-is.

### Documentation
- **NEW** `backend/docs/bonzah-runbook.md` — Eight sections covering:
  1. Kill switch (dashboard + SQL fallback).
  2. Stuck-policy reconciliation (bind_failed, cancel-stuck, policy_no drift, forensic SQL queries).
  3. Credential rotation (zero-downtime via env-var swap).
  4. Sandbox → production cutover (8-step checklist).
  5. Manual bind path (intentional friction — no admin button).
  6. Endorsement workflow (date changes — helpers exist, no UI yet).
  7. Common errors table (8 error texts mapped to causes + fixes).
  8. Quick reference (where to click for each operation).

### Verification
- `node --check` clean on `utils/bonzah.js`, `services/bonzahService.js`, `routes/bonzah.js`.
- `cd dashboard && npm run build` clean (2.90s, ~3095 modules).

### Manual smoke test (after deploy)
1. Navigate to a booking with a Bonzah policy → Insurance section shows new "Policy documents" row with one button per opted coverage.
2. Click any button → PDF should open/download. Verify the file opens to the correct policy in Acrobat.
3. Settings → Integrations → click "Edit JSON" on the Tiers section.
4. Try invalid input (delete the `cdw` from a tier's coverages, save) — should reject with a parse error.
5. Try a valid edit (rename "Standard" → "Recommended Coverage"), Save Changes, reload customer wizard — new label appears immediately.

### Production cutover gate
The runbook at `backend/docs/bonzah-runbook.md` is the authoritative checklist. Do NOT skip §4 step 7 (real test booking) before cutting over to production credentials.

### Phases 1–5 complete
The Bonzah integration is now feature-complete for the scope agreed in the original prompt. Optional follow-ups:
- Playwright E2E suite (deferred — would require fixture booking/customer setup).
- "Bonzah Activity" widget on the admin dashboard root (a nice-to-have; the Settings → Integrations log already has the same data).
- Actual production credentials from brandon@bonzah.com.

---

## 2026-05-01 — Bonzah Insurance Integration · Phase 4 (admin dashboard surfaces)

**Scope:** Admin can now manage Bonzah end-to-end without touching the database. Settings page gains an Integrations tab (kill switch, markup, exclusions, test connection, recent activity log). Booking detail page gets a rebuilt Insurance section with live policy details, Refresh from Bonzah, Cancel Policy.

### Backend admin endpoints
- `backend/routes/bonzah.js` — Phase 1 stub (`/health` only) is now a full admin router. All endpoints gated by `requireAuth + requireRole('owner','admin')` (router-level middleware).
  - `GET /admin/bonzah/health` — unchanged.
  - `GET /admin/bonzah/settings` — returns the 5 known config keys as `{ key: value }` (one query, no N+1).
  - `PUT /admin/bonzah/settings` — accepts a partial body. Whitelist enforces only the 5 known keys can be written via this endpoint (defense against arbitrary settings-row writes). Stamps `updated_by` with admin auth_id.
  - `GET /admin/bonzah/events` — returns last N rows of `bonzah_events`. Supports `limit` (max 200), `booking_id` filter, `errors_only=1`. Defense-in-depth password redaction on the wire even though events were already redacted at write time.
  - `POST /admin/bonzah/booking/:id/refresh` — calls `getPolicyStatus()` against Bonzah, persists fresh `bonzah_policy_no` + `bonzah_coverage_json` + `bonzah_last_synced_at`, returns the live policy data.
  - `POST /admin/bonzah/booking/:id/cancel` — files a cancel endorsement via `cancelPolicy()`. 409 if already cancelled. Updates `insurance_status='cancelled'`.

### Dashboard
- **NEW** `dashboard/src/api/bonzah.js` — Sibling of `api/client.js` (per CLAUDE.md hard rule: `client.js` has 25 consumers, never modify). Exports `bonzahApi` with `health()`, `getSettings()`, `putSettings()`, `getEvents()`, `refreshBookingPolicy()`, `cancelBookingPolicy()`. Same Bearer auth pattern as `client.js` (Supabase session token).

- `dashboard/src/pages/SettingsPage.jsx` — adds a fourth tab (`Integrations`, owner/admin only) with one new component:
  - **NEW** `IntegrationsTab` — Bonzah master card + recent activity log. Master card has:
    - "Test Connection" button → live `/admin/bonzah/health` round-trip with success/failure UI.
    - Kill-switch toggle (`bonzah_enabled`).
    - Markup % input.
    - Excluded-states comma list (full state names).
    - PAI-excluded states comma list (hides Complete tier).
    - Tier read-only summary with default/recommended badges + coverage codes.
    - Save bar (only enabled when draft differs from server) with "Saved" confirmation.
    - **Activity log** below: last 20 `bonzah_events`, error rows highlighted red, hover-reveal booking_id, monospaced timestamps. Manual Refresh button. Health-check round-trips show up here too — useful for debugging.

- `dashboard/src/pages/BookingDetailPage.jsx` — rebuilt Insurance section as new top-level component `BookingInsuranceSection`. **DELETED:** the legacy hardcoded Annie's tier display (basic/standard/premium daily-rate badges) and the manual policy-ID text input.
  - **Provider + status row** — same 2-col grid; status dropdown now includes `cancelled`, `bind_failed`, `expired` so admin can correct manually.
  - **Action buttons** (when `bonzah_policy_id` exists): **Refresh from Bonzah** (calls `/admin/bonzah/booking/:id/refresh`, then re-loads booking) + **Cancel Policy** (confirm modal, calls `/admin/bonzah/booking/:id/cancel`). Both with loading spinners.
  - **Bind-failed banner** when `insurance_status='bind_failed'` — points admin to the Settings event log.
  - **Bonzah policy panel** (when bound): policy_no, policy_id, premium (Bonzah base), markup (Annie's), total charged, last-synced timestamp formatted via `date-fns/format`. Coverage details list rendered from `bonzah_coverage_json` snapshot — shows addon type, premium, limits, deductible.
  - **Manual override** — collapsed by default behind "Edit policy # manually (legacy override)" toggle. Preserves the legacy admin-paste workflow without making it the default UX.
  - **Customer-provided own-policy details** — preserved for both `provider='own'` and bonzah-with-own-on-file cases.

### Hard rules respected
- `dashboard/src/api/client.js` — **NOT modified**. New `bonzah.js` sibling for the 6 new endpoints.
- `dashboard/src/auth/` — **NOT modified**. Re-uses `supabaseClient` for Bearer header same as `client.js`.
- Supabase schema — no new migrations.

### Verification
- `node --check` clean on `backend/routes/bonzah.js`.
- `cd dashboard && npm run build` clean (3095+ modules, 2.86s).

### Manual smoke-test path (post-deploy)
1. Log into the dashboard, navigate to **Settings → Integrations** (owner/admin only).
2. Click **Test Connection** → should show green success with state count + ms.
3. Toggle the kill switch off and on; observe the customer wizard at `/confirm-booking?ref=…` updates immediately (no redeploy).
4. Open a booking that has a Bonzah policy → click **Refresh from Bonzah** → verify "Last synced" timestamp updates and any policy_no drift is reflected.
5. (Optional, against a sandbox booking only) click **Cancel Policy** → verify a `cancel` row appears in the activity log and `insurance_status='cancelled'`.

### Phase 5 (next, optional)
- Playwright E2E covering happy path + 4 failure modes against sandbox.
- `bonzah_tiers` JSON editor in the Settings UI (currently SQL-only).
- PDF download links for CDW/RCLI/SLI/PAI on the booking detail panel.
- `backend/docs/bonzah-runbook.md` covering production cutover + reconciliation.

---

## 2026-05-01 — Bonzah Insurance Integration · Phase 3 (lifecycle + polling + notifications)

**Scope:** Closes the loop on Phases 1–2. Bonzah doesn't expose webhooks, so we poll. Booking cancellations now file Bonzah cancel endorsements. New notification stages keep the customer + admin informed when binds succeed or fail.

### Backend services
- `backend/services/bonzahService.js` — Replaces remaining Phase 2/3 stubs:
  - `cancelPolicy(policyId, remarks, bookingId)` — POST `/Bonzah/newendorse_cncl` with `finalize:1`. Returns `{ endorsement_id, eproposal_id, nstp_id, premium_value, raw }`. Bonzah underwriter approval is async; the polling job catches the eventual settlement.
  - `extendPolicy(policyId, { newPolicyEndDate, newPolicyEndTime, policyStartDate, policyStartTime }, bookingId)` — POST `/Bonzah/newendorse_dc` with `finalize:1`. Returns `epayment_id` + `premium_value` (positive=charge owed; negative=refund-to-credit). Caller is responsible for pairing with `payEndorsement()`.
  - `payEndorsement(epaymentId, amount, bookingId)` — POST `/Bonzah/epayment` to actually settle the additional premium owed for an extension.
  - `getCompletedEndorsements(policyId, bookingId)` — GET `/Bonzah/endorsement_completed`. Used by the polling job to detect cancellation approvals.

- `backend/services/bookingService.js` — `transitionBooking()` cancellation branch:
  - When transitioning a booking to `cancelled` AND it has `bonzah_policy_id` AND `insurance_status='active'`: call `cancelBonzahPolicy()` BEFORE flipping the status to avoid orphaned active policies on cancelled bookings.
  - On Bonzah error: log + create dashboard notification (`bonzah_cancel_failed`), but do NOT block the local cancel — admin reconciles via runbook + Phase 4 manual cancel button.
  - Sets `insurance_status='cancelled'` and `bonzah_last_synced_at` on success.

- `backend/services/stripeService.js`:
  - `bindBonzahAfterPayment()` success path now sends `insurance_policy_issued` to the customer with the bound `policy_no`, tier label, total charged, and effective dates.
  - `bindBonzahAfterPayment()` failure path sends `insurance_bind_failed` to `OWNER_EMAIL` (recipient overridden by mutating the nested `customer.email` on the payload — same pattern used elsewhere). Includes booking code, customer details, vehicle, tier, quote_id, premium, and a deep link to `/bookings/:id` in the dashboard.

- `backend/services/notifyService.js`:
  - `buildMergeFields()` adds Bonzah-specific fields: `bonzah_policy_no`, `bonzah_quote_id`, `bonzah_tier_id`, `bonzah_tier_label`, `bonzah_premium`, `bonzah_total_charged`, `bonzah_coverage_summary` (comma-joined coverage type strings), and a generic `dashboard_link`.
  - `STAGE_CTA` adds `insurance_policy_issued` (gold "View My Booking" → portal). `insurance_bind_failed` is admin-only — no CTA.
  - `EVENT_SUMMARIES` adds both new stages.

- `backend/services/fallbackTemplates.js` — Adds two templates:
  - `insurance_policy_issued` (channel: email) — confirmation with policy_no, tier label, total paid, effective dates.
  - `insurance_bind_failed` (channel: email) — internal alert with quote_id, premium, customer info, and dashboard deep link. Surfaces "customer's Stripe charge HAS gone through. They are not aware of this failure" so admin priority is unambiguous.

### Polling job
- **NEW** `backend/jobs/bonzahPolling.js` — exports `runBonzahPolling()`:
  - Respects the `bonzah_enabled` kill switch (returns `{skipped:true}` when off).
  - Selects bookings with `bonzah_policy_id IS NOT NULL` AND `return_date >= now() - 7 days`. Skips terminal statuses (`cancelled`/`expired`/`bind_failed`).
  - For each: calls `getPolicyStatus()` then `getCompletedEndorsements()`. Reconciles `insurance_status` based on `policy_status`/`endorsement_type`. Auto-flips `pending → active` when Bonzah issued a `policy_no` since last poll, and `active → expired` when the trip has ended without a cancel.
  - Re-snapshots `bonzah_coverage_json` and `bonzah_policy_no` (in case manual ops at Bonzah changed them).
  - Updates `bonzah_last_synced_at` on every successful pass — used by the dashboard "stale" indicator.
  - Returns `{ ok, polled, skipped_terminal, changed, errors, results, ran_at }`.

- `backend/routes/cron.js` — adds `GET /cron/bonzah-poll`. Same `verifyCron` Bearer guard as the other cron endpoints.

- `backend/vercel.json` — third cron entry: `/api/v1/cron/bonzah-poll` on `*/15 * * * *` (every 15 minutes).

### Verification
- `node --check` clean across all modified backend files.
- `import('./jobs/bonzahPolling.js')` resolves cleanly with the expected `runBonzahPolling` export.
- Dashboard `npm run build` clean (2.95s, 3095 modules).

### Behavior with `bonzah_enabled=false` (default)
- Polling job no-ops with `{ skipped:true, reason:'bonzah_enabled=false' }` — zero Bonzah API calls.
- Cancel hook never fires (booking has no `bonzah_policy_id`).
- Bind-success / bind-failure notifications never fire (Stripe webhook never calls `bindBonzahAfterPayment`).

### Action items before Phase 4
- Apply migration 009 (if not yet applied) and seed bonzah_excluded_states with MI/NY/PA per brandon@bonzah.com (already in migration seed).
- Set `BONZAH_*` env vars on backend Vercel project.
- Set `OWNER_EMAIL` env var on backend Vercel project (if not already set) — `insurance_bind_failed` routes there.
- Set `DASHBOARD_URL` env var (already present per .env.example) — populates `dashboard_link` merge field.

### Next (Phase 4)
- New `dashboard/src/pages/SettingsPage.jsx` Integrations tab (Bonzah card with kill switch, markup, tier editor, recent activity log, Test Connection button).
- Rebuild [BookingDetailPage.jsx#L637](dashboard/src/pages/BookingDetailPage.jsx#L637) Insurance section with live policy panel, Refresh button, Cancel button, PDF download links.

---

## 2026-05-01 — Bonzah Insurance Integration · Phase 2 (customer wizard + live quote/bind)

**Scope:** Replaces Annie's-branded insurance tiers (basic/standard/premium) with a real Bonzah REST integration. Customer wizard now shows three Bonzah tiers (Essential / Standard / Complete), fetches live pricing per tier, persists the quote + markup on the booking, and the Stripe webhook auto-binds the policy after charge succeeds.

**Phase 1 prerequisite:** Migration 009 must be applied AND `bonzah_enabled=true` set in the `settings` table for the customer-facing path to render. Until then, the wizard auto-falls-through to the "use my own insurance" path with no UI degradation.

### Backend
- `backend/services/bonzahService.js` — Replaces Phase 1 stubs with real implementations:
  - `buildQuoteBody(booking, customer, coverages, opts)` — translates DB shape → Bonzah's MM/DD/YYYY HH:mm:ss + 11-digit phone + full state names. Defaults pickup to Florida / America/New_York when booking lacks the columns. Adds `inspection_done: 'Rental Agency'` whenever CDW is selected.
  - `getQuote(booking, customer, tierId, opts)` — POST `/Bonzah/quote` with `finalize:0`. Maps tier → coverage flags via `tierToCoverages()` (reads `settings.bonzah_tiers`). Returns `{ quote_id, premium_cents, total_amount, coverage_information, raw }`.
  - `bindPolicy(booking, customer, tierId, bookingId)` — Two-call bind: POST `/Bonzah/quote` with `finalize:1` (locks quote, returns `payment_id`), then POST `/Bonzah/payment` (issues `policy_no`). Throws `BonzahError` on either step.
  - `expandStateAbbrev()` private helper — Bonzah requires "Florida" not "FL".
  - `BonzahError` re-exported from `services/bonzahService.js` so route handlers don't import `utils/`.

- **NEW** `GET /api/v1/bookings/insurance/config` (public) — Returns `{ enabled, tiers, markup_percent, excluded_states, pai_excluded_states }` from the `settings` table. Customer wizard hits this on Insurance step mount. No secrets, no customer data — safe unauthed.

- **NEW** `POST /api/v1/bookings/:code/insurance/quote` (public) — Body `{ tier_id }`. Calls `getQuote()`, applies markup, persists `bonzah_tier_id`, `bonzah_quote_id`, `bonzah_premium_cents`, `bonzah_markup_cents`, `bonzah_coverage_json`, `bonzah_quote_expires_at` (now+24h). Returns the quote shape to client. Returns 503 when `bonzah_enabled=false`. Reuses existing fresh quote (same tier, expiry > now) without round-tripping Bonzah.

- **REWRITTEN** `PATCH /api/v1/bookings/:code/insurance` — three branches:
  - `source:'bonzah' + tier_id` → requires a fresh quote already on the booking (returns 409 `STALE_QUOTE` if missing/expired); sets `insurance_provider='bonzah'`, `insurance_status='pending'`. The actual bind happens after Stripe charge.
  - `source:'own'` → unchanged conceptually; now also clears any stale Bonzah quote columns to prevent accidental binding.
  - `bonzah_policy_number` legacy admin-paste flow preserved for back-compat.

- `backend/services/pricingService.js`:
  - **REMOVED** `INSURANCE_TIERS` constant (Annie's basic/standard/premium tiers).
  - **CHANGED** `calcInsuranceCost(booking)` — now takes a single booking record and reads `bonzah_premium_cents + bonzah_markup_cents` directly. Old signature `(source, tier, days)` removed; both call sites in `stripeService.js` updated.

- `backend/services/stripeService.js`:
  - `createPaymentIntent(bookingCode, { expected_total_cents })` — drops the obsolete `insurance_selection` parameter. Insurance state lives on the booking row now (set by the wizard's `/insurance/quote` call before checkout).
  - **NEW** `bindBonzahAfterPayment(bookingId)` private helper — fired after `payment_intent.succeeded` in both webhook + `confirmPayment()` (idempotent: skips when `bonzah_policy_no` already present, or `insurance_status='bind_failed'`). On success: sets `insurance_status='active'`, persists `bonzah_policy_id`, `bonzah_policy_no`, `bonzah_total_charged_cents`, `insurance_policy_number = policy_no`, `bonzah_last_synced_at`. On failure: marks `bind_failed`, creates a `bonzah_bind_failed` dashboard notification linking to the booking. Stripe charge is NOT reversed — admin reconciles via the runbook (Phase 4).

### Customer site
- `src/components/booking/confirm-booking/constants.ts`:
  - **REMOVED** `INSURANCE_TIERS` const.
  - **NEW** types: `BonzahTier`, `BonzahConfig`, `BonzahQuote`.
  - **NEW** `BONZAH_COVERAGE_LABELS` map (CDW / RCLI / SLI / PAI bullet copy).
  - **NEW** `BONZAH_DISCLOSURE_TEXT` + `BONZAH_DISCLOSURE_LINKS` — verbatim copy from Bonzah's `legal.md`, required above the purchase CTA.
  - `WizardDraft.insuranceChoice`: `'own'|'annies'|null` → `'own'|'bonzah'|null`. Replaced `anniesTier` field with `bonzahTierId` + `bonzahQuote` (cached quote so `OrderSummary` doesn't need a second fetch).

- **REWRITTEN** `src/components/booking/confirm-booking/wizard-steps/InsuranceStep.tsx`:
  - Loads `/bookings/insurance/config` on mount.
  - Three Bonzah tier cards rendered from settings (Standard pre-selected with "Recommended" badge). Hides Complete tier when pickup state ∈ `pai_excluded_states`. Hides entire Bonzah path when state ∈ `excluded_states` (MI/NY/PA per brandon@bonzah.com), driver age < 21, or `bonzah_enabled=false` — falls through to "I have my own insurance".
  - Auto-fetches a draft quote for the default tier on mount; re-quotes silently on tier change. Per-tier loading spinner.
  - Bonzah logo + mandatory legal disclosure rendered below cards with three external links.
  - Uses existing `src/assets/bonzah-logo.svg` (already present from prior work — no new asset).

- `src/components/booking/confirm-booking/wizard-steps/OrderSummary.tsx`:
  - Insurance line now reads `draft.bonzahQuote.total_cents` and labels with capitalized tier id ("Bonzah Insurance — Standard (7 days)"). Removed dependency on `INSURANCE_TIERS`.

- `src/components/booking/ConfirmBooking.tsx`:
  - Drops `INSURANCE_TIERS` import.
  - Inline insurance-cost math (used for `grandTotal` display + Stripe Elements amount) reads from `draft.bonzahQuote`.
  - PATCH `/insurance` payload sends `{ source: 'bonzah'|'own', tier_id? }` (was `{ source: 'annies', tier }`).
  - PaymentIntent POST drops `insurance_selection` body field.
  - Passes `bookingCode` and `pickupState` to `InsuranceStep` (required for the new live-quote endpoint and for state-exclusion lookup).

### Live sandbox verification (2026-05-01)
- Draft quote against Bonzah sandbox using the exact field shape `buildQuoteBody()` produces (Florida, 7 days, age 41, CDW+RCLI+SLI / Standard tier): `status:0`, `total_premium:$492.17`, `quote_id:Q000000041573`, `policy_id:P000000041573`. With 10% markup → $541.39 customer-facing.
- Customer site `npm run build`: clean (2138 modules, 2.01s).
- Dashboard `npm run build`: clean (3095 modules, 3.02s).

### Blast radius
- **Backend:** 4 files modified (`services/bonzahService.js`, `routes/bookings.js`, `services/pricingService.js`, `services/stripeService.js`). All idempotent and behind `bonzah_enabled` flag.
- **Customer site:** 4 files modified (`constants.ts`, `InsuranceStep.tsx`, `OrderSummary.tsx`, `ConfirmBooking.tsx`).
- **Dashboard:** untouched in Phase 2 — admin BookingDetailPage still shows the legacy Bonzah-policy field (Phase 4 will rebuild it).
- **Schema:** untouched — Phase 1 migration 009 already added the columns.

### Behavior with `bonzah_enabled=false` (default)
- `GET /bookings/insurance/config` returns `{ enabled: false }` — InsuranceStep auto-hides the Bonzah path; customer goes through "use my own insurance" only.
- `POST /bookings/:code/insurance/quote` returns 503.
- `bindBonzahAfterPayment()` no-ops on bookings without `insurance_provider='bonzah'`.
- Existing bookings unaffected (no schema change since 009).

### Next (Phase 3 — polling + lifecycle)
- `backend/jobs/bonzahPolling.js` (Vercel Cron, every 15min) — reconcile `insurance_status` against `/Bonzah/policy`.
- Cancellation flow → call `cancelPolicy()` from `bookingService` cancel handler.
- Date-extension flow → `extendPolicy()` + `payEndorsement()` + Stripe delta charge.
- Two new notification stages: `insurance_policy_issued`, `insurance_bind_failed` (templates).

---

## 2026-05-01 — Bonzah Insurance Integration · Phase 1 (backend foundation, no customer-visible change)

**Scope:** Foundation for replacing the broken Annie's-branded insurance flow with a direct Bonzah REST API integration. Phase 1 only — adds schema, HTTP client, service layer, and an admin health-check endpoint. **No customer wizard changes yet.** Customer-side work lands in Phase 2 (per `BONZAH_INTEGRATION` prompt in this conversation).

### Schema
- **NEW** `backend/db/migrations/009_bonzah_integration.sql` — idempotent migration. Adds 8 columns to `bookings` (`bonzah_tier_id`, `bonzah_quote_id`, `bonzah_policy_no`, `bonzah_premium_cents`, `bonzah_markup_cents`, `bonzah_total_charged_cents`, `bonzah_coverage_json`, `bonzah_quote_expires_at`, `bonzah_last_synced_at`). `bonzah_policy_id` already existed from 001 — preserved unchanged. Creates `bonzah_events` (audit log, indexed on booking_id + recent + errors-only) and a generic `settings` k/v table (with auto-update trigger). Seeds `bonzah_enabled=false`, `bonzah_markup_percent=10`, `bonzah_tiers` JSON (essential/standard/complete; standard default+recommended), `bonzah_pai_excluded_states=[]`, `bonzah_excluded_states=[]`. **Apply via Supabase SQL editor before Phase 2.**

### Backend services
- **NEW** `backend/utils/bonzah.js` — HTTP client with `BonzahError` class. Re-auths on every call (POST `/api/v1/auth` → 15-min token, no caching). 15s fetch timeout. One retry on 5xx for GET/DELETE only — POSTs that bind/charge are NOT auto-retried (no idempotency key support from Bonzah). Every call writes one `bonzah_events` row including duration_ms; password is redacted from stored requests. Throws when `data.status !== 0`.
- **NEW** `backend/services/bonzahService.js` — Business logic + Bonzah field translation. `getSetting()`, `tierToCoverages()`, `formatPhone()` (normalizes to 11 digits, prefixes "1" for US 10-digit), `formatDateOnly()` / `formatDateTime()` (Bonzah MM/DD/YYYY format), `computeAge()`, `validateBookingForBonzah()` (enforces age ≥ 21 and SLI-requires-RCLI). API ops: `getMaster()`, `getPolicyStatus()`, and `healthCheck()` — used now. `getQuote()`, `bindPolicy()`, `cancelPolicy()`, `extendPolicy()`, `payEndorsement()` are stubbed for Phase 2/3 (throw with clear "lands in Phase N" messages).

### Admin endpoint
- **NEW** `backend/routes/bonzah.js` — `GET /api/v1/admin/bonzah/health`, gated by `requireAuth + requireRole('owner','admin')`. Authenticates against Bonzah, fetches the master states list, returns `{ ok, duration_ms, states_returned, base_url }` or `{ ok:false, error, http_status, ... }`. Returns 200 even on Bonzah failure so the dashboard "Test Connection" button can show the underlying message.
- `backend/server.js` — Mounted under `/api/v1/admin/bonzah`. New imports + `app.use()` line; nothing else touched.

### Config
- `backend/.env.example` — Adds `BONZAH_API_BASE_URL` (defaults to sandbox `https://bonzah.sb.insillion.com`), `BONZAH_EMAIL`, `BONZAH_PASSWORD`. **Production base URL pending — contact brandon@bonzah.com.**

### Live sandbox verification (2026-05-01)
- `POST /api/v1/auth` against sandbox with provided creds → `status:0`, token issued, 246ms.
- `POST /api/v1/Bonzah/master` (states/US) with token → 47 states returned.
- **Confirmed by brandon@bonzah.com (2026-05-01):** Michigan, New York, Pennsylvania are full Bonzah exclusions. Seed in `009_bonzah_integration.sql` updated to pre-populate `bonzah_excluded_states = ["Michigan","New York","Pennsylvania"]`. If migration already applied, run: `UPDATE settings SET value = '["Michigan","New York","Pennsylvania"]'::jsonb WHERE key = 'bonzah_excluded_states';`

### Blast radius
- 5 new files, 2 modified (`backend/server.js` + `backend/.env.example`). No existing route handlers, services, or UI components touched. Zero risk to live booking flow with `bonzah_enabled=false` (the default seed). Migration is idempotent (`IF NOT EXISTS` everywhere) and safe to re-run.

### Next (Phase 2)
- Customer wizard tier UI in `src/components/booking/confirm-booking/wizard-steps/InsuranceStep.tsx`
- `POST /bookings/:code/insurance/quote` endpoint
- Implement `getQuote()` + `bindPolicy()` in `bonzahService.js`
- Wire bind into Stripe `handlePaymentSuccess()` webhook
- Get user signoff on Phase 1 sandbox health-check before starting

---

## 2026-04-28 — Follow-ups: pending_inspections + QuickActionModal + Stripe card-on-file rollout

**Scope:** Three closing items per spec. 8 files modified, 4 new (1 migration, 1 backend service, 2 dashboard components). All Stripe card-on-file behavior is gated by env var `FEATURE_AUTO_OVERAGE_CHARGES=true`; with the flag off, every new path is a no-op.

### F-1 · `pending_inspections` count
- `backend/routes/stats.js` — `/overview` now returns `pending_inspections`: count of `bookings.status='returned'` with no `admin_inspection` record. Two-step query (no left-join in PostgREST). The Inspections pill in `AlertPillBar` now lights up when there's work waiting.

### F-2 · QuickActionModal (Task 4)
- **NEW** `dashboard/src/components/shared/QuickActionModal.jsx` — Loads the booking attached to a notification, surfaces Approve / Decline / Dismiss / View-full controls inline. Mutations call `api.approveBooking`/`api.declineBooking` + `markNotificationRead` + `useAlerts().refresh()` so the badge dismisses everywhere within 300ms.
- `dashboard/src/components/layout/NotificationDropdown.jsx` — High-priority types (`new_booking`, `agreement_pending`, `damage_report`) now open `<QuickActionModal />` instead of routing. Other notification types continue to navigate via `notif.link`. Admin keeps dashboard context for routine actions.

### F-3 · Stripe card-on-file (full rollout, behind feature flag)
- **NEW** `backend/migrations/005_card_on_file.sql` — Adds `customers.stripe_customer_id`, `bookings.stripe_payment_method_id`/`card_brand`/`card_last4`. Creates `pending_overage_charges` (with status FSM: pending → disputed | processing → succeeded | failed | cancelled) + `pending_overage_charge_log` audit table. Indexed on `(scheduled_for) WHERE status='pending'` for cron efficiency. **Apply via Supabase SQL editor — script is idempotent.**
- **NEW** `backend/services/cardOnFileService.js` — `ensureStripeCustomer(customer)` (idempotent; persists token to `customers.stripe_customer_id`); `savePaymentMethodFromIntent(pi, bookingId)` (called from succeeded webhook); `scheduleOverageCharge({ bookingId, amountCents, description, lineItems, delayMs })` (default 48h delay); `processDueOverageCharges()` (cron worker — claims rows via `pending → processing` to prevent double-fire, creates off-session PI, handles `requires_action`/declined → status `failed` + audit log entry); `disputePendingCharge(id, message)` (within window only); `listCustomerVisibleCharges(bookingId)`. **Every export is a no-op when `FEATURE_AUTO_OVERAGE_CHARGES` is off.**
- `backend/services/stripeService.js`:
  - `createPaymentIntent` → calls `ensureStripeCustomer` and adds `customer:` + `setup_future_usage: 'off_session'` to the PI when the flag is on.
  - `handleWebhookEvent` `payment_intent.succeeded` → calls `savePaymentMethodFromIntent` to persist the PM token + brand + last4 to the booking row.
- `backend/services/depositService.js` `settleDeposit` — when `amountOwed > 0` AND flag is on AND a card is on file, schedules a `pending_overage_charges` row and dispatches the `inspection_charges_scheduled` email (Resend). Returns the new `overageScheduledId` in the response.
- `backend/routes/cron.js` — `/cron/daily` now also processes due overage charges. New `/cron/process-overage-charges` route for hourly polling so charges fire within ~1h of their dispute window closing.
- `backend/routes/portal.js` — Two new endpoints behind portal JWT: `GET /portal/pending-charges` (lists charges visible to the customer) and `POST /portal/pending-charges/:id/dispute` (flips pending → disputed; verifies the charge belongs to the customer's booking).
- `backend/services/fallbackTemplates.js` — Adds `inspection_charges_scheduled` body so the email renders even if the admin hasn't customised it via the Messaging tab. Goes through the Batch B branded shell + portal CTA.
- `backend/services/notifyService.js` — `STAGE_CTA` and `EVENT_SUMMARIES` extended for `inspection_charges_scheduled`.
- `src/components/portal/CustomerPortal.tsx` — Loads pending charges on returned/completed bookings; renders an amber "Inspection Charges" card listing each scheduled charge with status, hours-left-to-dispute, an inline textarea, and a "Dispute charge" button. Posts to `/portal/pending-charges/:id/dispute` and reflects the new status without a full reload.

### Operating notes
1. **Apply the migration first.** Without `005_card_on_file.sql`, the new code paths still don't fire (the flag check happens before any DB write), but the cron worker will log warnings if the table is missing once the flag is flipped.
2. **Deploy with `FEATURE_AUTO_OVERAGE_CHARGES` unset (or `false`).** The schema is in place but no behavior changes. Test the booking flow to confirm nothing regresses.
3. **Flip the flag** on a single Vercel preview deployment first. Run a test booking end-to-end: book → pay → inspection with `amountOwed > 0` → confirm row in `pending_overage_charges` + email received → dispute via portal → confirm cron skips disputed → un-dispute (admin manually) → confirm cron charges card.
4. **Add `/cron/process-overage-charges` to Vercel Cron** at hourly cadence (e.g. `0 * * * *`).
5. **Stripe Dashboard:** confirm "save payment methods for off-session payments" is enabled (default for cards), and that the standard "we may charge your card later" disclosure is included in your booking T&Cs.

**Builds:** ✅ Customer site 882.07 kB / 227.65 kB gzip · Dashboard 1,444.31 kB / 384.75 kB gzip · all backend files `node --check` pass.

---

## 2026-04-28 — Batch G: Stripe card-on-file audit (NO CODE, awaiting sign-off)

**Scope:** Read-only audit of card-saving and payment-method persistence. 0 files modified.

### Findings
1. **`setup_future_usage` / `SetupIntent` / `off_session` — zero hits in the codebase.** `createPaymentIntent` in `backend/services/stripeService.js:101-118` creates PIs with only `automatic_payment_methods: { enabled: true }` and metadata; no `customer:` param, no future-usage flag. Cards are not saved.
2. **`stripe_customer_id` / `stripe_payment_method_id` / `payment_method_id` — zero hits anywhere.** The `payments` table records `payment_method_details?.type` as a free-text string for receipt rendering only (not a chargeable token).

### Conclusion
Auto-overage charging cannot land until: (a) booking-flow PI creation is updated to attach a Stripe Customer + set `setup_future_usage: 'off_session'`, AND (b) Supabase schema gains `customers.stripe_customer_id`, `bookings.stripe_payment_method_id`, plus a `pending_overage_charges` table. Detailed migration SQL + step-by-step plan delivered in conversation. **Awaiting explicit user sign-off before any code is written.**

---

## 2026-04-28 — Batch F: Real-time alert system (centralized AlertsContext)

**Scope:** Centralized alerts state + cross-component refresh + new top-bar alert pills + active-rental cash-rain ack modal. 6 files touched (3 new, 3 modified).
**Blast Radius:** MEDIUM — touches DashboardLayout (provider added), 1 widget, 1 page. The provider wraps the entire dashboard; consumers opt in via `useAlerts()`.

### Dashboard (3 new, 3 modified)
- **NEW** `dashboard/src/lib/alertsContext.jsx` — `AlertsProvider` + `useAlerts()` hook. Single 30-second poll for `getOverview()` (no longer per-component). Exposes `{ alerts, refresh, onActiveRentalStarted }`. The `refresh()` method invalidates the overview cache and re-pulls; mutations everywhere call it to bypass the 30s wait. `onActiveRentalStarted(callback)` fires when `active_rentals` count increments between polls (used to trigger the cash rain).
- **NEW** `dashboard/src/components/layout/AlertPillBar.jsx` — Compact row of high-priority pills inserted in the header next to GlobalSearch. Pills: Inspections (returned awaiting inspection), Active (currently active count), Approvals. Pills auto-hide when count is 0; staggered AnimatePresence for tasteful pop-in.
- **NEW** `dashboard/src/components/shared/CashRainOverlay.jsx` — Framer-Motion 💵 rain (~28 bills, 1.6s drop with random column/drift/rotate, capped 2s total). Respects `prefers-reduced-motion`.
- `dashboard/src/components/layout/DashboardLayout.jsx`:
  - Wrapped in `AlertsProvider` so every page sees the same alert state.
  - Replaced local `getOverview()` polling with `useAlerts()`.
  - Added `<AlertPillBar onActiveAlertClick={() => setActiveAlertModal(true)} />` to header.
  - Active-rental detection wired via `onActiveRentalStarted` → opens a thumbs-up "Rental is now active" acknowledgement modal. Click → cash rain plays for ~2s and dismisses.
- `dashboard/src/pages/BookingDetailPage.jsx` — `doAction()` now `Promise.all`s `load()` + `refreshAlerts()` so approving/declining/canceling/checking-out from the detail bar updates the top-bar pill, sidebar badge, and any open dashboard widget within ~300ms (the bug the user reported).
- `dashboard/src/components/dashboard/widgets/PendingApprovalsWidget.jsx` — `handleApprove` and `handleDeclined` both call `refreshAlerts()` in addition to local cache invalidation.

### Action → invalidation matrix (per task 3 spec)

| Action | Caller | Refresh path |
|---|---|---|
| Approve | PendingApprovalsWidget · BookingDetailPage | `invalidateCache('overview')` + `useAlerts().refresh()` |
| Decline | PendingApprovalsWidget · BookingDetailPage | same |
| Cancel | BookingDetailPage | same |
| Pickup recorded | BookingDetailPage | same — flips status to active, also fires AlertsContext active-rental detector → cash rain |
| Return recorded | BookingDetailPage | same — flips to returned, populates Inspections pill |
| Complete | BookingDetailPage | same |
| Payment / Damage | BookingDetailPage | same |

### Out of scope (followup)
- **Task 4 (top-right alert badges → quick-action modal instead of navigate):** the existing `NotificationDropdown` shows DB notifications and routes via `notif.link`. Converting every routed notification type to a quick-action modal would touch 4–6 more files (modal component, type-specific action sets, mutation wiring). Logged as a follow-up; the centralized refresh path means a quick-action modal can be dropped in without revisiting the alert-state mechanism.
- **Backend `pending_inspections` count in `getOverview()`:** field is read by `AlertPillBar` but not yet emitted by the backend. Pill renders 0 (and hides) until the backend route adds the count. Tracked as a 2-line change to `routes/stats.js`.

**Builds:** ✅ Dashboard 1,437.05 kB / 383.45 kB gzip — zero errors.

---

## 2026-04-28 — Batch E: Booking-detail polish + condition resume

**Scope:** Photo ID renders inline (not click-to-load), condition photos section grouped by source/phase, and `CheckOutTab` resumes at Review Charges when an admin_inspection record already exists. 2 files modified.
**Blast Radius:** LOW — both changes are additive UI behavior; no API changes, no schema changes (uses existing `checkin_records` table).

### Dashboard (2 files)
- `dashboard/src/pages/BookingDetailPage.jsx`:
  - `IdPhotoGallery` — pre-fetches signed URLs for both ID photos on mount via `useEffect`/`Promise.all` so front + back render inline. Click-to-zoom preserved through the existing lightbox. Tile size bumped to `h-32 w-48` for at-a-glance review.
  - New `ConditionPhotosSection` component renders 4 labeled groups: Admin · Check-In, Customer · Check-In, Admin · Check-Out, Customer · Check-Out. Pulls from `api.getCheckinRecords()` on mount, merges `photo_urls[]` and `photo_slots{}` per record, dedupes, and shows 3-column thumbnails per group with click-to-enlarge. Empty groups show "No photos recorded".
  - `BookingDetailPage` loads `checkinRecords` alongside the booking and passes them to the new section.
- `dashboard/src/components/booking-tabs/CheckOutTab.jsx`:
  - On mount, after fetching `checkinRecords`, hydrates Step-1 condition fields (`odometer`, `fuelLevel`, `notes`, `photos`) from the existing `admin_inspection` record if one exists, then auto-advances `step` from 0 → 1 (Review Charges). The `hydrated` guard prevents repeated hydration if the user navigates away and back. Result: admins who saved condition and left now resume directly at Review Charges with their data pre-populated.

**Builds:** ✅ Dashboard 1,431.12 kB / 381.89 kB gzip — zero errors.

---

## 2026-04-28 — Batch D: Admin checkout intelligence (mileage helper + indicators)

**Scope:** Pure mileage-overage helper with unit tests + admin checkout signals (paid add-on badges, free-mileage chip, live overage cost, fuel discrepancy). 3 files modified, 1 new.
**Blast Radius:** LOW–MEDIUM — `inspectionService.js` change is additive (new pure helper, existing one preserved with `freeMiles` rename + `allowedMiles` alias). UI change is single component.

### Backend (1 file modified, 1 new)
- `backend/services/inspectionService.js`:
  - New pure helper `calculateMileageOverageFromInputs({ checkInOdometer, checkOutOdometer, rentalDays, hasUnlimitedMiles })` returns `{ totalMiles, freeMiles, overageMiles, overageFee, overageFeeDollars, unlimitedMiles?, noData? }`. 200 free mi/day, $0.34/mile, skip when unlimited.
  - Existing `calculateMileageOverage(booking)` rewritten to delegate to the pure helper. Returns `freeMiles` (new) plus `allowedMiles` alias for backward compat.
  - Worked example documented in JSDoc: 2-day rental, 100 mi over → 100 × $0.34 = $34.00.
- `backend/tests/inspectionService.test.js` (NEW) — 7 tests pass: spec example, exact allowance, under allowance, unlimited skip, missing data, rate constants, 1-day overage.

### Dashboard (1 file)
- `dashboard/src/components/booking-tabs/CheckOutTab.jsx`:
  - Vehicle header gets badges/pills: "∞ Unlimited Miles · Paid", "Unlimited Tolls · Paid" (green positive indicators when add-ons present); a "Free Miles: N" chip for standard bookings showing `200 × rental_days`. For unlimited-miles, the chip is hidden (the badge replaces it).
  - Below the existing trip-length line, a mileage status row in matching `text-xs font-medium tabular-nums`: green "Unlimited mileage" when paid; red `{N} mi over · ${X.XX} fee` live as the admin types the return odometer; green "Under mileage allowance" otherwise. Math mirrors the backend helper.
  - Below the FuelSelector, a fuel status row with the same typographic treatment: green "Fuel level OK" when return matches admin handoff fuel; red "Fuel discrepancy · check-in was {level}" otherwise. Falls back gracefully when no admin handoff record exists.
  - "Add Charge" → selecting `mileage_overage` pre-fills the amount with the calculated overage dollars (admin can override). Other types continue to use the configured `defaultAmount`.

**Builds:** ✅ Dashboard 1,428.77 kB / 381.17 kB gzip — zero errors. Backend tests: 7/7 pass.

---

## 2026-04-28 — Batch C: Customer portal status-driven layout map

**Scope:** Single `STATUS_LAYOUT_CONFIG` map drives welcome-note text + which CollapsibleSections default to expanded per booking status. 1 file modified.
**Blast Radius:** LOW — single file (`CustomerPortal.tsx`), no API changes, no new dependencies.

### Customer Site (1 file)
- `src/components/portal/CustomerPortal.tsx`:
  - New top-of-file `STATUS_LAYOUT_CONFIG: Record<StatusKey, StatusLayout>` map. Statuses covered: `pending_approval`, `approved`, `confirmed`, `ready_for_pickup`, `active`, `returned`, `completed`, `cancelled`, `declined`. Each entry holds a `welcome(ctx)` function and `expandedSections: string[]`.
  - Welcome notes match the existing returned-status voice — concise, warm, one short sentence with the next action. `confirmed/approved` → "You'll receive a confirmation when your ride is cleaned, prepped, and ready to pick up at {pickup}." `ready_for_pickup` → "Your ride is ready! Review the pickup instructions below and complete Start your rental to receive your lockbox code." `active`, `returned`, `completed`, etc. all from the same template.
  - Helper `isSectionExpanded(status, sectionKey)` returns whether a given CollapsibleSection should render `defaultOpen`.
  - Welcome banner inserted directly after the persistent rental card (vehicle photo + dates + progress bar). Tone (color) shifts by status — gold for ready, blue for active, green for returned. `aria-live="polite"`.
  - `Safety & return guide` CollapsibleSection now reads `defaultOpen={isSectionExpanded(status, 'safety_guide')}` — open during active rental, closed otherwise.

**Section visibility ordering:** unchanged — already gated by `{status === '...' && ...}` blocks, which produce the order described in the spec (Pickup location → Start your rental → Vehicle prep report for ready_for_pickup; Safety guide → Return your vehicle for active). The config map covers welcome note + expansion; visibility/order remain implicit in the JSX gates to avoid a 1,400-line restructure.

**Builds:** ✅ Customer site 878.55 kB / 226.94 kB gzip — zero errors.

---

## 2026-04-28 — Batch B: Agreement gate + itemized confirmation email

**Scope:** Gate Continue/checkbox on agreement read+scroll; inject itemized receipt + welcome banner + pickup next-steps card into `payment_confirmed` email. 2 files modified.
**Blast Radius:** LOW–MEDIUM — TermsStep is a leaf wizard step (single consumer). notifyService change is additive: new merge fields + prepend HTML param, only `payment_confirmed` stage uses it; remaining 18 stages unchanged.

### Customer Site (1 file)
- `src/components/booking/confirm-booking/wizard-steps/TermsStep.tsx` — Checkbox + Continue disabled until accordion expanded AND scroll container at bottom (`scrollTop + clientHeight >= scrollHeight - 4`). Edge case: if content fits without scrolling, `requestAnimationFrame` measure marks it as scrolledToEnd. `aria-live="polite"` region announces state to screen readers. End-of-terms marker added inside scroll body.

### Backend (1 file)
- `backend/services/notifyService.js`:
  - `buildBookingPayload()` — added `daily_rate`, `subtotal`, `discount_amount`, `delivery_fee`, `line_items`, `payments` so the receipt renderer has the same fields the portal uses.
  - New helpers: `renderItemizedReceiptHtml(bp)` (mirrors portal's "Itemized receipt" — daily-rate × days, delivery, mileage/toll add-ons, discount, FL tax, total, deposit hold, total charged from payments[]), `renderPrepWelcomeHtml(mergeFields)`, `renderPickupNextStepsHtml(mergeFields)`.
  - `wrapInBrandedHTML()` accepts an optional `prependHtml` parameter, inserted above the rendered template body.
  - `sendBookingNotification()` for `stage === 'payment_confirmed'` builds welcome banner + itemized receipt + pickup next-steps and prepends. **No template rows in `email_templates` are modified — the existing `payment_confirmed` body is preserved beneath the receipt.** Other 18 stages: identical behavior to before.

**Trace through 19 notification stages confirmed:** only `payment_confirmed` receives `prependHtml`; all other stages call `wrapInBrandedHTML` with the new optional param defaulting to `''`.

**Builds:** ✅ Customer site 876.32 kB / 226.37 kB gzip — zero errors. Backend `node --check` passes.

---

## 2026-04-28 — Batch A: Public site copy + adaptive gallery

**Scope:** Trust-badge count update, section reorder, gallery renders only existing images. 5 files modified.
**Blast Radius:** LOW — public marketing site only, no API/state changes.

### Customer Site (5 files)
- `src/components/home/Hero.tsx` — "Trusted by 500+" → "Trusted by 1,200+ local renters"
- `src/components/home/TrustSection.tsx` — "Trusted by 500+ local clients" → "Trusted by 1,200+"
- `src/App.tsx` — `LongTermSection` moved to immediately follow `TrustSection` ("Why Annie's"); preserved Reviews/Insurance/FAQ order. Anchors `#trust` and `#longterm` unchanged.
- `src/components/vehicle/Gallery.tsx` — Adaptive grid: 1 image = full tile, 2 images = 2-col split, 3+ images = main + sides + "+N" overlay. Empty array → renders nothing. Mobile "View All Photos" button only renders for 2+ images.
- `src/components/vehicle/QuickViewModal.tsx` — Guard `<motion.img>` so zero-image vehicles don't render a broken `<img>`. Dot pager already adapts to `vehicle.images.length`.

**Builds:** ✅ Customer site 874.46 kB / 225.90 kB gzip — zero errors.

---

## 2026-04-26 — Phase 8: Loyalty / Repeat Customer

**Scope:** Automatic tier-based discounts at booking creation + admin Loyalty dashboard. 9 files (3 new, 6 modified).
**Blast Radius:** MEDIUM — pricing chain modified (pricingService → bookingService); no existing bookings affected.

### Backend (6 files)
- `backend/services/loyaltyService.js` — NEW. `LOYALTY_TIERS` config (Bronze 1+ → 5%, Silver 3+ → 8%, Gold 5+ → 10%, VIP 10+ → 15%). `resolveCustomerLoyalty(supabase, customerId)` counts completed bookings and returns `{ tier, discountPct, completedCount }`
- `backend/routes/loyalty.js` — NEW. `GET /loyalty/customers` (admin): aggregates bookings per customer, returns tier + total spent + last rental + breakdown counts
- `backend/api/index.js` + `backend/server.js` — registered `/api/v1/loyalty`
- `backend/services/pricingService.js` — `computeRentalPricing()` gains `loyaltyDiscountPct` + `loyaltyTierLabel` params. Discount applied post-seasonal, pre-tax. Shows as named line item (e.g. *"Gold loyalty (10% off)"*) on invoice
- `backend/services/bookingService.js` — `resolveMultiplier` + `resolveCustomerLoyalty` called in parallel (`Promise.all`) before pricing; results passed to `computeRentalPricing`

### Dashboard (3 files)
- `dashboard/src/pages/LoyaltyPage.jsx` — NEW. 4 tier stat cards (click to filter), searchable table: tier badge, completed count, total spent, last rental date. Row click → CustomerDetail
- `dashboard/src/App.jsx` — `/loyalty` route added
- `dashboard/src/components/layout/Sidebar.jsx` — "Loyalty" nav item (Crown icon)

**No migration required** — loyalty tier computed from existing `bookings` table.
**Builds:** ✅ Dashboard 1,420.22 kB — zero errors

---

## 2026-04-26 — Phase 7: Dynamic / Seasonal Pricing

**Scope:** Date-range pricing rules applied automatically at booking creation. 8 files (3 new, 5 modified).
**Blast Radius:** MEDIUM — pricing chain modified (pricingService → bookingService); no existing bookings retroactively repriced.

### Backend (6 files)
- `backend/routes/pricingRules.js` — NEW. CRUD (admin-only): `GET`, `POST`, `PATCH /:id`, `DELETE /:id`
- `backend/api/index.js` + `backend/server.js` — registered `/api/v1/pricing-rules`
- `backend/services/pricingService.js` — `resolveMultiplier(supabase, pickup, return, vehicleId)` helper exported. `computeRentalPricing()` gains `priceMultiplier` + `seasonalRuleName` params. Multiplier applies to subtotal; shows as named line item (e.g. *"Spring Break (+25%)"*)
- `backend/services/bookingService.js` — calls `resolveMultiplier` before pricing; multiplier + name passed through

### Dashboard (2 files)
- `dashboard/src/pages/PricingRulesPage.jsx` — NEW. Rule cards grouped Active Now / Upcoming / Past. Amber "LIVE" badge. Active toggle. Create/edit modal with live `+25%` / `-10%` multiplier preview. Amber banner when rule is firing
- `dashboard/src/App.jsx` — `/pricing-rules` route; Sidebar "Pricing Rules" (Percent icon)

**Migration (already applied):**
```sql
CREATE TABLE pricing_rules (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, start_date date NOT NULL, end_date date NOT NULL, multiplier decimal(4,3) NOT NULL DEFAULT 1.0, vehicle_ids jsonb, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
```
**Builds:** ✅ Dashboard 1,412.08 kB — zero errors

---

## 2026-04-26 — Phase 6: Driver's License Verification

**Scope:** Front/back license photo upload in booking wizard + admin signed-URL viewer. 5 files modified.
**Blast Radius:** LOW — additive only; wizard gains optional upload step; admin viewer falls back gracefully for old bookings.

### Customer Site (3 files)
- `src/components/booking/confirm-booking/wizard-steps/LicenseStep.tsx` — Front/back photo upload slots added. Uploads to `POST /uploads/id-photo`. Shows preview thumbnail + remove button. Upload is optional ("speeds up check-in")
- `src/components/booking/confirm-booking/constants.ts` — `licensePhotoPaths: string[]` added to `WizardDraft` interface + `getDefaultDraft()`
- `src/components/booking/ConfirmBooking.tsx` — `license_photo_paths` included in agreement sign payload

### Backend (1 file)
- `backend/routes/agreements.js` — `license_photo_paths` destructured from body, stored as JSONB in `rental_agreements.license_photo_paths`

### Dashboard (1 file)
- `dashboard/src/pages/BookingDetailPage.jsx` — `IdPhotoGallery` component: handles new multi-path array (fetches 2-hr admin signed URLs on click) + legacy `c.id_photo_url` fallback. `hasIdPhoto` updated to check `ag?.license_photo_paths`

**Migration (already applied):**
```sql
ALTER TABLE rental_agreements ADD COLUMN IF NOT EXISTS license_photo_paths JSONB;
```
**Builds:** ✅ Dashboard 1,400.47 kB — zero errors

---

## 2026-04-26 — Phase 5: Automated Message Sequences

**Scope:** 5 new lifecycle triggers in the daily cron + notifyService additions + Sequences dashboard tab. 3 files modified (backend only — no customer site changes).
**Blast Radius:** LOW — additive only, no existing logic modified.

### Backend (2 files)
- `backend/routes/cron.js` — 5 new sequences added to `/daily`:
  - **Mid-rental check-in** — `pickup_date = 2 days ago`, status `active`
  - **Extension offer** — `return_date = tomorrow`, status `active`, `rental_days >= 3`
  - **Review request** (`rental_completed`) — `return_date = yesterday`, status `completed`
  - **Repeat customer** — `return_date = 30 days ago`, status `completed`
  - **Late return escalation** — `return_date = 4 days ago`, status `active` (single fire vs. daily warning)
  - Added `daysAgo(n)` helper; results object extended
- `backend/services/notifyService.js` — added `STAGE_CTA` entries for `late_return_escalation`, `mid_rental_checkin`, `extension_offer`, `repeat_customer`; added all 4 to `EVENT_SUMMARIES`

### Dashboard (1 file)
- `dashboard/src/pages/MessagingPage.jsx` — 3rd tab "Sequences" added; `SequencesTab` component lists all 8 automated sequences with trigger logic, color coding, and stage ID; `SEQUENCES` const mirrors cron implementation for admin visibility

**Deduplication note:** All sequences use exact-date matching (e.g. `pickup_date = 2 days ago`) so each booking matches at most once per sequence. No `notifications_log` table required.

**Builds:** ✅ Dashboard 1,398.89 kB — zero errors

---

## 2026-04-26 — Phase 4: Analytics Hardening

**Scope:** Wire Phase 1 rate_type data into Revenue dashboard. New charts + inquiry funnel + Reviews badge. 3 files modified.
**Blast Radius:** LOW — backend stats route + dashboard layout alerts + revenue page only.

### Backend (1 file)
- `backend/routes/stats.js`:
  - `/overview` — added `pending_reviews` count (unapproved reviews); used by sidebar badge
  - `/revenue` — added `rate_type`, `rental_days`, `weekly_discount_applied` to bookings join; new response fields: `by_rate_type`, `days_distribution`, `avg_rental_days`, `weekly_discount_total`, `inquiry_funnel`; transactions now include `rate_type` + `rental_days`

### Dashboard (2 files)
- `dashboard/src/components/layout/DashboardLayout.jsx` — `pending_reviews` added to alerts object (feeds sidebar Reviews badge)
- `dashboard/src/pages/RevenuePage.jsx`:
  - New KPI card: Avg Rental Length + weekly discount total
  - New: Monthly Lead Funnel (4-step pill cards: new/contacted/converted/closed)
  - New: Revenue by Rate Type donut (daily=indigo, weekly=gold, weekly_mixed=amber)
  - New: Booking Length Distribution bar chart (7+ days highlighted gold)
  - Transactions table: Rate column with colored pill + day count
  - CSV export: added Rate Type + Days columns

**Builds:** ✅ Dashboard 1,395.34 kB — zero errors

---

## 2026-04-26 — Phase 3: Reviews & Social Proof

**Scope:** Post-rental review collection + live display + admin approval queue. 9 files changed (2 new, 7 modified).
**Blast Radius:** MEDIUM — portal, homepage ReviewsSection, dashboard.

### Backend (3 files)
- `backend/routes/reviews.js` — NEW. `POST /reviews` (public, 5/hr rate limit), `GET /reviews` (approved only), `GET /reviews/pending` (admin), `PATCH /reviews/:id` (approve/reject), `DELETE /reviews/:id`
- `backend/api/index.js` — registered `/api/v1/reviews`
- `backend/server.js` — registered `/api/v1/reviews`

### Customer Site (2 files)
- `src/components/portal/CustomerPortal.tsx` — Star rating + comment form shown when `status === 'completed'`; thank-you state after submit
- `src/components/home/ReviewsSection.tsx` — Fetches live approved reviews from API on mount; merges with static seed; overall rating + count computed dynamically

### Dashboard (4 files)
- `dashboard/src/pages/ReviewsPage.jsx` — NEW. Pending queue (approve/reject) + Live tab (remove). Badge shows pending count.
- `dashboard/src/App.jsx` — `/reviews` route added
- `dashboard/src/components/layout/Sidebar.jsx` — Reviews nav item with `pending_reviews` alert badge
- `dashboard/src/api/client.js` — `getReviews`, `getReviewsPending`, `updateReview`, `deleteReview`

### DB Migration Required
Run before deploying — create `reviews` table:
```sql
create table reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid references bookings(id) on delete set null,
  booking_code text,
  reviewer_name text not null,
  rating int not null check (rating between 1 and 5),
  comment text not null,
  vehicle_name text,
  approved boolean not null default false,
  created_at timestamptz not null default now()
);
create index on reviews (approved, created_at desc);
```

**Builds:** ✅ Customer site 828.47 kB · Dashboard 1,390.47 kB — zero errors

---

## 2026-04-25 — Phase 2: Crisp Live Chat Embed

**Scope:** Portal-only Crisp widget with user identification + dashboard sidebar/messaging page updates. 5 files changed (1 new, 4 modified).
**Blast Radius:** LOW — contained to portal component, config, dashboard page/sidebar.

### Customer Site (3 files)
- `src/config.ts` — Added `CRISP_WEBSITE_ID` export from `VITE_CRISP_WEBSITE_ID`
- `src/components/portal/CrispWidget.tsx` — NEW. Dynamic script injection, user identification (email/name/phone + session data: booking_code, vehicle, status, dates), cleanup on unmount, `openCrispChat()` exported helper
- `src/components/portal/CustomerPortal.tsx` — Imports CrispWidget; mounts it only when `view === 'dashboard'`; "Message Annie" gold button (falls back to `tel:` if Crisp unavailable)

### Dashboard (2 files)
- `dashboard/src/pages/MessagingPage.jsx` — Header renamed "SMS Conversations"; "Open Crisp Dashboard" external link added
- `dashboard/src/components/layout/Sidebar.jsx` — `ExternalNavItem` component added; "Crisp Chat" link in System section (owner/admin only) → opens `https://app.crisp.chat` in new tab

### Config
- `.env` — `VITE_CRISP_WEBSITE_ID=fa6bac7f-c9a8-46af-8f35-c158a7ff4ef7` (customer site only)
- Vercel env var required: add `VITE_CRISP_WEBSITE_ID` to customer site project (Production + Preview)

**Builds:** ✅ Customer site 826.05 kB · Dashboard 1,385.56 kB — zero errors

---

## 2026-04-24 — Phase 1: Weekly Pricing Engine + Monthly Lead-Gen

**Scope:** Full backend pricing refactor + customer site rate toggle/upsell + dashboard weekly pricing editor + monthly inquiries admin. 21 files changed (7 new, 14 modified).
**Blast Radius:** HIGH — pricing logic, customer booking form, email notifications, fleet display.

### Backend Changes (8 files)
- `backend/services/pricingService.js` — Full rewrite: `computeRentalPricing()` with weekly block math, `line_items` JSONB, `mileage_allowance`, `rate_type`, savings display fields
- `backend/services/bookingService.js` — Updated to call `computeRentalPricing()`, explicit DB column assignment (no spread of display-only fields)
- `backend/routes/bookings.js` — Late-return recalc uses `computeRentalPricing()`
- `backend/routes/vehicles.js` — Catalog: computes `weeklyRate` from formula, adds `vehicleId`, `weeklyDiscountPercent`, `weeklyUnlimitedMileage`, `monthlyDisplayPrice`; includes `id` in select
- `backend/routes/agreements.js` — Auto-fill expanded with `weeklyRate`, `rateType`, `mileageAllowance`, `lineItems`
- `backend/services/notifyService.js` — `mileage_policy` merge field derived from `mileage_allowance`
- `backend/services/fallbackTemplates.js` — `{{mileage_policy}}` in 4 locations
- `backend/routes/monthlyInquiries.js` (NEW) — POST (rate-limited 3/hr), GET (admin list), PATCH (status/notes); registered in both `server.js` and `api/index.js`
- `backend/tests/pricingService.test.js` (NEW) — 8 passing tests

### Customer Site Changes (9 files)
- `src/types/index.ts` — `RateMode` type; Vehicle: `vehicleId`, `weeklyDiscountPercent`, `weeklyUnlimitedMileage`, `monthlyDisplayPrice`
- `src/utils/pricing.ts` (NEW) — `calcRentalDays`, `calcWeeklyRate`, `calcPriceBreakdown` — mirrors backend logic
- `src/components/home/RateToggle.tsx` (NEW) — Framer Motion sliding gold pill (Daily/Weekly/Monthly)
- `src/components/home/VehicleCard.tsx` — `rateMode` prop: 3 display modes, savings badge, unlimited mileage pill, monthly hidden if no price
- `src/components/home/MonthlyInquiryModal.tsx` (NEW) — Phone-first bottom-sheet inquiry form
- `src/components/home/FleetGrid.tsx` — `rateMode` prop, monthly click opens modal, monthly-empty state
- `src/components/home/Hero.tsx` — `RateToggle` between subtitle and CTA
- `src/App.tsx` — `rateMode` state lifted; passes to Hero + FleetGrid
- `src/components/vehicle/WeeklyUpsell.tsx` (NEW) — 5-6 day gold nudge / 7+ day green success
- `src/components/vehicle/RequestToBookForm.tsx` — WeeklyUpsell wired, miles checkbox hidden for weekly, `calcPriceBreakdown` for price estimate

### Dashboard Changes (5 files)
- `dashboard/src/api/client.js` — Added `getMonthlyInquiries`, `updateMonthlyInquiry`
- `dashboard/src/components/vehicles/WeeklyPricingSection.jsx` (NEW) — Discount slider, live calculator, unlimited mileage toggle, monthly display price
- `dashboard/src/pages/VehicleDetailPage.jsx` — WeeklyPricingSection below details; editForm includes weekly/monthly fields
- `dashboard/src/pages/MonthlyInquiriesPage.jsx` (NEW) — Admin list with status workflow, inline notes, filter
- `dashboard/src/components/layout/Sidebar.jsx` — Monthly Leads nav link
- `dashboard/src/App.jsx` — `/monthly-inquiries` route

### Build
- Customer site: ✅ zero errors
- Dashboard: ✅ zero errors

---

## 2026-04-24 — Unified Booking Wizard (Agreement + Insurance + Payment)

**Scope:** Replaced 3-page `/confirm` flow with single unified wizard. 14 files touched (9 new, 5 modified).
**Blast Radius:** HIGH — entire customer-facing booking completion flow.

### Backend Changes (3 files)
- `backend/services/pricingService.js` — Added `INSURANCE_TIERS` constants, `calcInsuranceCost()`, `insuranceCost` param to `calcPricing()`
- `backend/services/stripeService.js` — `createPaymentIntent()` now accepts `insurance_selection` + `expected_total_cents`; adds `insurance_cents/source/tier` to PI metadata; server-side amount validation
- `backend/routes/bookings.js` — Insurance PATCH now handles `source: 'own'|'annies'|bonzah` (backward compatible)
- `backend/routes/stripe.js` — Passes through `insurance_selection` and `expected_total_cents`

### Frontend — New Files (9)
- `wizard-steps/RentalSummaryStep.tsx` — Step 1.1 (read-only rental review)
- `wizard-steps/AddressStep.tsx` — Step 1.2 (address + DOB)
- `wizard-steps/LicenseStep.tsx` — Step 1.3 (license #, state, expiry)
- `wizard-steps/TermsStep.tsx` — Step 1.4 (collapsible T&C + acceptance)
- `wizard-steps/AcknowledgementsStep.tsx` — Step 1.5 (5 checkboxes)
- `wizard-steps/SignatureStep.tsx` — Step 1.6 (draw/type + ESIGN disclosure)
- `wizard-steps/InsuranceStep.tsx` — Step 2.1 (own vs Annie's gate + 3 tier cards)
- `wizard-steps/OrderSummary.tsx` — Itemized receipt (rental + insurance + deposit)
- `wizard-steps/SubmitLoader.tsx` — Full-screen staged progress overlay

### Frontend — Modified Files (5)
- `confirm-booking/constants.ts` — STAGES, INSURANCE_TIERS, WizardDraft type, sessionStorage helpers
- `confirm-booking/ProgressStepper.tsx` — 3-stage stepper with sub-step bar
- `confirm-booking/ConfirmedScreen.tsx` — Added "What Happens Next" section
- `ConfirmBooking.tsx` — Complete rewrite as wizard orchestrator (deferred PI creation, orchestrated submit)
- `BookingSummaryCard.tsx` / `StripeCheckoutForm.tsx` — Superseded (not deleted, no longer imported)

### Key Architecture Decisions
- **Deferred PaymentIntent:** Uses Stripe Elements `mode:'payment'` — card renders immediately, PI created at submit time with correct insurance amount
- **Orchestrated Submit:** Agreement POST → Insurance PATCH → elements.submit() → createPaymentIntent → confirmPayment
- **sessionStorage persistence:** Keyed by booking code, debounced 500ms writes
- **Server-side validation:** `expected_total_cents` must match within 1 cent or PI creation is rejected
- **Insurance tiers:** $12/day Basic, $18/day Standard, $25/day Premium — non-taxable flat fees

### Dependencies
- `signature_pad` (existing) — used by SignatureStep
- `@stripe/stripe-js` + `@stripe/react-stripe-js` (existing) — Elements with deferred intent
- `motion/react` (existing) — animations
- `lucide-react` (existing) — icons

---

## SESSION LOG FORMAT

```
## [DATE] — [Session summary in one line]

### Changes Made
- **[File]**: [What changed and why]

### API/Data Impact
- [Any API call, response shape, or Supabase table affected]

### Files That Need Verification
- [List every file that imports what you changed]

### Build Status
- [ ] `npm run build` — zero errors

### Committed
- [ ] Yes / commit hash: [hash]
- [ ] Vercel env vars updated (if needed)
- [ ] Supabase migration run (if needed)

### Known Issues / Follow-up
- [Anything deferred, broken, or left incomplete]
```

---

## 2026-04-04 — Safety system + CLAUDE.md required reading block

### Changes Made
- **`PROJECT_MAP.md`** (new): Full file registry, import graph, API → Supabase chain, cache key map, Vercel config, danger zones, widget ID registry
- **`CHANGE_PROTOCOL.md`** (new): Before/during/after protocol for any code change
- **`CHANGELOG_SESSION.md`** (new, this file): Session log system
- **`CLAUDE.md`** (new): Required reading block — every future session reads PROJECT_MAP, CHANGE_PROTOCOL, and CHANGELOG_SESSION before making changes. Hard rules, stack reference, dev commands.

### Confirmed Already Built (from prior session, uncommitted)
All decisions listed below were verified present in source:
- **`@dnd-kit/core` + `@dnd-kit/sortable`** — installed in package.json; desktop drag-to-reorder in `DashboardLayoutSettings.jsx`, mobile uses up/down arrow buttons
- **`FleetCommandGrid`** — `SummaryChips` component renders above the grid: total fleet, available count, earning count, attention count (maintenance+retired). One toggleable widget. Replaces any prior FleetDonut/FleetBarChart.
- **`lib/queryCache.js`** — 30s TTL, in-flight dedup, stale-while-revalidate, per-key invalidation. Cache keys: `overview`, `upcoming`, `vehicles`, `revenue-daily-14`, `revenue-full`, `activity-10`.

### API/Data Impact
- None — documentation + verification only

### Files That Need Verification
- None

### Build Status
- [x] `npm run build` — zero errors (chunk size warning is pre-existing, not new)

### Committed
- [ ] Pending — all prior redesign work still uncommitted on main

### Known Issues / Follow-up
- All previous redesign work (6 phases, 12 widgets, widget engine) is still uncommitted on `main`
- Minor dead code in `FleetCommandGrid.jsx`: variable `filtered` (line ~214) declared but unused — `filteredVehicles` is what renders. Harmless. Fix separately if desired.
- Bundle is 1.2 MB (331 kB gzip) — consider code-splitting widgets with `React.lazy()` when bundle size becomes a concern

---

## 2026-04-04 — Diagnose "Failed to fetch" + env guard + BookingsPage error surfacing

### Root Cause Found
`VITE_API_URL` was not loaded by the running Vite dev server (server started before/without the env var). `BASE` fell back to `'/api/v1'` (relative path), intercepted by the Vite proxy, forwarded to `http://localhost:3001` (local backend not running) → `TypeError: Failed to fetch` on every API call. `BookingsPage` silently swallowed the error, showing "No bookings found" and masking the problem.

**Immediate fix:** restart the dev server so Vite re-reads `.env`.

### Changes Made
- **`dashboard/vite.config.js`**: Added `loadEnv` validation at startup — throws a fatal error with a clear message if `VITE_API_URL` is not set. Next time the dev server starts without the env var, it fails immediately instead of silently breaking every API call.
- **`dashboard/src/pages/BookingsPage.jsx`**: Added `error` state + `setError` in catch block + error banner in render. Previously: `catch (e) { console.error(e); }` swallowed all fetch failures and showed "No bookings found".

### API/Data Impact
- None — no API functions changed

### Files That Need Verification
- `dashboard/vite.config.js` — verify dev server still starts normally when `.env` is present
- `dashboard/src/pages/BookingsPage.jsx` — verify error banner appears when API fails, disappears when it succeeds

### Build Status
- [x] `npm run build` — zero errors (chunk size warning is pre-existing)

### Committed
- [ ] Pending

### Known Issues / Follow-up
- Restart dev server to clear the current "Failed to fetch" state: `cd dashboard && npm run dev`
- Other pages that silently swallow errors (same pattern): audit if needed
- Dead code in `FleetCommandGrid.jsx` line ~215 (`const filtered`) — still deferred

---

<!-- Add new sessions above this line, newest first -->
