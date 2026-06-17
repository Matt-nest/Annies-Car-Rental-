#!/usr/bin/env node
/**
 * One-shot image optimizer for the heavy /public photos used by the React site.
 *
 * Why a committed script + committed .webp outputs (not a build-time plugin):
 *   • The outputs are checked in, so the Vercel build needs no `cwebp` binary
 *     and clones inherit the optimized assets for free.
 *   • Originals are KEPT — the gig-logo PNGs are also referenced by the static
 *     public/drive.html and ads/index.html, which we don't touch here. The
 *     React components use <picture> with the .webp + original fallback.
 *
 * Requires `cwebp` (brew install webp). Re-run after replacing any source photo:
 *   node scripts/optimize-images.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pub = (f) => resolve(root, 'public', f);

// [source, output, max-width px, quality] — max-width preserves aspect (height 0).
const JOBS = [
  ['rideshare-driver.jpeg', 'rideshare-driver.webp', 1000, 80],
  ['happy-driver.png',      'happy-driver.webp',      900, 80],
  ['UBER.png',              'UBER.webp',              128, 88],
  ['Doordash.png',          'Doordash.webp',          128, 88],
  ['Lyft.png',              'Lyft.webp',              128, 88],
];

const kb = (p) => (statSync(p).size / 1024).toFixed(0) + ' KB';

for (const [src, out, width, q] of JOBS) {
  const srcPath = pub(src);
  const outPath = pub(out);
  if (!existsSync(srcPath)) {
    console.warn(`skip (missing): ${src}`);
    continue;
  }
  execSync(`cwebp -quiet -resize ${width} 0 -q ${q} "${srcPath}" -o "${outPath}"`);
  console.log(`${src} (${kb(srcPath)}) -> ${out} (${kb(outPath)})`);
}
