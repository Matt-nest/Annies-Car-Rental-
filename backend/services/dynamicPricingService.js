const SETTINGS_KEY = 'weekend_dynamic_pricing';

export const DEFAULT_WEEKEND_DYNAMIC_PRICING = {
  enabled: true,
  daysOfWeek: [5, 6, 0],
  defaultWeekendIncrease: 20,
  modelRates: [
    { id: 'nissan-altima', label: 'Altima', make: 'Nissan', model: 'Altima', weekendRate: 115 },
    { id: 'volkswagen-passat', label: 'Passat', make: 'Volkswagen', model: 'Passat', weekendRate: 115 },
    { id: 'volkswagen-jetta', label: 'Jetta', make: 'Volkswagen', model: 'Jetta', weekendRate: 105 },
    { id: 'nissan-sentra', label: 'Sentra', make: 'Nissan', model: 'Sentra', weekendRate: 105 },
  ],
};

function cleanNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function cleanModelRate(rate, index) {
  const make = String(rate?.make || '').trim();
  const model = String(rate?.model || '').trim();
  const label = String(rate?.label || model || make || `Rule ${index + 1}`).trim();
  const id = String(rate?.id || `${make}-${model}-${index}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return {
    id: id || `rule-${index + 1}`,
    label,
    make,
    model,
    weekendRate: Math.max(0, cleanNumber(rate?.weekendRate, 0)),
  };
}

export function normalizeWeekendDynamicPricing(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const defaults = DEFAULT_WEEKEND_DYNAMIC_PRICING;
  const daysOfWeek = Array.isArray(source.daysOfWeek) ? source.daysOfWeek : defaults.daysOfWeek;
  const modelRates = Array.isArray(source.modelRates) ? source.modelRates : defaults.modelRates;

  return {
    enabled: source.enabled !== false,
    daysOfWeek: [...new Set(daysOfWeek.map(Number).filter(day => Number.isInteger(day) && day >= 0 && day <= 6))],
    defaultWeekendIncrease: Math.max(0, cleanNumber(source.defaultWeekendIncrease, defaults.defaultWeekendIncrease)),
    modelRates: modelRates.map(cleanModelRate),
    updatedAt: source.updatedAt || null,
  };
}

function isMissingSettingsTable(error) {
  return error?.code === '42P01' || /relation .*settings.* does not exist/i.test(error?.message || '');
}

export async function loadWeekendDynamicPricing(supabaseClient) {
  const { data, error } = await supabaseClient
    .from('settings')
    .select('value')
    .eq('key', SETTINGS_KEY)
    .maybeSingle();

  if (error) {
    if (isMissingSettingsTable(error)) return { settings: normalizeWeekendDynamicPricing(), persistent: false };
    throw error;
  }

  return {
    settings: normalizeWeekendDynamicPricing(data?.value || DEFAULT_WEEKEND_DYNAMIC_PRICING),
    persistent: true,
  };
}

export async function saveWeekendDynamicPricing(supabaseClient, value, actorId = null) {
  const now = new Date().toISOString();
  const settings = normalizeWeekendDynamicPricing({ ...value, updatedAt: now });
  const { error } = await supabaseClient.from('settings').upsert({
    key: SETTINGS_KEY,
    value: settings,
    updated_by: actorId,
    updated_at: now,
  }, { onConflict: 'key' });
  if (error) throw error;
  return settings;
}

export function getWeekendRateForVehicle(vehicle, settings) {
  const config = normalizeWeekendDynamicPricing(settings);
  if (!config.enabled) return null;

  const make = String(vehicle?.make || '').trim().toLowerCase();
  const model = String(vehicle?.model || '').trim().toLowerCase();
  const exact = config.modelRates.find(rate => {
    const rateMake = String(rate.make || '').trim().toLowerCase();
    const rateModel = String(rate.model || '').trim().toLowerCase();
    return (!rateMake || rateMake === make) && rateModel && rateModel === model;
  });

  if (exact) {
    return { rate: cleanNumber(exact.weekendRate, 0), label: exact.label || exact.model };
  }

  const base = cleanNumber(vehicle?.daily_rate, cleanNumber(vehicle?.dailyRate, 0));
  return {
    rate: Math.max(0, base + config.defaultWeekendIncrease),
    label: `Weekend +$${config.defaultWeekendIncrease}`,
  };
}

export function isDynamicPricingDate(date, settings) {
  const config = normalizeWeekendDynamicPricing(settings);
  if (!config.enabled) return false;
  const day = new Date(`${String(date).split('T')[0]}T12:00:00Z`).getUTCDay();
  return config.daysOfWeek.includes(day);
}

export function countDynamicPricingDays(pickupDate, returnDate, settings) {
  const config = normalizeWeekendDynamicPricing(settings);
  if (!config.enabled || !config.daysOfWeek.length) return 0;

  const start = new Date(`${String(pickupDate).split('T')[0]}T12:00:00Z`);
  const end = new Date(`${String(returnDate).split('T')[0]}T12:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  let count = 0;
  for (const cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (config.daysOfWeek.includes(cursor.getUTCDay())) count += 1;
  }
  return count;
}

export function buildVehicleDynamicPricing(vehicle, settings) {
  const config = normalizeWeekendDynamicPricing(settings);
  const weekendRate = getWeekendRateForVehicle(vehicle, config);
  return {
    enabled: config.enabled,
    daysOfWeek: config.daysOfWeek,
    weekendRate: weekendRate?.rate ?? null,
    weekendLabel: weekendRate?.label || null,
    defaultWeekendIncrease: config.defaultWeekendIncrease,
  };
}
