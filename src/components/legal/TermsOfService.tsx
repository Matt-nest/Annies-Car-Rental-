/**
 * Terms of Service - public page at /terms.
 *
 * Includes the specific SMS program disclosures Twilio reviewers require
 * for A2P 10DLC campaign approval: program name, description, frequency,
 * data rates notice, opt-out instructions in bold, and support contact.
 *
 * Note: this is the Terms of Service for the website + SMS program. The
 * formal Rental Agreement (the legal contract for vehicle rental itself)
 * lives at /rental-agreement and references rentalTerms.ts.
 */

import { ArrowLeft } from 'lucide-react';
import { brand } from '../../config/brand';
import { useTheme } from '../../context/ThemeContext';

const LAST_UPDATED = 'May 13, 2026';

export default function TermsOfService() {
  useTheme();

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
          Terms of Service
        </h1>
        <p className="text-sm mb-10" style={{ color: 'var(--text-tertiary)' }}>
          Last updated: {LAST_UPDATED}
        </p>

        <Section title="1. Acceptance">
          <p>
            By accessing this website, submitting a rental request, or receiving SMS messages from us, you agree to these Terms of Service. If you do not agree, do not use our services. These terms govern the website and SMS program only. The rental of a vehicle itself is governed by the separate <a href="/rental-agreement" className="underline">Rental Agreement</a>, which you will sign before pickup.
          </p>
        </Section>

        <Section title={`2. About ${brand.name}`}>
          <p>
            {brand.name} is operated by <strong>{brand.legalEntity}</strong>, a Florida limited liability company (EIN 99-0908048), located at {brand.location.address}, {brand.location.city}, {brand.location.state}. Contact: <a href={`tel:${brand.phone.replace(/\D/g, '')}`} className="underline">{brand.phone}</a> · <a href={`mailto:${brand.email}`} className="underline">{brand.email}</a>.
          </p>
        </Section>

        <Section title="3. SMS messaging program">
          <p>
            <strong>Program name:</strong> {brand.name} SMS Notifications.
          </p>
          <p>
            <strong>What you'll receive:</strong> By submitting a rental request through this website, you consent to receive recurring SMS messages from {brand.name} about your rental, including booking confirmations, payment receipts, pickup reminders, lockbox codes, day-of-pickup logistics, mid-rental check-ins, return reminders, late-return warnings, post-trip review requests, and occasional loyalty messages.
          </p>
          <p>
            <strong>Message frequency varies</strong> based on rental length and lifecycle stage, typically 5 to 10 messages per rental. <strong>Message and data rates may apply</strong> as charged by your wireless carrier; {brand.name} does not charge for SMS messages themselves.
          </p>
          <p>
            <strong>To stop receiving messages, reply STOP, UNSUB, CANCEL, END, or QUIT.</strong> You will receive a single confirmation reply. After that, you will receive no further automated SMS from {brand.name}. The opt-out is honored both at the Twilio carrier layer and within {brand.name}'s own application database.
          </p>
          <p>
            <strong>For help, reply HELP</strong> or call <a href={`tel:${brand.phone.replace(/[^\d+]/g, '')}`} className="underline">{brand.phone}</a> or email <a href={`mailto:${brand.email}`} className="underline">{brand.email}</a>.
          </p>
          <p>
            We use Twilio Inc. as our SMS delivery provider. Phone numbers are not shared with third parties for marketing purposes and are never sold. Full SMS data handling is described in our <a href="/privacy" className="underline">Privacy Policy</a>.
          </p>
        </Section>

        <Section title="4. Eligibility to rent">
          <p>
            To submit a rental request you must:
          </p>
          <ul>
            <li>Be at least 21 years of age (additional drivers must be 25 or older)</li>
            <li>Hold a valid driver's license issued by a U.S. state or recognized jurisdiction</li>
            <li>Provide accurate identification, contact, and payment information</li>
            <li>Have the legal capacity to enter into a binding contract</li>
          </ul>
          <p>
            We reserve the right to decline any rental request at our discretion. Submitting a request does not guarantee approval; bookings move from pending to approved only after {brand.name} confirms the vehicle and dates.
          </p>
        </Section>

        <Section title="5. Booking and cancellation">
          <p>
            Pricing and availability shown on this website are subject to change until a booking is approved. After approval, the agreed pricing is locked through the rental.
          </p>
          <p>
            <strong>Cancellations:</strong> You may cancel a booking at any time before pickup. Full details on cancellation timing, refunds, and no-show policies are in the <a href="/rental-agreement" className="underline">Rental Agreement</a>. Auto-decline applies to any booking that remains unapproved 48 hours after submission.
          </p>
        </Section>

        <Section title="6. Payment terms">
          <p>
            Payment is processed through {brand.paymentProvider === 'stripe' ? 'Stripe' : 'Square'} at the time of booking confirmation. A refundable security deposit is collected with checkout and released or settled within 3 to 5 business days after vehicle return and inspection. Incidentals (cleaning, smoking, pet, late-return, mileage overage, tolls, damage) are charged against the security deposit per the <a href="/rental-agreement" className="underline">Rental Agreement</a>.
          </p>
        </Section>

        <Section title="7. Use of the website">
          <p>
            You agree to use this website only for lawful purposes. You may not attempt to gain unauthorized access to any part of the system, submit fraudulent rental requests, impersonate another person, or use automation to scrape availability or pricing data.
          </p>
        </Section>

        <Section title="8. Intellectual property">
          <p>
            All content on this site (including text, photos, logos, vehicle images, and the booking interface) is owned by Aaron's Garage LLC or used with permission. You may not copy, reproduce, or redistribute the content without written permission.
          </p>
        </Section>

        <Section title="9. Disclaimers">
          <p>
            The website is provided on an "as is" basis. While we make reasonable efforts to keep vehicle availability and pricing current, we do not warrant that the information is free of errors. We are not responsible for delays in SMS delivery caused by your wireless carrier or by external systems beyond our control.
          </p>
        </Section>

        <Section title="10. Limitation of liability">
          <p>
            To the maximum extent permitted by Florida law, Aaron's Garage LLC and its officers, employees, and contractors are not liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of this website or our SMS program. Our total liability for any claim arising from these Terms of Service shall not exceed the total amount you paid for the rental that gave rise to the claim.
          </p>
        </Section>

        <Section title="11. Governing law">
          <p>
            These Terms of Service are governed by the laws of the State of Florida, without regard to its conflict-of-laws principles. Any dispute arising from these terms shall be brought exclusively in the state or federal courts located in St. Lucie County, Florida.
          </p>
        </Section>

        <Section title="12. Changes to these terms">
          <p>
            We may update these terms at any time. Material changes will be reflected in the "Last updated" date at the top of this page. Continued use of the website or SMS program after a change constitutes acceptance of the revised terms.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            {brand.legalEntity}, dba {brand.name}<br />
            {brand.location.address}<br />
            {brand.location.city}, {brand.location.state}<br />
            <a href={`tel:${brand.phone.replace(/\D/g, '')}`} className="underline">{brand.phone}</a><br />
            <a href={`mailto:${brand.email}`} className="underline">{brand.email}</a>
          </p>
        </Section>

        <div className="mt-12 pt-6 text-xs" style={{ color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-subtle)' }}>
          <p>
            See also: <a href="/privacy" className="underline">Privacy Policy</a> · <a href="/rental-agreement" className="underline">Rental Agreement</a> · <a href="/" className="underline">Home</a>
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
