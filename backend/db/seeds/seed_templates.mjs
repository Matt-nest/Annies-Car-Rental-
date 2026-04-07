import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const templates = [
  {
    name: 'Booking Submitted',
    stage: 'booking_submitted',
    channel: 'both',
    subject: 'Your booking request has been received — {{booking_code}}',
    body: `Hi {{first_name}},

Thank you for choosing Annie's Car Rental. We've received your booking request and it's being reviewed now.

BOOKING DETAILS
───────────────
Reference:  {{booking_code}}
Vehicle:    {{vehicle}}
Pickup:     {{pickup_date}} at {{pickup_time}}
Return:     {{return_date}} at {{return_time}}
Duration:   {{rental_days}} days
Total:      \${{total_cost}}

WHAT HAPPENS NEXT
You'll receive a confirmation message once your booking is approved — typically within a few hours. If we need any additional information, we'll reach out directly.

If you have questions in the meantime, we're here to help:
  Matthew: (772) 834-0117
  Robin:   (772) 834-7637
  Aaron:   (772) 985-6667

Annie's Car Rental
Port Saint Lucie, FL`,
    sms_body: `Hi {{first_name}}, thanks for your booking request with Annie's Car Rental.

Booking: {{booking_code}}
Vehicle: {{vehicle}}
Dates: {{pickup_date}} – {{return_date}}

We're reviewing your request and will confirm within a few hours. We'll text you as soon as it's approved.

Questions? Call us at (772) 834-0117.`,
    trigger_type: 'automated',
    description: 'Sent immediately when a customer submits a booking request.',
    is_active: true,
  },
  {
    name: 'Booking Approved',
    stage: 'booking_approved',
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
Total:      \${{total_cost}}

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

We'll send you pickup instructions and the lockbox code the day before your rental. If you'd like delivery to your location, reply to this message and we'll share pricing.

See you soon!
— Annie's Car Rental`,
    trigger_type: 'automated',
    description: 'Sent when the admin approves a booking request.',
    is_active: true,
  },
  {
    name: 'Booking Declined',
    stage: 'booking_declined',
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
    trigger_type: 'automated',
    description: 'Sent when the admin declines a booking request.',
    is_active: true,
  },
  {
    name: 'Booking Cancelled',
    stage: 'booking_cancelled',
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
    trigger_type: 'automated',
    description: 'Sent when a booking is cancelled.',
    is_active: true,
  },
  {
    name: 'Payment Confirmed',
    stage: 'payment_confirmed',
    channel: 'email',
    subject: 'Payment received — ${{amount}} for booking {{booking_code}}',
    body: `Hi {{first_name}},

We've received your payment. Here's your receipt:

PAYMENT RECEIPT
───────────────
Amount:     \${{amount}}
Method:     {{payment_method}}
Date:       {{payment_date}}
Booking:    {{booking_code}}

Questions about billing? Call us at (772) 834-0117.

Annie's Car Rental`,
    sms_body: null,
    trigger_type: 'automated',
    description: 'Sent automatically when a Stripe payment succeeds.',
    is_active: true,
  },
  {
    name: 'Pre-Pickup Reminder',
    stage: 'pickup_reminder',
    channel: 'both',
    subject: 'Pickup tomorrow: Your {{vehicle}} is ready — {{booking_code}}',
    body: `Hi {{first_name}},

Your rental starts tomorrow. Here's everything you need:

PICKUP DETAILS
──────────────
Date:       {{pickup_date}} at {{pickup_time}}
Vehicle:    {{vehicle}}
Reference:  {{booking_code}}

PICKUP LOCATION
586 NW Mercantile Pl
Port Saint Lucie, FL 34986
→ Park and walk to the back of the building.

HOW TO GET YOUR KEYS
1. Locate your vehicle in the back lot
2. Find the key lockbox attached to the window
3. Enter code: {{lockbox_code}}
4. Remove the lockbox from the window before driving

IMPORTANT REMINDERS
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

📍 586 NW Mercantile Pl, Port Saint Lucie, FL 34986
🔑 Lockbox code: {{lockbox_code}}
🅿️ The car will be parked in the back of the building.

When you arrive:
1. Go to the back of the building
2. Find the vehicle with the lockbox on the window
3. Enter code {{lockbox_code}} to retrieve the keys
4. Remove the lockbox from the window before driving

Fuel policy: Return the car with the same fuel level you receive it with.

Need help? Call Matthew at (772) 834-0117.

— Annie's Car Rental`,
    trigger_type: 'automated',
    description: 'Sent automatically 24 hours before the pickup date.',
    is_active: true,
  },
  {
    name: 'Day-of Pickup',
    stage: 'day_of_pickup',
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Good morning, {{first_name}}! Today's the day.

Your {{vehicle}} is waiting at:
586 NW Mercantile Pl, Port Saint Lucie, FL 34986
(Back of building)

Lockbox code: {{lockbox_code}}

Please text us once you've picked up the car. Have a great trip!

— Annie's Car Rental`,
    trigger_type: 'automated',
    description: 'Sent the morning of the pickup date.',
    is_active: true,
  },
  {
    name: 'Delivery Offer',
    stage: 'delivery_offer',
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Hi {{first_name}}, just a heads up — we offer vehicle delivery if you'd prefer not to pick up at our lot.

Delivery pricing:
• Port Saint Lucie / Fort Pierce — $35 each way
• Vero Beach / Stuart — $45 each way

We'll bring the {{vehicle}} right to you and pick it up when you're done. Reply YES if you'd like to set this up.

— Annie's Car Rental`,
    trigger_type: 'automated',
    description: 'Sent after booking approval if the customer chose self-pickup.',
    is_active: true,
  },
  {
    name: 'Mid-Rental Check-in',
    stage: 'mid_rental_checkin',
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Hi {{first_name}}, just checking in. How's everything going with the {{vehicle}}?

Your return is scheduled for {{return_date}}. If you'd like to extend your rental, let us know and we'll hold the car for you — no need to rebook.

Need anything? We're here:
Matthew: (772) 834-0117

— Annie's Car Rental`,
    trigger_type: 'automated',
    description: 'Sent on day 3 of rental for rentals of 5+ days.',
    is_active: true,
  },
  {
    name: 'Pre-Return Reminder',
    stage: 'return_reminder',
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
    trigger_type: 'automated',
    description: 'Sent automatically 24 hours before the return date.',
    is_active: true,
  },
  {
    name: 'Day-of Return',
    stage: 'day_of_return',
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Good morning, {{first_name}}. Your {{vehicle}} is due back today by {{return_time}}.

Quick return checklist:
✓ Same fuel level as pickup
✓ Park in back, near the dumpster
✓ Key back in the lockbox (code: {{lockbox_code}})
✓ Send us a photo of where you parked

Return address: 586 NW Mercantile Pl, Port Saint Lucie, FL 34986

Thank you for renting with Annie's!`,
    trigger_type: 'automated',
    description: 'Sent the morning of the return date.',
    is_active: true,
  },
  {
    name: 'Return Confirmed',
    stage: 'return_confirmed',
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Hi {{first_name}}, we've received the {{vehicle}} back and everything looks great. Thanks for taking care of it.

Thank you for choosing Annie's Car Rental. We hope to see you again!`,
    trigger_type: 'manual',
    description: 'Sent manually by admin after vehicle inspection.',
    is_active: true,
  },
  {
    name: 'Rental Completed',
    stage: 'rental_completed',
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
    trigger_type: 'automated',
    description: 'Sent 2 hours after the return is confirmed.',
    is_active: true,
  },
  {
    name: 'Late Return Warning',
    stage: 'late_return_warning',
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Hi {{first_name}}, we noticed your {{vehicle}} was due back at {{return_time}} today. If you're on your way, no worries — just let us know your ETA.

If you need to extend, reply to this message and we'll check availability.

Return address: 586 NW Mercantile Pl, Port Saint Lucie, FL 34986

— Annie's Car Rental
(772) 834-0117`,
    trigger_type: 'automated',
    description: 'Sent automatically 1 hour after the scheduled return time.',
    is_active: true,
  },
  {
    name: 'Late Return Escalation',
    stage: 'late_return_escalation',
    channel: 'both',
    subject: 'Urgent: Your rental return is overdue — {{booking_code}}',
    body: `{{first_name}},

Your rental was scheduled to end today at {{return_time}}. As of this message, the {{vehicle}} has not been returned and we have not been able to reach you.

OVERDUE RENTAL
──────────────
Booking:    {{booking_code}}
Vehicle:    {{vehicle}}
Due:        {{return_date}} at {{return_time}}
Status:     Overdue

WHAT TO DO
Please return the vehicle to our lot immediately:
586 NW Mercantile Pl, Port Saint Lucie, FL 34986

Or contact us right away:
  Matthew: (772) 834-0117
  Aaron:   (772) 985-6667

Late fees will apply for overdue rentals. If you're experiencing an emergency, please let us know and we'll work with you.

Annie's Car Rental`,
    sms_body: `{{first_name}}, your {{vehicle}} rental was scheduled to end at {{return_time}} today. We haven't heard from you and the vehicle has not been returned.

Please return the vehicle immediately or contact us at (772) 834-0117. Late fees may apply for unreturned vehicles.

— Annie's Car Rental`,
    trigger_type: 'automated',
    description: 'Sent automatically 4 hours after the scheduled return time.',
    is_active: true,
  },
  {
    name: 'Extension Offer',
    stage: 'extension_offer',
    channel: 'sms',
    subject: null,
    body: null,
    sms_body: `Hi {{first_name}}, your rental ends on {{return_date}}. If you're enjoying the {{vehicle}} and want to keep it longer, we can extend your reservation.

Just reply with how many extra days you need and we'll confirm pricing and availability. We can also swap you to a different vehicle if needed.

— Annie's Car Rental`,
    trigger_type: 'automated',
    description: 'Sent automatically 48 hours before the return date for rentals of 3+ days.',
    is_active: true,
  },
  {
    name: 'Damage Notification',
    stage: 'damage_notification',
    channel: 'email',
    subject: 'Vehicle inspection report — {{booking_code}}',
    body: `Hi {{first_name}},

Following the return of the {{vehicle}} on {{return_date}}, our inspection found the following:

INSPECTION FINDINGS
───────────────────
{{damage_description}}

ASSESSMENT
A fee of \${{damage_fee}} will be applied to cover {{damage_type}}.

Per our rental agreement, renters are responsible for damage occurring during the rental period. If you have rental insurance or would like to discuss this further, please contact us:

  Matthew: (772) 834-0117
  Email: info@anniescarrental.com

We're happy to provide additional photos or documentation for your insurance provider.

Annie's Car Rental
Port Saint Lucie, FL`,
    sms_body: null,
    trigger_type: 'manual',
    description: 'Sent manually by admin after vehicle inspection reveals damage.',
    is_active: true,
  },
  {
    name: 'Refund Processed',
    stage: 'refund_processed',
    channel: 'email',
    subject: 'Refund processed — ${{refund_amount}} for booking {{booking_code}}',
    body: `Hi {{first_name}},

A refund has been processed for your rental:

REFUND DETAILS
──────────────
Amount:     \${{refund_amount}}
Method:     Original payment method
Booking:    {{booking_code}}
Expected:   3–5 business days

If you don't see the refund within 5 business days, please contact us at (772) 834-0117.

Annie's Car Rental`,
    sms_body: null,
    trigger_type: 'automated',
    description: 'Sent automatically when a Stripe refund is processed.',
    is_active: true,
  },
  {
    name: 'Repeat Customer',
    stage: 'repeat_customer',
    channel: 'email',
    subject: '{{first_name}}, your next rental is 5% off',
    body: `Hi {{first_name}},

It's been a month since your last trip with us, and we wanted to say thanks for being an Annie's Car Rental customer.

YOUR RETURN DISCOUNT
As a returning guest, enjoy 5% off your next rental. Just mention this email when you book.

What's available:
→ View our current fleet at anniescarrental.com

We're always adding new vehicles and improving the experience. If you need a car for your next trip — whether it's a weekend getaway or a longer stay — we'd love to have you back.

Annie's Car Rental
Port Saint Lucie, FL
(772) 834-0117`,
    sms_body: null,
    trigger_type: 'automated',
    description: 'Sent automatically 30 days after rental completion.',
    is_active: true,
  },
];

async function seed() {
  console.log('Adding columns if they don\'t exist...');
  
  // First check if columns exist by attempting a query
  const { data: testRow, error: testErr } = await supabase
    .from('email_templates')
    .select('*')
    .limit(1);
  
  const existingCols = testRow?.[0] ? Object.keys(testRow[0]) : [];
  console.log('Existing columns:', existingCols.join(', '));
  
  // If channel column doesn't exist, we need to add it via SQL
  if (!existingCols.includes('channel')) {
    console.log('Need to add new columns. Running via RPC...');
    // Use rpc to run raw SQL
    const { error: rpcErr } = await supabase.rpc('exec_sql', {
      query: `
        ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS channel VARCHAR(10) DEFAULT 'email';
        ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS sms_body TEXT;
        ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS trigger_type VARCHAR(20) DEFAULT 'automated';
        ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS description TEXT;
      `
    });
    if (rpcErr) {
      console.log('RPC not available, adding columns via direct insert with defaults...');
      // Columns might already exist, try to insert anyway
    }
  }

  // Clear existing templates
  console.log('Clearing existing templates...');
  const { error: delErr } = await supabase.from('email_templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delErr) console.error('Delete error:', delErr.message);

  // Insert all templates
  console.log(`Inserting ${templates.length} templates...`);
  
  for (const t of templates) {
    const row = {
      name: t.name,
      stage: t.stage,
      subject: t.subject || '',
      body: t.body || '',
      is_active: t.is_active,
    };
    
    // Only add columns that exist
    if (existingCols.includes('channel') || !existingCols.length) {
      row.channel = t.channel;
      row.sms_body = t.sms_body;
      row.trigger_type = t.trigger_type;
      row.description = t.description;
    }

    const { error } = await supabase.from('email_templates').insert(row);
    if (error) {
      console.error(`  ✗ ${t.name}: ${error.message}`);
      
      // If column doesn't exist error, try without extra columns
      if (error.message.includes('column')) {
        const fallback = {
          name: t.name,
          stage: t.stage,
          subject: t.subject || '',
          body: t.body || t.sms_body || '',
          is_active: t.is_active,
        };
        const { error: fbErr } = await supabase.from('email_templates').insert(fallback);
        if (fbErr) console.error(`  ✗✗ Fallback failed: ${fbErr.message}`);
        else console.log(`  ✓ ${t.name} (fallback — body only)`);
      }
    } else {
      console.log(`  ✓ ${t.name}`);
    }
  }

  // Verify count
  const { count } = await supabase.from('email_templates').select('*', { count: 'exact', head: true });
  console.log(`\nDone! ${count} templates in database.`);
}

seed().catch(console.error);
