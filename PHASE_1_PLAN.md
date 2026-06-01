# PHASE 1 PLAN — Twilio rotation + admin guardrails

> **Status:** Draft awaiting user approval. Do not implement until approved.
> **Companion plan:** [PHASE_2_PLAN.md](PHASE_2_PLAN.md) — notification timeline redesign.

---

## Goals (in order of execution)

1. **Twilio rotation** — kill the leaked auth token, install the new number on production
2. **Quiet hours** — block automated SMS during configured night hours (e.g. 9pm–8am)
3. **Send-test-SMS button** — mirror the existing test-email feature for SMS-channel templates
4. **Opt-out admin view** — a real UI for the `sms_opt_out` flag (currently invisible to admins)
5. **Trusted-customer auto-approve** — flag customers that skip manual approval

**Non-goals:**
- Promo codes, audit log, blackout dates — deferred to later phases
- Touching the cron schedule, the template editor layout, or `notifyService.sendSMS()` mechanics beyond the two minimal checks (quiet hours + already-existing opt-out)

---

## Pre-flight: invariants to NOT break

Code review of `notifyService.js` + `routes/messaging.js` surfaces these existing safeguards. Every Phase 1 change must coexist with them.

| Invariant | Where | What it does | Don't break |
|---|---|---|---|
| **F-7 idempotency** | `notifyService.sendBookingNotification` | Inserts into `notification_log(booking_code, stage, event_date)` before sending; PK conflict (`23505`) means skip | Don't bypass this for the test-send routes — test sends use `sendEmail`/`sendSMS` directly, not `sendBookingNotification` |
| **F-18 one-active-per-stage** | `email_templates` partial unique index | Activating one template auto-deactivates peers (client-side in `handleToggle`) | Don't add a new bulk-update path that ignores this |
| **F-20 phone last-10 match** | inbound webhook + `sendSMS` opt-out lookup | Compares last 10 digits to forgive `+1` prefix variants | Use the same normalization for the opt-out admin view |
| **F-21 SMS opt-out** | `customers.sms_opt_out` + `sendSMS` short-circuit | STOP/UNSUB/CANCEL keywords flip the flag; future SMS skip silently | Re-opt-in flow must clear `sms_opt_out_at` too |
| **Ghost-block invariant** | per memory: `vehicles` blocked_dates + cron | Two layers of protection on availability | Phase 1 doesn't touch availability — no risk |

---

## Step 0 — Twilio rotation (user does this, no code change)

1. Twilio Console → **rotate the leaked auth token** (`de4b4f10...`). Promote a new primary, delete the old.
2. Create a **Standard API Key** (`annies-backend-prod`) — preferable to using the auth token long-term.
3. Vercel (backend project) → Settings → Environment Variables:
   - `TWILIO_ACCOUNT_SID` = (unchanged — see Vercel env)
   - `TWILIO_AUTH_TOKEN` = new token (or remove if migrating to API Key — see step 4)
   - `TWILIO_PHONE_NUMBER` = `+17722071655`  ← **new 772 number**
4. Optional: if using API Key, also set `TWILIO_API_KEY_SID` + `TWILIO_API_KEY_SECRET` (small code change — defer to Phase 1.5)
5. Redeploy backend.
6. Submit A2P 10DLC business registration in Twilio Trust Hub if not already done. Required for US business SMS — un-registered numbers get filtered or rejected by carriers.

**Code-side cleanup we'll bundle into Phase 1.1:** the SettingsPage UI documents `TWILIO_FROM_NUMBER` but the code reads `TWILIO_PHONE_NUMBER`. We'll fix the UI label to match the code. ([SettingsPage.jsx:601](dashboard/src/pages/SettingsPage.jsx#L601))

---

## Step 1 — Quiet hours

**Goal:** Block automated SMS sends between `quiet_hours_start` and `quiet_hours_end` (e.g. 21:00–08:00 ET). Defer until the window ends, OR drop silently — see decision below.

### Schema

New singleton table `business_settings` (one row, id=1). Pattern matches the existing Bonzah settings approach.

```sql
-- migrations/018_business_settings.sql
CREATE TABLE IF NOT EXISTS business_settings (
  id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  quiet_hours_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  quiet_hours_start    TIME    NOT NULL DEFAULT '21:00',
  quiet_hours_end      TIME    NOT NULL DEFAULT '08:00',
  quiet_hours_timezone TEXT    NOT NULL DEFAULT 'America/New_York',
  quiet_hours_policy   TEXT    NOT NULL DEFAULT 'skip' CHECK (quiet_hours_policy IN ('skip','defer')),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO business_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
```

**Why singleton table not env var:** quiet hours change without redeploys; UI editing is the point.
**Why `quiet_hours_policy`:** `skip` = drop the SMS silently (simplest, fine for reminders). `defer` = re-send next morning. **Default = skip.** Defer adds a re-send queue we don't need yet.

### Backend changes

| File | Change | Blast radius |
|---|---|---|
| `backend/services/notifyService.js` | New `isInQuietHours()` helper; called near the top of `sendSMS` (after env check, before opt-out lookup). On match, return `{ skipped: 'quiet_hours' }`. | 1 file, pure addition |
| `backend/routes/settings.js` (NEW) | `GET /settings/business`, `PUT /settings/business` (admin-only). Read/update the singleton row. | 1 new file |
| `backend/api/index.js` | Register the new router. | 1 line |

**Rule:** quiet hours apply only to automated SMS triggered by `sendBookingNotification`, **not** to admin-initiated manual sends via `/conversations/:customerId/send`. Manual sends are a human's choice. Test-sends are explicit and admin-initiated → also exempt.

Implementation: add a `{ source: 'auto' | 'manual' }` parameter to `sendSMS` defaulting to `'auto'`. Only `'auto'` checks quiet hours. `messagingService.sendDirectSMS` passes `'manual'`.

### Frontend changes

| File | Change |
|---|---|
| `dashboard/src/api/client.js` | Add `getBusinessSettings()`, `updateBusinessSettings(body)` |
| `dashboard/src/pages/SettingsPage.jsx` | New section in System tab: "SMS Quiet Hours" — toggle, start/end time pickers, timezone select. Save button. |

**Files touched:** 4 (notifyService, settings.js, api/index.js, api/client.js, SettingsPage). ✅ within blast radius 3–6 (acceptable, listed up front).

### Acceptance

- A test SMS at 22:00 ET with quiet hours enabled returns `{ skipped: 'quiet_hours' }` and does NOT call Twilio.
- A manual reply from the conversations panel at 22:00 ET sends normally.
- Toggling quiet hours off in the UI → next test SMS goes through.
- Build green, no existing tests fail.

---

## Step 2 — Send-test-SMS button

**Goal:** Same UX as the existing email test-send, but for SMS-channel templates. Sends a rendered SMS body to the admin's own phone (or an explicit `to`).

### Backend changes

| File | Change |
|---|---|
| `backend/routes/messaging.js` | New route `POST /email-templates/test-send-sms`. Mirrors the existing `/test-send` route at [line 438](backend/routes/messaging.js#L438) but uses `sendSMS({to, body})` with `source: 'manual'` (bypasses quiet hours). Requires `to` (admin's phone — pulled from `req.user` if present, else explicit body param). |

### Frontend changes

| File | Change |
|---|---|
| `dashboard/src/api/client.js` | Add `testSendSmsTemplate({ sms_body, to? })` |
| `dashboard/src/components/messaging/EmailTemplatesTab.jsx` | Existing "Send Test" button currently only sends email. Change behavior:<br>• If template `channel === 'sms'` → call `testSendSmsTemplate`<br>• If `'both'` → show a small dropdown menu: "Test Email" / "Test SMS"<br>• If `'email'` → existing behavior unchanged |

**Files touched:** 3. ✅ low blast radius.

### Acceptance

- Open an SMS-channel template, click Send Test → SMS arrives at admin's phone with `[TEST]` prefix and interpolated mock merge fields.
- "Both" channel templates show a chooser. Email-only templates unchanged.

---

## Step 3 — Opt-out admin view

**Goal:** Expose `customers.sms_opt_out` so admins can see who opted out and (with care) re-opt-in customers who asked back in.

### Backend changes

| File | Change |
|---|---|
| `backend/routes/customers.js` | New route `GET /customers/sms-opt-outs` — returns customers where `sms_opt_out=true`, ordered by `sms_opt_out_at DESC`. Fields: id, name, email, phone, opted_out_at. |
| Same file | New route `POST /customers/:id/sms-opt-in` — clears `sms_opt_out=false`, `sms_opt_out_at=null`, inserts an audit row (see below). **Requires admin role.** |
| Same file | Optional: `POST /customers/:id/sms-opt-out` for admin-initiated opt-outs (e.g. customer requests via phone call). Defer to Phase 1.5 unless wanted now. |

**Compliance note:** TCPA requires that we keep a record of opt-outs. Re-opt-in must be customer-initiated (or have documented customer consent). The admin UI MUST warn before re-opting-in: "Confirm you have the customer's explicit, recent consent to receive SMS again." Add an audit trail:

```sql
-- migrations/018_business_settings.sql (same file as quiet hours)
CREATE TABLE IF NOT EXISTS sms_opt_out_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  action      TEXT NOT NULL CHECK (action IN ('opt_out','opt_in')),
  source      TEXT NOT NULL CHECK (source IN ('keyword','admin','customer_portal')),
  actor_id    UUID,  -- staff user_id when source='admin'
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON sms_opt_out_log (customer_id, created_at DESC);
```

Also: backfill log entries for current `sms_opt_out=true` customers (source='keyword', note='backfilled').

### Frontend changes

| File | Change |
|---|---|
| `dashboard/src/api/client.js` | Add `getSmsOptOuts()`, `smsOptInCustomer(id, note)` |
| `dashboard/src/pages/MessagingPage.jsx` | New 4th tab: "Opt-Outs" — list of opted-out customers with date, phone, "Re-opt-in" button (gated behind confirmation modal). Tab uses the same EASE/tab-switcher pattern as the other 3. |

**Files touched:** 3. ✅ low blast radius.

### Acceptance

- A customer who replies STOP appears in the Opt-Outs list within seconds.
- Clicking Re-opt-in → confirmation modal → on confirm, customer is cleared, audit row created, customer disappears from list.
- Future automated SMS to that customer succeeds (no longer blocked).
- Build green.

---

## Step 4 — Trusted-customer auto-approve

**Goal:** Customers flagged as trusted skip the `pending_approval` queue and go straight to `approved` on booking submission.

### Schema

```sql
-- migrations/019_trusted_customers.sql
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_trusted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trusted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trusted_by UUID;  -- staff user_id
```

### Backend changes

| File | Change |
|---|---|
| `backend/services/bookingService.js` | In `createBooking()`, after inserting the new booking row: if the associated customer has `is_trusted=true`, immediately call the same code path that admin approval uses to transition the booking to `approved`. This triggers the existing `booking_approved` notification. |
| `backend/routes/customers.js` | New `PATCH /customers/:id/trust` — sets `is_trusted`, `trusted_at`, `trusted_by`. Admin-only. |

**Compliance:** A trusted customer auto-approve still must go through the **insurance + payment + agreement** wizard before the rental can start. We're only short-circuiting **manual admin approval**, not bypassing legal/payment steps. Verify by re-reading the `createBooking → booking_approved → booking_confirmed` path before merging.

### Frontend changes

| File | Change |
|---|---|
| `dashboard/src/api/client.js` | Add `setCustomerTrust(id, trusted, note?)` |
| `dashboard/src/pages/CustomerDetailPage.jsx` | New toggle: "Trusted customer (auto-approve bookings)" — with help text explaining what it does. Shows `trusted_at` and `trusted_by` (staff name) when active. |

**Files touched:** 4. ✅ within blast radius.

### Acceptance

- Toggling Trusted on a test customer → submit a booking as that customer → booking status is `approved` (not `pending_approval`).
- Untoggling → next booking flows normally to `pending_approval`.
- Untrusted customer paths unchanged.
- Build green.

---

## Migration order

1. Apply `migrations/018_business_settings.sql` to Supabase (creates `business_settings` + `sms_opt_out_log`)
2. Apply `migrations/019_trusted_customers.sql` (adds `is_trusted` to `customers`)
3. Backfill `sms_opt_out_log` for existing opt-outs (one-time script)
4. Deploy backend
5. Deploy dashboard

Migrations are idempotent (`IF NOT EXISTS`). Can be re-run safely.

---

## Total file count + sequencing

**14 files touched** (3 schema migrations, 5 backend, 6 frontend). Above the CHANGE_PROTOCOL 3-file blast-radius cap — this plan IS the explicit approval request.

**One PR, three commits:**
1. `feat(notify): quiet hours + send-test-sms + opt-out admin view` (steps 1–3, 8 files)
2. `feat(customers): trusted-customer auto-approve` (step 4, 4 files)
3. `docs: update PROJECT_MAP + CHANGELOG_SESSION + SettingsPage label` (2 files)

Run `cd dashboard && npm run build` after each commit. Zero errors required.

---

## What this plan deliberately leaves out (so we don't sprawl)

- Inbound SMS notification badge in the sidebar — separate UX concern
- Email opt-out (customers.email_opt_out) — Resend doesn't auto-handle STOP, would need our own unsubscribe flow
- Per-stage opt-out (customer opts out of reminders but not receipts) — premature
- Multi-staff role gating beyond `admin` — fine for now
- Bulk import/export of opt-outs — fine to defer

---

## Approval needed before I write any code

1. ✅ / ❌ — Singleton `business_settings` table for quiet hours (vs. env var)
2. ✅ / ❌ — Default quiet hours policy: **skip** (drop SMS) vs. **defer** (queue for morning)
3. ✅ / ❌ — Audit log for opt-out/opt-in actions (recommended; small cost)
4. ✅ / ❌ — Re-opt-in confirmation modal language (I'll draft, you approve)
5. ✅ / ❌ — Trusted customer skips manual approval only, NOT payment/agreement (i.e. partial auto-approve)
6. ✅ / ❌ — 3 commits as outlined, single PR
