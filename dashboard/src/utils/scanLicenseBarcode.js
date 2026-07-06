/**
 * Decode the PDF417 barcode on the back of a US/Canada driver's license from a
 * photo, entirely in the browser (ZXing) — no API call, no PII leaves the device.
 * Returns parsed AAMVA fields, or null if no readable barcode was found.
 */
import { BrowserPDF417Reader } from '@zxing/browser';
import { parseAamva } from './aamva';

export async function scanLicenseBarcode(file) {
  const url = URL.createObjectURL(file);
  try {
    const reader = new BrowserPDF417Reader();
    const result = await reader.decodeFromImageUrl(url);
    const text = result?.getText?.();
    if (!text) return null;
    const parsed = parseAamva(text);
    // Only treat as a hit if we got at least an identifying field.
    if (!parsed.licenseNumber && !parsed.lastName) return null;
    return parsed;
  } catch {
    // No barcode detected / unreadable photo — caller falls back to manual entry.
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
