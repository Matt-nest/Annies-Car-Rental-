/**
 * SEO landing-page content — the data source for high-intent location/service
 * pages (e.g. /weekly-car-rentals-port-st-lucie).
 *
 * Read by TWO consumers, so it must stay DEPENDENCY-FREE plain data:
 *   1. src/components/seo/LandingPage.tsx → renders the interactive React page
 *   2. vite.config.ts (Node build)        → (a) emits a prerendered static
 *      <slug>/index.html with this copy in the crawlable <body>, and (b) adds
 *      each slug to sitemap.xml.
 *
 * ⚠️  Do NOT import src/config/brand.ts (or anything using import.meta.env) here
 *     — vite.config.ts imports this file in a Node context where import.meta.env
 *     is undefined. The brand name/phone are appended by each consumer instead,
 *     so this file holds only the page-specific copy.
 *
 * WHITE-LABEL: this is per-clone content. Clones edit this array for their own
 * cities/services; the routing + prerender + sitemap pipeline is shared and
 * picks up whatever is listed here.
 */
export interface SeoHighlight {
  label: string;
  desc: string;
}

export interface SeoFaq {
  q: string;
  a: string;
}

export interface SeoPage {
  /** URL path segment, no leading slash. Also the prerender output dir. */
  slug: string;
  /** schema.org Service serviceType + breadcrumb leaf name. */
  serviceName: string;
  /** Primary city this page targets (used in Service areaServed). */
  city: string;
  /** Page-specific <title>; the brand name is appended by the consumer. */
  title: string;
  metaDescription: string;
  h1: string;
  /** Lead paragraph under the H1. */
  intro: string;
  /** Body paragraphs (each rendered as its own <p>). */
  body: string[];
  highlights: SeoHighlight[];
  faqs: SeoFaq[];
}

export const seoPages: SeoPage[] = [
  {
    slug: 'weekly-car-rentals-port-st-lucie',
    serviceName: 'Weekly Car Rental',
    city: 'Port St. Lucie',
    title: 'Weekly Car Rentals in Port St. Lucie, FL',
    metaDescription:
      'Affordable weekly car rentals in Port St. Lucie for gig drivers and locals. Same-day pickup, unlimited-style mileage plans, no airport lines. Book directly with the owner.',
    h1: 'Weekly Car Rentals in Port St. Lucie',
    intro:
      'Reliable, well-maintained vehicles by the week — built for Uber, Lyft, and delivery drivers, snowbirds, and anyone who needs dependable wheels without the airport runaround.',
    body: [
      'Renting by the week in Port St. Lucie should be simple. You deal directly with the owner — no corporate counter, no upsells, no fine print. Tell us how long you need a car and what you’re using it for, and we’ll put together a weekly rate that actually makes sense for your situation.',
      'Every car is inspected and detailed before each rental at our Port St. Lucie facility, and we offer same-day pickup and local delivery so you can get on the road fast. Driving for a rideshare or delivery platform? We work with gig drivers every day and understand what the apps require.',
    ],
    highlights: [
      { label: 'Gig-driver friendly', desc: 'Vehicles that meet Uber, Lyft, DoorDash, and Instacart requirements.' },
      { label: 'Same-day pickup & local delivery', desc: 'Get on the road today — no airport lines, no waiting.' },
      { label: 'Generous weekly mileage', desc: 'Plans built for high-mileage drivers, with fair per-mile rates.' },
      { label: 'Direct, local pricing', desc: 'Personal weekly rates set with the owner — no platform fees.' },
    ],
    faqs: [
      { q: 'How much does a weekly car rental cost in Port St. Lucie?', a: 'Weekly rates depend on the vehicle and how long you need it. Because you rent directly with the owner, we set a fair weekly price for your situation — call or text us and we’ll work it out.' },
      { q: 'Can I rent a car weekly for Uber or DoorDash?', a: 'Yes. We work with rideshare and delivery drivers and offer vehicles that meet platform requirements. Let us know which app you drive for and we’ll match you with the right car.' },
      { q: 'Do you offer same-day pickup?', a: 'Yes — same-day pickup and local delivery are available in the Port St. Lucie area so you can start driving right away.' },
      { q: 'What do I need to rent a car by the week?', a: 'Drivers must be at least 25, hold a valid driver’s license, and provide proof of active personal auto insurance. A refundable security deposit is collected with payment.' },
    ],
  },
  {
    slug: 'uber-lyft-rentals-port-st-lucie',
    serviceName: 'Uber & Lyft Rental',
    city: 'Port St. Lucie',
    title: 'Uber & Lyft Rental Cars in Port St. Lucie, FL',
    metaDescription:
      'Rent a car for Uber or Lyft in Port St. Lucie. Rideshare-ready vehicles, flexible weekly rates, same-day pickup, and no long-term contract. Start driving this week.',
    h1: 'Uber & Lyft Rental Cars in Port St. Lucie',
    intro:
      'Get a rideshare-ready vehicle and start earning this week. We rent directly to Uber and Lyft drivers across Port St. Lucie and the Treasure Coast — no dealership, no contract, no runaround.',
    body: [
      'Driving for Uber or Lyft means your car is your business, and downtime costs you money. Our vehicles are clean, late-model, and maintained to keep you eligible and on the road. Rent by the week, extend whenever you need to, and hand it back when your schedule changes — you’re never locked into a long contract.',
      'Because you deal directly with the owner, there are no platform markups or hidden rental-network fees. Tell us how many hours you plan to drive and we’ll match you with a fuel-efficient car and a weekly rate that leaves room for profit.',
    ],
    highlights: [
      { label: 'Rideshare-eligible vehicles', desc: 'Clean, late-model cars that meet Uber and Lyft vehicle standards.' },
      { label: 'Fuel-efficient picks', desc: 'Lower gas spend per shift means more of every fare stays with you.' },
      { label: 'Drive this week', desc: 'Same-day pickup and local delivery so you can get on the platform fast.' },
      { label: 'No long-term lock-in', desc: 'Weekly terms with easy extensions — pause when life happens.' },
    ],
    faqs: [
      { q: 'Can I use your rental car for Uber and Lyft?', a: 'Yes. Our vehicles meet Uber and Lyft requirements, and you can drive for both platforms on the same rental. Just let us know you’ll be doing rideshare when you book.' },
      { q: 'Does the car need to be in my name to drive for Uber?', a: 'Uber and Lyft allow rentals through approved partners. We provide the documentation you need showing you’re authorized to use the vehicle for rideshare.' },
      { q: 'How fast can I start driving?', a: 'Most drivers can pick up the same day. Once your license, insurance, and deposit are squared away, the car is yours and you can go online right away.' },
      { q: 'What are the requirements to rent?', a: 'You’ll need to be at least 25, hold a valid driver’s license, and show proof of active personal auto insurance. A refundable deposit is collected at booking.' },
    ],
  },
  {
    slug: 'doordash-instacart-rental-car',
    serviceName: 'Delivery Driver Rental',
    city: 'Port St. Lucie',
    title: 'Rental Cars for DoorDash, Instacart & Delivery Drivers',
    metaDescription:
      'Rent a reliable car for DoorDash, Instacart, Uber Eats, and Amazon Flex in Port St. Lucie. Weekly rates, generous mileage, same-day pickup. Built for delivery drivers.',
    h1: 'Rental Cars for DoorDash & Instacart Drivers in Port St. Lucie',
    intro:
      'Delivery driving runs on miles, and miles run on a dependable car. We rent to DoorDash, Instacart, Uber Eats, and Amazon Flex drivers across Port St. Lucie with weekly plans built for high-mileage work.',
    body: [
      'Stacking orders across town adds up fast, so our delivery rentals come with generous mileage and fair per-mile rates — no surprise charges at the end of the week. Every car is inspected and detailed before pickup, so you spend your shift earning instead of worrying about breakdowns.',
      'Whether you run mornings for Instacart, evenings for DoorDash, or both, you rent directly from the owner with a weekly rate that fits your route. Need delivery of the car itself? We’ll bring it to you locally and get you driving the same day.',
    ],
    highlights: [
      { label: 'Generous weekly mileage', desc: 'High-mileage plans with fair per-mile rates — no end-of-week surprises.' },
      { label: 'Reliable, inspected cars', desc: 'Detailed and checked before every rental so you don’t lose a shift.' },
      { label: 'Multi-app friendly', desc: 'Run DoorDash, Instacart, Uber Eats, and Amazon Flex on one rental.' },
      { label: 'Same-day & delivered', desc: 'Local car delivery and same-day pickup to start earning now.' },
    ],
    faqs: [
      { q: 'Can I rent a car just for DoorDash or Instacart?', a: 'Absolutely. Many of our drivers rent specifically for delivery work. Tell us which apps you run and roughly how many miles you drive, and we’ll match you with the right car and rate.' },
      { q: 'Is there a mileage limit for delivery drivers?', a: 'Rentals include a daily mileage allowance, and because delivery is high-mileage we offer plans with extra miles built in. We’ll set you up with terms that fit your routes.' },
      { q: 'Can I drive for multiple delivery apps at once?', a: 'Yes — there’s no restriction on running DoorDash, Instacart, Uber Eats, and Amazon Flex on the same rental. Stack them however you like.' },
      { q: 'Do you deliver the rental car to me?', a: 'Yes, local delivery and pickup are available in the Port St. Lucie area. We’ll arrange it once your request is approved.' },
    ],
  },
  {
    slug: 'car-rental-fort-pierce',
    serviceName: 'Car Rental',
    city: 'Fort Pierce',
    title: 'Car Rental in Fort Pierce, FL',
    metaDescription:
      'Local car rental serving Fort Pierce, FL. Daily and weekly rates, same-day pickup, and local delivery — gig-driver friendly. Skip the airport lines and rent directly.',
    h1: 'Car Rental in Fort Pierce, FL',
    intro:
      'Reliable daily and weekly car rentals for Fort Pierce drivers. We’re based just down the road in Port St. Lucie and serve Fort Pierce with easy pickup and local delivery — no airport counter, no corporate runaround.',
    body: [
      'Whether you need wheels for the week, a dependable car between vehicles, or a rideshare- and delivery-ready ride, we keep it simple. You deal directly with the owner, pricing is clear, and the car is inspected and detailed before you get it.',
      'Fort Pierce drivers can arrange same-day pickup in nearby Port St. Lucie or have the car delivered locally. Tell us your dates and what you need the car for, and we’ll put together a rate that makes sense.',
    ],
    highlights: [
      { label: 'Serving Fort Pierce', desc: 'Local pickup nearby in Port St. Lucie plus delivery to the Fort Pierce area.' },
      { label: 'Daily & weekly rates', desc: 'Flexible terms with easy extensions and transparent pricing.' },
      { label: 'Gig-driver friendly', desc: 'Vehicles ready for Uber, Lyft, DoorDash, and Instacart.' },
      { label: 'Direct, local service', desc: 'No airport lines, no middleman — rent straight from the owner.' },
    ],
    faqs: [
      { q: 'Do you rent cars in Fort Pierce?', a: 'Yes. We serve Fort Pierce from our Port St. Lucie location with easy pickup nearby and local delivery to the Fort Pierce area.' },
      { q: 'Can I get a car delivered in Fort Pierce?', a: 'Local delivery and pickup are available. We’ll arrange the details once your request is approved.' },
      { q: 'Do you offer weekly rentals in Fort Pierce?', a: 'Yes — all vehicles are available daily or weekly, with weekly rates that typically offer meaningful savings.' },
      { q: 'What do I need to rent?', a: 'Drivers must be at least 25, hold a valid driver’s license, and provide proof of active personal auto insurance. A refundable deposit is collected at booking.' },
    ],
  },
  {
    slug: 'car-rental-stuart-fl',
    serviceName: 'Car Rental',
    city: 'Stuart',
    title: 'Car Rental in Stuart, FL',
    metaDescription:
      'Local car rental serving Stuart, FL. Daily and weekly rates, same-day pickup, and local delivery for locals and gig drivers. Rent directly with the owner — no airport lines.',
    h1: 'Car Rental in Stuart, FL',
    intro:
      'Dependable daily and weekly car rentals for Stuart and the Treasure Coast. We’re a local, owner-run rental in nearby Port St. Lucie serving Stuart with easy pickup and local delivery.',
    body: [
      'Skip the airport counters and the corporate fine print. Whether you’re visiting the Treasure Coast, between vehicles, or driving for a rideshare or delivery app, we’ll match you with a clean, well-maintained car and a fair rate set directly with the owner.',
      'Stuart drivers can pick up nearby in Port St. Lucie or arrange local delivery. Let us know your dates and how you’ll use the car, and we’ll handle the rest — same-day pickup is often available.',
    ],
    highlights: [
      { label: 'Serving Stuart & the Treasure Coast', desc: 'Easy pickup nearby plus local delivery to the Stuart area.' },
      { label: 'Daily & weekly options', desc: 'Flexible terms, easy extensions, and clear pricing.' },
      { label: 'Locals & gig drivers welcome', desc: 'Great for visitors, in-between-vehicle needs, and Uber/Lyft/delivery work.' },
      { label: 'Owner-direct pricing', desc: 'No airport lines, no platform fees — a fair deal, person to person.' },
    ],
    faqs: [
      { q: 'Do you rent cars in Stuart, FL?', a: 'Yes. We serve Stuart from our nearby Port St. Lucie location with convenient pickup and local delivery to the Stuart area.' },
      { q: 'Is same-day pickup available near Stuart?', a: 'Often, yes. Reach out with your dates and we’ll confirm availability and the fastest way to get you a car.' },
      { q: 'Can I rent weekly in Stuart?', a: 'Yes — daily and weekly rentals are both available, and weekly rates usually save you money.' },
      { q: 'What are the rental requirements?', a: 'You’ll need to be at least 25, hold a valid driver’s license, and show proof of active personal auto insurance. A refundable deposit is collected at booking.' },
    ],
  },
];

/** Match a window.location.pathname to an SeoPage (ignores leading/trailing slash). */
export function findSeoPage(pathname: string): SeoPage | undefined {
  const clean = pathname.replace(/^\/+|\/+$/g, '');
  return seoPages.find((p) => p.slug === clean);
}
