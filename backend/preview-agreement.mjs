// Local-only preview server for the rental agreement PDF template.
// Serves the exact generator (utils/pdfGenerator.js) with sample data.
// Run: node preview-agreement.mjs  →  http://localhost:4555
import http from 'http';
import { generateRentalAgreementPdf } from './utils/pdfGenerator.js';

const agreement = {
  address_line1: '123 Ocean Drive',
  city: 'Miami Beach', state: 'FL', zip: '33139',
  driver_license_number: 'D123-4567-8901', driver_license_state: 'FL',
  driver_license_expiry: '2028-09-14', date_of_birth: '1990-04-22',
  insurance_company: 'GEICO', insurance_policy_number: 'POL-99887766',
  created_at: '2026-06-15',
  customer_signature_data: null, customer_signed_at: null,
  owner_signature_data: null, owner_signed_at: null,
};

const booking = {
  booking_code: 'ACR-2026-0042',
  pickup_date: '2026-07-01', pickup_time: '10:00', return_date: '2026-07-08', return_time: '10:00',
  pickup_mileage: 24150, return_mileage: '', deposit_amount: 500,
  daily_rate: 89, rental_days: 7, subtotal: 623, tax_amount: 43.61,
  delivery_fee: 50, total_cost: 716.61, pickup_fuel_level: 'full',
  customers: {
    first_name: 'Jane', last_name: 'Doe', city: 'Miami Beach', state: 'FL', zip: '33139',
    phone: '(772) 555-0142',
  },
  vehicles: {
    year: 2024, make: 'Toyota', model: 'Camry', category: 'Sedan',
    vin: '4T1B11HK1KU123456', license_plate: 'ABC-1234',
    weekly_rate: 550, monthly_rate: 1900, mileage_limit_per_day: 200, deposit_amount: 500,
    excess_mileage_fee: 0.35,
  },
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="rental-agreement-preview.pdf"');
  try {
    await generateRentalAgreementPdf(agreement, booking, res);
  } catch (err) {
    res.statusCode = 500;
    res.end('PDF error: ' + err.message);
  }
});

server.listen(4555, () => console.log('Agreement preview → http://localhost:4555'));
