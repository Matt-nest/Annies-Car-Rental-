-- Seed: All 18 Annie's Car Rental message templates
-- Run after migration 007

-- Clear existing templates
DELETE FROM email_templates;

-- 1. Booking Submitted
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Booking Submitted',
  'booking_submitted',
  'both',
  'Your booking request has been received — {{booking_code}}',
  E'Hi {{first_name}},\n\nThank you for choosing Annie''s Car Rental. We''ve received your booking request and it''s being reviewed now.\n\nBOOKING DETAILS\n───────────────\nReference:  {{booking_code}}\nVehicle:    {{vehicle}}\nPickup:     {{pickup_date}} at {{pickup_time}}\nReturn:     {{return_date}} at {{return_time}}\nDuration:   {{rental_days}} days\nTotal:      ${{total_cost}}\n\nWHAT HAPPENS NEXT\nYou''ll receive a confirmation message once your booking is approved — typically within a few hours. If we need any additional information, we''ll reach out directly.\n\nIf you have questions in the meantime, we''re here to help:\n  Matthew: (772) 834-0117\n  Robin:   (772) 834-7637\n  Aaron:   (772) 985-6667\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  E'Hi {{first_name}}, thanks for your booking request with Annie''s Car Rental.\n\nBooking: {{booking_code}}\nVehicle: {{vehicle}}\nDates: {{pickup_date}} – {{return_date}}\n\nWe''re reviewing your request and will confirm within a few hours. We''ll text you as soon as it''s approved.\n\nQuestions? Call us at (772) 834-0117.',
  'automated',
  'Sent immediately when a customer submits a booking request.'
);

-- 2. Booking Approved
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Booking Approved',
  'booking_approved',
  'both',
  'Confirmed: Your {{vehicle}} is reserved — {{booking_code}}',
  E'Hi {{first_name}},\n\nYour booking has been approved. Here''s your confirmation:\n\nRESERVATION CONFIRMED ✓\n───────────────────────\nReference:  {{booking_code}}\nVehicle:    {{vehicle}}\nPickup:     {{pickup_date}} at {{pickup_time}}\nReturn:     {{return_date}} at {{return_time}}\nDuration:   {{rental_days}} days\nTotal:      ${{total_cost}}\n\nWHAT TO EXPECT\n• 24 hours before pickup — You''ll receive a text with the exact address, lockbox code, and parking location.\n• Day of pickup — A final reminder with directions.\n• During your rental — We''re a text or call away if you need anything.\n\nDELIVERY OPTION\nDon''t want to come to us? We offer delivery and pickup:\n• Port Saint Lucie / Fort Pierce — $35 each way\n• Vero Beach / Stuart — $45 each way\nReply to this email or text us to arrange delivery.\n\nQuestions? We''re here:\n  Matthew: (772) 834-0117\n  Robin:   (772) 834-7637\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  E'Great news, {{first_name}} — your booking is confirmed!\n\n{{vehicle}}\nPickup: {{pickup_date}} at {{pickup_time}}\nRef: {{booking_code}}\n\nWe''ll send you pickup instructions and the lockbox code the day before your rental. If you''d like delivery to your location, reply to this message and we''ll share pricing.\n\nSee you soon!\n— Annie''s Car Rental',
  'automated',
  'Sent when the admin approves a booking request.'
);

-- 3. Booking Declined
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Booking Declined',
  'booking_declined',
  'both',
  'Update on your booking request — {{booking_code}}',
  E'Hi {{first_name}},\n\nWe''re sorry to let you know that we''re unable to confirm your booking at this time.\n\nBOOKING DETAILS\n───────────────\nReference:  {{booking_code}}\nVehicle:    {{vehicle}}\nDates:      {{pickup_date}} – {{return_date}}\n\nREASON\n{{decline_reason}}\n\nWHAT YOU CAN DO\nWe may have other vehicles available for your dates. Please give us a call and we''ll help find something that works:\n\n  Matthew: (772) 834-0117\n  Robin:   (772) 834-7637\n\nWe appreciate your interest and hope to serve you soon.\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  E'Hi {{first_name}}, unfortunately we''re unable to confirm your booking for the {{vehicle}} ({{pickup_date}} – {{return_date}}).\n\n{{decline_reason}}\n\nWe''d love to help you find an alternative. Give us a call at (772) 834-0117.\n\n— Annie''s Car Rental',
  'automated',
  'Sent when the admin declines a booking request.'
);

-- 4. Payment Confirmed
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Payment Confirmed',
  'payment_confirmed',
  'email',
  'Payment received — ${{amount}} for booking {{booking_code}}',
  E'Hi {{first_name}},\n\nWe''ve received your payment. Here''s your receipt:\n\nPAYMENT RECEIPT\n───────────────\nAmount:     ${{amount}}\nMethod:     {{payment_method}}\nDate:       {{payment_date}}\nBooking:    {{booking_code}}\n\nQuestions about billing? Call us at (772) 834-0117.\n\nAnnie''s Car Rental',
  NULL,
  'automated',
  'Sent automatically when a Stripe payment succeeds.'
);

-- 5. Pre-Pickup Reminder (24h)
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Pre-Pickup Reminder',
  'pickup_reminder',
  'both',
  'Pickup tomorrow: Your {{vehicle}} is ready — {{booking_code}}',
  E'Hi {{first_name}},\n\nYour rental starts tomorrow. Here''s everything you need:\n\nPICKUP DETAILS\n──────────────\nDate:       {{pickup_date}} at {{pickup_time}}\nVehicle:    {{vehicle}}\nReference:  {{booking_code}}\n\nPICKUP LOCATION\n586 NW Mercantile Pl\nPort Saint Lucie, FL 34986\n→ Park and walk to the back of the building.\n\nHOW TO GET YOUR KEYS\n1. Locate your vehicle in the back lot\n2. Find the key lockbox attached to the window\n3. Enter code: {{lockbox_code}}\n4. Remove the lockbox from the window before driving\n\nIMPORTANT REMINDERS\n• Fuel — Return the vehicle with the same fuel level you receive it with.\n• No smoking — Vehicles are smoke-free. A $150 cleaning fee applies.\n• No pets — A $150 cleaning fee applies.\n• Text us when you arrive so we know you''re all set.\n\nCONTACT\n  Matthew: (772) 834-0117\n  Robin:   (772) 834-7637\n  Aaron:   (772) 985-6667\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  E'Hi {{first_name}}, your {{vehicle}} is ready for pickup tomorrow.\n\n📍 586 NW Mercantile Pl, Port Saint Lucie, FL 34986\n🔑 Lockbox code: {{lockbox_code}}\n🅿️ The car will be parked in the back of the building.\n\nWhen you arrive:\n1. Go to the back of the building\n2. Find the vehicle with the lockbox on the window\n3. Enter code {{lockbox_code}} to retrieve the keys\n4. Remove the lockbox from the window before driving\n\nFuel policy: Return the car with the same fuel level you receive it with.\n\nNeed help? Call Matthew at (772) 834-0117.\n\n— Annie''s Car Rental',
  'automated',
  'Sent automatically 24 hours before the pickup date.'
);

-- 6. Day-of Pickup
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Day-of Pickup',
  'day_of_pickup',
  'sms',
  NULL,
  NULL,
  E'Good morning, {{first_name}}! Today''s the day.\n\nYour {{vehicle}} is waiting at:\n586 NW Mercantile Pl, Port Saint Lucie, FL 34986\n(Back of building)\n\nLockbox code: {{lockbox_code}}\n\nPlease text us once you''ve picked up the car. Have a great trip!\n\n— Annie''s Car Rental',
  'automated',
  'Sent the morning of the pickup date.'
);

-- 7. Delivery Offer
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Delivery Offer',
  'delivery_offer',
  'sms',
  NULL,
  NULL,
  E'Hi {{first_name}}, just a heads up — we offer vehicle delivery if you''d prefer not to pick up at our lot.\n\nDelivery pricing:\n• Port Saint Lucie / Fort Pierce — $35 each way\n• Vero Beach / Stuart — $45 each way\n\nWe''ll bring the {{vehicle}} right to you and pick it up when you''re done. Reply YES if you''d like to set this up.\n\n— Annie''s Car Rental',
  'automated',
  'Sent after booking approval if the customer chose self-pickup.'
);

-- 8. Mid-Rental Check-in
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Mid-Rental Check-in',
  'mid_rental_checkin',
  'sms',
  NULL,
  NULL,
  E'Hi {{first_name}}, just checking in. How''s everything going with the {{vehicle}}?\n\nYour return is scheduled for {{return_date}}. If you''d like to extend your rental, let us know and we''ll hold the car for you — no need to rebook.\n\nNeed anything? We''re here:\nMatthew: (772) 834-0117\n\n— Annie''s Car Rental',
  'automated',
  'Sent on day 3 of rental for rentals of 5+ days.'
);

-- 9. Pre-Return Reminder (24h)
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Pre-Return Reminder',
  'return_reminder',
  'both',
  'Return reminder: {{vehicle}} due back {{return_date}}',
  E'Hi {{first_name}},\n\nYour rental is almost over. Here are the details for a smooth return:\n\nRETURN DETAILS\n──────────────\nDate:     {{return_date}} at {{return_time}}\nVehicle:  {{vehicle}}\nRef:      {{booking_code}}\n\nRETURN LOCATION\n586 NW Mercantile Pl\nPort Saint Lucie, FL 34986\n\nRETURN CHECKLIST\n☐ Fill fuel to the same level you received the car with\n☐ Park in the back of the building, near the dumpster\n☐ Place the key back in the lockbox (code: {{lockbox_code}})\n☐ Take a photo of where you parked and send it to us\n\nWANT TO EXTEND?\nIf your plans have changed, we can often extend your rental or swap you into another vehicle. Just reply to this email or text us.\n\nCONTACT\n  Matthew: (772) 834-0117\n  Robin:   (772) 834-7637\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  E'Hi {{first_name}}, a reminder that your {{vehicle}} is due back tomorrow.\n\nReturn by: {{return_date}} at {{return_time}}\n\n📍 586 NW Mercantile Pl, Port Saint Lucie, FL 34986\n\nPlease remember:\n• Return with the same fuel level\n• Park in the back, near the dumpster\n• Place the key back in the lockbox (code: {{lockbox_code}})\n• Take a photo of where you parked\n\nWant to extend? Reply to this message and we''ll check availability.\n\n— Annie''s Car Rental',
  'automated',
  'Sent automatically 24 hours before the return date.'
);

-- 10. Day-of Return
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Day-of Return',
  'day_of_return',
  'sms',
  NULL,
  NULL,
  E'Good morning, {{first_name}}. Your {{vehicle}} is due back today by {{return_time}}.\n\nQuick return checklist:\n✓ Same fuel level as pickup\n✓ Park in back, near the dumpster\n✓ Key back in the lockbox (code: {{lockbox_code}})\n✓ Send us a photo of where you parked\n\nReturn address: 586 NW Mercantile Pl, Port Saint Lucie, FL 34986\n\nThank you for renting with Annie''s!',
  'automated',
  'Sent the morning of the return date.'
);

-- 11. Return Confirmed
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Return Confirmed',
  'return_confirmed',
  'sms',
  NULL,
  NULL,
  E'Hi {{first_name}}, we''ve received the {{vehicle}} back and everything looks great. Thanks for taking care of it.\n\nThank you for choosing Annie''s Car Rental. We hope to see you again!',
  'manual',
  'Sent manually by admin after vehicle inspection.'
);

-- 12. Rental Completed / Review Request
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Rental Completed',
  'rental_completed',
  'both',
  'How was your rental, {{first_name}}?',
  E'Hi {{first_name}},\n\nThank you for renting with Annie''s Car Rental. We hope the {{vehicle}} made your trip a little easier.\n\nWe''re a small, family-run business in Port Saint Lucie, and your feedback helps us grow. If you have a moment, we''d love to hear how it went.\n\n→ Leave a review: {{review_link}}\n\nAS A THANK YOU\nEvery guest who leaves a review receives 5% off their next rental. Just mention your review when you book and we''ll apply the discount.\n\nWe''d love to have you back.\n\nAnnie''s Car Rental\nPort Saint Lucie, FL\n(772) 834-0117',
  E'Hi {{first_name}}, we hope you enjoyed your {{vehicle}}.\n\nIf you have a moment, a review would mean a lot to our small business. As a thank you, we''ll give you 5% off your next rental.\n\nLeave a review: {{review_link}}\n\n— Annie''s Car Rental',
  'automated',
  'Sent 2 hours after the return is confirmed.'
);

-- 13. Late Return Warning (1h)
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Late Return Warning',
  'late_return_warning',
  'sms',
  NULL,
  NULL,
  E'Hi {{first_name}}, we noticed your {{vehicle}} was due back at {{return_time}} today. If you''re on your way, no worries — just let us know your ETA.\n\nIf you need to extend, reply to this message and we''ll check availability.\n\nReturn address: 586 NW Mercantile Pl, Port Saint Lucie, FL 34986\n\n— Annie''s Car Rental\n(772) 834-0117',
  'automated',
  'Sent automatically 1 hour after the scheduled return time.'
);

-- 14. Late Return Escalation (4h)
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Late Return Escalation',
  'late_return_escalation',
  'both',
  'Urgent: Your rental return is overdue — {{booking_code}}',
  E'{{first_name}},\n\nYour rental was scheduled to end today at {{return_time}}. As of this message, the {{vehicle}} has not been returned and we have not been able to reach you.\n\nOVERDUE RENTAL\n──────────────\nBooking:    {{booking_code}}\nVehicle:    {{vehicle}}\nDue:        {{return_date}} at {{return_time}}\nStatus:     Overdue\n\nWHAT TO DO\nPlease return the vehicle to our lot immediately:\n586 NW Mercantile Pl, Port Saint Lucie, FL 34986\n\nOr contact us right away:\n  Matthew: (772) 834-0117\n  Aaron:   (772) 985-6667\n\nLate fees will apply for overdue rentals. If you''re experiencing an emergency, please let us know and we''ll work with you.\n\nAnnie''s Car Rental',
  E'{{first_name}}, your {{vehicle}} rental was scheduled to end at {{return_time}} today. We haven''t heard from you and the vehicle has not been returned.\n\nPlease return the vehicle immediately or contact us at (772) 834-0117. Late fees may apply for unreturned vehicles.\n\n— Annie''s Car Rental',
  'automated',
  'Sent automatically 4 hours after the scheduled return time.'
);

-- 15. Extension Offer
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Extension Offer',
  'extension_offer',
  'sms',
  NULL,
  NULL,
  E'Hi {{first_name}}, your rental ends on {{return_date}}. If you''re enjoying the {{vehicle}} and want to keep it longer, we can extend your reservation.\n\nJust reply with how many extra days you need and we''ll confirm pricing and availability. We can also swap you to a different vehicle if needed.\n\n— Annie''s Car Rental',
  'automated',
  'Sent automatically 48 hours before the return date for rentals of 3+ days.'
);

-- 16. Damage Notification
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Damage Notification',
  'damage_notification',
  'email',
  'Vehicle inspection report — {{booking_code}}',
  E'Hi {{first_name}},\n\nFollowing the return of the {{vehicle}} on {{return_date}}, our inspection found the following:\n\nINSPECTION FINDINGS\n───────────────────\n{{damage_description}}\n\nASSESSMENT\nA fee of ${{damage_fee}} will be applied to cover {{damage_type}}.\n\nPer our rental agreement, renters are responsible for damage occurring during the rental period. If you have rental insurance or would like to discuss this further, please contact us:\n\n  Matthew: (772) 834-0117\n  Email: info@anniescarrental.com\n\nWe''re happy to provide additional photos or documentation for your insurance provider.\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  NULL,
  'manual',
  'Sent manually by admin after vehicle inspection reveals damage.'
);

-- 17. Refund Processed
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Refund Processed',
  'refund_processed',
  'email',
  'Refund processed — ${{refund_amount}} for booking {{booking_code}}',
  E'Hi {{first_name}},\n\nA refund has been processed for your rental:\n\nREFUND DETAILS\n──────────────\nAmount:     ${{refund_amount}}\nMethod:     Original payment method\nBooking:    {{booking_code}}\nExpected:   3–5 business days\n\nIf you don''t see the refund within 5 business days, please contact us at (772) 834-0117.\n\nAnnie''s Car Rental',
  NULL,
  'automated',
  'Sent automatically when a Stripe refund is processed.'
);

-- 18. Repeat Customer / Loyalty
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Repeat Customer',
  'repeat_customer',
  'email',
  '{{first_name}}, your next rental is 5% off',
  E'Hi {{first_name}},\n\nIt''s been a month since your last trip with us, and we wanted to say thanks for being an Annie''s Car Rental customer.\n\nYOUR RETURN DISCOUNT\nAs a returning guest, enjoy 5% off your next rental. Just mention this email when you book.\n\nWhat''s available:\n→ View our current fleet at anniescarrental.com\n\nWe''re always adding new vehicles and improving the experience. If you need a car for your next trip — whether it''s a weekend getaway or a longer stay — we''d love to have you back.\n\nAnnie''s Car Rental\nPort Saint Lucie, FL\n(772) 834-0117',
  NULL,
  'automated',
  'Sent automatically 30 days after rental completion.'
);

-- 19. Booking Cancelled
INSERT INTO email_templates (name, stage, channel, subject, body, sms_body, trigger_type, description) VALUES (
  'Booking Cancelled',
  'booking_cancelled',
  'both',
  'Booking cancelled — {{booking_code}}',
  E'Hi {{first_name}},\n\nYour booking has been cancelled.\n\nCANCELLED BOOKING\n─────────────────\nReference:  {{booking_code}}\nVehicle:    {{vehicle}}\nDates:      {{pickup_date}} – {{return_date}}\n\nIf a deposit was collected, it will be refunded to your original payment method within 3–5 business days per our cancellation policy.\n\nIf you''d like to rebook or have questions, we''re here to help:\n  Matthew: (772) 834-0117\n  Robin:   (772) 834-7637\n\nAnnie''s Car Rental\nPort Saint Lucie, FL',
  E'Hi {{first_name}}, your booking for the {{vehicle}} ({{pickup_date}} – {{return_date}}) has been cancelled.\n\nRef: {{booking_code}}\n\nIf a deposit was collected, it will be refunded within 3–5 business days.\n\nQuestions? Call us at (772) 834-0117.\n\n— Annie''s Car Rental',
  'automated',
  'Sent when a booking is cancelled by admin or customer.'
);

SELECT COUNT(*) AS templates_seeded FROM email_templates;
