-- Migration: Add email templates for rental operations stages
-- Run after seed_templates.sql and migration 002_rental_operations.sql

-- 1. Ready for Pickup — Vehicle prepped, lockbox set, customer can self-check-in
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Ready for Pickup',
  'ready_for_pickup',
  'both',
  'Your {{vehicle}} is ready — {{booking_code}}',
  E'Hi {{first_name}},\n\nYour vehicle is prepped, cleaned, and ready for you.\n\nPICKUP DETAILS\n──────────────\nVehicle:    {{vehicle}}\nReference:  {{booking_code}}\nPickup:     {{pickup_date}} at {{pickup_time}}\n\nHOW TO PICK UP YOUR VEHICLE\n\n1. Go to 586 NW Mercantile Pl, Port Saint Lucie, FL 34986\n2. Head to the back of the building\n3. Find your vehicle — the key is in the lockbox on the window\n4. Enter code {{lockbox_code}} to retrieve the key\n5. Remove the lockbox from the window before driving\n\nSELF-SERVICE CHECK-IN\nOnce you have the key, complete your check-in through your Rental Portal:\n→ {{status_link}}\n\nIMPORTANT REMINDERS\n• Return the vehicle with the same fuel level\n• No smoking — $150 cleaning fee\n• No pets — $150 cleaning fee\n\nQuestions? Call or text us at (772) 985-6667.\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  E'Hi {{first_name}}, your {{vehicle}} is ready for pickup.\n\n📍 586 NW Mercantile Pl, Port Saint Lucie, FL 34986 (back of building)\n🔑 Lockbox code: {{lockbox_code}}\n\nComplete your check-in here: {{status_link}}\n\nHave a great trip!\n— Annie''s Car Rental',
  'automated',
  'Sent when admin marks a vehicle as ready for pickup.'
)
ON CONFLICT (stage) DO UPDATE SET
  name = EXCLUDED.name,
  channel = EXCLUDED.channel,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  sms_body = EXCLUDED.sms_body,
  trigger_type = EXCLUDED.trigger_type,
  description = EXCLUDED.description;

-- 2. Inspection Complete — Post-return inspection done, settlement pending
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Inspection Complete',
  'inspection_complete',
  'email',
  'Vehicle inspection complete — {{booking_code}}',
  E'Hi {{first_name}},\n\nWe''ve completed the post-return inspection of the {{vehicle}}.\n\nINSPECTION SUMMARY\n──────────────────\nBooking:    {{booking_code}}\nVehicle:    {{vehicle}}\nMileage:    {{total_miles}} miles driven\n\nYour security deposit of ${{deposit_amount}} is being processed. You''ll receive a separate notification once the settlement is finalized.\n\nIf you have questions about the inspection, call us at (772) 985-6667 or reply to this email.\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  NULL,
  'automated',
  'Sent when the admin completes the post-return vehicle inspection.'
)
ON CONFLICT (stage) DO UPDATE SET
  name = EXCLUDED.name,
  channel = EXCLUDED.channel,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  sms_body = EXCLUDED.sms_body,
  trigger_type = EXCLUDED.trigger_type,
  description = EXCLUDED.description;

-- 3. Invoice Sent — Itemized invoice for the customer
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Invoice Sent',
  'invoice_sent',
  'email',
  'Your rental invoice — {{booking_code}}',
  E'Hi {{first_name}},\n\nHere is your final invoice for booking {{booking_code}}.\n\nINVOICE TOTAL: ${{invoice_total}}\n\nYou can view the full breakdown and download your invoice through your Rental Portal:\n→ {{status_link}}\n\nIf you believe any charge is incorrect, you can submit a dispute directly through the portal. We''ll review it within 24 hours.\n\nQuestions? Call us at (772) 985-6667.\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  NULL,
  'automated',
  'Sent when an invoice is generated for a completed rental.'
)
ON CONFLICT (stage) DO UPDATE SET
  name = EXCLUDED.name,
  channel = EXCLUDED.channel,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  sms_body = EXCLUDED.sms_body,
  trigger_type = EXCLUDED.trigger_type,
  description = EXCLUDED.description;

-- 4. Deposit Refunded — Full deposit returned, no incidentals
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Deposit Refunded',
  'deposit_refunded',
  'both',
  'Your ${{deposit_amount}} deposit has been refunded — {{booking_code}}',
  E'Hi {{first_name}},\n\nGreat news — your security deposit has been fully refunded.\n\nREFUND DETAILS\n──────────────\nAmount:     ${{deposit_amount}}\nMethod:     Original payment method\nBooking:    {{booking_code}}\nExpected:   3–5 business days\n\nThank you for taking great care of the {{vehicle}}. We appreciate you choosing Annie''s Car Rental and hope to see you again.\n\nLeave a review: {{review_link}}\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  E'Hi {{first_name}}, your ${{deposit_amount}} security deposit has been fully refunded. It should appear on your statement within 3–5 business days.\n\nThank you for choosing Annie''s Car Rental!\n\n— Annie''s Car Rental',
  'automated',
  'Sent when the admin refunds the full security deposit after a clean inspection.'
)
ON CONFLICT (stage) DO UPDATE SET
  name = EXCLUDED.name,
  channel = EXCLUDED.channel,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  sms_body = EXCLUDED.sms_body,
  trigger_type = EXCLUDED.trigger_type,
  description = EXCLUDED.description;

-- 5. Deposit Settled — Deposit partially or fully applied to incidentals
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Deposit Settled',
  'deposit_settled',
  'email',
  'Deposit settlement — {{booking_code}}',
  E'Hi {{first_name}},\n\nFollowing the inspection of the {{vehicle}}, incidental charges were applied to your rental. Your security deposit has been used to cover these charges.\n\nSETTLEMENT SUMMARY\n──────────────────\nDeposit held:       ${{deposit_amount}}\nIncidentals:        ${{incidental_total}}\nRefund (if any):    ${{refund_amount}}\n\nYou can view the full breakdown in your Rental Portal:\n→ {{status_link}}\n\nIf you disagree with any charge, submit a dispute through the portal and we''ll review it within 24 hours.\n\nQuestions? Call us at (772) 985-6667.\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  NULL,
  'automated',
  'Sent when the deposit is settled against incidental charges.'
)
ON CONFLICT (stage) DO UPDATE SET
  name = EXCLUDED.name,
  channel = EXCLUDED.channel,
  subject = EXCLUDED.subject,
  body = EXCLUDED.body,
  sms_body = EXCLUDED.sms_body,
  trigger_type = EXCLUDED.trigger_type,
  description = EXCLUDED.description;

SELECT 'Rental operations templates seeded' AS result;
