// Register a Google account as an admin (writes admins/{uid}).
// The person signs in once at https://<project>.web.app/admin/ first, so their account exists.
//   node tools/add-admin.mjs someone@gmail.com
//   node tools/add-admin.mjs --remove someone@gmail.com
import { api, PROJECT, FS, setDoc } from './fb.mjs';

const remove = process.argv[2] === '--remove', email = process.argv[remove ? 3 : 2];
if (!email) { console.error('사용법: node tools/add-admin.mjs [--remove] <이메일>'); process.exit(1); }
const r = await api(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:lookup`, { method: 'POST', body: { email: [email] } });
const u = (r.users || [])[0];
if (!u) { console.error(`${email} 계정이 없어요. 먼저 관리자 사이트에서 Google로 로그인해 주세요.`); process.exit(1); }
if (remove) { await api(`${FS}/admins/${u.localId}`, { method: 'DELETE' }); console.log(`✓ 관리자 해제: ${email}`); }
else { await setDoc(`admins/${u.localId}`, { email, addedAt: new Date().toISOString() }); console.log(`✓ 관리자 등록: ${email} (UID ${u.localId})`); }
