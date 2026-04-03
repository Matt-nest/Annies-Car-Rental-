const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O,0,I,1 to avoid confusion

export function generateBookingCode() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Array.from({ length: 4 }, () =>
    CHARS[Math.floor(Math.random() * CHARS.length)]
  ).join('');
  return `BK-${date}-${suffix}`;
}
