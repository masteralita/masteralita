// Firebase REST helpers for the tools in this folder (Node 18+, no dependencies).
// Credentials come from FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY (see docs/FIREBASE.md).
import crypto from 'node:crypto';

export const PROJECT = process.env.FIREBASE_PROJECT_ID;
export const DATABASE = process.env.FIREBASE_DATABASE || 'glaxywardb';
const need = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'].filter(k => !process.env[k]);
if (need.length) { console.error(`환경 변수가 없어요: ${need.join(', ')} (docs/FIREBASE.md 1-8번)`); process.exit(1); }

let cached = null;
export async function token() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.tok;
  const now = Math.floor(Date.now() / 1000), b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const body = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: process.env.FIREBASE_CLIENT_EMAIL, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/firebase',
  })}`;
  const sig = crypto.sign('RSA-SHA256', Buffer.from(body), process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${body}.${sig}` }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error(`토큰 발급 실패 (${r.status}): ${j.error_description || j.error}`);
  cached = { tok: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return cached.tok;
}

// JSON API call; throws with the API's message on failure
export async function api(url, { method = 'GET', body, headers = {}, raw = false } = {}) {
  const r = await fetch(url, {
    method, headers: { authorization: `Bearer ${await token()}`,
      ...(body !== undefined && !raw ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });
  const text = await r.text(), j = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : {};
  if (!r.ok) { const e = new Error(`${method} ${url.split('?')[0]} → ${r.status} ${(j.error && j.error.message) || text.slice(0, 300)}`); e.status = r.status; throw e; }
  return j;
}

/* ---------- Firestore (named database) ---------- */
export const FS = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/${DATABASE}/documents`;
export function toFs(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFs) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, toFs(x)])) } };
}
export function fromFs(f) {
  if ('mapValue' in f) return Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, fromFs(x)]));
  if ('arrayValue' in f) return (f.arrayValue.values || []).map(fromFs);
  if ('integerValue' in f) return Number(f.integerValue);
  if ('doubleValue' in f) return f.doubleValue;
  if ('nullValue' in f) return null;
  return Object.values(f)[0];
}
export const getDoc = async path => { try { return fromFs({ mapValue: await api(`${FS}/${path}`) }); } catch (e) { if (e.status === 404) return null; throw e; } };
export const setDoc = (path, data) => api(`${FS}/${path}`, { method: 'PATCH', body: toFs(data).mapValue });
