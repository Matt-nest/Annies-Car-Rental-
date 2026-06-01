-- Supabase migration: Update vehicle images to local multi-angle PNGs
-- Match by VIN (the unique identifier for each physical vehicle)
-- Run this in the Supabase SQL Editor

-- 1N4BL4DV7PN338432 — 2023 Nissan Altima (Gray)
UPDATE vehicles SET
  thumbnail_url = '/fleet/1N4BL4DV7PN338432/hero.png',
  photo_urls = ARRAY['/fleet/1N4BL4DV7PN338432/hero.png', '/fleet/1N4BL4DV7PN338432/side.png', '/fleet/1N4BL4DV7PN338432/rear.png']
WHERE vin = '1N4BL4DV7PN338432';

-- 3N1AB8DV3LY242328 — 2020 Nissan Sentra (Gray)
UPDATE vehicles SET
  thumbnail_url = '/fleet/3N1AB8DV3LY242328/hero.png',
  photo_urls = ARRAY['/fleet/3N1AB8DV3LY242328/hero.png', '/fleet/3N1AB8DV3LY242328/side.png', '/fleet/3N1AB8DV3LY242328/rear.png']
WHERE vin = '3N1AB8DV3LY242328';

-- 1N4BL4CV2MN401644 — 2021 Nissan Altima (Black)
UPDATE vehicles SET
  thumbnail_url = '/fleet/1N4BL4CV2MN401644/hero.png',
  photo_urls = ARRAY['/fleet/1N4BL4CV2MN401644/hero.png', '/fleet/1N4BL4CV2MN401644/side.png', '/fleet/1N4BL4CV2MN401644/rear.png']
WHERE vin = '1N4BL4CV2MN401644';

-- 3N1AB8DV6LY290213 — 2020 Nissan Sentra (White)
UPDATE vehicles SET
  thumbnail_url = '/fleet/3N1AB8DV6LY290213/hero.png',
  photo_urls = ARRAY['/fleet/3N1AB8DV6LY290213/hero.png', '/fleet/3N1AB8DV6LY290213/side.png', '/fleet/3N1AB8DV6LY290213/rear.png']
WHERE vin = '3N1AB8DV6LY290213';

-- 3VWC57BU8KM236254 — 2019 Volkswagen Jetta (Gray)
UPDATE vehicles SET
  thumbnail_url = '/fleet/3VWC57BU8KM236254/hero.png',
  photo_urls = ARRAY['/fleet/3VWC57BU8KM236254/hero.png', '/fleet/3VWC57BU8KM236254/side.png', '/fleet/3VWC57BU8KM236254/rear.png']
WHERE vin = '3VWC57BU8KM236254';

-- 1N4BL4DVXRN318274 — 2024 Nissan Altima (Burgundy)
UPDATE vehicles SET
  thumbnail_url = '/fleet/1N4BL4DVXRN318274/hero.png',
  photo_urls = ARRAY['/fleet/1N4BL4DVXRN318274/hero.png', '/fleet/1N4BL4DVXRN318274/side.png', '/fleet/1N4BL4DVXRN318274/rear.png']
WHERE vin = '1N4BL4DVXRN318274';

-- 19XFC2F55GE085810 — 2016 Honda Civic (Gray) — missing side
UPDATE vehicles SET
  thumbnail_url = '/fleet/19XFC2F55GE085810/hero.png',
  photo_urls = ARRAY['/fleet/19XFC2F55GE085810/hero.png', '/fleet/19XFC2F55GE085810/rear.png']
WHERE vin = '19XFC2F55GE085810';

-- 1VWAA7A34JC051095 — 2018 Volkswagen Passat (Gray)
UPDATE vehicles SET
  thumbnail_url = '/fleet/1VWAA7A34JC051095/hero.png',
  photo_urls = ARRAY['/fleet/1VWAA7A34JC051095/hero.png', '/fleet/1VWAA7A34JC051095/side.png', '/fleet/1VWAA7A34JC051095/rear.png']
WHERE vin = '1VWAA7A34JC051095';

-- 1FMJK1KT1JEA47064 — 2018 Ford Expedition Max (Black)
UPDATE vehicles SET
  thumbnail_url = '/fleet/1FMJK1KT1JEA47064/hero.png',
  photo_urls = ARRAY['/fleet/1FMJK1KT1JEA47064/hero.png', '/fleet/1FMJK1KT1JEA47064/side.png', '/fleet/1FMJK1KT1JEA47064/rear.png']
WHERE vin = '1FMJK1KT1JEA47064';

-- 1N4BL4DV4SN333164 — 2025 Nissan Altima (Gray)
UPDATE vehicles SET
  thumbnail_url = '/fleet/1N4BL4DV4SN333164/hero.png',
  photo_urls = ARRAY['/fleet/1N4BL4DV4SN333164/hero.png', '/fleet/1N4BL4DV4SN333164/side.png', '/fleet/1N4BL4DV4SN333164/rear.png']
WHERE vin = '1N4BL4DV4SN333164';

-- 1VWAA7A30JC008356 — 2018 Volkswagen Passat (White) — missing rear
UPDATE vehicles SET
  thumbnail_url = '/fleet/1VWAA7A30JC008356/hero.png',
  photo_urls = ARRAY['/fleet/1VWAA7A30JC008356/hero.png', '/fleet/1VWAA7A30JC008356/side.png']
WHERE vin = '1VWAA7A30JC008356';

-- 5N1AZ2BJ3MC123044 — 2021 Nissan Murano (Black)
UPDATE vehicles SET
  thumbnail_url = '/fleet/5N1AZ2BJ3MC123044/hero.png',
  photo_urls = ARRAY['/fleet/5N1AZ2BJ3MC123044/hero.png', '/fleet/5N1AZ2BJ3MC123044/side.png', '/fleet/5N1AZ2BJ3MC123044/rear.png']
WHERE vin = '5N1AZ2BJ3MC123044';

-- 5NPE34AF2KH775218 — 2019 Hyundai Sonata (Blue) — missing side and rear
UPDATE vehicles SET
  thumbnail_url = '/fleet/5NPE34AF2KH775218/hero.png',
  photo_urls = ARRAY['/fleet/5NPE34AF2KH775218/hero.png']
WHERE vin = '5NPE34AF2KH775218';

-- 1G1JD5SB2H4115202 — 2017 Chevrolet Sonic (White) — missing rear
UPDATE vehicles SET
  thumbnail_url = '/fleet/1G1JD5SB2H4115202/hero.png',
  photo_urls = ARRAY['/fleet/1G1JD5SB2H4115202/hero.png', '/fleet/1G1JD5SB2H4115202/side.png']
WHERE vin = '1G1JD5SB2H4115202';

-- 3VWC57BU0MM044667 — 2021 Volkswagen Jetta (White) — missing rear
UPDATE vehicles SET
  thumbnail_url = '/fleet/3VWC57BU0MM044667/hero.png',
  photo_urls = ARRAY['/fleet/3VWC57BU0MM044667/hero.png', '/fleet/3VWC57BU0MM044667/side.png']
WHERE vin = '3VWC57BU0MM044667';

-- JN8AT2MT2KW254745 — 2019 Nissan Rogue (Black) — missing rear
UPDATE vehicles SET
  thumbnail_url = '/fleet/JN8AT2MT2KW254745/hero.png',
  photo_urls = ARRAY['/fleet/JN8AT2MT2KW254745/hero.png', '/fleet/JN8AT2MT2KW254745/side.png']
WHERE vin = 'JN8AT2MT2KW254745';

-- WAUB8GFF7G1059702 — 2016 Audi A3 (White)
UPDATE vehicles SET
  thumbnail_url = '/fleet/WAUB8GFF7G1059702/hero.png',
  photo_urls = ARRAY['/fleet/WAUB8GFF7G1059702/hero.png', '/fleet/WAUB8GFF7G1059702/side.png', '/fleet/WAUB8GFF7G1059702/rear.png']
WHERE vin = 'WAUB8GFF7G1059702';

-- 3FADP4EJ0GM165887 — 2016 Ford Fiesta (Black)
UPDATE vehicles SET
  thumbnail_url = '/fleet/3FADP4EJ0GM165887/hero.png',
  photo_urls = ARRAY['/fleet/3FADP4EJ0GM165887/hero.png', '/fleet/3FADP4EJ0GM165887/side.png', '/fleet/3FADP4EJ0GM165887/rear.png']
WHERE vin = '3FADP4EJ0GM165887';

-- 3FADP4EJ9KM106264 — 2019 Ford Fiesta (Gray)
UPDATE vehicles SET
  thumbnail_url = '/fleet/3FADP4EJ9KM106264/hero.png',
  photo_urls = ARRAY['/fleet/3FADP4EJ9KM106264/hero.png', '/fleet/3FADP4EJ9KM106264/side.png', '/fleet/3FADP4EJ9KM106264/rear.png']
WHERE vin = '3FADP4EJ9KM106264';

-- 3FADP4EJXKM149771 — 2019 Ford Fiesta (Black)
UPDATE vehicles SET
  thumbnail_url = '/fleet/3FADP4EJXKM149771/hero.png',
  photo_urls = ARRAY['/fleet/3FADP4EJXKM149771/hero.png', '/fleet/3FADP4EJXKM149771/side.png', '/fleet/3FADP4EJXKM149771/rear.png']
WHERE vin = '3FADP4EJXKM149771';

-- 1FADP3K26JL262219 — 2018 Ford Focus (Gray) — missing rear
UPDATE vehicles SET
  thumbnail_url = '/fleet/1FADP3K26JL262219/hero.png',
  photo_urls = ARRAY['/fleet/1FADP3K26JL262219/hero.png', '/fleet/1FADP3K26JL262219/side.png']
WHERE vin = '1FADP3K26JL262219';

-- KMHD04LB3JU472768 — 2018 Hyundai Elantra (Gray) — missing side and rear
UPDATE vehicles SET
  thumbnail_url = '/fleet/KMHD04LB3JU472768/hero.png',
  photo_urls = ARRAY['/fleet/KMHD04LB3JU472768/hero.png']
WHERE vin = 'KMHD04LB3JU472768';

-- 3MZBN1W33JM158734 — 2018 Mazda Mazda3 (Black)
UPDATE vehicles SET
  thumbnail_url = '/fleet/3MZBN1W33JM158734/hero.png',
  photo_urls = ARRAY['/fleet/3MZBN1W33JM158734/hero.png', '/fleet/3MZBN1W33JM158734/side.png', '/fleet/3MZBN1W33JM158734/rear.png']
WHERE vin = '3MZBN1W33JM158734';

-- 3VWC57BU6KM129297 — 2019 Volkswagen Jetta (Black) — missing side
UPDATE vehicles SET
  thumbnail_url = '/fleet/3VWC57BU6KM129297/hero.png',
  photo_urls = ARRAY['/fleet/3VWC57BU6KM129297/hero.png', '/fleet/3VWC57BU6KM129297/rear.png']
WHERE vin = '3VWC57BU6KM129297';

-- 1VWSA7A37MC015474 — 2021 Volkswagen Passat (Blue)
UPDATE vehicles SET
  thumbnail_url = '/fleet/1VWSA7A37MC015474/hero.png',
  photo_urls = ARRAY['/fleet/1VWSA7A37MC015474/hero.png', '/fleet/1VWSA7A37MC015474/side.png', '/fleet/1VWSA7A37MC015474/rear.png']
WHERE vin = '1VWSA7A37MC015474';

-- 1N4BL4DV3SN363627 — 2025 Nissan Altima (White)
UPDATE vehicles SET
  thumbnail_url = '/fleet/1N4BL4DV3SN363627/hero.png',
  photo_urls = ARRAY['/fleet/1N4BL4DV3SN363627/hero.png', '/fleet/1N4BL4DV3SN363627/side.png', '/fleet/1N4BL4DV3SN363627/rear.png']
WHERE vin = '1N4BL4DV3SN363627';
