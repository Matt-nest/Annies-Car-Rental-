import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getFinalRentalPacket, isFinalRentalPacketAvailable } from '../services/finalRentalPacketService.js';
import { generateFinalRentalPacketPdf } from '../utils/finalRentalPacketPdfGenerator.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

function assertPacketReady(packet) {
  if (!isFinalRentalPacketAvailable(packet?.booking)) {
    const err = new Error('Final rental packet is available after the rental is returned or completed.');
    err.status = 409;
    throw err;
  }
}

router.get('/bookings/:id/final-packet', requireAuth, asyncHandler(async (req, res) => {
  const packet = await getFinalRentalPacket(req.params.id);
  res.json(packet);
}));

router.get('/bookings/:id/final-packet/pdf', requireAuth, asyncHandler(async (req, res) => {
  const packet = await getFinalRentalPacket(req.params.id);
  assertPacketReady(packet);

  const code = packet.booking?.booking_code || packet.booking?.id || req.params.id;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="Final_Rental_Packet_${code}.pdf"`);
  await generateFinalRentalPacketPdf({ packet, stream: res });
}));

export default router;
