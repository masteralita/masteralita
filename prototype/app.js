'use strict';
/* ==========================================================================
   App shell: save data, title/login, lobby, bottom tabs (상점 · 행성 · 로비 · 별자리 · 팀),
   settings, rewards. The battle itself lives in battle.js.
   ========================================================================== */

/* ---------- Save (prototype: kept in this browser only) ---------- */
const SAVE_KEY = 'gw.save.v1';
function freshSave() {
  return {
    v: 1, name: '', title: 'Star Wanderer', lv: 1, xp: 0, dust: 30000, piece: 1500, birthday: null,
    lastCollect: Date.now(), chest: 0, best: 0, wins: 0, losses: 0, adsRemoved: false,
    planets: { earth: { lv: 1 } }, mainPlanet: 'earth',
    cons: { sgr: newCon(0), leo: newCon(0), vir: newCon(0) },
    team: ['sgr', 'leo', 'vir'],
    settings: { glow: true, fps: 60, sfx: true, bgm: true, push: true },
  };
}
function newCon(g) { return { g, slots: {} }; }
let save = (() => {
  try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); if (v && v.v === 1) return Object.assign(freshSave(), v); } catch {}
  return freshSave();
})();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} }

const fmt = n => Math.floor(n).toLocaleString('en-US');
const CUR = { dust: 'Star Dust', piece: 'Star Piece' };
function spend(cur, n) {
  if (save[cur] < n) { toast(`${CUR[cur]}가 ${fmt(n - save[cur])} 부족해요`); return false; }
  save[cur] -= n; persist(); renderTopBar(); return true;
}
function gain(cur, n) { save[cur] += n; persist(); renderTopBar(); }
function gainAccXp(v) {
  save.xp += v; let up = 0;
  while (save.xp >= accNeed(save.lv)) { save.xp -= accNeed(save.lv); save.lv += 1; up += 1; }
  persist(); return up;
}

/* ---------- Account-side bonuses used by battle.js ---------- */
function conBonus(id) {
  const o = save.cons[id] || newCon(0), def = CON[id];
  let act = 0, pas = 0, lim = 0;
  def.sh.pts.forEach((_, i) => {
    const s = o.slots[i]; if (!s || !s.part) return;
    const v = partValue(s.part), t = slotType(def, i);
    if (t === 'act') act += v; else if (t === 'pas') pas += v; else lim += v;
  });
  const gm = GRADES[o.g].mult;
  return { grade: o.g, atk: gm * (1 + act / 100), hp: gm * (1 + pas / 100), rate: 1 + lim / 100, act, pas, lim };
}
function conPower(id) {
  const d = CON[id], b = conBonus(id);
  return Math.round(d.atk * d.rate * b.atk * b.rate * 10 + d.hp * b.hp / 5);
}
function teamPower() {
  const p = PLANET[save.mainPlanet];
  return save.team.reduce((s, id) => s + conPower(id), 0) + Math.round(p.hp * planetHpMul(save.planets[save.mainPlanet].lv) / 20);
}

/* ---------- Tiny UI helpers ---------- */
let toastT = null;
function toast(msg) {
  const el = $('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2200);
}
function openModal(html, onClick) {
  $('modalBody').innerHTML = html; $('modal').hidden = false;
  $('modalBody').onclick = e => { const b = e.target.closest('[data-act]'); if (b) onClick && onClick(b.dataset.act, b); };
}
function closeModal() { $('modal').hidden = true; }
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
function confirmBox(title, text, okLabel, onOk) {
  openModal(`<h3>${title}</h3><p class="mtxt">${text}</p>
    <div class="mbtns"><button class="ghost" data-act="no" type="button">취소</button><button class="cta sm" data-act="ok" type="button">${okLabel}</button></div>`,
    act => { closeModal(); if (act === 'ok') onOk(); });
}
const gradeChip = g => `<span class="gchip" style="--g:${GRADES[g].col}">${GRADES[g].name}</span>`;
const orbStyle = pid => {
  const d = PLANET[pid];
  if (d.kind === 'earth') return 'background:radial-gradient(circle at 35% 30%,#9fd0ff,#2f6be8 45%,#0b1f5a 80%);box-shadow:0 0 18px rgba(80,150,255,.45)';
  if (d.kind === 'sun') return 'background:radial-gradient(circle at 40% 35%,#fff6c4,#ffb02e 45%,#e2531a 85%);box-shadow:0 0 22px rgba(255,160,40,.7)';
  if (d.kind === 'moon') return 'background:radial-gradient(circle at 35% 30%,#f2f2f6,#a3a6b8 50%,#4b4e63 90%);box-shadow:0 0 14px rgba(200,200,230,.3)';
  const [a, b, c] = d.look.c;
  return `background:radial-gradient(circle at 35% 30%,${a},${b} 50%,${c} 88%);box-shadow:0 0 16px rgba(${d.look.glow},.4)`;
};

/* ---------- Title / login (화면설계서 4p) ---------- */
function showTitle() {
  G.state = 'title'; G.zone = ZONES[2];
  setScreen('title');
  const first = !save.name;
  $('titleForm').hidden = !first; $('titleTap').hidden = first;
  if (!first) $('titleHello').textContent = `${save.name} · Lv ${save.lv}`;
}
(function initTitle() {
  const m = $('bdMonth'), d = $('bdDay');
  m.innerHTML = '<option value="">월</option>' + Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}">${i + 1}월</option>`).join('');
  d.innerHTML = '<option value="">일</option>' + Array.from({ length: 31 }, (_, i) => `<option value="${i + 1}">${i + 1}일</option>`).join('');
  const preview = () => {
    const id = m.value && d.value ? zodiacOf(+m.value, +d.value) : null;
    $('bdPreview').innerHTML = id ? `탄생 별자리 <b>${CON[id].name}자리</b>를 <b style="color:${GRADES[4].col}">에픽</b> 등급으로 받아요.` : '생일을 입력하면 탄생 별자리를 에픽 등급으로 받아요.';
  };
  m.onchange = preview; d.onchange = preview; preview();
  $('titleForm').addEventListener('submit', e => {
    e.preventDefault();
    const name = $('nick').value.trim();
    if (!name) { toast('닉네임을 입력해 주세요'); $('nick').focus(); return; }
    save.name = name.slice(0, 12);
    if (m.value && d.value) {
      const id = zodiacOf(+m.value, +d.value);
      save.birthday = [+m.value, +d.value];
      save.cons[id] = Object.assign(save.cons[id] || newCon(0), { g: 4 });
      save.team = [id, ...save.team.filter(x => x !== id)].slice(0, PLANET[save.mainPlanet].slots);
    }
    save.lastCollect = Date.now(); persist();
    enterHome();
    if (save.birthday) { const id = save.team[0]; setTimeout(() => showGachaResult([{ id, g: 4, res: 'new' }], '탄생 별자리 지급'), 350); }
  });
  $('titleTap').addEventListener('click', () => enterHome());
})();

/* ---------- Screen switching ---------- */
const TABS = ['store', 'planets', 'home', 'stars', 'team'];
let tab = 'home';
function setScreen(which) {
  $('title').hidden = which !== 'title';
  $('shell').hidden = which !== 'shell';
  if (which !== 'battle') showBattleUi(false);
}
function showBattleUi(on) {
  $('hudTop').hidden = !on; $('hudBot').hidden = !on;
  if (on) { $('shell').hidden = true; $('title').hidden = true; $('resultScr').hidden = true; $('pauseMenu').hidden = true; }
  else { $('lvup').hidden = true; }
}
function setTab(t) {
  tab = t;
  for (const x of TABS) { $('pane-' + x).hidden = x !== t; }
  document.querySelectorAll('.nav button').forEach(b => b.setAttribute('aria-current', b.dataset.tab === t ? 'page' : 'false'));
  $('shell').classList.toggle('see-through', t === 'home');
  ({ store: renderStore, planets: renderPlanets, home: renderHome, stars: renderStars, team: renderTeam })[t]();
}
document.querySelector('.nav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) setTab(b.dataset.tab); });

function renderTopBar() {
  $('tbLv').textContent = save.lv;
  $('tbName').textContent = save.name || '게스트';
  $('tbTitle').textContent = save.title;
  $('tbDust').textContent = fmt(save.dust);
  $('tbPiece').textContent = fmt(save.piece);
  $('tbXp').style.transform = `scaleX(${clamp(save.xp / accNeed(save.lv), 0, 1)})`;
}
$('gearBtn').addEventListener('click', openSettings);

/* ---------- Lobby (화면설계서 5–10p) ---------- */
const HOME = { sys: null, rocks: [], shots: [], spawn: 0 };
function enterHome() {
  G.state = 'home'; G.me = null; G.foe = null; G.zone = ZONES[1]; G.shield = 0; G.pShield = 0;
  G.fx = []; G.texts = []; G.proj = []; G.beams = []; $('banner').classList.remove('show');
  const P = makePlayerPlanet(save.mainPlanet, save.planets[save.mainPlanet].lv);
  HOME.sys = makeSystem('me', P, save.team.map(makeMyCon)); HOME.rocks = []; HOME.shots = [];
  setScreen('shell'); renderTopBar(); setTab(tab); layoutHome();
}
function layoutHome() {
  const s = HOME.sys; if (!s) return;
  const top = 70, bot = 370, band = Math.max(180, H - top - bot);
  s.cx = W / 2; s.cy = top + band * .5; s.R = Math.min(W * .36, band * .5); s.ry = s.R * .42; s.pr = s.R * .26;
}
function pendingIncome() {
  const hrs = Math.min(INCOME.capHours, (Date.now() - save.lastCollect) / 3600000);
  return { dust: Math.floor(hrs * INCOME.dust(save.lv)), piece: Math.floor(hrs * INCOME.piece()), hrs };
}
function renderHome() {
  const inc = pendingIncome();
  $('incDust').textContent = '+' + fmt(inc.dust);
  $('incPiece').textContent = '+' + fmt(inc.piece);
  $('incRate').textContent = `시간당 Star Dust ${INCOME.dust(save.lv)} · Star Piece ${INCOME.piece()} · 최대 ${INCOME.capHours}시간`;
  $('collectBtn').disabled = inc.dust < 1 && inc.piece < 1;
  const chests = Math.floor(save.chest / CHEST_STEP);
  $('chestFill').style.transform = `scaleX(${(save.chest % CHEST_STEP) / CHEST_STEP})`;
  $('chestTxt').textContent = `${save.chest % CHEST_STEP} / ${CHEST_STEP}`;
  $('chestBtn').textContent = chests ? `상자 열기 ×${chests}` : '상자 없음';
  $('chestBtn').disabled = chests === 0;
  $('homeBest').textContent = save.best ? `최고 WAVE ${save.best} · ${zoneOf(save.best).name}` : '기록 없음';
  $('homePvp').textContent = `${save.wins}승 ${save.losses}패`;
  $('homePower').textContent = fmt(teamPower());
}
$('collectBtn').addEventListener('click', () => {
  const inc = pendingIncome();
  save.dust += inc.dust; save.piece += inc.piece;
  save.lastCollect = Date.now(); persist(); renderTopBar(); renderHome();
  toast(`Star Dust ${fmt(inc.dust)} · Star Piece ${fmt(inc.piece)} 수령`);
});
$('chestBtn').addEventListener('click', () => {
  const n = Math.floor(save.chest / CHEST_STEP); if (!n) return;
  save.chest -= n * CHEST_STEP;
  const got = []; let dust = 0, piece = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    if (r < .6) dust += Math.round(rnd(800, 1500));
    else if (r < .85) piece += Math.round(rnd(20, 50));
    else got.push(rollCon(GACHA.gold.w, false));
  }
  save.dust += dust; save.piece += piece; persist(); renderTopBar(); renderHome();
  showGachaResult(got, `상자 ${n}개`, [dust && `Star Dust +${fmt(dust)}`, piece && `Star Piece +${fmt(piece)}`].filter(Boolean));
});
$('arcadeBtn').addEventListener('click', () => { if (checkTeam()) startRun('arcade'); });
$('pvpBtn').addEventListener('click', () => { if (checkTeam()) startRun('pvp'); });
function checkTeam() { if (!save.team.length) { toast('팀 탭에서 별자리를 1개 이상 편성해 주세요'); setTab('team'); return false; } return true; }

function updateHome(dt) {
  const s = HOME.sys; if (!s) return;
  updateSystem(s, dt);
  HOME.spawn -= dt;
  if (HOME.spawn <= 0) { // 소행성 요격 연출
    HOME.spawn = rnd(.7, 1.4);
    const x = rnd(W * .1, W * .9), pts = Array.from({ length: 7 }, (_, i) => [Math.cos(i / 7 * TAU) * rnd(.7, 1), Math.sin(i / 7 * TAU) * rnd(.7, 1)]);
    HOME.rocks.push({ x, y: -20, vx: (s.cx - x) * .12, vy: rnd(28, 46), r: rnd(6, 13), rot: 0, vr: rnd(-1, 1), pts, hp: 1 });
  }
  for (const c of s.cons) {
    c.cd -= dt * c.rate * .6;
    if (c.cd <= 0) {
      c.cd = 1;
      const t = HOME.rocks.filter(r => r.hp > 0 && r.y > 20).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
      if (t) HOME.shots.push({ x: c.x, y: c.y, t, col: c.def.special ? '#d58bff' : '#ffd76a' });
    }
  }
  for (let i = HOME.shots.length - 1; i >= 0; i--) {
    const p = HOME.shots[i], dx = p.t.x - p.x, dy = p.t.y - p.y, d = Math.hypot(dx, dy);
    if (p.t.hp <= 0) { HOME.shots.splice(i, 1); continue; }
    if (d < 10) { p.t.hp = 0; burst(p.t.x, p.t.y, 12, '#c9b89a'); HOME.shots.splice(i, 1); continue; }
    p.vx = dx / d; p.vy = dy / d; p.x += p.vx * 480 * dt; p.y += p.vy * 480 * dt;
  }
  HOME.rocks = HOME.rocks.filter(r => { r.x += r.vx * dt * .2; r.y += r.vy * dt; r.rot += r.vr * dt; return r.hp > 0 && r.y < H + 30; });
  for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t -= dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.t <= 0) G.fx.splice(i, 1); }
}
function drawHome(t) {
  drawBg(t);
  const s = HOME.sys; if (!s) return;
  for (const r of HOME.rocks) {
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
    ctx.fillStyle = '#6f6678'; ctx.strokeStyle = '#a99fb5'; ctx.lineWidth = 1;
    ctx.beginPath(); r.pts.forEach(([px, py], i) => i ? ctx.lineTo(px * r.r, py * r.r) : ctx.moveTo(px * r.r, py * r.r)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  drawSystem(s, t);
  for (const p of HOME.shots) { ctx.strokeStyle = p.col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(p.x - (p.vx || 0) * 10, p.y - (p.vy || 0) * 10); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  for (const f of G.fx) { ctx.globalAlpha = clamp(f.t * 1.6, 0, 1); ctx.fillStyle = f.c; ctx.fillRect(f.x - 1.2, f.y - 1.2, 2.4, 2.4); }
  ctx.globalAlpha = 1;
}

/* ---------- Gacha / constellation rewards ---------- */
function rollGrade(w) {
  const sum = w.reduce((a, b) => a + b, 0); let r = Math.random() * sum;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; }
  return w.length - 1;
}
// Grants a constellation card: new → owned, higher grade → upgrade, otherwise converts to Star Dust
function rollCon(w, allowSpecial) {
  const pool = allowSpecial ? ALL_CONS : ZODIAC;
  const id = pool[Math.floor(Math.random() * pool.length)].id, g = rollGrade(w);
  return grantCon(id, g);
}
function grantCon(id, g) {
  const o = save.cons[id];
  let res;
  if (!o) { save.cons[id] = newCon(g); res = 'new'; }
  else if (g > o.g) { o.g = g; res = 'up'; }
  else { const d = 400 * (g + 1); save.dust += d; res = 'dup'; return { id, g, res, dust: d }; }
  return { id, g, res };
}
function showGachaResult(list, title, extra = []) {
  persist(); renderTopBar();
  const label = r => r.res === 'new' ? '<em class="new">NEW</em>' : r.res === 'up' ? '<em class="up">등급 상승</em>' : `<em>Star Dust +${fmt(r.dust)}</em>`;
  openModal(`<h3>${title}</h3>
    ${extra.length ? `<p class="mtxt">${extra.join(' · ')}</p>` : ''}
    ${list.length ? `<div class="gres">${list.map((r, i) => `
      <div class="gcard" style="--g:${GRADES[r.g].col};animation-delay:${i * 70}ms">
        ${conSvg(r.id, 64)}<b>${CON[r.id].name}</b>${gradeChip(r.g)}${label(r)}
      </div>`).join('')}</div>` : ''}
    <div class="mbtns"><button class="cta sm" data-act="ok" type="button">확인</button></div>`, () => { closeModal(); if (tab !== 'home') setTab(tab); else renderHome(); });
}
function conSvg(id, size, opts = {}) {
  const d = CON[id], sh = d.sh;
  const P = sh.pts.map(([x, y]) => [x * 40, y * 34]);
  const lines = sh.edges.map(([a, b]) => `<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[b][0]}" y2="${P[b][1]}"/>`).join('');
  const dots = P.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2"/>`).join('');
  return `<svg class="csvg${opts.dim ? ' dim' : ''}" viewBox="-50 -44 100 88" width="${size}" height="${Math.round(size * .88)}" aria-hidden="true"><g class="ln">${lines}</g><g class="dt">${dots}</g></svg>`;
}

/* ---------- 상점 (Store) ---------- */
function renderStore() {
  const odds = w => w.map((v, i) => v ? `${GRADES[i].name} ${v}%` : '').filter(Boolean).join(' · ');
  $('pane-store').innerHTML = `
    <section class="banner-card">
      <div class="bc-art">${conSvg('oph', 110)}</div>
      <div class="bc-txt">
        <span class="eyebrow">LIMITED PACKAGE</span>
        <h3>특수 별자리 패키지</h3>
        <p>뱀주인자리 (에픽) 확정 + Star Piece 500</p>
        <button class="cta sm" data-buy="pkg" type="button">₩9,900</button>
      </div>
    </section>
    <div class="grid2">
      ${['gold', 'paid'].map(k => { const g = GACHA[k]; return `
        <section class="shop-card">
          <h3>${g.name}</h3>
          <p class="mini">${k === 'paid' ? '레어 이상 확정 · 뱀주인자리 포함' : '12궁 별자리 카드'}</p>
          <button class="buy" data-gacha="${k}" data-n="1" type="button"><span>1회</span><b class="${g.cur}">${fmt(g.cost)}</b></button>
          <button class="buy" data-gacha="${k}" data-n="10" type="button"><span>10회</span><b class="${g.cur}">${fmt(g.cost10)}</b></button>
        </section>`; }).join('')}
    </div>
    <section class="shop-card row-card">
      <div><h3>광고 제거</h3><p class="mini">${save.adsRemoved ? '적용됨' : '보상형 광고를 제외한 모든 광고 제거'}</p></div>
      <button class="buy fit" data-buy="ads" type="button" ${save.adsRemoved ? 'disabled' : ''}>${save.adsRemoved ? '구매 완료' : '₩5,500'}</button>
    </section>
    <section class="sec">
      <div class="sec-h"><h2>Star Piece 충전</h2></div>
      <div class="grid3">
        ${[[100, '₩1,200'], [550, '₩5,900'], [1200, '₩11,000']].map(([n, p]) => `
          <button class="piece-pack" data-buy="piece" data-n="${n}" type="button"><b class="piece">${fmt(n)}</b><span>${p}</span></button>`).join('')}
      </div>
    </section>
    <p class="fine">확률 안내 · 골드 뽑기: ${odds(GACHA.gold.w)}<br>유료 뽑기: ${odds(GACHA.paid.w)}<br>이미 가진 별자리는 더 높은 등급이면 등급이 오르고, 아니면 Star Dust로 바뀌어요.<br>프로토타입이라 실제 결제는 일어나지 않고 바로 지급돼요.</p>`;
}
$('pane-store').addEventListener('click', e => {
  const g = e.target.closest('[data-gacha]');
  if (g) {
    const k = g.dataset.gacha, n = +g.dataset.n, def = GACHA[k];
    if (!spend(def.cur, n === 10 ? def.cost10 : def.cost)) return;
    const list = Array.from({ length: n }, () => rollCon(def.w, k === 'paid'));
    showGachaResult(list, `${def.name} ${n}회`);
    return;
  }
  const b = e.target.closest('[data-buy]'); if (!b) return;
  const k = b.dataset.buy;
  if (k === 'pkg') { const r = grantCon('oph', 4); save.piece += 500; showGachaResult([r], '특수 별자리 패키지', ['Star Piece +500', '테스트 지급']); }
  else if (k === 'ads') { save.adsRemoved = true; persist(); toast('광고 제거를 적용했어요 (테스트 지급)'); renderStore(); }
  else if (k === 'piece') { gain('piece', +b.dataset.n); toast(`Star Piece ${fmt(+b.dataset.n)} 지급 (테스트)`); }
});

/* ---------- 행성 (Planets) ---------- */
let planetSel = null;
function renderPlanets() {
  planetSel = planetSel || save.mainPlanet;
  const d = PLANET[planetSel], own = save.planets[planetSel];
  const lv = own ? own.lv : 1;
  $('pane-planets').innerHTML = `
    <section class="planet-hero">
      <span class="orb xl" style="${orbStyle(planetSel)}"></span>
      <div class="ph-txt">
        <span class="eyebrow">${d.en.toUpperCase()}</span>
        <h2>${d.name} ${own ? `<small>Lv ${lv}</small>` : ''}</h2>
        <p>${d.desc}</p>
        <dl class="stats">
          <div><dt>HP</dt><dd>${fmt(d.hp * planetHpMul(lv))}</dd></div>
          <div><dt>별자리</dt><dd>${d.slots}</dd></div>
          <div><dt>상태</dt><dd>${save.mainPlanet === planetSel ? '대표' : own ? '보유' : '미보유'}</dd></div>
        </dl>
      </div>
    </section>
    <div class="actions">
      ${own ? `
        <button class="ghost" data-pact="main" type="button" ${save.mainPlanet === planetSel ? 'disabled' : ''}>${save.mainPlanet === planetSel ? '대표 행성' : '대표로 설정'}</button>
        <button class="cta sm" data-pact="up" type="button" ${lv >= PLANET_MAX_LV ? 'disabled' : ''}>${lv >= PLANET_MAX_LV ? 'MAX' : `강화 <b class="dust">${fmt(planetUpCost(lv))}</b>`}</button>`
      : `<button class="cta sm wide" data-pact="unlock" type="button">해금 <b class="piece">${fmt(d.unlock)}</b></button>`}
    </div>
    <p class="fine">강화할 때마다 행성 HP +8% (최대 Lv ${PLANET_MAX_LV})</p>
    <div class="planet-grid">
      ${PLANETS.map(p => `
        <button class="pcell" type="button" data-pid="${p.id}" aria-pressed="${p.id === planetSel}">
          <span class="orb" style="${orbStyle(p.id)}${save.planets[p.id] ? '' : ';filter:grayscale(.85) brightness(.55)'}"></span>
          <span class="pn">${p.name}</span>
          <span class="pl">${save.planets[p.id] ? 'Lv ' + save.planets[p.id].lv : '미보유'}</span>
          ${save.mainPlanet === p.id ? '<span class="tag">대표</span>' : ''}
        </button>`).join('')}
    </div>`;
}
$('pane-planets').addEventListener('click', e => {
  const c = e.target.closest('[data-pid]'); if (c) { planetSel = c.dataset.pid; renderPlanets(); return; }
  const a = e.target.closest('[data-pact]'); if (!a) return;
  const d = PLANET[planetSel];
  if (a.dataset.pact === 'unlock') { if (spend('piece', d.unlock)) { save.planets[planetSel] = { lv: 1 }; persist(); toast(`${d.name} 해금`); renderPlanets(); } }
  else if (a.dataset.pact === 'up') { const o = save.planets[planetSel]; if (spend('dust', planetUpCost(o.lv))) { o.lv += 1; persist(); toast(`${d.name} Lv ${o.lv}`); renderPlanets(); } }
  else if (a.dataset.pact === 'main') {
    save.mainPlanet = planetSel;
    if (save.team.length > d.slots) save.team = save.team.slice(0, d.slots);
    persist(); toast(`대표 행성을 ${d.name}(으)로 바꿨어요`); renderPlanets(); enterHome(); setTab('planets');
  }
});

/* ---------- 별자리 (Stars) — 컨셉 이미지 23·24 ---------- */
let starSel = null, slotSel = null;
function renderStars() {
  const owned = ALL_CONS.filter(c => save.cons[c.id]);
  if (!starSel || !CON[starSel]) starSel = (owned[0] || ALL_CONS[0]).id;
  const d = CON[starSel], o = save.cons[starSel];
  if (slotSel == null || slotSel >= d.sh.pts.length) slotSel = d.sh.key;
  const b = conBonus(starSel);
  const strip = ALL_CONS.map(c => {
    const oc = save.cons[c.id];
    return `<button class="scard" type="button" data-sid="${c.id}" aria-pressed="${c.id === starSel}" style="--g:${oc ? GRADES[oc.g].col : '#3a4270'}">
      ${conSvg(c.id, 46, { dim: !oc })}<span>${c.en.slice(0, 7).toUpperCase()}</span></button>`;
  }).join('');
  const sw = 300, P = d.sh.pts.map(([x, y]) => [x * 120, y * 100]);
  const slotsSvg = P.map(([x, y], i) => {
    const t = slotType(d, i), s = o && o.slots[i], open = s && s.open, part = s && s.part;
    return `<g class="slot${i === slotSel ? ' sel' : ''}${open ? '' : ' closed'}" data-slot="${i}" style="--c:${SLOT[t].col}">
      <circle class="hit" cx="${x}" cy="${y}" r="22"/>
      <circle class="ring" cx="${x}" cy="${y}" r="${i === d.sh.key ? 15 : 12}"/>
      <circle class="core" cx="${x}" cy="${y}" r="4.5" ${part ? `style="fill:${GRADES[part.g].col}"` : ''}/>
      ${part ? `<text x="${x + 13}" y="${y - 11}">+${part.en}</text>` : ''}
    </g>`;
  }).join('');
  $('pane-stars').innerHTML = `
    <div class="strip">${strip}</div>
    <section class="star-stage">
      <svg class="graph" viewBox="${-sw / 2} -125 ${sw} 250" role="img" aria-label="${d.name}자리 별 슬롯">
        <g class="ln">${d.sh.edges.map(([a, c]) => `<line x1="${P[a][0]}" y1="${P[a][1]}" x2="${P[c][0]}" y2="${P[c][1]}"/>`).join('')}</g>
        ${slotsSvg}
      </svg>
      <div class="sname"><b>${d.name}자리</b> ${o ? gradeChip(o.g) : '<span class="gchip" style="--g:#59608a">미보유</span>'}</div>
    </section>
    <div class="statbar">
      <span title="공격력">⚔ ${(d.atk * b.atk).toFixed(1)}</span>
      <span title="HP">♥ ${fmt(d.hp * b.hp)}</span>
      <span title="공격속도">≫ ${(d.rate * b.rate).toFixed(2)}/s</span>
      <span class="pw">전투력 ${fmt(conPower(starSel))}</span>
    </div>
    <div class="legend"><i style="--c:${SLOT.act.col}"></i>액티브 · 공격력 <i style="--c:${SLOT.pas.col}"></i>패시브 · HP <i style="--c:${SLOT.lim.col}"></i>한정 · 공격속도</div>
    <section class="slot-panel" id="slotPanel">${o ? slotPanel(d, o) : `
      <p class="mtxt">아직 없는 별자리예요. 상점 뽑기나 로비 상자에서 얻을 수 있어요.</p>
      <button class="cta sm" data-sact="store" type="button">상점으로</button>`}</section>`;
}
function slotPanel(d, o) {
  const i = slotSel, t = slotType(d, i), S = SLOT[t], s = o.slots[i];
  if (!s || !s.open) return `
    <div class="locked" style="--c:${S.col}">
      <span class="lk-name">${S.name}</span><span class="mini">${S.label} 슬롯 · 파츠 효과: ${S.stat}</span>
      <button class="buy fit" data-sact="open" type="button">열기 <b class="${S.cur}">${fmt(S.cost)}</b></button>
    </div>`;
  if (!s.part) return `
    <div class="locked" style="--c:${S.col}">
      <span class="lk-name">빈 ${S.name}</span><span class="mini">파츠를 소환하면 ${S.stat}이 올라가요</span>
      <button class="cta sm" data-sact="summon" type="button">별자리 파츠 소환 <b class="dust">${fmt(SUMMON_COST)}</b></button>
    </div>`;
  const p = s.part, gc = GRADES[p.g].col, max = p.en >= PART_MAX_EN, top = max && p.g >= GRADES.length - 1;
  return `
    <div class="part">
      <div class="p-info">
        <span class="p-grade" style="color:${gc}">${GRADES[p.g].name}</span>
        <span class="p-stat">${S.stat} <b>+${partValue(p).toFixed(1)}%</b></span>
        <span class="mini">${max ? (top ? '최고 등급 · 최대 강화' : '최대 강화 · 승급 가능') : `다음 강화 성공률 ${Math.round(enhanceRate(p.en) * 100)}%`}</span>
      </div>
      <div class="gem${max ? ' max' : ''}" style="--g:${gc}"><i></i><span class="en">+${p.en}</span></div>
      <div class="p-btns">
        ${top ? '<button class="ghost" type="button" disabled>MAX</button>'
          : max ? `<button class="cta sm" data-sact="promote" type="button">승급 <b class="piece">${fmt(promoteCost(p))}</b></button>`
          : `<button class="cta sm" data-sact="enhance" type="button">강화 <b class="dust">${fmt(enhanceCost(p))}</b></button>`}
        <button class="ghost sm" data-sact="resummon" type="button">↻ 재소환 <b class="dust">${fmt(RESUMMON_COST)}</b></button>
      </div>
    </div>`;
}
$('pane-stars').addEventListener('click', e => {
  const c = e.target.closest('[data-sid]'); if (c) { starSel = c.dataset.sid; slotSel = null; renderStars(); return; }
  const sl = e.target.closest('[data-slot]'); if (sl) { slotSel = +sl.dataset.slot; renderStars(); return; }
  const a = e.target.closest('[data-sact]'); if (!a) return;
  const act = a.dataset.sact;
  if (act === 'store') { setTab('store'); return; }
  const d = CON[starSel], o = save.cons[starSel], i = slotSel, S = SLOT[slotType(d, i)];
  o.slots[i] = o.slots[i] || { open: false, part: null };
  const s = o.slots[i];
  if (act === 'open') { if (spend(S.cur, S.cost)) { s.open = true; toast(`${S.name}을 열었어요`); } }
  else if (act === 'summon') { if (spend('dust', SUMMON_COST)) { s.part = { g: rollGrade(GACHA.gold.w), en: 0 }; toast(`${GRADES[s.part.g].name} 파츠 소환`); } }
  else if (act === 'resummon') {
    confirmBox('재소환', '파츠 등급을 다시 뽑고 강화 수치는 +0으로 돌아가요.', `재소환 · ${fmt(RESUMMON_COST)}`, () => {
      if (spend('dust', RESUMMON_COST)) { s.part = { g: rollGrade(GACHA.gold.w), en: 0 }; toast(`${GRADES[s.part.g].name} 파츠로 바뀌었어요`); persist(); renderStars(); }
    });
    return;
  }
  else if (act === 'enhance') {
    const p = s.part;
    if (spend('dust', enhanceCost(p))) {
      if (chance(enhanceRate(p.en))) { p.en += 1; toast(`강화 성공 · +${p.en}`); }
      else toast('강화 실패 · 수치는 유지돼요');
    }
  }
  else if (act === 'promote') { const p = s.part; if (spend('piece', promoteCost(p))) { p.g += 1; p.en = 0; toast(`${GRADES[p.g].name} 등급으로 승급`); } }
  persist(); renderStars();
});

/* ---------- 팀 (Team formation) ---------- */
let teamDetail = null;
function renderTeam() {
  const pd = PLANET[save.mainPlanet], owned = ALL_CONS.filter(c => save.cons[c.id]);
  save.team = save.team.filter(id => save.cons[id]).slice(0, pd.slots);
  teamDetail = teamDetail && CON[teamDetail] ? teamDetail : (save.team[0] || owned[0].id);
  const slots = Array.from({ length: pd.slots }, (_, i) => save.team[i]);
  $('pane-team').innerHTML = `
    <section class="team-head">
      <span class="orb" style="${orbStyle(save.mainPlanet)}"></span>
      <div><b>${pd.name}</b><span class="mini">${pd.desc} · 별자리 ${pd.slots}칸</span></div>
      <button class="ghost sm" data-tact="planet" type="button">행성 변경</button>
    </section>
    <div class="team-slots">
      ${slots.map((id, i) => id ? `
        <button class="tslot" type="button" data-tid="${id}" style="--g:${GRADES[save.cons[id].g].col}">
          ${conSvg(id, 48)}<b>${CON[id].name}</b><span class="mini">${fmt(conPower(id))}</span></button>`
        : `<div class="tslot empty"><span class="mini">빈 칸 ${i + 1}</span></div>`).join('')}
    </div>
    <p class="fine">전투력 합계 <b>${fmt(teamPower())}</b> · 아래 보유 별자리를 눌러 넣거나 빼세요</p>
    <div class="cons">
      ${owned.map(c => { const o = save.cons[c.id]; return `
        <button class="ccard${c.special ? ' special' : ''}" type="button" data-cid="${c.id}" aria-pressed="${save.team.includes(c.id)}" style="--g:${GRADES[o.g].col}">
          <span class="cn">${c.name}</span><span class="ce">${GRADES[o.g].name}</span><span class="cst">${c.stat}</span>
        </button>`; }).join('')}
    </div>
    <div class="detail" id="conDetail"></div>`;
  renderPerkDetail(teamDetail);
}
function renderPerkDetail(id) {
  const d = CON[id], P = PERKS[id];
  $('conDetail').innerHTML = `
    <h3>${d.name}자리 <small>${d.en.toUpperCase()}</small></h3>
    <div class="sig">${d.sig} 아케이드에서 레벨업할 때 아래 능력이 카드로 나와요.</div>
    <ul class="chain">
      ${P.stats.map(([k, n]) => `<li><span class="tier stat">×3</span><div><b>${n}</b><span>${STAT[k].txt(STAT[k].v)} · 최대 3번 중첩</span></div></li>`).join('')}
      ${P.chain.map(([n, t], i) => `<li><span class="tier">${ROMAN[i + 1]}</span><div><b>각성 ${ROMAN[i + 1]} · ${n}</b><span>${t}</span></div></li>`).join('')}
    </ul>`;
}
$('pane-team').addEventListener('click', e => {
  if (e.target.closest('[data-tact="planet"]')) { planetSel = save.mainPlanet; setTab('planets'); return; }
  const t = e.target.closest('[data-tid]'); if (t) { save.team = save.team.filter(x => x !== t.dataset.tid); teamDetail = t.dataset.tid; persist(); renderTeam(); return; }
  const c = e.target.closest('[data-cid]'); if (!c) return;
  const id = c.dataset.cid, slots = PLANET[save.mainPlanet].slots;
  teamDetail = id;
  if (save.team.includes(id)) save.team = save.team.filter(x => x !== id);
  else if (save.team.length < slots) save.team.push(id);
  else { toast(`${PLANET[save.mainPlanet].name}에는 별자리를 ${slots}개까지 넣을 수 있어요`); renderPerkDetail(id); return; }
  persist(); renderTeam(); enterHomeSystemOnly();
});
function enterHomeSystemOnly() { // refresh the orbiting lobby system after formation changes
  const P = makePlayerPlanet(save.mainPlanet, save.planets[save.mainPlanet].lv);
  HOME.sys = makeSystem('me', P, save.team.map(makeMyCon)); layoutHome();
}

/* ---------- 설정 (필요 화면 시트: 설정) ---------- */
function openSettings() {
  const st = save.settings;
  const tg = (k, label, sub) => `<label class="set-row"><span>${label}${sub ? `<small>${sub}</small>` : ''}</span>
    <input type="checkbox" class="switch" id="set-${k}" data-set="${k}" ${st[k] ? 'checked' : ''}></label>`;
  openModal(`
    <h3>설정</h3>
    <div class="set-group"><span class="set-h">게임 설정</span>
      ${tg('glow', '광원 효과', '끄면 글로우와 성운이 사라져 가벼워져요')}
      <div class="set-row"><span>프레임 레이트</span>
        <div class="seg" role="group" aria-label="프레임 레이트">${[30, 45, 60].map(f => `<button type="button" data-fps="${f}" aria-pressed="${st.fps === f}">${f === 60 ? '무제한' : f}</button>`).join('')}</div></div>
      ${tg('sfx', '효과음')}${tg('bgm', '배경음')}
    </div>
    <div class="set-group"><span class="set-h">계정</span>
      ${tg('push', '알림')}
      <div class="set-row"><span>닉네임</span><button class="ghost sm" data-act="rename" type="button">${save.name || '게스트'} · 변경</button></div>
      <div class="set-row"><span>연동된 SNS<small>게스트 계정</small></span><button class="ghost sm" data-act="soon" type="button">SNS 연동</button></div>
      <div class="set-row"><span>회원가입 전환</span><button class="ghost sm" data-act="soon" type="button">전환</button></div>
    </div>
    <div class="set-group"><span class="set-h">서비스 이용</span>
      <div class="links">
        <button type="button" data-act="soon">플레이 방법</button><button type="button" data-act="restore">구매 복원</button>
        <button type="button" data-act="soon">리뷰 남기기</button><button type="button" data-act="mail">문의하기</button>
        <button type="button" data-act="soon">이용약관</button><button type="button" data-act="reset" class="danger">서비스 탈퇴</button>
      </div>
    </div>
    <div class="mbtns"><button class="cta sm" data-act="close" type="button">닫기</button></div>`,
  (act, el) => {
    if (act === 'close') closeModal();
    else if (act === 'soon') toast('정식 버전에서 열려요');
    else if (act === 'restore') toast('복원할 구매 내역이 없어요');
    else if (act === 'mail') toast('문의: support@galaxywar.example');
    else if (act === 'rename') {
      openModal(`<h3>닉네임 변경</h3><form id="renameForm" class="rename"><input id="renameInput" maxlength="12" value="${save.name}" aria-label="닉네임"><button class="cta sm" type="submit">저장</button></form>`);
      $('renameForm').onsubmit = ev => { ev.preventDefault(); const v = $('renameInput').value.trim(); if (v) { save.name = v; persist(); renderTopBar(); } closeModal(); };
    }
    else if (act === 'reset') confirmBox('서비스 탈퇴', '이 기기의 진행 데이터를 모두 지우고 처음부터 시작해요. 되돌릴 수 없어요.', '모두 지우기', () => {
      try { localStorage.removeItem(SAVE_KEY); } catch {}
      save = freshSave(); tab = 'home'; showTitle();
    });
  });
  $('modalBody').addEventListener('change', e => {
    const k = e.target.dataset && e.target.dataset.set; if (!k) return;
    save.settings[k] = e.target.checked; persist();
  });
  $('modalBody').querySelectorAll('[data-fps]').forEach(b => b.addEventListener('click', () => {
    save.settings.fps = +b.dataset.fps; persist();
    $('modalBody').querySelectorAll('[data-fps]').forEach(x => x.setAttribute('aria-pressed', x === b));
  }));
}

/* ---------- Battle end → rewards → lobby ---------- */
function finishBattle(win) {
  const arcade = G.mode === 'arcade';
  let dust, chest, xp;
  if (arcade) { dust = 120 * G.wave + 20 * G.kills; chest = G.wave >= 5 ? 3 : 1; xp = 12 * G.wave; save.best = Math.max(save.best, G.wave); }
  else { dust = win ? 600 : 180; chest = win ? 3 : 1; xp = win ? 40 : 15; win ? save.wins++ : save.losses++; }
  save.dust += dust; save.chest = Math.min(CHEST_MAX, save.chest + chest);
  const up = gainAccXp(xp);
  persist();
  $('resEyebrow').textContent = arcade ? 'PLANET DESTROYED' : win ? 'VICTORY' : 'DEFEAT';
  $('resEyebrow').style.color = !arcade && win ? 'var(--gold)' : 'var(--act)';
  $('resWave').textContent = arcade ? `WAVE ${G.wave}` : win ? '승리' : '패배';
  $('resTxt').textContent = arcade
    ? `${G.me.planet.name} 행성계가 ${G.zone.name} ${G.wave}웨이브에서 무너졌어요. 전투 Lv ${G.lv}까지 성장했어요. 최고 기록 WAVE ${save.best}.`
    : `${G.ghost.name}의 ${G.ghost.planet} 행성계와 싸웠어요. 전적 ${save.wins}승 ${save.losses}패.`;
  $('resRewards').innerHTML = [`<span class="dust">+${fmt(dust)}</span>`, `<span>상자 게이지 +${chest}</span>`, `<span>계정 경험치 +${xp}</span>`, up ? `<span class="lvup-tag">계정 Lv ${save.lv}</span>` : ''].join('');
  $('resPerks').innerHTML = arcade ? G.taken.map(t => `<span>${t}</span>`).join('') : '';
  $('retryBtn').textContent = arcade ? '다시 출항' : '다른 상대와 대전';
  $('hudTop').hidden = true; $('hudBot').hidden = true; $('lvup').hidden = true; $('resultScr').hidden = false;
}
$('retryBtn').addEventListener('click', () => { $('resultScr').hidden = true; startRun(G.mode); });
$('lobbyBtn').addEventListener('click', () => { $('resultScr').hidden = true; enterHome(); });

/* ---------- Pause menu ---------- */
function setPaused(p) { G.paused = p; $('pauseMenu').hidden = !p; }
$('pauseBtn').addEventListener('click', () => setPaused(true));
$('resumeBtn').addEventListener('click', () => setPaused(false));
$('quitBtn').addEventListener('click', () => {
  setPaused(false);
  if (G.state === 'fight' || G.state === 'clear') { G.state = 'over'; finishBattle(false); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && G.state === 'fight' && !G.choosing) setPaused(true); });

/* ---------- Loop ---------- */
let last = performance.now(), lastDraw = 0, incT = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const fps = save.settings.fps;
  if (fps < 60 && now - lastDraw < 1000 / fps - 2) { requestAnimationFrame(frame); return; }
  const ddt = Math.min(.05, (now - (lastDraw || now)) / 1000) || dt; lastDraw = now;
  if (G.state === 'home') {
    updateHome(ddt); drawHome(now / 1000);
    incT += ddt; if (incT > 1 && tab === 'home') { incT = 0; renderHome(); }
  } else if (G.state === 'title') { drawBg(now / 1000); }
  else {
    if (!G.paused && !G.choosing) update(ddt);
    draw(now / 1000); hud();
  }
  requestAnimationFrame(frame);
}

window.__gw = G; window.__save = () => save; // test handles
resize();
showTitle();
requestAnimationFrame(frame);
