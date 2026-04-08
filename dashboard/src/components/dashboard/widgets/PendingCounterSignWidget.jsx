import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PenLine, Clock, Car, User, ChevronRight, X, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../api/client';

/* ── Simple native Canvas signature pad (replaces react-signature-canvas) ── */
function SignaturePad({ sigRef }) {
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (sigRef) {
      sigRef.current = {
        isEmpty: () => {
          const canvas = canvasRef.current;
          if (!canvas) return true;
          const ctx = canvas.getContext('2d');
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 3; i < pixels.length; i += 4) {
            if (pixels[i] > 0) return false;
          }
          return true;
        },
        toDataURL: (type) => canvasRef.current?.toDataURL(type || 'image/png') || '',
        clear: () => {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
        },
      };
    }
  }, [sigRef]);

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDraw = (e) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  };

  const endDraw = () => { isDrawing.current = false; };

  return (
    <canvas
      ref={canvasRef}
      width={420}
      height={160}
      style={{ width: '100%', height: 160, cursor: 'crosshair', touchAction: 'none' }}
      onMouseDown={startDraw}
      onMouseMove={draw}
      onMouseUp={endDraw}
      onMouseLeave={endDraw}
      onTouchStart={startDraw}
      onTouchMove={draw}
      onTouchEnd={endDraw}
    />
  );
}

export default function PendingCounterSignWidget() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signingId, setSigningId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [signedId, setSignedId] = useState(null);
  const sigRef = useRef(null);
  const navigate = useNavigate();

  const loadPending = useCallback(() => {
    api.getPendingCounterSign()
      .then(data => setPending(data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadPending(); }, [loadPending]);

  const handleSign = async (bookingId) => {
    if (!sigRef.current || sigRef.current.isEmpty()) return;
    setSubmitting(true);
    try {
      await api.counterSignAgreement(bookingId, sigRef.current.toDataURL('image/png'));
      setSignedId(bookingId);
      setTimeout(() => {
        setSignedId(null);
        setSigningId(null);
        loadPending();
      }, 2000);
    } catch (e) {
      console.error('Counter-sign failed:', e);
    }
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div style={{
        background: 'var(--bg-card, #fff)', borderRadius: 16,
        padding: '24px', border: '1px solid var(--border-subtle, rgba(0,0,0,0.06))',
        minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Loading agreements...</div>
      </div>
    );
  }

  if (pending.length === 0) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--bg-card, #fff)',
          borderRadius: 16,
          border: '1.5px solid rgba(99, 102, 241, 0.25)',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 0 0 1px rgba(99,102,241,0.05)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.06) 0%, rgba(79,70,229,0.03) 100%)',
          borderBottom: '1px solid rgba(99,102,241,0.1)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10,
            background: 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
          }}>
            <PenLine size={15} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em', margin: 0 }}>
              Counter-Sign Required
            </h3>
            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', margin: 0 }}>
              {pending.length} agreement{pending.length !== 1 ? 's' : ''} awaiting your signature
            </p>
          </div>
        </div>

        {/* List */}
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          <AnimatePresence>
            {pending.map((ag, i) => {
              const customerName = `${ag.customer?.first_name || ''} ${ag.customer?.last_name || ''}`.trim();
              const vehicleLabel = ag.vehicle
                ? `${ag.vehicle.year} ${ag.vehicle.make} ${ag.vehicle.model}` : 'Vehicle';
              const signedAt = new Date(ag.customer_signed_at);
              const timeAgo = getTimeAgo(signedAt);

              return (
                <motion.div
                  key={ag.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, height: 0, padding: 0, margin: 0 }}
                  transition={{ delay: i * 0.05 }}
                  style={{
                    padding: '14px 20px',
                    borderBottom: i < pending.length - 1 ? '1px solid var(--border-subtle, rgba(0,0,0,0.05))' : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.03)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {ag.booking_code}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--accent-color)', fontWeight: 500, background: 'rgba(99,102,241,0.08)', padding: '1px 6px', borderRadius: 4 }}>
                        {ag.booking_status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <User size={10} /> {customerName || 'Customer'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Car size={10} /> {vehicleLabel}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={9} /> Signed {timeAgo}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); setSigningId(ag.booking_id); }}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: 'none',
                        background: 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%)',
                        color: '#fff', fontSize: '11px', fontWeight: 600,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
                        boxShadow: '0 2px 6px rgba(99,102,241,0.25)',
                      }}
                    >
                      <PenLine size={11} /> Sign
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={(e) => { e.stopPropagation(); navigate(`/bookings/${ag.booking_id}`); }}
                      style={{
                        padding: '6px 10px', borderRadius: 8,
                        border: '1px solid var(--border-subtle, rgba(0,0,0,0.08))',
                        background: 'var(--bg-card, rgba(0,0,0,0.02))',
                        color: 'var(--text-secondary)', fontSize: '11px', fontWeight: 500,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                      }}
                    >
                      View <ChevronRight size={10} />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Counter-sign Modal */}
      <AnimatePresence>
        {signingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => !submitting && setSigningId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'var(--bg-card, #fff)', borderRadius: 20,
                padding: '28px', width: '100%', maxWidth: 480,
                boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
              }}
            >
              {signedId === signingId ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200 }}
                  >
                    <CheckCircle size={48} color="#22c55e" />
                  </motion.div>
                  <p style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)', marginTop: 12 }}>
                    Agreement Counter-Signed!
                  </p>
                  <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: 4 }}>
                    Booking has been confirmed and is awaiting pickup.
                  </p>
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                      Counter-Sign Agreement
                    </h3>
                    <button onClick={() => setSigningId(null)} style={{
                      width: 28, height: 28, borderRadius: 8, border: 'none',
                      background: 'var(--bg-secondary)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: 'var(--text-tertiary)',
                    }}>
                      <X size={14} />
                    </button>
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Draw your signature below to counter-sign and confirm this rental agreement.
                  </p>
                  <div style={{
                    border: '2px dashed var(--border-subtle, rgba(0,0,0,0.1))',
                    borderRadius: 12, overflow: 'hidden', marginBottom: 16,
                    background: '#fafafa',
                  }}>
                    <SignaturePad sigRef={sigRef} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => sigRef.current?.clear()}
                      style={{
                        flex: 1, padding: '10px', borderRadius: 10,
                        border: '1px solid var(--border-subtle)', background: 'var(--bg-card)',
                        color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => handleSign(signingId)}
                      disabled={submitting}
                      style={{
                        flex: 2, padding: '10px', borderRadius: 10,
                        border: 'none', cursor: submitting ? 'wait' : 'pointer',
                        background: 'linear-gradient(135deg, var(--accent-color) 0%, var(--accent-hover) 100%)',
                        color: '#fff', fontSize: '12px', fontWeight: 700,
                        boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                      }}
                    >
                      {submitting ? 'Signing...' : 'Confirm Counter-Sign'}
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function getTimeAgo(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
