# Knowledge Hub Flow Audit

Generated from the current customer app, dashboard routes, action components, and API client. Use this as the source-of-truth script before changing guide copy, captions, or recordings.

## Current Problems

- The hub must not compress customer request, customer verification, admin approval, and customer payment into one generic "booking flow." Those are separate operational gates.
- The first customer request form does not collect ID, insurance, full agreement, signature, or payment. It creates a booking code and sends the customer into `/confirm`.
- `/confirm` has two different meanings depending on status: before approval it is a verification and approval gate; after approval it is the payment path.
- Admin approval is not payment. Approval verifies the submitted customer package, optionally sets risk/deposit, notifies the customer, and exposes the payment link.
- Narration and captions must follow the current screen state. If the screen is showing Awaiting Approval, the narration cannot talk as if the customer is already paying.
- Search must route narrow terms like ID, license, agreement, signature, approve, and payment link to narrow guides instead of returning nearly every guide.
- High-risk work needs explicit stop rules: customer ID/agreement/insurance, admin approval, customer payment, money actions, insurance review, pickup/return, and system-health diagnostics.

## Customer Request Flow

Actual route sequence:

1. `/` customer site loads homepage, fleet, and vehicle cards.
2. Customer opens a vehicle detail page from the fleet.
3. Vehicle Detail shows rate tiers, deposit/rules/specs, gallery, and the request form.
4. Request form steps are Dates, Pickup & Delivery, Add-ons, Your Details, Review.
5. Submit calls `POST /bookings`.
6. Successful submit redirects to `/confirm?ref=BOOKING_CODE`.

Do not say ID, insurance, agreement, or payment happens inside the first request form. The correct outcome is a pending request plus a booking code.

## Customer Verification And Approval Gate

Actual route sequence:

1. Customer opens `/confirm?ref=BOOKING_CODE` or `/confirm?code=BOOKING_CODE`.
2. App loads `GET /agreements/:bookingCode` and payment summary data.
3. Stage 1 shows Rental Summary.
4. Stage 1 step 2 scans the driver license barcode when possible. If scan/camera is unavailable, customer can enter details manually.
5. Address step collects street, city, state, zip, and date of birth when not prefilled from scan/admin data.
6. License step collects license number, issuing state, expiration, and optional front/back license photos.
7. Terms step requires opening and scrolling through full terms before acceptance.
8. Acknowledgements step requires every acknowledgement.
9. Signature step accepts drawn or typed electronic signature.
10. Stage 2 collects insurance choice: own insurance details, Bonzah if available, or explicit no-coverage bypass.
11. Stage 3 reviews the itemized booking package.
12. Stage 4 `PaymentGate` first persists agreement and insurance:
    - `POST /agreements/:bookingCode/sign`
    - `PATCH /bookings/:bookingCode/insurance`
13. If booking status is `pending_approval`, the screen shows Awaiting Approval and polls status.

The correct outcome is not payment. The correct outcome is a saved customer package waiting for admin review.

Stop if booking code/customer/vehicle do not match, license details are incomplete, policy is expired/mismatched, terms or signature are missing, or the payment form appears before approval.

## Admin Approval And Payment Unlock

Actual dashboard sequence:

1. Admin opens `/bookings` and filters to pending approval.
2. Admin opens `/bookings/:id`; the detail page is the source of truth.
3. Admin verifies customer, contact, vehicle, dates, pickup/delivery, add-ons, itemized receipt, license details, date of birth, address, agreement, signature, insurance, and readiness risk.
4. Admin handles insurance review when customer provided personal coverage.
5. Admin opens Review & approve booking.
6. Admin sets high-risk flag and deposit amount if needed.
7. Admin selects Approve & notify customer.
8. Backend transitions booking from `pending_approval` to `approved`.
9. Customer receives email/SMS link; modal also shows a manual copyable payment link.
10. Booking Detail shows Waiting for Customer Payment while approved and unpaid.

Approval unlocks payment. It does not mean the booking is paid or confirmed.

Stop if identity, agreement, insurance, vehicle availability, pricing, deposit, risk, or contact details are unclear.

## Customer Payment After Approval

Actual route sequence:

1. Customer opens the approved booking link from email/SMS/status page/copied dashboard link.
2. `/confirm` sees the agreement is already signed and skips back to the payment gate.
3. `PaymentGate` checks booking status.
4. If status is approved, the screen shows "Your booking is approved" and an itemized receipt.
5. Customer reviews rental total, insurance, deposit, vehicle, dates, and booking code.
6. Customer selects Continue to payment.
7. Payment provider form collects payment.
8. Frontend confirms payment and sends the receipt.
9. Booking should leave approved-unpaid state and become paid/confirmed.

Stop if status is not approved, the amount or booking identity is wrong, or provider/dashboard state disagree.

## Booking Queue

Actual route: `/bookings`.

What the screen owns:

- Triage and filtering, not deep decision-making.
- Lifecycle filters: Needs approval, Payment due, Agreement due, Counter-sign, Pickup today, Active, Overdue, Needs checkout.
- Row facts: booking code, customer, email/phone, delivery type, add-ons, vehicle, dates, status, lifecycle label, total.
- Pending rows expose approve/decline icon actions, but exceptions should open Booking Detail.

Status logic:

- `pending_approval` means request needs operator approval.
- `approved` plus missing rental payment means payment is due.
- `confirmed` or `ready_for_pickup` means payment/doc readiness is being cleared.
- `active`, `returned`, and `completed` should be managed from detail/check-in/checkout.

Stop if customer, vehicle, date range, payment, agreement, insurance, or availability cannot be verified.

## Booking Detail Lifecycle

Actual route: `/bookings/:id`.

This is the record of truth. It owns:

- Overview facts, readiness banners, customer/vehicle/delivery/add-ons/payment summaries.
- Tabs: Overview, Check-In, Check-Out, Invoice.
- Actions: approve, decline, cancel, record pickup, record return, complete, record payment, file damage, insurance approve/reject, extend rental.
- Timeline, condition photos, audit trail, internal notes.

Lifecycle as implemented:

1. `pending_approval`: approve or decline.
2. `approved`: customer can complete payment via confirmation link.
3. `confirmed`: payment is done; finish counter-sign, docs, insurance, and pickup prep.
4. `ready_for_pickup`: admin prep/check-in is saved; customer can start pickup.
5. `active`: customer has the vehicle.
6. `returned`: return is recorded; inspect, review charges, settle deposit, invoice.
7. `completed`: rental is finalized.

Important gate:

- Backend lifecycle requires active -> returned -> completed. Completing an active rental must record return first.

Stop if Check-Out is locked because the renter has not ended the trip and no justified override exists.

## Fleet And Availability

Actual route: `/fleet` and `/fleet/:id`.

What the flow owns:

- Vehicle status, visibility, rates, location, code, photos, detail edits, and blocked dates.
- Preventing unavailable inventory from being sold or approved.

Operational order:

1. Find the exact vehicle.
2. Confirm status, pricing, visibility, location, and condition.
3. Open Vehicle Detail before edits.
4. Add blocked dates for service, owner use, maintenance, damage holds, or any non-bookable window.
5. Cross-check Calendar/Bookings if a block overlaps an approved or paid rental.

Stop if the vehicle is hidden, damaged, in service, blocked, or already committed.

## Pickup, Return, And Check-Ins

Actual route: `/check-ins`.

The board owns daily execution:

- Blocked From Pickup.
- Ready For Handoff.
- Overdue Returns.
- Due Back Today.
- Active Out.
- Returned / Settle.
- Upcoming Ready Pickups.

Lane behavior:

- Blocked From Pickup opens booking Overview.
- Ready For Handoff opens Booking Detail -> Check-In.
- Overdue/Due Back/Active/Returned open Booking Detail -> Check-Out.

Pickup prep:

- Check-In tab records admin prep: odometer, fuel, vehicle photos, condition notes, mark ready.
- If ready, it shows Vehicle Ready for Pickup and lockbox code when available.

Return:

- Check-Out is locked until a customer checkout record exists, booking status is returned, or an override is logged.
- Step 1 records return condition: odometer, fuel, photos, notes.
- Step 2 reviews or adds incidentals.
- Step 3 handles deposit, invoice, and complete.

Stop if pickup lacks payment, agreement, insurance, deposit, or admin prep. Stop if return is overdue and the next rental is at risk.

## Payments, Deposits, And Refunds

Actual route: `/payments`.

What the screen owns:

- Money at risk overview: collection queue, deposits held, needs settlement, long-term risk.
- Payment due follow-up: send reminder, copy payment link, open customer page.
- Deposit and settlement visibility.
- Money action audit trail.

High-risk operating rule:

1. Identify the risk on Payments.
2. Open the booking before money-changing actions.
3. Confirm customer, vehicle, booking code, date range, amount, reason, provider state.
4. Only then send reminder, copy link, release deposit, settle deposit, issue refund, or complete invoice workflow.
5. Check audit trail after the action.

Stop if dashboard and provider disagree, if a webhook failed, or if the reason would not hold up in a customer dispute.

## Insurance Review

Actual routes: `/insurance`, `/settings` integrations tab, and Booking Detail insurance banner/actions.

What the screen owns:

- Bonzah policy counts: active, pending bind, bind failed, markup.
- Policy table: booking, customer, vehicle, dates, tier, status, premium, markup, charged amount.
- Recent Bonzah API activity.
- In settings, Bonzah Test Connection, enable switch, markup, excluded states, tiers, recent activity.

Customer-provided insurance:

- Booking Detail shows pending review.
- Operator approves or rejects with a required reason when rejecting.

Stop if policyholder, vehicle, policy dates, coverage, or charged amount does not match. Bind failures must be reconciled before pickup.

## Customers, Portal, And Long-Term

Actual routes: `/customers`, `/customers/:id`, `/portal`.

Customer side portal:

- `/portal` verifies booking code and email.
- Status drives sections:
  - pending/approved/confirmed: onboarding context.
  - ready_for_pickup: pickup guide and self check-in.
  - active: return form, extension, payment method, safety/return guide.
  - returned/completed: deposit/invoice, pending charges, review, dispute areas.

Dashboard Portal page:

- Groups active account work: onboarding, active accounts, renewal soon, past due, checkout/settlement.
- Includes portal link, payment plan, renewal invoice, checkout/account actions.

Stop if identity, email, phone, booking code, or long-term terms are unclear.

## Messaging And Notifications

Actual route: `/messaging`.

Tabs:

- Conversations.
- Timeline.
- Templates.
- Sequences.
- Opt-Outs.

Correct usage:

1. Open the booking/customer/account that explains why the message is needed.
2. Pick the correct conversation or template.
3. Confirm recipient and opt-out state.
4. Send one action: link, deadline, or status update.
5. If delivery is missing, check Settings and Webhook Failures instead of resending repeatedly.

Stop if consent, recipient, merge fields, booking code/link, or message intent is unclear.

## Revenue And Reporting

Actual route: `/revenue`.

What it owns:

- Date range.
- Total revenue.
- This month.
- Average per booking.
- Average rental length.
- Monthly lead funnel.
- Monthly revenue chart.
- Revenue by rate type.
- Vehicle/category/source performance.
- CSV export.

Correct distinction:

- Revenue is for business decisions.
- Payments is for reconciliation.

Stop if the date range is wrong, payment status is unresolved, or one data point is being used for a major pricing/fleet decision.

## Settings And System Health

Actual routes: `/settings`, `/webhook-failures`, payment provider pages, insurance integrations.

Settings -> System owns:

- Backend health and latency.
- Environment variable checklist.
- Web push.
- Team alerts.
- Notification providers: Resend, Twilio, site URL.
- Stripe keys/webhook secret checklist.
- Quiet hours and automation timing.

Settings -> Integrations owns:

- Bonzah configuration.
- Test Connection.
- Enable/disable Bonzah.
- Markup and excluded state config.
- Recent Bonzah activity.

Webhook Failures owns:

- Failed GHL/automation notification events with timestamp, event type, booking code, status, and error.

Stop if a failed webhook affects payment, agreement, insurance, booking status, pickup, or customer messaging. Do diagnostics before asking the customer to repeat an action.

## Video/Narration Rules

- Captions and voiceover must come from the recording manifest for that guide.
- A caption should describe what is currently visible, not what the operator may do later.
- High-risk workflows need explicit stop language on screen: payments, insurance, pickup/return, and system health.
- Cursor focus must land on the actual owning element: lifecycle chip, booking row, booking tab, return gate, money action, policy row, provider activity, or webhook failure.
- Every generated MP4 should be stale if source guide data, capture script, render script, or captions change.
