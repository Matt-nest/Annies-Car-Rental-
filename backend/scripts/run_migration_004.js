/**
 * Run Migration 004: Update 4 email templates with vehicle transparency blocks.
 * Uses the Supabase JS client to update each template body directly.
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ── Template bodies ────────────────────────────────────────

const templates = {
  booking_approved: `Hi {{first_name}},

Your booking has been approved. Here's your confirmation:

RESERVATION CONFIRMED ✓
───────────────────────
Reference:  {{booking_code}}
Vehicle:    {{vehicle}}
Pickup:     {{pickup_date}} at {{pickup_time}}
Return:     {{return_date}} at {{return_time}}
Duration:   {{rental_days}} days
Total:      \${{total_cost}}

{{#if vehicle_year_make_model}}YOUR VEHICLE
───────────────────────
{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:400px;border-radius:12px;margin-bottom:12px;" />
{{/if}}{{vehicle_year_make_model}}{{#if vehicle_color}}
Color: {{vehicle_color}}{{/if}}{{#if vehicle_plate}}
Plate: {{vehicle_plate}}{{/if}}{{#if vehicle_vin}}
VIN:   {{vehicle_vin}}{{/if}}
{{/if}}
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

  payment_confirmed: `Hi {{first_name}},

We've received your payment. Here's your receipt:

PAYMENT RECEIPT
───────────────
Amount:     \${{amount}}
Method:     {{payment_method}}
Date:       {{payment_date}}
Booking:    {{booking_code}}

{{#if vehicle_year_make_model}}YOUR VEHICLE
───────────────
{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:400px;border-radius:12px;margin-bottom:12px;" />
{{/if}}{{vehicle_year_make_model}}{{#if vehicle_color}}
Color: {{vehicle_color}}{{/if}}{{#if vehicle_plate}}
Plate: {{vehicle_plate}}{{/if}}
{{/if}}
Questions about billing? Call us at (772) 834-0117.

Annie's Car Rental`,

  ready_for_pickup: `Hi {{first_name}},

Your vehicle is prepped, cleaned, and ready for you.

PICKUP DETAILS
──────────────
Vehicle:    {{vehicle}}
Reference:  {{booking_code}}
Pickup:     {{pickup_date}} at {{pickup_time}}

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
HOW TO PICK UP YOUR VEHICLE

1. Go to 586 NW Mercantile Pl, Port Saint Lucie, FL 34986
2. Head to the back of the building
3. Find your vehicle — the key is in the lockbox on the window
4. Enter code {{lockbox_code}} to retrieve the key
5. Remove the lockbox from the window before driving

SELF-SERVICE CHECK-IN
Once you have the key, complete your check-in through your Rental Portal:
→ {{status_link}}

IMPORTANT REMINDERS
• Return the vehicle with the same fuel level
• No smoking — $150 cleaning fee
• No pets — $150 cleaning fee

Questions? Call or text us at (772) 985-6667.

Annie's Car Rental
Port Saint Lucie, FL`,

  pickup_reminder: `Hi {{first_name}},

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
};

// ── Execute ────────────────────────────────────────────────

async function runMigration() {
  const stages = Object.keys(templates);
  console.log(`Updating ${stages.length} email templates...\n`);

  for (const stage of stages) {
    const { data, error } = await supabase
      .from('email_templates')
      .update({ body: templates[stage] })
      .eq('stage', stage)
      .select('id, stage, name');

    if (error) {
      console.error(`✗ ${stage}: ${error.message}`);
    } else if (!data || data.length === 0) {
      console.error(`✗ ${stage}: No matching row found`);
    } else {
      console.log(`✓ ${stage} → ${data[0].name} (${data[0].id})`);
    }
  }

  // Final verification
  console.log('\n── Verification ──');
  const { data: all } = await supabase
    .from('email_templates')
    .select('stage, name, body')
    .in('stage', stages);

  for (const t of all || []) {
    const hasVehicleBlock = t.body.includes('{{#if vehicle_year_make_model}}');
    const hasHandoff = t.body.includes('{{#if handoff_fuel_level}}');
    console.log(`  ${t.stage}: vehicle_block=${hasVehicleBlock}, handoff=${hasHandoff}, body_length=${t.body.length}`);
  }

  console.log('\nDone.');
}

runMigration().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
