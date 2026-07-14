export const GUIDE_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'customer', label: 'Customer flow' },
  { id: 'operations', label: 'Operations' },
  { id: 'money', label: 'Payments' },
  { id: 'growth', label: 'Growth' },
  { id: 'system', label: 'System' },
];

const dashboardChrome = [
  { id: 'side-nav', label: 'Dashboard nav', x: 2, y: 10, w: 15, h: 78, type: 'nav' },
  { id: 'topbar', label: 'Search and alerts', x: 20, y: 8, w: 58, h: 9, type: 'input' },
];

const customerChrome = [
  { id: 'site-nav', label: 'Customer site', x: 6, y: 8, w: 86, h: 9, type: 'nav' },
];

function dashboardFrame({ heading, caption, focusId, cursor, blocks, subheading = '' }) {
  return {
    screen: 'dashboard',
    heading,
    subheading,
    caption,
    narration: caption,
    focusId,
    cursor,
    blocks: [...dashboardChrome, ...blocks],
  };
}

function customerFrame({ heading, caption, focusId, cursor, blocks, subheading = '' }) {
  return {
    screen: 'customer',
    heading,
    subheading,
    caption,
    narration: caption,
    focusId,
    cursor,
    blocks: [...customerChrome, ...blocks],
  };
}

const moneyStop = [
  'Amount, customer, vehicle, date range, or booking code does not match.',
  'Dashboard status and payment-provider status disagree.',
  'The action would contact or charge a customer without a clear booking reason.',
];

export const KNOWLEDGE_GUIDES = [
  {
    id: 'customer-demo',
    title: 'Customer demo',
    category: 'customer',
    time: '8 min',
    summary: 'Customer-side flow only: browse, request, complete ID/agreement/insurance, wait for approval, then pay.',
    outcome: 'Staff can explain exactly what the customer sees before and after admin approval.',
    beforeStart: 'Use this when training support or sales on what customers actually experience.',
    doneWhen: 'The operator can separate the public request, verification gate, approval wait, and payment unlock.',
    escalateIf: 'A customer is being asked to pay before approval, cannot open `/confirm`, or cannot find the booking code.',
    routeLabel: 'Start hub',
    tags: ['customer', 'training', 'request', 'verification', 'approval', 'payment'],
    searchKeywords: ['customer demo', 'customer walkthrough', 'browse vehicle', 'request booking', 'submit id', 'submit license', 'submit insurance', 'approval gate', 'pay after approval'],
    fullVideo: {
      src: '/knowledge-videos/customer-demo.mp4',
      captions: '/knowledge-videos/customer-demo.vtt',
      title: 'Customer demo video',
      description: 'Customer-only stitched walkthrough with captions and voiceover.',
    },
    steps: [
      'Browse the public fleet and open the vehicle detail page.',
      'Submit the request form: dates, pickup or delivery, add-ons, customer details, and review.',
      'Use the `/confirm` link to complete the verification wizard: rental summary, license scan/manual ID, address, license, terms, acknowledgements, signature, insurance, and review.',
      'Submit the completed verification package and wait at Awaiting Approval.',
      'After admin approval, return to the same confirmation link, review the itemized receipt, and pay.',
    ],
    tips: [
      'The customer does not pay from the first request form.',
      'The same confirmation link changes behavior after approval: before approval it gates payment; after approval it unlocks payment.',
    ],
    demo: [
      customerFrame({
        heading: 'Browse first',
        caption: 'The customer starts on the public site, chooses dates, and opens the vehicle detail page.',
        focusId: 'request-form',
        cursor: { x: 72, y: 58 },
        blocks: [
          { id: 'fleet', label: 'Fleet cards', x: 43, y: 23, w: 42, h: 30, type: 'grid' },
          { id: 'request-form', label: 'Request wizard', x: 53, y: 58, w: 33, h: 24, type: 'form' },
        ],
      }),
      customerFrame({
        heading: 'Complete verification',
        caption: 'After request submission, `/confirm` collects ID, address, license, terms, signature, insurance, and review.',
        focusId: 'wizard',
        cursor: { x: 69, y: 53 },
        blocks: [
          { id: 'wizard', label: 'ID / agreement / insurance', x: 15, y: 25, w: 35, h: 38, type: 'form' },
          { id: 'approval-gate', label: 'Awaiting Approval', x: 56, y: 30, w: 27, h: 28, type: 'card' },
        ],
      }),
      customerFrame({
        heading: 'Pay only after approval',
        caption: 'Once admin approves, the customer sees the itemized receipt and payment button.',
        focusId: 'pay-button',
        cursor: { x: 72, y: 68 },
        blocks: [
          { id: 'receipt', label: 'Itemized receipt', x: 12, y: 24, w: 35, h: 45, type: 'list' },
          { id: 'pay-button', label: 'Continue to payment', x: 55, y: 53, w: 29, h: 15, type: 'action' },
        ],
      }),
    ],
  },
  {
    id: 'admin-demo',
    title: 'Admin demo',
    category: 'operations',
    time: '10 min',
    summary: 'Admin-side operating flow: triage requests, verify submitted customer data, approve, unlock payment, then manage pickup, return, money, and exceptions.',
    outcome: 'Operators know which dashboard screen owns each admin decision and when to stop.',
    beforeStart: 'Use this for admin onboarding. Use task-specific guides during live work.',
    doneWhen: 'The operator can approve correctly, send or copy a payment link, and name the right screen for pickup, return, money, insurance, customer support, reporting, and system failures.',
    escalateIf: 'A live booking has unclear identity, agreement, coverage, money, vehicle readiness, return condition, or integration status.',
    routeLabel: 'Start hub',
    tags: ['admin', 'operations', 'training', 'approval', 'payment link'],
    searchKeywords: ['admin demo', 'dashboard walkthrough', 'approve booking', 'payment link', 'pickup return', 'operations training', 'booking detail'],
    fullVideo: {
      src: '/knowledge-videos/admin-demo.mp4',
      captions: '/knowledge-videos/admin-demo.vtt',
      title: 'Admin demo video',
      description: 'Admin-only stitched walkthrough with captions and voiceover.',
    },
    steps: [
      'Use Bookings to triage by lifecycle chip, but open Booking Detail before deciding.',
      'Verify customer, vehicle, dates, price, agreement, license, insurance, and risk before approval.',
      'Approve only when the booking can be fulfilled; approval notifies the customer and exposes the payment link.',
      'Once paid, use Booking Detail and Check-Ins for documents, counter-sign, pickup prep, handoff, active rental, return, inspection, charges, deposit, invoice, and completion.',
      'Use Payments, Insurance, Messaging, Revenue, and Settings as support queues that point back to the booking record.',
    ],
    tips: [
      'Approval is the handoff from customer verification to customer payment.',
      'Never advance pickup, return, deposit, or refund work unless Booking Detail and the supporting queue agree.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Triage in Bookings',
        caption: 'Use lifecycle filters to find requests, then open the booking before approving.',
        focusId: 'booking-row',
        cursor: { x: 62, y: 46 },
        blocks: [
          { id: 'filters', label: 'Lifecycle filters', x: 20, y: 23, w: 61, h: 11, type: 'pill' },
          { id: 'booking-row', label: 'Pending request', x: 20, y: 39, w: 66, h: 15, type: 'row' },
        ],
      }),
      dashboardFrame({
        heading: 'Approve from the record',
        caption: 'Booking Detail shows the customer package, receipt, risk flag, deposit, and approval action.',
        focusId: 'approval-panel',
        cursor: { x: 68, y: 53 },
        blocks: [
          { id: 'header', label: 'Status and customer', x: 20, y: 23, w: 66, h: 15, type: 'card' },
          { id: 'approval-panel', label: 'Review & approve', x: 52, y: 43, w: 34, h: 28, type: 'form' },
          { id: 'documents', label: 'ID / agreement / insurance', x: 20, y: 43, w: 27, h: 28, type: 'list' },
        ],
      }),
      dashboardFrame({
        heading: 'Payment unlocks after approval',
        caption: 'Approved unpaid bookings show a customer payment link and reminder action.',
        focusId: 'payment-link',
        cursor: { x: 70, y: 54 },
        blocks: [
          { id: 'payment-banner', label: 'Waiting for Customer Payment', x: 20, y: 28, w: 66, h: 18, type: 'card' },
          { id: 'payment-link', label: 'Customer payment link', x: 46, y: 52, w: 40, h: 16, type: 'input' },
        ],
      }),
      dashboardFrame({
        heading: 'Run the rental lifecycle',
        caption: 'After payment, use Overview, Check-In, Check-Out, Invoice, timeline, and support queues.',
        focusId: 'tabs',
        cursor: { x: 57, y: 43 },
        blocks: [
          { id: 'tabs', label: 'Overview / Check-In / Check-Out / Invoice', x: 20, y: 34, w: 66, h: 11, type: 'pill' },
          { id: 'record', label: 'Operational record', x: 20, y: 50, w: 66, h: 25, type: 'card' },
        ],
      }),
    ],
  },
  {
    id: 'customer-booking-flow',
    title: 'Customer request flow',
    category: 'customer',
    time: '3 min',
    summary: 'Public vehicle browsing and request submission only. ID, insurance, approval, and payment happen after this.',
    outcome: 'A pending request exists and the customer has a booking code plus a confirmation link.',
    beforeStart: 'Confirm the customer site loads, fleet cards appear, and test payment mode is active.',
    doneWhen: 'The customer reaches `/confirm?ref=BOOKING_CODE` after submitting the request.',
    escalateIf: 'The request does not submit, availability is unclear, pricing is wrong, or the confirmation link does not open.',
    doNotProceedIf: [
      'Rates, dates, deposit, pickup/delivery, or add-ons are unclear before submit.',
      'The customer does not receive or see a booking code.',
      'The customer thinks payment is due before the approval gate is complete.',
    ],
    routeLabel: 'Customer site',
    routePath: '/',
    tags: ['customer', 'request', 'vehicle', 'booking code'],
    searchKeywords: ['customer request', 'request availability', 'browse vehicle', 'vehicle detail', 'booking code', 'public site', 'dates pickup delivery add-ons contact'],
    steps: [
      'Open the public site and choose dates before judging availability.',
      'Open Vehicle Detail and review rate, deposit, mileage, pickup/delivery, and rules.',
      'Complete the request wizard: dates, pickup/delivery, add-ons, customer details, review.',
      'Submit Request Availability. The app redirects to `/confirm?ref=BOOKING_CODE`.',
      'Tell the customer the next page is for verification and approval, not immediate payment.',
    ],
    tips: [
      'This first form does not collect ID, insurance, signature, or payment.',
      'Support should search by booking code, phone, or email before asking the customer to start over.',
    ],
    demo: [
      customerFrame({
        heading: 'Browse fleet',
        caption: 'Start with trip dates, then open the vehicle detail page.',
        focusId: 'vehicle-card',
        cursor: { x: 64, y: 49 },
        blocks: [
          { id: 'date-search', label: 'Trip dates', x: 9, y: 24, w: 31, h: 16, type: 'input' },
          { id: 'vehicle-card', label: 'Vehicle card', x: 50, y: 27, w: 32, h: 33, type: 'card' },
        ],
      }),
      customerFrame({
        heading: 'Submit request',
        caption: 'The request form collects dates, pickup or delivery, add-ons, and basic contact details.',
        focusId: 'request-form',
        cursor: { x: 73, y: 65 },
        blocks: [
          { id: 'vehicle-detail', label: 'Rate and rules', x: 10, y: 23, w: 34, h: 44, type: 'card' },
          { id: 'request-form', label: 'Dates -> pickup -> add-ons -> details -> review', x: 51, y: 23, w: 36, h: 48, type: 'form' },
        ],
      }),
      customerFrame({
        heading: 'Redirect to confirmation',
        caption: 'After submission, the customer lands on `/confirm` with a booking code and starts verification next.',
        focusId: 'confirm-link',
        cursor: { x: 66, y: 50 },
        blocks: [
          { id: 'request-summary', label: 'Request submitted', x: 12, y: 25, w: 35, h: 34, type: 'card' },
          { id: 'confirm-link', label: 'Booking code + confirmation', x: 55, y: 30, w: 29, h: 28, type: 'action' },
        ],
      }),
    ],
  },
  {
    id: 'customer-verification-approval-gate',
    title: 'Customer verification and approval gate',
    category: 'customer',
    time: '5 min',
    summary: 'What happens after request submission: ID, address, license, terms, signature, insurance, review, then Awaiting Approval.',
    outcome: 'The signed agreement and insurance choice are saved, and payment remains locked until admin approval.',
    beforeStart: 'Open the customer confirmation link: `/confirm?ref=BOOKING_CODE` or `/confirm?code=BOOKING_CODE`.',
    doneWhen: 'The customer reaches Awaiting Approval and the dashboard has the submitted agreement/insurance package.',
    escalateIf: 'The confirmation page cannot load, ID upload/scan fails, required fields will not save, or the customer sees payment before approval.',
    doNotProceedIf: [
      'The booking code does not match the customer and vehicle.',
      'License name, date of birth, address, or expiration is incomplete or suspicious.',
      'Insurance is expired, missing, mismatched, or the Bonzah quote/bind path fails.',
      'Terms, acknowledgements, or signature are missing.',
    ],
    routeLabel: 'Customer confirm',
    routePath: '/confirm?code=BOOKING_CODE',
    tags: ['customer', 'id', 'license', 'agreement', 'insurance', 'approval'],
    searchKeywords: ['id', 'driver license', 'license scan', 'manual license', 'address dob contact information', 'agreement', 'terms', 'acknowledgements', 'signature', 'insurance choice', 'own insurance', 'bonzah', 'review booking', 'awaiting approval', 'approval gate'],
    steps: [
      'Open `/confirm` from the redirect, status page, email, SMS, or copied link.',
      'Review the rental summary so the customer confirms the right booking code, dates, vehicle, pickup/return, and totals.',
      'Scan the driver license barcode when possible. If camera scan fails, upload a license photo or enter the details manually.',
      'Confirm address, date of birth, license number, issuing state, and expiration. License photos are optional but useful for verification.',
      'Accept rental terms, complete acknowledgements, and add the customer signature.',
      'Choose insurance: submit personal insurance details or choose Bonzah when available.',
      'Review the itemized booking summary and submit the package.',
      'The page saves agreement and insurance, then shows Awaiting Approval until an admin approves.',
    ],
    tips: [
      'This is the highest-support customer step. Use the booking code to look up the exact record before troubleshooting.',
      'The approval gate is intentional. It protects inventory, coverage, identity, and pricing before payment is collected.',
    ],
    demo: [
      customerFrame({
        heading: 'Start confirmation',
        caption: 'The confirmation link loads the customer completion wizard for the exact booking code.',
        focusId: 'summary',
        cursor: { x: 63, y: 42 },
        blocks: [
          { id: 'summary', label: 'Rental summary', x: 12, y: 23, w: 35, h: 38, type: 'card' },
          { id: 'stepper', label: 'Agreement / Insurance / Review', x: 54, y: 26, w: 30, h: 12, type: 'pill' },
        ],
      }),
      customerFrame({
        heading: 'Submit ID details',
        caption: 'The customer scans or manually enters license, address, date of birth, and optional license photos.',
        focusId: 'id-step',
        cursor: { x: 70, y: 55 },
        blocks: [
          { id: 'scan', label: 'Scan license', x: 12, y: 24, w: 29, h: 33, type: 'card' },
          { id: 'id-step', label: 'Address + driver license', x: 49, y: 24, w: 35, h: 39, type: 'form' },
        ],
      }),
      customerFrame({
        heading: 'Sign and choose insurance',
        caption: 'Terms, acknowledgements, signature, and insurance are captured before payment is unlocked.',
        focusId: 'insurance',
        cursor: { x: 67, y: 57 },
        blocks: [
          { id: 'signature', label: 'Terms + signature', x: 12, y: 25, w: 31, h: 37, type: 'form' },
          { id: 'insurance', label: 'Own insurance or Bonzah', x: 50, y: 25, w: 34, h: 37, type: 'form' },
        ],
      }),
      customerFrame({
        heading: 'Await admin approval',
        caption: 'Submitting saves the customer package and holds payment until the dashboard approval happens.',
        focusId: 'approval-gate',
        cursor: { x: 66, y: 52 },
        blocks: [
          { id: 'review', label: 'Review submitted package', x: 12, y: 26, w: 35, h: 36, type: 'list' },
          { id: 'approval-gate', label: 'Awaiting Approval', x: 55, y: 31, w: 29, h: 27, type: 'card' },
        ],
      }),
    ],
  },
  {
    id: 'customer-payment-after-approval',
    title: 'Customer payment after approval',
    category: 'customer',
    time: '3 min',
    summary: 'What the customer does after admin approval: reopen confirmation, review receipt, and pay.',
    outcome: 'The approved booking is paid and moves to the paid/confirmed lifecycle.',
    beforeStart: 'The dashboard booking must be approved and unpaid. Use the emailed/SMS link, status lookup, or copied payment link.',
    doneWhen: 'Payment succeeds, receipt sends, and the booking no longer shows as approved unpaid.',
    escalateIf: 'The payment link opens the wrong booking, amount is wrong, payment provider fails, or dashboard/provider status disagree.',
    doNotProceedIf: [
      'The booking is not approved yet.',
      'Rental total, insurance, deposit, dates, vehicle, or customer identity do not match.',
      'The customer is trying to pay from a stale or wrong booking code.',
    ],
    routeLabel: 'Customer confirm',
    routePath: '/confirm?code=BOOKING_CODE',
    tags: ['customer', 'payment', 'approved', 'receipt'],
    searchKeywords: ['pay after approval', 'customer payment', 'approved unpaid', 'payment link', 'complete payment', 'continue to payment', 'itemized receipt', 'customer receipt', 'status lookup'],
    steps: [
      'Customer opens the secure confirmation/payment link after approval.',
      'The page detects approved status and shows the itemized receipt instead of Awaiting Approval.',
      'Customer reviews rental total, insurance, deposit, dates, vehicle, and customer details.',
      'Customer selects Continue to payment and completes the provider payment form.',
      'The app confirms payment, sends the receipt, and returns the customer to the confirmed state.',
    ],
    tips: [
      'If payment is not available, check approval status first.',
      'If payment succeeded but the dashboard still shows unpaid, check provider webhooks before asking the customer to retry.',
    ],
    demo: [
      customerFrame({
        heading: 'Approval unlocks payment',
        caption: 'The same confirmation link changes from Awaiting Approval to approved receipt review.',
        focusId: 'approved',
        cursor: { x: 62, y: 41 },
        blocks: [
          { id: 'approved', label: 'Your booking is approved', x: 14, y: 25, w: 34, h: 19, type: 'card' },
          { id: 'receipt', label: 'Itemized receipt', x: 54, y: 24, w: 30, h: 38, type: 'list' },
        ],
      }),
      customerFrame({
        heading: 'Review before charging',
        caption: 'Customer verifies total, insurance, deposit, vehicle, dates, and booking code before entering card details.',
        focusId: 'receipt',
        cursor: { x: 64, y: 56 },
        blocks: [
          { id: 'booking-code', label: 'Booking code', x: 13, y: 25, w: 26, h: 12, type: 'pill' },
          { id: 'receipt', label: 'Rental + insurance + deposit', x: 45, y: 24, w: 39, h: 39, type: 'list' },
        ],
      }),
      customerFrame({
        heading: 'Complete payment',
        caption: 'After successful payment, the booking is confirmed and receipt delivery is triggered.',
        focusId: 'pay',
        cursor: { x: 69, y: 64 },
        blocks: [
          { id: 'payment-form', label: 'Secure payment form', x: 16, y: 26, w: 36, h: 38, type: 'form' },
          { id: 'pay', label: 'Pay and confirm', x: 58, y: 52, w: 27, h: 15, type: 'action' },
        ],
      }),
    ],
  },
  {
    id: 'admin-approval-payment-unlock',
    title: 'Admin approval and payment unlock',
    category: 'operations',
    time: '4 min',
    summary: 'How admins turn a completed customer package into an approved unpaid booking and payment link.',
    outcome: 'The right booking is approved, the customer is notified, and payment is unlocked without skipping verification.',
    beforeStart: 'Open Booking Detail from a pending approval row after the customer has completed the `/confirm` package.',
    doneWhen: 'The booking status is approved, the customer has the payment link, and the dashboard shows Waiting for Customer Payment until they pay.',
    escalateIf: 'ID, agreement, insurance, amount, vehicle availability, or customer identity cannot be verified.',
    doNotProceedIf: [
      'Customer, vehicle, dates, rate, deposit, or booking code does not match.',
      'License, date of birth, agreement, signature, or insurance is missing or suspicious.',
      'Vehicle is unavailable, blocked, damaged, in service, or already committed.',
      'The deposit/risk decision is unclear or needs owner review.',
    ],
    routeLabel: 'Bookings',
    routePath: '/bookings',
    tags: ['admin', 'approval', 'payment link', 'booking detail'],
    searchKeywords: ['approve booking', 'pending approval', 'admin approval', 'payment unlock', 'payment link', 'send continue link', 'risk flag', 'security deposit', 'review agreement', 'review id', 'review insurance', 'approved unpaid'],
    steps: [
      'Open the pending booking from Bookings. Do not approve from the queue without reviewing the record.',
      'Verify customer identity, contact details, dates, vehicle, delivery, add-ons, totals, and booking code.',
      'Review the submitted agreement package: license details, date of birth, address, signature, acknowledgements, and license photos if present.',
      'Review insurance: approve clean personal insurance or confirm Bonzah state before handoff.',
      'Set high-risk flag and deposit amount when needed.',
      'Select Approve & notify customer. The customer receives the link by email/SMS, and the modal shows a copyable payment link.',
      'Approved unpaid bookings show Waiting for Customer Payment and a Send Continue Link action until payment is complete.',
    ],
    tips: [
      'Approval is not the same as payment. It unlocks payment.',
      'If the customer calls before paying, resend or copy the payment link only after confirming the booking code and contact details.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Open the pending record',
        caption: 'Use the queue to find the request, then open Booking Detail for verification.',
        focusId: 'booking-row',
        cursor: { x: 60, y: 48 },
        blocks: [
          { id: 'filters', label: 'Needs approval', x: 20, y: 24, w: 31, h: 11, type: 'pill' },
          { id: 'booking-row', label: 'Pending approval booking', x: 20, y: 41, w: 66, h: 17, type: 'row' },
        ],
      }),
      dashboardFrame({
        heading: 'Verify before approval',
        caption: 'Check customer package, itemized receipt, vehicle, dates, ID, agreement, insurance, risk, and deposit.',
        focusId: 'approval-panel',
        cursor: { x: 70, y: 51 },
        blocks: [
          { id: 'documents', label: 'ID / agreement / insurance', x: 20, y: 26, w: 28, h: 40, type: 'list' },
          { id: 'approval-panel', label: 'Risk + deposit + approve', x: 54, y: 26, w: 32, h: 40, type: 'form' },
        ],
      }),
      dashboardFrame({
        heading: 'Notify and copy link',
        caption: 'Approval sends the customer link automatically and shows a manual copy link for support.',
        focusId: 'payment-link',
        cursor: { x: 72, y: 57 },
        blocks: [
          { id: 'approved', label: 'Approved - customer notified', x: 20, y: 26, w: 35, h: 20, type: 'card' },
          { id: 'payment-link', label: 'Copyable payment link', x: 49, y: 52, w: 37, h: 15, type: 'input' },
        ],
      }),
      dashboardFrame({
        heading: 'Watch approved unpaid',
        caption: 'Until payment completes, the booking stays approved unpaid with Waiting for Customer Payment.',
        focusId: 'payment-banner',
        cursor: { x: 67, y: 51 },
        blocks: [
          { id: 'header', label: 'Approved status', x: 20, y: 23, w: 66, h: 14, type: 'card' },
          { id: 'payment-banner', label: 'Waiting for Customer Payment', x: 20, y: 43, w: 66, h: 19, type: 'card' },
        ],
      }),
    ],
  },
  {
    id: 'booking-queue',
    title: 'Booking queue',
    category: 'operations',
    time: '3 min',
    summary: 'How to triage new and active rental work from the Bookings page.',
    outcome: 'Each request is approved, declined, opened, or assigned one next action.',
    beforeStart: 'Open Bookings and choose the lifecycle filter that matches the work.',
    doneWhen: 'No visible request is left without an owner or next action.',
    escalateIf: 'Availability, customer identity, payment status, agreement, or insurance cannot be verified.',
    doNotProceedIf: [
      'You are approving from memory instead of verifying row details.',
      'The selected row is not the intended customer, vehicle, dates, and booking code.',
      'A payment, agreement, insurance, or vehicle readiness blocker is unresolved.',
    ],
    routeLabel: 'Bookings',
    routePath: '/bookings',
    tags: ['bookings', 'approval', 'queue'],
    searchKeywords: ['pending approval', 'approve booking', 'decline booking', 'booking row', 'payment due', 'agreement due', 'counter sign', 'pickup today'],
    steps: [
      'Use the lifecycle chips: Needs approval, Payment due, Agreement due, Counter-sign, Pickup today, Active, Overdue, Needs checkout.',
      'Search only when you know the booking code, customer, phone, email, or vehicle.',
      'Review customer, vehicle, dates, delivery type, add-ons, status, lifecycle label, and total.',
      'Approve only when the request can be fulfilled. Decline with a short reason when it cannot.',
      'Open Booking Detail for anything involving money, documents, pickup, return, damage, notes, or exceptions.',
    ],
    tips: [
      'The queue is for sorting work. The booking record is for deciding work.',
      'Pending approvals should be handled quickly; slow approvals lose rentals.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Filter the queue',
        caption: 'Start with the lifecycle chip that matches the operational problem.',
        focusId: 'filters',
        cursor: { x: 47, y: 31 },
        blocks: [
          { id: 'search', label: 'Search booking/customer/vehicle', x: 20, y: 23, w: 37, h: 10, type: 'input' },
          { id: 'filters', label: 'Needs approval / Payment due / Pickup today', x: 20, y: 39, w: 66, h: 10, type: 'pill' },
        ],
      }),
      dashboardFrame({
        heading: 'Verify the row',
        caption: 'Read the row before acting: booking code, customer, vehicle, dates, status, lifecycle, and total.',
        focusId: 'booking-row',
        cursor: { x: 61, y: 48 },
        blocks: [
          { id: 'booking-row', label: 'One booking row', x: 20, y: 34, w: 66, h: 20, type: 'row' },
          { id: 'actions', label: 'Approve / decline icons', x: 68, y: 58, w: 18, h: 11, type: 'action' },
        ],
      }),
      dashboardFrame({
        heading: 'Open the record for exceptions',
        caption: 'Money, documents, pickup, return, and notes are handled from Booking Detail.',
        focusId: 'detail',
        cursor: { x: 62, y: 50 },
        blocks: [
          { id: 'detail', label: 'Booking Detail', x: 20, y: 24, w: 66, h: 45, type: 'card' },
        ],
      }),
    ],
  },
  {
    id: 'booking-lifecycle',
    title: 'Booking lifecycle',
    category: 'operations',
    time: '5 min',
    summary: 'How a booking moves from request to completed rental.',
    outcome: 'The operator knows the screen, tab, and gate for each status change.',
    beforeStart: 'Open Booking Detail. Do not run lifecycle actions from memory.',
    doneWhen: 'The booking status, timeline, payment, agreement, insurance, photos, return condition, and invoice agree.',
    escalateIf: 'A status transition fails, a required document is missing, or the operator needs to override checkout.',
    doNotProceedIf: [
      'The booking is pending approval but vehicle availability has not been checked.',
      'Pickup is being cleared without payment, signed agreement, insurance, or admin prep.',
      'Checkout is locked because the renter has not ended the trip and no justified override exists.',
    ],
    routeLabel: 'Bookings',
    routePath: '/bookings',
    tags: ['lifecycle', 'pickup', 'return', 'invoice'],
    searchKeywords: ['booking detail', 'record of truth', 'ready for pickup', 'active rental', 'returned', 'completed', 'checkout override', 'invoice tab'],
    steps: [
      'Pending approval: review the full record, then approve or decline.',
      'Approved: customer still owes payment through the confirmation link.',
      'Confirmed: payment is done; finish counter-sign, documents, insurance, and pickup prep.',
      'Ready for pickup: admin prep is saved and the customer can start check-in.',
      'Active: renter has the car. Use Check-Out when the renter ends the trip or an override is logged.',
      'Returned: inspect condition, review charges, settle deposit, generate invoice, then complete.',
    ],
    tips: [
      'The real sequence is active -> returned -> completed. Do not skip return data.',
      'The timeline should explain every important state change.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Read the record header',
        caption: 'Status, customer, vehicle, pickup, return, and quick actions must match the intended rental.',
        focusId: 'header',
        cursor: { x: 58, y: 30 },
        blocks: [
          { id: 'header', label: 'Booking header', x: 20, y: 23, w: 66, h: 16, type: 'card' },
          { id: 'banners', label: 'Readiness banners', x: 20, y: 44, w: 66, h: 12, type: 'pill' },
        ],
      }),
      dashboardFrame({
        heading: 'Use the lifecycle tabs',
        caption: 'Overview verifies facts; Check-In prepares pickup; Check-Out records return; Invoice closes settlement.',
        focusId: 'tabs',
        cursor: { x: 54, y: 50 },
        blocks: [
          { id: 'tabs', label: 'Overview / Check-In / Check-Out / Invoice', x: 20, y: 33, w: 66, h: 12, type: 'pill' },
          { id: 'panel', label: 'Selected lifecycle panel', x: 20, y: 50, w: 66, h: 27, type: 'form' },
        ],
      }),
      dashboardFrame({
        heading: 'Finish with timeline and invoice',
        caption: 'After return, inspection, charges, deposit settlement, and invoice must agree before completing.',
        focusId: 'invoice',
        cursor: { x: 68, y: 57 },
        blocks: [
          { id: 'charges', label: 'Charges and deposit', x: 20, y: 27, w: 32, h: 39, type: 'list' },
          { id: 'invoice', label: 'Invoice / complete', x: 58, y: 27, w: 28, h: 39, type: 'action' },
        ],
      }),
    ],
  },
  {
    id: 'fleet-availability',
    title: 'Fleet and availability',
    category: 'operations',
    time: '3 min',
    summary: 'How to protect inventory before selling, approving, or blocking a vehicle.',
    outcome: 'Vehicles shown to customers are truly available, priced, visible, clean, and not blocked.',
    beforeStart: 'Open Fleet before committing inventory or sending a payment link.',
    doneWhen: 'Vehicle status, visibility, rates, photos, condition, and blocked dates match the real car.',
    escalateIf: 'Calendar, blocked dates, and booking status disagree.',
    doNotProceedIf: [
      'The vehicle is hidden, damaged, in service, blocked, or already committed.',
      'Photos or pricing are wrong enough to mislead customers.',
      'A blocked date overlaps a paid or approved booking.',
    ],
    routeLabel: 'Fleet',
    routePath: '/fleet',
    tags: ['fleet', 'availability', 'vehicle'],
    searchKeywords: ['fleet', 'vehicle status', 'blocked dates', 'availability', 'inventory', 'photos', 'pricing', 'service hold'],
    steps: [
      'Open Fleet and find the exact vehicle.',
      'Check visible status, rate, location, vehicle code, and condition.',
      'Open Vehicle Detail before changing status, pricing, photos, or blocked dates.',
      'Add blocked dates for service, owner use, damage holds, or any non-bookable window.',
      'Check Calendar or Bookings if the block may affect a paid or approved trip.',
    ],
    tips: [
      'Fleet errors become payment problems later.',
      'If a car should not be sold, hide or block it before approving a booking.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Find the vehicle',
        caption: 'Use Fleet to confirm the exact car, status, rate, and visibility before quoting it.',
        focusId: 'vehicle-card',
        cursor: { x: 49, y: 47 },
        blocks: [
          { id: 'fleet-tools', label: 'Search and fleet actions', x: 20, y: 23, w: 66, h: 11, type: 'input' },
          { id: 'vehicle-card', label: 'Vehicle card', x: 22, y: 40, w: 28, h: 28, type: 'card' },
          { id: 'vehicle-card-2', label: 'Another vehicle', x: 56, y: 40, w: 28, h: 28, type: 'card' },
        ],
      }),
      dashboardFrame({
        heading: 'Protect blocked windows',
        caption: 'Blocked dates stop the customer flow from offering unavailable inventory.',
        focusId: 'blocked',
        cursor: { x: 69, y: 53 },
        blocks: [
          { id: 'detail', label: 'Vehicle detail', x: 20, y: 25, w: 32, h: 43, type: 'card' },
          { id: 'blocked', label: 'Blocked dates', x: 58, y: 25, w: 28, h: 43, type: 'calendar' },
        ],
      }),
    ],
  },
  {
    id: 'calendar-checkins',
    title: 'Pickup, return, and check-ins',
    category: 'operations',
    time: '5 min',
    summary: 'How to use Check-Ins for daily handoffs, returns, overdue rentals, and settlement.',
    outcome: 'The day has a clean queue: blocked pickups, handoffs, due-back, overdue, active out, and returned settlement.',
    beforeStart: 'Open Check-Ins at the start of day and before close.',
    doneWhen: 'Every lane has been cleared, assigned, or escalated.',
    escalateIf: 'A return is overdue, a pickup is blocked, or the next rental is at risk.',
    doNotProceedIf: [
      'A pickup is missing payment, signed agreement, insurance, deposit, or admin prep.',
      'A return has not been ended by the renter and no checkout override reason exists.',
      'Overdue return timing threatens the next booking.',
    ],
    routeLabel: 'Check-Ins',
    routePath: '/check-ins',
    tags: ['pickup', 'return', 'check-in'],
    searchKeywords: ['check-ins', 'handoff', 'blocked pickup', 'ready handoff', 'due back', 'overdue returns', 'active out', 'returned settle'],
    steps: [
      'Blocked From Pickup: open the booking overview and clear payment, agreement, counter-sign, insurance, or readiness blockers.',
      'Ready For Handoff: open Check-In and save admin prep before pickup.',
      'Overdue Returns and Due Back Today: open Check-Out and contact the renter if needed.',
      'Active Out: monitor rentals not due back today.',
      'Returned / Settle: inspect, review charges, settle deposit, invoice, and complete.',
    ],
    tips: [
      'Calendar is planning. Check-Ins is execution.',
      'Overdue returns are customer support, fleet availability, and money risk at the same time.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Start with lane counts',
        caption: 'The top row shows blocked pickups, ready handoffs, overdue, due-back, active out, and settlement work.',
        focusId: 'lane-counts',
        cursor: { x: 55, y: 30 },
        blocks: [
          { id: 'lane-counts', label: 'Daily lane counts', x: 20, y: 24, w: 66, h: 13, type: 'grid' },
          { id: 'lanes', label: 'Work lanes', x: 20, y: 43, w: 66, h: 28, type: 'list' },
        ],
      }),
      dashboardFrame({
        heading: 'Open the right tab',
        caption: 'Pickup lanes open Check-In; return lanes open Check-Out; blocked pickups open Overview.',
        focusId: 'card',
        cursor: { x: 64, y: 52 },
        blocks: [
          { id: 'blocked', label: 'Blocked pickup', x: 20, y: 27, w: 20, h: 37, type: 'list' },
          { id: 'card', label: 'Return or handoff card', x: 47, y: 27, w: 39, h: 37, type: 'row' },
        ],
      }),
    ],
  },
  {
    id: 'payments-deposits-refunds',
    title: 'Payments, deposits, and refunds',
    category: 'money',
    time: '4 min',
    summary: 'How to handle money safely: payment reminders, deposits, refunds, settlements, and audit history.',
    outcome: 'Every money action is tied to the right booking, amount, reason, and audit trail.',
    beforeStart: 'Open the booking before any customer-facing or money-changing action.',
    doneWhen: 'The booking, payment ledger, deposit state, invoice, and audit trail agree.',
    escalateIf: 'Provider status and dashboard status disagree, a webhook failed, or a customer claims a payment not visible in the dashboard.',
    doNotProceedIf: moneyStop,
    routeLabel: 'Payments',
    routePath: '/payments',
    tags: ['payments', 'deposits', 'refunds'],
    searchKeywords: ['payment due', 'deposit held', 'refund', 'settle deposit', 'copy payment link', 'send reminder', 'money action', 'audit trail', 'stripe', 'square'],
    steps: [
      'Open Payments to see collection queue, held deposits, settlement work, and long-term collection risk.',
      'For unpaid approved bookings, open the booking or use Copy link / Send reminder only after confirming the customer and booking.',
      'For returned rentals, settle from Check-Out or Invoice after inspection and incidentals are clear.',
      'Use the audit panels to confirm who copied, sent, refunded, settled, or charged.',
      'Use Webhook Failures or provider pages before asking a customer to repeat a payment.',
    ],
    tips: [
      'List rows identify risk. Booking Detail provides authority to act.',
      'Money actions need a reason that would still make sense in a dispute.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Read money risk first',
        caption: 'Payments shows collection queue, held deposits, settlement work, and long-term risk.',
        focusId: 'risk',
        cursor: { x: 48, y: 32 },
        blocks: [
          { id: 'risk', label: 'Money at risk tiles', x: 20, y: 23, w: 66, h: 14, type: 'grid' },
          { id: 'queues', label: 'Collection and deposit queues', x: 20, y: 43, w: 66, h: 31, type: 'list' },
        ],
      }),
      dashboardFrame({
        heading: 'Confirm before action',
        caption: 'Before reminder, refund, release, or settlement: confirm customer, booking, amount, reason, and provider state.',
        focusId: 'actions',
        cursor: { x: 67, y: 57 },
        blocks: [
          { id: 'booking', label: 'Payment due booking', x: 20, y: 32, w: 38, h: 23, type: 'row' },
          { id: 'actions', label: 'Reminder / link / open', x: 62, y: 39, w: 24, h: 16, type: 'action' },
        ],
      }),
    ],
  },
  {
    id: 'insurance-review',
    title: 'Insurance review',
    category: 'operations',
    time: '3 min',
    summary: 'How to verify coverage before pickup, including Bonzah policies and customer-provided insurance.',
    outcome: 'Coverage is approved, rejected, or escalated before the vehicle leaves.',
    beforeStart: 'Open Insurance and keep the related booking available for payment and pickup readiness.',
    doneWhen: 'Insurance status matches the booking record and pickup readiness.',
    escalateIf: 'Policy bind failed, proof is expired, policy details mismatch, or Bonzah and dashboard status disagree.',
    doNotProceedIf: [
      'Policyholder, vehicle, policy dates, or coverage type does not match the rental.',
      'Bonzah bind failed or is pending for a pickup that is about to happen.',
      'Payment or agreement readiness is unclear even if insurance looks clean.',
    ],
    routeLabel: 'Insurance',
    routePath: '/insurance',
    tags: ['insurance', 'Bonzah', 'coverage'],
    searchKeywords: ['insurance', 'policy', 'coverage', 'bonzah', 'bind failed', 'pending bind', 'customer insurance', 'approve insurance', 'reject insurance'],
    steps: [
      'Use Insurance stats to check active, pending bind, bind failed, and markup.',
      'Filter bind failed first; those may mean the customer was charged but no policy issued.',
      'Open the booking row to verify driver, vehicle, pickup/return dates, policy tier, charged amount, and status.',
      'For customer-provided insurance, approve or reject from Booking Detail with a clear reason.',
      'Check Recent Activity for Bonzah API errors when status does not make sense.',
    ],
    tips: [
      'Insurance is a pickup gate, not a filing cabinet.',
      'Bind failures need reconciliation before handoff.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Start with policy status',
        caption: 'Insurance tiles show active policies, pending bind, bind failures, and markup.',
        focusId: 'stats',
        cursor: { x: 55, y: 30 },
        blocks: [
          { id: 'stats', label: 'Policy status tiles', x: 20, y: 23, w: 66, h: 14, type: 'grid' },
          { id: 'filters', label: 'Status filters', x: 20, y: 43, w: 66, h: 10, type: 'pill' },
        ],
      }),
      dashboardFrame({
        heading: 'Resolve failed or pending coverage',
        caption: 'Open the booking if driver, vehicle, dates, policy, or charged amount needs verification.',
        focusId: 'policy-row',
        cursor: { x: 62, y: 54 },
        blocks: [
          { id: 'policy-row', label: 'Policy row', x: 20, y: 35, w: 66, h: 20, type: 'row' },
          { id: 'activity', label: 'Recent Bonzah activity', x: 20, y: 62, w: 66, h: 14, type: 'list' },
        ],
      }),
    ],
  },
  {
    id: 'customers-portal-long-term',
    title: 'Customers, portal, and long-term',
    category: 'growth',
    time: '4 min',
    summary: 'How to manage customer records, portal access, long-term rentals, renewals, and account risk.',
    outcome: 'Support, renewal, billing, and long-term actions stay tied to the right customer.',
    beforeStart: 'Search before creating or changing a customer record.',
    doneWhen: 'Customer identity, contact details, booking history, portal access, and next action are clear.',
    escalateIf: 'Duplicate records, disputed history, missing portal access, or past-due long-term billing appears.',
    doNotProceedIf: [
      'The customer identity or contact info cannot be verified.',
      'A portal link would be sent to the wrong email or phone.',
      'A long-term account is past due and vehicle recovery or billing risk is unclear.',
    ],
    routeLabel: 'Portal',
    routePath: '/portal',
    tags: ['customers', 'portal', 'long-term'],
    searchKeywords: ['customer record', 'portal access', 'long term', 'monthly rental', 'renewal', 'payment plan', 'past due', 'onboarding', 'duplicate customer'],
    steps: [
      'Use Customers for identity and history. Use Portal for active customer-account operations.',
      'In Portal, review onboarding, active accounts, renewals due soon, past due renewals, and returned accounts.',
      'Copy portal links only after confirming booking code and customer email/phone.',
      'Use payment plan and renewal invoice actions only after customer agreement is clear.',
      'Use Booking Detail for checkout, invoice, deposit, or damage work.',
    ],
    tips: [
      'Portal is an account operations queue. It is not just a customer login page.',
      'Long-term rentals need billing rhythm, not one-off reminders.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Use Portal for active accounts',
        caption: 'Portal groups onboarding, active, renewal, past-due, and returned account work.',
        focusId: 'portal-queue',
        cursor: { x: 57, y: 45 },
        blocks: [
          { id: 'portal-stats', label: 'Account stats', x: 20, y: 23, w: 66, h: 13, type: 'grid' },
          { id: 'portal-queue', label: 'Account queue', x: 20, y: 42, w: 66, h: 30, type: 'list' },
        ],
      }),
      dashboardFrame({
        heading: 'Keep actions tied to the account',
        caption: 'Portal links, payment plans, renewal invoices, and checkout actions need the exact booking.',
        focusId: 'account-actions',
        cursor: { x: 69, y: 55 },
        blocks: [
          { id: 'account', label: 'Long-term account', x: 20, y: 32, w: 38, h: 24, type: 'row' },
          { id: 'account-actions', label: 'Portal / plan / invoice', x: 62, y: 37, w: 24, h: 18, type: 'action' },
        ],
      }),
    ],
  },
  {
    id: 'messaging-notifications',
    title: 'Messaging and notifications',
    category: 'operations',
    time: '3 min',
    summary: 'How to send traceable customer follow-up without creating confusion.',
    outcome: 'One customer receives one clear action, tied to one booking or account reason.',
    beforeStart: 'Open the related booking, customer, or account before composing.',
    doneWhen: 'The message has the right recipient, channel, template, link, deadline, and audit context.',
    escalateIf: 'Opt-out, failed notification, bad merge field, payment dispute, insurance issue, or damage claim is involved.',
    doNotProceedIf: [
      'Recipient identity, consent, or channel is unclear.',
      'The message asks for payment, insurance, pickup, return, or damage action without a booking code/link.',
      'A template preview has wrong merge fields.',
    ],
    routeLabel: 'Messaging',
    routePath: '/messaging',
    tags: ['messaging', 'notifications', 'templates'],
    searchKeywords: ['sms', 'email', 'message customer', 'conversation', 'templates', 'sequence', 'opt out', 'notification failure', 'payment reminder'],
    steps: [
      'Open Conversations for one-off customer follow-up.',
      'Open Templates to edit repeatable email/SMS copy and test merge fields.',
      'Open Sequences to review automated timing, not to manually send every message.',
      'Check Opt-Outs before sending sensitive or repeated follow-up.',
      'If messages do not arrive, check Settings and Webhook Failures before resending repeatedly.',
    ],
    tips: [
      'Short messages work best: action, link, deadline.',
      'Do not mix payment, insurance, and return instructions in one message unless the booking truly needs all three.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Choose the message context',
        caption: 'Conversations, templates, sequences, and opt-outs are separate checks.',
        focusId: 'tabs',
        cursor: { x: 54, y: 28 },
        blocks: [
          { id: 'tabs', label: 'Chat / Timeline / Templates / Cron / Opt-Outs', x: 20, y: 23, w: 66, h: 11, type: 'pill' },
          { id: 'conversations', label: 'Conversation list', x: 20, y: 40, w: 24, h: 32, type: 'list' },
          { id: 'thread', label: 'Thread and composer', x: 49, y: 40, w: 37, h: 32, type: 'form' },
        ],
      }),
      dashboardFrame({
        heading: 'Send one clear action',
        caption: 'Verify recipient, booking context, template, link, and opt-out state before sending.',
        focusId: 'composer',
        cursor: { x: 73, y: 66 },
        blocks: [
          { id: 'history', label: 'Message history', x: 20, y: 27, w: 44, h: 32, type: 'list' },
          { id: 'composer', label: 'Composer', x: 20, y: 64, w: 66, h: 11, type: 'input' },
        ],
      }),
    ],
  },
  {
    id: 'revenue-reporting',
    title: 'Revenue and reporting',
    category: 'money',
    time: '3 min',
    summary: 'How to read revenue without confusing reporting with reconciliation.',
    outcome: 'The operator can identify performance signals and decide the next business action.',
    beforeStart: 'Choose the date range and decision type: pricing, fleet, marketing, or reconciliation.',
    doneWhen: 'You can name the signal, the supporting data, and the next action.',
    escalateIf: 'Revenue totals do not reconcile with Payments or a trend would cause a major pricing/fleet change.',
    doNotProceedIf: [
      'The date range is wrong or too small for the decision.',
      'Payment status has not been checked for reconciliation questions.',
      'One chart point is being used to justify a major pricing or fleet change.',
    ],
    routeLabel: 'Revenue',
    routePath: '/revenue',
    tags: ['revenue', 'analytics', 'reporting'],
    searchKeywords: ['revenue', 'reporting', 'analytics', 'kpi', 'export csv', 'vehicle performance', 'rate type', 'lead funnel', 'heatmap'],
    steps: [
      'Pick the reporting range first.',
      'Read total revenue, this month, average booking value, and average rental length together.',
      'Use charts for direction and transaction tables for detail.',
      'Use Payments when the question is whether money was actually collected.',
      'Turn the finding into a pricing, fleet, marketing, or follow-up action.',
    ],
    tips: [
      'Revenue is for decisions. Payments is for reconciliation.',
      'Compare vehicle performance before changing prices.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Set the range',
        caption: 'Revenue numbers are only useful after the date range matches the decision.',
        focusId: 'range',
        cursor: { x: 49, y: 31 },
        blocks: [
          { id: 'range', label: 'Range presets', x: 20, y: 24, w: 66, h: 10, type: 'pill' },
          { id: 'kpis', label: 'Revenue KPIs', x: 20, y: 40, w: 66, h: 14, type: 'grid' },
        ],
      }),
      dashboardFrame({
        heading: 'Read signal and detail',
        caption: 'Charts show the signal; tables and payments confirm what happened.',
        focusId: 'chart',
        cursor: { x: 62, y: 54 },
        blocks: [
          { id: 'chart', label: 'Monthly revenue chart', x: 20, y: 28, w: 42, h: 36, type: 'chart' },
          { id: 'details', label: 'Vehicle / transaction detail', x: 66, y: 28, w: 20, h: 36, type: 'list' },
        ],
      }),
    ],
  },
  {
    id: 'system-health',
    title: 'Settings and system health',
    category: 'system',
    time: '4 min',
    summary: 'Where to look when payments, messages, insurance, webhooks, or customer links behave wrong.',
    outcome: 'The operator knows whether the issue is workflow, provider, notification, or configuration.',
    beforeStart: 'Use this when normal workflow output is missing, delayed, duplicated, or inconsistent.',
    doneWhen: 'Health, payment provider, notification settings, Bonzah, and webhook failures have been checked.',
    escalateIf: 'Failures repeat, live customers are affected, or provider/dashboard states disagree.',
    doNotProceedIf: [
      'A payment, agreement, insurance, or booking-status event has a failed webhook.',
      'Environment mode or provider settings do not match expected test/production mode.',
      'A customer is being asked to repeat payment or checkout before diagnostics are checked.',
    ],
    routeLabel: 'Settings',
    routePath: '/settings',
    tags: ['settings', 'system', 'webhooks'],
    searchKeywords: ['system health', 'settings', 'webhook failures', 'stripe', 'square', 'push notifications', 'sms', 'resend', 'twilio', 'bonzah test connection', 'environment variables'],
    steps: [
      'Open Settings -> System and check backend status and latency.',
      'Review notification settings: Resend, Twilio, site URL, push, quiet hours, team alerts, and automation timing.',
      'Open Settings -> Integrations and run Bonzah Test Connection when insurance status looks wrong.',
      'Open Webhook Failures for failed GHL/automation deliveries tied to customer or booking events.',
      'Escalate with booking code, event type, timestamp, provider state, and customer impact.',
    ],
    tips: [
      'Diagnostics come before repeated customer instructions.',
      'A webhook failure is not background noise if it affects a live booking.',
    ],
    demo: [
      dashboardFrame({
        heading: 'Check system status',
        caption: 'Settings -> System shows backend health, notification configuration, and automation timing.',
        focusId: 'health',
        cursor: { x: 57, y: 37 },
        blocks: [
          { id: 'settings-tabs', label: 'Settings tabs', x: 20, y: 23, w: 66, h: 10, type: 'pill' },
          { id: 'health', label: 'System status and latency', x: 20, y: 39, w: 40, h: 20, type: 'card' },
          { id: 'env', label: 'Notification/env checks', x: 64, y: 39, w: 22, h: 20, type: 'list' },
        ],
      }),
      dashboardFrame({
        heading: 'Check provider activity',
        caption: 'Use Bonzah Test Connection, recent activity, provider screens, and Webhook Failures before retrying customer work.',
        focusId: 'provider',
        cursor: { x: 68, y: 53 },
        blocks: [
          { id: 'provider', label: 'Bonzah / payment provider status', x: 20, y: 27, w: 36, h: 38, type: 'card' },
          { id: 'failures', label: 'Webhook failures', x: 62, y: 27, w: 24, h: 38, type: 'list' },
        ],
      }),
    ],
  },
];

const SEARCH_STOP_WORDS = new Set([
  'and',
  'the',
  'how',
  'what',
  'when',
  'where',
  'with',
  'from',
  'this',
  'that',
  'guide',
  'demo',
  'video',
  'step',
  'steps',
  'flow',
  'use',
  'using',
]);

const SEARCH_ALIASES = {
  approve: ['approval'],
  approval: ['approve'],
  bonzah: ['insurance'],
  charge: ['payment'],
  checkout: ['return'],
  checkin: ['pickup'],
  'check-in': ['pickup'],
  'check-out': ['return'],
  customer: ['renter', 'driver'],
  deposit: ['settle', 'refund'],
  handoff: ['pickup'],
  invoice: ['settlement'],
  license: ['id'],
  link: ['url'],
  message: ['sms', 'email'],
  payment: ['pay', 'paid'],
  pay: ['payment'],
  pickup: ['handoff', 'check-in'],
  refund: ['deposit'],
  return: ['checkout'],
  signature: ['agreement'],
  sms: ['message'],
  vehicle: ['fleet', 'car'],
  webhook: ['failure'],
};

const SINGLE_TERM_OWNER = {
  payment: ['payments-deposits-refunds'],
  payments: ['payments-deposits-refunds'],
  deposit: ['payments-deposits-refunds'],
  deposits: ['payments-deposits-refunds'],
  refund: ['payments-deposits-refunds'],
  refunds: ['payments-deposits-refunds'],
  pay: ['customer-payment-after-approval'],
  paid: ['customer-payment-after-approval'],
  link: ['admin-approval-payment-unlock', 'customer-payment-after-approval'],
  approval: ['admin-approval-payment-unlock'],
  approve: ['admin-approval-payment-unlock'],
  approved: ['admin-approval-payment-unlock', 'customer-payment-after-approval'],
  id: ['customer-verification-approval-gate'],
  license: ['customer-verification-approval-gate'],
  signature: ['customer-verification-approval-gate'],
  agreement: ['customer-verification-approval-gate'],
  insurance: ['insurance-review'],
  bonzah: ['insurance-review'],
  pickup: ['calendar-checkins'],
  handoff: ['calendar-checkins'],
  checkin: ['calendar-checkins'],
  'check-in': ['calendar-checkins'],
  return: ['calendar-checkins'],
  checkout: ['calendar-checkins'],
  'check-out': ['calendar-checkins'],
  webhook: ['system-health'],
  webhooks: ['system-health'],
  settings: ['system-health'],
  system: ['system-health'],
};

const PHRASE_OWNER = {
  'approve booking': ['admin-approval-payment-unlock'],
  'admin approval': ['admin-approval-payment-unlock'],
  'payment link': ['admin-approval-payment-unlock', 'customer-payment-after-approval'],
  'send continue link': ['admin-approval-payment-unlock'],
  'customer booking': ['customer-booking-flow'],
  'customer request': ['customer-booking-flow'],
  'customer payment': ['customer-payment-after-approval'],
  'pay after approval': ['customer-payment-after-approval'],
  'driver license': ['customer-verification-approval-gate'],
  'license scan': ['customer-verification-approval-gate'],
  'insurance choice': ['customer-verification-approval-gate'],
  'approval gate': ['customer-verification-approval-gate'],
  'awaiting approval': ['customer-verification-approval-gate'],
};

function tokenize(query) {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^a-z0-9-]/g, ''))
    .filter((token) => (token === 'id' || token.length >= 3) && !SEARCH_STOP_WORDS.has(token));
}

function expandToken(token) {
  return [token, ...(SEARCH_ALIASES[token] || [])];
}

function fieldIncludes(text, terms) {
  const source = String(text || '').toLowerCase();
  return terms.some((term) => source.includes(term));
}

function guideSearchFields(guide) {
  return {
    title: guide.title,
    keyword: (guide.searchKeywords || []).join(' '),
    tag: (guide.tags || []).join(' '),
    screen: `${guide.routeLabel || ''} ${guide.routePath || ''}`,
  };
}

function scoreGuide(guide, tokens, rawQuery) {
  const fields = guideSearchFields(guide);
  let score = fieldIncludes(fields.title, [rawQuery]) || fieldIncludes(fields.keyword, [rawQuery]) ? 120 : 0;
  let matched = 0;

  tokens.forEach((token) => {
    const terms = expandToken(token);
    let tokenScore = 0;
    if (fieldIncludes(fields.title, terms)) tokenScore += 55;
    if (fieldIncludes(fields.keyword, terms)) tokenScore += 44;
    if (fieldIncludes(fields.tag, terms)) tokenScore += 28;
    if (fieldIncludes(fields.screen, terms)) tokenScore += 16;
    if (tokenScore > 0) matched += 1;
    score += tokenScore;
  });

  if (!matched) return 0;
  if (tokens.length > 1 && matched < tokens.length) return 0;
  if (score < 56) return 0;
  return score;
}

export function searchGuides(query, category = 'all') {
  const normalized = query.trim().toLowerCase();
  const categoryMatches = KNOWLEDGE_GUIDES.filter((guide) => category === 'all' || guide.category === category);
  if (!normalized) return categoryMatches;

  const tokens = tokenize(normalized);
  if (!tokens.length) return categoryMatches;

  if (PHRASE_OWNER[normalized]) {
    const owned = PHRASE_OWNER[normalized]
      .map((id) => categoryMatches.find((guide) => guide.id === id))
      .filter(Boolean);
    if (owned.length) return owned;
  }

  if (tokens.length === 1 && SINGLE_TERM_OWNER[tokens[0]]) {
    const owned = SINGLE_TERM_OWNER[tokens[0]]
      .map((id) => categoryMatches.find((guide) => guide.id === id))
      .filter(Boolean);
    if (owned.length) return owned;
  }

  return categoryMatches
    .map((guide) => ({ guide, score: scoreGuide(guide, tokens, normalized) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.guide.title.localeCompare(b.guide.title))
    .map((result) => result.guide);
}

export function getGuideSearchMatches(guide, query) {
  const tokens = tokenize(query);
  if (!tokens.length) return [];

  const fields = guideSearchFields(guide);
  const matches = [];

  tokens.forEach((token) => {
    const terms = expandToken(token);
    const labels = [];
    if (fieldIncludes(fields.title, terms)) labels.push('title');
    if (fieldIncludes(fields.keyword, terms)) labels.push('keyword');
    if (fieldIncludes(fields.tag, terms)) labels.push('tag');
    if (fieldIncludes(fields.screen, terms)) labels.push('screen');
    if (labels.length) matches.push(`${token}: ${labels.slice(0, 2).join(' + ')}`);
  });

  return [...new Set(matches)].slice(0, 3);
}
