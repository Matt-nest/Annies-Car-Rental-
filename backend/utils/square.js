const SQUARE_VERSION = process.env.SQUARE_VERSION || '2026-06-18';

export function getSquareConfig() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment = (process.env.SQUARE_ENVIRONMENT || 'production').toLowerCase();
  if (!accessToken) {
    throw Object.assign(new Error('SQUARE_ACCESS_TOKEN is not configured'), { status: 500 });
  }
  if (!locationId) {
    throw Object.assign(new Error('SQUARE_LOCATION_ID is not configured'), { status: 500 });
  }
  return {
    accessToken,
    locationId,
    baseUrl: environment === 'sandbox'
      ? 'https://connect.squareupsandbox.com'
      : 'https://connect.squareup.com',
  };
}

export async function squareRequest(path, { method = 'GET', body } = {}) {
  const { accessToken, baseUrl } = getSquareConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': SQUARE_VERSION,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = json.errors?.map(e => e.detail || e.code).filter(Boolean).join('; ');
    throw Object.assign(new Error(detail || json.error || `Square request failed (${res.status})`), {
      status: res.status,
      squareErrors: json.errors,
    });
  }
  return json;
}
