import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..');

function source(path) {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

test('final rental packet has admin and portal endpoints', () => {
  const route = source('backend/routes/finalPackets.js');
  const portal = source('backend/routes/portal.js');
  const api = source('backend/api/index.js');
  const server = source('backend/server.js');

  assert.match(route, /\/bookings\/:id\/final-packet/);
  assert.match(route, /\/bookings\/:id\/final-packet\/pdf/);
  assert.match(route, /includeAgreementSource: true/);
  assert.match(route, /requireAuth/);
  assert.match(route, /isFinalRentalPacketAvailable/);
  assert.match(portal, /\/final-packet\/pdf/);
  assert.match(portal, /getFinalRentalPacket\(req\.portal\.bookingId, \{ includeAgreementSource: true \}\)/);
  assert.match(portal, /requirePortalAuth/);
  assert.match(portal, /finalPacket/);
  assert.match(api, /finalPacketRoutes/);
  assert.match(server, /finalPacketRoutes/);
});

test('final packet service includes settlement evidence and decline detail', () => {
  const service = source('backend/services/finalRentalPacketService.js');

  assert.match(service, /checkin_records/);
  assert.match(service, /booking_deposits/);
  assert.match(service, /incidentals/);
  assert.match(service, /toll_charges/);
  assert.match(service, /payments/);
  assert.match(service, /declines/);
  assert.match(service, /failure_message/);
  assert.match(service, /failure_code/);
  assert.match(service, /pickup/);
  assert.match(service, /return/);
  assert.match(service, /refund_due_cents/);
  assert.match(service, /appendix_included/);
});

test('dashboard and customer portal expose final packet views', () => {
  const apiClient = source('dashboard/src/api/client.js');
  const bookingDetail = source('dashboard/src/pages/BookingDetailPage.jsx');
  const tab = source('dashboard/src/components/booking-tabs/FinalPacketTab.jsx');
  const portal = source('src/components/portal/CustomerPortal.tsx');

  assert.match(apiClient, /getFinalRentalPacket/);
  assert.match(apiClient, /downloadFinalRentalPacketPdf/);
  assert.match(bookingDetail, /FinalPacketTab/);
  assert.match(bookingDetail, /Final Packet/);
  assert.match(tab, /Pickup Photos/);
  assert.match(tab, /Return Photos/);
  assert.match(tab, /Payments, Declines, Refunds/);
  assert.match(portal, /FinalPacketSummary/);
  assert.match(portal, /portal\/final-packet\/pdf/);
});

test('final packet PDF appends the signed rental agreement renderer', () => {
  const packetPdf = source('backend/utils/finalRentalPacketPdfGenerator.js');
  const agreementPdf = source('backend/utils/pdfGenerator.js');

  assert.match(agreementPdf, /export function addRentalAgreementPdfPages/);
  assert.match(packetPdf, /addRentalAgreementPdfPages/);
  assert.match(packetPdf, /Signed Rental Agreement Appendix/);
});
