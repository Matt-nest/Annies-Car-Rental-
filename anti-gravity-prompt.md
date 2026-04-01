# Anti-Gravity Prompt: Replace Reviews with Real Turo Data

## Context
The site currently has 78 hardcoded reviews stored in a `const Do = [...]` array. Each review object has this exact structure:

```js
{
  id: "r-1",
  vehicleId: "v-expedition",
  reviewerName: "Jay",
  rating: 5,
  comment: "Everything was great; pickup and the vehicle were amazing. I recommend it.",
  avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=64&h=64&q=80",
  date: "December 2023"
}
```

## What I need you to do

Replace the entire `const Do = [...]` reviews array with the 80 curated reviews from the attached `curated_reviews.json` file. The new data uses the **exact same object structure** — same field names, same format, same types.

**Do NOT change:**
- The variable name (`Do`)
- The review card component or how reviews are rendered
- The vehicle filter/display logic
- Any other part of the site

**Just swap the data array.** The `vehicleId` values in the new data match the existing vehicle IDs on the site exactly (e.g., `v-expedition`, `v-civic`, `v-altima-21`, etc.). All 30 vehicles in the fleet are represented with at least 2 reviews each.

## Also fix
- Change the page `<title>` from "My Google AI Studio App" to "Annie's Car Rental — Port St. Lucie, FL"
- Update any meta description to reflect the business name

## Vehicle ID Reference (for verification)
These are the 30 vehicleIds used in both the site and the new review data:

| vehicleId | Vehicle |
|-----------|---------|
| v-a3 | Audi 2016 A3 |
| v-altima-19 | Nissan 2019 Altima |
| v-altima-21 | Nissan 2021 Altima |
| v-altima-22 | Nissan 2022 Altima |
| v-altima-23 | Nissan 2023 Altima |
| v-altima-24 | Nissan 2024 Altima |
| v-altima-25 | Nissan 2025 Altima |
| v-civic | Honda 2016 Civic |
| v-cla | Mercedes-Benz 2018 CLA-Class |
| v-elantra | Hyundai 2018 Elantra |
| v-expedition | Ford 2018 Expedition Max |
| v-fiesta-16 | Ford 2016 Fiesta |
| v-fiesta-19a | Ford 2019 Fiesta |
| v-fiesta-19b | Ford 2019 Fiesta |
| v-focus-16a | Ford 2016 Focus |
| v-focus-16b | Ford 2016 Focus |
| v-focus-18 | Ford 2018 Focus |
| v-jetta-19a | Volkswagen 2019 Jetta |
| v-jetta-19b | Volkswagen 2019 Jetta |
| v-jetta-21 | Volkswagen 2021 Jetta |
| v-mazda3 | Mazda 2018 Mazda3 |
| v-murano | Nissan 2021 Murano |
| v-passat-18a | Volkswagen 2018 Passat |
| v-passat-18b | Volkswagen 2018 Passat |
| v-passat-21 | Volkswagen 2021 Passat |
| v-rogue | Nissan 2019 Rogue |
| v-sentra-a | Nissan 2020 Sentra |
| v-sentra-b | Nissan 2020 Sentra |
| v-sonata | Hyundai 2019 Sonata |
| v-sonic | Chevrolet 2017 Sonic |
