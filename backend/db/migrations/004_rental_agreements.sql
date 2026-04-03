-- Rental Agreements — stores signed rental contracts
CREATE TABLE rental_agreements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) UNIQUE,

  -- Customer-filled fields (at signing)
  address_line1 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(2),
  zip VARCHAR(10),
  date_of_birth DATE,
  driver_license_number VARCHAR(50),
  driver_license_state VARCHAR(2),
  driver_license_expiry DATE,

  -- Customer insurance info (optional — may be filled by Bonzah integration later)
  insurance_company VARCHAR(255),
  insurance_policy_number VARCHAR(100),
  insurance_expiry DATE,
  insurance_agent_name VARCHAR(200),
  insurance_agent_phone VARCHAR(20),
  insurance_vehicle_description TEXT,

  -- Customer signature
  customer_signature_data TEXT NOT NULL,       -- base64 PNG of drawn/typed signature
  customer_signature_type VARCHAR(10),         -- 'drawn' or 'typed'
  customer_signed_at TIMESTAMPTZ NOT NULL,
  customer_ip VARCHAR(45),

  -- Owner counter-signature (filled later in dashboard)
  owner_signature_data TEXT,
  owner_signature_type VARCHAR(10),
  owner_signed_at TIMESTAMPTZ,
  owner_signed_by VARCHAR(100),               -- email of admin who signed

  -- Generated document
  agreement_pdf_url TEXT,

  -- Terms versioning
  terms_version VARCHAR(20) DEFAULT '1.0',

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agreements_booking ON rental_agreements (booking_id);

-- Add trigger for updated_at
CREATE TRIGGER agreements_updated_at
  BEFORE UPDATE ON rental_agreements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE rental_agreements ENABLE ROW LEVEL SECURITY;
