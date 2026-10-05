const crypto = require('node:crypto');
const AMOUNTS = [100, 200, 300];
const METHODS = ['SPEI', 'OXXO'];
const API = 'https://api.xpag.global';
const TTL = 13 * 24 * 60 * 60 * 1000;
const attempts = new Map();
class PublicError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function configured() {
  return Boolean(process.env.XPAG_CLIENT_ID && !process.env.XPAG_CLIENT_ID.startsWith('xpagsandbox_') && process.env.XPAG_CLIENT_SECRET &&
    process.env.FUNNEL_SECRET?.length >= 32 && /^https:\/\/[^/]+\/?$/.test(process.env.PUBLIC_SITE_URL || ''));
}
function key() {
  if (!configured()) throw new PublicError(503, 'Las aportaciones todavía no están disponibles. Tu material sigue siendo gratuito.');
  return crypto.createHash('sha256').update(process.env.FUNNEL_SECRET).digest();
}
function seal(data) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data)), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}
function open(token, purpose) {
  try {
    if (typeof token !== 'string' || token.length > 4000) throw new Error();
    const bytes = Buffer.from(token, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const data = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    if (data.purpose !== purpose || !Number.isFinite(data.expires) || data.expires < Date.now()) throw new Error();
    return data;
  } catch (error) {
    if (error instanceof PublicError) throw error;
    throw new PublicError(400, 'Esta consulta venció o no es válida. Conserva las instrucciones de tu pago.');
  }
}
function json(res, code, value) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(code).json(value);
}
function fail(res, error) {
  json(res, error instanceof PublicError ? error.status : 502, {
    error: error instanceof PublicError ? error.message : 'No pudimos conectar con XPag. No generes otro pago si ya tienes una referencia.'
  });
}
function origin(req) {
  const expected = new URL(process.env.PUBLIC_SITE_URL).origin;
  if (req.headers.origin !== expected) throw new PublicError(403, 'Abre esta opción desde la página del material.');
}
function session(req) {
  const value = (req.headers.cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith('pn_session='))?.slice(11);
  return open(value, 'session');
}
function limit(id) {
  const now = Date.now();
  for (const [k, v] of attempts) if (v.until < now) attempts.delete(k);
  const value = attempts.get(id) || { count: 0, until: now + 60_000 };
  value.count++;
  attempts.set(id, value);
  // A best-effort per-instance limit; also configure a Vercel Firewall rate limit before scaling traffic.
  if (value.count > 4 || attempts.size > 5000) throw new PublicError(429, 'Espera un minuto antes de intentar de nuevo.');
}
async function provider(path, options = {}) {
  let response;
  try {
    response = await fetch(API + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', 'X-Client-Id': process.env.XPAG_CLIENT_ID,
        'X-Client-Secret': process.env.XPAG_CLIENT_SECRET },
      signal: AbortSignal.timeout(15_000)
    });
    const data = await response.json();
    if (!response.ok || data.ok !== true || data.sandbox === true) throw new Error('provider');
    return data;
  } catch { throw new PublicError(502, 'XPag no respondió correctamente. Si ya tienes una referencia, úsala y consulta su estado.'); }
}
function safeImage(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
function instructions(data, amount, method) {
  const reference = data.request_number || data.transaction_id;
  if (typeof reference !== 'string' || !/^[a-zA-Z0-9_\-]{1,160}$/.test(reference) ||
      data.currency !== 'MXN' || Number(data.amount) !== amount || data.status !== 'pending') {
    throw new PublicError(502, 'No pudimos validar las instrucciones. No intentes pagar hasta tener una referencia válida.');
  }
  const result = { amount, method, reference };
  if (method === 'SPEI') {
    if (!/^\d{18}$/.test(data.clabe || '') || !data.bank_name || !data.beneficiary) throw new PublicError(502, 'XPag no devolvió los datos completos de SPEI.');
    Object.assign(result, { clabe: data.clabe, bank: String(data.bank_name).slice(0, 160), beneficiary: String(data.beneficiary).slice(0, 160) });
  } else {
    const voucher = data.payee_data?.reference;
    if (!/^\d{8,40}$/.test(voucher || '')) throw new PublicError(502, 'XPag aún no devolvió la referencia OXXO. No generes otra solicitud inmediatamente.');
    Object.assign(result, { voucher, barcode: safeImage(data.payee_data?.barcode) });
  }
  return result;
}
function paid(data, context) {
  // Only an authenticated, matching cash-in confirmation counts. Never a click, receipt, or cash-out.
  const reference = data.request_number || data.transaction_id;
  if (data.type !== 'cashin' || reference !== context.reference || Number(data.amount) !== context.amount ||
      (data.currency && data.currency !== 'MXN')) throw new PublicError(502, 'El estado recibido no corresponde a esta aportación.');
  if (data.status === 'confirmed') return 'confirmed';
  if (['expired', 'failed', 'med', 'refunded', 'cancelled'].includes(data.status)) return 'closed';
  return 'pending';
}
module.exports = { AMOUNTS, METHODS, TTL, PublicError, configured, seal, open, json, fail, origin, session, limit, provider, instructions, paid };
