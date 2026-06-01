import 'dotenv/config';

const API_KEY = process.env.AUTO_DEV_API_KEY;
const BASE_URL = 'https://api.auto.dev';

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

/**
 * Decode a VIN to get vehicle specs.
 * Returns: { make, model, year, trim, body, engine, drive, transmission }
 */
export async function decodeVin(vin) {
  const res = await fetch(`${BASE_URL}/vin/${vin.toUpperCase()}`, { headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error(`[auto.dev] VIN decode failed for ${vin}:`, err);
    return null;
  }
  const data = await res.json();
  return {
    vin: data.vin,
    make: data.make,
    model: data.model,
    year: data.vehicle?.year,
    trim: data.trim || null,
    body: data.body || null,
    engine: data.engine || null,
    drive: data.drive || null,
    transmission: data.transmission || 'Automatic',
    style: data.style || null,
  };
}

/**
 * Get photos for a VIN.
 * Returns: string[] of photo URLs (may be empty)
 */
export async function getPhotos(vin) {
  const res = await fetch(`${BASE_URL}/photos/${vin.toUpperCase()}`, { headers });
  if (!res.ok) {
    console.warn(`[auto.dev] No photos for ${vin}`);
    return [];
  }
  const data = await res.json();
  const retail = data?.data?.retail || [];
  const wholesale = data?.data?.wholesale || [];
  // Prefer retail, fall back to wholesale
  return retail.length > 0 ? retail : wholesale;
}

/**
 * Full enrichment: VIN decode + photos.
 * Returns combined data or null on failure.
 */
export async function enrichVehicle(vin) {
  const [specs, photos] = await Promise.all([
    decodeVin(vin),
    getPhotos(vin),
  ]);

  if (!specs) return null;

  return {
    ...specs,
    photos,
    thumbnail_url: photos[0] || null,
  };
}
