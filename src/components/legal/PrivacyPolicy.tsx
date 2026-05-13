/**
 * Privacy Policy — public page at /privacy.
 *
 * Content satisfies the disclosures Twilio reviewers require for A2P 10DLC
 * SMS campaign approval: explicit mention of data collected, that phone
 * numbers are used for SMS, that data is not shared with third parties for
 * marketing, and that data is not sold. Keep this page in sync with the
 * actual privacy practices and the A2P consent description.
 */

import { ArrowLeft } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const LAST_UPDATED = 'May 13, 2026';

export default function PrivacyPolicy() {
  useTheme();   // ensures CSS vars are bound

  return (
    <div className="min-h-screen">
      <header
        className="sticky top-0 z-10 backdrop-blur-md"
        style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium opacity-70 hover:opacity-100 transition-opacity"
            style={{ color: 'var(--text-secondary)' }}
          >
            <ArrowLeft size={14} /> Home
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
        <p className="text-[11px] uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: 'var(--text-tertiary)' }}>
          Legal
        </p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2" style={{ color: 'var(--text-primary)' }}>
          Privacy Policy
        </h1>
        <p className="text-sm mb-10" style={{ color: 'var(--text-tertiary)' }}>
          Last updated: {LAST_UPDATED}
        </p>

        <Section title="1. Who we are">
          <p>
            Annie's Car Rental is operated by <strong>Aaron's Garage LLC</strong>, a Florida limited liability company located at 586 NW Mercantile Pl, Port St. Lucie, FL 34986. In this policy, "we," "us," and "Annie's" all refer to the same entity. Questions about this policy can be directed to <a href="mailto:aaron@anniescarrental.com" className="underline">aaron@anniescarrental.com</a> or <a href="tel:+17729856667" className="underline">(772) 985-6667</a>.
          </p>
        </Section>

        <Section title="2. Information we collect">
          <p>We collect only the information necessary to provide vehicle rental services:</p>
          <ul>
            <li><strong>Identity and contact data:</strong> first and last name, email address, phone number, and date of birth.</li>
            <li><strong>Driver verification:</strong> driver's license number, issuing state, expiration date, and an uploaded image of your license.</li>
            <li><strong>Address:</strong> street, city, state, and ZIP for billing and rental agreement records.</li>
            <li><strong>Payment data:</strong> processed exclusively by <strong>Stripe</strong>. We never see or store your full card number — Stripe returns only a last-4 digit reference and the card brand for our records.</li>
            <li><strong>Rental activity:</strong> booking dates, pickup and return times, vehicle assigned, pricing, mileage, and post-trip inspection notes.</li>
            <li><strong>Communications:</strong> messages you send or receive through our booking confirmation, SMS reminders, email receipts, and in-app chat.</li>
          </ul>
        </Section>

        <Section title="3. How we use your phone number for SMS">
          <p>
            When you submit a rental request on this website, you explicitly consent to receive SMS messages from Annie's Car Rental related to your rental. We use your phone number to send:
          </p>
          <ul>
            <li>Booking confirmations and approval status updates</li>
            <li>Payment receipts</li>
            <li>Pickup reminders 24 hours and the morning of pickup, including lockbox code and address</li>
            <li>Mid-rental check-ins on rentals lasting three or more days</li>
            <li>Return reminders 24 hours and the morning of return</li>
            <li>Late-return warnings if a vehicle is past its return time</li>
            <li>Post-trip review requests one day after return</li>
            <li>Occasional loyalty messages thirty days after a completed rental</li>
          </ul>
          <p>
            <strong>Message and data rates may apply.</strong> Message frequency varies by rental length. You can reply <strong>STOP</strong>, <strong>UNSUB</strong>, <strong>CANCEL</strong>, <strong>END</strong>, or <strong>QUIT</strong> at any time to stop receiving messages. Reply <strong>HELP</strong> for support or call <a href="tel:+17729856667" className="underline">(772) 985-6667</a>.
          </p>
          <p>
            <strong>We do not share your phone number with third parties for marketing purposes. We do not sell your phone number. We do not use your phone number for marketing by any other company.</strong> SMS opt-in data is not shared with anyone, ever — including affiliates.
          </p>
        </Section>

        <Section title="4. Service providers we use">
          <p>To deliver the booking experience, we share specific data with these processors only as needed:</p>
          <ul>
            <li><strong>Twilio Inc.</strong> — SMS delivery and inbound webhook for opt-out handling. Receives your phone number and the message body.</li>
            <li><strong>Resend</strong> — Transactional email delivery. Receives your email address and message content.</li>
            <li><strong>Stripe, Inc.</strong> — Payment processing. Receives card details directly from your browser; we never receive them. Receives your name and email for receipt.</li>
            <li><strong>Bonzah (Bonzah Inc.)</strong> — Optional rental insurance purchased through the booking flow. Receives your name, address, date of birth, and rental dates only if you elect coverage.</li>
            <li><strong>Bouncie (Bouncie LLC)</strong> — Vehicle telematics (GPS and odometer). Receives no customer data — only operates on our fleet vehicles.</li>
            <li><strong>Supabase</strong> — Database hosting (encrypted at rest) and authentication for our admin staff. Stores all customer data described in Section 2.</li>
            <li><strong>Vercel, Inc.</strong> — Application hosting for this website and admin dashboard.</li>
          </ul>
          <p>
            All processors have entered into data-processing agreements consistent with their published privacy commitments. None of these processors are permitted to use your data for their own marketing purposes.
          </p>
        </Section>

        <Section title="5. How we use your information">
          <p>We use the information we collect to:</p>
          <ul>
            <li>Prepare, confirm, and fulfill your vehicle rental</li>
            <li>Verify your eligibility to drive (license validity and age)</li>
            <li>Authorize and process payments for the rental, security deposit, and any incidentals</li>
            <li>Communicate with you about your active rental via SMS and email</li>
            <li>Maintain records for tax, insurance, and legal compliance</li>
            <li>Investigate disputes and damage claims</li>
            <li>Improve the booking experience</li>
          </ul>
          <p>We do not perform automated decision-making or profiling that produces legal effects regarding you.</p>
        </Section>

        <Section title="6. Data retention">
          <p>
            We retain rental records for seven years for tax and insurance purposes. We retain SMS opt-out flags indefinitely so that customers who have opted out are never re-contacted. You may request earlier deletion by emailing <a href="mailto:aaron@anniescarrental.com" className="underline">aaron@anniescarrental.com</a> — we will delete data not subject to legal retention requirements within thirty days of the request.
          </p>
        </Section>

        <Section title="7. Your rights">
          <p>Depending on where you live, you may have the right to:</p>
          <ul>
            <li>Access the personal information we hold about you</li>
            <li>Correct inaccurate information</li>
            <li>Delete your information (subject to the retention limits in Section 6)</li>
            <li>Opt out of SMS at any time by replying STOP or by emailing us</li>
            <li>Opt out of email by replying to any email asking to be removed</li>
          </ul>
          <p>To exercise any of these rights, email <a href="mailto:aaron@anniescarrental.com" className="underline">aaron@anniescarrental.com</a>. We respond within seven business days.</p>
        </Section>

        <Section title="8. Security">
          <p>
            Data in transit is protected by TLS. Data at rest in our Supabase database is encrypted by the database provider. Payment data is handled exclusively by Stripe within their PCI-DSS compliant environment — we never store full card numbers. Admin access to customer data is restricted to authenticated staff members.
          </p>
        </Section>

        <Section title="9. Children">
          <p>
            Our services are not directed to anyone under 21 (the minimum rental age in Florida). We do not knowingly collect information from children. If you believe we have inadvertently collected information from a minor, please contact us and we will delete it.
          </p>
        </Section>

        <Section title="10. Changes to this policy">
          <p>
            If we make material changes to this policy, we will update the "Last updated" date at the top of this page and, where appropriate, notify active customers via email. Continued use of our services after a change constitutes acceptance of the revised policy.
          </p>
        </Section>

        <Section title="11. Contact">
          <p>
            Annie's Car Rental (Aaron's Garage LLC)<br />
            586 NW Mercantile Pl<br />
            Port St. Lucie, FL 34986<br />
            <a href="tel:+17729856667" className="underline">(772) 985-6667</a><br />
            <a href="mailto:aaron@anniescarrental.com" className="underline">aaron@anniescarrental.com</a>
          </p>
        </Section>

        <div className="mt-12 pt-6 text-xs" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)' }}>
          <p>
            See also: <a href="/terms" className="underline">Terms of Service</a> · <a href="/" className="underline">Home</a>
          </p>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
        {title}
      </h2>
      <div
        className="text-[15px] leading-relaxed space-y-3 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-1.5 [&>ul]:my-3"
        style={{ color: 'var(--text-secondary)' }}
      >
        {children}
      </div>
    </section>
  );
}
