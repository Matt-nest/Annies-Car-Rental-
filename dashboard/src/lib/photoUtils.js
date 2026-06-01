/**
 * photoUtils.js — Shared utilities for resolving photo storage paths
 * to displayable signed URLs.
 *
 * After the signed-URL expiration fix, photos from private buckets are stored
 * as storage paths (e.g. "booking-123/abc.jpg") instead of full URLs.
 * These need to be re-signed on demand for display.
 *
 * Old records may still contain full URLs (expired or not) — those are passed
 * through unchanged.
 */
import { api } from '../api/client';

/**
 * Check if a value is a storage path (not a URL).
 * Storage paths don't start with http.
 */
export function isStoragePath(urlOrPath) {
  return urlOrPath && typeof urlOrPath === 'string' && !urlOrPath.startsWith('http');
}

/**
 * Resolve a single URL-or-path to a displayable URL.
 * If it's already a URL, return as-is. If it's a storage path, sign it.
 *
 * @param {string} urlOrPath
 * @param {string} bucket — defaults to 'checkin-photos'
 * @returns {Promise<string>}
 */
export async function resolvePhotoUrl(urlOrPath, bucket = 'checkin-photos') {
  if (!urlOrPath) return urlOrPath;
  if (!isStoragePath(urlOrPath)) return urlOrPath; // already a URL

  try {
    const { url } = await api.getSignedUrl(bucket, urlOrPath);
    return url;
  } catch {
    return urlOrPath; // fallback to raw path (won't display, but won't crash)
  }
}

/**
 * Resolve an array of URLs/paths to displayable URLs.
 * Handles mixed arrays (some paths, some full URLs).
 *
 * @param {string[]} urlsOrPaths
 * @param {string} bucket
 * @returns {Promise<string[]>}
 */
export async function resolvePhotoUrls(urlsOrPaths, bucket = 'checkin-photos') {
  if (!Array.isArray(urlsOrPaths) || urlsOrPaths.length === 0) return [];
  return Promise.all(urlsOrPaths.map(u => resolvePhotoUrl(u, bucket)));
}

/**
 * Resolve photo_slots object — each value is either a string path or array of paths.
 * Returns a new object with all paths resolved to signed URLs.
 *
 * @param {Object} slots — e.g. { front: "booking-1/abc.jpg", damage: ["booking-1/d1.jpg"] }
 * @param {string} bucket
 * @returns {Promise<Object>}
 */
export async function resolvePhotoSlots(slots, bucket = 'checkin-photos') {
  if (!slots || typeof slots !== 'object') return slots;
  const resolved = {};
  await Promise.all(
    Object.entries(slots).map(async ([key, value]) => {
      if (Array.isArray(value)) {
        resolved[key] = await resolvePhotoUrls(value, bucket);
      } else if (typeof value === 'string') {
        resolved[key] = await resolvePhotoUrl(value, bucket);
      } else {
        resolved[key] = value;
      }
    })
  );
  return resolved;
}
