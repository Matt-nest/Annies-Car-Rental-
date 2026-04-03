import { useState } from 'react';
import { Eye, EyeOff, ExternalLink, Info } from 'lucide-react';

function Section({ title, description, children }) {
  return (
    <div className="card p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-stone-900">{title}</h2>
        {description && <p className="text-xs text-stone-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

function EnvRow({ label, envKey, value, note }) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-start justify-between gap-4 py-2 border-b border-stone-50 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-800">{label}</p>
        <p className="text-[11px] font-mono text-stone-400 mt-0.5">{envKey}</p>
        {note && <p className="text-[11px] text-stone-400 mt-0.5">{note}</p>}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${value ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>
          {value ? 'Set' : 'Not set'}
        </span>
      </div>
    </div>
  );
}

function WebhookRow({ label, envKey }) {
  const [show, setShow] = useState(false);
  const [val, setVal] = useState('');
  return (
    <div>
      <label className="label">{label}</label>
      <div className="flex gap-2">
        <input
          type={show ? 'text' : 'password'}
          className="input font-mono text-xs flex-1"
          value={val}
          onChange={e => setVal(e.target.value)}
          placeholder="https://services.leadconnectorhq.com/hooks/..."
          readOnly
        />
        <button onClick={() => setShow(s => !s)} className="btn-ghost px-3 py-2 shrink-0">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <p className="text-[10px] text-stone-400 mt-0.5">Env var: {envKey}</p>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-stone-900">Settings</h1>
        <p className="text-sm text-stone-500 mt-1">Configuration reference — all settings are managed via Vercel environment variables.</p>
      </div>

      <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <Info size={15} className="mt-0.5 shrink-0 text-blue-500" />
        <div>
          <p className="font-medium">Settings are environment variables</p>
          <p className="text-blue-700 mt-0.5 text-xs">
            To change any value, update it in your{' '}
            <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer" className="underline inline-flex items-center gap-0.5">
              Vercel dashboard <ExternalLink size={10} />
            </a>{' '}
            under the backend project → Settings → Environment Variables, then redeploy.
          </p>
        </div>
      </div>

      <Section title="Business" description="Core business configuration (backend env vars)">
        <div className="space-y-0">
          <EnvRow label="Owner Name" envKey="OWNER_NAME" note="Used in counter-signature and notifications" />
          <EnvRow label="Business Phone" envKey="BUSINESS_PHONE" />
          <EnvRow label="Default Pickup Location" envKey="DEFAULT_PICKUP_LOCATION" />
          <EnvRow label="Tax Rate" envKey="TAX_RATE" note="Currently hardcoded at 7% (Florida)" />
          <EnvRow label="Delivery Fee" envKey="DELIVERY_FEE" note="Currently hardcoded at $50" />
        </div>
      </Section>

      <Section title="Booking Automation" description="Timing for auto-expire and reminders (hardcoded in cron job)">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="font-medium text-stone-800">24 hours</p>
            <p className="text-stone-500 text-xs mt-0.5">Approval reminder sent to Annie</p>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="font-medium text-stone-800">48 hours</p>
            <p className="text-stone-500 text-xs mt-0.5">Unapproved booking auto-declined</p>
          </div>
          <div className="bg-stone-50 rounded-lg p-3">
            <p className="font-medium text-stone-800">Daily at 9 AM ET</p>
            <p className="text-stone-500 text-xs mt-0.5">Cron job runs (Vercel Hobby plan)</p>
          </div>
        </div>
        <p className="text-xs text-stone-400">To change these values, edit <span className="font-mono bg-stone-100 px-1 rounded">backend/routes/cron.js</span> and redeploy.</p>
      </Section>

      <Section
        title="GoHighLevel Webhooks"
        description="SMS/email automation triggers — set these in Vercel backend environment variables"
      >
        <div className="space-y-0">
          <EnvRow label="New Booking" envKey="GHL_WEBHOOK_BOOKING_CREATED" note="Notifies Annie of new request" />
          <EnvRow label="Booking Approved" envKey="GHL_WEBHOOK_BOOKING_APPROVED" note="Notifies customer" />
          <EnvRow label="Booking Declined" envKey="GHL_WEBHOOK_BOOKING_DECLINED" note="Notifies customer" />
          <EnvRow label="Booking Cancelled" envKey="GHL_WEBHOOK_BOOKING_CANCELLED" />
          <EnvRow label="Pickup Reminder" envKey="GHL_WEBHOOK_PICKUP_REMINDER" note="Day before pickup" />
          <EnvRow label="Return Reminder" envKey="GHL_WEBHOOK_RETURN_REMINDER" note="Day before return" />
          <EnvRow label="Overdue" envKey="GHL_WEBHOOK_BOOKING_OVERDUE" />
          <EnvRow label="Completed + Review Request" envKey="GHL_WEBHOOK_COMPLETED" />
        </div>
      </Section>

      <Section title="Email" description="Transactional emails via Resend (resend.com — free tier available)">
        <div className="space-y-0">
          <EnvRow label="Resend API Key" envKey="RESEND_API_KEY" note="Create a free account at resend.com, verify your domain, generate a key" />
          <EnvRow label="From Address" envKey="EMAIL_FROM" note="e.g. Annie's Car Rental <noreply@anniescarrental.com>" />
          <EnvRow label="Site URL" envKey="SITE_URL" note="e.g. https://anniescarrental.com — used in email links" />
        </div>
        <p className="text-xs text-stone-400">Without RESEND_API_KEY the confirmation email is skipped but everything else works normally.</p>
      </Section>

      <Section title="Stripe" description="Payment processing">
        <div className="space-y-0">
          <EnvRow label="Secret Key" envKey="STRIPE_SECRET_KEY" note="Backend only — never expose to frontend" />
          <EnvRow label="Webhook Secret" envKey="STRIPE_WEBHOOK_SECRET" note="From Stripe dashboard → Webhooks" />
          <EnvRow label="Publishable Key" envKey="VITE_STRIPE_PUBLISHABLE_KEY" note="Frontend (customer site)" />
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg">
          Currently using test mode keys. Switch to live keys when ready to take real payments.
        </p>
      </Section>
    </div>
  );
}
