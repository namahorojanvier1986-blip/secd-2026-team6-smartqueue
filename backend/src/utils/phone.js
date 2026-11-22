/**
 * Rwandan mobile numbers: 072 / 073 (Airtel) and 078 / 079 (MTN), 10 digits locally.
 * Accepts "0781234567", "078 123 4567", "250781234567", "+250781234567".
 * Returns E.164 format (+250781234567) or null when invalid.
 */
function normalizeRwandaPhone(input) {
  if (input === undefined || input === null) return null;
  let d = String(input).replace(/[\s\-().]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('250')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (!/^7[2389]\d{7}$/.test(d)) return null;
  return `+250${d}`;
}

/** +250781234567 -> 078****567 (safe for public screens and staff lists) */
function maskPhone(phone) {
  if (!phone) return '';
  const local = `0${phone.replace(/^\+250/, '')}`;
  return `${local.slice(0, 3)}****${local.slice(-3)}`;
}

module.exports = { normalizeRwandaPhone, maskPhone };
