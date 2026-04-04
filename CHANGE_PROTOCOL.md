# CHANGE PROTOCOL — Annie's Car Rental Dashboard

> This protocol exists because changes made without tracing dependencies cause regressions.
> Follow every step, every time. It takes 60 seconds and prevents hours of debugging.

---

## BEFORE ANY CODE CHANGE

### Step 1 — State the change in one sentence
Write it out before touching any file. If you can't state it in one sentence, the scope is too large.

**Template:** "I am changing `[file]` to `[do what]` because `[why]`."

### Step 2 — Open PROJECT_MAP.md and trace dependencies
Look up the file you're changing in the File Registry. Find every file in its "Imported By" column.

**Ask:** Does my change affect the interface (props, exports, function signatures) of this file?
- If **yes**: every consumer must be updated. List them.
- If **no**: you're changing internal implementation only. Proceed with caution.

### Step 3 — API function changes
If you're changing a function in `api/client.js`:
- Find the function in the API → Backend Chain section of PROJECT_MAP.md
- Identify which Supabase table/endpoint it hits
- Find every component that calls this function (all are listed in the File Registry)
- Confirm the response shape hasn't changed — if it has, every consumer rendering that data must be updated

**Remember: `api/client.js` is imported by 25 files. It is NEVER safe to change without full dependency trace.**

### Step 4 — Supabase schema changes
If the backend is changing a table column name or adding RLS:
- Check the Supabase Schema Danger Zones table in PROJECT_MAP.md
- Find every API function that references this column
- Find every component that renders the value
- The full chain is: Supabase column → API function → component → UI element

### Step 5 — Blast radius check
Count the number of files that will be affected by your change.

| Blast Radius | Action |
|-------------|--------|
| 1–3 files | Proceed |
| 4–6 files | **STOP. Tell the user the full list before proceeding.** |
| 7+ files | **STOP. This is a structural change. Requires explicit approval.** |

---

## DURING THE CHANGE

### Step 6 — Make the smallest possible change
If you need to add a prop, add only that prop. If you need to fix a bug in one function, fix only that function.

**What NOT to do while making a change:**
- Do not rename variables/functions/files unless renaming IS the task
- Do not "clean up" nearby code — cleanup is a separate commit
- Do not add error handling for scenarios that can't happen
- Do not refactor surrounding code because it "looks messy"
- Do not add TypeScript types, docstrings, or comments to code you didn't change

### Step 7 — Prop changes to shared components
If you change the props of any component in `components/shared/`:
1. List every consumer file (from PROJECT_MAP.md)
2. Update every consumer in the same change
3. Do not leave consumers with stale/missing props

### Step 8 — Environment variables
If your change requires a new environment variable:
- Add it to `dashboard/.env.example` (if frontend) or `backend/.env.example` (if backend)
- Note in your commit message: "Requires new env var: `VAR_NAME` — add to Vercel dashboard"
- Frontend vars MUST start with `VITE_` — otherwise Vite won't expose them

### Step 9 — Widget changes
If adding or renaming a widget:
1. Update `lib/widgetConfig.js` — add/rename the entry in `WIDGET_REGISTRY`
2. Update `components/dashboard/DashboardLayoutEngine.jsx` — add the component to `WIDGET_COMPONENTS`
3. Ensure the `id` string matches exactly between both files
4. Create the widget component in `components/dashboard/widgets/`
5. Update `PROJECT_MAP.md` Widget ID Registry table

### Step 10 — CSS variable changes
If changing a variable in `styles/globals.css`:
- Every component using that variable breaks immediately
- Search for `var(--variable-name)` before renaming anything
- Only rename if you update every usage in the same change

---

## AFTER THE CHANGE

### Step 11 — Build check
```bash
cd dashboard && npm run build
```
**Zero errors required.** Warnings are acceptable but document if new.

### Step 12 — Page verification
Visit every page that imports the file you changed (listed in FILE Registry).
At minimum: load the page, verify no console errors, verify the changed feature works.

### Step 13 — Supabase query verification
If you changed anything that touches API calls:
- Check the network tab: does the request succeed?
- Does the response have the expected shape?
- Does the UI render the data correctly?

### Step 14 — Commit message format
```
<type>(<scope>): <what changed>

<why it changed>
<what it affects>
[Requires env var: VAR_NAME] (if applicable)
[Requires Supabase migration: ...] (if applicable)
```

**Types:** `fix`, `feat`, `refactor`, `style`, `docs`, `chore`

**Example:**
```
fix(PendingApprovalsWidget): invalidate overview cache after decline

Decline action wasn't refreshing the badge count in the header/sidebar.
Affects: DashboardLayout alert count, KPICardsWidget pending number.
```

### Step 15 — Update PROJECT_MAP.md
If you added, moved, or deleted a file — update PROJECT_MAP.md before considering the task done. The map is only useful if it's accurate.

---

## NEVER-TOUCH LIST

These files are foundational. Changes require explicit user approval in every case.

| File | Why |
|------|-----|
| `api/client.js` | 25 consumers. The entire data layer. |
| `auth/supabaseClient.js` | Auth foundation. Break this = no login, no API calls. |
| `auth/AuthProvider.jsx` | Auth state for the whole app. |
| `auth/ProtectedRoute.jsx` | Security boundary. |
| Supabase schema | Migrations are irreversible. |
| GHL webhook routes | SMS/email automation for customers. |
| All 38 API endpoint paths | Backend routes — frontend and backend must stay in sync. |

---

## QUICK REFERENCE — Who Calls What

**Changing something in `getOverview()` response shape:**
→ Check: `DashboardPage`, `KPICardsWidget`, `MorningBriefingWidget`, `TodayScheduleWidget`, `DashboardLayout` (alerts)

**Changing something in `getVehicles()` response shape:**
→ Check: `FleetCommandGrid`, `FleetPage`, `CalendarPage`

**Changing something in `getBookings()` response shape:**
→ Check: `BookingsPage`, `OverdueAlertsWidget`, `PendingApprovalsWidget`, `CalendarPage`

**Changing something in `getRevenue()` response shape:**
→ Check: `RevenuePage`, `RevenueTrendWidget`, `VehicleRevenueWidget`, `KPICardsWidget`, `RevenueHeatmapWidget`

**Changing something in `getUpcoming()` response shape:**
→ Check: `MorningBriefingWidget`, `WeekScheduleWidget`

**Changing `Modal.jsx` props:**
→ Check: `BookingsPage`, `BookingDetailPage`, `FleetPage`, `VehicleDetailPage`, `PaymentsPage`, `PendingApprovalsWidget`, `AgreementSection`

**Changing `StatusBadge.jsx` props:**
→ Check: `BookingsPage`, `BookingDetailPage`, `FleetPage`, `VehicleDetailPage`, `CustomerDetailPage`, `ActivityFeedWidget`

**Changing `WidgetWrapper.jsx` props:**
→ Check: 9 widgets — `RevenueTrendWidget`, `FleetCommandGrid`, `TodayScheduleWidget`, `WeekScheduleWidget`, `VehicleRevenueWidget`, `ActivityFeedWidget`, `DamageSummaryWidget`, `RevenueHeatmapWidget`, `PendingApprovalsWidget`

**Changing any CSS variable in `globals.css`:**
→ Every component that uses it. Search `var(--variable-name)` first.
