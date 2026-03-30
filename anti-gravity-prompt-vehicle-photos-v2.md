# Anti-Gravity Prompt: Replace Vehicle Photos with Color-Accurate Make/Model/Year Images

## What needs to change

Every vehicle listing currently uses generic Unsplash car photos that don't match the actual make, model, year, or color. Replace the images for each vehicle with 8 Unsplash photos that match the correct car AND color. All 8 photos for a given vehicle should show the same color car so the listing looks consistent.

## Target angles for the 8 photos per vehicle
1. Front 3/4 view (hero/thumbnail shot)
2. Rear 3/4 view
3. Side profile
4. Front straight-on
5. Rear straight-on
6. Interior / dashboard
7. Interior rear seats or trunk
8. Driving/action shot or detail/wheel closeup

## Image URL format

Use Unsplash image URLs:
- Gallery (1600w): `https://images.unsplash.com/photo-XXXXX?q=80&w=1600&auto=format&fit=crop`
- Thumbnail (800w): `https://images.unsplash.com/photo-XXXXX?q=80&w=800&auto=format&fit=crop`

## Complete Vehicle List with Colors

| vehicleId | Vehicle | Color | Search Query |
|-----------|---------|-------|-------------|
| v-a3 | Audi A3 2016 | White | white Audi A3 |
| v-sonic | Chevrolet Sonic 2017 | White | white Chevrolet Sonic |
| v-expedition | Ford Expedition Max 2018 | Dark gray/charcoal | dark gray Ford Expedition |
| v-fiesta-16 | Ford Fiesta 2016 | Dark gray/black | black Ford Fiesta |
| v-fiesta-19a | Ford Fiesta 2019 (80BYBH) | Dark gray/black | black Ford Fiesta |
| v-fiesta-19b | Ford Fiesta 2019 (cipc91) | Dark gray/black | black Ford Fiesta |
| v-focus-16a | Ford Focus 2016 (85ELLR) | Dark gray/black | dark gray Ford Focus |
| v-focus-16b | Ford Focus 2016 (34ELLR) | Dark gray/black | dark gray Ford Focus |
| v-focus-18 | Ford Focus 2018 | Dark gray/black | dark gray Ford Focus |
| v-civic | Honda Civic 2016 | Dark gray/black | dark gray Honda Civic |
| v-elantra | Hyundai Elantra 2018 | Dark gray/black | dark gray Hyundai Elantra |
| v-sonata | Hyundai Sonata 2019 | Dark gray/black | dark gray Hyundai Sonata |
| v-mazda3 | Mazda Mazda3 2018 | Dark gray/black | dark gray Mazda3 |
| v-cla | Mercedes-Benz CLA-Class 2018 | Black | black Mercedes CLA |
| v-altima-19 | Nissan Altima 2019 | Black | black Nissan Altima |
| v-altima-21 | Nissan Altima 2021 | Black | black Nissan Altima |
| v-altima-22 | Nissan Altima 2022 | Black | black Nissan Altima |
| v-altima-23 | Nissan Altima 2023 | Black | black Nissan Altima |
| v-altima-24 | Nissan Altima 2024 | Black | black Nissan Altima |
| v-altima-25 | Nissan Altima 2025 | Black | black Nissan Altima |
| v-murano | Nissan Murano 2021 | Black | black Nissan Murano |
| v-rogue | Nissan Rogue 2019 | Black | black Nissan Rogue |
| v-sentra-a | Nissan Sentra 2020 (DSS67886) | Black | black Nissan Sentra |
| v-sentra-b | Nissan Sentra 2020 (31EYAH) | Gray | gray Nissan Sentra |
| v-jetta-19a | Volkswagen Jetta 2019 (DVT8863) | Gray | gray Volkswagen Jetta |
| v-jetta-19b | Volkswagen Jetta 2019 (DY21BE) | Gray | gray Volkswagen Jetta |
| v-jetta-21 | Volkswagen Jetta 2021 | Gray/silver | silver Volkswagen Jetta |
| v-passat-18a | Volkswagen Passat 2018 (DSS7055) | Silver/gray | silver Volkswagen Passat |
| v-passat-18b | Volkswagen Passat 2018 (20EURQ) | Silver/gray | silver Volkswagen Passat |
| v-passat-21 | Volkswagen Passat 2021 | Gray | gray Volkswagen Passat |

## Important rules

1. **Color consistency is critical.** All 8 photos for a vehicle MUST show the same color car. A listing showing a white car in one photo and a black car in another looks fake.
2. For duplicate vehicles (same make/model/year, different plate), reuse the same image set UNLESS the colors differ (e.g., v-sentra-a is black, v-sentra-b is gray — these need different image sets).
3. The `image` field (thumbnail) should be the best front 3/4 shot.
4. The `images` array should have all 8 photos.
5. If you can't find 8 color-matched photos, use fewer rather than mixing colors. 4-5 consistent photos is better than 8 mismatched ones.
6. If exact model results are scarce on Unsplash, try broader searches like "black sedan interior" or "car dashboard" for interior shots — those are color-neutral and work for any vehicle.
7. Don't change any other vehicle data (price, mpg, seats, etc.) — just the `image` and `images` fields.
