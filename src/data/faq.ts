/**
 * FAQ content — single source of truth.
 *
 * Consumed by two places that must never drift:
 *   1. src/components/home/FAQ.tsx  → renders the on-page accordion
 *   2. vite.config.ts (brand plugin) → emits FAQPage JSON-LD into the static
 *      index.html at build time, so the structured data is crawlable without JS.
 *
 * Keep this file dependency-free (plain data) so the Vite config can import it
 * during the Node build without pulling in any browser/React code.
 */
export interface FaqItem {
  q: string;
  a: string;
}

export const faqs: FaqItem[] = [
  { q: 'How does the booking process work?', a: "Browse our fleet, select a vehicle, and submit a request with your preferred dates. We'll review availability and get back to you quickly. No charge is made until your request is confirmed." },
  { q: 'What are the driver requirements?', a: "Drivers must be at least 25 years old, hold a valid driver's license, and provide proof of active personal auto insurance." },
  { q: 'Is there a mileage limit?', a: 'Every rental includes 200 miles per day. Need more? Additional miles are just $0.34/mile, or let us know when booking and we\'ll work out a rate that fits your trip.' },
  { q: 'Do you offer delivery?', a: 'Yes, we offer delivery and pickup for your convenience. Arrangements are made after your request is approved.' },
  { q: 'How does insurance work?', a: "Protection options are available for every rental. We'll discuss coverage details with you after your request is approved — no insurance purchase is required at the time of your initial request." },
  { q: 'What additional fees could apply?', a: 'We keep pricing transparent. Beyond your rental rate, fees only apply if you incur them: tolls and traffic violations ($50 admin fee each), fuel refill ($20 per quarter tank), late returns ($30/day), mileage over 200 mi/day ($0.34/mile), or excessive cleaning/smoking/pet damage (up to $250). These incidentals are deducted from your refundable security deposit.' },
  { q: 'How does the security deposit work?', a: 'A refundable security deposit is collected with your payment and covers any potential incidentals. After the vehicle is returned and inspected, the full deposit is refunded — minus any applicable charges for damages, tolls, or cleaning fees.' },
  { q: 'What is your cancellation policy?', a: 'Full refunds are provided for cancellations made at least 48 hours before the scheduled start time.' },
  { q: 'Do you offer weekly rates?', a: 'Yes — all vehicles are available for daily or weekly rental. Weekly rates are displayed on each vehicle listing and typically offer meaningful savings.' },
];
