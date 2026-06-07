# src/brands — per-brand override seam

This folder is the **one place** a clone puts code that the template (Annie's) will
never have. Keeping brand-only code here — instead of editing shared files — is what
lets a clone keep pulling template fixes with `git merge template/main` without
conflicts.

## The three tiers (pick the lightest that works)

1. **Visual / content** — colors, copy, logo, phone, address, vehicles.
   → No code. Set `VITE_BRAND_*` env vars + swap files in `public/`. See `src/config/brand.ts`.

2. **Optional behaviour that another brand might also want one day.**
   → Add a flag to `brand.features` (`src/config/brand.ts`) and gate the code in the
   **shared** tree on it. Default off → Annie unaffected; the brand sets
   `VITE_FEATURE_<X>=true`. The code stays shared and mergeable.

   ```tsx
   import { brand } from '../config/brand';
   {brand.features.loyalty && <LoyaltyBanner />}
   ```

3. **Truly one-off for this brand only.**
   → Put the component/page in `src/brands/<brand-slug>/` and import it from the
   relevant slot. Because it lives only here, `git merge template/main` never touches it.

   ```
   src/brands/
     acme/
       AcmeHeroOverride.tsx
       AcmePromoBanner.tsx
   ```

   Wire it from a shared slot guarded by a flag or brand check so the shared file's
   diff stays tiny (one import + one conditional):

   ```tsx
   // in the shared Hero slot
   import { brand } from '../config/brand';
   const HeroOverride = brand.features.customHero
     ? (await import('../brands/acme/AcmeHeroOverride')).default
     : null;
   ```

## Rules of thumb

- **Never** hardcode a brand value in a shared file — read it from `brand` (`src/config/brand.ts`).
- A shared-file change for one brand should be **one import + one conditional**, nothing more.
- If two brands need the same thing, promote it to a `brand.features` flag (tier 2) — don't copy it into two `src/brands/*` folders.
- Keep the template (`main`) brand-neutral. Annie's specifics are just the *default* values.

## Pulling template fixes into a clone

```bash
git remote add template <template-repo-url>   # once
git fetch template
git merge template/main                        # conflicts only where you edited SHARED files
```

The cleaner your seam, the cleaner the merge. This folder + `brand.features` + the
`VITE_BRAND_*` defaults are the seam.
