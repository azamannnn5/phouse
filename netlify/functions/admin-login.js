// Checks the admin password (ADMIN_PASSWORD env var) and returns a 12 hour session token.
const { env, json, makeToken, crypto } = require('./_lib');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const e = env();
  if (!e.pass || !e.url || !e.secret) return json(503, { error: 'Server is not set up. Add ADMIN_PASSWORD, SUPABASE_URL and SUPABASE_SECRET_KEY in the host environment variables, then redeploy.' });
  let pw = ''; try { pw = String(JSON.parse(event.body || '{}').password || ''); } catch (x) {}
  const h = s => crypto.createHash('sha256').update(s).digest();
  const ok = crypto.timingSafeEqual(h(pw), h(e.pass));
  if (!ok) { await new Promise(r => setTimeout(r, 800)); return json(401, { error: 'Wrong password.' }); }
  return json(200, makeToken(e, 12));
};
