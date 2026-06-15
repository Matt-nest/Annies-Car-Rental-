/**
 * Parse an AAMVA-standard PDF417 driver-license barcode payload (the barcode on
 * the BACK of US/Canada licenses) into structured fields. Pure string parsing —
 * no dependencies. Field codes per the AAMVA DL/ID Card Design Standard.
 *
 * Ported verbatim from the customer site (src/utils/aamva.ts) so the admin
 * scanner reads licenses identically. Returns a plain object:
 *   { firstName, lastName, licenseNumber, jurisdiction, dob, expiry,
 *     addressLine1, city, zip }  — all keys optional.
 */

/**
 * AAMVA dates are 8 digits: MMDDCCYY (US) or CCYYMMDD (Canada). Disambiguate by
 * checking whether the first four digits form a plausible year.
 */
function parseAamvaDate(raw) {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (digits.length !== 8) return undefined;

  let y, m, d;
  const head = parseInt(digits.slice(0, 4), 10);
  if (head >= 1900 && head <= 2100) {
    // CCYYMMDD
    y = digits.slice(0, 4); m = digits.slice(4, 6); d = digits.slice(6, 8);
  } else {
    // MMDDCCYY
    m = digits.slice(0, 2); d = digits.slice(2, 4); y = digits.slice(4, 8);
  }
  const mi = +m, di = +d, yi = +y;
  if (mi < 1 || mi > 12 || di < 1 || di > 31 || yi < 1900 || yi > 2100) return undefined;
  return `${y}-${m}-${d}`;
}

export function parseAamva(text) {
  // Each element is a 3-letter code + value, terminated by a line break. Match
  // against the whole payload (not line-by-line) so an element concatenated onto
  // the subfile header line is still found. Value runs to the next line break.
  const get = (code) => {
    const m = text.match(new RegExp(code + '([^\\n\\r]*)'));
    if (!m) return undefined;
    const v = m[1].trim().replace(/[^\x20-\x7E].*$/, '').trim();
    return v || undefined;
  };

  const jurisdiction = get('DAJ'); // jurisdiction code (state) — issuing & residence
  const rawZip = get('DAK');
  const zip = rawZip ? rawZip.replace(/\D/g, '').slice(0, 5) : undefined;

  return {
    lastName: get('DCS') || get('DAB'),
    firstName: get('DAC') || get('DCT'),
    licenseNumber: get('DAQ'),
    jurisdiction: jurisdiction && /^[A-Z]{2}$/.test(jurisdiction) ? jurisdiction : undefined,
    dob: parseAamvaDate(get('DBB')),
    expiry: parseAamvaDate(get('DBA')),
    addressLine1: get('DAG'),
    city: get('DAI'),
    zip: zip || undefined,
  };
}
