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

export default function CrispWidget({ booking }: CrispWidgetProps) {
  const scriptRef = useRef<HTMLScriptElement | null>(null);

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

  return null;
}
