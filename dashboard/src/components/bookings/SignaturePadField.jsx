import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Check } from 'lucide-react';

/**
 * SignaturePadField — a self-contained canvas signature pad (no external deps),
 * lifted from AgreementSection's SignaturePad so the admin in-person flow and the
 * counter-sign flow share one crisp, retina-correct pad. Calls onChange(dataUrl)
 * after each stroke and onChange(null) on clear. `label` names the signer.
 */
export default function SignaturePadField({ label, onChange, hint }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);
  const [hasDrawn, setHasDrawn] = useState(false);

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
  }, []);

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY };
  }

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
    if (!hasDrawn) setHasDrawn(true);
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
    if (!drawing.current) return;
    drawing.current = false;
    lastPos.current = null;
    const canvas = canvasRef.current;
    if (canvas && hasDrawn) onChange?.(canvas.toDataURL('image/png'));
  }

  function clear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange?.(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">{label}</label>
        <div className="flex items-center gap-2">
          {hasDrawn && (
            <span className="text-[11px] inline-flex items-center gap-1 text-emerald-500">
              <Check size={12} /> Captured
            </span>
          )}
          <button type="button" onClick={clear}
            className="text-[11px] inline-flex items-center gap-1 text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] cursor-pointer">
            <RotateCcw size={11} /> Clear
          </button>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        style={{ height: 150 }}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={stopDraw}
        onMouseLeave={stopDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={stopDraw}
        className="w-full border border-[var(--border-subtle)] rounded-lg bg-white cursor-crosshair touch-none"
      />
      {hint && <p className="text-[11px] text-[var(--text-tertiary)] mt-1">{hint}</p>}
    </div>
  );
}
