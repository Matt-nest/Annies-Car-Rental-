# SESSION CHANGELOG

> One entry per work session. Newest session at top.
> Purpose: prevent regressions by tracking exactly what changed and what depends on it.

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
