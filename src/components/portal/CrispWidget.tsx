import { useEffect, useRef } from 'react';
import { CRISP_WEBSITE_ID } from '../../config';

interface CrispWidgetProps {
  booking: {
    booking_code?: string;
    customer_name?: string;
    customer_email?: string;
    customer_phone?: string;
    vehicle_name?: string;
    status?: string;
    pickup_date?: string;
    return_date?: string;
  } | null;
  /**
   * F-16: portal mounts this widget once at the root and toggles visibility
   * via the `visible` prop instead of unmount/remount. Default true so existing
   * call sites keep working.
   */
  visible?: boolean;
}

declare global {
  interface Window {
    $crisp: any[];
    CRISP_WEBSITE_ID: string;
  }
}

export function openCrispChat() {
  try {
    if (window.$crisp) window.$crisp.push(['do', 'chat:open']);
  } catch { /* script not ready */ }
}

export default function CrispWidget({ booking, visible = true }: CrispWidgetProps) {
  const scriptRef = useRef<HTMLScriptElement | null>(null);
  const initialVisibleRef = useRef<boolean>(visible);

  useEffect(() => {
    if (!CRISP_WEBSITE_ID) return;

    window.$crisp = [];
    window.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

    // Suppress auto-pop greeter
    window.$crisp.push(['safe', true]);
    window.$crisp.push(['config', 'position:reverse', [true]]);

    // Inject script
    const script = document.createElement('script');
    script.src = 'https://client.crisp.chat/l.js';
    script.async = true;
    scriptRef.current = script;
    document.head.appendChild(script);

    // Identify user once script has loaded
    script.onload = () => {
      // Apply initial visibility (login view starts hidden, dashboard shows it).
      // Subsequent prop changes are handled by the visibility effect below.
      try {
        window.$crisp.push(['do', initialVisibleRef.current ? 'chat:show' : 'chat:hide']);
      } catch { /* script not ready */ }

      if (!booking) return;
      if (booking.customer_email)
        window.$crisp.push(['set', 'user:email', [booking.customer_email]]);
      if (booking.customer_name)
        window.$crisp.push(['set', 'user:nickname', [booking.customer_name]]);
      if (booking.customer_phone)
        window.$crisp.push(['set', 'user:phone', [booking.customer_phone]]);

      window.$crisp.push(['set', 'session:data', [[
        ['booking_code', booking.booking_code || ''],
        ['vehicle',      booking.vehicle_name  || ''],
        ['status',       booking.status        || ''],
        ['pickup',       booking.pickup_date   || ''],
        ['return',       booking.return_date   || ''],
      ]]]);
    };

    return () => {
      // Cleanup: remove script and reset globals
      if (scriptRef.current) {
        document.head.removeChild(scriptRef.current);
        scriptRef.current = null;
      }
      try {
        const crispEl = document.getElementById('crisp-chatbox');
        if (crispEl) crispEl.remove();
      } catch { /* already removed */ }
      delete (window as any).$crisp;
      delete (window as any).CRISP_WEBSITE_ID;
    };
  }, []);

  // Re-identify if booking data loads after script (async portal auth)
  useEffect(() => {
    if (!booking || !window.$crisp) return;
    try {
      if (booking.customer_email)
        window.$crisp.push(['set', 'user:email', [booking.customer_email]]);
      if (booking.customer_name)
        window.$crisp.push(['set', 'user:nickname', [booking.customer_name]]);
      if (booking.customer_phone)
        window.$crisp.push(['set', 'user:phone', [booking.customer_phone]]);

      window.$crisp.push(['set', 'session:data', [[
        ['booking_code', booking.booking_code || ''],
        ['vehicle',      booking.vehicle_name  || ''],
        ['status',       booking.status        || ''],
        ['pickup',       booking.pickup_date   || ''],
        ['return',       booking.return_date   || ''],
      ]]]);
    } catch { /* $crisp not ready yet */ }
  }, [booking]);

  // F-16: respond to visibility changes via Crisp's API instead of unmount.
  // Reduces DOM/script accumulation across portal-view changes.
  useEffect(() => {
    if (!window.$crisp) return;
    try {
      window.$crisp.push(['do', visible ? 'chat:show' : 'chat:hide']);
    } catch { /* script not ready yet - initial visibility will apply onload */ }
  }, [visible]);

  return null;
}
