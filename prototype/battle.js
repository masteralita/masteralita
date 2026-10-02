'use strict';
/* ---------- Canvas ---------- */
const cv = $('cv'), mainCtx = cv.getContext('2d');
let ctx = mainCtx; // swapped to a preview canvas by drawPreview()
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
  state: 'title', shake: 0, mode: 'arcade', ghost: null, kills: 0, wave: 1, timer: 40, energy: 2, maxEnergy: 10, focus: null, me: null, foe: null, zone: ZONES[0],
  proj: [], beams: [], fx: [], texts: [], shield: 0, nova: 0, roar: 0, roarV: .3, pShield: 0, enraged: false, bossCd: 6, bossCd2: 8,
  paused: false, choosing: false, clearT: 0, introT: 0, goT: 0, lv: 1, xp: 0, pendingLv: 0, taken: [],
  T: { armor: 0, marmor: 0, evade: 0, dmgRed: 0, planetRed: 0 },
};
const SHIELD_T = 6, NOVA_T = 6;
const SHAKE_MAX = 4.5; // px — kept small on purpose
const REDUCED_MOTION = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const xpNeed = lv => 30 + 18 * (lv - 1);

function makeCon(def, side, mult) {
  const hp = Math.round(def.hp * mult.hp);
  return { def, side, hp, maxHp: hp, baseHp: hp, atkBase: def.atk * mult.atk, rate: def.rate, dArmor: def.def, mArmor: def.mdef,
    lv: 1, cd: rnd(.2, 1.2), dead: false, stun: 0, dot: null, slow: 0, shred: 0, invuln: 0, x: 0, y: 0, s: 1, flash: 0, alpha: 1,
    m: { atk: 0, rate: 0, crit: 0, critDmg: 0, hp: 0, heal: 0, poison: 0 }, stacks: {}, chain: 0,
    shots: 0, heals: 0, focusStack: 0, lastT: null, revived: false, molted: false,
    skin: SKIN[def.id], style: def.style, kind: def.kind, fxOn: {}, fxT: {} };
}
// Each system has 1–2 separate orbits (inner → outer), each with its own period. My orbits come from the planet
// and the team formation (ringOf[i] = orbit of cons[i]); enemies are dealt round-robin.
// sys.phase is a separate 7s clock that only drives energy (기력), so energy pacing stays the same.
const ORBIT_RF = [[.8], [.5, 1]];                                        // ring radius as a share of R
const ORBIT_PERIOD = { me: [[8], [6.5, 10]], foe: [[9.5], [7.5, 11.5]] }; // seconds per lap
const PLANET_RF = [.17, .22, .26];                                        // planet radius share of R: normal / mid boss / zone boss
const ORBIT_TILT = .45;                                                  // ry = R × tilt (2.5D ellipse)
function makeSystem(side, planet, cons, ringOf) {
  const n = ringOf ? clamp(planet.orbits || 1, 1, 2) : clamp(cons.length, 1, ORBIT_RF.length);
  const rings = ORBIT_RF[n - 1].map((rf, k) => ({ rf, phase: rnd(0, TAU), speed: TAU / ORBIT_PERIOD[side][n - 1][k], cons: [],
    skin: (planet.orbitSkins && planet.orbitSkins[k]) || 'dash' }));
  cons.forEach((c, i) => { const k = ringOf ? ringOf[i] : i % n, r = rings[k]; c.ring = k; c.slot = r.cons.length; r.cons.push(c); });
  return { side, planet, cons, rings, phase: rnd(0, TAU), speed: TAU / (side === 'me' ? 7 : 8.5), orbits: 0, cx: 0, cy: 0, R: 0, ry: 0, pr: 0 };
}
function layout() {
  const top = 104, bot = 224, band = Math.max(200, H - top - bot);
  const R = Math.min(W * .41, band * .42), ry = R * ORBIT_TILT;
  const margin = ry + R * .22 * .95; // outer ring plus a constellation's half-height
  for (const [sys, cy] of [[G.foe, top + margin], [G.me, H - bot - margin]]) {
    if (!sys) continue;
    sys.cx = W / 2; sys.cy = cy; sys.R = R; sys.ry = ry;
    sys.pr = R * PLANET_RF[sys.planet.bossTier || 0];
  }
}
// Active awakening effect of a given type on one of my constellations (null if the skin hasn't unlocked it)
const E = (c, type) => c && c.side === 'me' ? c.fxOn[type] || null : null;
const myCons = id => G.me ? G.me.cons.filter(c => c.def.id === id) : [];

// Builds the player's center planet object from its definition + planet level (행성 탭)
function makePlayerPlanet(pid, lv, cos = {}) {
  const d = PLANET[pid], t = d.trait, sb = (PSKIN[cos.skin] || PSKIN.basic).bonus;
  const hp = Math.round(d.hp * planetHpMul(lv) * (1 + (sb.hp || 0)));
  return { isPlanet: true, kind: d.kind, look: d.look, name: d.name, hp, maxHp: hp, baseHp: hp, dArmor: 20, mArmor: 20,
    orbits: d.orbits, skin: cos.skin || 'basic', orbitSkins: cos.orbitSkins || [],
    regen: t.regen || 0, rateMul: t.rateMul || 1, atkMul: (t.atkMul || 1) * (1 + (sb.atk || 0)), crit: t.crit || 0, dmgRed: (t.dmgRed || 0) + (sb.dmgRed || 0), energy: t.energy || 0,
    flash: 0, dot: null, side: 'me' };
}
// Constellation with account-side bonuses (grade + star parts from 별자리 탭)
// os = base stats of the orbit it sits on (궤도 능력치)
function makeMyCon(id, os = { atk: 0, rate: 0, hp: 0 }, skinId) {
  const b = conBonus(id), sk = SKIN[skinId || equippedSkin(id)], mod = sk.mod || {};
  const c = makeCon(CON[id], 'me', { hp: b.hp * (mod.hp || 1) * (1 + os.hp), atk: b.atk * (mod.atk || 1) * (1 + os.atk) });
  c.m.rate = b.rate * (mod.rate || 1) * (1 + os.rate) - 1; c.grade = b.grade;
  c.skin = sk; c.style = sk.style || CON[id].style; c.kind = sk.kind || CON[id].kind;
  return c;
}
function startRun(mode) {
  G.me = buildMySystem();
  const P = G.me.planet;
  Object.assign(G, { mode, wave: 1, kills: 0, energy: 2 + P.energy, shield: 0, nova: 0, roar: 0, pShield: 0, proj: [], beams: [], fx: [], texts: [],
    lv: 1, xp: 0, pendingLv: 0, taken: [], zone: ZONES[0], choosing: false, paused: false });
  G.T = { armor: 0, marmor: 0, evade: 0, dmgRed: 0, planetRed: P.dmgRed };
  $('myName').textContent = P.name;
  showBattleUi(true);
  if (mode === 'pvp') { startPvp(); maxOutPvp(); } else startWave();
  beginIntro();
}
// Battle opening: both systems slide in (foe from the top, me from the bottom), then 3·2·1 and the fight starts.
// While G.state is 'intro' nothing attacks, the timer holds and taps/skills are ignored (they all check 'fight').
const INTRO_SLIDE = 2, INTRO_COUNT = 3;
function beginIntro() { G.state = 'intro'; G.introT = REDUCED_MOTION ? INTRO_SLIDE : 0; G.goT = 0; }
function updateIntro(dt) {
  G.introT += dt;
  if (G.introT >= INTRO_SLIDE + INTRO_COUNT) { G.state = 'fight'; G.goT = .7; }
}
const easeOut = x => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
// How far a system is still pushed off-screen during the slide-in (0 once it has landed)
function introOffset(sys) {
  if (G.state !== 'intro') return 0;
  const k = 1 - easeOut(G.introT / INTRO_SLIDE);
  return sys.side === 'foe' ? -k * (sys.cy + sys.R) : k * (H - sys.cy + sys.R);
}
function drawCountdown() {
  let v, f;
  if (G.state === 'intro' && G.introT >= INTRO_SLIDE) { const c = G.introT - INTRO_SLIDE; v = String(INTRO_COUNT - Math.floor(c)); f = c % 1; }
  else if (G.goT > 0) { v = 'START'; f = 1 - G.goT / .7; }
  else return;
  const size = (v === 'START' ? 46 : 84) * (1.35 - .35 * easeOut(f * 4));
  ctx.save();
  ctx.globalAlpha = f > .75 ? (1 - f) * 4 : 1;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `700 ${Math.round(size)}px "Chakra Petch", sans-serif`;
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(10,8,30,.85)'; ctx.strokeText(v, W / 2, H / 2);
  ctx.fillStyle = '#f5c451'; ctx.shadowColor = 'rgba(245,196,81,.7)'; ctx.shadowBlur = 18; ctx.fillText(v, W / 2, H / 2);
  ctx.restore();
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
  const P = makePlayerPlanet(pid, 1 + Math.floor(Math.random() * 3), { skin: PLANET_SKINS[Math.floor(Math.random() * PLANET_SKINS.length)].id });
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
  const deep = Math.max(0, n - WAVE.deepFrom);
  const m = Math.pow(WAVE.statGrowth, n - 1) * Math.pow(WAVE.deepGrowth, deep);
  const look = bossTier === 2 ? z.boss : bossTier === 1 ? z.mid : z.foes[Math.floor(Math.random() * z.foes.length)];
  const base = z === ZONES[0] ? 2 : z === ZONES[1] ? 3 : 4;
  const count = bossTier ? base + 1 : Math.min(base + Math.floor(((n - 1) % 10) / 4), base + 2);
  const pool = Array.from({ length: count }, () => ZODIAC[Math.floor(Math.random() * ZODIAC.length)]);
  const pHp = Math.round(WAVE.planetHp * Math.pow(WAVE.planetGrowth, n - 1) * Math.pow(WAVE.deepGrowth, deep) * (bossTier === 2 ? WAVE.zoneBossHp : bossTier === 1 ? WAVE.midBossHp : 1));
  G.foe = makeSystem('foe', { isPlanet: true, look, kind: look.kind, bossTier, ability: bossTier ? (look.ability || 'stun') : null,
    name: look.name, hp: pHp, maxHp: pHp, dArmor: 15 + n * 2, mArmor: 15 + n * 2, flash: 0, dot: null, shred: 0, side: 'foe' },
    pool.map(d => makeCon(d, 'foe', { hp: WAVE.conHp * m, atk: WAVE.conAtk * m })));
  for (const c of G.me.cons) { c.dead = false; c.hp = c.maxHp; c.alpha = 1; c.stun = 0; c.dot = null; c.revived = false; c.molted = false; c.invuln = 0; }
  const P = G.me.planet; if (n > 1) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .15);
  G.timer = WAVE.timer; G.enraged = false; G.bossCd = 5; G.bossCd2 = 8; G.focus = null; G.proj = []; G.beams = [];
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
function critDmg(c) { const e = E(c, 'critDmg'); return 1.5 + c.m.critDmg + (e ? e.v : 0); }
function evadeRate() { return Math.min(.75, G.T.evade); }
function conAtk(c) {
  let a = c.atkBase * (1 + .3 * (c.lv - 1)) * (1 + c.m.atk);
  if (c.side === 'me') {
    a *= G.me.planet.atkMul;
    if (G.roar > 0) a *= 1 + G.roarV;
    let e;
    if ((e = E(c, 'rage'))) a *= 1 + e.max * clamp(1 - c.hp / c.maxHp, 0, 1);
    if ((e = E(c, 'balance')) && G.foe.planet.hp / G.foe.planet.maxHp > G.me.planet.hp / G.me.planet.maxHp) a *= e.mul;
    if ((e = E(c, 'amp'))) a *= e.mul;
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
  let dmg = base, tier = 0, e;
  if (src && src.side === 'me') {
    if ((e = E(src, 'execute')) && t.hp / t.maxHp <= e.th) dmg *= e.mul;
    if ((e = E(src, 'poisonBonus')) && t.dot) dmg *= e.mul;
    if ((e = E(src, 'pctDmg'))) dmg += t.maxHp * e.v;
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
      for (const l of G.me.cons) if (E(l, 'evadeCounter') && !l.dead) fire(l, true);
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
  if (t.side === 'me' && t.isPlanet && d > 0 && !REDUCED_MOTION) G.shake = Math.min(SHAKE_MAX, G.shake + 1 + 40 * d / t.maxHp);
  if (!silent) {
    const big = tier >= 1;
    say(x + rnd(-10, 10), y - 14, Math.max(1, Math.round(d)), color || (t.side === 'me' ? '#ff8a9a' : CRIT_COL[tier]), big ? 1 : .8, big ? 13 + tier * 2 : 13);
  }
  let e;
  if (src && src.side === 'me' && (e = E(src, 'leech'))) G.me.planet.hp = Math.min(G.me.planet.maxHp, G.me.planet.hp + d * e.v);
  // reactions on my side
  if (t.side === 'me' && !t.isPlanet && src && alive(src)) {
    if ((e = E(t, 'reflect'))) applyDamage(src, d * e.v, 'phys', { color: '#ffd76a' });
    if ((e = E(t, 'counter')) && chance(e.p)) fire(t, true);
  }
  if (t.side === 'me' && !t.isPlanet && (e = E(t, 'molt')) && !t.molted && t.hp > 0 && t.hp < t.maxHp * e.th) {
    t.molted = true; t.invuln = e.dur; say(x, y - 26, '무적', '#a9c1ff', 1);
  }
  if (t.hp <= 0) {
    t.hp = 0;
    if (t.isPlanet) { burst(x, y, 60, t.side === 'me' ? '#8cf2c6' : '#ffb27a'); onPlanetDown(t.side); }
    else killCon(t, src);
  }
}
function killCon(t, src) {
  const [x, y] = posOf(t);
  let e;
  if ((e = E(t, 'revive')) && !t.revived) {
    t.revived = true; t.hp = t.maxHp * e.hp; say(x, y - 24, '부활', '#f5c451', 1); burst(x, y, 14, '#f5c451'); return;
  }
  t.dead = true; burst(x, y, 26, t.side === 'me' ? '#ff8a9a' : '#f5c451');
  if (G.focus === t) G.focus = null;
  if (t.side === 'foe') {
    G.kills += 1;
    gainXp(6 + G.wave);
    if ((e = E(src, 'energyKill'))) { G.energy = Math.min(G.maxEnergy, G.energy + e.v); say(x, y - 26, '기력 +' + e.v, '#f5c451', 1); }
    if (t.dot && G.me.cons.some(s => E(s, 'poisonSpread'))) {
      const live = G.foe.cons.filter(x => !x.dead && x !== t), n = live[Math.floor(Math.random() * live.length)];
      if (n) { n.dot = { dps: t.dot.dps, t: 4, stacks: t.dot.stacks || 1, burn: t.dot.burn }; G.beams.push({ x1: x, y1: y, x2: n.x, y2: n.y, t: .3, c: t.dot.burn ? '#ff8a4a' : '#9dff6a', w: 2 }); }
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
    const c = G.me.cons.find(x => x.def.id === id), S = c.skin;
    for (const [k, name] of S.stats) {
      const n = c.stacks[k] || 0;
      if (n < STAT_MAX) opts.push({ type: 'stat', id, k, name, lvl: n + 1, desc: STAT[k].txt(STAT[k].v) });
    }
    if (c.chain < 3) { const ch = S.chain[c.chain]; opts.push({ type: 'chain', id, lvl: c.chain + 1, name: ch.name, desc: ch.desc }); }
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
// 대전 has no in-battle level up: both sides start with every stat card and awakening already taken.
// Awakening effects only run on my side (E() is mine-only), so the ghost gets PVP_FOE_AWAKEN on HP/attack instead.
const PVP_FOE_AWAKEN = 1.25;
function maxOutPvp() {
  for (const id of new Set(G.me.cons.map(c => c.def.id))) {
    const S = G.me.cons.find(c => c.def.id === id).skin;
    for (const [k] of S.stats) for (let n = 1; n <= STAT_MAX; n++) applyPerk({ type: 'stat', id, k, lvl: n }, true);
    for (let n = 1; n <= 3; n++) applyPerk({ type: 'chain', id, lvl: n }, true);
  }
  G.me.planet.hp = G.me.planet.maxHp;
  const F = G.foe, pBase = F.planet.maxHp;
  for (const id of new Set(F.cons.map(c => c.def.id))) {
    const cons = F.cons.filter(c => c.def.id === id);
    for (const [k] of cons[0].skin.stats) {
      const v = STAT[k].v * STAT_MAX;
      for (const c of cons) if (k in c.m) c.m[k] += v;
      if (k === 'tArmor') F.cons.forEach(x => x.dArmor += v);
      if (k === 'tMArmor') F.cons.forEach(x => x.mArmor += v);
      if (k === 'pHp') F.planet.maxHp += Math.round(pBase * v);
    }
  }
  for (const c of F.cons) {
    c.atkBase *= PVP_FOE_AWAKEN; c.baseHp = Math.round(c.baseHp * PVP_FOE_AWAKEN);
    c.maxHp = Math.round(c.baseHp * (1 + c.m.hp)); c.hp = c.maxHp;
  }
  F.planet.hp = F.planet.maxHp;
}
function applyPerk(o, quiet = false) {
  if (o.type === 'repair') { heal(G.me.planet, G.me.planet.maxHp * .3); G.taken.push('행성 수리'); return; }
  const cons = G.me.cons.filter(c => c.def.id === o.id);
  const d = CON[o.id];
  if (o.type === 'chain') {
    const ch = cons[0].skin.chain[o.lvl - 1];
    for (const c of cons) { c.chain = o.lvl; c.fxOn[ch.type] = ch.p; c.fxT[ch.type] = 0; }
    if (FX_TEAM[ch.type]) G.T[FX_TEAM[ch.type]] += ch.p.v;
    if (quiet) return;
    G.taken.push(`${cons[0].skin.name} ${ROMAN[o.lvl]} ${o.name}`);
    banner(`각성 ${ROMAN[o.lvl]}`, `${cons[0].skin.name} · ${o.name}`, 1.2);
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
  if (!quiet) G.taken.push(`${d.name} ${o.name} +${o.lvl}`);
}

/* ---------- Firing ---------- */
function projOf(c, t, over = {}) {
  const mine = c.side === 'me';
  const col = mine ? c.skin.pal.proj : '#ff7b8a';
  const atk = conAtk(c);
  const burn = mine && c.skin.tier === 'supernova';
  const S = {
    arrow:  { sp: 520, dmg: atk, kind: c.kind === 'magic' ? 'magic' : 'phys', col, w: 1.6, len: 12 },
    shot:   { sp: 360, dmg: atk, kind: c.kind === 'magic' ? 'magic' : 'phys', col, w: 3, len: 6 },
    orb:    { sp: 240, dmg: atk, kind: 'magic', col: mine ? c.skin.pal.proj : '#ff8ad0', w: 4.5, len: 0, orb: true },
    poison: { sp: 300, dmg: atk * .6, kind: c.kind === 'magic' ? 'magic' : 'phys', col: burn ? '#ff8a4a' : mine && c.skin.tier === 'nebula' ? '#c77dff' : '#9dff6a', w: 3, len: 5, poison: atk * .5 * (1 + c.m.poison), burn },
  }[c.style] || { sp: 320, dmg: atk, kind: 'magic', col, w: 3, len: 0, orb: true };
  return Object.assign({ x: c.x, y: c.y, t, src: c }, S, over);
}
// One volley of a constellation's basic attack (style comes from its skin)
function volley(c, t, mul) {
  const sys = sysOf(c.side), mine = c.side === 'me', [tx, ty] = posOf(t);
  let e;
  switch (c.style) {
    case 'arrow': case 'orb': case 'shot': case 'poison': {
      const p = projOf(c, t); p.dmg *= mul; G.proj.push(p);
      if ((e = E(c, 'extraProj'))) for (let i = 0; i < e.n; i++) G.proj.push(Object.assign(projOf(c, t), { dmg: p.dmg, x: c.x + 8 * (i + 1), y: c.y - 4, sp: p.sp * .88 }));
      break;
    }
    case 'twin':
      G.proj.push(projOf(c, t, { x: c.x - 4, sp: 380, kind: 'phys', w: 2.4, len: 8, orb: false, dmg: conAtk(c) * mul }));
      G.proj.push(projOf(c, t, { x: c.x + 4, sp: 300, kind: 'magic', col: '#9fb8ff', w: 3.5, len: 0, orb: true, dmg: conAtk(c) * mul }));
      if ((e = E(c, 'extraProj'))) G.proj.push(projOf(c, t, { x: c.x, y: c.y - 6, sp: 340, kind: 'magic', col: '#c9b6ff', w: 3, len: 0, orb: true, dmg: conAtk(c) * mul }));
      break;
    case 'beam': {
      const col = mine ? c.skin.pal.proj : '#ff7b8a';
      G.beams.push({ x1: c.x, y1: c.y, x2: tx, y2: ty, t: .18, c: col, w: c.def.special ? 3 : 2.4 });
      beamHit(c, t, conAtk(c) * mul);
      if ((e = E(c, 'pierceBeam'))) {
        const t2 = randomOtherEnemy(c, t) || (t.isPlanet ? null : other(c.side).planet);
        if (t2 && (t2.isPlanet ? !other(c.side).cons.some(x => !x.dead) : true)) { const [x2, y2] = posOf(t2); G.beams.push({ x1: tx, y1: ty, x2, y2, t: .18, c: col, w: 1.8 }); beamHit(c, t2, conAtk(c) * e.v); }
      }
      if ((e = E(c, 'twinBeam'))) {
        G.beams.push({ x1: c.x + 6, y1: c.y + 4, x2: tx + rnd(-8, 8), y2: ty + rnd(-8, 8), t: .18, c: col, w: 2 });
        beamHit(c, t, conAtk(c) * e.v);
      }
      break;
    }
    case 'heal': {
      const P = sys.planet;
      c.heals += 1;
      let amt = conAtk(c) * 4 * (1 + c.m.heal);
      if ((e = E(c, 'lowHpHeal')) && P.hp < P.maxHp * e.th) amt *= e.mul;
      G.beams.push({ x1: c.x, y1: c.y, x2: sys.cx, y2: sys.cy, t: .25, c: '#8cf2c6', w: 2 });
      const over = heal(P, amt);
      if ((e = E(c, 'overheal')) && over > 0) G.pShield = Math.min(P.maxHp * e.cap, G.pShield + over);
      const hurt = sys.cons.filter(x => !x.dead && x.hp < x.maxHp).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (hurt) heal(hurt, amt * .6);
      if ((e = E(c, 'nthHeal')) && c.heals % e.every === 0) { for (const a of sys.cons) if (!a.dead) heal(a, a.maxHp * e.v); say(c.x, c.y - 22, '전체 회복', '#8cf2c6', .8); }
      G.proj.push(projOf(c, t, { dmg: conAtk(c) * .5 * mul, col: mine ? c.skin.pal.proj : '#8cf2c6', w: 3, orb: true, len: 0 }));
      break;
    }
  }
}
function fire(c, counter = false) {
  const t = pickTarget(c);
  if (!alive(t)) return;
  c.shots += 1;
  let mul = 1, e;
  if ((e = E(c, 'focus'))) { c.focusStack = c.lastT === t ? Math.min(e.max, c.focusStack + 1) : 0; c.lastT = t; mul *= 1 + e.v * c.focusStack; }
  if ((e = E(c, 'nth')) && c.shots % e.every === 0) { mul *= e.mul; say(c.x, c.y - 22, `×${e.mul}`, '#f5c451', .7); }
  volley(c, t, mul);
  if ((e = E(c, 'multishot')) && c.shots % e.every === 0) {
    for (let i = 0; i < e.n; i++) { const o = randomOtherEnemy(c, t) || t; G.proj.push(projOf(c, o, { x: c.x + rnd(-6, 6) })); }
  }
  if ((e = E(c, 'echo')) && chance(e.p)) setTimeout(() => { if (!c.dead && G.state === 'fight') { const t2 = pickTarget(c); if (alive(t2)) volley(c, t2, 1); } }, 140);
  if (counter) say(c.x, c.y - 22, '반격', '#ffd76a', .6);
}
function beamHit(c, t, dmg) {
  strike(c, t, dmg, c.kind === 'both' ? 'phys' : c.kind, { color: c.def.special && c.side === 'me' ? '#e7b6ff' : null });
  afterHit(c, t, dmg, false);
}
function onProjHit(p) {
  const c = p.src, t = p.t, mine = c && c.side === 'me';
  strike(c, t, p.dmg, p.kind, { color: p.meteor ? '#ffe9a8' : null });
  if (!mine || !c) return;
  if (p.poison && alive(t)) {
    const e = E(c, 'poisonStack'), cap = e ? e.max : 1;
    const st = t.dot && t.dot.stacks ? Math.min(cap, t.dot.stacks + 1) : 1;
    t.dot = { dps: p.poison * st, t: 4, stacks: st, burn: p.burn };
  }
  afterHit(c, t, p.dmg, p.bounced, p);
}
// On-hit awakenings shared by projectiles and beams
function afterHit(c, t, dmg, bounced, p) {
  if (!c || c.side !== 'me') return;
  let e;
  if (!t.isPlanet && alive(t)) {
    if ((e = E(c, 'stun')) && chance(e.p)) { t.stun = Math.max(t.stun, e.dur); say(t.x, t.y - 22, '기절', '#d58bff', .6); }
    if ((e = E(c, 'shred'))) t.shred = Math.min(e.max, (t.shred || 0) + e.v);
    if ((e = E(c, 'slow'))) { t.slow = e.dur; t.slowV = e.v; }
  }
  if ((e = E(c, 'applyPoison')) && alive(t) && (!e.planetOnly || t.isPlanet)) t.dot = { dps: conAtk(c) * e.v, t: 4, stacks: 1, burn: !!e.burn };
  if ((e = E(c, 'splash'))) {
    const [x, y] = posOf(t);
    for (const o of other(c.side).cons) if (!o.dead && o !== t && Math.hypot(o.x - x, o.y - y) < 80) strike(c, o, dmg * e.v, 'magic');
    G.fx.push(...Array.from({ length: 8 }, () => ({ x, y, vx: rnd(-60, 60), vy: rnd(-30, 30), t: .4, c: c.skin.pal.proj })));
  }
  if ((e = E(c, 'bounce')) && p && !bounced) {
    const n = randomOtherEnemy(c, t);
    if (n) { const [x, y] = posOf(t); G.proj.push(Object.assign({}, p, { x, y, t: n, dmg: dmg * e.v, bounced: true })); }
  }
  if ((e = E(c, 'planetChip')) && !t.isPlanet) applyDamage(other(c.side).planet, dmg * e.v, c.kind === 'magic' ? 'magic' : 'phys', { src: c, silent: true });
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
function conSize(sys) { return sys.R * .22; }
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
function periodic(c, sys, dt) {
  const tick = (type, fn) => { const e = c.fxOn[type]; if (!e) return; c.fxT[type] = (c.fxT[type] || 0) + dt; if (c.fxT[type] >= e.every) { c.fxT[type] = 0; fn(e); } };
  tick('roar', e => { G.roar = e.dur; G.roarV = e.v; say(c.x, c.y - 24, '포효', '#f5c451', 1); });
  tick('cleanse', e => { for (const a of sys.cons) if (!a.dead) { a.stun = 0; a.dot = null; heal(a, a.maxHp * e.heal); } say(c.x, c.y - 24, '정화', '#9fb8ff', 1); });
  tick('quake', e => { say(c.x, c.y - 24, '지진', '#f5c451', 1); for (const x of G.foe.cons) if (!x.dead) strike(c, x, conAtk(c) * e.mul, 'phys'); });
  tick('shieldPulse', e => { const P = sys.planet; G.pShield = Math.min(P.maxHp * .3, G.pShield + P.maxHp * e.v); say(sys.cx, sys.cy - sys.pr - 12, '보호막', '#8cf2c6', 1); });
  tick('energyPulse', () => { G.energy = Math.min(G.maxEnergy, G.energy + 1); say(c.x, c.y - 24, '기력 +1', '#f5c451', 1); });
  tick('meteorCall', e => {
    const t = G.focus && alive(G.focus) ? G.focus : pickTarget(c); if (!alive(t)) return;
    const [tx] = posOf(t);
    for (let i = 0; i < e.n; i++) G.proj.push({ x: tx + rnd(-50, 50) - 70, y: -20 - i * 40, t, src: c, sp: 680, dmg: conAtk(c) * e.mul, kind: 'magic', col: '#ffe9a8', w: 4, len: 24, meteor: true, bounced: true });
  });
}
function updateSystem(sys, dt) {
  const dir = sys.side === 'me' ? 1 : -1, fighting = G.state === 'fight';
  sys.phase += sys.speed * dt;
  if (sys.side === 'me') {
    const o = Math.floor(sys.phase / TAU);
    if (o > sys.orbits) { sys.orbits = o; if (fighting) G.energy = Math.min(G.maxEnergy, G.energy + 1); }
  }
  for (const r of sys.rings) r.phase += r.speed * dt;
  sys.cons.forEach(c => {
    const r = sys.rings[c.ring], a = dir * r.phase + c.slot * TAU / r.cons.length;
    c.x = sys.cx + sys.R * r.rf * Math.cos(a); c.y = sys.cy + sys.ry * r.rf * Math.sin(a);
    c.s = .8 + .2 * Math.sin(a); c.depth = Math.sin(a);
    if (c.flash > 0) c.flash -= dt;
    if (c.dead) { c.alpha = Math.max(0, c.alpha - dt * 2); return; }
    if (!fighting) return;
    if (c.invuln > 0) c.invuln -= dt;
    if (c.slow > 0) c.slow -= dt;
    tickDot(c, dt); if (c.dead) return;
    if (c.stun > 0) { c.stun -= dt; return; }
    // periodic awakenings
    if (c.side === 'me') periodic(c, sys, dt);
    let rate = c.rate * (1 + c.m.rate) * (sys.side === 'me' ? sys.planet.rateMul : 1);
    if (sys.side === 'me' && G.nova > 0) rate *= 2;
    if (c.slow > 0) rate *= 1 - (c.slowV || .3);
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
        for (let i = 0; i < 4; i++) G.proj.push({ x: G.me.cx + rnd(-80, 80), y: -30 - i * 50, t: P, src: G.foe.cons.find(c => !c.dead) || null, sp: 520, dmg: P.maxHp * .04, kind: 'phys', col: '#e0b6ff', w: 4, len: 22, debris: Math.floor(Math.random() * 4) });
        banner('고리 파편 낙하', '', .9);
      } else if (B.ability === 'drain') { if (G.energy > 0) { G.energy -= 1; say(G.me.cx, G.me.cy - G.me.pr - 12, '기력 -1', '#c35bff', 1); } }
    }
  }
}

function update(dt) {
  G.shake = Math.max(0, G.shake - dt * 16);
  if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) $('banner').classList.remove('show'); }
  if (!G.me) return;
  if (G.state === 'fight' && G.pendingLv > 0 && !G.choosing) { openLevelUp(); return; }
  updateSystem(G.me, dt); updateSystem(G.foe, dt);
  if (G.state === 'intro') updateIntro(dt);
  if (G.goT > 0) G.goT -= dt;

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
  const kind = P.kind, look = P.look || {};
  let glow = { earth: '80,150,255', sun: '255,160,40', moon: '200,205,235' }[kind] || look.glow;
  if (kind === 'hole') { drawHole(x, y, r, t, P); return; }
  const tint = P.skin && PSKIN[P.skin] ? PSKIN[P.skin].tint : null;
  if (tint) glow = tint;
  const isStar = kind === 'sun' || kind === 'star';
  const hr = r * (isStar ? 2.8 + .15 * Math.sin(t * 2) : 2.1);
  if (save.settings.glow) {
    const hg = ctx.createRadialGradient(x, y, r * .6, x, y, hr);
    hg.addColorStop(0, `rgba(${glow},${isStar ? .55 : .32})`); hg.addColorStop(1, `rgba(${glow},0)`);
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, hr, 0, TAU); ctx.fill();
  }
  // pixel-art body (pixel.js): rotating surface, ring included; smoothing off keeps the dots crisp
  const cv = pxPlanet(kind, look, Math.floor(t * (isStar ? 2 : 3)), tint), D = r * 2 * pxPlanetSpan(look);
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, x - D / 2, y - D / 2, D, D); ctx.restore();
  if (P.flash > 0) { ctx.fillStyle = `rgba(255,255,255,${P.flash * 3})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); }
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
function drawHole(x, y, r, t, P) {
  const hg = ctx.createRadialGradient(x, y, r * .8, x, y, r * 3);
  hg.addColorStop(0, 'rgba(255,170,90,.35)'); hg.addColorStop(1, 'rgba(255,170,90,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, TAU); ctx.fill();
  const im = pxSprite('blackhole');
  if (im) { // pixel black hole (img/blackhole.png): its dark sphere is ~20 of 98 px wide-radius, centred at (49, 26)
    const k = r / 20, w = im.naturalWidth * k, h = im.naturalHeight * k, sm = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false; ctx.drawImage(im, x - 49 * k, y - 26 * k, w, h); ctx.imageSmoothingEnabled = sm;
  } else for (const back of [true, false]) {
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
  const r = sys.pr * .22, cv = pxPlanet('moon', {}, Math.floor(t * 2));   // pixel moon, same renderer as the planets
  ctx.save(); ctx.imageSmoothingEnabled = false; ctx.drawImage(cv, sx - r, sy - r, r * 2, r * 2); ctx.restore();
}

// Pixel art per skin (img/con_<skin id>.webp); the line drawing shows until it has loaded
const CON_IMG = {};
function conImg(c) {
  const id = c.skin.id;
  let im = CON_IMG[id];
  if (!im) { im = CON_IMG[id] = new Image(); im.src = `img/con_${id}.webp`; }
  return im.complete && im.naturalWidth ? im : null;
}
function drawConArt(c, k, im, mine) {
  const sz = k * 2.1, x = c.x - sz / 2, y = c.y - sz / 2;
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, k * 1.15);   // side colour: soft halo behind the art
  g.addColorStop(0, mine ? 'rgba(120,200,255,.28)' : 'rgba(255,80,100,.38)'); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c.x, c.y, k * 1.15, 0, TAU); ctx.fill();
  const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = false;  // pixel art: keep the dots crisp
  ctx.drawImage(im, x, y, sz, sz);
  if (c.flash > 0 || (mine && c.chain)) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= c.flash > 0 ? .8 : .15 * c.chain; ctx.drawImage(im, x, y, sz, sz); ctx.restore();
  }
  ctx.imageSmoothingEnabled = sm;
  if (!mine) { ctx.strokeStyle = 'rgba(255,90,110,.75)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.ellipse(c.x, c.y + k * .85, k * .7, k * .16, 0, 0, TAU); ctx.stroke(); }
}
function drawCon(sys, c, t) {
  if (c.alpha <= 0) return;
  const k = conSize(sys) * c.s, pts = c.def.sh.pts.map(([px, py]) => [c.x + px * k, c.y + py * k * .85]);
  const mine = c.side === 'me';
  const lineC = mine ? c.skin.pal.line : '255,123,138';
  ctx.globalAlpha = c.alpha * (c.stun > 0 ? .55 : 1);
  ctx.lineCap = 'round';
  const im = conImg(c);
  if (im) drawConArt(c, k, im, mine);
  else {
    const glowW = mine && c.chain ? 5 + c.chain * 2 : 5;
    for (const [w, a] of [[glowW * c.s, .18], [1.5 * c.s, .95]]) {
      ctx.strokeStyle = `rgba(${lineC},${a})`; ctx.lineWidth = w;
      ctx.beginPath();
      for (const [i, j] of c.def.sh.edges) { ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); }
      ctx.stroke();
  }
  ctx.fillStyle = c.flash > 0 ? '#ffffff' : mine ? c.skin.pal.star : '#fff1c2';
  for (const [px, py] of pts) { ctx.beginPath(); ctx.arc(px, py, 2.1 * c.s, 0, TAU); ctx.fill(); }
  const [kx, ky] = pts[c.def.sh.key];
  ctx.strokeStyle = c.def.special ? '#c35bff' : mine ? '#ff5a6e' : '#ff9a5a'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(kx, ky, 6 * c.s, 0, TAU); ctx.stroke();
  }
  if (c.invuln > 0) { ctx.strokeStyle = 'rgba(169,193,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(c.x, c.y, k * 1.1, 0, TAU); ctx.stroke(); }
  if (c.stun > 0) { ctx.strokeStyle = 'rgba(195,91,255,.8)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(c.x, c.y, k * 1.15, t * 3, t * 3 + TAU); ctx.stroke(); ctx.setLineDash([]); }
  if (c.dot) { ctx.fillStyle = c.dot.burn ? 'rgba(255,138,74,.95)' : 'rgba(157,255,106,.9)'; for (let i = 0; i < (c.dot.stacks || 1); i++) { ctx.beginPath(); ctx.arc(c.x + k + i * 5, c.y - k * .6, 2.3, 0, TAU); ctx.fill(); } }
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
// Orbit skins (궤도 스킨): dash / dust / aurora / comet
// Skins added in the admin site reuse one of these four looks (OSKIN[id].look)
function drawOrbit(sys, r, t) {
  const rx = sys.R * r.rf, ry = sys.ry * r.rf, mine = sys.side === 'me', col = mine ? '245,196,81' : '255,123,138';
  const look = (OSKIN[r.skin] && OSKIN[r.skin].look) || r.skin;
  ctx.save();
  if (look === 'dust') {
    for (let i = 0; i < 48; i++) {
      const a = i / 48 * TAU + t * .05, tw = .25 + .5 * Math.sin(t * 2 + i * 1.7) ** 2;
      ctx.fillStyle = `rgba(230,225,255,${tw})`; ctx.beginPath(); ctx.arc(sys.cx + rx * Math.cos(a), sys.cy + ry * Math.sin(a), 1.3, 0, TAU); ctx.fill();
    }
  } else if (look === 'aurora') {
    ctx.strokeStyle = 'rgba(110,255,210,.16)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.ellipse(sys.cx, sys.cy, rx, ry, 0, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(160,255,230,.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(sys.cx, sys.cy, rx, ry, 0, 0, TAU); ctx.stroke();
  } else if (look === 'comet') {
    ctx.strokeStyle = `rgba(${col},.14)`; ctx.lineWidth = 1; ctx.setLineDash([2, 8]);
    ctx.beginPath(); ctx.ellipse(sys.cx, sys.cy, rx, ry, 0, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
    for (let k = 0; k < 3; k++) {
      const a0 = t * .9 + k * TAU / 3;
      for (let j = 0; j < 10; j++) {
        const a = a0 - j * .045;
        ctx.fillStyle = `rgba(255,220,160,${(1 - j / 10) * .9})`;
        ctx.beginPath(); ctx.arc(sys.cx + rx * Math.cos(a), sys.cy + ry * Math.sin(a), 2.2 * (1 - j / 12), 0, TAU); ctx.fill();
      }
    }
  } else {
    ctx.strokeStyle = `rgba(${col},.22)`; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.ellipse(sys.cx, sys.cy, rx, ry, 0, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
// Renders a small live system (skin preview) onto another canvas with the same drawing code
function drawPreview(canvas, sys, t, dt) {
  const r = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  if (!r.width) return;
  if (canvas.width !== Math.round(r.width * dpr)) { canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); }
  const c2 = canvas.getContext('2d'); c2.setTransform(dpr, 0, 0, dpr, 0, 0);
  const g = c2.createRadialGradient(r.width / 2, r.height / 2, 0, r.width / 2, r.height / 2, r.width * .7);
  g.addColorStop(0, '#16204a'); g.addColorStop(1, '#05070f');
  c2.fillStyle = g; c2.fillRect(0, 0, r.width, r.height);
  sys.R = Math.min(r.width * .38, (r.height / 2 - 14) / (ORBIT_TILT + .2)); sys.ry = sys.R * ORBIT_TILT; sys.pr = sys.R * .2;
  sys.cx = r.width / 2; sys.cy = r.height / 2;
  updateSystem(sys, dt);
  ctx = c2; try { drawSystem(sys, t); } finally { ctx = mainCtx; }
}
function drawSystem(sys, t) {
  for (const r of sys.rings) drawOrbit(sys, r, t);
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
  const sk = G.shake > .05 && G.me && !G.paused && !G.choosing;
  if (sk) { ctx.save(); ctx.translate(rnd(-1, 1) * G.shake, rnd(-1, 1) * G.shake * .7); }
  drawScene(t);
  if (sk) ctx.restore();
}
function drawScene(t) {
  drawBg(t);
  if (!G.me) return;
  for (const sys of [G.foe, G.me]) {
    const oy = introOffset(sys);
    if (oy) { ctx.save(); ctx.translate(0, oy); drawSystem(sys, t); ctx.restore(); } else drawSystem(sys, t);
  }
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
    if (p.orb) { // pixel orb: a plus-shaped glow around a square core
      const u = Math.max(2, Math.round(p.w * .8)), x = Math.round(p.x), y = Math.round(p.y);
      ctx.globalAlpha = .3; ctx.fillRect(x - u * 2, y - u, u * 4, u * 2); ctx.fillRect(x - u, y - u * 2, u * 2, u * 4);
      ctx.globalAlpha = 1; ctx.fillRect(x - u, y - u, u * 2, u * 2); ctx.fillStyle = '#fff'; ctx.fillRect(x - u / 2, y - u / 2, u, u);
    }
    else if (p.meteor && pxSprite('meteor_fire')) { // pixel fireball: rock head on the projectile, tail trailing behind
      const im = pxSprite('meteor_fire'), w = p.len * .8, h = w * im.naturalHeight / im.naturalWidth, vx = p.vx || 0, vy = p.vy || 1, back = h / 2 - w * .45;
      pxDraw(ctx, im, p.x - vx * back, p.y - vy * back, w, Math.atan2(vy, vx) - Math.PI / 2);
    }
    else if (p.debris !== undefined && pxSprite('rock_' + p.debris)) pxDraw(ctx, pxSprite('rock_' + p.debris), p.x, p.y, p.len, p.y * .03);
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
  drawCountdown();
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
  const pvp = G.mode === 'pvp';
  $('xpBar').style.transform = `scaleX(${pvp ? 1 : clamp(G.xp / xpNeed(G.lv), 0, 1)})`;
  $('lvTxt').textContent = pvp ? 'MAX' : `Lv ${G.lv - G.pendingLv}`;
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

