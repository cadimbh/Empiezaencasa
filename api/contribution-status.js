const xpag = require('../lib/xpag.cjs');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return xpag.json(res, 405, { error: 'Método no permitido.' });
  try {
    if (!xpag.configured()) throw new xpag.PublicError(503, 'Las aportaciones todavía no están disponibles. Tu material sigue siendo gratuito.');
    xpag.origin(req);
    const session = xpag.session(req);
    if (req.headers['x-csrf-token'] !== session.csrf) throw new xpag.PublicError(403, 'Vuelve a abrir la página para consultar.');
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const charge = xpag.open(body?.token, 'charge');
    if (charge.session !== session.id) throw new xpag.PublicError(403, 'Esta referencia pertenece a otra sesión.');
    const data = await xpag.provider(`/consult-transaction?request_number=${encodeURIComponent(charge.reference)}`);
    xpag.json(res, 200, { state: xpag.paid(data, charge), amount: charge.amount, method: charge.method });
  } catch (error) { xpag.fail(res, error); }
};
