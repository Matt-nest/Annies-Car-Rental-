/**
 * Azure AI Document Intelligence — prebuilt-idDocument fallback for license OCR.
 * Used only when the in-browser PDF417 barcode scan fails (front photo, foreign
 * ID, unreadable barcode). Reads the FRONT of US driver's licenses + passports.
 *
 * Gated by AZURE_DOCINTEL_ENDPOINT + AZURE_DOCINTEL_KEY — a no-op (returns null)
 * when unset, so clones without Azure configured just fall back to manual entry.
 */

const ENDPOINT = process.env.AZURE_DOCINTEL_ENDPOINT;
const KEY = process.env.AZURE_DOCINTEL_KEY;
const API_VERSION = '2024-11-30';

export const AZURE_ID_SCAN_ENABLED = Boolean(ENDPOINT && KEY);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scanIdDocument(buffer) {
  if (!AZURE_ID_SCAN_ENABLED) return null;
  const base = ENDPOINT.replace(/\/+$/, '');
  const analyzeUrl = `${base}/documentintelligence/documentModels/prebuilt-idDocument:analyze?api-version=${API_VERSION}`;

  const submit = await fetch(analyzeUrl, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': KEY, 'Content-Type': 'application/octet-stream' },
    body: buffer,
  });
  if (submit.status !== 202) {
    const t = await submit.text().catch(() => '');
    throw new Error(`Azure analyze submit failed: ${submit.status} ${t.slice(0, 160)}`);
  }
  const opLoc = submit.headers.get('operation-location');
  if (!opLoc) throw new Error('Azure returned no operation-location');

  // Poll the async operation (Azure typically completes in 1–4s).
  let analyzeResult = null;
  for (let i = 0; i < 15; i++) {
    await sleep(1000);
    const poll = await fetch(opLoc, { headers: { 'Ocp-Apim-Subscription-Key': KEY } });
    const json = await poll.json();
    if (json.status === 'succeeded') { analyzeResult = json.analyzeResult; break; }
    if (json.status === 'failed') throw new Error('Azure analysis failed');
  }
  if (!analyzeResult) throw new Error('Azure analysis timed out');

  const doc = analyzeResult.documents?.[0];
  if (!doc) return null;
  const f = doc.fields || {};
  const str = (x) => x?.valueString || x?.content || undefined;
  const date = (x) => x?.valueDate || undefined;
  const addr = f.Address?.valueAddress || {};

  const line1 = addr.streetAddress || [addr.houseNumber, addr.road].filter(Boolean).join(' ') || undefined;
  const rawState = addr.state || str(f.Region);
  const state = rawState && /^[A-Za-z]{2}$/.test(rawState) ? rawState.toUpperCase() : undefined;
  const zip = (addr.postalCode || '').replace(/\D/g, '').slice(0, 5) || undefined;

  return {
    firstName: str(f.FirstName),
    lastName: str(f.LastName),
    licenseNumber: str(f.DocumentNumber),
    state,
    dob: date(f.DateOfBirth),
    expiry: date(f.DateOfExpiration),
    addressLine1: line1,
    city: addr.city || undefined,
    zip,
  };
}
