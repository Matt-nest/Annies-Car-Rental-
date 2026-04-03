import 'dotenv/config';
import { supabase } from './supabase.js';
import { enrichVehicle } from '../services/autoDevService.js';

// ═══════════════════════════════════════════════════════════════
// Annie's REAL fleet — source-of-truth data
// ═══════════════════════════════════════════════════════════════
const FLEET = [
  { vin: '1N4BL4DV7PN338432', license_plate: '25FBJB',   trim_override: '2.5 SV',         daily_rate: 227, weekly_rate: 1260 },
  { vin: '3N1AB8DV3LY242328', license_plate: 'DSS67886', trim_override: 'SR',              daily_rate: 212, weekly_rate: 1180 },
  { vin: '1N4BL4CV2MN401644', license_plate: '92FBJB',   trim_override: '2.5 SR',         daily_rate: 223, weekly_rate: 1240 },
  { vin: '3N1AB8DV6LY290213', license_plate: '31EYAH',   trim_override: 'SR',              daily_rate: 212, weekly_rate: 1180 },
  { vin: '3VWC57BU8KM236254', license_plate: 'DY21BE',   trim_override: null,              daily_rate: 180, weekly_rate: 980  },
  { vin: '1N4BL4DVXRN318274', license_plate: 'DVY1963',  trim_override: '2.5 SV',         daily_rate: 254, weekly_rate: 1430 },
  { vin: '19XFC2F55GE085810', license_plate: '82ELLR',   trim_override: 'LX',              daily_rate: 263, weekly_rate: 1480 },
  { vin: '1VWAA7A34JC051095', license_plate: '20EURQ',   trim_override: '2.0T S',         daily_rate: 180, weekly_rate: 980  },
  { vin: '1FMJK1KT1JEA47064', license_plate: '78ACHG',  trim_override: 'Limited',         daily_rate: 528, weekly_rate: 2990 },
  { vin: '1N4BL4DV4SN333164', license_plate: 'DZN8469',  trim_override: 'SV',              daily_rate: 300, weekly_rate: 1680 },
  { vin: '1VWAA7A30JC008356', license_plate: 'DSS7055',  trim_override: 'R-Line',          daily_rate: 180, weekly_rate: 980  },
  { vin: '5N1AZ2BJ3MC123044', license_plate: 'DZW2488',  trim_override: 'SV',              daily_rate: 254, weekly_rate: 1430 },
  { vin: '5NPE34AF2KH775218', license_plate: 'BS69ML',   trim_override: 'SEL',             daily_rate: 170, weekly_rate: 940  },
  { vin: '1G1JD5SB2H4115202', license_plate: 'RGJJ38',   trim_override: 'LT',              daily_rate: 150, weekly_rate: 820  },
  { vin: '3VWC57BU0MM044667', license_plate: 'DSX7344',  trim_override: 'R-Line',          daily_rate: 276, weekly_rate: 1540 },
  { vin: 'JN8AT2MT2KW254745', license_plate: '92FBJB',   trim_override: 'SV',              daily_rate: 200, weekly_rate: 1120 },
  { vin: 'WAUB8GFF7G1059702', license_plate: 'BX70JA',   trim_override: '2.0T Premium',   daily_rate: 180, weekly_rate: 980  },
  { vin: '3FADP4EJ0GM165887', license_plate: 'DVF2035',  trim_override: 'SE',              daily_rate: 140, weekly_rate: 770  },
  { vin: '3FADP4EJ9KM106264', license_plate: '80BYBH',   trim_override: 'SE',              daily_rate: 170, weekly_rate: 940  },
  { vin: '3FADP4EJXKM149771', license_plate: 'CIPC91',   trim_override: 'SE',              daily_rate: 170, weekly_rate: 940  },
  { vin: '1FADP3K26JL262219', license_plate: '1234566',  trim_override: 'SE',              daily_rate: 170, weekly_rate: 940  },
  { vin: 'KMHD04LB3JU472768', license_plate: '85ELLR',   trim_override: 'Sport',           daily_rate: 170, weekly_rate: 940  },
  { vin: '3MZBN1W33JM158734', license_plate: 'BX23LH',   trim_override: 'Grand Touring',  daily_rate: 170, weekly_rate: 940  },
  { vin: '3VWC57BU6KM129297', license_plate: 'DVT8863',  trim_override: null,              daily_rate: 180, weekly_rate: 980  },
  { vin: '1VWSA7A37MC015474', license_plate: 'DSX8703',  trim_override: '2.0T SE',        daily_rate: 290, weekly_rate: 1610 },
];

// Map body type from auto.dev to our DB category
function mapCategory(body, make) {
  if (!body) {
    // Fallback by make
    if (['Ford Expedition'].some(v => make?.includes('Ford'))) return 'suv';
    return 'sedan';
  }
  const b = body.toLowerCase();
  if (b.includes('suv') || b.includes('crossover') || b.includes('utility')) return 'suv';
  if (b.includes('truck') || b.includes('pickup')) return 'truck';
  if (b.includes('van') || b.includes('minivan')) return 'van';
  if (b.includes('coupe')) return 'luxury';
  return 'sedan';
}

// Use VIN as the vehicle_code — guaranteed unique and fits in VARCHAR(20)
function makeVehicleCode(vin) {
  return vin.toUpperCase();
}

// Default features by category
const DEFAULT_FEATURES = {
  suv: ['Bluetooth', 'Backup Camera', 'Keyless Entry', 'Apple CarPlay', 'Cruise Control'],
  sedan: ['Bluetooth', 'Backup Camera', 'Keyless Entry', 'USB Charging', 'Cruise Control'],
  luxury: ['Leather Seats', 'Premium Audio', 'Bluetooth', 'Backup Camera', 'Dual Climate Control', 'Keyless Entry'],
  truck: ['Bluetooth', 'Backup Camera', 'Towing Package', 'USB Charging'],
  van: ['Bluetooth', 'Backup Camera', 'Third-Row Seating'],
};

// Descriptions by model
const DESCRIPTIONS = {
  'Altima': 'Modern, reliable, and feature-packed. The Altima delivers a smooth, confident ride perfect for business or personal travel.',
  'Sentra': 'Compact, stylish, and packed with value. Great fuel economy meets everyday practicality.',
  'Murano': 'A premium crossover with a focus on comfort and style. Upscale interior with a confident presence.',
  'Rogue': 'Versatile and adventurous. The Rogue handles well in any environment with great fuel economy and space.',
  'Civic': 'A legend for a reason. Reliable, efficient, and fun to drive.',
  'Passat': 'Spacious, refined, and perfect for longer drives. German engineering in a midsize package.',
  'Jetta': 'German engineering in an efficient package with excellent fuel economy.',
  'Expedition': 'Maximum space and capability. Seats up to 8 comfortably — perfect for large groups and families.',
  'A3': 'Compact luxury at its finest. Refined interior, agile handling, and unmistakable German quality.',
  'Sonata': 'Comfortable and feature-rich with a smooth, quiet ride.',
  'Sonic': 'Compact and agile with easy parking and great gas mileage.',
  'Elantra': 'Practical, reliable, and fuel-efficient daily driver.',
  'Mazda3': 'Driving dynamics meet elegant design. A joy to drive on any road.',
  'Fiesta': 'Nimble, efficient, and easy to park. Great for city driving.',
  'Focus': 'A well-rounded compact that balances features, fun, and fuel efficiency.',
  'CLA': 'Sleek, refined, and unmistakably Mercedes-Benz.',
};

async function seed() {
  console.log('══════════════════════════════════════════════');
  console.log(`  Seeding ${FLEET.length} real vehicles with auto.dev enrichment`);
  console.log('══════════════════════════════════════════════\n');

  let successCount = 0;
  let failCount = 0;

  for (const vehicle of FLEET) {
    const vin = vehicle.vin.toUpperCase();
    console.log(`  → ${vin} (plate: ${vehicle.license_plate})`);

    // Enrich via auto.dev
    let specs = null;
    let photos = [];
    try {
      const enriched = await enrichVehicle(vin);
      if (enriched) {
        specs = enriched;
        photos = enriched.photos || [];
        console.log(`    ✓ auto.dev: ${specs.year} ${specs.make} ${specs.model} ${specs.trim || ''} — ${photos.length} photos`);
      } else {
        console.warn(`    ⚠ auto.dev returned null for VIN decode`);
      }
    } catch (err) {
      console.warn(`    ⚠ auto.dev error: ${err.message}`);
    }

    // Build vehicle record
    const make = specs?.make || 'Unknown';
    const model = specs?.model || 'Unknown';
    const year = specs?.year || 2020;
    const trim = vehicle.trim_override || specs?.trim || null;
    const body = specs?.body || null;
    const category = mapCategory(body, make);
    const vehicle_code = makeVehicleCode(vin);

    // Find a matching description
    const descKey = Object.keys(DESCRIPTIONS).find(k => model.includes(k));
    const description = descKey ? DESCRIPTIONS[descKey] : `${year} ${make} ${model} — clean, reliable, and ready to rent.`;

    const record = {
      vehicle_code,
      vin,
      make,
      model,
      year,
      trim,
      category,
      license_plate: vehicle.license_plate.toUpperCase(),
      daily_rate: vehicle.daily_rate,
      weekly_rate: vehicle.weekly_rate,
      deposit_amount: 0,
      seats: body?.toLowerCase().includes('suv') || model.includes('Expedition') ? (model.includes('Expedition') ? 8 : 5) : 5,
      fuel_type: 'gasoline',
      transmission: (() => {
        const t = (specs?.transmission || 'automatic').toLowerCase();
        if (t.includes('manual') || t.includes('clutch')) return 'manual';
        return 'automatic';
      })(),
      mileage_limit_per_day: 150,
      overage_rate_per_mile: 0.25,
      thumbnail_url: photos[0] || null,
      photo_urls: photos.length > 0 ? photos : [],
      features: DEFAULT_FEATURES[category] || DEFAULT_FEATURES.sedan,
      notes: description,
      status: 'available',
    };

    // Upsert by VIN
    const { data, error } = await supabase
      .from('vehicles')
      .upsert(record, { onConflict: 'vehicle_code', ignoreDuplicates: false })
      .select('id, vehicle_code')
      .single();

    if (error) {
      console.error(`    ✗ DB error: ${error.message}`);
      failCount++;
    } else {
      console.log(`    ✓ Saved: ${vehicle_code} → ${data.id}`);
      successCount++;
    }

    // Small delay to respect API rate limits
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n══════════════════════════════════════════════`);
  console.log(`  Done: ${successCount} succeeded, ${failCount} failed`);
  console.log('══════════════════════════════════════════════\n');
  process.exit(failCount > 0 ? 1 : 0);
}

seed().catch(err => { console.error(err); process.exit(1); });
