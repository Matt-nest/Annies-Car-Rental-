import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';

export default function CustomCursor() {
  const prefersReducedMotion = useReducedMotion();

  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const cursorScale = useMotionValue(1);

  const springX = useSpring(cursorX, { stiffness: 350, damping: 30, mass: 0.4 });
  const springY = useSpring(cursorY, { stiffness: 350, damping: 30, mass: 0.4 });
  const springScale = useSpring(cursorScale, { stiffness: 500, damping: 28 });

  const isTouch = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
  const isActive = !isTouch && prefersReducedMotion !== true;

  useEffect(() => {
    if (!isActive) return;

    const onMove = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    const onOver = (e: MouseEvent) => {
      if ((e.target as Element)?.closest?.('a, button, [role="button"], select')) {
        cursorScale.set(1.5);
      }
    };

    const onOut = (e: MouseEvent) => {
      if ((e.target as Element)?.closest?.('a, button, [role="button"], select')) {
        cursorScale.set(1);
      }
    };

    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('mouseout', onOut);

    return () => {
      window.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', onOver);
      document.removeEventListener('mouseout', onOut);
    };
  }, [isActive]);

  if (!isActive) return null;

  return (
    <motion.div
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        x: springX,
        y: springY,
        translateX: '-50%',
        translateY: '-50%',
        width: 56,
        height: 56,
        borderRadius: '50%',
        // box-shadow renders smoother/anti-aliased vs CSS border at any DPR
        boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.45)',
        mixBlendMode: 'difference',
        pointerEvents: 'none',
        zIndex: 99999,
        scale: springScale,
        willChange: 'transform',
      }}
    />
  );
}
