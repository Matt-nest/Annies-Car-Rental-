/**
 * Fallback email/SMS templates for critical booking stages.
 *
 * These fire ONLY when the `email_templates` DB table has no active row
 * for a given stage. DB templates always take priority.
 *
 * Covers Tier 1 (business-critical) and Tier 2 (revenue/protection):
 *   booking_approved, booking_declined, booking_cancelled,
 *   payment_confirmed, pickup_reminder, return_reminder,
 *   late_return_warning, rental_completed
 */

const FALLBACK_TEMPLATES = {

  // ── TIER 1: Business breaks without these ────────────────────────────────

  booking_approved: {
    channel: 'both',
    subject: 'Confirmed: Your {{vehicle}} is reserved — {{booking_code}}',
    body: `Hi {{first_name}},

Your booking has been approved. Here's your confirmation:

RESERVATION CONFIRMED ✓
───────────────────────
Reference:  {{booking_code}}
Vehicle:    {{vehicle}}
Pickup:     {{pickup_date}} at {{pickup_time}}
Return:     {{return_date}} at {{return_time}}
Duration:   {{rental_days}} days
Mileage:    {{mileage_policy}}
Total:      \${{total_cost}}

{{#if vehicle_year_make_model}}YOUR VEHICLE
───────────────────────
{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:400px;border-radius:12px;margin-bottom:12px;" />
{{/if}}{{vehicle_year_make_model}}{{#if vehicle_color}}
Color: {{vehicle_color}}{{/if}}{{#if vehicle_plate}}
Plate: {{vehicle_plate}}{{/if}}
{{/if}}
NEXT STEP
Please complete your rental agreement and payment to lock in your reservation:
→ {{confirm_link}}

WHAT TO EXPECT
• 24 hours before pickup — You'll receive a text with the exact address, lockbox code, and parking location.
• Day of pickup — A final reminder with directions.
• During your rental — We're a text or call away if you need anything.

DELIVERY OPTION
Don't want to come to us? We offer delivery and pickup:
• Port Saint Lucie / Fort Pierce — $35 each way
• Vero Beach / Stuart — $45 each way
Reply to this email or text us to arrange delivery.

Questions? We're here:
  Matthew: (772) 834-0117
  Robin:   (772) 834-7637

Annie's Car Rental
Port Saint Lucie, FL`,
    sms_body: `Great news, {{first_name}} — your booking is confirmed!

{{vehicle}}
Pickup: {{pickup_date}} at {{pickup_time}}
Ref: {{booking_code}}

Complete your agreement & pay here:
{{confirm_link}}

We'll send you pickup instructions and the lockbox code the day before your rental.

— Annie's Car Rental`,
  },

  booking_declined: {
    channel: 'both',
    subject: 'Update on your booking request — {{booking_code}}',
    body: `Hi {{first_name}},

We're sorry to let you know that we're unable to confirm your booking at this time.

BOOKING DETAILS
───────────────
Reference:  {{booking_code}}
Vehicle:    {{vehicle}}
Dates:      {{pickup_date}} – {{return_date}}

REASON
{{decline_reason}}

WHAT YOU CAN DO
We may have other vehicles available for your dates. Please give us a call and we'll help find something that works:

  Matthew: (772) 834-0117
  Robin:   (772) 834-7637

We appreciate your interest and hope to serve you soon.

Annie's Car Rental
Port Saint Lucie, FL`,
    sms_body: `Hi {{first_name}}, unfortunately we're unable to confirm your booking for the {{vehicle}} ({{pickup_date}} – {{return_date}}).

{{decline_reason}}

We'd love to help you find an alternative. Give us a call at (772) 834-0117.

— Annie's Car Rental`,
  },

  payment_confirmed: {
    channel: 'both',
    subject: '✅ Payment Confirmed — Receipt for {{booking_code}}',
    body: `Hi {{first_name}},

Thank you — your payment has been received and your booking is confirmed! Here's your itemized receipt and everything you need to know.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEMIZED RECEIPT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Booking Reference:  {{booking_code}}
Payment Date:       {{payment_date}}
Payment Method:     {{payment_method}}

RENTAL CHARGES
───────────────────────────
Vehicle Rental ({{rental_days}} days)    \${{amount}}{{#if unlimited_miles_fee}}
  └ Unlimited Miles Add-On       \${{unlimited_miles_fee}}{{/if}}{{#if unlimited_tolls_fee}}
  └ Unlimited Tolls Add-On      \${{unlimited_tolls_fee}}{{/if}}{{#if tax_amount}}
Taxes & Fees                     \${{tax_amount}}{{/if}}
Security Deposit (refundable)    \${{deposit_amount}}
                                 ─────────
TOTAL CHARGED                    \${{total_charged}}

{{#if vehicle_year_make_model}}YOUR VEHICLE
───────────────────────────
{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:400px;border-radius:12px;margin-bottom:12px;" />
{{/if}}{{vehicle_year_make_model}}{{#if vehicle_color}}
Color: {{vehicle_color}}{{/if}}{{#if vehicle_plate}}
Plate: {{vehicle_plate}}{{/if}}
{{/if}}
RENTAL DETAILS
───────────────────────────
Pickup:    {{pickup_date}} at {{pickup_time}}
Return:    {{return_date}} at {{return_time}}
Mileage:   {{mileage_policy}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WHAT HAPPENS NEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  24 HOURS BEFORE PICKUP
   You'll receive a text with the exact pickup address, parking location, and your lockbox code.

2️⃣  DAY OF PICKUP
   A final reminder with turn-by-turn directions.

3️⃣  PICKUP
   Walk to the back of the building, find your vehicle, retrieve the key from the lockbox, and you're off!

4️⃣  SELF-SERVICE CHECK-IN
   Use your Customer Portal to complete check-in, view your rental details, and contact us anytime:
   → {{portal_link}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR CUSTOMER PORTAL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your portal is your rental home base. Use it to:
• View your booking details and receipt
• Complete self-service check-in on pickup day
• Message us directly
• Request a rental extension

→ {{portal_link}}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DEPOSIT INFO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your \${{deposit_amount}} security deposit is fully refundable. After your return, we'll inspect the vehicle and process your refund within 3–5 business days — no action needed from you.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questions? We're always here:
  Matthew: (772) 834-0117
  Robin:   (772) 834-7637

Annie's Car Rental
Port Saint Lucie, FL`,
    sms_body: `Hi {{first_name}}, your payment of \${{total_charged}} for the {{vehicle}} is confirmed! ✅

Ref: {{booking_code}}
Pickup: {{pickup_date}} at {{pickup_time}}

Your Customer Portal: {{portal_link}}

We'll text you pickup instructions the day before. Questions? Call (772) 834-0117.

— Annie's Car Rental`,
  },

  pickup_reminder: {
    channel: 'both',
    subject: 'Pickup tomorrow: Your {{vehicle}} is ready — {{booking_code}}',
    body: `Hi {{first_name}},

Your rental starts tomorrow. Here's everything you need:

PICKUP DETAILS
──────────────
Date:       {{pickup_date}} at {{pickup_time}}
Vehicle:    {{vehicle}}
Reference:  {{booking_code}}

{{#if vehicle_year_make_model}}YOUR VEHICLE
──────────────
{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:400px;border-radius:12px;margin-bottom:12px;" />
{{/if}}{{vehicle_year_make_model}}{{#if vehicle_color}}
Color: {{vehicle_color}}{{/if}}{{#if vehicle_plate}}
Plate: {{vehicle_plate}}{{/if}}{{#if vehicle_vin}}
VIN:   {{vehicle_vin}}{{/if}}
{{/if}}
{{#if handoff_fuel_level}}VEHICLE CONDITION AT HANDOFF
──────────────────────────
Fuel Level:  {{handoff_fuel_level}}
{{#if handoff_odometer}}Odometer:    {{handoff_odometer}} mi{{/if}}
{{#if handoff_photos}}
Inspection Photos:
{{handoff_photos}}{{/if}}
{{/if}}
PICKUP LOCATION
586 NW Mercantile Pl
Port Saint Lucie, FL 34986
→ Park and walk to the back of the building.

HOW TO GET YOUR KEYS
1. Locate your vehicle in the back lot
2. Find the key lockbox attached to the window
3. Enter code: {{lockbox_code}}
4. Remove the lockbox from the window before driving

SELF-SERVICE CHECK-IN
Once you have the key, complete your check-in through your Rental Portal:
→ {{portal_link}}

IMPORTANT REMINDERS
• Mileage — {{mileage_policy}}.
• Fuel — Return the vehicle with the same fuel level you receive it with.
• No smoking — Vehicles are smoke-free. A $150 cleaning fee applies.
• No pets — A $150 cleaning fee applies.
• Text us when you arrive so we know you're all set.

CONTACT
  Matthew: (772) 834-0117
  Robin:   (772) 834-7637
  Aaron:   (772) 985-6667

Annie's Car Rental
Port Saint Lucie, FL`,
    sms_body: `Hi {{first_name}}, your {{vehicle}} is ready for pickup tomorrow.

Mileage: {{mileage_policy}}.
📍 586 NW Mercantile Pl, Port Saint Lucie, FL 34986
🔑 Lockbox code: {{lockbox_code}}
🅿️ The car will be parked in the back of the building.

When you arrive:
1. Go to the back of the building
2. Find the vehicle with the lockbox on the window
3. Enter code {{lockbox_code}} to retrieve the keys
4. Remove the lockbox from the window before driving

Complete your check-in: {{portal_link}}

Need help? Call Matthew at (772) 834-0117.

— Annie's Car Rental`,
  },

  return_reminder: {
    channel: 'both',
    subject: 'Return reminder: {{vehicle}} due back {{return_date}}',
    body: `Hi {{first_name}},

Your rental is almost over. Here are the details for a smooth return:

RETURN DETAILS
──────────────
Date:     {{return_date}} at {{return_time}}
Vehicle:  {{vehicle}}
Ref:      {{booking_code}}

RETURN LOCATION
586 NW Mercantile Pl
Port Saint Lucie, FL 34986

RETURN CHECKLIST
☐ Fill fuel to the same level you received the car with
☐ Park in the back of the building, near the dumpster
☐ Place the key back in the lockbox (code: {{lockbox_code}})
☐ Take a photo of where you parked and send it to us

WANT TO EXTEND?
If your plans have changed, we can often extend your rental or swap you into another vehicle. Just reply to this email or text us.

CONTACT
  Matthew: (772) 834-0117
  Robin:   (772) 834-7637

Annie's Car Rental
Port Saint Lucie, FL`,
    sms_body: `Hi {{first_name}}, a reminder that your {{vehicle}} is due back tomorrow.

Return by: {{return_date}} at {{return_time}}

📍 586 NW Mercantile Pl, Port Saint Lucie, FL 34986

Please remember:
• Return with the same fuel level
• Park in the back, near the dumpster
• Place the key back in the lockbox (code: {{lockbox_code}})
• Take a photo of where you parked

Want to extend? Reply to this message and we'll check availability.

— Annie's Car Rental`,
  },

  // ── TIER 2: Revenue & protection ─────────────────────────────────────────

  late_return_warning: {
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Hi {{first_name}}, we noticed your {{vehicle}} was due back at {{return_time}} today. If you're on your way, no worries — just let us know your ETA.

If you need to extend, reply to this message and we'll check availability.

Return address: 586 NW Mercantile Pl, Port Saint Lucie, FL 34986

— Annie's Car Rental
(772) 834-0117`,
  },

  rental_completed: {
    channel: 'both',
    subject: 'How was your rental, {{first_name}}?',
    body: `Hi {{first_name}},

Thank you for renting with Annie's Car Rental. We hope the {{vehicle}} made your trip a little easier.

We're a small, family-run business in Port Saint Lucie, and your feedback helps us grow. If you have a moment, we'd love to hear how it went.

→ Leave a review: {{review_link}}

AS A THANK YOU
Every guest who leaves a review receives 5% off their next rental. Just mention your review when you book and we'll apply the discount.

We'd love to have you back.

Annie's Car Rental
Port Saint Lucie, FL
(772) 834-0117`,
    sms_body: `Hi {{first_name}}, we hope you enjoyed your {{vehicle}}.

If you have a moment, a review would mean a lot to our small business. As a thank you, we'll give you 5% off your next rental.

Leave a review: {{review_link}}

— Annie's Car Rental`,
  },

  booking_cancelled: {
    channel: 'both',
    subject: 'Booking cancelled — {{booking_code}}',
    body: `Hi {{first_name}},

Your booking has been cancelled.

CANCELLED BOOKING
─────────────────
Reference:  {{booking_code}}
Vehicle:    {{vehicle}}
Dates:      {{pickup_date}} – {{return_date}}

If a deposit was collected, it will be refunded to your original payment method within 3–5 business days per our cancellation policy.

If you'd like to rebook or have questions, we're here to help:
  Matthew: (772) 834-0117
  Robin:   (772) 834-7637

Annie's Car Rental
Port Saint Lucie, FL`,
    sms_body: `Hi {{first_name}}, your booking for the {{vehicle}} ({{pickup_date}} – {{return_date}}) has been cancelled.

Ref: {{booking_code}}

If a deposit was collected, it will be refunded within 3–5 business days.

Questions? Call us at (772) 834-0117.

— Annie's Car Rental`,
  },

  // ── TIER 2 (continued): Deposit Notifications ────────────────────────────

  deposit_refunded: {
    channel: 'both',
    subject: 'Your ${{deposit_amount}} deposit has been refunded — {{booking_code}}',
    body: `Hi {{first_name}},

Great news — your security deposit has been fully refunded.

DEPOSIT REFUND
──────────────
Reference:     {{booking_code}}
Vehicle:       {{vehicle}}
Deposit Held:  \${{deposit_amount}}
Refund Amount: \${{refund_amount}}
Status:        ✅ Full Refund

Your refund of \${{refund_amount}} will be returned to your original payment method within 5–10 business days.

Thank you for taking great care of the vehicle — we hope to see you again soon.

Questions? We're always here:
  Matthew: (772) 834-0117
  Robin:   (772) 834-7637

Annie's Car Rental
Port Saint Lucie, FL`,
    sms_body: `Hi {{first_name}}, your \${{deposit_amount}} security deposit for the {{vehicle}} has been fully refunded! ✅

Ref: {{booking_code}}

The refund will appear on your statement within 5–10 business days.

— Annie's Car Rental`,
  },

  deposit_settled: {
    channel: 'both',
    subject: 'Deposit settlement details — {{booking_code}}',
    body: `Hi {{first_name}},

Your security deposit has been settled. Here are the details:

DEPOSIT SETTLEMENT
──────────────────
Reference:       {{booking_code}}
Vehicle:         {{vehicle}}
Deposit Held:    \${{deposit_amount}}
Charges Applied: \${{incidental_total}}
Refund Amount:   \${{refund_amount}}

{{#if refund_amount}}Your refund of \${{refund_amount}} will be returned to your original payment method within 5–10 business days.{{/if}}

If you have any questions about the charges applied to your deposit, please don't hesitate to reach out. You can also view your booking details and submit a dispute through your Customer Portal.

Contact us anytime:
  Matthew: (772) 834-0117
  Robin:   (772) 834-7637

Annie's Car Rental
Port Saint Lucie, FL`,
    sms_body: `Hi {{first_name}}, your deposit for the {{vehicle}} has been settled.

Deposit: \${{deposit_amount}}
Charges: \${{incidental_total}}
Refund:  \${{refund_amount}}

Ref: {{booking_code}}

The refund will appear on your statement within 5–10 business days. Questions? Call (772) 834-0117.

— Annie's Car Rental`,
  },

  inspection_charges_scheduled: {
    channel: 'email',
    subject: 'Inspection charges scheduled — {{booking_code}}',
    body: `Hi {{first_name}},

Your post-rental inspection is complete. Charges came in above your security deposit, and the difference is scheduled to be charged to the card on file.

INSPECTION CHARGES
──────────────────
Reference:       {{booking_code}}
Vehicle:         {{vehicle}}
Charges Total:   \${{incidental_total}}
Amount Owed:     \${{amount_owed}}

This charge will be processed automatically in 48 hours. If you'd like to dispute any portion before that window closes, log into your Customer Portal — disputed charges are paused for review.

Contact us anytime:
  Matthew: (772) 834-0117
  Robin:   (772) 834-7637

Annie's Car Rental
Port Saint Lucie, FL`,
  },

  // ── Bonzah insurance lifecycle ───────────────────────────────────────────

  insurance_policy_issued: {
    channel: 'email',
    subject: '🛡️ Your Bonzah insurance policy is active — {{booking_code}}',
    body: `Hi {{first_name}},

Good news — your Bonzah rental insurance is active for your upcoming trip.

POLICY DETAILS
──────────────
Reference:    {{booking_code}}
Vehicle:      {{vehicle}}
Coverage:     {{bonzah_tier_label}}
Policy #:     {{bonzah_policy_no}}
Total paid:   \${{bonzah_total_charged}}
Effective:    {{pickup_date}} – {{return_date}}

The policy is held with Bonzah (Insillion) — keep this email for your records. If you have a claim during your rental, contact Bonzah directly using the policy number above.

Need to reach us?
  Matthew: (772) 834-0117
  Robin:   (772) 834-7637

Annie's Car Rental
Port Saint Lucie, FL`,
  },

  insurance_bind_failed: {
    channel: 'email',
    subject: '⚠️ Bonzah bind FAILED — manual reconciliation needed for {{booking_code}}',
    body: `Bonzah policy could NOT be issued for booking {{booking_code}} after Stripe successfully charged the customer.

BOOKING
───────
Reference:   {{booking_code}}
Customer:    {{first_name}} {{last_name}} ({{email}})
Vehicle:     {{vehicle}}
Pickup:      {{pickup_date}} at {{pickup_time}}
Tier:        {{bonzah_tier_label}}
Quote #:     {{bonzah_quote_id}}
Premium:     \${{bonzah_premium}}

WHAT TO DO
1. Open the booking in the dashboard: {{dashboard_link}}
2. Inspect the most recent bonzah_events row for the underlying error.
3. Either retry the bind manually OR refund the insurance portion to the customer
   and switch insurance_provider to 'own'.

The customer's Stripe charge HAS gone through. They are not aware of this failure.

— Annie's Car Rental Internal Alert`,
  },
};

export default FALLBACK_TEMPLATES;
