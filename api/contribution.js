const crypto = require('node:crypto');
const xpag = require('../lib/xpag.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return xpag.json(res, 405, { error: 'Método no permitido.' });
  try {
    if (!xpag.configured()) throw new xpag.PublicError(503, 'Las aportaciones todavía no están disponibles. Tu material sigue siendo gratuito.');
    xpag.origin(req);
    const session = xpag.session(req);
    if (req.headers['x-csrf-token'] !== session.csrf) throw new xpag.PublicError(403, 'Vuelve a abrir la página para continuar.');
    if (Number(req.headers['content-length'] || 0) > 1024) throw new xpag.PublicError(400, 'Solicitud no válida.');
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (!body || !xpag.AMOUNTS.includes(body.amount) || !xpag.METHODS.includes(body.method)) throw new xpag.PublicError(400, 'Elige 100, 200 o 300 MXN y SPEI u OXXO.');
    xpag.limit(session.id);
    const externalId = `PN_${crypto.randomUUID()}`;
    const payload = { currency: 'MXN', amount: body.amount, external_id: externalId,
      description: 'Aportación voluntaria — Primer Negocio' };
    if (body.method === 'OXXO') Object.assign(payload, { method: 'OXXO', generateCheckout: false });
    const data = await xpag.provider('/cashin', { method: 'POST', body: JSON.stringify(payload) });
    const instructions = xpag.instructions(data, body.amount, body.method);
    const expires = Date.now() + (body.method === 'SPEI' ? 24 * 60 * 60 * 1000 : 12 * 24 * 60 * 60 * 1000);
    const token = xpag.seal({ purpose: 'charge', session: session.id, reference: instructions.reference,
      amount: body.amount, method: body.method, expires: Date.now() + xpag.TTL });
    xpag.json(res, 200, { ...instructions, token, expires, state: 'pending' });
  } catch (error) { xpag.fail(res, error); }
};
