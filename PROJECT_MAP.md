# PROJECT MAP — Annie's Car Rental Dashboard

> **Ground truth for dependency tracing.** Update this file whenever you add, move, or delete a file.
> Last generated: 2026-04-09

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 5 + Tailwind 3 + Framer Motion 12 + Recharts 2 |
| Auth | Supabase Auth (JWT, managed by `AuthProvider.jsx`) |
| API | REST — `VITE_API_URL` → backend Express server on Vercel |
| Backend | Node.js Express (`backend/server.js`) deployed as Vercel serverless |
| Database | Supabase (Postgres) — frontend never queries DB directly |
| Deploy | Vercel (dashboard project `prj_9mMO7xEw4oyPwAp0Pu69OTaROdhw`) |
| Repo | GitHub → push to `main` → Vercel auto-deploys |

**Working directory for all frontend work:** `dashboard/`

---

## Documentation Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Required reading block for every AI session. Hard rules, stack overview, dev commands. |
| `PROJECT_MAP.md` | This file. Full dependency map — update when adding/moving/deleting files. |
| `CHANGE_PROTOCOL.md` | 15-step before/during/after checklist for every code change. |
| `CHANGELOG_SESSION.md` | Per-session change log. Add an entry every session. |

---

## File Registry

### Entry & Routing

| File | Description | Imports | Imported By |
|------|-------------|---------|-------------|
| `dashboard/src/main.jsx` | React entry point, mounts `<App />` | `App.jsx`, `styles/globals.css` | — |
| `dashboard/src/App.jsx` | Router tree, wraps everything in `<AuthProvider>` | `AuthProvider`, `ProtectedRoute`, `LoginPage`, `DashboardLayout`, all 11 pages | `main.jsx` |

### Auth System (**NEVER TOUCH**)

| File | Description | Imports | Imported By |
|------|-------------|---------|-------------|
| `auth/supabaseClient.js` | Creates Supabase client from `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` | `@supabase/supabase-js` | `AuthProvider.jsx`, `api/client.js` |
| `auth/AuthProvider.jsx` | Auth context — user state, signIn, signOut, loading flag | `supabaseClient.js` | `App.jsx`, `ProtectedRoute`, `LoginPage`, `DashboardLayout`, `Sidebar` |
| `auth/ProtectedRoute.jsx` | Redirects to `/login` when unauthenticated | `AuthProvider.jsx` | `App.jsx` |
| `auth/LoginPage.jsx` | Login form, calls `signIn()` from AuthProvider | `AuthProvider.jsx`, lucide-react | `App.jsx` |

### API Layer (**NEVER TOUCH**)

| File | Description | Imports | Imported By |
|------|-------------|---------|-------------|
| `api/client.js` | All 38 API functions. Injects Supabase Bearer token on every request. BASE = `VITE_API_URL` | `supabaseClient.js` | **19 files** — all pages + 8 widgets (see detail below) |

**Files that import `api/client.js`:**
`DashboardLayout.jsx`, `DashboardPage.jsx`, `BookingsPage.jsx`, `BookingDetailPage.jsx`, `FleetPage.jsx`, `VehicleDetailPage.jsx`, `CustomersPage.jsx`, `CustomerDetailPage.jsx`, `CalendarPage.jsx`, `PaymentsPage.jsx`, `RevenuePage.jsx`, `WebhookFailuresPage.jsx`, `KPICardsWidget.jsx`, `MorningBriefingWidget.jsx`, `OverdueAlertsWidget.jsx`, `PendingApprovalsWidget.jsx`, `RevenueTrendWidget.jsx`, `FleetCommandGrid.jsx`, `ActivityFeedWidget.jsx`, `VehicleRevenueWidget.jsx`, `RevenueHeatmapWidget.jsx`, `DamageSummaryWidget.jsx`, `TodayScheduleWidget.jsx`, `WeekScheduleWidget.jsx`, `AgreementSection.jsx`

### Layout

| File | Description | Imports | Imported By |
|------|-------------|---------|-------------|
| `components/layout/DashboardLayout.jsx` | App shell: sidebar + topbar + `<Outlet />`. Provides `ThemeContext`. Calls `api.getOverview()` for alert badge counts. | `Sidebar`, `AuthProvider`, `api/client.js`, framer-motion, lucide-react | `App.jsx` |
| `components/layout/Sidebar.jsx` | Nav links (all 9 routes) + signOut. Reads `alerts` prop from DashboardLayout. | `AuthProvider`, lucide-react, react-router-dom | `DashboardLayout.jsx` |

### Widget Engine

| File | Description | Imports | Imported By |
|------|-------------|---------|-------------|
| `lib/widgetConfig.js` | `WIDGET_REGISTRY`, `DEFAULT_LAYOUT`, `WIDGET_META` — single source of truth for widget IDs and metadata | — | `useWidgetLayout.js`, `DashboardLayoutEngine.jsx`, `DashboardLayoutSettings.jsx` |
| `lib/queryCache.js` | 30s TTL in-memory cache. Keys: `overview`, `upcoming`, `vehicles`, `revenue-daily-14`, `revenue-full`, `activity-10` | — | `DashboardPage.jsx` + 7 widgets |
| `hooks/useWidgetLayout.js` | localStorage persistence for widget order/visibility. Key: `annie_dashboard_layout_v1` | `widgetConfig.js` | `DashboardLayoutEngine.jsx`, `DashboardLayoutSettings.jsx` |
| `components/dashboard/DashboardLayoutEngine.jsx` | Renders only visible widgets in stored order | `useWidgetLayout.js`, all 12 widget components | `DashboardPage.jsx` |
| `components/dashboard/WidgetWrapper.jsx` | Collapsible card shell with skeleton + error + retry states | framer-motion, lucide-react | 8 widgets (see below) |
| `components/settings/DashboardLayoutSettings.jsx` | Drag-to-reorder (dnd-kit) + toggle switches for widget visibility | `widgetConfig.js`, `useWidgetLayout.js`, `@dnd-kit/*` | `SettingsPage.jsx` |

**Widgets that use `WidgetWrapper.jsx`:**
`RevenueTrendWidget`, `FleetCommandGrid`, `TodayScheduleWidget`, `WeekScheduleWidget`, `VehicleRevenueWidget`, `ActivityFeedWidget`, `DamageSummaryWidget`, `RevenueHeatmapWidget`, `PendingApprovalsWidget`

### Dashboard Widgets

| File | API calls | Cache key | Imported By |
|------|-----------|-----------|-------------|
| `widgets/MorningBriefingWidget.jsx` | `api.getOverview()`, `api.getUpcoming()` | `overview`, `upcoming` | `DashboardLayoutEngine` |
| `widgets/KPICardsWidget.jsx` | `api.getOverview()`, `api.getRevenue({period:'daily', days:14})` | `overview`, `revenue-daily-14` | `DashboardLayoutEngine` |
| `widgets/OverdueAlertsWidget.jsx` | `api.getBookings({status:'active', limit:100})` | none (no cache) | `DashboardLayoutEngine` |
| `widgets/PendingApprovalsWidget.jsx` | `api.getBookings({status:'pending_approval'})`, `api.approveBooking()`, `api.declineBooking()` — invalidates `overview` cache on approve/decline | none | `DashboardLayoutEngine` |
| `widgets/FleetCommandGrid.jsx` | `api.getVehicles()` | `vehicles` | `DashboardLayoutEngine` |
| `widgets/RevenueTrendWidget.jsx` | `api.getRevenue({period:'daily', days:14})` | `revenue-daily-14` | `DashboardLayoutEngine` |
| `widgets/TodayScheduleWidget.jsx` | `api.getOverview()` | `overview` | `DashboardLayoutEngine` |
| `widgets/WeekScheduleWidget.jsx` | `api.getUpcoming()` | `upcoming` | `DashboardLayoutEngine` |
| `widgets/VehicleRevenueWidget.jsx` | `api.getRevenue()` | `revenue-full` | `DashboardLayoutEngine` |
| `widgets/ActivityFeedWidget.jsx` | `api.getActivity(10)` | `activity-10` | `DashboardLayoutEngine` |
| `widgets/DamageSummaryWidget.jsx` | `api.getDamageReports()` | none | `DashboardLayoutEngine`, `FleetPage` |
| `widgets/RevenueHeatmapWidget.jsx` | `api.getRevenue({period:'daily', days:365})` | none | `DashboardLayoutEngine`, `RevenuePage` |

### Pages

| File | API calls (mutations starred) | Shared components | State |
|------|-------------------------------|-------------------|-------|
| `pages/DashboardPage.jsx` | `api.getOverview()` via cache | `DashboardLayoutEngine` | pending count |
| `pages/BookingsPage.jsx` | `api.getBookings()`, `api.approveBooking()*`, `api.declineBooking()*` | `StatusBadge`, `DataTable`, `Modal` | bookings[], loading, modal state |
| `pages/BookingDetailPage.jsx` | `api.getBooking()`, `api.approveBooking()*`, `api.declineBooking()*`, `api.cancelBooking()*`, `api.recordPickup()*`, `api.recordReturn()*`, `api.completeBooking()*`, `api.recordPayment()*`, `api.fileDamageReport()*`, `api.updateInsuranceStatus()*`, `api.updateBooking()*` | `StatusBadge`, `Skeleton`, `AgreementSection`, `BookingModals`, `BookingTimeline`, `Section`, `Field`, `Modal` | booking, loading, modal state, forms |
| `pages/FleetPage.jsx` | `api.getVehicles()`, `api.createVehicle()*`, `api.uploadVehicleImage()*`, `api.updateVehicleStatus()*` | `StatusBadge`, `Skeleton`, `EmptyState`, `Modal`, `DamageSummaryWidget` | vehicles[], loading, filters, modal forms |
| `pages/VehicleDetailPage.jsx` | `api.getVehicle()`, `api.getBlockedDates()`, `api.updateVehicle()*`, `api.updateVehicleStatus()*`, `api.addBlockedDates()*`, `api.deleteBlockedDate()*` | `StatusBadge`, `Skeleton`, `Modal`, `Section`, `Field` | vehicle, blocked dates, editing state |
| `pages/CustomersPage.jsx` | `api.getCustomers()` | `Skeleton`, `EmptyState` | customers[], loading, search query |
| `pages/CustomerDetailPage.jsx` | `api.getCustomer()`, `api.getCustomerBookings()`, `api.updateCustomer()*` | `StatusBadge`, `Skeleton` | customer, bookings[], notes |
| `pages/CalendarPage.jsx` | `api.getVehicles()`, `api.getBookings()`, `api.getBlockedDates()` (per vehicle) | `Skeleton`, `EmptyState` | vehicles[], bookings[], blocked[], month |
| `pages/PaymentsPage.jsx` | `api.getAllPayments()`, `api.issueRefund()*` | `Skeleton`, `EmptyState`, `Modal` | payments[], refund modal state |
| `pages/RevenuePage.jsx` | `api.getRevenue()` | `Skeleton`, `EmptyState`, `RevenueHeatmapWidget` | revenue data |
| `pages/SettingsPage.jsx` | none | `DashboardLayoutSettings` | env var display only |
| `pages/WebhookFailuresPage.jsx` | `api.getWebhookFailures(100)` | `Skeleton` | failures[] |

### Shared Components (High Blast Radius)

| File | Description | Used By |
|------|-------------|---------|
| `shared/StatusBadge.jsx` | Status pill for bookings + vehicles. Reads `document.documentElement.classList` for dark mode | `BookingsPage`, `BookingDetailPage`, `FleetPage`, `VehicleDetailPage`, `CustomerDetailPage`, `ActivityFeedWidget` (6 consumers) |
| `shared/Modal.jsx` | Animated dialog with backdrop. Locks body scroll. | `BookingsPage`, `BookingDetailPage`, `FleetPage`, `VehicleDetailPage`, `PaymentsPage`, `PendingApprovalsWidget`, `AgreementSection` (7 consumers) |
| `shared/Skeleton.jsx` | All skeleton variants: `SkeletonLine`, `SkeletonCard`, `SkeletonKpi`, `SkeletonTable`, `SkeletonChartCard`, `SkeletonFleetGrid`, `SkeletonDashboard` | 9 pages + `DataTable` (10 consumers) |
| `shared/DataTable.jsx` | Generic sortable table with loading + empty states | `BookingsPage` (1 consumer) |
| `shared/EmptyState.jsx` | Centered icon + message component | `FleetPage`, `CustomersPage`, `CalendarPage`, `PaymentsPage`, `VehicleDetailPage`, `RevenuePage`, `DataTable` + widgets (10+ consumers) |
| `shared/AgreementSection.jsx` | Signature pad + agreement display. Calls `api.getAgreementDetail()`, `api.counterSignAgreement()`, `api.downloadAgreementPdf()` | `BookingDetailPage` |
| `shared/BookingModals.jsx` | All booking action modal UIs (approve/decline/cancel/pickup/return/payment/damage) | `BookingDetailPage` |
| `shared/BookingTimeline.jsx` | Renders `booking_status_log` array | `BookingDetailPage` |
| `shared/Section.jsx` | Card section wrapper with title | `BookingDetailPage`, `VehicleDetailPage` |
| `shared/Field.jsx` | Label + value display pair | `BookingDetailPage`, `VehicleDetailPage` |
| `shared/LoadingSpinner.jsx` | Simple spinner | (minimal use) |

### Hooks & Utilities

| File | Description | Used By |
|------|-------------|---------|
| `hooks/useCountUp.js` | Animates number from 0 → target. Respects `prefers-reduced-motion`. | `KPICardsWidget` |
| `hooks/useWidgetLayout.js` | Widget layout state + localStorage persistence | `DashboardLayoutEngine`, `DashboardLayoutSettings` |
| `lib/cn.js` | `clsx` + `tailwind-merge` utility | (minimal use) |
| `lib/queryCache.js` | 30s TTL cache + in-flight dedup | `DashboardPage`, 7 widgets |
| `lib/widgetConfig.js` | Widget registry + default layout config | `useWidgetLayout`, `DashboardLayoutEngine`, `DashboardLayoutSettings` |

### Styles

| File | Description | Affects |
|------|-------------|---------|
| `styles/globals.css` | **All CSS custom properties** (`--bg-primary`, `--accent-color`, `--sidebar-bg`, etc.), design tokens, base styles, `.btn`, `.card`, `.input`, `.status-pill`, `.skeleton`, etc. | **Every component** — all components use `var(--*)` tokens |
| `tailwind.config.js` | Tailwind config, custom font stack (Outfit + JetBrains Mono), custom animations | Every component using Tailwind classes |

---

## API → Backend Chain

All data flow: `Component → api/client.js → VITE_API_URL/api/v1/... → backend Express server → Supabase`

**The frontend NEVER queries Supabase directly for data.** Supabase is used only for auth (login/session/tokens).

### API Functions by Domain

```
VEHICLES (→ vehicles table)
  api.getVehicles()                          GET  /vehicles
  api.getVehicle(id)                         GET  /vehicles/:id
  api.createVehicle(body)                    POST /vehicles
  api.updateVehicle(id, body)                PUT  /vehicles/:id
  api.updateVehicleStatus(id, status)        PATCH /vehicles/:id/status
  api.getVehicleAvailability(id, start, end) GET  /vehicles/:id/availability
  api.getBlockedDates(vehicleId)             GET  /vehicles/:id/blocked-dates
  api.addBlockedDates(vehicleId, body)       POST /vehicles/:id/blocked-dates
  api.deleteBlockedDate(id)                  DELETE /blocked-dates/:id
  api.uploadVehicleImage(file)               POST /uploads/vehicle-image

BOOKINGS (→ bookings table)
  api.getBookings(params)                    GET  /bookings
  api.getBooking(id)                         GET  /bookings/:id
  api.updateBooking(id, body)                PUT  /bookings/:id
  api.updateInsuranceStatus(id, status, pid) PUT  /bookings/:id
  api.approveBooking(id)                     POST /bookings/:id/approve
  api.declineBooking(id, reason)             POST /bookings/:id/decline
  api.cancelBooking(id, reason, by)          POST /bookings/:id/cancel
  api.recordPickup(id, body)                 POST /bookings/:id/pickup
  api.recordReturn(id, body)                 POST /bookings/:id/return
  api.completeBooking(id)                    POST /bookings/:id/complete
  api.getBookingTimeline(id)                 GET  /bookings/:id/timeline

CUSTOMERS (→ customers table)
  api.getCustomers(params)                   GET  /customers
  api.getCustomer(id)                        GET  /customers/:id
  api.updateCustomer(id, body)               PUT  /customers/:id
  api.getCustomerBookings(id)                GET  /customers/:id/bookings

PAYMENTS (→ payments table)
  api.getAllPayments(params)                  GET  /payments
  api.getPayments(bookingId)                 GET  /bookings/:id/payments
  api.recordPayment(bookingId, body)         POST /bookings/:id/payments
  api.issueRefund(paymentId, body)           POST /payments/:id/refund

DAMAGE (→ damage_reports table)
  api.fileDamageReport(bookingId, body)      POST /bookings/:id/damage
  api.getDamageReports(params)               GET  /damage-reports

STATS (→ views/RPCs)
  api.getOverview()                          GET  /stats/overview
  api.getRevenue(params)                     GET  /stats/revenue
  api.getVehicleStats()                      GET  /stats/vehicles
  api.getUpcoming()                          GET  /stats/upcoming
  api.getActivity(limit)                     GET  /stats/activity
  api.getWebhookFailures(limit)              GET  /stats/webhook-failures

AGREEMENTS (→ rental_agreements table)
  api.getAgreementDetail(bookingId)          GET  /agreements/:id/detail
  api.counterSignAgreement(bookingId, sig)   POST /agreements/:id/counter-sign
  api.downloadAgreementPdf(bookingId)        GET  /agreements/:id/pdf
```

### Cache Key Map

| Cache Key | Fetcher | 30s TTL Consumers |
|-----------|---------|-------------------|
| `overview` | `api.getOverview()` | `DashboardPage`, `KPICardsWidget`, `MorningBriefingWidget`, `TodayScheduleWidget` |
| `upcoming` | `api.getUpcoming()` | `MorningBriefingWidget`, `WeekScheduleWidget` |
| `vehicles` | `api.getVehicles()` | `FleetCommandGrid` |
| `revenue-daily-14` | `api.getRevenue({period:'daily', days:14})` | `KPICardsWidget`, `RevenueTrendWidget` |
| `revenue-full` | `api.getRevenue()` | `VehicleRevenueWidget` |
| `activity-10` | `api.getActivity(10)` | `ActivityFeedWidget` |

**Cache invalidation:** `PendingApprovalsWidget` calls `invalidateCache('overview')` after approve/decline so the badge count refreshes.

### Supabase Tables Referenced by Backend

| Table | Used For |
|-------|---------|
| `vehicles` | Fleet management |
| `bookings` | All booking state machine |
| `customers` | Customer profiles |
| `payments` | Payment ledger |
| `damage_reports` | Damage filing |
| `blocked_dates` | Vehicle unavailability windows |
| `rental_agreements` | Agreement + signatures |
| `booking_status_log` | Timeline + activity feed |
| `webhook_failures` | GHL webhook error log |
| `vehicle_deposits` | Per-vehicle deposit amounts ($150/$200/$250) |
| `booking_deposits` | Deposit tracking per booking with settlement status |
| `booking_addons` | Add-on purchases (unlimited miles/tolls/delivery) |
| `incidentals` | Post-return charges (cleaning, damage, smoking, etc.) |
| `invoices` | Generated invoices with line items |
| `customer_disputes` | Dispute workflow for incidentals |
| `toll_charges` | Per-vehicle toll tracking |
| `checkin_records` | Odometer/fuel/condition at each lifecycle stage |
| `email_templates` | Automated email/SMS template content + merge fields |
| `business_settings` | Singleton — admin-tunable config (quiet hours, future business hours/tax/fees). Migration 018. |
| `sms_opt_out_log` | Append-only audit trail for SMS opt-out/opt-in actions (TCPA defense). Migration 018. |
| Views/RPCs | `stats/overview`, `stats/revenue`, `stats/upcoming`, `stats/vehicles`, `stats/activity` |

### Supabase Storage

| Bucket | Visibility | MIME Types | Max Size | Purpose |
|--------|-----------|------------|----------|---------|
| `rental-photos` | Public | jpeg, png, webp, heic | 10MB | Inspection + check-in photos |

---

## Rental Operations Infrastructure (added 2026-04-09)

### Backend Services

| File | Description | Used By |
|------|-------------|---------|
| `backend/services/depositService.js` | Stripe deposit charge, refund, settlement | deposit routes |
| `backend/services/inspectionService.js` | Post-return inspection with auto mileage/late fee calcs | inspection routes, checkin routes |
| `backend/services/invoiceService.js` | Invoice generation with line items | invoice routes |
| `backend/services/portalAuthService.js` | JWT auth for customer portal (booking code + email) | portal routes |
| `backend/services/emailService.js` | Branded email sending via Resend (shared shell with logo) | booking flow, all notifications |
| `backend/services/notifyService.js` | Template engine + notification dispatch (Resend + Twilio) | triggered by admin actions |

### Backend Routes (all registered in `api/index.js`)

| Route File | Prefix | Endpoints |
|------------|--------|-----------|
| `routes/deposits.js` | `/deposits` | GET /:id, POST /charge, POST /refund, POST /settle |
| `routes/addons.js` | `/addons` | GET /booking/:id, POST /booking/:id |
| `routes/checkin.js` | `/checkin` | GET /booking/:id, POST /booking/:id |
| `routes/incidentals.js` | `/incidentals` | GET /booking/:id, POST /booking/:id, DELETE /:id |
| `routes/invoices.js` | `/invoices` | GET /booking/:id, POST /generate |
| `routes/tolls.js` | `/tolls` | GET /vehicle/:id, GET /booking/:id, POST / |
| `routes/disputes.js` | `/disputes` | GET /booking/:id, POST /:id/resolve |
| `routes/portal.js` | `/portal` | POST /verify, GET /booking, GET /lockbox, POST /checkin, POST /checkout, POST /dispute |

### Dashboard Tabs (BookingDetailPage sub-components)

| File | Tab Label | Description | API Calls |
|------|-----------|-------------|-----------|
| `components/booking-tabs/CheckInPrepTab.jsx` | Check-In Prep | Vehicle prep form, lockbox display, "Mark Ready" button | `api.getCheckinRecords()`, `api.createCheckinRecord()`, `api.transitionBooking()` |
| `components/booking-tabs/InspectionTab.jsx` | Inspection | Post-return inspection, incidentals CRUD, settlement math | `api.getIncidentals()`, `api.addIncidental()`, `api.deleteIncidental()`, `api.settleDeposit()` |
| `components/booking-tabs/InvoiceTab.jsx` | Invoice | Deposit management, invoice generation, line items | `api.getBookingDeposit()`, `api.getInvoice()`, `api.generateInvoice()` |
| `components/booking-tabs/TollsTab.jsx` | Tolls | Per-booking toll charges, vehicle-wide toll history | `api.getBookingTolls()`, `api.getVehicleTolls()`, `api.addToll()` |

### Customer Portal (frontend)

| File | Route | Description |
|------|-------|-------------|
| `src/components/portal/CustomerPortal.tsx` | `/portal?code=XXXX` | Self-service portal: login, status dashboard, lockbox code, check-in/out forms, deposit/invoice view, dispute submission |

### Booking Status Flow

```
pending_approval → approved → confirmed → ready_for_pickup → active → returned → completed
                 → declined                                                     → cancelled
```

### Email Templates (in `email_templates` table)

| Stage | Channel | Trigger |
|-------|---------|---------|
| `booking_submitted` | Email + SMS | Customer submits booking |
| `booking_approved` | Email + SMS | Admin approves |
| `booking_declined` | Email + SMS | Admin declines |
| `payment_confirmed` | Email | Stripe payment succeeds |
| `pickup_reminder` | Email + SMS | 24h before pickup (cron) |
| `day_of_pickup` | SMS | Morning of pickup (cron) |
| `ready_for_pickup` | Email + SMS | Admin marks vehicle ready |
| `mid_rental_checkin` | SMS | Day 3 of 5+ day rentals (cron) |
| `return_reminder` | Email + SMS | 24h before return (cron) |
| `day_of_return` | SMS | Morning of return (cron) |
| `inspection_complete` | Email | Admin completes inspection |
| `invoice_sent` | Email | Invoice generated |
| `deposit_refunded` | Email + SMS | Full deposit returned |
| `deposit_settled` | Email | Deposit applied to incidentals |
| `return_confirmed` | SMS | Admin confirms clean return |
| `rental_completed` | Email + SMS | 2h after return confirmed |
| `late_return_warning` | SMS | 1h overdue (cron) |
| `late_return_escalation` | Email + SMS | 4h overdue (cron) |
| `booking_cancelled` | Email + SMS | Booking cancelled |

### Notification Merge Fields

```
{{first_name}}, {{last_name}}, {{email}}, {{phone}},
{{booking_code}}, {{vehicle}}, {{pickup_date}}, {{pickup_time}},
{{return_date}}, {{return_time}}, {{rental_days}}, {{total_cost}},
{{lockbox_code}}, {{status_link}}, {{review_link}},
{{deposit_amount}}, {{deposit_status}}, {{incidental_total}},
{{total_miles}}, {{overage_miles}}, {{mileage_charge}},
{{invoice_total}}, {{invoice_status}}, {{refund_amount}}
```

---

## Phase 2 Notification Timeline (added 2026-05-12)

Horizontal lifecycle view of every notification stage with drag-to-reorder, full editor + live email/SMS preview, and editable timing offsets (cron stages only). Cron behavior unchanged in production until `FEATURE_TIMELINE_TIMING=true` is set.

### Schema additions
- Migration: `020_template_timing.sql`
- New `email_templates` columns: `lifecycle_position` (0-7), `visual_order`, `trigger_kind` ('event'|'cron'), `trigger_anchor`, `trigger_offset_minutes` (-10080 to 43200 CHECK), `trigger_status_filter` (TEXT[])

### Backend
| File | Description |
|------|-------------|
| `backend/services/notifyService.js` | Exported `wrapInBrandedHTML` (was private). Single source of truth for the branded shell — preview endpoint now renders through the same code path as real sends. |
| `backend/routes/messaging.js` | New `POST /email-templates/preview-html` (returns text/html). Extended `PUT /email-templates/:id` to accept `visual_order` + `trigger_offset_minutes` (bounded). |
| `backend/routes/cron.js` | DB-driven anchor/offset/filter behind `FEATURE_TIMELINE_TIMING` env flag (default off). `STAGE_DEFAULTS` mirrors every hardcoded value byte-for-byte. Fail-open fallback if DB row invalid. `late_return_warning` intentionally NOT externalized (ongoing-daily semantics). |

### Frontend
| File | Description |
|------|-------------|
| `dashboard/src/api/client.js` | Added `previewEmailTemplate({subject, body, stage})` — text/html fetch (mirrors `downloadAgreementPdf`'s blob pattern). |
| `dashboard/src/components/messaging/TimelineView.jsx` (NEW) | Horizontal 8-column timeline by `lifecycle_position`. Per-column dnd-kit drag-to-reorder persists `visual_order`. Click card → opens TimelineEditorPanel. |
| `dashboard/src/components/messaging/TimelineEditorPanel.jsx` (NEW) | Slide-in editor (640px). Active toggle, channel pill switcher, subject/body/sms_body, timing offset input + 13 preset chips, EmailPreview iframe, SmsPreview bubble, test-send buttons. Critical-stage deactivation guard via `window.confirm`. |
| `dashboard/src/pages/MessagingPage.jsx` | Added 5th tab "Timeline" (GitBranch icon). Old Templates + Sequences tabs preserved for transitional safety; cleanup commit deletes them once production-verified. |

### New API routes
```
POST   /api/v1/messaging/email-templates/preview-html  Server-rendered email preview HTML
PUT    /api/v1/messaging/email-templates/:id           Now accepts visual_order + trigger_offset_minutes
```

### Env vars
- `FEATURE_TIMELINE_TIMING` — `'true'` enables DB-driven cron timing. Default false. Migration 020 backfills DB values that match hardcoded defaults so flipping the flag on is a no-op for behavior; admin edits then take effect from that moment.

### Component imports
```
TimelineView      → TimelineEditorPanel (inline EmailPreview + SmsPreview)
TimelineView      → @dnd-kit/core, @dnd-kit/sortable, @dnd-kit/utilities  (same versions as DashboardLayoutSettings)
TimelineEditorPanel → api.updateEmailTemplate, api.previewEmailTemplate, api.testSendEmailTemplate, api.testSendSmsTemplate
EmailPreview      → POST /messaging/email-templates/preview-html  (sandboxed iframe)
SmsPreview        → client-side {{merge}} regex with mock fixture matching backend
```

### Invariants preserved
F-7 (notification_log idempotency unchanged), F-18 (one-active-template-per-stage), F-21 (sendSMS opt-out + quiet hours short-circuit), ghost-block (transitionBooking + late_return_warning .lt() clause untouched), F-3 (booking_submitted email contract).

### Known transitional state
Legacy `EmailTemplatesTab.jsx` + `SequencesTab.jsx` are still in the repo and reachable via their tabs. Cleanup commit deletes them after production verification of Timeline. Custom templates created via the legacy Templates tab won't have `lifecycle_position` set — they won't appear on the Timeline (intentional; legacy escape hatch).

---

## Phase 1 Admin Guardrails (added 2026-05-12)

SMS quiet hours, send-test-SMS, opt-out admin view, trusted-customer auto-approve. Extends existing notification path without replacing it.

### Schema additions
- Migrations: `018_business_settings.sql`, `019_trusted_customers.sql`
- New tables: `business_settings` (singleton), `sms_opt_out_log` (audit)
- New `customers` columns: `is_trusted`, `trusted_at`, `trusted_by`, `trusted_note`

### Backend
| File | Description |
|------|-------------|
| `backend/services/notifyService.js` | Added `isInQuietHours()` helper. `sendSMS({to, body, source})` — `source='auto'` (default) skips during quiet hours, `source='manual'` bypasses. Fail-open on settings lookup failures. |
| `backend/services/messagingService.js` | `sendDirectSMS` passes `source: 'manual'`. |
| `backend/routes/settings.js` (NEW) | `GET /settings/business` (auth), `PUT /settings/business` (owner/admin). Whitelisted fields. |
| `backend/routes/messaging.js` | New: `POST /email-templates/test-send-sms`. Mirrors test-send-email. |
| `backend/routes/customers.js` | New: `GET /customers/sms-opt-outs`, `POST /customers/:id/sms-opt-in` (owner/admin, writes `sms_opt_out_log`), `PATCH /customers/:id/trust` (owner/admin). |
| `backend/services/bookingService.js` | `createBooking` auto-transitions to `approved` via `transitionBooking` when `customer.is_trusted=true`. Reuses canonical path — F-7 idempotency, status_log, and `booking_approved` notification all fire normally. |
| `backend/api/index.js` | Registered `/api/v1/settings`. |

### Frontend
| File | Description |
|------|-------------|
| `dashboard/src/api/client.js` | Added: `getBusinessSettings`, `updateBusinessSettings`, `testSendSmsTemplate`, `getSmsOptOuts`, `smsOptInCustomer`, `setCustomerTrust`. |
| `dashboard/src/pages/SettingsPage.jsx` | New `QuietHoursSection` in System tab. Fixed pre-existing env label `TWILIO_FROM_NUMBER` → `TWILIO_PHONE_NUMBER`. |
| `dashboard/src/components/messaging/EmailTemplatesTab.jsx` | Channel-aware test-send buttons (email + SMS icons rendered based on template `channel`). New `handleTestSendSms` handler. |
| `dashboard/src/components/messaging/OptOutsTab.jsx` (NEW) | Lists opted-out customers. Re-opt-in modal requires consent note + explicit checkbox confirmation. TCPA warning. |
| `dashboard/src/pages/MessagingPage.jsx` | Added 4th tab "Opt-Outs" wired to OptOutsTab. |
| `dashboard/src/pages/CustomerDetailPage.jsx` | New `CustomerTrustToggle` section. Toggle ON captures optional note. Shows `trusted_at` + note when active. |

### New API routes
```
GET    /api/v1/settings/business                      authed read
PUT    /api/v1/settings/business                      owner/admin only
POST   /api/v1/messaging/email-templates/test-send-sms test SMS with mock data
GET    /api/v1/customers/sms-opt-outs                  list opted-out customers
POST   /api/v1/customers/:id/sms-opt-in                clear flag + audit (owner/admin)
PATCH  /api/v1/customers/:id/trust                     set is_trusted (owner/admin)
```

### Invariants preserved
F-3 (booking_submitted email contract), F-7 (notification_log idempotency), F-18 (one-active-template-per-stage partial unique index), F-20 (phone last-10 match), F-21 (sms_opt_out enforcement in sendSMS), ghost-block invariant (transitionBooking remains canonical).

---

## Bouncie Telematics Integration (added 2026-05-11)

OAuth 2.0 integration with Bouncie (OBD-II dongle telematics) for live GPS, trip history, vehicle health, geo-fences.

### Backend

| File | Description | Used By |
|------|-------------|---------|
| `backend/services/bouncieService.js` | OAuth flow + token refresh + REST wrapper + `syncVehicles()` VIN-matcher. Quirk: `Authorization` header is the raw token (no `Bearer` prefix). | bouncie + bouncieWebhooks routes, portal route (indirectly via cached odometer reads) |
| `backend/routes/bouncie.js` | Admin REST under `/api/v1/admin/bouncie/*` — gated by `requireAuth + requireRole('owner','admin')` | api/index.js, server.js |
| `backend/routes/bouncieWebhooks.js` | Public — OAuth callback + 11 webhook event types at `/api/v1/bouncie/{oauth/callback, webhook}` | api/index.js, server.js |

### Frontend

| File | Description | API Calls |
|------|-------------|-----------|
| `dashboard/src/api/bouncie.js` | Admin client — mirrors backend admin endpoints | All `/admin/bouncie/*` |
| `dashboard/src/pages/TelematicsPage.jsx` | Single-file page with 6 internal tabs: Overview / Vehicles / Trips / Alerts / Geo-Zones / Settings. Uses `react-map-gl` + Mapbox GL. | All bouncieApi methods + `api.getVehicles()` for the manual-map dropdown |

### New Supabase Tables

| Table | Purpose |
|-------|---------|
| `bouncie_credentials` | OAuth tokens (singleton — partial unique index enforces one active row) |
| `bouncie_vehicles` | Mirror of Bouncie's vehicle list + last-known live stats; FK `annie_vehicle_id` to `vehicles(id)` |
| `bouncie_trips` | Trip history. FK to `vehicles(id)` and `bookings(id)` |
| `bouncie_events` | Audit log of every webhook receipt + every REST call (used for debugging and Alerts feed) |
| `bouncie_geozones` | Admin-managed Application Geo-Zones (synced to Bouncie via 3-step location→schedule→geozone) |

### New `bookings` columns
`bouncie_pickup_odometer`, `bouncie_pickup_at`, `bouncie_return_odometer`, `bouncie_return_at` — populated by `routes/portal.js` at customer check-in/out from `bouncie_vehicles.last_odometer_miles`.

### Routes

```
ADMIN (JWT required)
  GET    /admin/bouncie/status              connection status
  GET    /admin/bouncie/oauth/start         returns Bouncie authorize URL with signed state
  POST   /admin/bouncie/disconnect          soft-disconnect (preserves history)
  POST   /admin/bouncie/sync                pull /vehicles from Bouncie + VIN-auto-match
  GET    /admin/bouncie/vehicles            local bouncie_vehicles join annie's fleet
  PATCH  /admin/bouncie/vehicles/:id/mapping  set annie_vehicle_id manually
  GET    /admin/bouncie/trips               local trips
  POST   /admin/bouncie/trips/refresh       pull from Bouncie /trips for a date window
  GET    /admin/bouncie/events              audit feed (Alerts tab)
  GET    /admin/bouncie/geozones            list
  POST   /admin/bouncie/geozones            create (3-step on Bouncie + 1 local row)
  DELETE /admin/bouncie/geozones/:id        delete
  GET    /admin/bouncie/stats               counts for Overview tab

PUBLIC
  GET    /bouncie/oauth/callback            Bouncie redirect target — exchanges code, persists
  POST   /bouncie/webhook                   Bouncie pushes events here; auth via static header
```

### Env Vars (Required for production)

**Backend (Vercel — backend project):**
- `BOUNCIE_CLIENT_ID`, `BOUNCIE_CLIENT_SECRET` — from bouncie.dev developer portal
- `BOUNCIE_REDIRECT_URI` — must match what's registered on bouncie.dev
- `BOUNCIE_WEBHOOK_SECRET` — long random string; must match the `Authorization` header value set in Bouncie's webhook config
- `BOUNCIE_STATE_SECRET` (optional) — overrides `PORTAL_JWT_SECRET` for signing OAuth state

**Dashboard (Vercel — dashboard project):**
- `VITE_MAPBOX_TOKEN` — Mapbox public token (free tier: 50k loads/month)

### Migration to apply: `017_bouncie_integration.sql`

Idempotent. Apply via Supabase SQL editor or `scripts/run_migration_017.js` (not yet authored — paste-and-run is fine).

---

## Supabase Auth Flow

```
1. User loads app → AuthProvider mounts
2. AuthProvider calls supabase.auth.getSession() → sets user state
3. supabase.auth.onAuthStateChange() → updates user on login/logout
4. ProtectedRoute checks user state → redirect to /login if null
5. LoginPage calls signIn(email, password) → supabase.auth.signInWithPassword()
6. On every API call: api/client.js calls supabase.auth.getSession()
   → extracts access_token → adds Authorization: Bearer <token> header
7. Backend validates the JWT against Supabase's public key
```

**Auth environment variables:**
- `VITE_SUPABASE_URL` — Supabase project URL (frontend)
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key (frontend)

---

## Vercel Configuration

### Dashboard (frontend)
- **Project ID:** `prj_9mMO7xEw4oyPwAp0Pu69OTaROdhw`
- **`dashboard/vercel.json`:** SPA rewrite — all routes → `/index.html`
- **Build:** `vite build` → outputs to `dist/`
- **Environment Variables Required:**
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_API_URL` (points to backend Vercel URL, e.g. `https://your-api.vercel.app/api/v1`)

### Backend (Express API)
- **`backend/vercel.json`:** All traffic → `api/index.js` serverless
- **Cron Job:** `GET /api/v1/cron/daily` at `0 13 * * *` (9 AM ET daily)
  - Sends approval reminders (24h pending), auto-declines (48h pending), overdue/pickup/return webhooks to GHL
- **Environment Variables (backend only — never expose to frontend):**
  - `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (service role)
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
  - `GHL_WEBHOOK_*` (8 webhook URLs for GoHighLevel automation)
  - `RESEND_API_KEY`, `EMAIL_FROM`, `SITE_URL`
  - `OWNER_NAME`, `OWNER_EMAIL`, `BUSINESS_PHONE`, `DEFAULT_PICKUP_LOCATION`
  - `PORTAL_JWT_SECRET` (JWT signing for customer portal auth)
  - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` (SMS notifications)
  - `DASHBOARD_URL` (admin dashboard base URL for internal links)

### GitHub → Vercel Auto-Deploy
- Push to `main` → Vercel auto-deploys both projects
- **`main` = production** — no staging branch currently
- Preview deploys exist for PRs (different URL, same env vars unless overridden)

---

## Contexts & Providers

### AuthContext (`auth/AuthProvider.jsx`)
- **Provides:** `{ user, signIn, signOut, loading }`
- **Consumers:** `ProtectedRoute`, `LoginPage`, `DashboardLayout` (user email), `Sidebar` (signOut)
- **Warning:** Wraps entire app. Changing its API shape breaks all 4 consumers.

### ThemeContext (`components/layout/DashboardLayout.jsx`)
- **Provides:** `{ dark, toggle }`
- **Exported as:** `ThemeContext` + `useTheme()`
- **Consumers:** Only `DashboardLayout` itself (toggle button in header)
- Theme applies by toggling `dark`/`light` class on `<html>` element
- Persisted in `localStorage` key `dash-theme`

---

## Shared Component Consumers (3+)

| Component | Consumer Count | Consumer Files |
|-----------|---------------|----------------|
| `api/client.js` | 25 | All pages, all widgets, AgreementSection |
| `Skeleton.jsx` | 10 | 9 pages + DataTable |
| `EmptyState.jsx` | 10+ | 7 pages + widgets |
| `WidgetWrapper.jsx` | 9 | 9 widgets |
| `Modal.jsx` | 7 | 5 pages + 2 widgets |
| `StatusBadge.jsx` | 6 | 5 pages + ActivityFeedWidget |
| `globals.css` | **all** | Every component (via CSS variables) |
| `widgetConfig.js` | 3 | `useWidgetLayout`, `DashboardLayoutEngine`, `DashboardLayoutSettings` |
| `queryCache.js` | 8 | `DashboardPage` + 7 widgets |
| `AuthProvider.jsx` | 4 | `ProtectedRoute`, `LoginPage`, `DashboardLayout`, `Sidebar` |

---

## Danger Zones

Files where a change cascades to 4+ other files. **Check all consumers before editing.**

| File | Risk Level | Blast Radius | What breaks |
|------|-----------|--------------|-------------|
| `api/client.js` | **CRITICAL** | 25 files | Every page + widget that fetches data |
| `styles/globals.css` | **CRITICAL** | All components | Any renamed CSS variable breaks all usages |
| `auth/supabaseClient.js` | **CRITICAL** | Auth + API | Login breaks, all API calls fail (no token) |
| `auth/AuthProvider.jsx` | **HIGH** | 4 direct, cascades everywhere | Auth shape change breaks all consumers |
| `shared/Skeleton.jsx` | **HIGH** | 10 files | Loading states break on 9 pages |
| `shared/EmptyState.jsx` | **HIGH** | 10+ files | Empty states break everywhere |
| `shared/WidgetWrapper.jsx` | **HIGH** | 9 widgets | All collapsible widgets break |
| `shared/Modal.jsx` | **HIGH** | 7 files | All modals (approve/decline/add vehicle/refund/etc.) |
| `shared/StatusBadge.jsx` | **HIGH** | 6 files | Status display breaks across app |
| `lib/widgetConfig.js` | **MEDIUM** | 3 files | Widget IDs must match `DashboardLayoutEngine`'s `WIDGET_COMPONENTS` map exactly |
| `lib/queryCache.js` | **MEDIUM** | 8 files | Cache behavior changes affect all dashboard widgets |
| `hooks/useWidgetLayout.js` | **MEDIUM** | 2 files + localStorage | Widget layout persistence breaks |
| `tailwind.config.js` | **MEDIUM** | All components | Custom class names or font changes affect whole app |

### Supabase Schema Danger Zones

If any of these table columns are renamed or removed, multiple API functions break:

| Column/Table | Used In API Endpoints | Cascades To UI |
|---|---|---|
| `bookings.status` | getBookings, getOverview, all booking mutations | StatusBadge, all pages |
| `bookings.pickup_date`, `return_date` | getBookings, getUpcoming, getOverview | Calendar, TodaySchedule, WeekSchedule |
| `bookings.customers` (join) | getBooking, getBookings, getCustomerBookings | Customer name display everywhere |
| `bookings.vehicles` (join) | getBooking, getBookings | Vehicle display everywhere |
| `bookings.payments` (join) | getBooking | PaymentsSection in BookingDetailPage |
| `vehicles.status` | getVehicles, updateVehicleStatus | FleetCommandGrid, FleetPage status filter |
| `vehicles.thumbnail_url` | getVehicles, createVehicle, updateVehicle | Vehicle image display everywhere |
| `booking_status_log` table | getActivity, getBookingTimeline | ActivityFeedWidget, BookingTimeline |

---

## Widget ID Registry

IDs in `widgetConfig.js` MUST match keys in `DashboardLayoutEngine.jsx`'s `WIDGET_COMPONENTS` map. Mismatch = widget silently disappears.

| ID | Component | Default Visible |
|----|-----------|----------------|
| `overdue-alerts` | `OverdueAlertsWidget` | true |
| `pending-approvals` | `PendingApprovalsWidget` | true |
| `morning-briefing` | `MorningBriefingWidget` | true |
| `kpi-cards` | `KPICardsWidget` | true |
| `fleet-grid` | `FleetCommandGrid` | true |
| `revenue-trend` | `RevenueTrendWidget` | true |
| `today-schedule` | `TodayScheduleWidget` | true |
| `week-schedule` | `WeekScheduleWidget` | true |
| `vehicle-revenue` | `VehicleRevenueWidget` | true |
| `activity-feed` | `ActivityFeedWidget` | true |
| `damage-summary` | `DamageSummaryWidget` | false |
| `revenue-heatmap` | `RevenueHeatmapWidget` | false |

---

## LocalStorage Keys

| Key | Managed By | Purpose |
|-----|-----------|---------|
| `annie_dashboard_layout_v1` | `useWidgetLayout.js` | Widget order + visibility |
| `dash-theme` | `DashboardLayout.jsx` | `'dark'` or `'light'` |
