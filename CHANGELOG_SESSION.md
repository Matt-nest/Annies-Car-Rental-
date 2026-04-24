# SESSION CHANGELOG

> One entry per work session. Newest session at top.
> Purpose: prevent regressions by tracking exactly what changed and what depends on it.

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

---

## 2026-04-24 — Unified Booking Wizard: Agreement → Insurance → Payment

### Changes Made
- **`src/components/booking/confirm-booking/constants.ts`**: Reordered STEPS array from [Agreement, Payment, Insurance] to [Agreement, Insurance, Payment]. Sublabels updated.
- **`src/components/booking/confirm-booking/InsuranceStep.tsx`** (new): New Step 2 component with three insurance choice cards (own coverage, Bonzah, later). Validates Bonzah fields, calls `PATCH /bookings/:code/insurance`, shows contextual warnings/confirmations.
- **`src/components/booking/ConfirmBooking.tsx`**: Complete rewrite of wizard orchestrator. Insurance is now Step 2, Payment is now Step 3. Removed all old inline insurance state/handlers (policyNumber, bonzahEmail, touched, errors, handleSubmit, validateField). Payment success now goes directly to ConfirmedScreen. alreadyPaid skips to confirmation instead of old insurance step.
- **`src/components/booking/confirm-booking/StripeCheckoutForm.tsx`**: Pay button now shows `totalChargedWithDeposit` (rental + deposit) instead of just `totalCost`, so customer sees exact charge amount.

### API/Data Impact
- None — all existing backend endpoints unchanged: `POST /agreements/:code/sign`, `POST /stripe/create-payment-intent`, `POST /stripe/confirm-payment`, `PATCH /bookings/:code/insurance`
- Same Stripe PaymentIntent structure (rental + deposit in single charge)
- Auto-confirm logic (agreement + payment → confirmed) unchanged

### Files That Need Verification
- `src/components/booking/ConfirmBooking.tsx` — core wizard (rewritten)
- `src/components/booking/confirm-booking/InsuranceStep.tsx` — new file
- `src/components/booking/confirm-booking/constants.ts` — STEPS reordered
- `src/components/booking/confirm-booking/StripeCheckoutForm.tsx` — pay button total

### Build Status
- [x] `npm run build` — zero errors (798.84 kB / 211.34 kB gzip)

### Committed
- [ ] Pending

### Known Issues / Follow-up
- Browser visual test blocked by environment issue — recommend manual testing with a real approved booking
- Insurance "I'll handle later" option allows proceeding to payment without coverage — business decision to confirm
- Bundle size unchanged from pre-existing levels

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
