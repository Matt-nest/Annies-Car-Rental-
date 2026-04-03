import { useState } from 'react';
import { Save, Eye, EyeOff } from 'lucide-react';

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

function WebhookField({ label, envKey }) {
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
        />
        <button onClick={() => setShow(s => !s)} className="btn-ghost px-3 py-2 shrink-0">
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      <p className="text-[10px] text-stone-400 mt-0.5">Env: {envKey}</p>
    </div>
  );
}

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-stone-900">Settings</h1>
        <button onClick={handleSave} className="btn-primary">
          <Save size={14} /> {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </div>

      <Section title="Business" description="Your rental business information">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="label">Business Name</label>
            <input className="input" defaultValue="Annie's Car Rental" />
          </div>
          <div>
            <label className="label">Owner Name</label>
            <input className="input" defaultValue="Annie" />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input" defaultValue="+17729856667" />
          </div>
          <div className="col-span-2">
            <label className="label">Default Pickup Location</label>
            <input className="input" defaultValue="Port St. Lucie, FL" />
          </div>
          <div>
            <label className="label">Tax Rate (%)</label>
            <input className="input" type="number" step="0.1" defaultValue="7" />
          </div>
          <div>
            <label className="label">Delivery Fee ($)</label>
            <input className="input" type="number" step="1" defaultValue="50" />
          </div>
        </div>
      </Section>

      <Section title="Vehicle Defaults" description="Applied to new vehicles unless overridden">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Daily Mileage Limit</label>
            <input className="input" type="number" defaultValue="250" />
          </div>
          <div>
            <label className="label">Overage Rate ($/mile)</label>
            <input className="input" type="number" step="0.01" defaultValue="0.25" />
          </div>
          <div>
            <label className="label">Default Deposit ($)</label>
            <input className="input" type="number" defaultValue="250" />
          </div>
        </div>
      </Section>

      <Section
        title="GoHighLevel Webhooks"
        description="Paste your GHL inbound webhook URLs. These trigger SMS/email automations when booking events occur."
      >
        <div className="space-y-4">
          <WebhookField label="New Booking (→ notify Annie)" envKey="GHL_WEBHOOK_BOOKING_CREATED" />
          <WebhookField label="Booking Approved (→ notify customer)" envKey="GHL_WEBHOOK_BOOKING_APPROVED" />
          <WebhookField label="Booking Declined (→ notify customer)" envKey="GHL_WEBHOOK_BOOKING_DECLINED" />
          <WebhookField label="Booking Cancelled" envKey="GHL_WEBHOOK_BOOKING_CANCELLED" />
          <WebhookField label="Pickup Reminder (day before)" envKey="GHL_WEBHOOK_PICKUP_REMINDER" />
          <WebhookField label="Return Reminder (day before)" envKey="GHL_WEBHOOK_RETURN_REMINDER" />
          <WebhookField label="Rental Completed + Review Request" envKey="GHL_WEBHOOK_COMPLETED" />
        </div>
        <p className="text-xs text-stone-400 bg-stone-50 p-3 rounded-lg">
          ⚠️ Webhook URLs are stored in your server's environment variables (.env file), not in the database.
          Update them in your deployment platform (Render, Railway, Fly.io) for changes to take effect.
        </p>
      </Section>

      <Section title="Booking Automation" description="Auto-expire settings for unapproved bookings">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Remind Annie after (hours)</label>
            <input className="input" type="number" defaultValue="24" />
          </div>
          <div>
            <label className="label">Auto-decline after (hours)</label>
            <input className="input" type="number" defaultValue="48" />
          </div>
        </div>
      </Section>
    </div>
  );
}
