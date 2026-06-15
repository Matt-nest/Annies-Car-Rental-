import { useEffect, useState, useRef, useCallback } from 'react';
import { FileText, PenLine, CheckCircle2, Clock, RotateCcw, Download } from 'lucide-react';
import { format } from 'date-fns';
import { api } from '../../api/client';
import { useAlerts } from '../../lib/alertsContext';
import Modal from './Modal';

// ── Canvas signature pad (no external deps) ───────────────────────────────────
function SignaturePad({ canvasRef, onDrawn }) {
  const drawing = useRef(false);
  const lastPos = useRef(null);

  // Size the backing store to the element's CSS size × devicePixelRatio so the
  // signature stays crisp on retina and the pad fills its container at any
  // width (replaces the old fixed 520×160 store that rendered blurry/small on
  // phones). Coordinate mapping below divides by the same ratio, so pointer
  // positions stay accurate regardless of display size.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const resize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [canvasRef]);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    };
  }

  // Stroke width in backing-store px = ~2.5 CSS px regardless of DPR.
  function strokeWidth(canvas) {
    return 2.5 * (canvas.width / canvas.clientWidth || 1);
  }

  function startDraw(e) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    const pos = getPos(e, canvas);
    lastPos.current = pos;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, strokeWidth(canvas) / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#1c1917';
    ctx.fill();
    onDrawn?.();
  }

  function draw(e) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPos(e, canvas);
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1c1917';
    ctx.lineWidth = strokeWidth(canvas);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }

  function stopDraw() {
    drawing.current = false;
    lastPos.current = null;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ height: 180 }}
      onMouseDown={startDraw}
      onMouseMove={draw}
      onMouseUp={stopDraw}
      onMouseLeave={stopDraw}
      onTouchStart={startDraw}
      onTouchMove={draw}
      onTouchEnd={stopDraw}
      className="w-full border border-[var(--border-subtle)] rounded-lg bg-[var(--bg-card)] cursor-crosshair touch-none"
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AgreementSection({ bookingId }) {
  const [agreement, setAgreement] = useState(undefined); // undefined = loading
  const [showModal, setShowModal] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signError, setSignError] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const canvasRef = useRef(null);
  const { refresh: refreshAlerts } = useAlerts();

  const load = useCallback(async () => {
    try {
      const data = await api.getAgreementDetail(bookingId);
      // Backend returns { signed: false } when no agreement exists
      setAgreement(data?.customer_signed_at ? data : null);
    } catch {
      setAgreement(null);
    }
  }, [bookingId]);

  useEffect(() => { load(); }, [load]);

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  }

  function closeModal() {
    setShowModal(false);
    setSignError(null);
    clearCanvas();
  }

  async function handleCounterSign() {
    const canvas = canvasRef.current;
    if (!canvas || !hasDrawn) return;
    setSubmitting(true);
    setSignError(null);
    try {
      await api.counterSignAgreement(bookingId, canvas.toDataURL('image/png'));
      closeModal();
      await Promise.all([load(), refreshAlerts()]);
    } catch (e) {
      console.error('Counter-sign failed:', e);
      // Surface the failure instead of leaving the modal silently open.
      setSignError(e?.data?.error || 'Could not save your signature. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownloadPdf() {
    try {
      setDownloading(true);
      const blob = await api.downloadAgreementPdf(bookingId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Rental_Agreement.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (e) {
      console.error('Failed to download PDF:', e);
      alert('Failed to download PDF. Please try again later.');
    } finally {
      setDownloading(false);
    }
  }

  // Still loading — render nothing to avoid layout shift
  if (agreement === undefined) return null;

  const fullyExecuted = agreement?.owner_signed_at;

  return (
    <div className="card p-5 space-y-4" data-section="agreement">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] uppercase tracking-wide flex items-center gap-2">
          <FileText size={15} className="text-[var(--text-tertiary)]" />
          Rental Agreement
        </h3>
        {agreement && (
          <span className={`badge ${fullyExecuted ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
            {fullyExecuted ? 'Fully Executed' : 'Awaiting Counter-Sign'}
          </span>
        )}
      </div>

      {/* Not signed yet */}
      {!agreement && (
        <div className="flex items-center gap-2 py-2 text-[var(--text-tertiary)] text-sm">
          <Clock size={15} />
          Customer hasn't signed the rental agreement yet.
        </div>
      )}

      {/* Agreement exists */}
      {agreement && (
        <div className="space-y-4">

          {/* Customer signed timestamp */}
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 size={15} />
            Customer signed {format(new Date(agreement.customer_signed_at), 'MMM d, yyyy \'at\' h:mm a')}
          </div>

          {/* Agreement details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 bg-[var(--bg-secondary)] rounded-lg p-4 text-sm">
            {agreement.address_line1 && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Address</p>
                <p className="text-[var(--text-primary)] font-medium">
                  {agreement.address_line1}, {agreement.city}, {agreement.state} {agreement.zip}
                </p>
              </div>
            )}
            {agreement.date_of_birth && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Date of Birth</p>
                <p className="text-[var(--text-primary)] font-medium">{agreement.date_of_birth}</p>
              </div>
            )}
            {agreement.driver_license_number && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Driver's License</p>
                <p className="text-[var(--text-primary)] font-medium">
                  {agreement.driver_license_number} · {agreement.driver_license_state} · exp {agreement.driver_license_expiry}
                </p>
              </div>
            )}
            {agreement.insurance_company && (
              <div>
                <p className="text-xs text-[var(--text-tertiary)] mb-0.5">Insurance</p>
                <p className="text-[var(--text-primary)] font-medium">
                  {agreement.insurance_company}
                  {agreement.insurance_policy_number && ` — ${agreement.insurance_policy_number}`}
                </p>
              </div>
            )}
          </div>

          {/* Customer signature image */}
          {agreement.customer_signature_data && (
            <div>
              <p className="text-xs text-[var(--text-tertiary)] mb-1.5">Customer Signature</p>
              <div className="inline-block border border-[var(--border-subtle)] rounded-lg p-3 bg-[var(--bg-secondary)]">
                <img
                  src={agreement.customer_signature_data}
                  alt="Customer signature"
                  className="h-14 w-auto"
                />
              </div>
            </div>
          )}

          {/* Counter-sign status */}
          <div className="pt-3 border-t border-[var(--border-subtle)]">
            {fullyExecuted ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-green-700">
                    <CheckCircle2 size={15} />
                    Counter-signed by {agreement.owner_signed_by}{' '}
                    {format(new Date(agreement.owner_signed_at), 'MMM d, yyyy \'at\' h:mm a')}
                  </div>
                  <button 
                    onClick={handleDownloadPdf}
                    disabled={downloading}
                    className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5"
                  >
                    <Download size={14} />
                    {downloading ? 'Generating...' : 'Download PDF'}
                  </button>
                </div>
                {agreement.owner_signature_data && (
                  <div>
                    <p className="text-xs text-[var(--text-tertiary)] mb-1.5">Your Signature</p>
                    <div className="inline-block border border-[var(--border-subtle)] rounded-lg p-3 bg-[var(--bg-secondary)]">
                      <img
                        src={agreement.owner_signature_data}
                        alt="Owner signature"
                        className="h-14 w-auto"
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <PenLine size={15} />
                  Your counter-signature is needed
                </div>
                <button onClick={() => setShowModal(true)} className="btn-primary">
                  <PenLine size={14} /> Counter-Sign
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Counter-sign modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title="Counter-Sign Rental Agreement"
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text-secondary)]">
            Draw your signature below to counter-sign and fully execute this rental agreement.
          </p>

          <SignaturePad canvasRef={canvasRef} onDrawn={() => setHasDrawn(true)} />

          <div className="flex items-center justify-between">
            <p className="text-xs text-[var(--text-tertiary)]">
              {hasDrawn ? 'Looks good? Confirm below.' : 'Draw your signature in the box above'}
            </p>
            <button
              onClick={clearCanvas}
              disabled={!hasDrawn}
              className="inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors disabled:opacity-40"
              style={{ minHeight: 44 }}
            >
              <RotateCcw size={14} /> Clear
            </button>
          </div>

          {signError && (
            <p className="text-xs text-center" style={{ color: 'var(--danger-color)' }} role="alert">
              {signError}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button onClick={closeModal} className="btn-secondary flex-1 justify-center" style={{ minHeight: 44 }}>
              Cancel
            </button>
            <button
              onClick={handleCounterSign}
              disabled={!hasDrawn || submitting}
              className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ minHeight: 44 }}
            >
              {submitting ? 'Signing…' : 'Confirm Counter-Sign'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
