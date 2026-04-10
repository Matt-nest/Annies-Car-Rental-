# Annie's Car Rental — Full Codebase Audit

> **Date:** April 9, 2026  
> **Scope:** Frontend (Vite/React/TS), Dashboard (Vite/React/JSX), Backend (Express/Vercel)  
> **Method:** Line-by-line read of every source file, grep-based pattern scanning, architectural analysis  
> **Status:** Audit only — NO code changes made

---

## Legend

| Severity | Meaning |
|----------|---------|
| 🔴 **CRITICAL** | Data loss, security breach, or payment error risk. Fix before launch. |
| 🟠 **HIGH** | Functionality broken or degraded. Fix within 48 hours. |
| 🟡 **MEDIUM** | Code quality, maintainability, or minor UX issue. Fix in next sprint. |
| 🟢 **LOW** | Cleanup, best-practice, or cosmetic. Fix when convenient. |

---

## 🔴 CRITICAL Findings

### C-1: Duplicate `refund_amount` Key in Merge Fields
**File:** [notifyService.js](file:///Applications/Annies/backend/services/notifyService.js#L144-L155)  
**Lines:** 147 and 155  

```js
// Line 147 — inside "Payment fields" block
refund_amount: bp.refund_amount || '',
// Line 155 — inside "Deposit fields" block  ← OVERWRITES line 147
refund_amount: bp.refund_amount || '',
```

**Impact:** The second `refund_amount` key silently overwrites the first in the object literal. JavaScript allows this without error. If these were ever intended to be different values (e.g., one for payment refunds, one for deposit refunds), the first would always be lost. Email templates referencing `{{refund_amount}}` may display incorrect values.

**Fix:** Rename one to `deposit_refund_amount` or consolidate into a single key with clear documentation.

---

### C-2: Duplicate Cron Logic — Two Implementations
**Files:** [routes/cron.js](file:///Applications/Annies/backend/routes/cron.js) and [services/cronJobs.js](file:///Applications/Annies/backend/services/cronJobs.js)

The **exact same business logic** exists in two places:
1. `routes/cron.js` — triggered via Vercel Cron HTTP requests (GET /cron/daily)
2. `services/cronJobs.js` — triggered via `node-cron` in-process scheduler

Both send pickup reminders, return reminders, flag overdue returns, and auto-decline bookings. If both are active, customers receive **duplicate notifications**.

**Impact:** Double-notification risk; confusing divergence if one is updated but not the other.

**Fix:** Choose one strategy:
- **Vercel-hosted:** Keep `routes/cron.js`, delete `cronJobs.js`, ensure `startCronJobs()` is **not** called in `server.js`
- **Self-hosted:** Keep `cronJobs.js`, remove the `/cron/daily` route

---

### C-3: No Rate Limiting on Portal Auth Endpoint
**File:** [routes/portal.js](file:///Applications/Annies/backend/routes/portal.js)

The `POST /portal/verify` endpoint (booking code + email login) has **no rate limiting**. An attacker could brute-force booking codes to gain access to customer booking data, lockbox codes, and self-service check-in.

The main booking submission endpoint (`POST /bookings`) correctly has rate limiting (5/min per IP), but the portal does not.

**Fix:** Add `express-rate-limit` to `POST /portal/verify` — recommend 5 attempts per 15 minutes per IP.

---

### C-4: Portal JWT Has No Expiry Validation on Client
**File:** [CustomerPortal.tsx](file:///Applications/Annies/src/components/portal/CustomerPortal.tsx)

The portal JWT is stored in React state but the frontend never checks if it's expired before making requests. If a customer leaves their browser tab open past the token's 24-hour TTL, subsequent API calls will silently fail with 401 errors that are caught generically as "Verification failed."

**Fix:** Decode the JWT on the client and check `exp` before API calls; show a "Session expired — please verify again" message instead of a generic error.

---

### C-5: Stripe Webhook Signature Verification May Fail Silently
**File:** [routes/stripe.js](file:///Applications/Annies/backend/routes/stripe.js#L48-L80)

If `STRIPE_WEBHOOK_SECRET` is not set, the webhook handler falls back to parsing the body without signature verification. This means in development or if the env var is accidentally removed, **any POST to /stripe/webhook with a valid-looking JSON body would be processed as a real payment event**, potentially auto-confirming bookings without actual payment.

**Fix:** If `STRIPE_WEBHOOK_SECRET` is not set, reject the webhook entirely (return 500) rather than falling through without verification.

---

## 🟠 HIGH Findings

### H-1: Settings Page Was Previously Reported Broken
**File:** [SettingsPage.jsx](file:///Applications/Annies/dashboard/src/pages/SettingsPage.jsx)

Current code review shows the settings page **is now functional** with three tabs (Profile, Team, System). However, the `SystemTab` currently shows environment variable names as static text — it doesn't actually fetch or display whether they're configured. This is a UX issue where the admin cannot tell if Twilio/Resend/Stripe are properly set up.

**Recommendation:** Add a backend endpoint (e.g., `GET /settings/health`) that returns which integrations are configured (without exposing actual keys) so the System tab can show green/red status indicators.

---

### H-2: `getAvailableVehicles()` Performs N+1 Queries
**File:** [availabilityService.js](file:///Applications/Annies/backend/services/availabilityService.js#L61-L78)

```js
for (const v of vehicles || []) {
  const { available: isAvail } = await checkAvailability(v.id, startDate, endDate);
  if (isAvail) available.push(v);
}
```

For a 26-vehicle fleet, this makes **at minimum 27 database calls** (1 for vehicles + 26 for availability checks, each of which makes 2 queries = 53 total). This will degrade performance as the fleet grows.

**Fix:** Replace with a single query using Supabase RPC or a joined query that excludes vehicles with conflicting bookings.

---

### H-3: `conversations` Endpoint Fetches All Messages Without Pagination
**File:** [routes/messaging.js](file:///Applications/Annies/backend/routes/messaging.js#L15-L53)

```js
const { data, error } = await supabase
  .from('messages')
  .select('customer_id, created_at, body, direction, channel')
  .order('created_at', { ascending: false });
```

This fetches **every message ever sent** to build the conversation list. As the system grows, this will become a severe performance bottleneck. No `.limit()` clause.

**Fix:** Add `.limit(1000)` as a safety valve, and ideally create a `conversation_summaries` view or materialized approach.

---

### H-4: Inspection Incidentals Inserted Sequentially
**File:** [inspectionService.js](file:///Applications/Annies/backend/services/inspectionService.js#L157-L167)

```js
for (const item of incidentals) {
  await supabase.from('incidentals').insert({...});
}
```

Each incidental is inserted in a separate round-trip. If 5 incidentals are submitted, that's 5 sequential DB calls. Should use batch insert.

**Fix:** Use `supabase.from('incidentals').insert(incidentals.map(...))` for a single batch operation.

---

### H-5: Frontend SPA Routing is Manual — No Browser History Support
**File:** [App.tsx](file:///Applications/Annies/src/App.tsx)

The customer-facing frontend uses manual state-based routing (`useState<Page>`) instead of a router. Browser back/forward buttons don't work. If a customer is on `/confirm` and hits Back, nothing happens — they stay on the same page.

`window.history.pushState` is called in some places (line 111) but there's no `popstate` event listener to handle browser navigation.

**Fix:** Either add a `popstate` listener or migrate to a proper router (React Router or TanStack Router).

---

### H-6: `calcRentalDays` Uses Date Arithmetic That's Timezone-Sensitive  
**File:** [pricingService.js](file:///Applications/Annies/backend/services/pricingService.js#L7-L13)

```js
const pickup = new Date(pickupDate);
const ret = new Date(returnDate);
return Math.max(1, Math.ceil((ret - pickup) / msPerDay) + 1);
```

`new Date("2026-03-14")` is parsed as midnight **UTC**, which on an ET server means the previous day at 8 PM. This can cause off-by-one errors in rental day calculations near midnight, directly affecting pricing.

**Fix:** Append `T12:00:00` to date strings before parsing, or use a timezone-aware library like `date-fns-tz`.

---

## 🟡 MEDIUM Findings

### M-1: No Input Sanitization on Template Interpolation
**File:** [notifyService.js](file:///Applications/Annies/backend/services/notifyService.js#L173-L178)

`interpolateTemplate` replaces `{{key}}` with raw values from booking data. If a customer's name contains HTML (e.g., `<script>alert('xss')</script>`), it gets injected directly into the email HTML body.

The `wrapInBrandedHTML()` function uses `escapeHtml()` for the subject line **but not for the body content**. The `emailService.js` version correctly uses `esc()` for all interpolated values in its templates.

**Risk:** HTML injection in customer-facing emails. Not XSS in the browser (emails generally sandbox scripts), but could break email layout or be used for phishing.

**Fix:** Apply `escapeHtml()` to all merge field values in `buildMergeFields()`.

---

### M-2: `confirm` Booking Page Doesn't Prevent Double Submission
**File:** [ConfirmBooking.tsx](file:///Applications/Annies/src/components/booking/ConfirmBooking.tsx)

The payment confirmation flow should disable the submit button after click and show a loading state. Need to verify the Stripe `confirmPayment()` call has idempotency keys to prevent duplicate charges.

---

### M-3: Dashboard Error Handling Not Standardized  
**Files:** Multiple dashboard pages

Some pages (BookingsPage) now have error banners. Others (FleetPage, CustomersPage, CalendarPage) may still silently swallow fetch errors, showing an empty state that looks like "no data" rather than "failed to load."

**Fix:** Create a reusable `<DataError>` component and apply consistently.

---

### M-4: `handleQuickView` Uses `window.innerWidth` Check
**File:** [App.tsx](file:///Applications/Annies/src/App.tsx#L43-L44)

```js
if (window.innerWidth < 768) {
  handleOpenDetail(vehicle);
}
```

This is a one-time check at click time, not responsive. If a user resizes their window, the behavior doesn't adapt. Should use a media query hook or CSS-only approach.

---

### M-5: `api_key` Accepted Via Query String
**File:** [middleware/apiKey.js](file:///Applications/Annies/backend/middleware/apiKey.js#L5)

```js
const key = req.headers['x-api-key'] || req.query.api_key;
```

Accepting API keys via query parameters means they appear in server access logs, browser history, and potentially proxy logs.

**Fix:** Remove `req.query.api_key` fallback; require header-only.

---

### M-6: Cron Secret Check is Bypassable With User-Agent Spoofing
**File:** [routes/cron.js](file:///Applications/Annies/backend/routes/cron.js#L10-L18)

```js
const isVercelCron = req.headers['user-agent'] === 'vercel-cron/1.0';
```

The User-Agent header is trivially spoofable. Anyone can send a request with `User-Agent: vercel-cron/1.0` to trigger the daily cron job, sending notifications to all customers.

**Fix:** Remove the User-Agent check; require **only** the `CRON_SECRET` Bearer token.

---

### M-7: `EmailService.js` and `NotifyService.js` Duplicate Email-Sending Logic
**Files:** [emailService.js](file:///Applications/Annies/backend/services/emailService.js) and [notifyService.js](file:///Applications/Annies/backend/services/notifyService.js)

Both files contain independent `sendEmail()` functions with identical Resend API integration. Both define their own HTML email templates with the same branded header/footer. This creates maintenance drift risk.

**Fix:** Extract shared email infrastructure into a single module; have both services import from it.

---

### M-8: `booking_submitted` Notification Skip Logic is Fragile
**File:** [notifyService.js](file:///Applications/Annies/backend/services/notifyService.js#L287-L288)

```js
const skipEmail = stage === 'booking_submitted';
```

The `booking_submitted` template email is skipped in `sendBookingNotification()` because `emailService.js` sends a hardcoded branded version. This implicit coupling means if someone removes the `sendBookingConfirmation()` call in `bookingService.js`, no confirmation email gets sent at all.

---

### M-9: No Pagination on Admin Booking List
**File:** [routes/bookings.js](file:///Applications/Annies/backend/routes/bookings.js#L20-L38)

The `GET /bookings` route has no `.limit()` or pagination. As bookings accumulate, this query will return unbounded rows.

---

## 🟢 LOW Findings

### L-1: Console Logs Throughout Backend
**Count:** 18+ source files with `console.log` statements (excluding `node_modules`)

The backend uses `console.log` and `console.error` for all logging. There's no structured logging (no request IDs, no log levels, no JSON format). In Vercel's serverless environment, this makes debugging production issues difficult.

**Recommendation:** Consider a lightweight logger like `pino` with JSON output.

---

### L-2: Unused `card` Function in CustomerPortal
**File:** [CustomerPortal.tsx](file:///Applications/Annies/src/components/portal/CustomerPortal.tsx#L27-L32)

The `card()` function accepts a `theme` parameter but doesn't use it — it only returns CSS custom properties which already adapt to the theme. The `theme` argument is dead.

---

### L-3: `deleteVehicle` Route Exists in API Client but Needs Soft-Delete Verification
**File:** [dashboard/src/api/client.js](file:///Applications/Annies/dashboard/src/api/client.js#L35)

The dashboard exposes `deleteVehicle(id)` → `DELETE /vehicles/:id`. Need to verify the backend actually soft-deletes (sets `status: 'retired'`) rather than hard-deleting rows that may have booking references.

---

### L-4: `confirm()` and `alert()` Used in Dashboard
**File:** [SettingsPage.jsx](file:///Applications/Annies/dashboard/src/pages/SettingsPage.jsx#L306-L316)

Native `confirm()` and `alert()` dialogs are used for deactivating users and showing errors. These block the main thread and look unprofessional.

**Fix:** Replace with a modal component.

---

### L-5: Password Minimum Length is Only 6 Characters
**File:** [SettingsPage.jsx](file:///Applications/Annies/dashboard/src/pages/SettingsPage.jsx#L110)

```js
if (newPw.length < 6) return setPwMsg('Password must be at least 6 characters');
```

NIST recommends minimum 8 characters. The backend should also enforce this independently.

---

### L-6: `greeting()` Wrapped in `useCallback` Without Dependencies
**File:** [DashboardPage.jsx](file:///Applications/Annies/dashboard/src/pages/DashboardPage.jsx#L115-L120)

```js
const greeting = useCallback(() => { ... }, []);
```

`greeting` is a pure function with no dependencies. Wrapping it in `useCallback` with an empty deps array is unnecessary overhead. Could just be a regular function or even a constant.

---

### L-7: `no_show` Status Not Reachable
**File:** [bookingService.js](file:///Applications/Annies/backend/services/bookingService.js#L20)

The `TRANSITIONS` map includes `no_show: []` but no status can transition **to** `no_show`. It's defined but unreachable.

---

### L-8: Tax Rate is Hardcoded / Env-based Without Admin Override
**File:** [pricingService.js](file:///Applications/Annies/backend/services/pricingService.js#L1)

```js
const TAX_RATE = parseFloat(process.env.TAX_RATE || '0.07');
```

Florida's sales tax rate varies by county. If Annie's operates across county lines, a single rate won't be accurate. Currently hardcoded to 7%.

---

### L-9: Several Script Files in Backend Root
**Files:** `check-bucket.js`, `db/seed-vehicles.js`, `db/migrate.js`, `db/patch-photos.js`, `scripts/verify_migration.js`

These operational scripts are mixed in with the production codebase. They contain `console.log` calls and direct DB mutations. Should be in a separate `scripts/` directory and excluded from deployment.

---

## Architecture Assessment

### Strengths ✅
1. **Clean separation** — Frontend never queries Supabase directly for data; all through Express API
2. **State machine** — Bookings use explicit state transitions with logging via `booking_status_log`
3. **Fire-and-forget notifications** — Email/SMS failures never block booking operations
4. **Auth layering** — Admin dashboard uses Supabase JWT; customer portal uses a separate PORTAL_JWT_SECRET
5. **API client centralization** — Dashboard uses a single `api/client.js` module for all requests
6. **Rate limiting** — Public booking endpoint is rate-limited (5/min/IP)
7. **Input validation** — `validators.js` validates booking payloads before processing
8. **No XSS vectors** — No `eval()`, no `dangerouslySetInnerHTML` anywhere
9. **Stripe webhook** — Correctly uses `express.raw()` and signature verification

### Weaknesses ⚠️
1. **No test suite** — Zero unit tests, zero integration tests, zero E2E tests
2. **No CI/CD validation** — No automated checks before deployment
3. **Dual cron systems** — Vercel Cron + node-cron creates duplication risk
4. **No structured logging** — All logging via console.* with no correlation
5. **No database migrations** — Schema changes are manual
6. **No TypeScript on backend** — Type safety ends at the frontend boundary
7. **Manual frontend routing** — SPA routing without proper history integration

---

## Dependency Health

### Backend
- `express` — stable, mature
- `@supabase/supabase-js` — actively maintained
- `stripe` — official SDK, actively maintained
- `node-cron` — low-maintenance, may be unnecessary with Vercel Cron
- `express-rate-limit` — stable
- `helmet` — correctly configured for security headers
- `cors` — configured for dashboard/frontend origins
- `multer` — used for file uploads, stable
- `jsonwebtoken` — used for portal JWT, stable
- `uuid` — used for booking codes, stable

### Dashboard
- `react-router-dom` — v6, current
- `framer-motion` — animation library, stable
- `lucide-react` — icon library, actively maintained
- `date-fns` — date utility, stable
- `recharts` — charting, stable

### Frontend
- `motion/react` — Framer Motion rebrand, current
- `lucide-react` — consistent with dashboard
- `stripe` — `@stripe/stripe-js` for payment elements

> **Note:** `npm audit` could not be run during this audit session (npm not found in PATH). Recommend running `npm audit --production` in both `backend/` and `dashboard/` directories.

---

## Files Audited

| Layer | Files Read | Critical Files |
|-------|-----------|----------------|
| Backend routes | 8 | bookings.js, stripe.js, portal.js, cron.js |
| Backend services | 10 | bookingService.js, stripeService.js, notifyService.js, depositService.js, inspectionService.js |
| Backend middleware | 3 | auth.js, apiKey.js, errorHandler.js |
| Backend utils | 2 | validators.js, generateBookingCode.js |
| Dashboard pages | 12 | DashboardPage, BookingsPage, SettingsPage, etc. |
| Dashboard api/auth | 3 | client.js, AuthProvider.jsx, supabaseClient.js |
| Frontend components | 6 | App.tsx, CustomerPortal.tsx, ConfirmBooking, etc. |
| Config/infra | 5 | server.js, api/index.js, vite.config.js, vercel.json |

**Total files analyzed:** ~49 source files across 3 layers
