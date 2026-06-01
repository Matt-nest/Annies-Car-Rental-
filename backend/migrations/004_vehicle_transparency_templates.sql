-- Migration 004: Add "Your Vehicle" block to 4 email templates
-- Uses {{#if key}}...{{/if}} conditional blocks (added to template engine)
--
-- Templates updated:
--   1. booking_approved   — vehicle details only (no handoff data at this stage)
--   2. payment_confirmed  — vehicle details only
--   3. ready_for_pickup   — vehicle details + handoff condition (fuel, odometer, photos)
--   4. pickup_reminder    — vehicle details + handoff condition
--
-- Edge cases handled:
--   - No vehicle_photo_url → image row hidden, text block preserved
--   - No plate/color → those lines omitted
--   - ready_for_pickup with handoff = null → handoff section hidden gracefully


-- ═══════════════════════════════════════════════════════════════
-- 1. BOOKING APPROVED
-- ═══════════════════════════════════════════════════════════════
UPDATE email_templates SET body = E'Hi {{first_name}},\n\nYour booking has been approved. Here''s your confirmation:\n\nRESERVATION CONFIRMED ✓\n───────────────────────\nReference:  {{booking_code}}\nVehicle:    {{vehicle}}\nPickup:     {{pickup_date}} at {{pickup_time}}\nReturn:     {{return_date}} at {{return_time}}\nDuration:   {{rental_days}} days\nTotal:      ${{total_cost}}\n\n{{#if vehicle_year_make_model}}YOUR VEHICLE\n───────────────────────\n{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:400px;border-radius:12px;margin-bottom:12px;" />\n{{/if}}{{vehicle_year_make_model}}{{#if vehicle_color}}\nColor: {{vehicle_color}}{{/if}}{{#if vehicle_plate}}\nPlate: {{vehicle_plate}}{{/if}}{{#if vehicle_vin}}\nVIN:   {{vehicle_vin}}{{/if}}\n{{/if}}\nWHAT TO EXPECT\n• 24 hours before pickup — You''ll receive a text with the exact address, lockbox code, and parking location.\n• Day of pickup — A final reminder with directions.\n• During your rental — We''re a text or call away if you need anything.\n\nDELIVERY OPTION\nDon''t want to come to us? We offer delivery and pickup:\n• Port Saint Lucie / Fort Pierce — $35 each way\n• Vero Beach / Stuart — $45 each way\nReply to this email or text us to arrange delivery.\n\nQuestions? We''re here:\n  Matthew: (772) 834-0117\n  Robin:   (772) 834-7637\n\nAnnie''s Car Rental\nPort Saint Lucie, FL'
WHERE stage = 'booking_approved';


-- ═══════════════════════════════════════════════════════════════
-- 2. PAYMENT CONFIRMED
-- ═══════════════════════════════════════════════════════════════
UPDATE email_templates SET body = E'Hi {{first_name}},\n\nWe''ve received your payment. Here''s your receipt:\n\nPAYMENT RECEIPT\n───────────────\nAmount:     ${{amount}}\nMethod:     {{payment_method}}\nDate:       {{payment_date}}\nBooking:    {{booking_code}}\n\n{{#if vehicle_year_make_model}}YOUR VEHICLE\n───────────────\n{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:400px;border-radius:12px;margin-bottom:12px;" />\n{{/if}}{{vehicle_year_make_model}}{{#if vehicle_color}}\nColor: {{vehicle_color}}{{/if}}{{#if vehicle_plate}}\nPlate: {{vehicle_plate}}{{/if}}\n{{/if}}\nQuestions about billing? Call us at (772) 834-0117.\n\nAnnie''s Car Rental'
WHERE stage = 'payment_confirmed';


-- ═══════════════════════════════════════════════════════════════
-- 3. READY FOR PICKUP — includes handoff condition data
-- ═══════════════════════════════════════════════════════════════
UPDATE email_templates SET body = E'Hi {{first_name}},\n\nYour vehicle is prepped, cleaned, and ready for you.\n\nPICKUP DETAILS\n──────────────\nVehicle:    {{vehicle}}\nReference:  {{booking_code}}\nPickup:     {{pickup_date}} at {{pickup_time}}\n\n{{#if vehicle_year_make_model}}YOUR VEHICLE\n──────────────\n{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:400px;border-radius:12px;margin-bottom:12px;" />\n{{/if}}{{vehicle_year_make_model}}{{#if vehicle_color}}\nColor: {{vehicle_color}}{{/if}}{{#if vehicle_plate}}\nPlate: {{vehicle_plate}}{{/if}}{{#if vehicle_vin}}\nVIN:   {{vehicle_vin}}{{/if}}\n{{/if}}\n{{#if handoff_fuel_level}}VEHICLE CONDITION AT HANDOFF\n──────────────────────────\nFuel Level:  {{handoff_fuel_level}}\n{{#if handoff_odometer}}Odometer:    {{handoff_odometer}} mi{{/if}}\n{{#if handoff_photos}}\nInspection Photos:\n{{handoff_photos}}{{/if}}\n{{/if}}\nHOW TO PICK UP YOUR VEHICLE\n\n1. Go to 586 NW Mercantile Pl, Port Saint Lucie, FL 34986\n2. Head to the back of the building\n3. Find your vehicle — the key is in the lockbox on the window\n4. Enter code {{lockbox_code}} to retrieve the key\n5. Remove the lockbox from the window before driving\n\nSELF-SERVICE CHECK-IN\nOnce you have the key, complete your check-in through your Rental Portal:\n→ {{status_link}}\n\nIMPORTANT REMINDERS\n• Return the vehicle with the same fuel level\n• No smoking — $150 cleaning fee\n• No pets — $150 cleaning fee\n\nQuestions? Call or text us at (772) 985-6667.\n\nAnnie''s Car Rental\nPort Saint Lucie, FL'
WHERE stage = 'ready_for_pickup';


-- ═══════════════════════════════════════════════════════════════
-- 4. PICKUP REMINDER — includes handoff condition data
-- ═══════════════════════════════════════════════════════════════
UPDATE email_templates SET body = E'Hi {{first_name}},\n\nYour rental starts tomorrow. Here''s everything you need:\n\nPICKUP DETAILS\n──────────────\nDate:       {{pickup_date}} at {{pickup_time}}\nVehicle:    {{vehicle}}\nReference:  {{booking_code}}\n\n{{#if vehicle_year_make_model}}YOUR VEHICLE\n──────────────\n{{#if vehicle_photo_url}}<img src="{{vehicle_photo_url}}" alt="{{vehicle_year_make_model}}" style="width:100%;max-width:400px;border-radius:12px;margin-bottom:12px;" />\n{{/if}}{{vehicle_year_make_model}}{{#if vehicle_color}}\nColor: {{vehicle_color}}{{/if}}{{#if vehicle_plate}}\nPlate: {{vehicle_plate}}{{/if}}{{#if vehicle_vin}}\nVIN:   {{vehicle_vin}}{{/if}}\n{{/if}}\n{{#if handoff_fuel_level}}VEHICLE CONDITION AT HANDOFF\n──────────────────────────\nFuel Level:  {{handoff_fuel_level}}\n{{#if handoff_odometer}}Odometer:    {{handoff_odometer}} mi{{/if}}\n{{#if handoff_photos}}\nInspection Photos:\n{{handoff_photos}}{{/if}}\n{{/if}}\nPICKUP LOCATION\n586 NW Mercantile Pl\nPort Saint Lucie, FL 34986\n→ Park and walk to the back of the building.\n\nHOW TO GET YOUR KEYS\n1. Locate your vehicle in the back lot\n2. Find the key lockbox attached to the window\n3. Enter code: {{lockbox_code}}\n4. Remove the lockbox from the window before driving\n\nIMPORTANT REMINDERS\n• Fuel — Return the vehicle with the same fuel level you receive it with.\n• No smoking — Vehicles are smoke-free. A $150 cleaning fee applies.\n• No pets — A $150 cleaning fee applies.\n• Text us when you arrive so we know you''re all set.\n\nCONTACT\n  Matthew: (772) 834-0117\n  Robin:   (772) 834-7637\n  Aaron:   (772) 985-6667\n\nAnnie''s Car Rental\nPort Saint Lucie, FL'
WHERE stage = 'pickup_reminder';


-- Verification
SELECT stage, LENGTH(body) as body_length FROM email_templates
WHERE stage IN ('booking_approved', 'payment_confirmed', 'ready_for_pickup', 'pickup_reminder');
