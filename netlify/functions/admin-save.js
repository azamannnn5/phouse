// Saves the full site content. Needs a valid admin session token.
const { env, json, sbHeaders, checkAuth } = require('./_lib');
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const e = env(), a = checkAuth(event, e); if (!a.ok) return a.res;
  let data; try { data = JSON.parse(event.body || '{}').data; } catch (x) {}
  if (!data || typeof data !== 'object' || !Array.isArray(data.products)) return json(400, { error: 'Invalid content.' });
  const r = await fetch(e.url + '/rest/v1/site_config?on_conflict=id', { method: 'POST', headers: sbHeaders(e.secret, { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }), body: JSON.stringify([{ id: 1, data, updated_at: new Date().toISOString() }]) });
  if (!r.ok) return json(502, { error: 'Save failed: ' + (await r.text()).slice(0, 200) });
  return json(200, { ok: true });
};
