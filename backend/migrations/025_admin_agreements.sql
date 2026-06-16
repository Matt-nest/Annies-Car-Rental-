-- 025_admin_agreements.sql
-- Enable admin-generated rental agreements (in-person + print-to-sign).
--
-- Today a rental_agreements row can only be created when the CUSTOMER signs via
-- their link, and customer_signature_data / customer_signed_at are NOT NULL. The
-- admin "complete in person" path needs two new abilities:
--   1. Digital: capture the customer's signature on the admin's device now.
--   2. Wet/print: generate an unsigned PDF to print and sign on paper — so the
--      row may exist with NO digital customer signature yet.
-- Relaxing the NOT NULLs is safe: the customer-link /sign endpoint still validates
-- a signature is present in application code, so customer-originated rows are
-- unaffected. New columns record where the agreement came from.

ALTER TABLE rental_agreements ALTER COLUMN customer_signature_data DROP NOT NULL;
ALTER TABLE rental_agreements ALTER COLUMN customer_signed_at      DROP NOT NULL;

ALTER TABLE rental_agreements
  ADD COLUMN IF NOT EXISTS agreement_source VARCHAR(20) NOT NULL DEFAULT 'customer_link',  -- 'customer_link' | 'admin_in_person'
  ADD COLUMN IF NOT EXISTS signature_mode   VARCHAR(10),                                   -- 'digital' | 'wet' (admin path)
  ADD COLUMN IF NOT EXISTS created_by       VARCHAR(120);                                  -- admin email when admin-generated
