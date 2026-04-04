# PROJECT MAP — Annie's Car Rental Dashboard

> **Ground truth for dependency tracing.** Update this file whenever you add, move, or delete a file.
> Last generated: 2026-04-04

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
| Views/RPCs | `stats/overview`, `stats/revenue`, `stats/upcoming`, `stats/vehicles`, `stats/activity` |

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
  - `OWNER_NAME`, `BUSINESS_PHONE`, `DEFAULT_PICKUP_LOCATION`

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
