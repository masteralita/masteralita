/* ==========================================================================
   뽑기 관리 · 상점 관리
   뽑기 관리: which constellations / skills each draw gives → balance values pool/{con|skill}/{id}/{draw}
   (balance.js GACHA_POOL), with the grade odds from the current draft.
   상점 관리: the store's products → content.shop { id: product } (balance.js applyShop, data.js SHOP_DEFAULT).
   Both ride the same draft → [초안 저장] → [배포] as the 밸런스 tab.
   ========================================================================== */

const GTABS = [['con', '별자리'], ['skill', '스킬']];
const STABS = [['all', '전체'], ...Object.entries(SHOP_TABS)];
const CUR = { krw: '원 (실결제)', piece: '별모래', dust: '미네랄' };
const pctTxt = v => `${+(v * 100).toFixed(3)}%`;
export const shopDefaults = () => Object.fromEntries(SHOP_DEFAULT.map(p => [p.id, JSON.parse(JSON.stringify(p))]));
export const shopMap = c => ((c || {}).shop && typeof c.shop === 'object' ? c.shop : shopDefaults());

export function makeStoreAdmin({ ADM, esc, render, toast, confirmBox, curVal, setDraft, clone, liveRel, sameVal }) {
  const S = { gtab: 'con', gopen: null, stab: 'all', sopen: null };
  const opt = (v, label, cur) => `<option value="${esc(v)}"${String(v) === String(cur ?? '') ? ' selected' : ''}>${esc(label)}</option>`;
  const field = (label, inner, wide) => `<label class="ct-f${wide ? ' wide' : ''}"><span>${label}</span>${inner}</label>`;
  const tabsHtml = (attr, list, cur, label) => `<nav class="ad-tabs" aria-label="${label}">${list.map(([k, n]) => `<button type="button" ${attr}="${k}" aria-current="${k === cur ? 'page' : 'false'}">${n}</button>`).join('')}</nav>`;

  /* ---------- 뽑기 관리 ---------- */
  const inPool = (kind, id, d) => !!curVal(`pool/${kind}/${id}/${d}`);
  const conW = d => GRADES.map((_, i) => +curVal(`gacha/${d}/w/${i}`) || 0);
  const skW = d => skPoolW(d, Object.fromEntries(DRAW_GRADES.map(g => [g, +curVal(`skgacha/${d}/w/${g}`) || 0])), id => inPool('skill', id, d));
  const draws = kind => POOL_DRAWS[kind];
  function gradeTable(kind) {
    const ds = draws(kind);
    if (kind === 'con') {
      const ws = ds.map(([d]) => { const w = conW(d), s = w.reduce((a, b) => a + b, 0) || 1; return w.map(x => x / s); });
      return `<table class="ad-t kv"><thead><tr><th>등급</th>${ds.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>
        ${GRADES.map((g, i) => `<tr><th scope="row">${g.name}<small>${g.en}</small></th>${ws.map(w => `<td>${w[i] ? pctTxt(w[i]) : '-'}</td>`).join('')}</tr>`).join('')}
        <tr><th scope="row">나올 수 있는 별자리</th>${ds.map(([d]) => `<td>${ALL_CONS.filter(c => inPool('con', c.id, d)).length}종</td>`).join('')}</tr></tbody></table>`;
    }
    const ws = ds.map(([d]) => { const w = skW(d), s = DRAW_GRADES.reduce((a, g) => a + w[g], 0) || 1; return Object.fromEntries(DRAW_GRADES.map(g => [g, w[g] / s])); });
    return `<table class="ad-t kv"><thead><tr><th>등급</th>${ds.map(([, l]) => `<th>${l}</th>`).join('')}</tr></thead><tbody>
      ${DRAW_GRADES.map(g => `<tr><th scope="row">${g}<small>${SKILL_GRADES[g].name}</small></th>${ws.map((w, k) => { const n = Object.keys(ESKILL).filter(id => ESKILL[id].grade === g && inPool('skill', id, ds[k][0])).length;
        return `<td>${w[g] ? `${pctTxt(w[g])} <small class="dim">${n}종</small>` : '-'}</td>`; }).join('')}</tr>`).join('')}</tbody></table>`;
  }
  // chance of this one item per pull, and per grade for constellations
  function itemOdds(kind, id, d) {
    if (!inPool(kind, id, d)) return { total: 0 };
    if (kind === 'con') {
      const n = ALL_CONS.filter(c => inPool('con', c.id, d)).length || 1, w = conW(d), s = w.reduce((a, b) => a + b, 0) || 1;
      return { total: 1 / n, n, grades: GRADES.map((g, i) => [g.name, w[i] / s / n]).filter(x => x[1] > 0) };
    }
    const g = ESKILL[id].grade, w = skW(d), s = DRAW_GRADES.reduce((a, x) => a + w[x], 0) || 1;
    const n = Object.keys(ESKILL).filter(x => ESKILL[x].grade === g && inPool('skill', x, d)).length || 1;
    return { total: w[g] / s / n, n, gp: w[g] / s };
  }
  function gachaItem(kind, id) {
    const name = kind === 'con' ? `${CON[id].name}자리` : ESKILL[id].name, sub = kind === 'con' ? CON[id].en : `${ESKILL[id].grade} · ${SKILL_GRADES[ESKILL[id].grade].name}`;
    const key = `${kind}|${id}`, open = S.gopen === key, ds = draws(kind);
    const chips = ds.map(([d, l]) => `<span class="ad-chip${inPool(kind, id, d) ? ' ok' : ''}">${l} ${inPool(kind, id, d) ? `${pctTxt(itemOdds(kind, id, d).total)}` : '안 나옴'}</span>`).join('');
    const dirty = ds.some(([d]) => !sameVal(ADM.draft[`pool/${kind}/${id}/${d}`], ADM.saved[`pool/${kind}/${id}/${d}`]));
    const detail = !open ? '' : `<div class="gp-detail">
      <div class="op-chks">${ds.map(([d, l]) => `<label class="op-chk"><input type="checkbox" data-pool="pool/${kind}/${id}/${d}"${inPool(kind, id, d) ? ' checked' : ''}> ${l}에서 나옴</label>`).join('')}</div>
      ${ds.map(([d, l]) => { const o = itemOdds(kind, id, d); if (!o.total) return `<p class="ct-desc"><b>${l}</b> · 이 ${kind === 'con' ? '별자리' : '스킬'}는 나오지 않아요.</p>`;
        return kind === 'con'
          ? `<p class="ct-desc"><b>${l}</b> · 1회에 ${pctTxt(o.total)} (${o.n}종 중 하나) · 등급별: ${o.grades.map(([g, v]) => `${g} ${pctTxt(v)}`).join(' · ')}</p>`
          : `<p class="ct-desc"><b>${l}</b> · 1회에 ${pctTxt(o.total)} (${ESKILL[id].grade} 등급 ${pctTxt(o.gp)} ÷ ${o.n}종)</p>`; }).join('')}
    </div>`;
    return `<article class="ct-card"><header><button class="ct-head" type="button" data-gpopen="${key}" aria-expanded="${open}"><b>${esc(name)}</b><small>${esc(sub)}</small></button>
      ${dirty ? '<span class="ad-chip gold">저장 전</span>' : ''}${chips}</header>${detail}</article>`;
  }
  const gachaTabs = () => tabsHtml('data-gtab', GTABS, S.gtab, '뽑기 종류');
  function gachaHtml() {
    const kind = S.gtab, ids = kind === 'con' ? ALL_CONS.map(c => c.id) : Object.keys(ESKILL).sort((a, b) => DRAW_GRADES.indexOf(ESKILL[a].grade) - DRAW_GRADES.indexOf(ESKILL[b].grade));
    return `<div class="ad-desc"><h2>뽑기 관리 · ${kind === 'con' ? '별자리' : '스킬'}</h2><p>항목을 눌러 상세에서 ${draws(kind).map(([, l]) => l).join(', ')}에 나올지 체크해요.
      등급 확률은 [밸런스] → ${kind === 'con' ? '등급·뽑기' : '스킬 뽑기'} 탭의 가중치로 정해지고, 아래 표는 지금 초안 기준이에요. [초안 저장] → [배포]하면 게임과 상점 확률 안내에 반영돼요.</p></div>
      <h3 class="rs-h">등급별 기본 확률</h3><div class="ad-scroll">${gradeTable(kind)}</div>
      <h3 class="rs-h">${kind === 'con' ? '별자리' : '장착 스킬'} ${ids.length}개</h3>${ids.map(id => gachaItem(kind, id)).join('')}`;
  }

  /* ---------- 상점 관리 ---------- */
  const cur = () => shopMap(ADM.content);
  const own = () => { if (!ADM.content.shop) ADM.content = { ...ADM.content, shop: shopDefaults() }; return ADM.content.shop; }; // first edit copies the defaults
  const shopInvalid = () => Object.values(cur()).filter(d => shopProblems(d).length).length;
  function liveState(d, now = Date.now()) {
    const a = d.start ? Date.parse(d.start) : NaN, b = d.end ? Date.parse(d.end) : NaN;
    if (Number.isFinite(a) && now < a) return '<span class="ad-chip">노출 예정</span>';
    if (Number.isFinite(b) && now >= b) return '<span class="ad-chip">기간 종료</span>';
    return '<span class="ad-chip ok">노출 중</span>';
  }
  const inp = (d, path, t, v, extra = '') => `<input data-sh="${esc(d.id)}|${path}" data-t="${t}" ${t === 'text' ? 'type="text"' : t === 'dt' ? 'type="datetime-local"' : 'type="number" step="1" min="0"'} value="${esc(v ?? '')}"${extra}>`;
  const sel = (d, path, opts) => `<select data-sh="${esc(d.id)}|${path}" data-t="sel">${opts}</select>`;
  function shopForm(d) {
    const r = d.reward || {};
    return `<div class="ct-grid">
      ${field('이름', inp(d, 'name', 'text', d.name))}
      ${field('노출 위치 (상점 탭)', sel(d, 'tab', Object.entries(SHOP_TABS).map(([k, l]) => opt(k, l, d.tab)).join('')))}
      ${field('상품 구분', sel(d, 'type', Object.entries(SHOP_TYPES).map(([k, l]) => opt(k, l, d.type)).join('')))}
      ${field('순서 (작을수록 위)', inp(d, 'order', 'int', d.order))}
      ${field('설명', inp(d, 'desc', 'text', d.desc), true)}
      ${field('결제 수단', sel(d, 'cur', Object.entries(CUR).map(([k, l]) => opt(k, l, d.cur)).join('')))}
      ${field(`가격 (${d.cur === 'krw' ? '원' : CUR[d.cur] || ''})`, inp(d, 'price', 'int', d.price))}
      ${field('계정당 구매 횟수', inp(d, 'limit', 'int', d.limit > 0 ? d.limit : '', d.limit > 0 ? '' : ' disabled placeholder="무제한"'))}
      <label class="op-chk"><input type="checkbox" data-sh="${esc(d.id)}|limit" data-t="unl"${d.limit > 0 ? '' : ' checked'}> 무제한 구매</label>
      ${field('노출 시작 (비우면 바로)', inp(d, 'start', 'dt', d.start))}
      ${field('노출 종료 (비우면 계속)', inp(d, 'end', 'dt', d.end))}
    </div>
    <h4>보상</h4><div class="ct-grid">
      ${field('별모래', inp(d, 'reward/piece', 'int', r.piece || ''))}
      ${field('미네랄', inp(d, 'reward/dust', 'int', r.dust || ''))}
      ${field('별자리 카드', sel(d, 'reward/con', opt('', '없음', r.con || '') + ALL_CONS.map(c => opt(c.id, `${c.name}자리`, r.con)).join('')))}
      ${r.con ? field('별자리 등급', sel(d, 'reward/grade', GRADES.map((g, i) => opt(i, g.name, r.grade | 0)).join(''))) : ''}
      ${field('장착 스킬', sel(d, 'reward/skill', opt('', '없음', r.skill || '') + Object.entries(ESKILL).map(([id, k]) => opt(id, `[${k.grade}] ${k.name}`, r.skill)).join('')))}
      <label class="op-chk"><input type="checkbox" data-sh="${esc(d.id)}|reward/ads" data-t="bool"${r.ads ? ' checked' : ''}> 광고 제거</label>
    </div>`;
  }
  function shopCard(d) {
    const probs = shopProblems(d), open = S.sopen === d.id;
    const saved = shopMap(ADM.savedContent)[d.id], released = shopMap(liveRel().content)[d.id];
    const tag = !saved ? '<span class="ad-chip gold">저장 전</span>' : !sameVal(saved, d) ? '<span class="ad-chip gold">변경됨</span>'
      : !sameVal(released, d) ? '<span class="ad-chip warn">배포 대기</span>' : '<span class="ad-chip ok">게임 적용 중</span>';
    const price = d.cur === 'krw' ? `₩${(+d.price || 0).toLocaleString('ko-KR')}` : `${(+d.price || 0).toLocaleString('ko-KR')} ${CUR[d.cur] || ''}`;
    const sub = `${SHOP_TABS[d.tab] || '?'} · ${SHOP_TYPES[d.type] || '?'} · ${price} · ${d.limit > 0 ? `${d.limit}회` : '무제한'}${d.start || d.end ? ` · ${(d.start || '').replace('T', ' ')} ~ ${(d.end || '').replace('T', ' ')}` : ''}`;
    return `<article class="ct-card${probs.length ? ' bad' : ''}">
      <header><button class="ct-head" type="button" data-shopen="${esc(d.id)}" aria-expanded="${open}"><b>${esc(d.name || '(이름 없음)')}</b><small>${esc(sub)}</small></button>
        ${liveState(d)}${tag}<button class="ghost sm" type="button" data-shdel="${esc(d.id)}">삭제</button></header>
      ${probs.length ? `<p class="ct-probs">${probs.map(esc).join(' · ')}</p>` : ''}
      ${open ? shopForm(d) : ''}</article>`;
  }
  const shopTabs = () => tabsHtml('data-stab', STABS, S.stab, '노출 위치');
  function shopHtml() {
    const all = Object.values(cur()).sort((a, b) => Object.keys(SHOP_TABS).indexOf(a.tab) - Object.keys(SHOP_TABS).indexOf(b.tab) || shopSort(a, b));
    const list = S.stab === 'all' ? all : all.filter(d => d.tab === S.stab);
    const now = Date.now(), crowded = ['con', 'skill'].filter(t => all.filter(d => d.tab === t && d.type === 'banner' && !shopProblems(d).length && shopOpen(d, now)).length > 2);
    return `<div class="ad-desc"><h2>상점 관리</h2><p>상점 탭(추천·별자리·스킬·별모래)에 나올 상품이에요. 배너 상품은 탭 맨 위에 크게 나오고, 별자리·스킬 탭에는 노출 기간 안의 배너가 순서대로 최대 2개까지 나와요.
      노출 기간은 기기 시간 기준이고, 비우면 제한이 없어요. 구매 횟수는 계정마다 세요. [초안 저장] → [배포]하면 게임에 나와요.</p>
      ${ADM.content.shop ? '<button class="ghost sm" type="button" data-shreset>기본 상품으로 되돌리기</button>' : '<span class="ad-chip">기본 상품 사용 중 · 고치면 이 목록이 저장돼요</span>'}</div>
    ${crowded.length ? `<p class="ct-probs">${crowded.map(t => SHOP_TABS[t]).join('·')} 탭에 지금 노출 중인 배너가 2개보다 많아요. 순서가 빠른 2개만 보여요.</p>` : ''}
    <div class="ct-sec-h"><h3>${S.stab === 'all' ? '모든 상품' : `${SHOP_TABS[S.stab]} 탭`} <small>${list.length}개</small></h3><button class="cta sm" type="button" data-shadd>+ 상품 추가</button></div>
    ${list.length ? list.map(shopCard).join('') : '<p class="empty">상품이 없어요.</p>'}`;
  }
  function shopChange(el) {
    const [id, path] = el.dataset.sh.split('|'), t = el.dataset.t, shop = own(), d = clone(shop[id]);
    if (!d) return;
    let v;
    if (t === 'text' || t === 'dt') v = el.value;
    else if (t === 'sel') v = path === 'reward/grade' ? +el.value : el.value;
    else if (t === 'bool') v = el.checked;
    else if (t === 'unl') v = el.checked ? 0 : 1;
    else { v = el.value === '' ? 0 : Math.round(Number(el.value)); if (!Number.isFinite(v) || v < 0) { toast('0 이상의 숫자를 입력해 주세요'); render(); return; } }
    const seg = path.split('/');
    let o = d;
    for (const s of seg.slice(0, -1)) { if (o[s] == null) o[s] = {}; o = o[s]; }
    const last = seg[seg.length - 1];
    if (seg[0] === 'reward' && (v === '' || v === 0 || v === false) && last !== 'grade') delete o[last]; else o[last] = v;
    if (path === 'reward/con') { if (v) d.reward.grade = d.reward.grade | 0; else delete d.reward.grade; }
    ADM.content = { ...ADM.content, shop: { ...shop, [id]: d } };
    render();
  }

  /* ---------- Events (called first by admin.js) ---------- */
  async function click(e) {
    const gt = e.target.closest('[data-gtab]'), go = e.target.closest('[data-gpopen]');
    if (gt) { S.gtab = gt.dataset.gtab; S.gopen = null; render(); return true; }
    if (go) { S.gopen = S.gopen === go.dataset.gpopen ? null : go.dataset.gpopen; render(); return true; }
    const st = e.target.closest('[data-stab]'), so = e.target.closest('[data-shopen]'), sd = e.target.closest('[data-shdel]');
    if (st) { S.stab = st.dataset.stab; render(); return true; }
    if (so) { S.sopen = S.sopen === so.dataset.shopen ? null : so.dataset.shopen; render(); return true; }
    if (e.target.closest('[data-shadd]')) {
      const shop = own(), id = `shop_${Date.now().toString(36)}`, tab = S.stab === 'all' ? 'con' : S.stab;
      const order = Math.max(0, ...Object.values(shop).filter(x => x.tab === tab).map(x => x.order || 0)) + 1;
      ADM.content = { ...ADM.content, shop: { ...shop, [id]: { id, tab, type: 'banner', order, name: '', desc: '', cur: 'krw', price: 9900, limit: 1, start: '', end: '', reward: {} } } };
      S.sopen = id; render(); return true;
    }
    if (sd) {
      const id = sd.dataset.shdel, d = cur()[id];
      if (d && await confirmBox('상품 삭제', `"${esc(d.name || id)}"을(를) 지워요. 배포하면 상점에서 사라져요.`, '삭제')) { const shop = clone(own()); delete shop[id]; ADM.content = { ...ADM.content, shop }; render(); }
      return true;
    }
    if (e.target.closest('[data-shreset]')) {
      if (await confirmBox('기본 상품으로', '상품 목록을 게임 기본 상품(광고 제거, 특수 별자리 패키지, 별모래 6종)으로 되돌려요. 저장·배포해야 게임에 반영돼요.', '되돌리기')) {
        const c = { ...ADM.content }; delete c.shop; ADM.content = c; S.sopen = null; render();
      }
      return true;
    }
    return false;
  }
  function change(el) {
    if (el.dataset.pool) { setDraft(el.dataset.pool, el.checked); render(); return true; }
    if (el.dataset.sh) { shopChange(el); return true; }
    return false;
  }
  return { gachaTabs, gachaHtml, shopTabs, shopHtml, click, change, shopInvalid };
}
