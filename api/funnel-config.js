const crypto = require('node:crypto');
const xpag = require('../lib/xpag.cjs');
module.exports = (req, res) => {
  if (req.method !== 'GET') return xpag.json(res, 405, { error: 'Método no permitido.' });
  const ready = xpag.configured();
  if (!ready) return xpag.json(res, 200, { ready: false, amounts: xpag.AMOUNTS });
  try {
    let current;
    try { current = xpag.session(req); } catch { current = { purpose: 'session', id: crypto.randomUUID(), csrf: crypto.randomBytes(24).toString('hex'), expires: Date.now() + xpag.TTL }; }
    res.setHeader('Set-Cookie', `pn_session=${xpag.seal(current)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${xpag.TTL / 1000}`);
    xpag.json(res, 200, { ready: true, csrf: current.csrf, amounts: xpag.AMOUNTS });
  } catch (error) { xpag.fail(res, error); }
};
