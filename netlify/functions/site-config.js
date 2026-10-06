// Public read: returns the saved site content (products, prices, promos, text).
const { env, json, sbHeaders } = require('./_lib');
exports.handler = async () => {
  const e = env(), key = e.anon || e.secret;
  if (!e.url || !key) return json(503, { error: 'Supabase is not set up.' });
  try {
    const r = await fetch(e.url + '/rest/v1/site_config?id=eq.1&select=data', { headers: sbHeaders(key) });
    if (!r.ok) return json(502, { error: 'Database read failed (' + r.status + ').' });
    const rows = await r.json();
    return json(200, { data: rows[0] ? rows[0].data : null }, { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' });
  } catch (x) { return json(502, { error: 'Database unreachable.' }); }
};
