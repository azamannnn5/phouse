// Uploads a picture to the public "media" bucket. Needs a valid admin session token.
const { env, json, sbHeaders, checkAuth } = require('./_lib');
const FOLDERS = new Set(['site', 'products']);
const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
  const e = env(), a = checkAuth(event, e); if (!a.ok) return a.res;
  let b; try { b = JSON.parse(event.body || '{}'); } catch (x) { return json(400, { error: 'Bad request.' }); }
  if (!FOLDERS.has(b.folder) || !TYPES[b.contentType] || !b.contentBase64) return json(400, { error: 'Bad upload.' });
  const buf = Buffer.from(b.contentBase64, 'base64');
  if (buf.length > 4 * 1024 * 1024) return json(400, { error: 'Picture too large.' });
  const name = b.folder + '/' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7) + '.' + TYPES[b.contentType];
  const r = await fetch(e.url + '/storage/v1/object/media/' + name, { method: 'POST', headers: sbHeaders(e.secret, { 'Content-Type': b.contentType, 'x-upsert': 'true' }), body: buf });
  if (!r.ok) return json(502, { error: 'Upload failed: ' + (await r.text()).slice(0, 200) });
  return json(200, { url: e.url + '/storage/v1/object/public/media/' + name });
};
