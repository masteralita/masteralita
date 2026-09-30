'use strict';
/* ==========================================================================
   밸런스 관리자 (#admin): edit the balance registry from balance.js, save it to
   the artifact database, and round-trip it through an .xlsx workbook.
   Open with the page link + "#admin".
   ========================================================================== */
const ADM = { open: false, sec: BAL_SECTIONS[0].id, draft: {}, base: {}, canEdit: null, downloads: null };
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

(async function initAdminCaps() {
  if (!window.claude || !window.claude.use) return;
  const [user, dl] = await Promise.all([window.claude.use('user').catch(() => null), window.claude.use('downloads').catch(() => null)]);
  ADM.downloads = dl;
  ADM.canEdit = user ? await user.canEdit().catch(() => null) : null;
  if (ADM.open) renderAdmin();
})();

const curVal = p => (p in ADM.draft ? ADM.draft[p] : BAL_DEFAULTS[p]);
const isDirty = () => !sameVal(ADM.draft, BAL.values);
const diffCount = () => new Set([...Object.keys(ADM.draft), ...Object.keys(BAL.values)]).size && [...new Set([...Object.keys(ADM.draft), ...Object.keys(BAL.values)])].filter(p => !sameVal(ADM.draft[p], BAL.values[p])).length;
const resetDraft = () => { ADM.draft = clone(BAL.values); ADM.base = clone(BAL.values); };
const readOnly = () => ADM.canEdit === false;

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
  const v = curVal(path), mod = path in ADM.draft, dirty = !sameVal(ADM.draft[path], BAL.values[path]);
  const cls = `${mod ? ' mod' : ''}${dirty ? ' dirty' : ''}`, dis = readOnly() ? ' disabled' : '';
  const title = `기본값: ${kind === 'chain' ? chainText(BAL_DEFAULTS[path]) : showNum(kind, BAL_DEFAULTS[path])}`;
  if (kind === 'chain') {
    const params = Object.entries(v.p).filter(([, x]) => typeof x !== 'boolean').map(([k, x]) =>
      `<label class="pp"><span>${k}</span><input type="number" step="any" data-path="${path}" data-param="${k}" value="${x}"${dis}></label>`).join('');
    const bools = Object.entries(v.p).filter(([, x]) => typeof x === 'boolean').map(([k, x]) =>
      `<label class="pp"><span>${k}</span><input type="checkbox" data-path="${path}" data-param="${k}"${x ? ' checked' : ''}${dis}></label>`).join('');
    return `<td class="ce${cls}" title="${esc(title)}"><div class="chain-ed">
      <select data-path="${path}" data-part="type"${dis}>${Object.keys(FX).map(t => `<option value="${t}"${t === v.type ? ' selected' : ''}>${FX_LABEL[t] || t}</option>`).join('')}</select>
      <div class="pps">${params}${bools}</div><span class="fx-desc">${FX[v.type](v.p)}</span></div></td>`;
  }
  if (kind === 'orbits') return `<td class="${cls}" title="${esc(title)}"><select data-path="${path}" data-kind="orbits"${dis}><option value="1"${v === 1 ? ' selected' : ''}>1</option><option value="2"${v === 2 ? ' selected' : ''}>2</option></select></td>`;
  if (kind === 'text') return `<td class="${cls}" title="${esc(title)}"><input class="txt" type="text" data-path="${path}" data-kind="text" value="${esc(v ?? '')}"${dis}></td>`;
  return `<td class="${cls}" title="${esc(title)}"><span class="num-in"><input type="number" step="${kind === 'int' ? 1 : 'any'}" data-path="${path}" data-kind="${kind}" value="${showNum(kind, v)}"${dis}>${kind === 'pct' ? '<i>%</i>' : ''}</span></td>`;
}
function sectionHtml(s) {
  if (s.kv) return `<table class="ad-t kv"><thead><tr><th>항목</th><th>값</th><th>기본값</th></tr></thead><tbody>
    ${s.kv.map(([p, label, kind]) => `<tr><th scope="row">${label}</th>${cellHtml(p, kind)}<td class="def">${showNum(kind, BAL_DEFAULTS[p])}${kind === 'pct' ? '%' : ''}</td></tr>`).join('')}
    </tbody></table>`;
  return `<table class="ad-t"><thead><tr><th>${s.id === 'skin' ? '스킨' : '이름'}</th>${s.cols.map(c => `<th>${c.label}</th>`).join('')}</tr></thead><tbody>
    ${s.rows.map(r => `<tr><th scope="row">${r.label}${r.sub ? `<small>${r.sub}</small>` : ''}</th>${s.cols.map(c => cellHtml(s.path(r.id, c.key), c.kind)).join('')}</tr>`).join('')}
    </tbody></table>`;
}
function statusChip() {
  if (!BAL.db) return '<span class="ad-chip warn">저장소 없음 · claude.ai에서 열어야 저장돼요</span>';
  if (readOnly()) return '<span class="ad-chip">읽기 전용 · 소유자와 편집자만 저장할 수 있어요</span>';
  if (isDirty()) return `<span class="ad-chip gold">저장하지 않은 변경 ${diffCount()}개</span>`;
  return `<span class="ad-chip ok">저장됨${BAL.savedAt ? ' · ' + new Date(BAL.savedAt).toLocaleString('ko-KR') : ' · 기본값 사용 중'}</span>`;
}
function renderAdmin() {
  const el = $('admin'), s = BAL_SECTIONS.find(x => x.id === ADM.sec);
  const counts = Object.fromEntries(BAL_SECTIONS.map(x => [x.id, Object.keys(ADM.draft).filter(p => BAL_FIELDS[p] && BAL_FIELDS[p].sec === x.id).length]));
  const scroll = el.querySelector('.ad-body') ? el.querySelector('.ad-body').scrollTop : 0;
  const dis = readOnly() || !BAL.db ? ' disabled' : '';
  el.innerHTML = `
    <header class="ad-top">
      <div class="ad-title"><span class="eyebrow">GALAXY WAR · ADMIN</span><h1>밸런스 관리자</h1></div>
      <div class="ad-actions">
        <button class="ghost sm" data-ad="export" type="button">엑셀 내보내기</button>
        <label class="ghost sm file${readOnly() ? ' off' : ''}">엑셀 가져오기<input type="file" id="adImport" accept=".xlsx"${readOnly() ? ' disabled' : ''}></label>
        <button class="ghost sm" data-ad="defaults" type="button"${readOnly() ? ' disabled' : ''}>전체 기본값</button>
        <button class="ghost sm" data-ad="discard" type="button"${isDirty() ? '' : ' disabled'}>변경 취소</button>
        <button class="cta sm" data-ad="save" type="button"${dis}${isDirty() ? '' : ' disabled'}>저장</button>
        <button class="ghost sm" data-ad="close" type="button">게임으로</button>
      </div>
      <div class="ad-status">${statusChip()}</div>
    </header>
    <nav class="ad-tabs" aria-label="설정 분류">${BAL_SECTIONS.map(x => `<button type="button" data-sec="${x.id}" aria-current="${x.id === ADM.sec ? 'page' : 'false'}">${x.title}${counts[x.id] ? `<em>${counts[x.id]}</em>` : ''}</button>`).join('')}</nav>
    <div class="ad-body">
      <div class="ad-desc"><h2>${s.title}</h2><p>${s.desc} · 금색 테두리 = 저장 전 변경, 점 = 기본값과 다름 · 칸에 마우스를 올리면 기본값이 보여요</p>
        <button class="ghost sm" data-ad="secdefaults" type="button"${readOnly() || !counts[s.id] ? ' disabled' : ''}>이 탭 기본값</button></div>
      <div class="ad-scroll">${sectionHtml(s)}</div>
    </div>`;
  el.querySelector('.ad-body').scrollTop = scroll;
}

/* ---------- Events ---------- */
$('admin').addEventListener('click', e => {
  const t = e.target.closest('[data-sec]'); if (t) { ADM.sec = t.dataset.sec; renderAdmin(); $('admin').querySelector('.ad-body').scrollTop = 0; return; }
  const b = e.target.closest('[data-ad]'); if (!b) return;
  const act = b.dataset.ad;
  if (act === 'close') { location.hash = ''; closeAdmin(); }
  else if (act === 'discard') { resetDraft(); renderAdmin(); }
  else if (act === 'defaults') confirmBox('전체 기본값', '모든 탭의 값을 게임 기본값으로 되돌려요. 저장을 눌러야 게임에 반영돼요.', '기본값으로', () => { ADM.draft = {}; renderAdmin(); });
  else if (act === 'secdefaults') { for (const p of Object.keys(ADM.draft)) if (BAL_FIELDS[p] && BAL_FIELDS[p].sec === ADM.sec) delete ADM.draft[p]; renderAdmin(); }
  else if (act === 'save') adminSave();
  else if (act === 'export') adminExport();
});
$('admin').addEventListener('change', e => {
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
  renderAdmin();
});
async function adminSave() {
  if (!BAL.db) { toast('claude.ai에서 열어야 저장할 수 있어요'); return; }
  try { await saveBalance(clone(ADM.draft)); ADM.base = clone(ADM.draft); toast('저장했어요 · 게임에 바로 반영돼요'); }
  catch (err) { toast(err && err.code === 'invalid_argument' ? '저장 권한이 없어요' : '저장하지 못했어요. 잠시 후 다시 시도해 주세요'); ADM.canEdit = err && err.code === 'invalid_argument' ? false : ADM.canEdit; }
  renderAdmin();
}

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
    ['· 각성 칸은 "효과키 파라미터=값" 형식이에요. 예) splash v=0.4  /  nth every=4 mul=3'], ['· 관리자 화면의 [엑셀 가져오기]로 올린 뒤 [저장]을 누르면 게임에 반영돼요.']]);
  guide['!cols'] = [{ wch: 80 }];
  X.utils.book_append_sheet(wb, guide, '안내');
  const buf = X.write(wb, { type: 'array', bookType: 'xlsx' });
  if (!ADM.downloads) { toast('이 화면에서는 파일 저장을 쓸 수 없어요'); return; }
  try { await ADM.downloads.save({ filename: `galaxywar-balance-${new Date().toISOString().slice(0, 10)}.xlsx`, data: buf }); toast('엑셀 파일을 저장했어요'); }
  catch (err) { if (err && err.code !== 'declined') toast('파일을 저장하지 못했어요'); }
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
  renderAdmin();
  toast(`${changed}개 값을 불러왔어요${bad ? ` · 읽지 못한 칸 ${bad}개` : ''} · 저장을 눌러야 반영돼요`);
}

/* ---------- Open / close via #admin ---------- */
function openAdmin() {
  ADM.open = true; resetDraft();
  $('admin').hidden = false; renderAdmin();
}
function closeAdmin() {
  if (!ADM.open) return;
  ADM.open = false; $('admin').hidden = true;
  if (G.state === 'home') setTab(tab);
}
function route() { if (location.hash === '#admin') openAdmin(); else closeAdmin(); }
addEventListener('hashchange', route);
onBalance(() => {
  if (ADM.open) { if (sameVal(ADM.draft, ADM.base)) resetDraft(); else ADM.base = clone(BAL.values); renderAdmin(); } // keep unsaved edits
  else if (G.state === 'home' && !$('shell').hidden) setTab(tab);
});
route();
