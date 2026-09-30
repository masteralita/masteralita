// Deploy Firestore rules and Hosting (play/ = prototype/, admin/ = admin/) through the REST APIs.
//   node tools/deploy.mjs            → rules + hosting
//   node tools/deploy.mjs rules      → firestore.rules only
//   node tools/deploy.mjs hosting    → hosting only
//   node tools/deploy.mjs build      → assemble build/hosting only (for a local check)
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { api, PROJECT, DATABASE } from './fb.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const conf = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
const what = process.argv[2] || 'all';

async function deployRules() {
  const content = fs.readFileSync(path.join(ROOT, conf.firestore.rules), 'utf8');
  const rs = await api(`https://firebaserules.googleapis.com/v1/projects/${PROJECT}/rulesets`, {
    method: 'POST', body: { source: { files: [{ name: 'firestore.rules', content }] } },
  });
  const name = `projects/${PROJECT}/releases/cloud.firestore/${DATABASE}`;
  await api(`https://firebaserules.googleapis.com/v1/${name}`, { method: 'PATCH', body: { release: { name, rulesetName: rs.name } } });
  console.log(`✓ Firestore 규칙 배포 (${DATABASE})`);
}

// build/hosting/{play,admin}
function build() {
  const out = path.join(ROOT, conf.hosting.public);
  fs.rmSync(out, { recursive: true, force: true });
  const copy = (from, to) => {
    fs.mkdirSync(path.join(out, to), { recursive: true });
    for (const f of fs.readdirSync(path.join(ROOT, from))) if (/\.(html|js|css|png|jpg|svg|webp|json)$/.test(f)) fs.copyFileSync(path.join(ROOT, from, f), path.join(out, to, f));
  };
  copy('prototype', 'play');
  // prototype/index.html has no document skeleton (claude.ai adds one when it publishes the artifact); add it here
  const game = path.join(out, 'play', 'index.html'), html = fs.readFileSync(game, 'utf8');
  if (!/^<!doctype/i.test(html)) fs.writeFileSync(game, '<!doctype html>\n<html lang="ko">\n<meta charset="utf-8">\n'
    + '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + html);
  copy('admin', 'admin');
  const files = [];
  const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : files.push(p); } };
  walk(out);
  return files.map(f => ({ url: '/' + path.relative(out, f).split(path.sep).join('/'), gz: zlib.gzipSync(fs.readFileSync(f), { level: 9 }) }));
}

async function deployHosting() {
  const files = build();
  const site = `https://firebasehosting.googleapis.com/v1beta1/sites/${PROJECT}`;
  const config = {
    redirects: (conf.hosting.redirects || []).map(r => ({ glob: r.source, location: r.destination, statusCode: r.type || 301 })),
    ...(conf.hosting.trailingSlash ? { trailingSlashBehavior: 'ADD' } : {}),
    headers: (conf.hosting.headers || []).map(h => ({ glob: h.source, headers: Object.fromEntries(h.headers.map(x => [x.key, x.value])) })),
  };
  const ver = await api(`${site}/versions`, { method: 'POST', body: { config } });
  const hashes = {};
  for (const f of files) { f.hash = crypto.createHash('sha256').update(f.gz).digest('hex'); hashes[f.url] = f.hash; }
  const pop = await api(`https://firebasehosting.googleapis.com/v1beta1/${ver.name}:populateFiles`, { method: 'POST', body: { files: hashes } });
  for (const h of pop.uploadRequiredHashes || []) {
    const f = files.find(x => x.hash === h);
    await api(`${pop.uploadUrl}/${h}`, { method: 'POST', body: f.gz, raw: true, headers: { 'content-type': 'application/octet-stream' } });
  }
  await api(`https://firebasehosting.googleapis.com/v1beta1/${ver.name}?update_mask=status`, { method: 'PATCH', body: { status: 'FINALIZED' } });
  await api(`${site}/releases?versionName=${encodeURIComponent(ver.name)}`, { method: 'POST', body: {} });
  console.log(`✓ Hosting 배포: 파일 ${files.length}개 (새로 올림 ${(pop.uploadRequiredHashes || []).length}개)`);
  console.log(`  게임    https://${PROJECT}.web.app/play/`);
  console.log(`  관리자  https://${PROJECT}.web.app/admin/`);
}

if (what === 'build') { console.log(`✓ ${conf.hosting.public}: 파일 ${build().length}개`); process.exit(0); }
if (what === 'all' || what === 'rules') await deployRules();
if (what === 'all' || what === 'hosting') await deployHosting();
