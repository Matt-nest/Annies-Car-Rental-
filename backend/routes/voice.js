/**
 * Voice routes — handles inbound calls to +17722071655.
 *
 * Flow:
 *   1. Customer calls +17722071655
 *   2. Twilio POSTs to /api/v1/voice/incoming
 *   3. We read hunt_group_members from business_settings (migration 021),
 *      return TwiML with one <Dial> per enabled member in order
 *   4. Twilio dials each in sequence; first one to pick up gets the call
 *   5. If none answer within their ring_seconds, fall through to voicemail
 *      OR voicemail+text-back OR hangup (configured per business_settings)
 *   6. After voicemail recording, Twilio POSTs to /voice/recording-done
 *      where we email the recording, optionally text the caller back,
 *      and create a dashboard notification
 *
 * Auth: Twilio signs every request with HMAC-SHA1. We verify via the existing
 * twilioSignatureMiddleware. Without verification, anyone could trigger
 * outbound dial legs and rack up minutes on our account.
 */

import { Router } from 'express';
import { supabase } from '../db/supabase.js';
import { verifyTwilioSignature } from '../middleware/twilioSignature.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSMS, sendEmail } from '../services/notifyService.js';
import { createNotification } from '../services/notificationService.js';
import { safeRecordTwilioCallLog } from '../services/twilioActivityService.js';
import { escapeHtml } from '../utils/emailShell.js';

const router = Router();

const FROM_NUMBER = process.env.TWILIO_PHONE_NUMBER || '+17722071655';

/** Build the <Dial> + voicemail TwiML from current business_settings config. */
async function buildHuntGroupTwiml() {
  const { data: settings } = await supabase
    .from('business_settings')
    .select('hunt_group_enabled, hunt_group_members, hunt_group_fallback, voicemail_greeting')
    .eq('id', 1)
    .single();

  // No config or hunt group disabled — straight to voicemail
  if (!settings || !settings.hunt_group_enabled) {
    return wrapResponse(voicemailTwiml(settings?.voicemail_greeting));
  }

  const members = Array.isArray(settings.hunt_group_members) ? settings.hunt_group_members : [];
  const enabled = members.filter(m => m?.enabled !== false && m?.phone);

  // Empty / all-disabled hunt group — voicemail fallback
  if (enabled.length === 0) {
    return wrapResponse(voicemailTwiml(settings.voicemail_greeting));
  }

  // Sequential dial: TwiML processes <Dial> verbs in order. Each one BLOCKS
  // until answered or timed out. On answer, remaining verbs are skipped
  // (call is connected). On timeout, falls through to the next.
  const dialLegs = enabled.map(m => {
    const seconds = Math.max(5, Math.min(60, Number(m.ring_seconds) || 30));
    return `  <Dial timeout="${seconds}" callerId="${escapeXml(FROM_NUMBER)}" answerOnBridge="true"><Number>${escapeXml(m.phone)}</Number></Dial>`;
  }).join('\n');

  // After all legs miss, fallback per configured policy
  const fallback = settings.hunt_group_fallback || 'voicemail_textback';
  const tail = fallback === 'hangup'
    ? '  <Hangup/>'
    : voicemailTwiml(settings.voicemail_greeting);

  return wrapResponse(`${dialLegs}\n${tail}`);
}

function voicemailTwiml(greeting) {
  const safeGreeting = escapeXml(greeting || "You've reached Annie's Car Rental. Please leave a message after the beep and we'll call you back as soon as possible.");
  return `  <Say voice="alice">${safeGreeting}</Say>
  <Record action="/api/v1/voice/recording-done" maxLength="120" timeout="3" transcribe="true" transcribeCallback="/api/v1/voice/transcription-done" playBeep="true"/>
  <Say voice="alice">We did not receive a recording. Goodbye.</Say>
  <Hangup/>`;
}

function wrapResponse(inner) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${inner}\n</Response>`;
}

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * POST /voice/incoming — primary inbound voice handler.
 * Twilio configures this as the number's "A call comes in" webhook.
 * Returns the dynamic TwiML built from current business_settings.
 */
router.post('/incoming', verifyTwilioSignature, asyncHandler(async (req, res) => {
  const { From, To, CallSid, ParentCallSid, CallStatus } = req.body || {};
  console.log(`[Voice] Incoming call from ${From || 'unknown'}`);
  await safeRecordTwilioCallLog({
    callSid: CallSid,
    parentCallSid: ParentCallSid,
    direction: 'inbound',
    status: CallStatus || 'ringing',
    from: From,
    to: To || FROM_NUMBER,
    startedAt: new Date().toISOString(),
    metadata: { event: 'voice_incoming' },
  });
  const twiml = await buildHuntGroupTwiml();
  res.set('Content-Type', 'text/xml').send(twiml);
}));

/**
 * POST /voice/recording-done — Twilio posts here when the caller finishes
 * leaving a voicemail. Body includes RecordingUrl, RecordingDuration, From.
 *
 * Actions:
 *   1. Create dashboard notification with link to recording
 *   2. Email the recording URL to voicemail_email (admin)
 *   3. If fallback=voicemail_textback, text the caller back
 *   4. Return empty TwiML so the call ends cleanly
 */
router.post('/recording-done', verifyTwilioSignature, asyncHandler(async (req, res) => {
  const { RecordingUrl, RecordingDuration, From, To, CallSid, ParentCallSid } = req.body || {};
  const callerPhone = From || '(unknown)';
  const durationSec = parseInt(RecordingDuration, 10) || 0;

  await safeRecordTwilioCallLog({
    callSid: CallSid,
    parentCallSid: ParentCallSid,
    direction: 'inbound',
    status: durationSec < 2 ? 'short-recording' : 'voicemail',
    from: From,
    to: To || FROM_NUMBER,
    recordingUrl: RecordingUrl || null,
    recordingDurationSeconds: durationSec,
    durationSeconds: durationSec,
    metadata: { event: 'voice_recording_done' },
  });

  // Skip if too short (often <2s = caller hung up before speaking)
  if (durationSec < 2) {
    console.log(`[Voice] Short recording from ${callerPhone} (${durationSec}s) — skipping notifications`);
    return res.set('Content-Type', 'text/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<Response><Hangup/></Response>');
  }

  // Look up caller in customers table (best-effort; matches last-10 digits like F-20)
  const last10 = (callerPhone.replace(/\D/g, '') || '').slice(-10);
  let customerName = '';
  if (last10.length === 10) {
    const { data: customers } = await supabase
      .from('customers')
      .select('first_name, last_name, phone')
      .not('phone', 'is', null);
    const match = (customers || []).find(c => (c.phone || '').replace(/\D/g, '').slice(-10) === last10);
    if (match) customerName = `${match.first_name || ''} ${match.last_name || ''}`.trim();
  }

  // Read current settings to know fallback behavior + voicemail_email
  const { data: settings } = await supabase
    .from('business_settings')
    .select('hunt_group_fallback, voicemail_email')
    .eq('id', 1)
    .single();

  // 1. Dashboard notification
  await createNotification(
    'new_voicemail',
    `New voicemail from ${customerName || callerPhone}`,
    `${durationSec}s recording. Listen: ${RecordingUrl}.mp3`,
    '/messaging',
    { call_sid: CallSid, recording_url: RecordingUrl, from: callerPhone, duration: durationSec }
  ).catch(err => console.error('[Voice] notification create failed:', err.message));

  // 2. Email admin
  const adminEmail = settings?.voicemail_email;
  if (adminEmail) {
    const subject = `New voicemail from ${customerName || callerPhone}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px;max-width:560px;">
        <h2 style="margin:0 0 12px;color:#1c1917;font-size:18px;">📞 New voicemail</h2>
        <table style="font-size:14px;color:#44403c;border-collapse:collapse;width:100%;margin-bottom:16px;">
          <tr><td style="padding:6px 0;color:#78716c;">From</td><td style="padding:6px 0;"><strong>${escapeHtml(customerName || 'Unknown caller')}</strong></td></tr>
          <tr><td style="padding:6px 0;color:#78716c;">Phone</td><td style="padding:6px 0;"><a href="tel:${escapeHtml(callerPhone)}">${escapeHtml(callerPhone)}</a></td></tr>
          <tr><td style="padding:6px 0;color:#78716c;">Duration</td><td style="padding:6px 0;">${durationSec} seconds</td></tr>
          <tr><td style="padding:6px 0;color:#78716c;">Call SID</td><td style="padding:6px 0;font-family:monospace;font-size:12px;">${escapeHtml(CallSid || '')}</td></tr>
        </table>
        <a href="${escapeHtml(RecordingUrl)}.mp3" style="display:inline-block;background:#1c1917;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">▶ Listen to recording</a>
        <p style="margin:16px 0 0;font-size:12px;color:#a8a29e;">Transcription will follow in a separate email once Twilio finishes processing.</p>
      </div>`;
    sendEmail({ to: adminEmail, subject, html }).catch(err => console.error('[Voice] admin email failed:', err.message));
  }

  // 3. Text-back to caller (if configured)
  if (settings?.hunt_group_fallback === 'voicemail_textback') {
    const textBody = `Hi${customerName ? ' ' + customerName.split(' ')[0] : ''}, this is Annie's Car Rental. We just missed your call and got your voicemail. We'll call you back as soon as possible. — Annie's Car Rental, (772) 207-1655`;
    sendSMS({ to: callerPhone, body: textBody, source: 'manual' })
      .catch(err => console.error('[Voice] text-back failed:', err.message));
  }

  // 4. Return empty TwiML — call already ended at Record verb
  res.set('Content-Type', 'text/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<Response></Response>');
}));

/**
 * POST /voice/transcription-done — Twilio posts the transcribed text here
 * asynchronously (usually within 60s of the recording). We email the
 * transcription to the admin so they can triage without listening.
 */
router.post('/transcription-done', verifyTwilioSignature, asyncHandler(async (req, res) => {
  const { TranscriptionText, TranscriptionStatus, RecordingUrl, From, To, CallSid } = req.body || {};

  await safeRecordTwilioCallLog({
    callSid: CallSid,
    direction: 'inbound',
    status: TranscriptionStatus === 'completed' ? 'transcribed' : 'transcription_pending',
    from: From,
    to: To || FROM_NUMBER,
    recordingUrl: RecordingUrl || null,
    transcriptionText: TranscriptionText || null,
    transcriptionStatus: TranscriptionStatus || null,
    metadata: { event: 'voice_transcription_done' },
  });

  if (TranscriptionStatus !== 'completed' || !TranscriptionText) {
    console.log(`[Voice] Transcription not completed (${TranscriptionStatus}) for ${CallSid}`);
    return res.status(200).send('');
  }

  const { data: settings } = await supabase
    .from('business_settings')
    .select('voicemail_email')
    .eq('id', 1)
    .single();

  if (settings?.voicemail_email) {
    const subject = `Voicemail transcript — ${From || 'unknown caller'}`;
    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:24px;max-width:560px;">
        <h2 style="margin:0 0 12px;color:#1c1917;font-size:18px;">📝 Voicemail transcription</h2>
        <p style="margin:0 0 12px;font-size:13px;color:#78716c;">From: <a href="tel:${escapeHtml(From || '')}">${escapeHtml(From || 'unknown')}</a></p>
        <blockquote style="border-left:3px solid #d4af37;padding:12px 16px;margin:0 0 16px;background:#fafaf9;color:#1c1917;font-size:15px;line-height:1.6;">
          ${escapeHtml(TranscriptionText)}
        </blockquote>
        ${RecordingUrl ? `<a href="${escapeHtml(RecordingUrl)}.mp3" style="display:inline-block;background:#1c1917;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;">▶ Listen to original</a>` : ''}
        <p style="margin:16px 0 0;font-size:11px;color:#a8a29e;">Auto-transcribed by Twilio. May contain errors.</p>
      </div>`;
    sendEmail({ to: settings.voicemail_email, subject, html }).catch(err => console.error('[Voice] transcript email failed:', err.message));
  }

  res.status(200).send('');
}));

export default router;
