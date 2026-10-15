'use strict';
/* ---------- 로그라이크 런 요소 (아케이드) ----------
   패시브 카드 · 스킬 진화 · 다시 뽑기 · 자동 선택 · 엘리트 외계선과 룰렛 상자 · 경험치 별가루 ·
   보급 캡슐 · 운석 폭풍 · 보급 선택 · 부활 · 보스 패턴 (레이저 · 호위선 소환) · 저주 · 챕터 / 일일 도전 /
   보스 러시 / 이벤트 보스. 숫자는 data.js (PASSIVE · EVOLVE · RUN · CURSES · CHAPTERS · DAILY · RUSH · RAID).
   Loaded after skills.js; app.js and meta.js are loaded later but only called at run time. */

// 출항 준비 (meta.js)에서 고른 모드: kind = endless · chapter · daily · rush · raid
const VAR = { kind: 'endless', curses: [], ch: 1 };
const curseOn = id => G.mode === 'arcade' && !!G.variant && G.variant.curses.includes(id);
const labLv = id => ((save.lab && save.lab[id]) | 0);
const labV = id => { const L = LAB.find(x => x.id === id); return L ? L.v * labLv(id) : 0; };
const pasLv = k => ((G.pas && G.pas[k]) | 0);
const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const weekNo = () => Math.floor((Date.now() + 9 * 3600000 + 3 * 86400000) / (7 * 86400000)); // 월요일 0시 (한국 시간) 기준
// 일일 도전: 날짜로 정해지는 오늘의 저주 (모두 같은 조건)
function dailyCurses(day = kstDay()) {
  let h = 0; for (const ch of day) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const ids = CURSES.map(c => c.id), out = [];
  while (out.length < Math.min(DAILY.curses, ids.length)) { h = (h * 1103515245 + 12345) >>> 0; out.push(ids.splice(h % ids.length, 1)[0]); }
  return out;
}
// 이벤트 보스: 매주 바뀌는 보스 (구역 중간 보스 · 구역 보스 순서)
const RAID_BOSSES = ZONES.flatMap(z => [z.mid, z.boss]);
const raidBoss = () => RAID_BOSSES[weekNo() % RAID_BOSSES.length];

/* ---------- Run start (battle.js startRun) ---------- */
function runStart(mode) {
  const arc = mode === 'arcade';
  G.variant = arc ? { kind: VAR.kind, ch: VAR.ch, curses: VAR.kind === 'endless' ? [...VAR.curses] : [] } : { kind: 'pvp', curses: [] };
  Object.assign(G, { pas: {}, evos: {}, orbs: [], caps: [], capT: rnd(...RUN.capsuleEvery), bonusDust: 0, hitstop: 0, revived: 0, revives: 0, rerolls: 0,
    runStats: { elites: 0, bosses: 0, evos: 0 }, laser: null, chestQ: 0, supplyQ: false, chapterEnd: 0, raidDmg: 0, newBest: false });
  if (!arc) return;
  const v = G.variant, P = G.me.planet;
  if (v.kind === 'daily') v.curses = dailyCurses();
  // 연구소 (영구 강화)
  P.atkMul *= 1 + labV('atk'); P.rateMul *= 1 + labV('rate');
  const add = Math.round(P.baseHp * labV('hp')); P.maxHp += add; P.hp += add;
  G.energy = Math.min(G.maxEnergy, G.energy + labV('energy'));
  G.rerolls = RUN.rerolls + labV('reroll');
  G.revives = v.kind === 'raid' ? 0 : RUN.revives + labV('revive');
  G.pendingLv += labV('startLv'); G.lv += labV('startLv');
  if (v.kind === 'chapter') {
    const C = CHAPTERS[v.ch - 1]; G.wave = C.from; G.chapterEnd = C.from + C.waves - 1;
    autoLevels(C.startLv); // 뒤 챕터는 그만큼 성장한 채로 시작해요 (자동으로 골라요)
  }
  if (v.kind === 'rush') G.wave = RUSH.step;
  if (v.kind === 'raid') { G.wave = Math.max(RUSH.step, Math.ceil(Math.max(save.best || 0, 5) / 5) * 5); autoLevels(Math.floor(G.wave / 2)); }
}
function autoLevels(n) {
  for (let i = 0; i < n; i++) { G.lv += 1; const o = autoChoose(perkOptions()); if (o) applyPerk(o, true); }
}
const modeName = () => {
  const v = G.variant || VAR;
  return v.kind === 'chapter' ? `챕터 ${v.ch}` : v.kind === 'daily' ? '일일 도전' : v.kind === 'rush' ? '보스 러시' : v.kind === 'raid' ? '이벤트 보스' : '끝없는 항해';
};

/* ---------- 패시브 · 진화 카드 (battle.js perkOptions / perkCard / applyPerk) ---------- */
function passiveOptions() {
  if (G.mode !== 'arcade') return [];
  return Object.entries(PASSIVE).filter(([k, p]) => pasLv(k) < p.max)
    .map(([k, p]) => ({ type: 'passive', k, lvl: pasLv(k) + 1, name: p.name, desc: p.txt(p.v) + (p.evo ? `<small class="evo-hint">최대 Lv: ${SKILL_CATS[p.evo].name} 스킬 진화</small>` : '') }));
}
function evoOptions() {
  if (G.mode !== 'arcade') return [];
  const out = [];
  for (const [k, p] of Object.entries(PASSIVE)) {
    if (!p.evo || pasLv(k) < p.max) continue;
    SK.list.forEach((s, i) => {
      if (!s || s.evo || G.evos[i] || (GSKILL[s.type] || {}).cat !== p.evo) return;
      out.push({ type: 'evo', i, k, lvl: 1, name: EVOLVE.prefix + s.name, desc: `<em>${s.name}</em> 위력 <b>×${EVOLVE.mul}</b>${s.dur ? ` · 지속 ×${EVOLVE.durMul}` : ''} · 기력 <b>-${EVOLVE.costCut}</b>` });
    });
  }
  return out;
}
const PAS_ICON = { // 패시브 카드 그림 (작은 SVG)
  atk: '<path d="M12 3l3 6 6 1-4.5 4.2L18 21l-6-3.3L6 21l1.5-6.8L3 10l6-1z"/>',
  amp: '<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4M5 5l3 3M16 16l3 3M5 19l3-3M16 8l3-3"/>',
  rate: '<path d="M4 6h10M4 12h14M4 18h10"/><path d="M16 4l4 2-4 2M18 10l4 2-4 2M16 16l4 2-4 2"/>',
  crust: '<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/>',
  crit: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1v5M12 18v5M1 12h5M18 12h5"/>',
  core: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
};
const pasSvg = ic => `<svg class="pas-ic" viewBox="0 0 24 24" aria-hidden="true">${PAS_ICON[ic] || PAS_ICON.atk}</svg>`;
function runCard(o, i) { // passive / evo cards for perkCard
  const P = PASSIVE[o.k];
  if (o.type === 'passive') {
    const stars = Array.from({ length: P.max }, (_, j) => `<i class="${j < o.lvl - 1 ? 'on' : j === o.lvl - 1 ? 'next' : ''}"></i>`).join('');
    return `<button class="ncard passive" type="button" data-i="${i}">
      <span class="nc-head">${o.name}</span>
      <span class="nc-art"><span class="nc-tag">패시브</span><span class="nc-orb">${pasSvg(P.ic)}</span></span>
      <span class="nc-desc"><span>${o.desc}</span></span>
      <span class="nc-stars five">${stars}</span>
    </button>`;
  }
  const s = SK.list[o.i];
  return `<button class="ncard evo" type="button" data-i="${i}">
    <span class="nc-head">${o.name}</span>
    <span class="nc-art"><span class="nc-tag">진화</span><span class="nc-orb"><img src="img/sk_${GSKILL[s.type].icon}.png" alt="" aria-hidden="true"></span></span>
    <span class="nc-desc"><span>${o.desc}</span></span>
    <span class="nc-stars"><i class="next"></i></span>
  </button>`;
}
function runPerk(o, quiet) { // applyPerk for passive / evo; false = not mine
  const P = G.me.planet;
  if (o.type === 'passive') {
    const p = PASSIVE[o.k]; G.pas[o.k] = pasLv(o.k) + 1;
    if (o.k === 'fire') P.atkMul *= 1 + p.v;
    else if (o.k === 'rapid') P.rateMul *= 1 + p.v;
    else if (o.k === 'lens') P.crit += p.v;
    else if (o.k === 'crust') { const add = Math.round(P.baseHp * p.v); P.maxHp += add; P.hp += add; G.T.planetRed += .02; }
    if (!quiet) G.taken.push(`${p.name} Lv${G.pas[o.k]}`);
    if (!quiet && p.evo && G.pas[o.k] === p.max) toast(`${p.name} 최대! 다음 레벨업에서 ${SKILL_CATS[p.evo].name} 스킬이 진화할 수 있어요`);
    return true;
  }
  if (o.type === 'evo') { evolveSkill(o.i); return true; }
  if (o.type === 'dust') { G.bonusDust += o.v; G.taken.push('미네랄 보급'); return true; }
  return false;
}
function evolveSkill(i) {
  const s = SK.list[i]; if (!s || s.evo) return;
  const e = { ...s, evo: true, name: EVOLVE.prefix + s.name, cost: Math.max(1, s.cost - EVOLVE.costCut) };
  if (s.type === 'stun') e.dur = +(s.dur * EVOLVE.mul).toFixed(1);
  else { e.v = +Math.min(SKILL_CAP[s.type] || 99, s.v * EVOLVE.mul).toFixed(4); if (s.dur) e.dur = +(s.dur * EVOLVE.durMul).toFixed(1); }
  SK.list[i] = e; G.evos[i] = true; G.runStats.evos += 1;
  const b = skBtns[i];
  b.querySelector('.nm').textContent = e.name; b.querySelector('.cs').textContent = `진화 · 기력 ${e.cost}`; b.classList.add('evo');
  G.taken.push(e.name); dexSee('evo:' + GSKILL[s.type].cat);
  banner('스킬 진화!', e.name, 1.6); burst(G.me.cx, G.me.cy, 50, '#ff9df0'); G.hitstop = .4;
}
// 스킬 증폭기: 게이지 스킬 위력 (skills.js castSkill)
function skPower(s) {
  const a = pasLv('amp') * PASSIVE.amp.v;
  if (!s || !a) return s;
  if (s.type === 'stun') return { ...s, dur: +(s.dur * (1 + a)).toFixed(2) };
  return { ...s, v: Math.min(SKILL_CAP[s.type] || 99, s.v * (1 + a)) };
}
// 자동 선택: 진화 → 각성 → 패시브 → 능력치 → 나머지
function autoChoose(opts) {
  const rank = o => o.type === 'evo' ? 0 : o.type === 'chain' ? 1 : o.type === 'passive' ? 2 + (o.k === 'fire' || o.k === 'crust' ? 0 : .5) : o.type === 'stat' ? 3 : 4;
  return opts.slice().sort((a, b) => rank(a) - rank(b) + (Math.random() - .5) * .1)[0];
}
const autoOn = () => !!save.settings.autoPick && passOn();
const coreProc = () => chance(pasLv('core') * PASSIVE.core.v);

/* ---------- 엘리트 · 저주 · 이벤트 (arcade.js startArcadeWave / spawnMob) ---------- */
function runWave(n, q, bossTier) {
  const v = G.variant, A = G.arc;
  A.bossCd4 = 7;
  if (v.kind === 'raid') return;
  if (n >= RUN.eliteFrom) {
    const ships = q.filter(s => SHIP_KINDS.includes(s.kind)), k = Math.min(RUN.eliteMax, 1 + Math.floor(n / 20));
    for (let i = 0; i < k && ships.length; i++) if (chance(RUN.eliteChance)) ships.splice(Math.floor(Math.random() * ships.length), 1)[0].elite = true;
  }
  if (!bossTier && n >= RUN.stormFrom && chance(RUN.stormChance)) { // 운석 폭풍: 운석이 쏟아지고 보급 캡슐이 곧 내려와요
    for (let i = 0; i < 8; i++) q.push({ at: 3 + i * .35, kind: 'meteor' });
    q.sort((a, b) => a.at - b.at); G.capT = Math.min(G.capT, 6);
    setTimeout(() => G.state === 'fight' && banner('운석 폭풍', '보급 캡슐이 곧 내려와요', 1.4), 1500);
  }
}
function runMob(m, s) {
  if (s.elite) { m.elite = true; m.hp *= RUN.eliteHp; m.r *= 1.2; m.xp *= RUN.eliteXp; m.name = '엘리트 ' + MOB[s.kind].name; }
  if (curseOn('tough')) m.hp *= 1.4;
  if (curseOn('fury') && m.atk) m.atk *= 1.3;
  if (curseOn('fast') && m.sp) m.sp *= 1.4;
  if (m.mob === 'boss' && G.variant.kind === 'raid') { m.raid = true; m.name = raidBoss().name; }
  m.hp = Math.round(m.hp);
  dexSee(m.mob === 'boss' ? 'boss:' + m.name : m.elite ? 'elite' : 'mob:' + m.mob);
}
function runKilled(m) {
  if (m.elite) {
    G.runStats.elites += 1; G.chestQ += 1; G.hitstop = .35;
    burst(m.x, m.y, 30, '#ffd76a'); say(m.x, m.y - 24, '보물 상자!', '#ffd76a', 1.2);
  }
  if (m.mob === 'boss') { G.runStats.bosses += 1; G.hitstop = .55; }
}

/* ---------- 경험치 별가루: 적이 떨어뜨리고, 잠시 뒤 행성으로 빨려 들어와요 ---------- */
function dropOrb(t, v) {
  const n = v > 20 ? 4 : v > 8 ? 2 : 1;
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), s = rnd(30, 90); G.orbs.push({ x: t.x, y: t.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, v: v / n, age: 0, big: t.elite || t.mob === 'boss' }); }
}
function updateOrbs(dt) {
  const S = G.me; if (!S || !G.orbs.length) return;
  const fast = G.state === 'clear' ? 3 : 1;
  for (let i = G.orbs.length - 1; i >= 0; i--) {
    const o = G.orbs[i]; o.age += dt * fast;
    if (o.age < RUN.orbFly) { o.x += o.vx * dt; o.y += o.vy * dt; o.vx *= .9; o.vy *= .9; continue; }
    const dx = S.cx - o.x, dy = S.cy - o.y, d = Math.hypot(dx, dy) || 1, sp = Math.min(900, 200 + (o.age - RUN.orbFly) * 900) * fast;
    if (d < S.pr * .8 + sp * dt) { G.orbs.splice(i, 1); gainXp(o.v); continue; }
    o.x += dx / d * sp * dt; o.y += dy / d * sp * dt;
  }
}
function flushOrbs() { for (const o of G.orbs || []) gainXp(o.v); if (G.orbs) G.orbs.length = 0; }

/* ---------- 보급 캡슐: 가끔 내려와요. 탭하면 회복 · 기력 · 폭탄 · 자석 중 하나 ---------- */
const CAPS = {
  heal:   { name: '수리 캡슐', c: '#5fe0a0', ch: '+' },
  energy: { name: '기력 캡슐', c: '#f5c451', ch: '⚡' },
  bomb:   { name: '폭탄 캡슐', c: '#ff7a59', ch: '✸' },
  magnet: { name: '자석 캡슐', c: '#9fd8ff', ch: 'U' },
};
function updateCaps(dt) {
  if (G.mode !== 'arcade' || G.variant.kind === 'raid') return;
  if (G.state === 'fight' && (G.capT -= dt) <= 0) {
    G.capT = rnd(...RUN.capsuleEvery);
    const kinds = Object.keys(CAPS), k = kinds[Math.floor(Math.random() * kinds.length)];
    G.caps.push({ k, x: rnd(40, W - 40), y: fieldTop() - 10, life: RUN.capsuleLife, t: 0 });
  }
  for (let i = G.caps.length - 1; i >= 0; i--) {
    const c = G.caps[i]; c.t += dt; c.life -= dt;
    c.y = Math.min(c.y + 26 * dt, fieldBot() - 30);
    if (c.life <= 0) G.caps.splice(i, 1);
  }
}
function tapCapsule(x, y) {
  const i = (G.caps || []).findIndex(c => Math.hypot(c.x - x, c.y - y) < 30);
  if (i < 0) return false;
  const c = G.caps.splice(i, 1)[0], P = G.me.planet, D = CAPS[c.k];
  burst(c.x, c.y, 20, D.c); G.rings = (G.rings || []).concat({ x: c.x, y: c.y, r: 6, t: .4, c: D.c });
  if (c.k === 'heal') heal(P, P.maxHp * .2);
  else if (c.k === 'energy') G.energy = Math.min(G.maxEnergy, G.energy + 3);
  else if (c.k === 'bomb') {
    for (const m of G.foe.cons) if (!m.dead && onField(m)) { burst(m.x, m.y, 8, '#ff7a59'); applyDamage(m, m.maxHp * (m.mob === 'boss' ? .05 : .35), 'magic', { color: '#ff7a59' }); }
    if (!REDUCED_MOTION) G.shake = SHAKE_MAX;
  } else for (const o of G.orbs) o.age = Math.max(o.age, RUN.orbFly + .6);
  say(c.x, c.y - 20, D.name, D.c, 1.2);
  return true;
}

/* ---------- 보스 패턴: 레이저 (예고선 뒤 발사) · 호위선 소환 (arcade.js bossUpdate) ---------- */
function runBoss(m, dt) {
  const A = G.arc;
  if (G.laser) {
    const L = G.laser; L.t -= dt; L.x = m.x; L.y = m.y + m.r * .4;
    if (L.t <= 0) {
      const P = G.me.planet;
      G.beams.push({ x1: L.x, y1: L.y, x2: G.me.cx, y2: G.me.cy, t: .45, t0: .45, c: '#ff4d6d', w: 9 });
      applyDamage(P, m.atk * 7, 'magic', { color: '#ff4d6d' }); if (!REDUCED_MOTION) G.shake = SHAKE_MAX;
      G.laser = null;
    }
    return;
  }
  if ((A.bossCd4 -= dt * (G.enraged ? 1.3 : 1)) > 0) return;
  A.bossCd4 = m.tier === 2 ? 7 : 9;
  const ships = G.foe.cons.filter(x => !x.dead && isShip(x)).length;
  if (ships < 6 && chance(.5)) { // 호위선 소환
    for (let i = 0; i < 4; i++) A.q.push({ at: A.t + .2 + i * .2, kind: SHIP_KINDS[(i + G.wave) % 3], row: 4, col: i, cols: 4, side: i % 2 ? 1 : -1, fromTop: true });
    A.q.sort((a, b) => a.at - b.at); A.total += 4;
    banner('호위선 소환', m.name, .9);
  } else { G.laser = { t: 1.3, x: m.x, y: m.y }; say(m.x, m.y + m.r, '레이저 충전!', '#ff4d6d', 1.2); }
}

/* ---------- Tick / draw (battle.js update / drawScene) ---------- */
function runTick(dt) {
  if (G.mode !== 'arcade') return;
  updateOrbs(dt); updateCaps(dt);
  const v = G.variant;
  if (v.kind === 'raid' && G.state === 'fight') {
    G.raidDmg = Object.values(G.dmgBy || {}).reduce((a, x) => a + x, 0);
    if (G.timer <= 0) { G.state = 'over'; G.proj = []; banner('TIME UP', `누적 피해 ${fmtBig(G.raidDmg)}`, 1.4); setTimeout(() => finishBattle(true), 1400); return true; }
  }
  if ((G.state === 'fight' || G.state === 'clear') && !G.choosing && G.chestQ > 0) { G.chestQ -= 1; openChest(); return true; }
  return false;
}
const fmtBig = n => n >= 1e8 ? (n / 1e8).toFixed(1) + '억' : n >= 1e4 ? (n / 1e4).toFixed(1) + '만' : fmt(n);
// 웨이브 클리어 뒤 다음으로 넘어가기 전: 챕터 끝 · 보급 선택 · 다음 웨이브 (보스 러시는 5웨이브씩)
function runNext() {
  const v = G.variant;
  if (v.kind === 'chapter' && G.wave >= G.chapterEnd) { G.state = 'over'; banner('CHAPTER CLEAR', `챕터 ${v.ch}`, 1.6); setTimeout(() => finishBattle(true), 1600); return; }
  if (G.supplyQ) { G.supplyQ = false; openSupply(); return; }
  flushOrbs();
  G.wave += v.kind === 'rush' ? RUSH.step : 1; startArcadeWave();
}
function drawRun(t) {
  if (G.mode !== 'arcade' || !G.me) return;
  for (const m of G.foe.cons) { // 엘리트: 금빛 테두리
    if (!m.elite || m.dead || m.warp > 0) continue;
    ctx.save(); ctx.strokeStyle = `rgba(255,215,106,${.55 + .35 * Math.sin(t * 6)})`; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 1.35, t * 2, t * 2 + TAU); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#ffd76a'; ctx.font = '700 11px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('★', m.x, m.y - m.r * 1.35 - 3);
    ctx.restore();
  }
  if (G.laser) { // 레이저 예고선
    const L = G.laser; ctx.save(); ctx.strokeStyle = `rgba(255,77,109,${.35 + .5 * Math.abs(Math.sin(t * 14))})`; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.moveTo(L.x, L.y); ctx.lineTo(G.me.cx, G.me.cy); ctx.stroke(); ctx.restore();
  }
  for (const o of G.orbs) { // 경험치 별가루
    const r = o.big ? 3.4 : 2.4; ctx.fillStyle = o.big ? '#ffd76a' : '#9fe8ff';
    ctx.globalAlpha = .35; ctx.fillRect(o.x - r * 1.6, o.y - r * .6, r * 3.2, r * 1.2); ctx.fillRect(o.x - r * .6, o.y - r * 1.6, r * 1.2, r * 3.2);
    ctx.globalAlpha = 1; ctx.fillRect(o.x - r / 2, o.y - r / 2, r, r);
  }
  for (const c of G.caps) { // 보급 캡슐
    const D = CAPS[c.k], y = c.y + Math.sin(c.t * 3) * 3, a = c.life < 2 ? (Math.sin(c.t * 20) > 0 ? 1 : .35) : 1;
    ctx.save(); ctx.globalAlpha = a; ctx.translate(c.x, y);
    if (save.settings.glow !== false) { const g = ctx.createRadialGradient(0, 0, 4, 0, 0, 26); g.addColorStop(0, D.c + '88'); g.addColorStop(1, D.c + '00'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill(); }
    ctx.fillStyle = '#1b2240'; ctx.strokeStyle = D.c; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(-11, -14, 22, 28, 8) : ctx.rect(-11, -14, 22, 28); ctx.fill(); ctx.stroke();
    ctx.fillStyle = D.c; ctx.font = '700 13px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(D.ch, 0, 1);
    ctx.textBaseline = 'alphabetic'; ctx.font = '700 9px "Chakra Petch", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('TAP', 0, 26);
    ctx.restore();
  }
}

/* ---------- 런 팝업: 룰렛 상자 · 보급 선택 · 부활 ---------- */
function runPop(html, onAct) {
  G.choosing = true;
  $('runPopBody').innerHTML = html; $('runPop').hidden = false;
  $('runPopBody').onclick = e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) onAct(b.dataset.act, b); };
  const f = $('runPopBody').querySelector('button:not([disabled])'); if (f) f.focus({ preventScroll: true });
}
function closeRunPop() { $('runPop').hidden = true; G.choosing = false; }
// 엘리트 상자: 1 · 3 · 5 중 룰렛으로 레벨업 횟수가 정해져요
function openChest() {
  const tot = RUN.chest.reduce((a, x) => a + x.w, 0); let r = Math.random() * tot, pick = 0;
  RUN.chest.forEach((x, i) => { if (r >= 0 && (r -= x.w) < 0) pick = i; });
  const res = RUN.chest[pick];
  runPop(`<div class="rp-title">보물 상자</div>
    <img class="rp-chest" src="${imgUrl('chest_closed.png')}" alt="" aria-hidden="true">
    <div class="roul">${RUN.chest.map((x, i) => `<span data-k="${i}">레벨업<b>×${x.n}</b></span>`).join('')}</div>
    <p class="rp-txt" id="roulTxt">룰렛이 돌아가요…</p>
    <button class="cta" data-act="ok" type="button" id="roulOk" disabled>받기</button>`, act => {
    if (act !== 'ok') return;
    G.pendingLv += res.n; G.lv += res.n; G.bonusDust += RUN.chestDust * res.n * G.wave;
    G.taken.push(`보물 상자 ×${res.n}`); closeRunPop();
  });
  const tiles = [...$('runPopBody').querySelectorAll('.roul span')], L = tiles.length, min = 3 * L;
  const show = i => tiles.forEach((t, j) => t.classList.toggle('on', j === i));
  const done = () => {
    show(pick); tiles[pick].classList.add('win');
    $('roulTxt').innerHTML = `레벨업 <b>${res.n}번</b> · 미네랄 +${fmt(RUN.chestDust * res.n * G.wave)}`;
    const ok = $('roulOk'); ok.disabled = false; ok.focus({ preventScroll: true });
  };
  if (REDUCED_MOTION) { done(); return; }
  let step = 0;
  const spin = () => { show(step % L); if (step >= min && step % L === pick) { done(); return; } step += 1; setTimeout(spin, 60 + step * step * 1.2); };
  spin();
}
// N웨이브마다 보급 선택 (하데스 방 보상처럼 셋 중 하나)
function openSupply() {
  const P = G.me.planet, dust = 150 * G.wave, opts = [
    !curseOn('norep') && { act: 'heal', name: '행성 수리', txt: `행성 HP <b>40%</b> 회복` },
    { act: 'lv', name: '훈련', txt: '레벨업 <b>+1</b>' },
    { act: 'dust', name: '채굴', txt: `미네랄 <b>+${fmt(dust)}</b>` },
    { act: 'energy', name: '기력 충전', txt: '기력 <b>+4</b>' },
  ].filter(Boolean).slice(0, 3);
  runPop(`<div class="rp-title">보급 선택</div><p class="rp-txt">WAVE ${G.wave} 클리어 보상을 하나 골라요</p>
    <div class="rp-opts">${opts.map(o => `<button class="rp-opt" data-act="${o.act}" type="button"><b>${o.name}</b><span>${o.txt}</span></button>`).join('')}</div>`, act => {
    if (act === 'heal') heal(P, P.maxHp * .4);
    else if (act === 'lv') { G.pendingLv += 1; G.lv += 1; }
    else if (act === 'dust') G.bonusDust += dust;
    else if (act === 'energy') G.energy = Math.min(G.maxEnergy, G.energy + 4);
    G.taken.push('보급 · ' + opts.find(o => o.act === act).name);
    closeRunPop();
  });
}
// 부활: 행성이 부서지기 직전 (battle.js onPlanetDown)
function offerRevive() {
  if (G.mode !== 'arcade' || !G.revives || G.revives <= 0) return false;
  const cost = RUN.revivePiece;
  runPop(`<div class="rp-title">행성 파괴 직전!</div>
    <p class="rp-txt">부활하면 행성 HP <b>${Math.round(RUN.reviveHp * 100)}%</b>로 다시 싸워요 · 남은 부활 ${G.revives}번</p>
    <div class="rp-opts col">
      <button class="cta" data-act="ad" type="button">광고 보고 부활</button>
      <button class="ghost" data-act="piece" type="button" ${save.piece >= cost ? '' : 'disabled'}>별모래 ${cost}개로 부활 (보유 ${fmt(save.piece)})</button>
      <button class="ghost" data-act="no" type="button">포기하기</button>
    </div>`, act => {
    if (act === 'no') { G.revives = 0; closeRunPop(); onPlanetDown('me'); return; }
    if (act === 'piece') { if (save.piece < cost) return; save.piece -= cost; persist(); doRevive(); return; }
    if (act === 'ad') Ads.showRewarded('revive').then(r => { if (r.rewarded) doRevive(); else toast('광고를 끝까지 봐야 부활해요'); });
  });
  return true;
}
function doRevive() {
  const P = G.me.planet;
  G.revives -= 1; G.revived += 1;
  P.hp = Math.round(P.maxHp * RUN.reviveHp); P.dot = null; G.pShield = Math.max(G.pShield, P.maxHp * .2);
  G.proj = G.proj.filter(p => !p.foeShot); G.laser = null;
  for (const m of G.foe.cons) if (!m.dead && (m.mob === 'rock' || m.mob === 'meteor')) { m.dead = true; m.alpha = .6; burst(m.x, m.y, 10, '#9fe8ff'); }
  closeRunPop();
  banner('부활!', '행성이 다시 일어났어요', 1.4); burst(G.me.cx, G.me.cy, 60, '#8cf2c6');
  G.taken.push('부활');
}

/* ---------- 레벨업 화면 버튼: 다시 뽑기 · 자동 선택 ---------- */
function lvupFoot() {
  $('rerollBtn').textContent = `다시 뽑기 (${G.rerolls})`; $('rerollBtn').disabled = !(G.rerolls > 0);
  $('autoBtn').setAttribute('aria-pressed', String(autoOn()));
  $('autoBtn').textContent = autoOn() ? '자동 선택 켜짐' : '자동 선택';
}
function toggleAuto() {
  if (!passOn()) { toast('자동 선택은 30일 패스 혜택이에요'); return; }
  save.settings.autoPick = !save.settings.autoPick; persist(); lvupFoot(); pauseAutoLabel();
  if (autoOn()) toast('다음 레벨업부터 자동으로 골라요 (일시정지에서 끌 수 있어요)');
}
const pauseAutoLabel = () => { $('pauseAuto').textContent = `레벨업 자동 선택: ${autoOn() ? '켜짐' : '꺼짐'}`; $('pauseAuto').setAttribute('aria-pressed', String(autoOn())); };
$('autoBtn').addEventListener('click', toggleAuto);
$('pauseAuto').addEventListener('click', toggleAuto);
