'use strict';
/* ---------- Canvas ---------- */
const cv = $('cv'), ctx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1, stars = [];
function makeStars() {
  const n = Math.round(W * H / 2600);
  return Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, r: Math.random() < .12 ? rnd(1, 1.7) : rnd(.3, .9), tw: rnd(0, TAU), sp: rnd(.6, 2) }));
}
function resize() {
  const r = cv.getBoundingClientRect();
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = r.width; H = r.height;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  stars = makeStars();
  if (G.state === 'home') layoutHome(); else if (G.me) layout();
}
addEventListener('resize', resize);

/* ---------- Game state ---------- */
const G = {
  state: 'title', mode: 'arcade', ghost: null, kills: 0, wave: 1, timer: 40, energy: 2, maxEnergy: 10, focus: null, me: null, foe: null, zone: ZONES[0],
  proj: [], beams: [], fx: [], texts: [], shield: 0, nova: 0, roar: 0, pShield: 0, enraged: false, bossCd: 6, bossCd2: 8,
  paused: false, choosing: false, clearT: 0, lv: 1, xp: 0, pendingLv: 0, taken: [],
  T: { armor: 0, marmor: 0, evade: 0, dmgRed: 0, planetRed: 0 },
};
const SHIELD_T = 6, NOVA_T = 6;
const xpNeed = lv => 30 + 18 * (lv - 1);

function makeCon(def, side, mult) {
  const hp = Math.round(def.hp * mult.hp);
  return { def, side, hp, maxHp: hp, baseHp: hp, atkBase: def.atk * mult.atk, rate: def.rate, dArmor: def.def, mArmor: def.mdef,
    lv: 1, cd: rnd(.2, 1.2), dead: false, stun: 0, dot: null, slow: 0, shred: 0, invuln: 0, x: 0, y: 0, s: 1, flash: 0, alpha: 1,
    m: { atk: 0, rate: 0, crit: 0, critDmg: 0, hp: 0, heal: 0, poison: 0 }, stacks: {}, chain: 0,
    shots: 0, heals: 0, focusStack: 0, lastT: null, tA: 0, revived: false, molted: false };
}
function makeSystem(side, planet, cons) {
  return { side, planet, cons, phase: rnd(0, TAU), speed: TAU / (side === 'me' ? 7 : 8.5), orbits: 0, cx: 0, cy: 0, R: 0, ry: 0, pr: 0 };
}
function layout() {
  const top = 104, bot = 224, band = Math.max(200, H - top - bot);
  const R = Math.min(W * .38, band * .4);
  for (const [sys, f] of [[G.foe, .25], [G.me, .74]]) {
    if (!sys) continue;
    sys.cx = W / 2; sys.cy = top + band * f; sys.R = R; sys.ry = R * .42;
    sys.pr = R * (sys.planet.bossTier === 2 ? .34 : sys.planet.bossTier === 1 ? .29 : .24);
  }
}
const has = (c, k) => c.chain >= k && c.side === 'me';
const myCons = id => G.me ? G.me.cons.filter(c => c.def.id === id) : [];

// Builds the player's center planet object from its definition + planet level (행성 탭)
function makePlayerPlanet(pid, lv) {
  const d = PLANET[pid], t = d.trait, hp = Math.round(d.hp * planetHpMul(lv));
  return { isPlanet: true, kind: d.kind, look: d.look, name: d.name, hp, maxHp: hp, baseHp: hp, dArmor: 20, mArmor: 20,
    regen: t.regen || 0, rateMul: t.rateMul || 1, atkMul: t.atkMul || 1, crit: t.crit || 0, dmgRed: t.dmgRed || 0, energy: t.energy || 0,
    flash: 0, dot: null, side: 'me' };
}
// Constellation with account-side bonuses (grade + star parts from 별자리 탭)
function makeMyCon(id) {
  const b = conBonus(id), c = makeCon(CON[id], 'me', { hp: b.hp, atk: b.atk });
  c.m.rate = b.rate - 1; c.grade = b.grade;
  return c;
}
function startRun(mode) {
  const P = makePlayerPlanet(save.mainPlanet, save.planets[save.mainPlanet].lv);
  G.me = makeSystem('me', P, save.team.map(makeMyCon));
  Object.assign(G, { mode, wave: 1, kills: 0, energy: 2 + P.energy, shield: 0, nova: 0, roar: 0, pShield: 0, proj: [], beams: [], fx: [], texts: [],
    lv: 1, xp: 0, pendingLv: 0, taken: [], zone: ZONES[0], choosing: false, paused: false });
  G.T = { armor: 0, marmor: 0, evade: 0, dmgRed: 0, planetRed: P.dmgRed };
  $('myName').textContent = P.name;
  showBattleUi(true);
  if (mode === 'pvp') startPvp(); else startWave();
}
// 비동기 대전: another player's saved formation, simulated as a ghost
function startPvp() {
  const power = teamPower();
  const pid = PLANETS[Math.floor(Math.random() * PLANETS.length)].id;
  const name = GHOST_NAMES[Math.floor(Math.random() * GHOST_NAMES.length)];
  const scale = rnd(.85, 1.15), n = G.me.cons.length;
  const pool = Array.from({ length: n }, () => ALL_CONS[Math.floor(Math.random() * ALL_CONS.length)]);
  const base = pool.reduce((s, d) => s + d.atk * d.rate * 10 + d.hp / 5, 0);
  const m = Math.max(.6, power / Math.max(1, base)) * scale;
  const P = makePlayerPlanet(pid, 1 + Math.floor(Math.random() * 3));
  Object.assign(P, { side: 'foe', hp: Math.round(P.hp * m * 1.1), shred: 0 }); P.maxHp = P.hp;
  G.ghost = { name, lv: Math.max(1, save.lv + Math.floor(rnd(-2, 3))), planet: PLANET[pid].name };
  G.foe = makeSystem('foe', P, pool.map(d => { const c = makeCon(d, 'foe', { hp: m, atk: m }); if (d.special) c.def = d; return c; }));
  G.timer = 60; G.enraged = false; G.focus = null; G.state = 'fight'; G.zone = ZONES[1];
  $('foeName').textContent = `${name} · ${P.name}`;
  $('waveNo').textContent = 'VS'; $('zoneChip').textContent = '비동기 대전';
  layout();
  banner('SPEC BATTLE', `${name} (Lv ${G.ghost.lv}) 의 행성계`, 1.6);
}
function startWave() {
  const n = G.wave, z = zoneOf(n);
  const bossTier = n % 10 === 0 ? 2 : n % 5 === 0 ? 1 : 0;
  const deep = Math.max(0, n - 20);
  const m = Math.pow(1.13, n - 1) * Math.pow(1.03, deep);
  const look = bossTier === 2 ? z.boss : bossTier === 1 ? z.mid : z.foes[Math.floor(Math.random() * z.foes.length)];
  const base = z === ZONES[0] ? 2 : z === ZONES[1] ? 3 : 4;
  const count = bossTier ? base + 1 : Math.min(base + Math.floor(((n - 1) % 10) / 4), base + 2);
  const pool = Array.from({ length: count }, () => ZODIAC[Math.floor(Math.random() * ZODIAC.length)]);
  const pHp = Math.round(900 * Math.pow(1.2, n - 1) * Math.pow(1.03, deep) * (bossTier === 2 ? 2.6 : bossTier === 1 ? 1.8 : 1));
  G.foe = makeSystem('foe', { isPlanet: true, look, kind: look.kind, bossTier, ability: bossTier ? (look.ability || 'stun') : null,
    name: look.name, hp: pHp, maxHp: pHp, dArmor: 15 + n * 2, mArmor: 15 + n * 2, flash: 0, dot: null, shred: 0, side: 'foe' },
    pool.map(d => makeCon(d, 'foe', { hp: .9 * m, atk: .8 * m })));
  for (const c of G.me.cons) { c.dead = false; c.hp = c.maxHp; c.alpha = 1; c.stun = 0; c.dot = null; c.revived = false; c.molted = false; c.invuln = 0; }
  const P = G.me.planet; if (n > 1) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .15);
  G.timer = 40; G.enraged = false; G.bossCd = 5; G.bossCd2 = 8; G.focus = null; G.proj = []; G.beams = [];
  G.state = 'fight';
  const newZone = z !== G.zone || n === 1; G.zone = z;
  $('foeName').textContent = (bossTier === 2 ? '구역 보스 · ' : bossTier === 1 ? 'BOSS · ' : '') + look.name;
  $('waveNo').textContent = n; $('zoneChip').textContent = z.name;
  layout();
  if (newZone) banner(z.en, `${z.name} 진입 · WAVE ${n}`, 2);
  else banner(bossTier ? `BOSS WAVE ${n}` : `WAVE ${n}`, look.name, 1.3);
}

/* ---------- Helpers ---------- */
let bannerT = 0;
function banner(a, b, t) { $('b1').textContent = a; $('b2').textContent = b || ''; $('banner').classList.add('show'); bannerT = t; }
function sysOf(side) { return side === 'me' ? G.me : G.foe; }
function other(side) { return side === 'me' ? G.foe : G.me; }
function posOf(t) { if (t.isPlanet) { const s = sysOf(t.side); return [s.cx, s.cy]; } return [t.x, t.y]; }
function alive(t) { return !!t && (t.isPlanet ? t.hp > 0 : !t.dead); }
function say(x, y, v, c, t = .9, size) { G.texts.push({ x, y, v, c, t, size }); }

function critRate(c) { return .05 + c.m.crit + (c.side === 'me' ? G.me.planet.crit + Math.max(0, G.T.evade - .75) * 2 : 0); }
function critDmg(c) { return 1.5 + c.m.critDmg + (has(c, 2) && c.def.id === 'gem' ? .6 : 0); }
function evadeRate() { return Math.min(.75, G.T.evade); }
function conAtk(c) {
  let a = c.atkBase * (1 + .3 * (c.lv - 1)) * (1 + c.m.atk);
  if (c.side === 'me') {
    a *= G.me.planet.atkMul;
    if (G.roar > 0) a *= 1.3;
    if (has(c, 1) && c.def.id === 'tau') a *= 1 + clamp(1 - c.hp / c.maxHp, 0, 1);
    if (has(c, 1) && c.def.id === 'lib' && G.foe.planet.hp / G.foe.planet.maxHp > G.me.planet.hp / G.me.planet.maxHp) a *= 1.3;
    if (has(c, 3) && c.def.id === 'aqr') a *= 1.6;
  }
  return a;
}
function pickTarget(c, exclude) {
  const enemy = other(c.side);
  if (c.def.special) return enemy.planet;
  if (c.side === 'me' && G.focus && !G.focus.isPlanet && alive(G.focus) && G.focus !== exclude) return G.focus;
  const live = enemy.cons.filter(x => !x.dead && x !== exclude);
  if (!live.length) return exclude && !exclude.isPlanet && enemy.cons.some(x => !x.dead) ? null : enemy.planet;
  let best = null, bd = 1e9;
  for (const t of live) { const d = Math.hypot(t.x - c.x, t.y - c.y); if (d < bd) { bd = d; best = t; } }
  return best;
}
function randomOtherEnemy(c, t) {
  const live = other(c.side).cons.filter(x => !x.dead && x !== t);
  return live.length ? live[Math.floor(Math.random() * live.length)] : null;
}

/* ---------- Damage ---------- */
// src: attacking constellation (or null). Returns nothing; handles crit, evade, reactions, kills.
function strike(src, t, base, kind, opt = {}) {
  if (!alive(t)) return;
  let dmg = base, tier = 0;
  if (src && src.side === 'me') {
    if (has(src, 2) && src.def.id === 'cap' && t.hp / t.maxHp <= .5) dmg *= 1.4;
    if (has(src, 3) && src.def.id === 'sco' && t.dot) dmg *= 1.4;
    if (has(src, 2) && src.def.id === 'lib') dmg += t.maxHp * .02;
    const r = critRate(src);
    tier = Math.min(5, Math.floor(r) + (chance(r - Math.floor(r)) ? 1 : 0));
    if (tier > 0) dmg *= critDmg(src) * Math.pow(2, tier - 1);
  }
  applyDamage(t, dmg, kind, { src, tier, color: opt.color });
}
function applyDamage(t, dmg, kind, { src = null, tier = 0, color = null, silent = false } = {}) {
  if (!alive(t)) return;
  const [x, y] = posOf(t);
  if (t.side === 'me') {
    if (!t.isPlanet && t.invuln > 0) { if (!silent) say(x, y - 14, '무적', '#a9c1ff', .5); return; }
    if (src && chance(evadeRate())) {
      if (!silent) say(x, y - 14, 'MISS', '#a9c1ff', .6);
      for (const l of myCons('lib')) if (has(l, 3) && !l.dead) fire(l, true);
      return;
    }
    if (G.shield > 0) dmg *= .3;
    if (G.enraged) dmg *= 1.5;
    dmg *= 1 - G.T.dmgRed;
    if (t.isPlanet) dmg *= 1 - G.T.planetRed;
  }
  const armor = Math.max(0, (kind === 'magic' ? t.mArmor - (t.shred || 0) : t.dArmor) + (t.side === 'me' && !t.isPlanet ? (kind === 'magic' ? G.T.marmor : G.T.armor) : 0));
  let d = dmg * 100 / (100 + armor);
  if (t.isPlanet && t.side === 'me' && G.pShield > 0) { const a = Math.min(G.pShield, d); G.pShield -= a; d -= a; }
  t.hp -= d; t.flash = .12;
  if (!silent) {
    const big = tier >= 1;
    say(x + rnd(-10, 10), y - 14, Math.max(1, Math.round(d)), color || (t.side === 'me' ? '#ff8a9a' : CRIT_COL[tier]), big ? 1 : .8, big ? 13 + tier * 2 : 13);
  }
  // reactions on my side
  if (t.side === 'me' && !t.isPlanet && src && alive(src)) {
    if (has(t, 1) && t.def.id === 'cnc') applyDamage(src, d * .25, 'phys', { color: '#ffd76a' });
    if (has(t, 2) && t.def.id === 'ari' && chance(.25)) fire(t, true);
  }
  if (t.side === 'me' && !t.isPlanet && has(t, 3) && t.def.id === 'cnc' && !t.molted && t.hp > 0 && t.hp < t.maxHp * .3) {
    t.molted = true; t.invuln = 3; say(x, y - 26, '탈피', '#a9c1ff', 1);
  }
  if (t.hp <= 0) {
    t.hp = 0;
    if (t.isPlanet) { burst(x, y, 60, t.side === 'me' ? '#8cf2c6' : '#ffb27a'); onPlanetDown(t.side); }
    else killCon(t, src);
  }
}
function killCon(t, src) {
  const [x, y] = posOf(t);
  if (t.side === 'me' && has(t, 3) && t.def.id === 'ari' && !t.revived) {
    t.revived = true; t.hp = t.maxHp * .4; say(x, y - 24, '불굴', '#f5c451', 1); burst(x, y, 14, '#f5c451'); return;
  }
  t.dead = true; burst(x, y, 26, t.side === 'me' ? '#ff8a9a' : '#f5c451');
  if (G.focus === t) G.focus = null;
  if (t.side === 'foe') {
    G.kills += 1;
    gainXp(6 + G.wave);
    if (src && has(src, 3) && src.def.id === 'leo') { G.energy = Math.min(G.maxEnergy, G.energy + 1); say(x, y - 26, '기력 +1', '#f5c451', 1); }
    if (t.dot && myCons('sco').some(s => has(s, 2))) {
      const live = G.foe.cons.filter(x => !x.dead && x !== t), n = live[Math.floor(Math.random() * live.length)];
      if (n) { n.dot = { dps: t.dot.dps, t: 4, stacks: t.dot.stacks || 1 }; G.beams.push({ x1: x, y1: y, x2: n.x, y2: n.y, t: .3, c: '#9dff6a', w: 2 }); }
    }
  }
}
function heal(t, v) {
  if (!alive(t)) return 0;
  const before = t.hp; t.hp = Math.min(t.maxHp, t.hp + v);
  const got = t.hp - before;
  if (got >= 1) { const [x, y] = posOf(t); say(x, y - 16, '+' + Math.round(got), '#8cf2c6', .8); }
  return v - got;
}
function burst(x, y, n, c) {
  for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(30, 170); G.fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v * .6, t: rnd(.4, .9), c }); }
}
function onPlanetDown(side) {
  if (G.state !== 'fight') return;
  G.proj = [];
  if (G.mode === 'pvp') { G.state = 'over'; banner(side === 'foe' ? 'VICTORY' : 'DEFEAT', '', 1); setTimeout(() => finishBattle(side === 'foe'), 1100); return; }
  if (side === 'foe') {
    G.state = 'clear'; G.clearT = 1.6;
    gainXp(15 + G.wave * 2);
    banner('CLEAR', G.wave % 10 === 0 ? '구역 보스 격파' : '', 1.2);
  } else {
    G.state = 'over';
    setTimeout(() => finishBattle(false), 1100);
  }
}
function gainXp(v) {
  if (G.mode !== 'arcade') return;
  G.xp += v;
  while (G.xp >= xpNeed(G.lv)) { G.xp -= xpNeed(G.lv); G.lv += 1; G.pendingLv += 1; }
}
function perkOptions() {
  const opts = [];
  const ids = [...new Set(G.me.cons.map(c => c.def.id))];
  for (const id of ids) {
    const c = G.me.cons.find(x => x.def.id === id), P = PERKS[id];
    for (const [k, name] of P.stats) {
      const n = c.stacks[k] || 0;
      if (n < STAT_MAX) opts.push({ type: 'stat', id, k, name, lvl: n + 1, desc: STAT[k].txt(STAT[k].v) });
    }
    if (c.chain < 3) { const [name, desc] = P.chain[c.chain]; opts.push({ type: 'chain', id, lvl: c.chain + 1, name, desc }); }
  }
  // awakenings are rarer than stat cards but always possible
  const weighted = opts.flatMap(o => o.type === 'chain' ? [o, o] : [o, o, o]);
  const picked = [];
  while (picked.length < 3 && weighted.length) {
    const o = weighted.splice(Math.floor(Math.random() * weighted.length), 1)[0];
    if (!picked.includes(o)) picked.push(o);
  }
  while (picked.length < 3) picked.push({ type: 'repair', id: null, name: '행성 수리', desc: '행성 HP를 <b>30%</b> 회복해요.' });
  return picked;
}
function openLevelUp() {
  G.choosing = true; G.pendingLv -= 1;
  const opts = perkOptions();
  $('lvupTitle').textContent = `Lv ${G.lv - G.pendingLv}`;
  $('cards').innerHTML = opts.map((o, i) => {
    const d = o.id ? CON[o.id] : null;
    const cls = o.type === 'stat' ? 'stat' : d && d.special ? 'special' : '';
    const badge = o.type === 'stat' ? `+${o.lvl}` : o.type === 'chain' ? ROMAN[o.lvl] : '+';
    const tag = o.type === 'stat' ? `능력치 ${o.lvl}/${STAT_MAX}` : o.type === 'chain' ? `각성 ${ROMAN[o.lvl]}` : '보급';
    const total = o.type === 'stat' ? STAT_MAX : 3;
    const dots = o.id ? Array.from({ length: total }, (_, j) => `<i class="${j < o.lvl - 1 ? 'on' : j === o.lvl - 1 ? 'next' : ''}"></i>`).join('') : '';
    return `<button class="card ${cls}" type="button" data-i="${i}">
      <span class="badge">${badge}</span>
      <span><span class="who">${d ? d.name + '자리' : '행성'}<em>${tag}</em></span>
      <span class="nm" style="display:block">${o.name}</span><span class="ds" style="display:block">${o.desc}</span>
      ${dots ? `<span class="dots">${dots}</span>` : ''}</span>
    </button>`;
  }).join('');
  $('cards').onclick = e => {
    const b = e.target.closest('[data-i]'); if (!b) return;
    applyPerk(opts[+b.dataset.i]);
    $('lvup').hidden = true; G.choosing = false;
  };
  $('lvup').hidden = false;
  const first = $('cards').querySelector('button'); if (first) first.focus({ preventScroll: true });
}
function applyPerk(o) {
  if (o.type === 'repair') { heal(G.me.planet, G.me.planet.maxHp * .3); G.taken.push('행성 수리'); return; }
  const cons = G.me.cons.filter(c => c.def.id === o.id);
  const d = CON[o.id];
  if (o.type === 'chain') {
    for (const c of cons) c.chain = o.lvl;
    if (o.id === 'ari' && o.lvl === 1) G.T.dmgRed += .15;
    if (o.id === 'tau' && o.lvl === 3) G.T.planetRed += .15;
    G.taken.push(`${d.name} ${ROMAN[o.lvl]} ${o.name}`);
    banner(`각성 ${ROMAN[o.lvl]}`, `${d.name}자리 · ${o.name}`, 1.2);
    return;
  }
  const v = STAT[o.k].v;
  for (const c of cons) {
    c.stacks[o.k] = (c.stacks[o.k] || 0) + 1;
    if (o.k in c.m) c.m[o.k] += v;
    if (o.k === 'hp') { const old = c.maxHp; c.maxHp = Math.round(c.baseHp * (1 + c.m.hp) * (1 + .15 * (c.lv - 1))); c.hp += c.maxHp - old; }
  }
  if (o.k === 'tArmor') G.T.armor += v;
  if (o.k === 'tMArmor') G.T.marmor += v;
  if (o.k === 'tEvade') G.T.evade += v;
  if (o.k === 'pHp') { const P = G.me.planet, add = Math.round(P.baseHp * v); P.maxHp += add; P.hp += add; }
  G.taken.push(`${d.name} ${o.name} +${o.lvl}`);
}

/* ---------- Firing ---------- */
function projOf(c, t, over = {}) {
  const mine = c.side === 'me';
  const col = c.def.special ? '#d58bff' : mine ? '#ffd76a' : '#ff7b8a';
  const atk = conAtk(c);
  const S = {
    arrow:  { sp: 520, dmg: atk, kind: 'phys', col, w: 1.6, len: 12 },
    shot:   { sp: 360, dmg: atk, kind: c.def.kind === 'magic' ? 'magic' : 'phys', col, w: 3, len: 6 },
    orb:    { sp: 240, dmg: atk, kind: 'magic', col: mine ? '#9fb8ff' : '#ff8ad0', w: 4.5, len: 0, orb: true },
    poison: { sp: 300, dmg: atk * .6, kind: 'phys', col: '#9dff6a', w: 3, len: 5, poison: atk * .5 * (1 + c.m.poison) },
  }[c.def.style] || { sp: 320, dmg: atk, kind: 'magic', col, w: 3, len: 0, orb: true };
  return Object.assign({ x: c.x, y: c.y, t, src: c }, S, over);
}
function fire(c, counter = false) {
  const sys = sysOf(c.side), t = pickTarget(c);
  if (!alive(t)) return;
  const mine = c.side === 'me', id = c.def.id;
  c.shots += 1;
  if (mine && has(c, 3) && id === 'sgr') { c.focusStack = c.lastT === t ? Math.min(10, c.focusStack + 1) : 0; c.lastT = t; }
  let mul = 1;
  if (mine && has(c, 3) && id === 'sgr') mul *= 1 + .08 * c.focusStack;
  if (mine && has(c, 3) && id === 'cap' && c.shots % 5 === 0) { mul *= 3; say(c.x, c.y - 22, '거인의 일격', '#f5c451', .7); }
  const [tx, ty] = posOf(t);
  switch (c.def.style) {
    case 'arrow':
      G.proj.push(projOf(c, t, { dmg: conAtk(c) * mul }));
      if (mine && has(c, 1) && id === 'sgr' && c.shots % 3 === 0) {
        for (let i = 0; i < 2; i++) { const o = randomOtherEnemy(c, t) || t; G.proj.push(projOf(c, o, { x: c.x + rnd(-6, 6) })); }
      }
      break;
    case 'shot': case 'poison':
      G.proj.push(projOf(c, t, { dmg: projOf(c, t).dmg * mul })); break;
    case 'orb':
      G.proj.push(projOf(c, t, { dmg: conAtk(c) * mul }));
      if (mine && has(c, 1) && id === 'psc') G.proj.push(projOf(c, t, { x: c.x + 8, y: c.y - 4, sp: 210 }));
      break;
    case 'twin':
      G.proj.push(projOf(c, t, { x: c.x - 4, sp: 380, kind: 'phys', w: 2.4, len: 8, orb: false }));
      G.proj.push(projOf(c, t, { x: c.x + 4, sp: 300, kind: 'magic', col: '#9fb8ff', w: 3.5, len: 0, orb: true, twinMagic: true }));
      if (mine && has(c, 1) && chance(.25)) setTimeout(() => { if (!c.dead && G.state === 'fight') { const t2 = pickTarget(c); if (alive(t2)) G.proj.push(projOf(c, t2, { kind: 'phys', w: 2.4, len: 8, orb: false, sp: 380 })); } }, 120);
      break;
    case 'beam': {
      const col = c.def.special ? '#d58bff' : mine ? '#ffd76a' : '#ff7b8a';
      G.beams.push({ x1: c.x, y1: c.y, x2: tx, y2: ty, t: .18, c: col, w: c.def.special ? 3 : 2.4 });
      beamHit(c, t, conAtk(c) * mul);
      if (mine && has(c, 2) && id === 'leo') {
        const t2 = randomOtherEnemy(c, t) || (t.isPlanet ? null : other(c.side).planet);
        if (t2 && (t2.isPlanet ? !other(c.side).cons.some(x => !x.dead) : true)) { const [x2, y2] = posOf(t2); G.beams.push({ x1: tx, y1: ty, x2, y2, t: .18, c: col, w: 1.8 }); beamHit(c, t2, conAtk(c) * .7); }
      }
      if (mine && has(c, 3) && id === 'oph') {
        G.beams.push({ x1: c.x + 6, y1: c.y + 4, x2: tx + rnd(-8, 8), y2: ty + rnd(-8, 8), t: .18, c: col, w: 2 });
        beamHit(c, t, conAtk(c) * .8);
      }
      break;
    }
    case 'heal': {
      const P = sys.planet;
      c.heals += 1;
      let amt = conAtk(c) * 4 * (1 + c.m.heal);
      if (mine && has(c, 3) && P.hp < P.maxHp * .3) amt *= 2;
      G.beams.push({ x1: c.x, y1: c.y, x2: sys.cx, y2: sys.cy, t: .25, c: '#8cf2c6', w: 2 });
      const over = heal(P, amt);
      if (mine && has(c, 1) && over > 0) G.pShield = Math.min(P.maxHp * .2, G.pShield + over);
      const hurt = sys.cons.filter(x => !x.dead && x.hp < x.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) heal(hurt, amt * .6);
      if (mine && has(c, 2) && c.heals % 5 === 0) { for (const a of sys.cons) if (!a.dead) heal(a, a.maxHp * .12); say(c.x, c.y - 22, '스피카', '#8cf2c6', .8); }
      G.proj.push(projOf(c, t, { dmg: conAtk(c) * .5, col: '#8cf2c6', w: 3, orb: true, len: 0 }));
      break;
    }
  }
  if (counter) say(c.x, c.y - 22, '반격', '#ffd76a', .6);
}
function beamHit(c, t, dmg) {
  strike(c, t, dmg, c.def.kind === 'both' ? 'phys' : c.def.kind, { color: c.def.special ? '#e7b6ff' : null });
  if (c.side === 'me' && t.isPlanet && c.def.id === 'oph') {
    if (has(c, 1)) heal(G.me.planet, dmg * .1);
    if (has(c, 2)) t.dot = { dps: conAtk(c) * .4, t: 4 };
  }
}
function onProjHit(p) {
  const c = p.src, t = p.t, mine = c && c.side === 'me', id = c && c.def.id;
  strike(c, t, p.dmg, p.kind, { color: p.meteor ? '#ffe9a8' : null });
  if (!mine || !c) return;
  if (p.poison && alive(t)) {
    const cap = has(c, 1) && id === 'sco' ? 3 : 1;
    const st = t.dot && t.dot.stacks ? Math.min(cap, t.dot.stacks + 1) : 1;
    t.dot = { dps: p.poison * st, t: 4, stacks: st };
  }
  if (!t.isPlanet && alive(t)) {
    if (has(c, 1) && id === 'cap' && chance(.2)) { t.stun = Math.max(t.stun, 1); say(t.x, t.y - 22, '기절', '#d58bff', .6); }
    if (has(c, 2) && id === 'psc') t.shred = Math.min(40, (t.shred || 0) + 10);
    if (has(c, 2) && id === 'cnc') t.slow = 3;
  }
  if (has(c, 1) && id === 'aqr') {
    const [x, y] = posOf(t);
    for (const o of other(c.side).cons) if (!o.dead && o !== t && Math.hypot(o.x - x, o.y - y) < 80) strike(c, o, p.dmg * .5, 'magic');
    G.fx.push(...Array.from({ length: 8 }, () => ({ x, y, vx: rnd(-60, 60), vy: rnd(-30, 30), t: .4, c: '#9fb8ff' })));
  }
  if (has(c, 3) && id === 'psc' && !p.bounced) {
    const n = randomOtherEnemy(c, t);
    if (n) { const [x, y] = posOf(t); G.proj.push(Object.assign({}, p, { x, y, t: n, dmg: p.dmg * .6, bounced: true })); }
  }
  const enemyP = other(c.side).planet;
  if (has(c, 2) && id === 'sgr' && !t.isPlanet) applyDamage(enemyP, p.dmg * .25, 'phys', { src: c, silent: true });
  if (has(c, 3) && id === 'gem' && p.twinMagic && !t.isPlanet) applyDamage(enemyP, p.dmg * .3, 'magic', { src: c, silent: true });
}

/* ---------- Skills ---------- */
function useSkill(kind) {
  if (G.state !== 'fight' || G.paused || G.choosing) return;
  const cost = { meteor: 3, shield: 2, nova: 4 }[kind];
  if (G.energy < cost) return;
  G.energy -= cost;
  if (kind === 'meteor') {
    let t = G.focus && alive(G.focus) ? G.focus : null;
    if (!t) { const live = G.foe.cons.filter(c => !c.dead); t = live.length ? live[0] : G.foe.planet; }
    const [tx] = posOf(t);
    for (let i = 0; i < 5; i++) G.proj.push({ x: tx + rnd(-60, 60) - 90, y: -20 - i * 40, t, src: null, sp: 700, dmg: 40 + t.maxHp * .07 + G.wave * 6, kind: 'magic', col: '#ffe9a8', w: 4, len: 26, meteor: true });
    banner('유성우', '', .7);
  } else if (kind === 'shield') { G.shield = SHIELD_T; banner('성운 방패', '', .7); }
  else { G.nova = NOVA_T; banner('초신성 가속', '', .7); }
}
$('skMeteor').addEventListener('click', () => useSkill('meteor'));
$('skShield').addEventListener('click', () => useSkill('shield'));
$('skNova').addEventListener('click', () => useSkill('nova'));

/* ---------- Tap targeting / in-battle level up ---------- */
function conSize(sys) { return sys.R * .25; }
cv.addEventListener('pointerdown', e => {
  if (G.state !== 'fight' || G.paused || G.choosing) return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  const hitCon = sys => sys.cons.find(c => !c.dead && Math.hypot(c.x - x, c.y - y) < conSize(sys) * c.s * 1.25);
  const mine = hitCon(G.me);
  if (mine) {
    if (mine.lv >= 5) { say(mine.x, mine.y - 24, 'MAX', '#f5c451', .8); return; }
    if (G.energy < 1) { say(mine.x, mine.y - 24, '기력 부족', '#8d96c4', .8); return; }
    G.energy -= 1; mine.lv += 1;
    const old = mine.maxHp; mine.maxHp = Math.round(mine.baseHp * (1 + mine.m.hp) * (1 + .15 * (mine.lv - 1))); mine.hp = Math.min(mine.maxHp, mine.hp + (mine.maxHp - old) + mine.baseHp * .3);
    say(mine.x, mine.y - 24, 'Lv ' + mine.lv, '#f5c451', 1); burst(mine.x, mine.y, 14, '#f5c451');
    return;
  }
  const foe = hitCon(G.foe);
  if (foe) { G.focus = foe; return; }
  if (Math.hypot(G.foe.cx - x, G.foe.cy - y) < G.foe.pr * 1.4) {
    G.focus = G.foe.planet;
    if (G.foe.cons.some(c => !c.dead)) say(G.foe.cx, G.foe.cy - G.foe.pr - 10, '별자리를 먼저 부숴야 해요', '#8d96c4', 1.2);
  }
});

/* ---------- Update ---------- */
function tickDot(t, dt) {
  if (!t.dot) return;
  t.dot.t -= dt;
  const d = t.dot.dps * dt;
  t.hp -= d;
  if (t.hp <= 0) { t.hp = 0; if (t.isPlanet) { const [x, y] = posOf(t); burst(x, y, 60, '#ffb27a'); onPlanetDown(t.side); } else killCon(t, null); }
  if (t.dot && t.dot.t <= 0) t.dot = null;
}
function updateSystem(sys, dt) {
  const n = sys.cons.length, dir = sys.side === 'me' ? 1 : -1, fighting = G.state === 'fight';
  sys.phase += sys.speed * dt;
  if (sys.side === 'me') {
    const o = Math.floor(sys.phase / TAU);
    if (o > sys.orbits) { sys.orbits = o; if (fighting) G.energy = Math.min(G.maxEnergy, G.energy + 1); }
  }
  sys.cons.forEach((c, i) => {
    const a = dir * sys.phase + i * TAU / n;
    c.x = sys.cx + sys.R * Math.cos(a); c.y = sys.cy + sys.ry * Math.sin(a);
    c.s = .8 + .2 * Math.sin(a); c.depth = Math.sin(a);
    if (c.flash > 0) c.flash -= dt;
    if (c.dead) { c.alpha = Math.max(0, c.alpha - dt * 2); return; }
    if (!fighting) return;
    if (c.invuln > 0) c.invuln -= dt;
    if (c.slow > 0) c.slow -= dt;
    tickDot(c, dt); if (c.dead) return;
    if (c.stun > 0) { c.stun -= dt; return; }
    // periodic awakenings
    if (c.side === 'me') {
      c.tA += dt;
      if (has(c, 1) && c.def.id === 'leo' && c.tA >= 10) { c.tA = 0; G.roar = 4; say(c.x, c.y - 24, '포효', '#f5c451', 1); }
      if (has(c, 2) && c.def.id === 'aqr' && c.tA >= 8) { c.tA = 0; for (const a of sys.cons) if (!a.dead) { a.stun = 0; a.dot = null; heal(a, a.maxHp * .08); } say(c.x, c.y - 24, '정화의 비', '#9fb8ff', 1); }
      if (has(c, 2) && c.def.id === 'tau' && c.tA >= 6) {
        c.tA = 0; say(c.x, c.y - 24, '지진', '#f5c451', 1);
        for (const e of G.foe.cons) if (!e.dead) strike(c, e, conAtk(c) * 2, 'phys');
      }
    }
    let rate = c.rate * (1 + c.m.rate) * (sys.side === 'me' ? sys.planet.rateMul : 1);
    if (sys.side === 'me' && G.nova > 0) rate *= 2;
    if (c.slow > 0) rate *= .7;
    c.cd -= dt * rate;
    if (c.cd <= 0) { c.cd += 1; fire(c); }
  });
  const P = sys.planet;
  if (P.flash > 0) P.flash -= dt;
  if (fighting) {
    if (P.regen) P.hp = Math.min(P.maxHp, P.hp + P.regen * dt);
    tickDot(P, dt);
  }
}

function bossAct(dt) {
  const B = G.foe.planet;
  if (!B.bossTier) return;
  G.bossCd -= dt;
  if (G.bossCd <= 0) {
    G.bossCd = B.bossTier === 2 ? 5 : 6;
    const live = G.me.cons.filter(c => !c.dead);
    if (live.length) {
      const c = live[Math.floor(Math.random() * live.length)];
      const hasSco = G.me.cons.some(x => x.def.id === 'sco' && !x.dead);
      c.stun = hasSco ? 1.3 : 2.6;
      G.beams.push({ x1: G.foe.cx, y1: G.foe.cy, x2: c.x, y2: c.y, t: .4, c: '#c35bff', w: 3, zig: true });
      say(c.x, c.y - 24, '기절', '#d58bff', 1);
    }
  }
  if (B.bossTier === 2) {
    G.bossCd2 -= dt;
    if (G.bossCd2 <= 0) {
      G.bossCd2 = 8;
      const P = G.me.planet;
      if (B.ability === 'burn') { P.dot = { dps: P.maxHp * .012, t: 5 }; banner('태양 플레어', '행성이 불타요', .9); }
      else if (B.ability === 'meteor') {
        for (let i = 0; i < 4; i++) G.proj.push({ x: G.me.cx + rnd(-80, 80), y: -30 - i * 50, t: P, src: G.foe.cons.find(c => !c.dead) || null, sp: 520, dmg: P.maxHp * .04, kind: 'phys', col: '#e0b6ff', w: 4, len: 22 });
        banner('고리 파편 낙하', '', .9);
      } else if (B.ability === 'drain') { if (G.energy > 0) { G.energy -= 1; say(G.me.cx, G.me.cy - G.me.pr - 12, '기력 -1', '#c35bff', 1); } }
    }
  }
}

function update(dt) {
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
  if (!G.me) return;
  if (G.state === 'fight' && G.pendingLv > 0 && !G.choosing) { openLevelUp(); return; }
  updateSystem(G.me, dt); updateSystem(G.foe, dt);

  if (G.state === 'fight') {
    G.timer -= dt;
    if (G.mode === 'pvp' && G.timer <= 0) {
      const win = G.foe.planet.hp / G.foe.planet.maxHp < G.me.planet.hp / G.me.planet.maxHp;
      G.state = 'over'; G.proj = []; banner('TIME UP', win ? '남은 HP 비율로 승리' : '남은 HP 비율로 패배', 1);
      setTimeout(() => finishBattle(win), 1100); return;
    }
    if (G.mode === 'arcade' && G.timer <= 0 && !G.enraged) { G.enraged = true; banner('적 폭주', '공격력 +50%', 1.2); }
    if (G.shield > 0) G.shield -= dt;
    if (G.nova > 0) G.nova -= dt;
    if (G.roar > 0) G.roar -= dt;
    bossAct(dt);
  } else if (G.state === 'clear') {
    G.clearT -= dt;
    if (G.clearT <= 0 && G.pendingLv === 0) { G.wave += 1; startWave(); }
    else if (G.clearT <= 0 && !G.choosing) openLevelUp();
  }

  for (let i = G.proj.length - 1; i >= 0; i--) {
    const p = G.proj[i];
    if (!p) continue; // a planet kill can clear the list mid-loop
    if (!alive(p.t)) { G.proj.splice(i, 1); continue; }
    const [tx, ty] = posOf(p.t);
    const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy);
    const step = p.sp * dt;
    if (d <= step + 6) {
      G.proj.splice(i, 1);
      if (p.src || p.meteor) onProjHit(p); else strike(null, p.t, p.dmg, p.kind);
      if (p.meteor) burst(tx, ty, 10, '#ffe9a8');
      continue;
    }
    p.vx = dx / d; p.vy = dy / d; p.x += p.vx * step; p.y += p.vy * step;
  }
  for (let i = G.beams.length - 1; i >= 0; i--) { G.beams[i].t -= dt; if (G.beams[i].t <= 0) G.beams.splice(i, 1); }
  for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t -= dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= .96; f.vy *= .96; if (f.t <= 0) G.fx.splice(i, 1); }
  for (let i = G.texts.length - 1; i >= 0; i--) { const t = G.texts[i]; t.t -= dt; t.y -= 26 * dt; if (t.t <= 0) G.texts.splice(i, 1); }
}

/* ---------- Draw ---------- */
function drawBg(t) {
  const z = G.zone;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, z.bg[0]); g.addColorStop(.5, z.bg[1]); g.addColorStop(1, z.bg[2]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (save.settings.glow) for (const [cx, cy, rr, col, a] of [[.85, .12, .85, z.neb[0], .18], [.1, .82, .7, z.neb[1], .15]]) {
    const n = ctx.createRadialGradient(W * cx, H * cy, 0, W * cx, H * cy, W * rr);
    n.addColorStop(0, `rgba(${col},${a})`); n.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = n; ctx.fillRect(0, 0, W, H);
  }
  if (z === ZONES[0] && save.settings.glow) { // distant sun glare from the inner system
    const s = ctx.createRadialGradient(-W * .1, -H * .05, 0, -W * .1, -H * .05, W * .9);
    s.addColorStop(0, 'rgba(255,190,110,.22)'); s.addColorStop(1, 'rgba(255,190,110,0)');
    ctx.fillStyle = s; ctx.fillRect(0, 0, W, H);
  }
  for (const s of stars) {
    const a = .45 + .55 * Math.sin(t * s.sp + s.tw) ** 2;
    ctx.globalAlpha = a * (z === ZONES[2] ? 1 : .85); ctx.fillStyle = '#dfe6ff';
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlanet(sys, t) {
  const P = sys.planet, x = sys.cx, y = sys.cy, r = sys.pr;
  let c1, c2, c3, glow, kind = P.kind, look = P.look || {};
  if (kind === 'earth') { c1 = '#bfe0ff'; c2 = '#2f6be8'; c3 = '#081a4d'; glow = '80,150,255'; }
  else if (kind === 'sun') { c1 = '#fff8d0'; c2 = '#ffae2e'; c3 = '#d8461a'; glow = '255,160,40'; }
  else if (kind === 'moon') { c1 = '#f6f6fa'; c2 = '#a6a9bb'; c3 = '#3e4156'; glow = '200,205,235'; }
  else { [c1, c2, c3] = look.c; glow = look.glow; }
  if (kind === 'hole') { drawHole(x, y, r, t, P); return; }
  const isStar = kind === 'sun' || kind === 'star';
  const hr = r * (isStar ? 2.8 + .15 * Math.sin(t * 2) : 2.1);
  if (save.settings.glow) {
    const hg = ctx.createRadialGradient(x, y, r * .6, x, y, hr);
    hg.addColorStop(0, `rgba(${glow},${isStar ? .55 : .32})`); hg.addColorStop(1, `rgba(${glow},0)`);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, hr, 0, TAU); ctx.fill();
  }
  if (look.ring) drawRing(x, y, r, true, glow);
  const bg = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .1, x, y, r);
  bg.addColorStop(0, c1); bg.addColorStop(.55, c2); bg.addColorStop(1, c3);
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  if (kind === 'earth') {
    ctx.fillStyle = 'rgba(70,170,90,.75)';
    const o = (t * 8) % (r * 4);
    for (const [bx, by, br] of [[-.3, -.1, .35], [.35, .25, .28], [.1, -.5, .2], [-.5, .45, .22]]) {
      const px = x + ((bx * r + o) % (r * 2.4)) - r * .2;
      ctx.beginPath(); ctx.ellipse(px, y + by * r, br * r * 1.3, br * r, .4, 0, TAU); ctx.fill();
    }
  } else if (kind === 'moon' || kind === 'rock') {
    ctx.fillStyle = 'rgba(20,20,30,.28)';
    for (const [bx, by, br] of [[-.3, -.2, .18], [.25, .15, .22], [-.05, .5, .12], [.4, -.4, .1]]) { ctx.beginPath(); ctx.arc(x + bx * r, y + by * r, br * r, 0, TAU); ctx.fill(); }
  } else if (isStar) {
    ctx.fillStyle = 'rgba(255,240,180,.25)';
    for (let i = 0; i < 6; i++) { const a = t * .4 + i; ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * .5, y + Math.sin(a * 1.3) * r * .4, r * .18, 0, TAU); ctx.fill(); }
  } else if (kind === 'gas') {
    ctx.lineWidth = r * (look.bands ? .16 : .08);
    for (let i = -3; i <= 3; i++) {
      ctx.strokeStyle = i % 2 ? `rgba(255,255,255,${look.bands ? .12 : .06})` : `rgba(0,0,0,${look.bands ? .18 : .06})`;
      ctx.beginPath(); ctx.ellipse(x + Math.sin(t * .3 + i) * r * .05, y + i * r * .26, r * 1.1, r * .09, 0, 0, TAU); ctx.stroke();
    }
    if (look.bands) { ctx.fillStyle = 'rgba(160,40,20,.45)'; ctx.beginPath(); ctx.ellipse(x + r * .3, y + r * .28, r * .22, r * .12, 0, 0, TAU); ctx.fill(); }
  }
  if (!isStar) {
    const sh = ctx.createLinearGradient(x - r * .6, y - r * .6, x + r, y + r);
    sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(.55, 'rgba(0,0,10,.05)'); sh.addColorStop(1, 'rgba(0,0,15,.6)');
    ctx.fillStyle = sh; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  if (P.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${P.flash * 3})`; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  ctx.restore();
  if (look.ring) drawRing(x, y, r, false, glow);
  planetOverlays(sys, t);
}
function planetOverlays(sys, t) {
  const P = sys.planet, x = sys.cx, y = sys.cy, r = sys.pr;
  if (sys.side === 'me' && G.shield > 0) {
    ctx.strokeStyle = `rgba(91,140,255,${.35 + .25 * Math.sin(t * 8)})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r * 1.45, 0, TAU); ctx.stroke();
  }
  if (sys.side === 'me' && G.pShield > 0) {
    ctx.strokeStyle = 'rgba(140,242,198,.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, r * 1.2, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(G.pShield / (P.maxHp * .2), 0, 1)); ctx.stroke();
  }
  if (P.dot) { ctx.strokeStyle = sys.side === 'me' ? 'rgba(255,120,60,.6)' : 'rgba(157,255,106,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, TAU); ctx.stroke(); }
}
function drawRing(x, y, r, back, glow) {
  ctx.save(); ctx.strokeStyle = `rgba(${glow},.55)`; ctx.lineWidth = r * .14;
  ctx.beginPath(); ctx.ellipse(x, y, r * 1.8, r * .45, -.25, back ? Math.PI : 0, back ? TAU : Math.PI); ctx.stroke();
  ctx.strokeStyle = `rgba(${glow},.25)`; ctx.lineWidth = r * .06;
  ctx.beginPath(); ctx.ellipse(x, y, r * 2.05, r * .52, -.25, back ? Math.PI : 0, back ? TAU : Math.PI); ctx.stroke();
  ctx.restore();
}
function drawHole(x, y, r, t, P) {
  const hg = ctx.createRadialGradient(x, y, r * .8, x, y, r * 3);
  hg.addColorStop(0, 'rgba(255,170,90,.35)'); hg.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill();
  for (const back of [true, false]) {
    if (!back) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(255,220,170,.9)'; ctx.lineWidth = 2; ctx.stroke(); }
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = `rgba(255,${170 + i * 25},${90 + i * 40},${.7 - i * .18})`; ctx.lineWidth = r * (.22 - i * .05);
      ctx.beginPath(); ctx.ellipse(x, y, r * (1.6 + i * .35), r * (.38 + i * .08), .05 * Math.sin(t), back ? Math.PI : 0, back ? TAU : Math.PI); ctx.stroke();
    }
  }
  if (P.flash > 0) { ctx.strokeStyle = `rgba(255,255,255,${P.flash * 4})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 1.05, 0, TAU); ctx.stroke(); }
  planetOverlays(G.foe, t);
}
function drawMoonSat(sys, t, front) {
  if (sys.planet.kind !== 'earth') return;
  const a = t * .9, sx = sys.cx + Math.cos(a) * sys.pr * 1.75, sy = sys.cy + Math.sin(a) * sys.pr * .55;
  if ((Math.sin(a) > 0) !== front) return;
  const r = sys.pr * .22, g = ctx.createRadialGradient(sx - r * .3, sy - r * .3, 0, sx, sy, r);
  g.addColorStop(0, '#f4f4f8'); g.addColorStop(1, '#5a5d70');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, r, 0, TAU); ctx.fill();
}

function drawCon(sys, c, t) {
  if (c.alpha <= 0) return;
  const k = conSize(sys) * c.s, pts = c.def.sh.pts.map(([px, py]) => [c.x + px * k, c.y + py * k * .85]);
  const mine = c.side === 'me';
  const lineC = c.def.special ? '213,139,255' : mine ? '245,196,81' : '255,123,138';
  ctx.globalAlpha = c.alpha * (c.stun > 0 ? .55 : 1);
  ctx.lineCap = 'round';
  const glowW = mine && c.chain ? 5 + c.chain * 2 : 5;
  for (const [w, a] of [[glowW * c.s, .18], [1.5 * c.s, .95]]) {
    ctx.strokeStyle = `rgba(${lineC},${a})`; ctx.lineWidth = w;
    ctx.beginPath();
    for (const [i, j] of c.def.sh.edges) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); }
    ctx.stroke();
  }
  ctx.fillStyle = c.flash > 0 ? '#ffffff' : '#fff1c2';
  for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, 2.1 * c.s, 0, TAU); ctx.fill(); }
  const [kx, ky] = pts[c.def.sh.key];
  ctx.strokeStyle = c.def.special ? '#c35bff' : mine ? '#ff5a6e' : '#ff9a5a'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(kx, ky, 6 * c.s, 0, TAU); ctx.stroke();
  if (c.invuln > 0) { ctx.strokeStyle = 'rgba(169,193,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, k * 1.1, 0, TAU); ctx.stroke(); }
  if (c.stun > 0) { ctx.strokeStyle = 'rgba(195,91,255,.8)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(c.x, c.y, k * 1.15, t * 3, t * 3 + TAU); ctx.stroke(); ctx.setLineDash([]); }
  if (c.dot) { ctx.fillStyle = 'rgba(157,255,106,.9)'; for (let i = 0; i < (c.dot.stacks || 1); i++) { ctx.beginPath(); ctx.arc(c.x + k + i * 5, c.y - k * .6, 2.3, 0, TAU); ctx.fill(); } }
  if (G.state === 'home') { ctx.globalAlpha = 1; return; }
  const bw = k * 1.7, bx = c.x - bw / 2, by = c.y + k * .95;
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(bx, by, bw, 3);
  ctx.fillStyle = mine ? '#52e3a4' : '#ff5a6e'; ctx.fillRect(bx, by, bw * clamp(c.hp / c.maxHp, 0, 1), 3);
  if (mine && (c.lv > 1 || c.chain)) {
    ctx.font = `700 ${Math.round(10 * c.s + 1)}px "Chakra Petch", sans-serif`; ctx.fillStyle = '#f5c451'; ctx.textAlign = 'left';
    ctx.fillText((c.lv > 1 ? 'Lv' + c.lv : '') + (c.chain ? ' ' + ROMAN[c.chain] : ''), bx + bw + 3, by + 4);
  }
  ctx.globalAlpha = 1;
}
function drawSystem(sys, t) {
  ctx.save(); ctx.strokeStyle = sys.side === 'me' ? 'rgba(245,196,81,.22)' : 'rgba(255,123,138,.2)';
  ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
  ctx.beginPath(); ctx.ellipse(sys.cx, sys.cy, sys.R, sys.ry, 0, 0, TAU); ctx.stroke(); ctx.restore();
  const back = sys.cons.filter(c => c.depth < 0).sort((a, b) => a.y - b.y);
  const front = sys.cons.filter(c => c.depth >= 0).sort((a, b) => a.y - b.y);
  back.forEach(c => drawCon(sys, c, t));
  drawMoonSat(sys, t, false);
  drawPlanet(sys, t);
  drawMoonSat(sys, t, true);
  front.forEach(c => drawCon(sys, c, t));
}
function drawReticle(t) {
  if (!G.focus || !alive(G.focus) || G.state !== 'fight') return;
  const [x, y] = posOf(G.focus);
  const r = (G.focus.isPlanet ? G.foe.pr * 1.3 : conSize(G.foe) * G.focus.s * 1.3) + 2 * Math.sin(t * 6);
  ctx.strokeStyle = '#f5c451'; ctx.lineWidth = 1.8;
  for (let i = 0; i < 4; i++) { const a = i * TAU / 4 + t; ctx.beginPath(); ctx.arc(x, y, r, a, a + .7); ctx.stroke(); }
}
function draw(t) {
  drawBg(t);
  if (!G.me) return;
  drawSystem(G.foe, t); drawSystem(G.me, t);
  drawReticle(t);
  for (const b of G.beams) {
    ctx.globalAlpha = clamp(b.t * 6, 0, 1); ctx.strokeStyle = b.c; ctx.lineWidth = b.w;
    ctx.beginPath(); ctx.moveTo(b.x1, b.y1);
    if (b.zig) { for (let i = 1; i < 8; i++) { const f = i / 8; ctx.lineTo(b.x1 + (b.x2 - b.x1) * f + rnd(-8, 8), b.y1 + (b.y2 - b.y1) * f + rnd(-8, 8)); } }
    ctx.lineTo(b.x2, b.y2); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const p of G.proj) {
    ctx.strokeStyle = p.col; ctx.fillStyle = p.col; ctx.lineWidth = p.w; ctx.lineCap = 'round';
    if (p.orb) { ctx.beginPath(); ctx.arc(p.x, p.y, p.w, 0, TAU); ctx.fill(); ctx.globalAlpha = .3; ctx.beginPath(); ctx.arc(p.x, p.y, p.w * 2.2, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
    else { const vx = p.vx || 0, vy = p.vy || 1; ctx.beginPath(); ctx.moveTo(p.x - vx * p.len, p.y - vy * p.len); ctx.lineTo(p.x, p.y); ctx.stroke(); }
  }
  for (const f of G.fx) { ctx.globalAlpha = clamp(f.t * 1.6, 0, 1); ctx.fillStyle = f.c; ctx.fillRect(f.x - 1.2, f.y - 1.2, 2.4, 2.4); }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'center';
  for (const tx of G.texts) {
    ctx.globalAlpha = clamp(tx.t * 2, 0, 1);
    const num = typeof tx.v === 'number';
    ctx.font = num ? `700 ${tx.size || 13}px "Chakra Petch", sans-serif` : '700 12px "Noto Sans KR", sans-serif';
    if (tx.c === CRIT_COL[5]) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeText(tx.v, tx.x, tx.y); }
    ctx.fillStyle = tx.c; ctx.fillText(tx.v, tx.x, tx.y);
  }
  ctx.globalAlpha = 1;
}

/* ---------- HUD ---------- */
const pipEls = [];
for (let i = 0; i < 10; i++) { const s = document.createElement('span'); $('pips').appendChild(s); pipEls.push(s); }
function hud() {
  if (!G.me || $('hudTop').hidden) return;
  const fp = G.foe.planet, mp = G.me.planet;
  $('foeHp').style.transform = `scaleX(${clamp(fp.hp / fp.maxHp, 0, 1)})`;
  $('myHp').style.transform = `scaleX(${clamp(mp.hp / mp.maxHp, 0, 1)})`;
  $('foeHpTxt').textContent = `${Math.ceil(fp.hp).toLocaleString()} / ${fp.maxHp.toLocaleString()}`;
  $('myHpTxt').textContent = `${Math.ceil(mp.hp).toLocaleString()} / ${mp.maxHp.toLocaleString()}` + (G.pShield > 1 ? ` (+${Math.round(G.pShield)})` : '');
  $('xpBar').style.transform = `scaleX(${clamp(G.xp / xpNeed(G.lv), 0, 1)})`;
  $('lvTxt').textContent = `Lv ${G.lv - G.pendingLv}`;
  const tm = $('timer');
  tm.textContent = G.enraged ? '폭주' : Math.max(0, G.timer).toFixed(1);
  tm.classList.toggle('rage', G.enraged);
  pipEls.forEach((p, i) => p.classList.toggle('on', i < G.energy));
  for (const [id, cost] of [['skMeteor', 3], ['skShield', 2], ['skNova', 4]]) {
    const b = $(id), ok = G.energy >= cost && G.state === 'fight';
    b.disabled = !ok; b.classList.toggle('ready', ok);
  }
  $('durShield').style.width = `${clamp(G.shield / SHIELD_T, 0, 1) * 100}%`;
  $('durNova').style.width = `${clamp(G.nova / NOVA_T, 0, 1) * 100}%`;
}

