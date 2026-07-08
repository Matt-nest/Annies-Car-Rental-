import brand from '../config/brand';

const MAIN_SITE = brand.siteUrl;

/** Prefix relative fleet paths with the customer site origin. */
export function resolveThumb(url) {
  if (!url) return '';
  return url.startsWith('/fleet/') ? `${MAIN_SITE}${url}` : url;
}

/**
 * Resolve a displayable image URL from a vehicle row (GET /vehicles/available).
 * Probes thumbnail_url, photo_urls, images[], and legacy field names.
 */
export function vehicleImageUrl(v) {
  if (!v) return null;

  if (v.thumbnail_url) return resolveThumb(v.thumbnail_url);

  const photos = v.photo_urls;
  if (Array.isArray(photos) && photos.length) {
    const first = photos[0];
    return resolveThumb(typeof first === 'string' ? first : (first?.url || first?.src || null));
  }

  const imgs = v.images;
  if (Array.isArray(imgs) && imgs.length) {
    const first = imgs[0];
    const raw = typeof first === 'string' ? first : (first?.url || first?.src || null);
    return resolveThumb(raw);
  }

  const legacy = v.photo_url || v.image_url || v.hero_image || null;
  return legacy ? resolveThumb(legacy) : null;
}
