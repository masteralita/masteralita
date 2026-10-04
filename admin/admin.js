/* ==========================================================================
   갤럭시워 관리자 사이트 (https://<project>.web.app/admin/)
   Edits the balance registry from play/balance.js. Google sign-in; only UIDs in
   admins/{uid} can write (firestore.rules).
     config/balance      draft being edited   { values, savedAt, by }
     releases/{version}  what the game reads  { version, values, publishedAt, by, note }
     meta/current        current version      { version, publishedAt }
   Loaded as a module after data.js, firebase-config.js and balance.js.
   ========================================================================== */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js';
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';
import { getFirestore, doc, getDoc, getDocs, setDoc, updateDoc, onSnapshot, collection, query, where, orderBy, limit, runTransaction } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';
import { makeOps } from './ops.js';
import { makeStats } from './stats.js';
import { makeLegal } from './legal.js';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app, FIREBASE_DB);

const ADM = {
  phase: 'loading', // loading | signin | denied | ready
  user: null, area: 'balance', sec: BAL_SECTIONS[0].id, // area: balance | assets | ops | players | stats | legal
  rs: { kind: 'all', cat: 'all', q: '' }, assetData: {},  // 이미지·글 tab: filters, and loaded image data by asset id
  draft: {}, saved: {}, savedAt: null, savedBy: null, // saved = config/balance
  content: {}, savedContent: {}, open: null,          // added items (balance.js applyContent), open = card being edited
  meta: null, releases: [], unsubs: [], busy: false,
  players: null, playerQ: '', player: null, lb: {},     // 플레이어 tab: list, search text, opened uid, leaderboard entries by uid
};
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const root = document.getElementById('admin');
const fmtTime = t => t ? new Date(t).toLocaleString('ko-KR') : '';
// 운영 · 통계 · 약관 areas live in their own modules
const ctx = { db, ADM, esc, fmtTime, toast: (...a) => toast(...a), confirmBox: (...a) => confirmBox(...a), render: () => render() };
const OPS = makeOps(ctx), STATS = makeStats(ctx), LEGAL = makeLegal(ctx);
const liveRel = () => ADM.releases.find(r => ADM.meta && r.version === ADM.meta.version) || { values: {}, content: {} };
const live = () => liveRel().values || {};

const curVal = p => (p in ADM.draft ? ADM.draft[p] : BAL_DEFAULTS[p]);
const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(p => !sameVal(a[p], b[p]));
const CT_KINDS = ['skins', 'pskins', 'oskins'];
const ctDiff = (a = {}, b = {}) => [...CT_KINDS, 'images'].reduce((n, k) => n + diff(a[k] || {}, b[k] || {}).length, 0); // images: 이미지·글 tab
const unsavedCount = () => diff(ADM.draft, ADM.saved).length + ctDiff(ADM.content, ADM.savedContent);
const pendingCount = () => diff(ADM.saved, live()).length + ctDiff(ADM.savedContent, liveRel().content);
const isDirty = () => unsavedCount() > 0;

/* ---------- Value formatting ---------- */
function showNum(kind, v) { return kind === 'pct' ? +(v * 100).toFixed(4) : v; }
function parseCell(kind, raw) {
  if (kind === 'text') return String(raw ?? '');
  if (kind === 'gskill') { const t = String(raw ?? '').trim(); return GSKILL[t] ? t : undefined; }
  const n = Number(String(raw).replace('%', '').trim());
  if (!Number.isFinite(n)) return undefined;
  if (kind === 'pct') return +(n / 100).toFixed(6);
  if (kind === 'int') return Math.round(n);
  if (kind === 'orbits') return n >= 2 ? 2 : 1;
  return n;
}
const chainText = v => [v.type, ...Object.entries(v.p || {}).map(([k, x]) => `${k}=${x}`)].join(' ');
function parseChain(txt) {
  const [type, ...kv] = String(txt || '').trim().split(/\s+/);
  if (!FX[type]) return undefined;
  const p = {};
  for (const s of kv) { const [k, x] = s.split('='); if (!k) continue; p[k] = x === 'true' ? true : x === 'false' ? false : Number(x); }
  return { type, p: Object.keys(p).length ? p : { ...FX_DEFAULTS[type] } }; // only the params written in the cell
}
function setDraft(path, v) {
  if (v === undefined) return false;
  if (sameVal(v, BAL_DEFAULTS[path])) delete ADM.draft[path]; else ADM.draft[path] = v;
  return true;
}

/* ---------- Render ---------- */
function cellHtml(path, kind) {
  const v = curVal(path), mod = path in ADM.draft, dirty = !sameVal(ADM.draft[path], ADM.saved[path]);
  const cls = `${mod ? ' mod' : ''}${dirty ? ' dirty' : ''}`;
  const title = `기본값: ${kind === 'chain' ? chainText(BAL_DEFAULTS[path]) : showNum(kind, BAL_DEFAULTS[path])}`;
  if (kind === 'chain') {
    const params = Object.entries(v.p).filter(([, x]) => typeof x !== 'boolean').map(([k, x]) =>
      `<label class="pp"><span>${k}</span><input type="number" step="any" data-path="${path}" data-param="${k}" value="${x}"></label>`).join('');
    const bools = Object.entries(v.p).filter(([, x]) => typeof x === 'boolean').map(([k, x]) =>
      `<label class="pp"><span>${k}</span><input type="checkbox" data-path="${path}" data-param="${k}"${x ? ' checked' : ''}></label>`).join('');
    return `<td class="ce${cls}" title="${esc(title)}"><div class="chain-ed">
      <select data-path="${path}" data-part="type">${Object.keys(FX).map(t => `<option value="${t}"${t === v.type ? ' selected' : ''}>${FX_LABEL[t] || t}</option>`).join('')}</select>
      <div class="pps">${params}${bools}</div><span class="fx-desc">${FX[v.type](v.p)}</span></div></td>`;
  }
  if (kind === 'gskill') {
    const base = path.replace(/\/type$/, ''), sk = { type: v, ...Object.fromEntries(['cost', 'v', 'dur'].map(k => [k, curVal(`${base}/${k}`)])) };
    return `<td class="ce${cls}" title="${esc(title)}"><div class="chain-ed">
      <select data-path="${path}">${Object.keys(GSKILL).map(t => `<option value="${t}"${t === v ? ' selected' : ''}>[${SKILL_CATS[GSKILL[t].cat].name}] ${GSKILL[t].label}</option>`).join('')}</select>
      <span class="fx-desc">${esc(skillDesc(sk))}</span></div></td>`;
  }
  if (kind === 'orbits') return `<td class="${cls}" title="${esc(title)}"><select data-path="${path}"><option value="1"${v === 1 ? ' selected' : ''}>1</option><option value="2"${v === 2 ? ' selected' : ''}>2</option></select></td>`;
  if (kind === 'text') return `<td class="${cls}" title="${esc(title)}"><input class="txt" type="text" data-path="${path}" value="${esc(v ?? '')}"></td>`;
  return `<td class="${cls}" title="${esc(title)}"><span class="num-in"><input type="number" step="${kind === 'int' ? 1 : 'any'}" data-path="${path}" value="${showNum(kind, v)}">${kind === 'pct' ? '<i>%</i>' : ''}</span></td>`;
}
function sectionHtml(s) {
  if (s.kv) return `<table class="ad-t kv"><thead><tr><th>항목</th><th>값</th><th>기본값</th></tr></thead><tbody>
    ${s.kv.map(([p, label, kind]) => `<tr><th scope="row">${label}</th>${cellHtml(p, kind)}<td class="def">${showNum(kind, BAL_DEFAULTS[p])}${kind === 'pct' ? '%' : ''}</td></tr>`).join('')}
    </tbody></table>`;
  return `<table class="ad-t"><thead><tr><th>${s.id === 'skin' ? '스킨' : '이름'}</th>${s.cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead><tbody>
    ${s.rows.map(r => `<tr><th scope="row">${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}</th>${s.cols.map(c => cellHtml(s.path(r.id, c.key), c.kind)).join('')}</tr>`).join('')}
    </tbody></table>`;
}
function releasesHtml() {
  const cur = ADM.meta && ADM.meta.version;
  if (!ADM.releases.length) return '<p class="empty">아직 배포한 버전이 없어요. 게임은 내장 기본값을 쓰고 있어요.</p>';
  return `<table class="ad-t rel"><thead><tr><th>버전</th><th>배포 시각</th><th>배포한 사람</th><th>메모</th><th>기본값과 다른 값</th><th>추가 항목</th><th></th></tr></thead><tbody>
    ${ADM.releases.map(r => `<tr><th scope="row">v${r.version}${r.version === cur ? ' <span class="ad-chip ok">게임 적용 중</span>' : ''}</th>
      <td>${fmtTime(r.publishedAt)}</td><td>${esc(r.by || '')}</td><td class="note">${esc(r.note || '')}</td><td>${Object.keys(r.values || {}).length}개</td><td>${CT_KINDS.reduce((n, k) => n + Object.keys((r.content || {})[k] || {}).length, 0)}개</td>
      <td><button class="ghost sm" type="button" data-load="${r.version}">초안으로 불러오기</button></td></tr>`).join('')}
    </tbody></table>`;
}
function statusChips() {
  const unsaved = unsavedCount(), pending = pendingCount();
  const out = [];
  out.push(unsaved ? `<span class="ad-chip gold">저장하지 않은 변경 ${unsaved}개</span>`
    : `<span class="ad-chip ok">초안 저장됨${ADM.savedAt ? ` · ${fmtTime(ADM.savedAt)}${ADM.savedBy ? ` · ${esc(ADM.savedBy)}` : ''}` : ''}</span>`);
  out.push(pending ? `<span class="ad-chip warn">배포 대기 ${pending}개 · [배포]를 눌러야 게임에 나가요</span>`
    : `<span class="ad-chip">게임 적용 중: ${ADM.meta && ADM.meta.version ? `v${ADM.meta.version}` : '내장 기본값'}</span>`);
  return out.join('');
}
const AREAS = [['balance', '밸런스'], ['assets', '이미지·글'], ['ops', '운영'], ['players', '플레이어'], ['stats', '통계'], ['legal', '약관·정책']];
function render() {
  if (ADM.phase !== 'ready') { root.innerHTML = gateHtml(); return; }
  const body = root.querySelector('.ad-body'), scroll = body ? body.scrollTop : 0, a = ADM.area;
  let tabs = '', main;
  if (a === 'balance') {
    const s = BAL_SECTIONS.find(x => x.id === ADM.sec);
    const counts = Object.fromEntries(BAL_SECTIONS.map(x => [x.id, Object.keys(ADM.draft).filter(p => BAL_FIELDS[p] && BAL_FIELDS[p].sec === x.id).length]));
    tabs = `<nav class="ad-tabs" aria-label="밸런스 분류">${BAL_SECTIONS.map(x => `<button type="button" data-sec="${x.id}" aria-current="${x.id === ADM.sec ? 'page' : 'false'}">${x.title}${counts[x.id] ? `<em>${counts[x.id]}</em>` : ''}</button>`).join('')}
      <button type="button" data-sec="content" aria-current="${ADM.sec === 'content' ? 'page' : 'false'}">추가 항목${ctCount() ? `<em>${ctCount()}</em>` : ''}</button>
      <button type="button" data-sec="releases" aria-current="${ADM.sec === 'releases' ? 'page' : 'false'}">배포 기록</button></nav>`;
    main = s ? `
      <div class="ad-desc"><h2>${s.title}</h2><p>${s.desc} · 금색 테두리 = 저장 전 변경, 점 = 기본값과 다름 · 칸에 마우스를 올리면 기본값이 보여요</p>
        <button class="ghost sm" data-ad="secdefaults" type="button"${counts[s.id] ? '' : ' disabled'}>이 탭 기본값</button></div>
      <div class="ad-scroll">${sectionHtml(s)}</div>` : ADM.sec === 'content' ? contentHtml() : `
      <div class="ad-desc"><h2>배포 기록</h2><p>[배포]를 누를 때마다 버전이 하나씩 쌓여요. 예전 버전을 초안으로 불러와 다시 배포하면 되돌릴 수 있어요.</p></div>
      <div class="ad-scroll">${releasesHtml()}</div>`;
  } else if (a === 'assets') { tabs = rsTabsHtml(); main = rsHtml(); }
  else if (a === 'ops') { tabs = OPS.tabsHtml(); main = OPS.html(); }
  else if (a === 'players') main = playersHtml();
  else if (a === 'stats') main = STATS.html();
  else main = LEGAL.html();
  const pending = pendingCount() || isDirty() || !(ADM.meta && ADM.meta.version); // the first release can be the defaults
  root.innerHTML = `
    <header class="ad-top">
      <div class="ad-title"><span class="eyebrow">GALAXY WAR · ADMIN</span><h1>갤럭시워 관리자</h1></div>
      ${a === 'balance' || a === 'assets' ? `<div class="ad-actions">
        <button class="ghost sm" data-ad="export" type="button">엑셀 내보내기</button>
        <label class="ghost sm file">엑셀 가져오기<input type="file" id="adImport" accept=".xlsx"></label>
        <button class="ghost sm" data-ad="defaults" type="button">전체 기본값</button>
        <button class="ghost sm" data-ad="discard" type="button"${isDirty() ? '' : ' disabled'}>변경 취소</button>
        <button class="ghost sm" data-ad="save" type="button"${isDirty() && !ADM.busy ? '' : ' disabled'}>초안 저장</button>
        <button class="cta sm" data-ad="publish" type="button"${pending && !ADM.busy ? '' : ' disabled'}>배포</button>
      </div>` : '<div></div>'}
      <div class="ad-status">${a === 'balance' || a === 'assets' ? statusChips() : ''}<span class="who">${esc(ADM.user.email || ADM.user.uid)} · <a href="../play/" target="_blank" rel="noopener">게임 열기</a> · <button class="link" data-ad="signout" type="button">로그아웃</button></span></div>
    </header>
    <nav class="ad-areas" aria-label="관리 영역">${AREAS.map(([id, label]) => `<button type="button" data-area="${id}" aria-current="${id === a ? 'page' : 'false'}">${label}${(id === 'balance' || id === 'assets') && isDirty() ? '<em>•</em>' : ''}</button>`).join('')}</nav>
    ${tabs}
    <div class="ad-body">${main}</div>`;
  root.querySelector('.ad-body').scrollTop = scroll;
}
function gateHtml() {
  const card = inner => `<div class="gate"><span class="eyebrow">GALAXY WAR · ADMIN</span><h1>갤럭시워 관리자</h1>${inner}</div>`;
  if (ADM.phase === 'loading') return card('<p>불러오는 중…</p>');
  if (ADM.phase === 'signin') return card('<p>관리자 Google 계정으로 로그인해 주세요.</p><button class="cta" data-ad="signin" type="button">Google로 로그인</button>');
  return card(`<p>이 계정은 아직 관리자로 등록되지 않았어요.</p>
    <dl><dt>이메일</dt><dd>${esc(ADM.user.email || '-')}</dd><dt>UID</dt><dd><code>${esc(ADM.user.uid)}</code></dd></dl>
    <p class="dim">Claude에게 "이 이메일을 관리자로 등록해줘"라고 말하면 <code>tools/add-admin.mjs</code>로 등록해요. 등록 후 새로고침하세요.</p>
    <button class="ghost sm" data-ad="signout" type="button">다른 계정으로 로그인</button>`);
}

/* ---------- 추가 항목: skins / planet skins / orbit skins created here (balance.js applyContent) ---------- */
const CT_META = {
  skins:  { title: '스킨', add: '스킨 추가', desc: '별자리에 새 스킨을 더해요. 성운 = 보물 상자에서 나옴, 스페셜 = Star Piece로 구매.' },
  pskins: { title: '행성 스킨', add: '행성 스킨 추가', desc: '모든 행성에 쓸 수 있는 색(틴트)과 보너스예요.' },
  oskins: { title: '궤도 스킨', add: '궤도 스킨 추가', desc: '궤도 모양은 기존 4가지 중에서 골라요.' },
};
const STAT_LABEL = { atk: '공격력', rate: '공격속도', crit: '치명타율', critDmg: '치명타 피해', hp: '최대 HP', heal: '회복량', poison: '독 피해',
  tArmor: '아군 물리 방어', tMArmor: '아군 마법 방어', tEvade: '아군 회피율', pHp: '행성 HP' };
const BONUS = { pskins: [['hp', '행성 HP +'], ['atk', '전체 공격력 +'], ['dmgRed', '받는 피해 -']], oskins: [['atk', '공격력 +'], ['rate', '공속 +'], ['hp', 'HP +']] };
const ctCount = () => CT_KINDS.reduce((n, k) => n + Object.keys(ADM.content[k] || {}).length, 0);
const ctInvalid = () => CT_KINDS.reduce((n, k) => n + Object.values(ADM.content[k] || {}).filter(d => contentProblems(k, d).length).length, 0);
const hexToRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)).join(',');
const rgbToHex = c => '#' + String(c || '255,255,255').split(',').map(x => (+x).toString(16).padStart(2, '0')).join('');
const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(label)}</option>`;

function newItem(k) {
  const id = `${{ skins: 's', pskins: 'p', oskins: 'o' }[k]}_${Date.now().toString(36)}`;
  if (k === 'skins') return { id, con: CON.sgr ? 'sgr' : ALL_CONS[0].id, tier: 'nebula', name: '', sig: '', stats: [{ key: 'atk', name: '' }, { key: 'rate', name: '' }],
    chain: ['splash', 'nth', 'amp'].map(type => ({ name: '', type, p: { ...FX_DEFAULTS[type] } })) };
  if (k === 'pskins') return { id, name: '', price: 800, bonus: {}, flavor: '', tint: '255,205,80' };
  return { id, name: '', price: 400, bonus: {}, flavor: '', look: 'dust' };
}
const field = (label, inner, wide) => `<label class="ct-f${wide ? ' wide' : ''}"><span>${label}</span>${inner}</label>`;
const inp = (k, d, path, t, v, extra = '') => `<input data-ct="${k}|${d.id}|${path}" data-t="${t}" ${t === 'text' ? 'type="text"' : t === 'color' ? 'type="color"' : 'type="number" step="any"'} value="${esc(v ?? '')}"${extra}>`;
const sel = (k, d, path, opts) => `<select data-ct="${k}|${d.id}|${path}" data-t="sel">${opts}</select>`;

function skinForm(d) {
  const k = 'skins', con = CON[d.con] || ALL_CONS[0];
  const chain = d.chain.map((ch, i) => {
    const params = Object.entries(ch.p || {}).map(([pk, x]) => typeof x === 'boolean'
      ? `<label class="pp"><span>${pk}</span><input type="checkbox" data-ct="${k}|${d.id}|chain/${i}/p/${pk}" data-t="bool"${x ? ' checked' : ''}></label>`
      : `<label class="pp"><span>${pk}</span>${inp(k, d, `chain/${i}/p/${pk}`, 'num', x)}</label>`).join('');
    return `<div class="ct-row"><b class="ct-n">${ROMAN[i + 1]}</b>
      ${field('이름', inp(k, d, `chain/${i}/name`, 'text', ch.name, ' placeholder="각성 이름"'))}
      ${field('효과', sel(k, d, `chain/${i}/type`, Object.keys(FX).map(t => opt(t, FX_LABEL[t] || t, ch.type)).join('')))}
      <div class="pps">${params}</div><span class="fx-desc">${FX[ch.type] ? FX[ch.type](ch.p || {}) : ''}</span></div>`;
  }).join('');
  const stats = d.stats.map((st, i) => `<div class="ct-row"><b class="ct-n">${i + 1}</b>
      ${field('능력치', sel(k, d, `stats/${i}/key`, Object.keys(STAT).map(t => opt(t, STAT_LABEL[t] || t, st.key)).join('')))}
      ${field('카드 이름', inp(k, d, `stats/${i}/name`, 'text', st.name, ' placeholder="카드에 보일 이름"'))}
      <span class="fx-desc">${STAT[st.key] ? STAT[st.key].txt(STAT[st.key].v) : ''}</span></div>`).join('');
  return `<div class="ct-grid">
      ${field('별자리', sel(k, d, 'con', ALL_CONS.map(c => opt(c.id, `${c.name}자리`, d.con)).join('')))}
      ${field('등급', sel(k, d, 'tier', opt('nebula', '성운 (보물 상자)', d.tier) + opt('supernova', `스페셜 (구매 ${SKIN_TIER.supernova.price} Star Piece)`, d.tier)))}
      ${field('이름', inp(k, d, 'name', 'text', d.name))}
      ${field('설명', inp(k, d, 'sig', 'text', d.sig), true)}
      ${field('공격 방식', sel(k, d, 'style', opt('', `별자리 기본 (${STYLE_LABEL[con.style]})`, d.style || '') + Object.entries(STYLE_LABEL).map(([v, l]) => opt(v, l, d.style)).join('')))}
      ${field('속성', sel(k, d, 'kind', opt('', `별자리 기본 (${KIND_LABEL[con.kind]})`, d.kind || '') + Object.entries(KIND_LABEL).map(([v, l]) => opt(v, l, d.kind)).join('')))}
      ${['atk', 'rate', 'hp'].map(m => field(`${{ atk: '공격력', rate: '공속', hp: 'HP' }[m]} ×`, inp(k, d, `mod/${m}`, 'mod', (d.mod || {})[m] ?? 1))).join('')}
    </div>
    <h4>능력치 카드 (레벨업 때 나옴)</h4>${stats}
    <h4>각성 I~III</h4>${chain}`;
}
function cosmeticForm(k, d) {
  return `<div class="ct-grid">
      ${field('이름', inp(k, d, 'name', 'text', d.name))}
      ${field('가격 (Star Piece)', inp(k, d, 'price', 'int', d.price))}
      ${k === 'pskins' ? field('색', inp(k, d, 'tint', 'color', rgbToHex(d.tint))) : field('모양', sel(k, d, 'look', Object.entries(ORBIT_LOOKS).map(([v, l]) => opt(v, l, d.look)).join('')))}
      ${BONUS[k].map(([b, l]) => field(`${l} (%)`, inp(k, d, `bonus/${b}`, 'pct', +(((d.bonus || {})[b] || 0) * 100).toFixed(4)))).join('')}
      ${field('설명', inp(k, d, 'flavor', 'text', d.flavor), true)}
    </div>`;
}
function itemCard(k, d) {
  const probs = contentProblems(k, d), open = ADM.open === `${k}|${d.id}`;
  const saved = (ADM.savedContent[k] || {})[d.id], released = ((liveRel().content || {})[k] || {})[d.id];
  const tag = !saved ? '<span class="ad-chip gold">저장 전</span>' : !sameVal(saved, d) ? '<span class="ad-chip gold">변경됨</span>'
    : !sameVal(released, d) ? '<span class="ad-chip warn">배포 대기</span>' : '<span class="ad-chip ok">게임 적용 중</span>';
  const sub = k === 'skins' ? `${(CON[d.con] || {}).name || '?'}자리 · ${(SKIN_TIER[d.tier] || {}).name || '?'}` : `${d.price ?? '?'} Star Piece`;
  return `<article class="ct-card${probs.length ? ' bad' : ''}">
    <header><button class="ct-head" type="button" data-ctopen="${k}|${d.id}" aria-expanded="${open}"><b>${esc(d.name || '(이름 없음)')}</b><small>${esc(sub)}</small></button>
      ${tag}<button class="ghost sm" type="button" data-ctdel="${k}|${d.id}">삭제</button></header>
    ${probs.length ? `<p class="ct-probs">${probs.map(esc).join(' · ')}</p>` : ''}
    ${open ? (k === 'skins' ? skinForm(d) : cosmeticForm(k, d)) : ''}
  </article>`;
}
function contentHtml() {
  return `<div class="ad-desc"><h2>추가 항목</h2><p>data.js 기본 항목 위에 새 항목을 더해요. [초안 저장] → [배포]하면 게임에 나와요. 이미지는 Storage 설정 후 붙일 수 있어요.
    기본 항목의 이름·설명은 각 탭(별자리, 스킨 이름·설명, 행성, 행성 스킨, 궤도 스킨)의 글자 칸에서 고쳐요.</p></div>
    ${CT_KINDS.map(k => { const items = Object.values(ADM.content[k] || {}); return `<section class="ct-sec">
      <div class="ct-sec-h"><h3>${CT_META[k].title} <small>${items.length}개</small></h3><button class="cta sm" type="button" data-ctadd="${k}">+ ${CT_META[k].add}</button></div>
      <p class="ct-desc">${CT_META[k].desc}</p>
      ${items.length ? items.map(d => itemCard(k, d)).join('') : '<p class="empty">아직 없어요.</p>'}
    </section>`; }).join('')}`;
}
async function contentClick(e) {
  const a = e.target.closest('[data-ctadd]'), o = e.target.closest('[data-ctopen]'), x = e.target.closest('[data-ctdel]');
  if (a) { const k = a.dataset.ctadd, d = newItem(k); ADM.content = { ...ADM.content, [k]: { ...(ADM.content[k] || {}), [d.id]: d } }; ADM.open = `${k}|${d.id}`; render(); return true; }
  if (o) { ADM.open = ADM.open === o.dataset.ctopen ? null : o.dataset.ctopen; render(); return true; }
  if (x) {
    const [k, id] = x.dataset.ctdel.split('|'), d = ADM.content[k][id];
    if (await confirmBox('항목 삭제', `"${esc(d.name || id)}"을(를) 지워요. 배포하면 게임에서도 사라지고, 이미 가진 플레이어는 기본 스킨으로 돌아가요.`, '삭제')) {
      ADM.content = clone(ADM.content); delete ADM.content[k][id]; render();
    }
    return true;
  }
  return false;
}
function contentChange(el) {
  const [k, id, path] = el.dataset.ct.split('|'), t = el.dataset.t;
  const d = clone(ADM.content[k][id]), seg = path.split('/');
  let v;
  if (t === 'text' || t === 'sel') v = el.value;
  else if (t === 'bool') v = el.checked;
  else if (t === 'color') v = hexToRgb(el.value);
  else { v = Number(el.value); if (el.value === '' || !Number.isFinite(v)) { toast('숫자를 입력해 주세요'); render(); return; } if (t === 'pct') v = +(v / 100).toFixed(6); if (t === 'int') v = Math.round(v); }
  let o = d;
  for (const s of seg.slice(0, -1)) { if (o[s] == null) o[s] = {}; o = o[s]; }
  const last = seg[seg.length - 1];
  if ((t === 'mod' && v === 1) || (t === 'pct' && v === 0) || (t === 'sel' && v === '' && (last === 'style' || last === 'kind'))) delete o[last]; // neutral → no field
  else o[last] = v;
  if (seg[0] === 'chain' && last === 'type') d.chain[+seg[1]].p = { ...(FX_DEFAULTS[v] || {}) };
  if (d.mod && !Object.keys(d.mod).length) delete d.mod;
  ADM.content = { ...ADM.content, [k]: { ...ADM.content[k], [id]: d } };
  render();
}

/* ---------- 이미지·글: every image and every text of the game in one list, filtered by kind / category / search ----------
   Texts are the balance registry's text fields (same draft → save → publish as the 밸런스 tab).
   Images: an upload is stored right away as site/{assetId} ({ kind:'asset', file, data }), and the draft maps
   file → assetId in content.images; the game swaps the art in once that is published (balance.js applyImages). */
const RS_TEXT_CAT = { con: 'con', skin: 'con', skintext: 'con', planet: 'planet', pskin: 'planet', pskill: 'skill', eskill: 'skill', orbit: 'orbit', oskin: 'orbit' };
const RS_MAX = 700 * 1024; // keeps the data URL under Firestore's 1 MiB document limit
const rsImages = () => imgCatalog({ ...SKIN, ...Object.fromEntries(Object.values(ADM.content.skins || {}).map(d => [d.id, d])) });
const rsTexts = () => Object.entries(BAL_FIELDS).filter(([, f]) => f.kind === 'text').map(([path, f]) => ({ path, cat: RS_TEXT_CAT[f.sec] || 'ui', label: f.label }));
function rsItems() {
  const { kind, cat, q } = ADM.rs, needle = q.trim().toLowerCase();
  const hit = (...xs) => !needle || xs.some(x => String(x || '').toLowerCase().includes(needle));
  const imgs = kind === 'text' ? [] : rsImages().filter(i => (cat === 'all' || i.cat === cat) && hit(i.label, i.file));
  const texts = kind === 'image' ? [] : rsTexts().filter(t => (cat === 'all' || t.cat === cat) && hit(t.label, t.path, curVal(t.path)));
  return { imgs, texts };
}
function rsTabsHtml() {
  const chip = (attr, v, label, cur) => `<button type="button" ${attr}="${v}" aria-current="${v === cur ? 'page' : 'false'}">${label}</button>`;
  const changed = Object.keys(ADM.content.images || {}).length;
  return `<nav class="ad-tabs" aria-label="종류">${chip('data-rskind', 'all', '전체', ADM.rs.kind)}${chip('data-rskind', 'image', `이미지${changed ? `<em>${changed}</em>` : ''}`, ADM.rs.kind)}${chip('data-rskind', 'text', '글', ADM.rs.kind)}
    <span class="rs-sep"></span>${chip('data-rscat', 'all', '모든 분류', ADM.rs.cat)}${Object.entries(IMG_CATS).map(([k, l]) => chip('data-rscat', k, l, ADM.rs.cat)).join('')}</nav>`;
}
function rsThumb(file) {
  const id = (ADM.content.images || {})[file];
  if (!id) return `../play/img/${file}`;
  if (ADM.assetData[id] === undefined) {
    ADM.assetData[id] = null;
    getDoc(doc(db, 'site', id)).then(d => { ADM.assetData[id] = d.exists() ? d.data().data : ''; render(); }).catch(() => { ADM.assetData[id] = ''; render(); });
  }
  return ADM.assetData[id] || '';
}
function rsImgCard(i) {
  const cur = (ADM.content.images || {})[i.file], saved = (ADM.savedContent.images || {})[i.file], live = ((liveRel().content || {}).images || {})[i.file];
  const tag = cur !== saved ? '<span class="ad-chip gold">저장 전</span>' : cur !== live ? '<span class="ad-chip warn">배포 대기</span>'
    : cur ? '<span class="ad-chip ok">교체됨</span>' : i.base ? '<span class="ad-chip">기본</span>' : '<span class="ad-chip warn">이미지 없음</span>';
  const src = rsThumb(i.file);
  return `<article class="rs-img"><span class="rs-thumb">${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : ''}</span>
    <div class="rs-meta"><b>${esc(i.label)}</b><small>${esc(i.file)} · ${IMG_CATS[i.cat]}</small>${tag}</div>
    <div class="rs-acts"><label class="ghost sm file">이미지 교체<input type="file" accept="image/png,image/webp,image/jpeg,image/gif" data-rsup="${esc(i.file)}"></label>
      ${cur ? `<button class="ghost sm" type="button" data-rsreset="${esc(i.file)}">기본으로</button>` : ''}</div></article>`;
}
function rsHtml() {
  const { imgs, texts } = rsItems();
  return `<div class="ad-desc"><h2>이미지·글</h2><p>게임에 나오는 모든 이미지와 글을 한곳에서 바꿔요. 위에서 종류와 분류를 고르고, 이름이나 파일명으로 찾아요.
      이미지는 PNG·WebP·JPG ${Math.round(RS_MAX / 1024)}KB 이하로 올리면 바로 서버에 저장되고, 글과 함께 [초안 저장] → [배포]해야 게임에 나와요. 도트 이미지는 원본과 같은 비율로 올려 주세요.</p></div>
    <form class="pl-search" data-rssearch><input type="search" name="q" id="rsQ" placeholder="이름·파일명·글 내용으로 찾기" value="${esc(ADM.rs.q)}"><span class="ct-desc">이미지 ${imgs.length}개 · 글 ${texts.length}개</span></form>
    ${imgs.length ? `<h3 class="rs-h">이미지</h3><div class="rs-grid">${imgs.map(rsImgCard).join('')}</div>` : ''}
    ${texts.length ? `<h3 class="rs-h">글</h3><div class="ad-scroll"><table class="ad-t kv rs-t"><thead><tr><th>항목</th><th>분류</th><th>글</th><th>기본값</th></tr></thead><tbody>
      ${texts.map(t => `<tr><th scope="row">${esc(t.label)}</th><td class="def">${IMG_CATS[t.cat] || ''}</td>${cellHtml(t.path, 'text')}<td class="def">${esc(BAL_DEFAULTS[t.path] ?? '')}</td></tr>`).join('')}
      </tbody></table></div>` : ''}
    ${!imgs.length && !texts.length ? '<p class="empty">찾는 항목이 없어요.</p>' : ''}`;
}
async function rsUpload(file, f) {
  if (!f) return;
  if (!/^image\/(png|webp|jpeg|gif)$/.test(f.type)) { toast('PNG·WebP·JPG·GIF 이미지만 올릴 수 있어요'); return; }
  if (f.size > RS_MAX) { toast(`${Math.round(f.size / 1024)}KB예요 · ${Math.round(RS_MAX / 1024)}KB 이하로 줄여 주세요`); return; }
  const data = await new Promise((ok, fail) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = fail; r.readAsDataURL(f); }).catch(() => null);
  if (!data) { toast('이미지를 읽지 못했어요'); return; }
  const id = `asset_${file.replace(/\W+/g, '_')}_${Date.now().toString(36)}`;
  ADM.busy = true; render();
  try {
    await setDoc(doc(db, 'site', id), { kind: 'asset', file, data, name: f.name, at: new Date().toISOString(), by: ADM.user.email || ADM.user.uid });
    ADM.assetData[id] = data;
    ADM.content = { ...ADM.content, images: { ...(ADM.content.images || {}), [file]: id } };
    toast('이미지를 올렸어요 · [초안 저장] → [배포]하면 게임에 나와요');
  } catch (err) { toast(`올리지 못했어요 (${err.code || err.message})`); }
  ADM.busy = false; render();
}
root.addEventListener('click', e => {
  if (ADM.area !== 'assets') return;
  const k = e.target.closest('[data-rskind]'), c = e.target.closest('[data-rscat]'), r = e.target.closest('[data-rsreset]');
  if (k) { ADM.rs = { ...ADM.rs, kind: k.dataset.rskind }; render(); }
  else if (c) { ADM.rs = { ...ADM.rs, cat: c.dataset.rscat }; render(); }
  else if (r) { const im = { ...(ADM.content.images || {}) }; delete im[r.dataset.rsreset]; ADM.content = { ...ADM.content, images: im }; render(); }
});
root.addEventListener('submit', e => { if (e.target.matches('[data-rssearch]')) e.preventDefault(); });
root.addEventListener('input', e => {
  if (e.target.id !== 'rsQ') return;
  ADM.rs = { ...ADM.rs, q: e.target.value }; const at = e.target.selectionStart;
  render();
  const q = document.getElementById('rsQ'); if (q) { q.focus(); q.setSelectionRange(at, at); }
});

/* ---------- 플레이어 (players/{uid}, read-only) ---------- */
async function loadPlayers() {
  const q = ADM.playerQ.trim(), col = collection(db, 'players');
  ADM.players = 'loading'; render();
  try {
    const snap = await getDocs(q ? query(col, where('name', '==', q), limit(50)) : query(col, orderBy('updatedAt', 'desc'), limit(50)));
    ADM.players = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch (err) { ADM.players = []; toast(`플레이어를 불러오지 못했어요 (${err.code || err.message})`); }
  render();
}
function playerDetail(p) {
  let s = null; try { s = JSON.parse(p.data); } catch {}
  if (!s) return '<p class="empty">저장 데이터를 읽지 못했어요.</p>';
  const cons = Object.entries(s.cons || {}).map(([id, c]) => `${(CON[id] || {}).name || id}(${(GRADES[c.g] || {}).name || c.g})`).join(', ');
  const rows = [['Star Dust', fmtN(s.dust)], ['Star Piece', fmtN(s.piece)], ['레벨 · 경험치', `Lv ${s.lv} · ${fmtN(s.xp)}`], ['최고 웨이브', s.best || 0],
    ['대전', `${s.wins || 0}승 ${s.losses || 0}패`], ['별자리', cons || '-'], ['팀', (s.team || []).map(id => (CON[id] || {}).name || id).join(', ') || '-'],
    ['행성', Object.entries(s.planets || {}).map(([id, x]) => `${(PLANET[id] || {}).name || id} Lv ${x.lv}`).join(', ')], ['광고 제거', s.adPass ? '구매함' : '-'],
    ['생일', s.birthday ? `${s.birthday[0]}월 ${s.birthday[1]}일` : '-']];
  const lb = ADM.lb[p.uid];
  if (lb === undefined) { ADM.lb[p.uid] = 'loading'; getDoc(doc(db, 'leaderboard', p.uid)).then(d => { ADM.lb[p.uid] = d.exists() ? d.data() : null; render(); }).catch(() => { ADM.lb[p.uid] = null; render(); }); }
  const rank = lb === 'loading' || lb === undefined ? '확인 중…' : !lb ? '랭킹 기록 없음' : lb.hidden ? '랭킹에서 숨김' : '랭킹에 표시 중';
  return `<div class="pl-acts"><button class="cta sm" type="button" data-plmail="${p.uid}" data-name="${esc(p.name)}">우편 보내기</button>
      ${lb && lb !== 'loading' ? `<button class="ghost sm" type="button" data-plhide="${p.uid}">${lb.hidden ? '랭킹에 다시 표시' : '랭킹에서 숨기기'}</button>` : ''}<span class="ct-desc">${rank}</span></div>
    <dl class="pl-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
    <details><summary>원본 저장 데이터 (JSON)</summary><pre>${esc(JSON.stringify(s, null, 2))}</pre></details>`;
}
const fmtN = n => Math.floor(n || 0).toLocaleString('ko-KR');
function playersHtml() {
  if (ADM.players === null) setTimeout(loadPlayers);
  const list = Array.isArray(ADM.players) ? ADM.players : [];
  return `<div class="ad-desc"><h2>플레이어</h2><p>게임 진행 데이터 (players/{uid}) · 최근 저장한 50명, 또는 닉네임으로 찾기 · 읽기 전용이에요.</p></div>
    <form class="pl-search" data-plsearch><input type="search" name="q" placeholder="닉네임 정확히 입력" value="${esc(ADM.playerQ)}"><button class="ghost sm" type="submit">찾기</button>
      ${ADM.playerQ ? '<button class="ghost sm" type="button" data-plclear>전체 보기</button>' : ''}<button class="ghost sm" type="button" data-plreload>새로고침</button></form>
    ${ADM.players === 'loading' || ADM.players === null ? '<p class="empty">불러오는 중…</p>' : !list.length ? '<p class="empty">플레이어가 없어요.</p>' : `
    <div class="ad-scroll"><table class="ad-t pl"><thead><tr><th>닉네임</th><th>Lv</th><th>최고 웨이브</th><th>승</th><th>계정</th><th>마지막 저장</th><th>가입</th><th>UID</th></tr></thead><tbody>
      ${list.map(p => `<tr class="pl-row${ADM.player === p.uid ? ' on' : ''}" data-pl="${p.uid}"><th scope="row">${esc(p.name)}</th><td>${p.lv}</td><td>${p.best}</td><td>${p.wins}</td>
        <td>${p.provider === 'google.com' ? 'Google' : '게스트'}</td><td>${fmtTime(p.updatedAt)}</td><td>${p.createdAt ? fmtTime(p.createdAt.toMillis()) : ''}</td><td><code>${p.uid}</code></td></tr>
        ${ADM.player === p.uid ? `<tr class="pl-detail"><td colspan="8">${playerDetail(p)}</td></tr>` : ''}`).join('')}
    </tbody></table></div>`}`;
}
root.addEventListener('submit', e => { if (!e.target.matches('[data-plsearch]')) return; e.preventDefault(); ADM.playerQ = e.target.q.value; ADM.player = null; loadPlayers(); });
root.addEventListener('click', async e => {
  if (ADM.area !== 'players') return;
  const pm = e.target.closest('[data-plmail]'); if (pm) { OPS.mailTo(pm.dataset.plmail, pm.dataset.name); return; }
  const ph = e.target.closest('[data-plhide]');
  if (ph) {
    const uid = ph.dataset.plhide, hide = !ADM.lb[uid].hidden;
    try { await updateDoc(doc(db, 'leaderboard', uid), { hidden: hide }); ADM.lb[uid] = { ...ADM.lb[uid], hidden: hide }; toast(hide ? '랭킹에서 숨겼어요' : '랭킹에 다시 표시해요'); }
    catch (err) { toast(`바꾸지 못했어요 (${err.code || err.message})`); }
    render(); return;
  }
  if (e.target.closest('[data-plclear]')) { ADM.playerQ = ''; loadPlayers(); }
  else if (e.target.closest('[data-plreload]')) loadPlayers();
  else { const r = e.target.closest('[data-pl]'); if (r) { ADM.player = ADM.player === r.dataset.pl ? null : r.dataset.pl; render(); } }
});

/* ---------- Toast / dialogs ---------- */
function toast(msg) {
  const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600);
}
function confirmBox(title, text, okLabel, { input } = {}) {
  const d = document.getElementById('dlg');
  d.innerHTML = `<form method="dialog"><h3>${title}</h3><p>${text}</p>${input ? `<input name="note" placeholder="${esc(input)}" maxlength="120">` : ''}
    <div class="dlg-btns"><button class="ghost sm" value="cancel" type="submit">취소</button><button class="cta sm" value="ok" type="submit">${okLabel}</button></div></form>`;
  d.showModal();
  return new Promise(ok => d.addEventListener('close', () => ok(d.returnValue === 'ok' ? (input ? d.querySelector('input').value.trim() : true) : null), { once: true }));
}

/* ---------- Auth + data ---------- */
onAuthStateChanged(auth, async user => {
  ADM.unsubs.forEach(f => f()); ADM.unsubs = [];
  ADM.user = user;
  if (!user) { ADM.phase = 'signin'; render(); return; }
  ADM.phase = 'loading'; render();
  let ok = false;
  try { ok = (await getDoc(doc(db, 'admins', user.uid))).exists(); } catch {}
  if (!ok) { ADM.phase = 'denied'; render(); return; }
  let first = true;
  ADM.unsubs.push(onSnapshot(doc(db, 'config', 'balance'), snap => {
    const d = snap.exists() ? snap.data() : {};
    const keep = !first && isDirty(); // keep unsaved edits when someone else saves
    ADM.saved = d.values || {}; ADM.savedContent = d.content || {}; ADM.savedAt = d.savedAt || null; ADM.savedBy = d.by || null;
    if (!keep) { ADM.draft = clone(ADM.saved); ADM.content = clone(ADM.savedContent); }
    if (first) { first = false; ADM.phase = 'ready'; }
    render();
  }, err => { toast(`초안을 불러오지 못했어요 (${err.code})`); }));
  ADM.unsubs.push(onSnapshot(doc(db, 'meta', 'current'), snap => { ADM.meta = snap.exists() ? snap.data() : null; render(); }));
  ADM.unsubs.push(onSnapshot(query(collection(db, 'releases'), orderBy('version', 'desc'), limit(50)), snap => {
    ADM.releases = snap.docs.map(d => d.data()); render();
  }));
});

async function saveDraft() {
  const values = clone(ADM.draft), content = clone(ADM.content);
  await setDoc(doc(db, 'config', 'balance'), { v: 1, values, content, savedAt: new Date().toISOString(), by: ADM.user.email || ADM.user.uid });
}
async function publish() {
  const bad = ctInvalid();
  if (bad) { toast(`추가 항목 ${bad}개에 고칠 곳이 있어요 · 고치거나 지운 뒤 배포해 주세요`); ADM.sec = 'content'; render(); return; }
  const note = await confirmBox('배포', `초안을 새 버전으로 배포해요. 게임은 다음 실행 때 새 값을 받아요.<br>기본값과 다른 값 ${Object.keys(ADM.draft).length}개 · 추가 항목 ${ctCount()}개`, '배포', { input: '메모 (예: 궁수 공속 하향)' });
  if (note === null) return;
  ADM.busy = true; render();
  try {
    if (isDirty()) await saveDraft();
    const values = clone(ADM.draft), content = clone(ADM.content), at = new Date().toISOString();
    const v = await runTransaction(db, async tx => {
      const m = await tx.get(doc(db, 'meta', 'current'));
      const next = ((m.exists() && m.data().version) || 0) + 1;
      tx.set(doc(db, 'releases', String(next)), { version: next, values, content, publishedAt: at, by: ADM.user.email || ADM.user.uid, note });
      tx.set(doc(db, 'meta', 'current'), { version: next, publishedAt: at });
      return next;
    });
    toast(`v${v} 배포했어요 · 게임을 다시 열면 적용돼요`);
  } catch (err) { toast(`배포하지 못했어요 (${err.code || err.message})`); }
  ADM.busy = false; render();
}

/* ---------- Events ---------- */
root.addEventListener('click', async e => {
  const ar = e.target.closest('[data-area]'); if (ar) { ADM.area = ar.dataset.area; render(); root.querySelector('.ad-body').scrollTop = 0; return; }
  if (await contentClick(e)) return;
  const t = e.target.closest('[data-sec]'); if (t) { ADM.sec = t.dataset.sec; render(); root.querySelector('.ad-body').scrollTop = 0; return; }
  const l = e.target.closest('[data-load]');
  if (l) {
    const r = ADM.releases.find(x => x.version === +l.dataset.load);
    if (r && await confirmBox('초안으로 불러오기', `v${r.version}의 값과 추가 항목으로 초안을 바꿔요. 저장하지 않은 변경은 사라져요. [배포]를 눌러야 게임에 나가요.`, '불러오기')) { ADM.draft = clone(r.values || {}); ADM.content = clone(r.content || {}); render(); }
    return;
  }
  const b = e.target.closest('[data-ad]'); if (!b) return;
  const act = b.dataset.ad;
  if (act === 'signin') signInWithPopup(auth, new GoogleAuthProvider()).catch(err => { if (err.code !== 'auth/popup-closed-by-user') toast(`로그인하지 못했어요 (${err.code})`); });
  else if (act === 'signout') signOut(auth);
  else if (act === 'discard') { ADM.draft = clone(ADM.saved); ADM.content = clone(ADM.savedContent); render(); }
  else if (act === 'defaults') { if (await confirmBox('전체 기본값', '모든 탭의 값을 게임 기본값(data.js)으로 되돌려요. 추가 항목은 그대로 둬요. 저장·배포해야 게임에 반영돼요.', '기본값으로')) { ADM.draft = {}; render(); } }
  else if (act === 'secdefaults') { for (const p of Object.keys(ADM.draft)) if (BAL_FIELDS[p] && BAL_FIELDS[p].sec === ADM.sec) delete ADM.draft[p]; render(); }
  else if (act === 'save') {
    ADM.busy = true; render();
    try { await saveDraft(); toast('초안을 저장했어요 · [배포]를 눌러야 게임에 나가요'); }
    catch (err) { toast(`저장하지 못했어요 (${err.code || err.message})`); }
    ADM.busy = false; render();
  }
  else if (act === 'publish') publish();
  else if (act === 'export') adminExport();
});
root.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'adImport') { adminImport(el.files[0]); el.value = ''; return; }
  if (el.dataset.rsup) { rsUpload(el.dataset.rsup, el.files[0]); el.value = ''; return; }
  if (el.dataset.ct) { contentChange(el); return; }
  const path = el.dataset.path; if (!path) return;
  const f = BAL_FIELDS[path];
  if (f.kind === 'chain') {
    const v = clone(curVal(path));
    if (el.dataset.part === 'type') { v.type = el.value; v.p = { ...FX_DEFAULTS[el.value] }; }
    else if (el.type === 'checkbox') v.p[el.dataset.param] = el.checked;
    else { const n = Number(el.value); if (!Number.isFinite(n)) return; v.p[el.dataset.param] = n; }
    setDraft(path, v);
  } else if (!setDraft(path, parseCell(f.kind, el.value))) { toast('숫자를 입력해 주세요'); }
  render();
});
addEventListener('beforeunload', e => { if (ADM.phase === 'ready' && isDirty()) e.preventDefault(); });

/* ---------- Excel (SheetJS from cdnjs, loaded on first use) ---------- */
function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    s.onload = () => ok(window.XLSX); s.onerror = () => fail(new Error('xlsx'));
    document.head.appendChild(s);
  });
}
function sheetRows(s) {
  if (s.kv) return [['키', '항목', '값', '기본값', '단위'], ...s.kv.map(([p, label, kind]) => [p, label, showNum(kind, curVal(p)), showNum(kind, BAL_DEFAULTS[p]), kind === 'pct' ? '%' : ''])];
  const head = ['ID', '이름', ...s.cols.map(c => `${c.label}${c.kind === 'pct' ? ' (%)' : ''} [${c.key}]`)];
  return [head, ...s.rows.map(r => [r.id, r.label, ...s.cols.map(c => { const v = curVal(s.path(r.id, c.key)); return c.kind === 'chain' ? chainText(v) : showNum(c.kind, v); })])];
}
async function adminExport() {
  let X; try { X = await loadXlsx(); } catch { toast('엑셀 도구를 불러오지 못했어요'); return; }
  const wb = X.utils.book_new();
  for (const s of BAL_SECTIONS) {
    const ws = X.utils.aoa_to_sheet(sheetRows(s));
    ws['!cols'] = sheetRows(s)[0].map((_, i) => ({ wch: i === 0 ? 14 : s.id === 'skin' && i > 4 ? 34 : 18 }));
    X.utils.book_append_sheet(wb, ws, s.title.replace(/[\\/?*[\]:]/g, '·'));
  }
  const fx = [['효과 키', '이름', '기본 파라미터', '설명 예시'], ...Object.keys(FX).map(t => [t, FX_LABEL[t] || t, chainText({ type: t, p: FX_DEFAULTS[t] || {} }).replace(t + ' ', ''), FX[t](FX_DEFAULTS[t] || {})])];
  const fxs = X.utils.aoa_to_sheet(fx); fxs['!cols'] = [{ wch: 14 }, { wch: 16 }, { wch: 24 }, { wch: 60 }];
  X.utils.book_append_sheet(wb, fxs, '효과 목록');
  const guide = X.utils.aoa_to_sheet([['갤럭시워 밸런스 데이터'], ['· 각 시트의 값만 고치고 ID·키·머리글은 그대로 두세요.'], ['· (%) 표시가 있는 열은 퍼센트 숫자로 적어요 (12 = 12%).'],
    ['· 각성 칸은 "효과키 파라미터=값" 형식이에요. 예) splash v=0.4  /  nth every=4 mul=3'], [`· 스킬 종류 칸에는 키를 적어요: ${Object.entries(GSKILL).map(([k, g]) => `${k}(${g.label})`).join(', ')}`], ['· 관리자 사이트의 [엑셀 가져오기]로 올린 뒤 [초안 저장] → [배포]를 누르면 게임에 반영돼요.']]);
  guide['!cols'] = [{ wch: 80 }];
  X.utils.book_append_sheet(wb, guide, '안내');
  X.writeFile(wb, `galaxywar-balance-${new Date().toISOString().slice(0, 10)}.xlsx`);
  toast('엑셀 파일을 내려받았어요');
}
async function adminImport(file) {
  if (!file) return;
  let X; try { X = await loadXlsx(); } catch { toast('엑셀 도구를 불러오지 못했어요'); return; }
  let wb; try { wb = X.read(await file.arrayBuffer(), { type: 'array' }); } catch { toast('엑셀 파일을 읽지 못했어요'); return; }
  let changed = 0, bad = 0;
  const put = (p, v) => { if (!BAL_FIELDS[p]) return; if (v === undefined) { bad++; return; } const before = JSON.stringify(curVal(p)); if (setDraft(p, v) && before !== JSON.stringify(curVal(p))) changed++; };
  for (const s of BAL_SECTIONS) {
    const ws = wb.Sheets[s.title.replace(/[\\/?*[\]:]/g, '·')]; if (!ws) continue;
    const rows = X.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
    if (s.kv) { for (const r of rows.slice(1)) { const p = String(r[0]); if (BAL_FIELDS[p]) put(p, parseCell(BAL_FIELDS[p].kind, r[2])); } continue; }
    const keys = rows[0].map(h => { const m = String(h).match(/\[(.+)\]\s*$/); return m ? m[1] : null; });
    for (const r of rows.slice(1)) {
      const id = String(r[0]); if (!s.rows.some(x => x.id === id)) continue;
      keys.forEach((k, i) => { if (!k) return; const c = s.cols.find(x => x.key === k); if (!c) return; put(s.path(id, k), c.kind === 'chain' ? parseChain(r[i]) : parseCell(c.kind, r[i])); });
    }
  }
  render();
  toast(`${changed}개 값을 불러왔어요${bad ? ` · 읽지 못한 칸 ${bad}개` : ''} · [초안 저장] → [배포]를 눌러야 반영돼요`);
}

render();
