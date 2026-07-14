import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';

const STEP_MS = 4400;

function clampIndex(value, max) {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(value, max - 1));
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  return reduced;
}

function speak(text, enabled) {
  if (!enabled || typeof window === 'undefined' || !window.speechSynthesis || !text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.94;
  utterance.pitch = 0.98;
  utterance.volume = 0.92;
  window.speechSynthesis.speak(utterance);
}

function blockClass(type, focused) {
  const base = 'absolute rounded-lg border flex items-center justify-center text-center px-2 text-[10px] sm:text-xs font-semibold';
  const palette = {
    nav: 'bg-[rgba(19,41,75,0.9)] border-white/10 text-white',
    input: 'bg-[var(--bg-card)] border-[var(--border-medium)] text-[var(--text-secondary)]',
    pill: 'bg-[rgba(19,41,75,0.1)] border-[rgba(19,41,75,0.18)] text-[var(--accent-color)]',
    card: 'bg-[var(--bg-card)] border-[var(--border-subtle)] text-[var(--text-primary)] shadow-sm',
    form: 'bg-[var(--bg-card)] border-[var(--border-medium)] text-[var(--text-primary)]',
    grid: 'bg-[rgba(59,130,246,0.08)] border-[rgba(59,130,246,0.18)] text-[var(--text-primary)]',
    row: 'bg-[var(--bg-card)] border-[var(--border-medium)] text-[var(--text-primary)]',
    action: 'bg-[var(--accent-color)] border-[var(--accent-color)] text-white',
    list: 'bg-[rgba(148,163,184,0.1)] border-[var(--border-subtle)] text-[var(--text-primary)]',
    chart: 'bg-[rgba(34,197,94,0.1)] border-[rgba(34,197,94,0.2)] text-[var(--text-primary)]',
    calendar: 'bg-[rgba(245,158,11,0.1)] border-[rgba(245,158,11,0.22)] text-[var(--text-primary)]',
  };

  return `${base} ${palette[type] || palette.card} ${focused ? 'z-20' : 'z-10'}`;
}

function DemoBlock({ block, focused, reducedMotion }) {
  const scale = focused ? 1.08 : 1;
  return (
    <motion.div
      className={blockClass(block.type, focused)}
      initial={false}
      animate={{
        scale,
        boxShadow: focused
          ? '0 18px 50px rgba(19,41,75,0.28), 0 0 0 4px rgba(19,41,75,0.16)'
          : '0 8px 18px rgba(15,23,42,0.08)',
      }}
      transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
      style={{
        left: `${block.x}%`,
        top: `${block.y}%`,
        width: `${block.w}%`,
        height: `${block.h}%`,
        transformOrigin: 'center',
      }}
    >
      <span className="truncate max-w-full">{block.label}</span>
    </motion.div>
  );
}

function DemoFrame({ frame, reducedMotion }) {
  const blocks = frame?.blocks || [];
  const cursor = frame?.cursor || { x: 50, y: 50 };
  const isCustomer = frame?.screen === 'customer';

  return (
    <div
      className="relative overflow-hidden rounded-xl border"
      style={{
        aspectRatio: '16 / 9',
        backgroundColor: isCustomer ? 'var(--bg-secondary)' : 'var(--bg-primary)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-8 flex items-center gap-1.5 px-4 border-b"
        style={{
          backgroundColor: 'var(--bg-glass)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
        <span className="ml-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
          {isCustomer ? 'Customer site' : 'Admin dashboard'}
        </span>
      </div>

      <div className="absolute inset-x-0 top-8 bottom-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${frame.heading}-${frame.caption}`}
            className="absolute inset-0"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -8 }}
            transition={{ duration: reducedMotion ? 0 : 0.22 }}
          >
            <div className="absolute left-[5%] top-[6%] z-30 max-w-[46%]">
              <p className="text-xs sm:text-sm font-semibold text-[var(--text-primary)]">{frame.heading}</p>
              <p className="mt-1 text-[10px] sm:text-xs text-[var(--text-secondary)]">{frame.subheading}</p>
            </div>
            {blocks.map((block) => (
              <DemoBlock
                key={block.id}
                block={block}
                focused={block.id === frame.focusId}
                reducedMotion={reducedMotion}
              />
            ))}
            <motion.div
              className="absolute z-40 pointer-events-none"
              initial={false}
              animate={{ left: `${cursor.x}%`, top: `${cursor.y}%` }}
              transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 170, damping: 18 }}
              style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.28))' }}
            >
              <MousePointer2 size={26} fill="white" color="var(--accent-color)" strokeWidth={2.4} />
            </motion.div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function GuidedDemoPlayer({ guide }) {
  const frames = guide?.demo || [];
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const timerRef = useRef(null);

  const frame = frames[index] || null;
  const progress = useMemo(() => {
    if (!frames.length) return 0;
    return ((index + 1) / frames.length) * 100;
  }, [frames.length, index]);

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, [guide?.id]);

  useEffect(() => {
    if (!playing || !frames.length) return undefined;
    timerRef.current = window.setTimeout(() => {
      setIndex((current) => {
        if (current >= frames.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, reducedMotion ? STEP_MS + 1000 : STEP_MS);
    return () => window.clearTimeout(timerRef.current);
  }, [frames.length, index, playing, reducedMotion]);

  useEffect(() => {
    speak(frame?.narration, playing && voiceEnabled);
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, [frame?.narration, playing, voiceEnabled]);

  if (!frame) {
    return (
      <div className="rounded-xl border p-6 text-sm text-[var(--text-secondary)]" style={{ borderColor: 'var(--border-subtle)' }}>
        Demo coming soon.
      </div>
    );
  }

  const go = (nextIndex) => {
    setIndex(clampIndex(nextIndex, frames.length));
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  };

  const restart = () => {
    go(0);
    setPlaying(true);
  };

  return (
    <section
      className="rounded-xl border p-3 sm:p-4"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
      aria-label={`${guide.title} demo`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-[var(--text-primary)]">Animated demo</p>
          <p className="text-xs text-[var(--text-secondary)]">
            Captioned walkthrough, step {index + 1} of {frames.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost h-9 px-2" onClick={() => go(0)} aria-label="Restart demo">
            <RotateCcw size={16} />
          </button>
          <button type="button" className="btn-ghost h-9 px-2" onClick={() => go(index - 1)} aria-label="Previous step">
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            className="btn-primary h-9 gap-2 px-3"
            onClick={() => setPlaying((value) => !value)}
          >
            {playing ? <Pause size={16} /> : <Play size={16} />}
            <span>{playing ? 'Pause' : 'Play'}</span>
          </button>
          <button type="button" className="btn-ghost h-9 px-2" onClick={() => go(index + 1)} aria-label="Next step">
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            className="btn-ghost h-9 px-2"
            onClick={() => {
              setVoiceEnabled((value) => !value);
              if (!voiceEnabled) setPlaying(true);
            }}
            aria-label={voiceEnabled ? 'Turn voiceover off' : 'Turn voiceover on'}
            title={voiceEnabled ? 'Voiceover on' : 'Voiceover off'}
          >
            {voiceEnabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
        </div>
      </div>

      <DemoFrame frame={frame} reducedMotion={reducedMotion} />

      <div className="mt-3 overflow-hidden rounded-full bg-[var(--bg-secondary)] h-1.5">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: 'var(--accent-color)' }}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
        />
      </div>

      <div className="mt-3 rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}>
        <p className="text-[11px] uppercase tracking-[0.14em] font-bold text-[var(--text-tertiary)]">Caption</p>
        <p className="mt-1 text-sm font-medium text-[var(--text-primary)]">{frame.caption}</p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-secondary h-9 gap-2 px-3" onClick={restart}>
          <Play size={15} />
          <span>Play from start</span>
        </button>
        <button
          type="button"
          className="btn-ghost h-9 gap-2 px-3"
          onClick={() => setVoiceEnabled((value) => !value)}
        >
          {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          <span>{voiceEnabled ? 'Voiceover on' : 'Voiceover off'}</span>
        </button>
      </div>
    </section>
  );
}
