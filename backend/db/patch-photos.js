import 'dotenv/config';
import { supabase } from './supabase.js';

// Map VIN → stock photo URLs from imagin.studio (the original curated images)
const PHOTO_MAP = {
  '1N4BL4DV7PN338432': { // Altima 2023
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Altima&modelYear=2023&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Altima&modelYear=2023&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  '3N1AB8DV3LY242328': { // Sentra 2020
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Sentra&modelYear=2020&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Sentra&modelYear=2020&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  '1N4BL4CV2MN401644': { // Altima 2021
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Altima&modelYear=2021&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Altima&modelYear=2021&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  '3N1AB8DV6LY290213': { // Sentra 2020
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Sentra&modelYear=2020&angle=01&paintDescription=grey&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Sentra&modelYear=2020&angle=01&paintDescription=grey&zoomType=fullscreen'],
  },
  '3VWC57BU8KM236254': { // Jetta 2019
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Jetta&modelYear=2019&angle=01&paintDescription=grey&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Jetta&modelYear=2019&angle=01&paintDescription=grey&zoomType=fullscreen'],
  },
  '1N4BL4DVXRN318274': { // Altima 2024
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Altima&modelYear=2024&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Altima&modelYear=2024&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  '19XFC2F55GE085810': { // Civic 2016
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Honda&modelFamily=Civic&modelYear=2016&angle=01&paintDescription=grey&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Honda&modelFamily=Civic&modelYear=2016&angle=01&paintDescription=grey&zoomType=fullscreen'],
  },
  '1VWAA7A34JC051095': { // Passat 2018
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Passat&modelYear=2018&angle=01&paintDescription=silver&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Passat&modelYear=2018&angle=01&paintDescription=silver&zoomType=fullscreen'],
  },
  '1FMJK1KT1JEA47064': { // Expedition Max 2018
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Expedition&modelYear=2018&angle=01&paintDescription=grey&zoomType=fullscreen',
    photos: [
      'https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Expedition&modelYear=2018&angle=01&paintDescription=grey&zoomType=fullscreen',
      'https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Expedition&modelYear=2018&angle=09&paintDescription=grey&zoomType=fullscreen',
      'https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Expedition&modelYear=2018&angle=13&paintDescription=grey&zoomType=fullscreen',
    ],
  },
  '1N4BL4DV4SN333164': { // Altima 2025
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Altima&modelYear=2025&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Altima&modelYear=2025&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  '1VWAA7A30JC008356': { // Passat 2018 R-Line
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Passat&modelYear=2018&angle=01&paintDescription=silver&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Passat&modelYear=2018&angle=01&paintDescription=silver&zoomType=fullscreen'],
  },
  '5N1AZ2BJ3MC123044': { // Murano 2021
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Murano&modelYear=2021&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: [
      'https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Murano&modelYear=2021&angle=01&paintDescription=black&zoomType=fullscreen',
      'https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Murano&modelYear=2021&angle=09&paintDescription=black&zoomType=fullscreen',
    ],
  },
  '5NPE34AF2KH775218': { // Sonata 2019
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Hyundai&modelFamily=Sonata&modelYear=2019&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Hyundai&modelFamily=Sonata&modelYear=2019&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  '1G1JD5SB2H4115202': { // Sonic 2017
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Chevrolet&modelFamily=Sonic&modelYear=2017&angle=01&paintDescription=white&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Chevrolet&modelFamily=Sonic&modelYear=2017&angle=01&paintDescription=white&zoomType=fullscreen'],
  },
  '3VWC57BU0MM044667': { // Jetta 2021
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Jetta&modelYear=2021&angle=01&paintDescription=silver&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Jetta&modelYear=2021&angle=01&paintDescription=silver&zoomType=fullscreen'],
  },
  'JN8AT2MT2KW254745': { // Rogue 2019
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Rogue&modelYear=2019&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Nissan&modelFamily=Rogue&modelYear=2019&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  'WAUB8GFF7G1059702': { // A3 2016
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Audi&modelFamily=A3&modelYear=2016&angle=01&paintDescription=white&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Audi&modelFamily=A3&modelYear=2016&angle=01&paintDescription=white&zoomType=fullscreen'],
  },
  '3FADP4EJ0GM165887': { // Fiesta 2016
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Fiesta&modelYear=2016&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Fiesta&modelYear=2016&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  '3FADP4EJ9KM106264': { // Fiesta 2019
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Fiesta&modelYear=2019&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Fiesta&modelYear=2019&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  '3FADP4EJXKM149771': { // Fiesta 2019
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Fiesta&modelYear=2019&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Fiesta&modelYear=2019&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  '1FADP3K26JL262219': { // Focus 2018
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Focus&modelYear=2018&angle=01&paintDescription=black&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Ford&modelFamily=Focus&modelYear=2018&angle=01&paintDescription=black&zoomType=fullscreen'],
  },
  'KMHD04LB3JU472768': { // Elantra 2018
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Hyundai&modelFamily=Elantra&modelYear=2018&angle=01&paintDescription=grey&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Hyundai&modelFamily=Elantra&modelYear=2018&angle=01&paintDescription=grey&zoomType=fullscreen'],
  },
  '3MZBN1W33JM158734': { // Mazda3 2018
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Mazda&modelFamily=3&modelYear=2018&angle=01&paintDescription=grey&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Mazda&modelFamily=3&modelYear=2018&angle=01&paintDescription=grey&zoomType=fullscreen'],
  },
  '3VWC57BU6KM129297': { // Jetta 2019
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Jetta&modelYear=2019&angle=01&paintDescription=grey&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Jetta&modelYear=2019&angle=01&paintDescription=grey&zoomType=fullscreen'],
  },
  '1VWSA7A37MC015474': { // Passat 2021
    thumb: 'https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Passat&modelYear=2021&angle=01&paintDescription=grey&zoomType=fullscreen',
    photos: ['https://cdn.imagin.studio/getimage?customer=img&make=Volkswagen&modelFamily=Passat&modelYear=2021&angle=01&paintDescription=grey&zoomType=fullscreen'],
  },
};

async function patchPhotos() {
  console.log('Patching vehicle photos...\n');
  let count = 0;

  for (const [vin, images] of Object.entries(PHOTO_MAP)) {
    const { error } = await supabase
      .from('vehicles')
      .update({
        thumbnail_url: images.thumb,
        photo_urls: images.photos,
      })
      .eq('vehicle_code', vin);

    if (error) {
      console.error(`  ✗ ${vin}: ${error.message}`);
    } else {
      console.log(`  ✓ ${vin}`);
      count++;
    }
  }

  console.log(`\nDone: ${count}/${Object.keys(PHOTO_MAP).length} patched.`);
  process.exit(0);
}

patchPhotos().catch(err => { console.error(err); process.exit(1); });
