// First-time setup: publish v1 so the game has a release to read.
// v1 = the current draft (config/balance), or the data.js defaults when there is none. Does nothing once a release exists.
//   node tools/seed.mjs
import { getDoc, setDoc } from './fb.mjs';

const meta = await getDoc('meta/current');
if (meta && meta.version) { console.log(`이미 배포된 버전이 있어요 (v${meta.version}). 관리자 사이트에서 배포하세요.`); process.exit(0); }
const draft = await getDoc('config/balance');
if (!draft) await setDoc('config/balance', { v: 1, values: {}, savedAt: new Date().toISOString(), by: 'tools/seed.mjs' });
const values = (draft && draft.values) || {}, at = new Date().toISOString();
await setDoc('releases/1', { version: 1, values, publishedAt: at, by: 'tools/seed.mjs', note: '초기 등록 (data.js 기본값)' });
await setDoc('meta/current', { version: 1, publishedAt: at });
console.log(`✓ v1 배포 (기본값과 다른 값 ${Object.keys(values).length}개)`);
