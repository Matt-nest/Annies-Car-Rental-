# Bonzah Insurance — Operations Runbook

This runbook covers everything operations needs to know about the Bonzah integration: how to disable it, how to recover from failures, how to rotate credentials, and how to migrate from sandbox to production.

The integration was built across Phases 1–5 of the implementation plan. Source files of interest:

- `backend/utils/bonzah.js` — HTTP client, re-auths every call, audit-logs every request to `bonzah_events`.
- `backend/services/bonzahService.js` — business logic + Bonzah field translation.
- `backend/routes/bonzah.js` — all admin endpoints.
- `backend/jobs/bonzahPolling.js` — every-15-min reconciliation cron.
- `dashboard/src/pages/SettingsPage.jsx` — Integrations tab for runtime config.
- `dashboard/src/pages/BookingDetailPage.jsx` — per-booking insurance panel.

---

## 1. Kill Switch — disable Bonzah immediately

Bonzah ships behind a runtime flag. To turn it off **without a redeploy**:

1. Dashboard → **Settings → Integrations** (owner/admin only).
2. Toggle **"Enable Bonzah"** off.
3. Click **Save Changes**.

Effect:
- Customer wizard hides the Bonzah path entirely on the next page load and falls through to "I have my own insurance."
- `POST /bookings/:code/insurance/quote` returns 503.
- The polling job no-ops on the next tick (`{skipped:true}`).
- **Existing active policies are unaffected** — they remain bound at Bonzah. The kill switch only stops new sales.

If the dashboard is unreachable, run this in Supabase SQL editor:

```sql
UPDATE settings SET value = 'false'::jsonb WHERE key = 'bonzah_enabled';
```

---

## 2. Stuck Policy Reconciliation

Use the `bonzah_events` table as the audit trail of what happened. Every Bonzah API call writes one row.

### Symptom: booking has `insurance_status='bind_failed'`

Customer was charged via Stripe but Bonzah didn't issue a policy. Stripe charge stands; admin must reconcile.

1. Dashboard → **Settings → Integrations** → **Recent Activity** log. Find the most recent `bind` row for the booking. Note the `error_text`.
2. Common causes:
   - Bonzah validation rejected a field (e.g. age <21, missing license, unsupported state). Check `request_json` for what we sent.
   - Bonzah API was timing out (httpStatus 0 or 504). Try again.
3. To retry: open the booking, click **Refresh from Bonzah** then re-trigger the bind. If retry won't work (e.g. validation error), refund the insurance portion to the customer and switch `insurance_provider='own'` from the dropdown.

### Symptom: customer cancelled but Bonzah policy still shows active

The booking cancel path calls `cancelPolicy()` automatically, but if it failed (e.g. Bonzah was down), you'll see a `bonzah_cancel_failed` notification in the dashboard.

1. Open the booking → **Cancel Policy** button. This re-files the cancel endorsement.
2. Wait up to 15 minutes for the polling job to pick up the underwriter's approval and flip `insurance_status` to `cancelled`. If it doesn't, contact brandon@bonzah.com with the policy number and ask for the endorsement status.

### Symptom: policy_no on our row doesn't match Bonzah

Ops manually edited the policy at Bonzah's portal. Click **Refresh from Bonzah** on the booking detail page — this re-pulls the live policy and updates our snapshot.

### Direct Supabase queries for forensics

```sql
-- Last 50 errors
SELECT * FROM bonzah_events
 WHERE error_text IS NOT NULL
 ORDER BY created_at DESC
 LIMIT 50;

-- Everything we've sent for one booking
SELECT event_type, status_code, error_text, created_at, request_json, response_json
  FROM bonzah_events
 WHERE booking_id = 'BOOKING-UUID'
 ORDER BY created_at;

-- Bookings with Bonzah policies that haven't been polled in 24h
SELECT booking_code, bonzah_policy_no, insurance_status, bonzah_last_synced_at
  FROM bookings
 WHERE bonzah_policy_id IS NOT NULL
   AND insurance_status NOT IN ('cancelled','expired','bind_failed')
   AND (bonzah_last_synced_at IS NULL OR bonzah_last_synced_at < now() - interval '24 hours');
```

---

## 3. Rotate Credentials

Bonzah uses email + password (no API tokens). To rotate:

1. Email brandon@bonzah.com to set a new password on `aaron@anniescarrental.com` (or whatever account email is in use).
2. Get the new password.
3. Vercel dashboard → **dashboard** project → **Settings → Environment Variables** → update `BONZAH_PASSWORD` (Production + Preview + Development).
4. Vercel will trigger a redeploy; the next API call will re-auth with the new password.
5. Test: dashboard → **Settings → Integrations** → **Test Connection**. Should return green within ~250ms.

The old password keeps working until Bonzah explicitly revokes it, so the rotation is zero-downtime if you update the env var before the old password expires.

---

## 4. Sandbox → Production Cutover

The integration ships pointed at the sandbox host (`bonzah.sb.insillion.com`). To go live:

1. Email brandon@bonzah.com requesting:
   - Production base URL.
   - Production account credentials (separate from sandbox).
   - Confirmation of which states Annie's is licensed to sell in (today: 47 states excluding MI/NY/PA — the state list returned by sandbox).
   - Confirmation of the production webhook endpoints (currently none — Bonzah doesn't issue webhooks; we poll).

2. **Before flipping**, in a maintenance window:
   - Cancel any test policies in sandbox (they don't auto-port to production).
   - In Supabase SQL editor: zero out lingering Bonzah quote columns on test bookings:
     ```sql
     UPDATE bookings
        SET bonzah_quote_id = NULL,
            bonzah_quote_expires_at = NULL,
            bonzah_premium_cents = NULL,
            bonzah_markup_cents = NULL
      WHERE bonzah_policy_id IS NULL;
     ```

3. Update Vercel env vars (Production environment only — keep Preview on sandbox for staging tests):
   - `BONZAH_API_BASE_URL` → production URL
   - `BONZAH_EMAIL` → production email
   - `BONZAH_PASSWORD` → production password

4. Click **Test Connection** in **Settings → Integrations**. Verify ≥40 states returned and 200ms-ish round-trip.

5. Verify the markup is correct (default 10%). Adjust in **Settings → Integrations** if commercial agreement changed.

6. Confirm `bonzah_excluded_states` is current. Review tier definitions one more time — any tier that includes `pai` is hidden in `bonzah_pai_excluded_states`, double check the list with Bonzah.

7. Take one **real** test booking through the wizard (use a real card; refund afterward). Verify:
   - Quote returns sensible price.
   - Stripe charge succeeds.
   - `bindBonzahAfterPayment` logs an `active` `insurance_status` on the booking.
   - `insurance_policy_issued` email arrives.
   - The booking detail page shows the policy_no and lets you download the CDW PDF.
   - Cancel the booking → confirm a `cancel` row appears in `bonzah_events` and `insurance_status` flips to `cancelled` within 15 min.

8. Refund the customer. You're live.

---

## 5. Manual Bind (post-failure)

If `bind_failed` won't auto-recover and you want to issue the policy by hand:

There is no admin "manual bind" button (intentional — too easy to misuse). Instead:

1. Reproduce the call against sandbox first to confirm what should have worked: use Postman with the collection at `/tmp/bonzah-reference/api/postman/Bonzah APIs v3.6.postman_collection.json`.
2. If you confirm the bind would have succeeded with corrected data, the cleanest path is:
   - Refund the customer the full insurance portion via Stripe.
   - Set `insurance_provider='own'` in the booking detail dropdown.
   - Email the customer asking them to provide their personal auto policy details on the rental agreement.

If bind genuinely should have succeeded and you want to retry without a refund:

1. Call `POST /bookings/:code/insurance/quote` again with the same `tier_id` (this re-fetches a fresh quote).
2. Manually run a one-off Node script that imports `bindPolicy()` from `bonzahService.js` and calls it with the booking ID. Update the row's `bonzah_policy_no` + `insurance_status='active'` on success. (Out of scope for the runbook; ask in #engineering.)

---

## 6. Endorsements (Date Changes)

Bonzah supports postponing the start date and changing the end date — but **NOT advancing the start date**. If a customer wants to pick up earlier:

- Cancel the existing policy (admin: **Cancel Policy** button on the booking detail page).
- File a new booking with the earlier start date OR have the customer use their own insurance for the earlier portion.

For end-date changes (extension/reduction), the integration has helper functions (`extendPolicy()` + `payEndorsement()`) in `bonzahService.js` but **no UI yet**. To handle one manually:

1. Confirm with the customer the new end date and time.
2. Run a Node one-off importing `extendPolicy()` from `bonzahService.js`.
3. If `premium_value > 0` (customer owes more): create a Stripe PaymentIntent for the delta plus markup, then call `payEndorsement()` to settle with Bonzah.
4. If `premium_value < 0` (customer is owed a refund): refund-to-credit happens automatically at Bonzah; no customer-facing refund (we keep the markup).
5. The polling job will pick up the endorsement settlement within 15 minutes and update `insurance_status` accordingly.

---

## 7. Common Errors and What They Mean

| Error text | Likely cause | Fix |
|---|---|---|
| `Missing BONZAH_EMAIL or BONZAH_PASSWORD env vars` | Env vars not set on the right Vercel project | Set them, redeploy. |
| `Bonzah auth failed: Invalid credentials` | Password wrong or expired | Rotate per §3. |
| `Bonzah quote failed: Driver age <21` | Customer is under 21 | Wizard should have hidden Bonzah; check `dob` is being collected correctly. Customer needs own insurance. |
| `Bonzah quote failed: SLI requires RCLI` | Tier definition is invalid | Settings → Integrations → tier editor catches this on save. Check for manual SQL edit. |
| `phone must normalize to 11 digits` | Customer phone is non-US or malformed | Customer support: collect a corrected phone before retrying bind. |
| `Bonzah finalize incomplete: policy_id=… payment_id=null` | Bonzah's quote step succeeded but didn't return a payment_id (rare) | Email brandon@bonzah.com with the quote_id and timestamp; Bonzah will issue the payment manually. |
| `No fresh Bonzah quote for this tier` (409, code STALE_QUOTE) | Customer dawdled past 24h before checkout | Wizard auto-re-quotes — if you see this in logs, customer probably reloaded the page in the middle of payment. Re-trigger the wizard. |

---

## 8. Quick Reference

| Thing | Where |
|---|---|
| Kill switch | Dashboard → Settings → Integrations → Enable Bonzah toggle |
| Markup % | Same place |
| State exclusions | Same place (Excluded States + PAI-Excluded States) |
| Per-coverage PDFs | Booking detail → Insurance section → Policy documents row |
| Refresh policy | Booking detail → Insurance section → Refresh from Bonzah button |
| Cancel a single policy | Booking detail → Insurance section → Cancel Policy button |
| Activity log | Dashboard → Settings → Integrations → Recent Activity |
| Migration source | `backend/db/migrations/009_bonzah_integration.sql` |
| Polling cron schedule | `backend/vercel.json` → `*/15 * * * *` |
| Polling cron path | `GET /api/v1/cron/bonzah-poll` (requires `Authorization: Bearer $CRON_SECRET`) |
| Bonzah support contact | brandon@bonzah.com · (515) 444-5669 |
| Bonzah API reference (offline copy) | `/tmp/bonzah-reference/` (clone of https://github.com/insillion/bonzah.git) |
