# MESSAGING PHASE 1 — HANDOFF

> Self-contained handoff. Drop this entire file into any chat to resume work cold.
> **Last updated:** 2026-05-07
> **Status:** Phase 1 ready to start. F-1 is next.

---

## 1. Project Context (read this first)

**Annie's Car Rental** — three independent apps sharing one Express backend + Supabase Postgres.

| App | Path | Stack | URL |
|---|---|---|---|
| Customer site | `/Applications/Annies/src/` | React 19 + TS + Tailwind v4 + Vite 6 | anniescarrental.com |
| Admin dashboard | `/Applications/Annies/dashboard/` | React 18 + JSX + Tailwind v3 + Vite 5 | admin.dashboard.anniescarrental.com |
| Backend API | `/Applications/Annies/backend/` | Node 18 + Express + Vercel serverless | (internal) |

Auth: Supabase JWT (admin), portal JWT 4h (customer), `x-api-key` (public booking POST), `CRON_SECRET` (Vercel cron).

**Required reading on every session:** `CLAUDE.md`, `PROJECT_MAP.md`, `CHANGE_PROTOCOL.md`, `CHANGELOG_SESSION.md`. Do not modify `api/client.js`, `auth/`, or Supabase schema without explicit approval.

### Current messaging stack (4 systems)

1. **Crisp** — live chat widget on the customer portal only. `src/components/portal/CrispWidget.tsx`. Loaded via `VITE_CRISP_WEBSITE_ID`. Inbox at `app.crisp.chat` (external — admin context-switches).
2. **Resend** — outbound email. All template-driven sends flow through `backend/services/notifyService.js` → `sendBookingNotification(stage, payload)`. 4 hardcoded transactional emails live in `backend/services/emailService.js`. No inbound (replies go to noreply / black hole).
3. **Twilio** — outbound + inbound SMS. Outbound via `notifyService.sendSMS()`. Inbound via `backend/routes/messaging.js` `/messaging/webhook/inbound` (currently broken — see F-1).
4. **In-app inbox** — `dashboard/src/pages/MessagingPage.jsx` (1,383 lines, includes Templates CRUD). Reads Supabase `messages` table. Templates persist to `email_templates` table with merge-field engine in notifyService.

**Templates rendering pipeline:** `sendBookingNotification(stage, payload)` → `getRenderedTemplate` looks up `email_templates` where `is_active=true`, falls back to `backend/services/fallbackTemplates.js` if missing → `interpolateTemplate` resolves `{{key}}` and `{{#if key}}...{{/if}}` blocks → wrapped in branded HTML shell → sent via Resend (email) and/or Twilio (SMS) → mirrored into `messages` table for in-app inbox.

---

## 2. Decisions Made (user, 2026-05-07)

1. **Fix F-1 (inbound SMS) immediately** — yes
2. **Phase 1 ship-list** — all 8 items
3. **Orphan stages** — "your call" (delegated). My calls in §3 task F-4/F-5
4. **Phase 2 path** — Path A (keep Resend/Twilio, absorb Crisp into in-app inbox, build Templates UI)
5. **Templates UI** — stay inside MessagingPage (no nav split)
6. **Execution** — agent does the fixes, starting with F-1, working down the list

---

## 3. Phase 1 Ship-List (8 tasks)

Order is execution order. Each task: severity, files, what's broken, fix, verify, blast radius.

### F-1 — Inbound SMS webhook drops Twilio's form-encoded payloads

**Severity:** CRITICAL
**Files:**
- `backend/routes/messaging.js:112` (the webhook)
- `backend/api/index.js:55` (Vercel handler — currently `express.json()` only)
- `backend/server.js:56` (local dev — same)

**What's broken:** Twilio's default callback content-type is `application/x-www-form-urlencoded`. Express has only `express.json()` mounted, so `req.body` is empty for form-encoded requests, `From`/`Body` resolve to empty strings, the route returns 400, and inbound SMS is silently dropped in production. The route also accepts JSON shape (`from`/`body`/`message`), so manual JSON tests pass and mask the failure.

**Fix:** Add `express.urlencoded({ extended: false, limit: '1mb' })` middleware. Mount globally before route registration in both `api/index.js` and `server.js`. (Or scope to `/messaging/webhook/inbound` only — also fine.)

**Verify:**
```bash
# Should return 200 with stored row
curl -X POST $API_URL/messaging/webhook/inbound \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data 'From=%2B17725551234&Body=test'

# Confirm Twilio Console → Phone Number → Messaging webhook URL points to /messaging/webhook/inbound
# After fix, real customer replies should appear in dashboard /messaging
```

**Blast radius:** Adding `urlencoded` globally is safe — no other route currently reads form-encoded bodies. Stripe webhook uses `express.raw` already and is registered before any global parsers. Verify by checking nothing else in `routes/` reads `req.body` from a form post.

---

### F-2 — Inbound SMS webhook has no Twilio signature verification

**Severity:** HIGH
**Files:** `backend/routes/messaging.js:112`

**What's broken:** Doc-comment claims "Secured via x-webhook-secret header or Twilio signature (basic check)" but no header read, no signature validation. Anyone with the URL can POST `{From, Body}` and inject into a customer's thread. Possible abuse: phishing the admin into responding to fake numbers, planting evidence in conversation history, spam.

**Fix:** Validate `X-Twilio-Signature` against the request URL + sorted form params using HMAC-SHA1 with `TWILIO_AUTH_TOKEN`. Reject mismatches with 403. ~10 lines, no SDK needed:
```js
import crypto from 'crypto';
function verifyTwilioSignature(req) {
  const sig = req.headers['x-twilio-signature'];
  if (!sig) return false;
  const url = `${process.env.SITE_URL_API || 'https://your-api.vercel.app'}${req.originalUrl}`;
  const params = req.body || {};
  const sortedKeys = Object.keys(params).sort();
  const data = url + sortedKeys.map(k => k + params[k]).join('');
  const expected = crypto.createHmac('sha1', process.env.TWILIO_AUTH_TOKEN).update(data).digest('base64');
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
```
Skip if `X-Webhook-Secret` header matches a separate `INBOUND_WEBHOOK_SECRET` env var (admin-side replay tooling escape hatch).

**Verify:**
- Real Twilio inbound SMS still lands (signature validates).
- `curl` without signature → 403.
- The webhook URL Twilio sees must match exactly what we hash (Vercel forwards as HTTPS — verify the URL we construct matches).

**Blast radius:** If signature derivation diverges from Twilio's, real inbound starts 403'ing. Always test against a real Twilio request first; keep the bypass header until verified.

**Env var to add:** `INBOUND_WEBHOOK_SECRET` (optional, for admin replay).

---

### F-7 — Reminder/lifecycle cron is not idempotent

**Severity:** HIGH
**Files:**
- `backend/routes/cron.js:77` (pickup_reminder)
- `backend/routes/cron.js:89` (return_reminder)
- `backend/routes/cron.js:101` (late_return_warning)
- `backend/routes/cron.js:155` (mid_rental_checkin)
- `backend/routes/cron.js:168` (extension_offer)
- `backend/routes/cron.js:180` (rental_completed)
- `backend/routes/cron.js:192` (repeat_customer)
- `backend/routes/cron.js:204` (late_return_escalation)
- `backend/services/notifyService.js:480` (sendBookingNotification — add dedup check at top)

**What's broken:** Date-based reminders have no per-booking-per-stage tracking. Cron retries on 5xx, manual replays, env-var redeploys all double-fire every applicable reminder. Only `payment_confirmed` has dedup (PI metadata `receipt_sent_at`).

**Fix:** New table + check at top of `sendBookingNotification`.

```sql
-- backend/db/migrations/012_notification_log.sql
CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  stage TEXT NOT NULL,
  event_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (booking_id, stage, event_date)
);
CREATE INDEX idx_notification_log_lookup ON notification_log (booking_id, stage, event_date);
```

In `sendBookingNotification` (notifyService.js:480), before the dispatch:
```js
const bookingId = bookingPayload.booking_id || bookingPayload.id;
if (bookingId && !STAGES_THAT_CAN_REPEAT.includes(stage)) {
  const { error } = await supabase
    .from('notification_log')
    .insert({ booking_id: bookingId, stage, event_date: new Date().toISOString().slice(0,10) });
  if (error?.code === '23505') {
    console.log(`[Notify] Already sent ${stage} for ${bookingId} today — skipping`);
    return;
  }
}
```
Where `STAGES_THAT_CAN_REPEAT` = `[]` initially (none repeat). Manual admin re-sends from the compose UI bypass this (they use `sendDirectEmail`, not `sendBookingNotification`).

**Backfill:** Migration must seed from existing `messages` rows where `metadata.automated = true`:
```sql
INSERT INTO notification_log (booking_id, stage, event_date, sent_at)
SELECT (m.metadata->>'booking_code')::text::uuid, m.metadata->>'stage', m.created_at::date, m.created_at
FROM messages m
WHERE m.metadata->>'automated' = 'true' AND m.metadata->>'stage' IS NOT NULL
ON CONFLICT DO NOTHING;
```
(Adjust if `booking_code` ↔ `booking_id` mapping needs a join — check the actual `metadata` shape.)

**Verify:**
- Hit `GET /api/v1/cron/daily` twice in succession with valid bearer.
- Confirm only one of each reminder fires the second time.
- Twilio + Resend logs show no duplicates.

**Blast radius:** If `booking_id` is missing from a payload, dedup skips and the message sends — defensive default. The check applies to all 19 stages; manually-triggered admin sends from `routes/messaging.js` `/conversations/:id/send` use `sendDirectEmail`/`sendDirectSMS` which don't go through `sendBookingNotification`, so they're unaffected.

**Migration to apply manually after code ships:** `backend/db/migrations/012_notification_log.sql` (paste into Supabase SQL Editor).

---

### F-3 — `booking_submitted` email depends on a sibling call no test enforces

**Severity:** HIGH
**Files:**
- `backend/services/notifyService.js:511` (the skip flag)
- `backend/services/bookingService.js:263` (the dependent call)

**What's broken:** `notifyService.js:511` skips email for `stage === 'booking_submitted'` because `emailService.sendBookingConfirmation` is supposed to send it via a sibling call at `bookingService.js:263`. If anyone deletes/refactors that call, customers receive nothing after submitting a booking. No fallback template, no error log.

**Fix (Phase 1 — minimal, surface the contract):**
1. Add a code comment at `notifyService.js:511` and `bookingService.js:263` documenting the dependency.
2. Add an integration test `backend/tests/booking-submitted-email.test.js` that mocks Resend and asserts a request fires when a booking is submitted.

**Defer to Phase 2:** consolidating into a single template-driven path. Don't restructure now.

**Verify:**
- Comments visible in both files.
- Test passes; manually delete `bookingService.js:263` and confirm test fails.

**Blast radius:** Documentation + test. No runtime code change.

---

### F-9 — Template-card preview button is a no-op

**Severity:** LOW (but trivial to fix and a visible papercut)
**Files:**
- `dashboard/src/pages/MessagingPage.jsx:1051` (button)
- `dashboard/src/pages/MessagingPage.jsx:911-942` (preview overlay rendered inside editor branch only)

**What's broken:** Preview button calls `setPreview(t)` but the modal is only rendered in the `editing !== null` branch. On the listing page, `editing === null`, the modal is unmounted, so click does nothing.

**Fix:** Move the preview overlay (lines 912-941) above the `if (editing !== null) { return ... }` early return, or factor into a shared `<PreviewOverlay preview={preview} onClose={() => setPreview(null)} />` component rendered in both branches.

**Verify:**
- Open dashboard → Messaging → Templates tab → click eye icon on a template card → modal appears with rendered preview.
- Click the same icon while in the editor view → also works.

**Blast radius:** Single file. Verify both branches still render preview correctly.

---

### F-21 — No SMS opt-out / STOP keyword handling

**Severity:** MEDIUM (TCPA exposure)
**Files:**
- `backend/services/notifyService.js:96` (sendSMS — add opt-out check at top)
- `backend/routes/messaging.js:112` (inbound webhook — detect STOP keywords)
- New: `customers.sms_opt_out` boolean column

**What's broken:** Twilio honors STOP at carrier level (subsequent messages from your `From` to that customer fail with `error 21610`), but the app stores no consent state. No app-level suppression. TCPA compliance for unsolicited marketing (`repeat_customer`, `extension_offer`) requires explicit consent tracking.

**Fix:**
1. Add column:
```sql
-- backend/db/migrations/013_sms_opt_out.sql
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS sms_opt_out_at TIMESTAMPTZ;
```

2. `sendSMS` short-circuits if customer is opted out. Lookup by phone number normalized:
```js
// At top of sendSMS in notifyService.js:96
// (Need to fetch customer by phone — pass customer_id through if available)
```
Better: add `customerId` param to `sendSMS` and check inside. Update all callers in `notifyService.sendBookingNotification` and `messagingService.sendDirectSMS`.

3. In `/messaging/webhook/inbound` after F-1+F-2 fixes, detect STOP keywords:
```js
const optOutKeywords = /^(STOP|UNSUB|UNSUBSCRIBE|CANCEL|END|QUIT)$/i;
if (optOutKeywords.test(messageBody.trim())) {
  await supabase.from('customers').update({
    sms_opt_out: true,
    sms_opt_out_at: new Date().toISOString()
  }).eq('id', customer.id);
}
```

**Verify:**
- Reply STOP from a test phone → `customers.sms_opt_out` flips to true.
- Trigger a `repeat_customer` cron stage for that customer → no SMS sent, log line confirms skip.
- Operational stages (`late_return_escalation`) — confirm if these should also respect opt-out (legal: yes, per TCPA, STOP applies to all).

**Blast radius:** New column, signature change on `sendSMS` (add `customerId`). All callers must pass it. Operational stages stop firing for opted-out customers — confirm with user this is desired.

**Migration to apply manually:** `backend/db/migrations/013_sms_opt_out.sql`.

---

### F-6 — Bonzah and inspection merge fields render as literal `{{key}}`

**Severity:** HIGH (latent — detonates when F-5 wires the callers)
**Files:**
- `backend/services/notifyService.js:149-235` (buildMergeFields)
- `backend/services/notifyService.js:395-412` (buildBookingPayload — payload has the data)
- `backend/services/depositService.js:284` (sets `amount_owed` on payload)
- `backend/services/fallbackTemplates.js:481-557` (templates reference these fields)

**What's broken:** `buildBookingPayload` populates `bonzah_policy_no`, `bonzah_quote_id`, `bonzah_tier_label`, `bonzah_premium`, `bonzah_total_charged`, `dashboard_link`, `bonzah_coverage_summary`, plus `amount_owed` from depositService. `buildMergeFields` never lifts any of those into the merge map. `interpolateTemplate` falls through to the `match` literal (line 269), so emails contain raw `{{bonzah_policy_no}}` text.

**Fix:** Extend `buildMergeFields` to copy all 8 keys:
```js
// In notifyService.js buildMergeFields, return object — add:
bonzah_policy_no:        bp.bonzah_policy_no || '',
bonzah_quote_id:         bp.bonzah_quote_id || '',
bonzah_tier_label:       bp.bonzah_tier_label || '',
bonzah_premium:          bp.bonzah_premium || '',
bonzah_total_charged:    bp.bonzah_total_charged || '',
bonzah_coverage_summary: bp.bonzah_coverage_summary || '',
dashboard_link:          bp.dashboard_link || '',
amount_owed:             bp.amount_owed || '',
```

**Test (do this regardless of fix):** Add `backend/tests/merge-field-coverage.test.js`:
```js
// Grep every {{key}} from fallbackTemplates.js + DB seeds.
// Build a mock payload via buildBookingPayload with stub data on every known field.
// Call buildMergeFields and assert no key referenced in any template is missing.
```
This prevents future drift — every new template stage will fail the test until `buildMergeFields` is updated.

**Verify:**
- Stub a payload with `{ bonzah_policy_no: 'POL-X', customers: { email: 't@t.t' }, ... }` and call `getRenderedTemplate('insurance_policy_issued', ...)`.
- Inspect `body` — should contain literal `POL-X`, not `{{bonzah_policy_no}}`.

**Blast radius:** Purely additive. Existing keys keep working. No template breaks.

---

### F-4 + F-5 — Orphan stages: wire or delete

**Severity:** MEDIUM (operational gaps + UX trap) + HIGH (Bonzah pair)
**Files (drift sources):**
- `backend/db/seeds/seed_templates.sql` (DB seed — find which stages exist)
- `dashboard/src/pages/MessagingPage.jsx:14-42` (TEMPLATE_STAGES picker)
- `backend/services/notifyService.js` (STAGE_CTA, EVENT_SUMMARIES)
- `backend/services/fallbackTemplates.js` (fallback templates)

**Per-stage decisions (my calls, per user "your call" delegation):**

| Stage | Decision | Wire location | Notes |
|---|---|---|---|
| `damage_notification` | **Wire** | After `api.fileDamageReport()` in `backend/routes/damageReports.js` | Customer should know damage is on file |
| `insurance_policy_issued` | **Wire** | Success branch of `bindBonzahAfterPayment` in `backend/services/stripeService.js:243` | Customer needs policy number |
| `insurance_bind_failed` | **Wire (admin-only)** | Failure branch of `bindBonzahAfterPayment` | **Critical:** route to `OWNER_EMAIL`, not customer.email — current dispatch uses customer.email by default. Add admin-only path or call `sendEmail` directly with rendered template body. |
| `day_of_return` | **Wire** | New cron stage in `backend/routes/cron.js` | Symmetric with `day_of_pickup` which already exists |
| `inspection_complete` | **Wire** | After admin completes inspection in `backend/services/inspectionService.js` | Customer wants closure |
| `invoice_sent` | **Wire** | After `generateInvoice` + email send in `backend/services/invoiceService.js` | Standard invoice notification |
| `delivery_offer` | **Delete** | — | Overlaps with booking_submitted email which already mentions delivery |
| `refund_processed` | **Delete** | — | `deposit_refunded` already covers full-refund case; partial refunds are rare and admin-handled |
| `day_of_pickup` | **Wire** | New cron stage in `backend/routes/cron.js` morning-of pickup | Already in seed + picker, just needs caller |

**Steps for each "Wire" stage:**
1. Confirm `STAGE_CTA` entry in notifyService.js exists; add if missing.
2. Confirm `EVENT_SUMMARIES` entry; add if missing.
3. Confirm fallback template in fallbackTemplates.js exists for any business-critical stage; add for `insurance_bind_failed` (already exists), `damage_notification`, `invoice_sent`, `inspection_complete`, `day_of_pickup`, `day_of_return`.
4. Confirm `buildMergeFields` provides every `{{key}}` referenced (see F-6).
5. Add the call site (`sendBookingNotification('<stage>', payload)`) at the natural trigger point.
6. For `insurance_bind_failed` (admin alert): bypass the customer-email path. Either add an `audience: 'admin'` option to `sendBookingNotification` that routes to `OWNER_EMAIL`, or call `sendEmail` directly with the rendered template body.

**Steps for each "Delete" stage:**
1. Remove from `dashboard/src/pages/MessagingPage.jsx` TEMPLATE_STAGES array (lines 14-42).
2. Remove DB seed entry from `backend/db/seeds/seed_templates.sql` (run a `DELETE FROM email_templates WHERE stage IN ('delivery_offer', 'refund_processed') AND name LIKE 'Default%';` to clean prod).
3. Remove from STAGE_CTA, EVENT_SUMMARIES, FALLBACK_TEMPLATES if present.
4. Update `PROJECT_MAP.md` Email Templates table.

**Verify:**
- For each wired stage: trigger the natural action, confirm Resend/Twilio log shows the dispatch, confirm `messages` row appears in admin inbox.
- For deleted stages: confirm picker dropdown no longer shows them, confirm DB has no active row.

**Blast radius:** Each wired stage is one new call site at a service-level trigger point. Each delete is config-only. The biggest risk is `insurance_bind_failed` going to a customer's inbox — must verify admin-routing before merging.

---

## 4. Phase 2 status

**2A — Foundation refactors:** ✅ shipped 2026-05-07. F-8, F-10, F-14, F-16, F-18, F-19, F-20 all done. See CHANGELOG_SESSION.md "Messaging Phase 2A".

**2B — Templates UX rebuild** (pending): per-stage active toggle UI signal, "send test to me" button, fallback-vs-DB indicator, last-edited timestamp, optional version history. Decision needed: minimal vs full scope.

**2C — Inbound email** (pending): Resend inbound webhook on dedicated subdomain, MIME parsing, customer matching by From:, conversation threading. Decisions needed: subdomain choice, Resend plan state.

**2D — Crisp absorption** (pending): Crisp webhook → `messages` table, render chat threads in MessagingPage, unified inbox. Decisions needed: Crisp account API access, one-way vs two-way.

**2E — MessagingPage decomposition** (pending): split 1,383 lines into ConversationList / Thread / Compose / Templates components on the same route. No decisions blocking.

---

## 5. Hard Rules

From `CLAUDE.md`:
- **NEVER touch** `dashboard/src/api/client.js` (25 consumers), `backend/api/index.js` route registration without tracing, `auth/` directories, or Supabase schema (without the migration pattern below).
- Widget IDs in `widgetConfig.js` MUST match `DashboardLayoutEngine.jsx` `WIDGET_COMPONENTS`.
- CSS variables in `styles/globals.css` — never rename without grep across both frontends.

From `CHANGE_PROTOCOL.md`:
- State the change in one sentence before touching any file.
- Trace dependencies in `PROJECT_MAP.md` for every file changed.
- Blast radius > 3 files: stop and surface the list. > 6 files: explicit approval required.
- Run `cd dashboard && npm run build` before considering a task done. Zero errors required.
- Add an entry to `CHANGELOG_SESSION.md` for every shipped task.

---

## 6. Verification Protocol

For each task:
```bash
# 1. Build check
cd /Applications/Annies/dashboard && npm run build
# (no error required; warnings okay if pre-existing)

# 2. Backend syntax check
cd /Applications/Annies/backend
node --check routes/messaging.js services/notifyService.js api/index.js server.js
# (or whatever files were touched)

# 3. Manual smoke test per task's "Verify" section above.

# 4. Before commit, run:
cd /Applications/Annies && git status
cd /Applications/Annies && git diff
```

**Migration application (Supabase service-role JS client cannot run DDL):**
1. Open Supabase SQL Editor in the dashboard.
2. Paste the migration file contents.
3. Run.
4. Confirm with the verification queries embedded in each migration's comment block.

**Migrations needed in this Phase 1:**
- `backend/db/migrations/012_notification_log.sql` (F-7)
- `backend/db/migrations/013_sms_opt_out.sql` (F-21)

**Env vars to add (Vercel backend):**
- `INBOUND_WEBHOOK_SECRET` (F-2, optional bypass for admin replay tooling)

---

## 7. Status Checklist

Update as tasks ship. Add to CHANGELOG_SESSION.md when each is committed.

### Phase 1 (8/8 shipped)
- [x] **F-1** — `express.urlencoded` middleware → inbound SMS works (shipped 2026-05-07)
- [x] **F-2** — Twilio signature verification on inbound webhook (shipped 2026-05-07)
- [x] **F-7** — `notification_log` table + dedup check + backfill (migration 012) (shipped 2026-05-07 — **migration 012 pending Supabase paste**)
- [x] **F-3** — Comments + static-source contract test on booking_submitted skip-flag dependency (shipped 2026-05-07)
- [x] **F-9** — Move preview overlay above early return in MessagingPage (shipped 2026-05-07)
- [x] **F-21** — `sms_opt_out` column + STOP detector (migration 013) (shipped 2026-05-07 — **migration 013 pending Supabase paste**)
- [x] **F-6** — 8 Bonzah/dashboard/amount_owed merge fields lifted into `buildMergeFields` (shipped 2026-05-07)
- [x] **F-4 / F-5** — 3 stages wired (damage_notification moderate+, day_of_pickup, day_of_return), 3 retired (delivery_offer, refund_processed, inspection_complete), 1 kept manual (invoice_sent), Bonzah pair deferred per prior design decision (shipped 2026-05-07 — **migration 014 pending Supabase paste**)

### Phase 2A — Foundation refactors (7/7 shipped)
- [x] **F-8** — Single branded email shell extracted to utils/emailShell.js (shipped 2026-05-07)
- [x] **F-19** — Interpolator fixed-point loop + 13 unit tests (shipped 2026-05-07)
- [x] **F-14** — storeLocalMessage failure → admin dashboard notification + API stored flag (shipped 2026-05-07)
- [x] **F-18** — Partial unique index for active templates + auto-deactivate-peer in toggle UI (migration 015) (shipped 2026-05-07 — **migration 015 pending Supabase paste**)
- [x] **F-20** — Phone-match strictness (exact last-10-digits) (shipped 2026-05-07)
- [x] **F-10** — `v_conversation_summaries` view + simplified route (migration 016) (shipped 2026-05-07 — **migration 016 pending Supabase paste**)
- [x] **F-16** — Crisp mount-once with visibility prop (shipped 2026-05-07)

### Phase 2B/C/D/E — Shipped 2026-05-07
- [x] **2B** — Templates UX (minimal: test-send + fallback banner + LIVE badge)
- [x] **2C** — Inbound email via Resend (route + Svix sig verify + DNS docs)
- [x] **2D** — Crisp one-way ingestion (webhook + HMAC verify + Chat channel badge)
- [x] **2E** — MessagingPage decomposition (1,406 → 210 lines, 4 components extracted)

---

## 8. References

- **Required reading:** `CLAUDE.md`, `PROJECT_MAP.md`, `CHANGE_PROTOCOL.md`, `CHANGELOG_SESSION.md`
- **Wider context:** `HANDOFF.md`, `CODEBASE_AUDIT.md`
- **Original Phase 1 audit report:** generated 2026-05-07; full findings F-1 through F-22 with stage matrix, merge-field drift table, call-site map, and severity rollup. The 8 ship-list items above are the actionable subset; F-8/F-10/F-14/F-15/F-16/F-18/F-19/F-20 deferred to Phase 2.

---

End of handoff. Resume from §7 status checklist — next task is F-1.
