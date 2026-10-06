// Shared helpers for the site functions. No dependencies (Node 18+ fetch).
const crypto = require('crypto');

const env = () => ({
  url: String(process.env.SUPABASE_URL || '').replace(/\/+$/, ''),
  anon: process.env.SUPABASE_ANON_KEY || '',
  secret: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  pass: process.env.ADMIN_PASSWORD || ''
});

const json = (code, obj, extra) => ({ statusCode: code, headers: Object.assign({ 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, extra || {}), body: JSON.stringify(obj) });

// Legacy JWT keys also go in Authorization. New sb_ keys go in apikey only.
const sbHeaders = (key, extra) => Object.assign({ apikey: key }, key.startsWith('eyJ') ? { Authorization: 'Bearer ' + key } : {}, extra || {});

const sign = (payload, e) => crypto.createHmac('sha256', e.pass + '|' + e.secret).update(payload).digest('base64url');

function makeToken(e, hours) {
  const body = Buffer.from(JSON.stringify({ exp: Date.now() + hours * 3600 * 1000 })).toString('base64url');
  return { token: body + '.' + sign(body, e), exp: Date.now() + hours * 3600 * 1000 };
}

function checkAuth(event, e) {
  if (!e.pass || !e.url || !e.secret) return { ok: false, res: json(503, { error: 'Server is not set up. Add ADMIN_PASSWORD, SUPABASE_URL and SUPABASE_SECRET_KEY in the host environment variables, then redeploy.' }) };
  const h = event.headers.authorization || event.headers.Authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [body, sig] = t.split('.');
  if (!body || !sig) return { ok: false, res: json(401, { error: 'Signed out.' }) };
  const good = sign(body, e);
  const a = Buffer.from(sig), b = Buffer.from(good);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, res: json(401, { error: 'Signed out.' }) };
  try { if (JSON.parse(Buffer.from(body, 'base64url').toString()).exp < Date.now()) return { ok: false, res: json(401, { error: 'Session expired. Sign in again.' }) }; } catch (x) { return { ok: false, res: json(401, { error: 'Signed out.' }) }; }
  return { ok: true };
}

module.exports = { env, json, sbHeaders, makeToken, checkAuth, crypto };
