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
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, orderBy, limit, runTransaction } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app, FIREBASE_DB);

const ADM = {
  phase: 'loading', // loading | signin | denied | ready
  user: null, sec: BAL_SECTIONS[0].id,
  draft: {}, saved: {}, savedAt: null, savedBy: null, // saved = config/balance
  meta: null, releases: [], unsubs: [], busy: false,
};
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const root = document.getElementById('admin');
const live = () => (ADM.releases.find(r => ADM.meta && r.version === ADM.meta.version) || { values: {} }).values;

const curVal = p => (p in ADM.draft ? ADM.draft[p] : BAL_DEFAULTS[p]);
const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(p => !sameVal(a[p], b[p]));
const isDirty = () => diff(ADM.draft, ADM.saved).length > 0;
const fmtTime = t => t ? new Date(t).toLocaleString('ko-KR') : '';

/* ---------- Value formatting ---------- */
function showNum(kind, v) { return kind === 'pct' ? +(v * 100).toFixed(4) : v; }
function parseCell(kind, raw) {
  if (kind === 'text') return String(raw ?? '');
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
  return `<table class="ad-t rel"><thead><tr><th>버전</th><th>배포 시각</th><th>배포한 사람</th><th>메모</th><th>기본값과 다른 값</th><th></th></tr></thead><tbody>
    ${ADM.releases.map(r => `<tr><th scope="row">v${r.version}${r.version === cur ? ' <span class="ad-chip ok">게임 적용 중</span>' : ''}</th>
      <td>${fmtTime(r.publishedAt)}</td><td>${esc(r.by || '')}</td><td class="note">${esc(r.note || '')}</td><td>${Object.keys(r.values || {}).length}개</td>
      <td><button class="ghost sm" type="button" data-load="${r.version}">초안으로 불러오기</button></td></tr>`).join('')}
    </tbody></table>`;
}
function statusChips() {
  const unsaved = diff(ADM.draft, ADM.saved).length, pending = diff(ADM.saved, live()).length;
  const out = [];
  out.push(unsaved ? `<span class="ad-chip gold">저장하지 않은 변경 ${unsaved}개</span>`
    : `<span class="ad-chip ok">초안 저장됨${ADM.savedAt ? ` · ${fmtTime(ADM.savedAt)}${ADM.savedBy ? ` · ${esc(ADM.savedBy)}` : ''}` : ''}</span>`);
  out.push(pending ? `<span class="ad-chip warn">배포 대기 ${pending}개 · [배포]를 눌러야 게임에 나가요</span>`
    : `<span class="ad-chip">게임 적용 중: ${ADM.meta && ADM.meta.version ? `v${ADM.meta.version}` : '내장 기본값'}</span>`);
  return out.join('');
}
function render() {
  if (ADM.phase !== 'ready') { root.innerHTML = gateHtml(); return; }
  const s = BAL_SECTIONS.find(x => x.id === ADM.sec);
  const counts = Object.fromEntries(BAL_SECTIONS.map(x => [x.id, Object.keys(ADM.draft).filter(p => BAL_FIELDS[p] && BAL_FIELDS[p].sec === x.id).length]));
  const body = root.querySelector('.ad-body'), scroll = body ? body.scrollTop : 0;
  const pending = diff(ADM.saved, live()).length || isDirty() || !(ADM.meta && ADM.meta.version); // the first release can be the defaults
  root.innerHTML = `
    <header class="ad-top">
      <div class="ad-title"><span class="eyebrow">GALAXY WAR · ADMIN</span><h1>갤럭시워 관리자</h1></div>
      <div class="ad-actions">
        <button class="ghost sm" data-ad="export" type="button">엑셀 내보내기</button>
        <label class="ghost sm file">엑셀 가져오기<input type="file" id="adImport" accept=".xlsx"></label>
        <button class="ghost sm" data-ad="defaults" type="button">전체 기본값</button>
        <button class="ghost sm" data-ad="discard" type="button"${isDirty() ? '' : ' disabled'}>변경 취소</button>
        <button class="ghost sm" data-ad="save" type="button"${isDirty() && !ADM.busy ? '' : ' disabled'}>초안 저장</button>
        <button class="cta sm" data-ad="publish" type="button"${pending && !ADM.busy ? '' : ' disabled'}>배포</button>
      </div>
      <div class="ad-status">${statusChips()}<span class="who">${esc(ADM.user.email || ADM.user.uid)} · <a href="../play/" target="_blank" rel="noopener">게임 열기</a> · <button class="link" data-ad="signout" type="button">로그아웃</button></span></div>
    </header>
    <nav class="ad-tabs" aria-label="설정 분류">${BAL_SECTIONS.map(x => `<button type="button" data-sec="${x.id}" aria-current="${x.id === ADM.sec ? 'page' : 'false'}">${x.title}${counts[x.id] ? `<em>${counts[x.id]}</em>` : ''}</button>`).join('')}
      <button type="button" data-sec="releases" aria-current="${ADM.sec === 'releases' ? 'page' : 'false'}">배포 기록</button></nav>
    <div class="ad-body">${s ? `
      <div class="ad-desc"><h2>${s.title}</h2><p>${s.desc} · 금색 테두리 = 저장 전 변경, 점 = 기본값과 다름 · 칸에 마우스를 올리면 기본값이 보여요</p>
        <button class="ghost sm" data-ad="secdefaults" type="button"${counts[s.id] ? '' : ' disabled'}>이 탭 기본값</button></div>
      <div class="ad-scroll">${sectionHtml(s)}</div>` : `
      <div class="ad-desc"><h2>배포 기록</h2><p>[배포]를 누를 때마다 버전이 하나씩 쌓여요. 예전 버전을 초안으로 불러와 다시 배포하면 되돌릴 수 있어요.</p></div>
      <div class="ad-scroll">${releasesHtml()}</div>`}
    </div>`;
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
    ADM.saved = d.values || {}; ADM.savedAt = d.savedAt || null; ADM.savedBy = d.by || null;
    if (!keep) ADM.draft = clone(ADM.saved);
    if (first) { first = false; ADM.phase = 'ready'; }
    render();
  }, err => { toast(`초안을 불러오지 못했어요 (${err.code})`); }));
  ADM.unsubs.push(onSnapshot(doc(db, 'meta', 'current'), snap => { ADM.meta = snap.exists() ? snap.data() : null; render(); }));
  ADM.unsubs.push(onSnapshot(query(collection(db, 'releases'), orderBy('version', 'desc'), limit(50)), snap => {
    ADM.releases = snap.docs.map(d => d.data()); render();
  }));
});

async function saveDraft() {
  const values = clone(ADM.draft);
  await setDoc(doc(db, 'config', 'balance'), { v: 1, values, savedAt: new Date().toISOString(), by: ADM.user.email || ADM.user.uid });
}
async function publish() {
  const note = await confirmBox('배포', `초안을 새 버전으로 배포해요. 게임은 다음 실행 때 새 값을 받아요.<br>기본값과 다른 값 ${Object.keys(ADM.draft).length}개`, '배포', { input: '메모 (예: 궁수 공속 하향)' });
  if (note === null) return;
  ADM.busy = true; render();
  try {
    if (isDirty()) await saveDraft();
    const values = clone(ADM.draft), at = new Date().toISOString();
    const v = await runTransaction(db, async tx => {
      const m = await tx.get(doc(db, 'meta', 'current'));
      const next = ((m.exists() && m.data().version) || 0) + 1;
      tx.set(doc(db, 'releases', String(next)), { version: next, values, publishedAt: at, by: ADM.user.email || ADM.user.uid, note });
      tx.set(doc(db, 'meta', 'current'), { version: next, publishedAt: at });
      return next;
    });
    toast(`v${v} 배포했어요 · 게임을 다시 열면 적용돼요`);
  } catch (err) { toast(`배포하지 못했어요 (${err.code || err.message})`); }
  ADM.busy = false; render();
}

/* ---------- Events ---------- */
root.addEventListener('click', async e => {
  const t = e.target.closest('[data-sec]'); if (t) { ADM.sec = t.dataset.sec; render(); root.querySelector('.ad-body').scrollTop = 0; return; }
  const l = e.target.closest('[data-load]');
  if (l) {
    const r = ADM.releases.find(x => x.version === +l.dataset.load);
    if (r && await confirmBox('초안으로 불러오기', `v${r.version}의 값으로 초안을 바꿔요. 저장하지 않은 변경은 사라져요. [배포]를 눌러야 게임에 나가요.`, '불러오기')) { ADM.draft = clone(r.values || {}); render(); }
    return;
  }
  const b = e.target.closest('[data-ad]'); if (!b) return;
  const act = b.dataset.ad;
  if (act === 'signin') signInWithPopup(auth, new GoogleAuthProvider()).catch(err => { if (err.code !== 'auth/popup-closed-by-user') toast(`로그인하지 못했어요 (${err.code})`); });
  else if (act === 'signout') signOut(auth);
  else if (act === 'discard') { ADM.draft = clone(ADM.saved); render(); }
  else if (act === 'defaults') { if (await confirmBox('전체 기본값', '모든 탭의 값을 게임 기본값(data.js)으로 되돌려요. 저장·배포해야 게임에 반영돼요.', '기본값으로')) { ADM.draft = {}; render(); } }
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
    ['· 각성 칸은 "효과키 파라미터=값" 형식이에요. 예) splash v=0.4  /  nth every=4 mul=3'], ['· 관리자 사이트의 [엑셀 가져오기]로 올린 뒤 [초안 저장] → [배포]를 누르면 게임에 반영돼요.']]);
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
