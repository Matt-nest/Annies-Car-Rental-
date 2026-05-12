# PHASE 2 PLAN — Notification timeline redesign

> **Status:** Draft awaiting user approval. Do not implement until approved.
> **Companion plan:** [PHASE_1_PLAN.md](PHASE_1_PLAN.md) — must ship first.
> **Pre-req:** Phase 1's `business_settings` table + quiet hours wiring make the timeline editor non-destructive at night.

---

## Goal

Replace the current 3-tab Messaging page (Conversations / Templates / Sequences) with a **lifecycle timeline view** that:

1. Lays every notification stage on a horizontal timeline ordered by the rental lifecycle (request → submitted → approved → ready → pickup → during → return → post-trip)
2. Each stage is a draggable card showing channel, active state, and last-fired stats
3. Clicking a card opens an inline editor with **side-by-side email + SMS preview** that re-renders live as you type
4. **Time-shifted stages** (pickup_reminder = "24h before pickup", etc.) get a draggable time control to adjust the offset
5. Existing trigger mechanics are preserved — event triggers still fire from booking transitions, cron still runs at 7/9 AM ET. We're rewiring **what** fires (timing + content), not **how** it fires.

---

## Why "drag-and-drop" is the right metaphor

Stages fall into two categories:

| Type | Trigger | Drag behavior |
|---|---|---|
| **Event-anchored** | Fires immediately on a booking transition (e.g. `booking_approved` fires when admin clicks Approve) | Drag only reorders cards visually within their lifecycle group — does NOT change *when* they fire (event timing is set by the user action) |
| **Time-shifted** | Cron fires X hours/days before/after an anchor date (e.g. `pickup_reminder` = pickup_date - 24h) | Drag horizontally on a time axis to adjust the offset; vertical drag reorders within the time-slot |

Each card has an explicit "anchor + offset" label so the user knows the difference.

---

## Pre-flight: what we are NOT touching

| Untouchable | Why |
|---|---|
| `api/client.js` | 25 consumers (per PROJECT_MAP). New endpoints get added, none renamed/changed. |
| `auth/*` | Never-touch list. |
| The `email_templates` row schema for existing columns | We add NEW columns; existing columns (stage, name, subject, body, sms_body, channel, is_active, trigger_type) stay identical. |
| The cron *fire path* (`sendBookingNotification → notifyService.sendEmail/SMS`) | Reuse as-is. We only change what data the cron query selects (offsets read from DB). |
| F-7 idempotency, F-18 partial unique index, F-21 opt-out, ghost-block invariant | All preserved. |
| The 7am + 9am ET Vercel cron schedule itself | Changing the cron *schedule* requires `vercel.json` edits; we keep the firing windows and only adjust *which bookings* each cron picks up via offset config. |

---

## Architectural decision: timing externalization

Currently, cron timings are hardcoded in [backend/routes/cron.js](backend/routes/cron.js):
- `pickup_reminder`: `pickup_date = tomorrow()` (24h before, fixed)
- `mid_rental_checkin`: `pickup_date = daysAgo(2)` (day 3, fixed)
- `late_return_escalation`: `return_date = daysAgo(4)` (fixed)
- ... etc.

**Three options for Phase 2:**

### Option A — Full externalization (most flexible, riskiest)
Move every cron timing to `email_templates` columns. Rewrite cron.js to read DB. **Risk:** any DB misconfig breaks reminders for every booking until you notice. Customer-facing breakage.

### Option B — Visualize but lock (safest, least admin control)
Timeline UI shows current timings as read-only. Admin can edit template *content* but not *when* it fires. Drag-and-drop is purely cosmetic.

### Option C — Hybrid (recommended)
Editable offset (hours/days), but anchor (pickup_date / return_date / completed_at) and condition (status filters) stay hardcoded. UI exposes a single number per stage: "Fire X hours before/after [anchor]". Sanity-bounded (e.g. -7 days to +30 days).

**My recommendation: Option C.** Gives admin meaningful control (push pickup reminder from 24h → 48h) without exposing the foot-guns (changing anchor or status filters).

**This plan assumes Option C unless you say otherwise.**

---

## Schema changes (Option C)

```sql
-- migrations/020_template_timing.sql
ALTER TABLE email_templates
  ADD COLUMN IF NOT EXISTS lifecycle_position INTEGER,        -- 0=request, 1=approval, 2=pre-payment, 3=ready, 4=pickup, 5=during, 6=return, 7=post
  ADD COLUMN IF NOT EXISTS visual_order       INTEGER NOT NULL DEFAULT 0,  -- ordering within a position
  ADD COLUMN IF NOT EXISTS trigger_kind       TEXT,           -- 'event' | 'cron'
  ADD COLUMN IF NOT EXISTS trigger_anchor     TEXT,           -- 'pickup_date','return_date','submitted_at','completed_at' — fixed values; UI is read-only
  ADD COLUMN IF NOT EXISTS trigger_offset_minutes INTEGER,    -- signed; negative = before anchor, positive = after
  ADD COLUMN IF NOT EXISTS trigger_status_filter TEXT[];      -- ['approved','confirmed','ready_for_pickup'] — fixed values; UI is read-only
```

Backfill defaults match current cron.js exactly. Migration is idempotent.

Cron rewrite (still in `cron.js`): for each stage, build the query from `trigger_anchor` + `trigger_offset_minutes` + `trigger_status_filter` instead of hardcoding. **Sanity guard:** if any DB value is null OR out of bounds (offset > 30 days), fall back to hardcoded default and log a warning. This prevents a bad DB row from silently killing reminders.

---

## File-level changes

### Backend (5 files)

| File | Change | Blast radius |
|---|---|---|
| `backend/migrations/020_template_timing.sql` (NEW) | New columns + backfill | Schema |
| `backend/routes/cron.js` | Replace hardcoded `tomorrow()` / `daysAgo(N)` with DB-driven queries; per-stage helper `buildCronQuery(stageConfig)`. Sanity fallback to hardcoded default if DB row invalid. | 1 file, internal logic only — cron contract (URL, secret, response shape) unchanged |
| `backend/routes/messaging.js` | Extend `/email-templates` PUT to accept the new columns. Add `POST /email-templates/test-send-sms` (already in Phase 1). | 1 file, additive |
| `backend/services/notifyService.js` | No change — still receives `stage` + `bookingPayload`, looks up template. The lifecycle/timing fields are read by `cron.js`, not by `notifyService`. | 0 changes |
| `backend/tests/cron-config.test.js` (NEW) | Test that DB-driven queries match the hardcoded queries for a fixture set of bookings. Guards against the cron rewrite breaking existing behavior. | New file |

### Frontend (8 files)

| File | Change | Blast radius |
|---|---|---|
| `dashboard/src/api/client.js` | Add: `updateTemplateTiming(id, body)` only. The existing `updateEmailTemplate` can already handle the new fields once they're persisted by the backend. | 1 file, additive |
| `dashboard/src/pages/MessagingPage.jsx` | Replace 3-tab switcher: keep `conversations` tab, REPLACE `templates`+`sequences` with one new `timeline` tab. Keep `opt-outs` tab (from Phase 1). Now 3 tabs: Conversations / Timeline / Opt-Outs. | 1 file, internal layout |
| `dashboard/src/components/messaging/TimelineView.jsx` (NEW) | The new headline component. Renders the horizontal lifecycle. Uses dnd-kit (already in deps via DashboardLayoutSettings). | New |
| `dashboard/src/components/messaging/TimelineCard.jsx` (NEW) | Single stage card. Shows label, channel badge, active toggle, last-fired count, trigger label ("24h before pickup"). | New |
| `dashboard/src/components/messaging/TimelineEditorPanel.jsx` (NEW) | Side panel that opens on card click. Contains subject/body/sms_body editors + dual preview. | New |
| `dashboard/src/components/messaging/EmailPreview.jsx` (NEW) | Renders the branded email shell in an iframe using the actual `renderBrandedShell` HTML from the backend (new GET endpoint: `/email-templates/:id/preview-html?mock=true`). | New |
| `dashboard/src/components/messaging/SmsPreview.jsx` (NEW) | iMessage-style speech bubble. Shows character count + segment count (160 / 153 chars per segment). Warns when body exceeds one segment (impacts cost). | New |
| `dashboard/src/components/messaging/EmailTemplatesTab.jsx` | **DELETE** — fully replaced by TimelineView. Keep the file until the new view is verified working, then remove in commit 3. | -1 file (eventual) |
| `dashboard/src/components/messaging/SequencesTab.jsx` | **DELETE** — fully replaced. Same staging. | -1 file (eventual) |

**Net file delta:** +6 new components, -2 deleted, 4 modified = **12 files touched**.

---

## UI sketch (textual — no image)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ Notification Timeline                                          [+ New stage]    │
│ Manual drag = reorder cards. Cron stages: drag horizontally to adjust timing.   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  REQUEST    APPROVAL    READY    PICKUP    DURING    RETURN    POST-TRIP        │
│  ───────────────────────────────────────────────────────────────────►           │
│                                                                                 │
│  [submitted] [approved]  [ready]  [-24h    [day 3] [-24h     [day-of   [review] │
│   📱✉️ LIVE   📱✉️ LIVE  📱✉️ LIVE   pickup]  📱     return]   return]    +1 day  │
│                                    📱✉️    LIVE   📱✉️ LIVE  📱        📱✉️ LIVE  │
│  fires on   fires when  fires when             LIVE                              │
│  booking    admin       admin marks                                              │
│  created    approves    ready                                                    │
│                                                                                 │
│           [declined]                          [extension]            [loyalty]  │
│            📱✉️ OFF                            -24h ret              +30 days   │
│                                               📱✉️ LIVE              📱✉️ LIVE   │
└─────────────────────────────────────────────────────────────────────────────────┘

Click a card → slide-in panel from the right with editor + dual preview.
```

When a card is selected:

```
┌────────────────────────────────────────────────────────────┐ ┌──────────────────┐
│  Pickup Reminder              [📱✉️ Both ▾] [● Active]      │ │  EMAIL PREVIEW   │
│  Trigger: 24h before pickup_date  ┃───●──────┃ -24h  ✎    │ │  ┌────────────┐  │
│                                                             │ │  │ Annie's    │  │
│  Subject ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │ │  │ banner     │  │
│  [ Your rental tomorrow — {{vehicle}} {{pickup_time}}  ]  │ │  │            │  │
│                                                             │ │  │ Hi Sarah,  │  │
│  Email body ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │ │  │ Your rent…│  │
│  ╭────────────────────────────────────────────────────╮   │ │  │            │  │
│  │ Hi {{first_name}},                                  │   │ │  │ [Gold CTA] │  │
│  │ Your rental starts tomorrow…                        │   │ │  └────────────┘  │
│  ╰────────────────────────────────────────────────────╯   │ │                  │
│                                                             │ │  SMS PREVIEW     │
│  SMS body ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │ │  ┌────────────┐  │
│  ╭────────────────────────────────────────────────────╮   │ │  │ ◉ +1 772.. │  │
│  │ Hi {{first_name}}, your {{vehicle}} pickup is…      │   │ │  ╰────────────╯  │
│  ╰────────────────────────────────────────────────────╯   │ │  ┌────────────┐  │
│  142 / 160 chars · 1 segment                                │ │  │ Hi Sarah, │  │
│                                                             │ │  │ your rental│  │
│  [Send test email ⌥] [Send test SMS ⌥]    [Save] [Cancel] │ │  │ tomorrow… │  │
│                                                             │ │  └────────────┘  │
└────────────────────────────────────────────────────────────┘ └──────────────────┘
```

Previews update live as the body is edited. Mock merge data uses the same fixture the existing `/test-send` route uses (see [backend/routes/messaging.js:454](backend/routes/messaging.js#L454)).

---

## Drag interaction spec

| Gesture | Effect |
|---|---|
| Drag card vertically | Reorder visual position within the same lifecycle column |
| Drag card horizontally (cron stages only) | Show a time-axis tooltip. On drop, update `trigger_offset_minutes`. Snaps to common offsets (-1h, -6h, -12h, -24h, -48h, +1d, +7d, +30d). Out-of-range snaps refused. |
| Drag card to "Off" zone at bottom | Sets `is_active = false`. Same as toggling. |
| Drag card to trash | Confirmation modal → soft-deletes (sets `is_active = false`, marks `archived_at`). Never hard-delete from this UI. |
| Click card | Opens editor panel (above). No drag = open. |

**Accessibility:** All drag actions also accessible via keyboard arrows + Enter when a card is focused (per dnd-kit a11y guidance). Existing DashboardLayoutSettings already does this — copy the pattern.

---

## Email preview implementation

The current `wrapInBrandedHTML` in `notifyService.js` is server-side only. To get accurate preview without duplicating it client-side:

1. New backend endpoint: `GET /email-templates/preview-html?stage=X&subject=Y&body=Z` — accepts overrides for unsaved drafts, renders the branded shell with mock data, returns HTML. Reuses `interpolateTemplate` + `wrapInBrandedHTML` exactly as the real send does.
2. Frontend `EmailPreview.jsx` renders the response inside a sandboxed `<iframe sandbox="allow-same-origin">` so the email's inline styles don't leak into the dashboard.
3. Debounce the fetch to 400ms on body edits.

**Critical:** the preview MUST use the same render path as a real send, or it's lying. This is why we do it server-side, not client-side.

---

## SMS preview implementation

Pure frontend. SMS has no shell — just the body. Render:
- iMessage-style bubble (gray background, rounded, sender phone number above)
- Interpolate mock data the same way the backend does (we can replicate the simple `{{key}}` regex client-side; no need for backend roundtrip)
- Character count + segment count (160 chars per segment for GSM-7, 153 for multi-segment)
- Cost projection: "$0.0083 × N segments = $X per send"

---

## What can go wrong (and how this plan protects)

| Risk | Mitigation |
|---|---|
| Bad timing config kills reminders | Sanity fallback in cron.js: if DB value invalid → use hardcoded default + console.error. Sentry alert if hit in prod. |
| Preview HTML diverges from real email | Server-renders preview using same code path as real sends |
| User accidentally deactivates a critical stage | Confirmation modal on toggle-off for critical stages (`booking_approved`, `payment_confirmed`, `ready_for_pickup`, `pickup_reminder`) |
| dnd-kit + framer-motion conflict | Already coexist in DashboardLayoutSettings — copy that integration pattern |
| iframe sandbox blocks fonts | Use inline `<style>` in the rendered shell, not external font URLs (already the case in `renderBrandedShell`) |
| Cron rewrite breaks an existing edge case | New test file `cron-config.test.js` snapshots current behavior; rewrite must match |

---

## Migration & rollout

1. Apply `migrations/020_template_timing.sql` (idempotent, backfills from current hardcoded values)
2. Deploy backend with **both** old + new cron logic. New logic is gated behind `FEATURE_TIMELINE_TIMING=true` env var. Default off. Existing behavior preserved bit-for-bit.
3. Deploy dashboard with the new TimelineView. The old EmailTemplatesTab + SequencesTab are kept in the repo but the MessagingPage tab switcher only shows Timeline. (Old components are dead code until commit 3.)
4. QA: open MessagingPage, edit a template, verify preview, send test, toggle on/off. Manually trigger a cron via curl with old flag = behavior matches current; with new flag = behavior reads DB.
5. Flip `FEATURE_TIMELINE_TIMING=true`. Watch logs for 24h. If clean → commit 3 removes the old components + the feature flag.

---

## File count + sequencing

**12 files touched** (1 migration, 4 backend, 7 frontend net; +6 new frontend, -2 deleted in final commit).

**Three commits across one PR:**
1. `feat(notify): schema + backend cron rewrite behind FEATURE_TIMELINE_TIMING flag` — backend only, no UI change; 4 files
2. `feat(messaging): timeline UI with dual-channel preview` — frontend only, gated rollout; 8 files
3. `refactor(messaging): remove deprecated EmailTemplatesTab + SequencesTab + feature flag` — cleanup; 4 files

Run `cd dashboard && npm run build` after each. Zero errors required.

---

## What this plan deliberately leaves out

- A/B testing of template variants — premature
- Localization (template per language) — not a current need
- Per-vehicle template overrides — not a current need
- Scheduled one-off broadcasts ("send all customers this Friday at 9am") — different feature, deserves its own surface
- Analytics dashboard ("which templates have highest open rates") — needs Resend webhooks first
- Bulk import/export of templates — fine to defer

---

## Approval needed before I write any code

1. ✅ / ❌ — **Option C** (editable offsets, fixed anchors) for timing externalization
2. ✅ / ❌ — `FEATURE_TIMELINE_TIMING` env flag for staged rollout (vs. atomic switch)
3. ✅ / ❌ — Drag interactions as specified (vertical reorder + horizontal time-shift for cron stages only)
4. ✅ / ❌ — Critical-stage deactivation confirmation modal (list: booking_approved, payment_confirmed, ready_for_pickup, pickup_reminder)
5. ✅ / ❌ — Server-rendered email preview via new `GET /email-templates/preview-html` endpoint (vs. client-side replication)
6. ✅ / ❌ — Delete `EmailTemplatesTab.jsx` + `SequencesTab.jsx` after timeline view is verified (vs. keeping as fallback)
7. ✅ / ❌ — 3 commits in one PR, the third gated on 24h of green logs

Once you sign off on these + the Phase 1 questions, I'll start with Phase 1 step 0 (your Twilio rotation) and then write code.
