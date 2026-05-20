/* ── Automated Sequences Tab ── */
const SEQUENCES = [
  {
    stage: 'pickup_reminder',
    label: '24h Pre-Pickup Reminder',
    trigger: 'pickup_date = tomorrow',
    color: '#f59e0b',
    desc: 'Sent the day before pickup to approved/confirmed bookings. Includes lockbox code and portal link.',
  },
  {
    stage: 'mid_rental_checkin',
    label: 'Mid-Rental Check-In',
    trigger: 'Day 3 of active rental',
    color: '#8b5cf6',
    desc: 'Sent on day 3 to active rentals. Warm check-in, surfaces portal link for any questions.',
  },
  {
    stage: 'extension_offer',
    label: 'Extension Offer',
    trigger: '1 day before return (3+ day rentals)',
    color: '#D4AF37',
    desc: 'Upsell opportunity sent the day before scheduled return. Only fires for rentals ≥ 3 days.',
  },
  {
    stage: 'return_reminder',
    label: '24h Return Reminder',
    trigger: 'return_date = tomorrow',
    color: '#ec4899',
    desc: 'Return instructions and portal link sent the day before the scheduled return date.',
  },
  {
    stage: 'rental_completed',
    label: 'Review Request',
    trigger: 'Day after return (status = completed)',
    color: '#22c55e',
    desc: 'Review request with portal link sent the day after a booking is marked completed.',
  },
  {
    stage: 'repeat_customer',
    label: 'Repeat Customer Loyalty',
    trigger: '30 days after return',
    color: '#465FFF',
    desc: 'Loyalty message 30 days after completion. Links back to the fleet to encourage rebooking.',
  },
  {
    stage: 'late_return_warning',
    label: 'Late Return Warning',
    trigger: 'return_date < today (daily)',
    color: '#f97316',
    desc: 'Fires every day the vehicle is overdue. Polite reminder with portal link.',
  },
  {
    stage: 'late_return_escalation',
    label: 'Late Return Escalation',
    trigger: '4 days overdue (once)',
    color: '#dc2626',
    desc: 'Single escalation fired exactly 4 days after the missed return date. Urgent tone.',
  },
];

export default function SequencesTab() {
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Automated Sequences
        </h2>
        <p style={{ fontSize: 12, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
          These fire automatically from the daily cron job (9am ET). Each sequence uses the
          matching template from the Templates tab — edit templates there to change the message.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {SEQUENCES.map(seq => (
          <div key={seq.stage} style={{
            display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px',
            borderRadius: 12, border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-card)',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
              backgroundColor: seq.color, boxShadow: `0 0 6px ${seq.color}66`,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                  {seq.label}
                </span>
                <span style={{
                  fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 999,
                  backgroundColor: `${seq.color}18`, color: seq.color, fontFamily: 'monospace',
                }}>
                  {seq.trigger}
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 4, lineHeight: 1.5 }}>
                {seq.desc}
              </p>
            </div>
            <span style={{
              fontSize: 10, color: 'var(--text-tertiary)', fontFamily: 'monospace',
              whiteSpace: 'nowrap', flexShrink: 0, marginTop: 2,
            }}>
              {seq.stage}
            </span>
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 16 }}>
        Cron schedule: daily at 9am ET · Secured by CRON_SECRET · Route: GET /api/v1/cron/daily
      </p>
    </div>
  );
}
