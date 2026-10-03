'use strict';
/* ---------- Arcade (아케이드): waves of asteroids, meteors and alien ships ----------
   Planet-vs-planet stays in 대전 (PvP). In arcade only my system sits at the bottom; every wave
   (탄) spawns mobs anywhere above it:
   - 소행성 / 운석 appear at the edges or warp in mid-field, then rush the planet from every direction.
     Reaching the planet costs a share of its max HP (at least WAVE.rockPct / meteorPct) and they break.
   - 외계 우주선 fly in Galaga-style along a swooping path, line up in a formation at the top,
     sway together and shoot at the planet; from wave 3 one now and then dives down to strafe it.
   - Every 5th wave a mothership (모선) leads; every 10th it is the zone boss with its zone ability.
   Mobs live in G.foe.cons so targeting, damage, DoTs and skills keep working on them.
   Loaded after battle.js. */

const MOB = {
  rock:   { hp: () => WAVE.rockHp,   r: [15, 20], sp: [34, 48],  pct: () => WAVE.rockPct,   xp: 4, name: '소행성' },
  meteor: { hp: () => WAVE.meteorHp, r: [9, 11],  sp: [95, 125], pct: () => WAVE.meteorPct, xp: 3, name: '운석' },
  scout:  { hp: () => WAVE.shipHp,        r: [16, 16], xp: 4, name: '정찰선' },
  saucer: { hp: () => WAVE.shipHp * 1.2,  r: [17, 17], xp: 5, name: '원반선' },
  crab:   { hp: () => WAVE.shipHp * 1.7,  r: [17, 17], xp: 6, name: '돌격선' },
  boss:   { r: [48, 48], xp: 30, name: '모선' },
};
const SHIP_KINDS = ['scout', 'saucer', 'crab'];         // formation rows cycle through these (shifted by wave)
const fieldTop = () => 116;                             // below the top HUD
const fieldBot = () => G.me ? G.me.cy - G.me.ry - G.me.R * .25 : H * .6;
const isShip = m => m.mob === 'scout' || m.mob === 'saucer' || m.mob === 'crab';
const onField = m => !m.mob || (m.x > -4 && m.x < W + 4 && m.y > -4 && m.y < H);

/* ---------- Pixel ships (SpriteCook, img/ship_*.png) ---------- */
// rot: turns to face its flight path · up: the art's nose points up, so it is flipped to face the planet
const SHIP_LOOK = { scout: { rot: true, up: true, w: 2.5 }, saucer: { rot: false, w: 2.6 }, crab: { rot: true, w: 2.5 }, boss: { rot: false, w: 2.5 } };
['scout', 'saucer', 'crab', 'boss'].forEach(k => pxSprite('ship_' + k));
const SHIP_WHITE = {};
function shipWhite(k, im) { // white silhouette for the hit flash
  if (SHIP_WHITE[k]) return SHIP_WHITE[k];
  const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
  const g = cv.getContext('2d'); g.drawImage(im, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  return (SHIP_WHITE[k] = cv);
}

/* ---------- Wave setup ---------- */
function arcScale(n) { return Math.pow(WAVE.statGrowth, n - 1) * Math.pow(WAVE.deepGrowth, Math.max(0, n - WAVE.deepFrom)); }
function startArcadeWave() {
  const n = G.wave, z = zoneOf(n), bossTier = n % 10 === 0 ? 2 : n % 5 === 0 ? 1 : 0;
  const look = bossTier === 2 ? z.boss : bossTier === 1 ? z.mid : null;
  // a dummy enemy "system": holds the mobs in .cons; its planet is never alive, so planet-only effects skip it
  G.foe = makeSystem('foe', { isPlanet: true, side: 'foe', hp: 0, maxHp: 1, dArmor: 0, mArmor: 0, flash: 0, dot: null, shred: 0, name: '' }, []);
  const ships = Math.min(18, (bossTier ? 3 : 5) + Math.floor(n * (bossTier ? .4 : .8)));
  const rocks = (bossTier ? 2 : 3) + Math.floor(n * .7);
  const meteors = Math.floor(n * .5) + (n >= 3 ? 1 : 0);
  const cols = Math.min(6, ships), q = [];
  const groups = Math.ceil(ships / cols);
  for (let g = 0; g < groups; g++) {
    const side = g % 2 ? 1 : -1, fromTop = g === 2;
    for (let i = 0; i < cols && g * cols + i < ships; i++)
      q.push({ at: (bossTier ? 3.5 : 1) + g * 4.2 + i * .22, kind: SHIP_KINDS[(g + n - 1) % 3], row: g, col: i, cols, side, fromTop });
  }
  for (let i = 0; i < rocks; i++) q.push({ at: rnd(2.5, 26), kind: 'rock' });
  for (let i = 0; i < meteors; i++) q.push({ at: rnd(6, 28), kind: 'meteor' });
  if (bossTier) q.push({ at: .3, kind: 'boss', tier: bossTier });
  q.sort((a, b) => a.at - b.at);
  G.arc = { q, t: 0, total: q.length, killed: 0, boss: null, bossTier, look, m: arcScale(n), diveCd: 7, bossCd: 4, bossCd2: 6, bossCd3: 8 };
  for (const c of G.me.cons) { c.dead = false; c.hp = c.maxHp; c.alpha = 1; c.stun = 0; c.dot = null; c.revived = false; c.molted = false; c.invuln = 0; }
  const P = G.me.planet; if (n > 1) P.hp = Math.min(P.maxHp, P.hp + P.maxHp * .15);
  resetHole();
  G.timer = WAVE.timer; G.enraged = false; G.focus = null; G.proj = []; G.beams = [];
  G.state = 'fight';
  const newZone = z !== G.zone || n === 1; G.zone = z;
  $('waveNo').textContent = n; $('zoneChip').textContent = z.name;
  layout();
  if (newZone) banner(z.en, `${z.name} 진입 · WAVE ${n}`, 2);
  else banner(bossTier ? `BOSS WAVE ${n}` : `WAVE ${n}`, bossTier ? look.name : `${MOB.rock.name} · ${MOB.meteor.name} · 외계 우주선`, 1.3);
}
function spawnMob(s) {
  const A = G.arc, d = MOB[s.kind], n = G.wave, r = rnd(...d.r);
  const m = { mob: s.kind, side: 'foe', x: 0, y: 0, r, s: 1, alpha: 1, flash: 0, stun: 0, dot: null, slow: 0, shred: 0, dead: false,
    dArmor: 5 + n * 2, mArmor: 5 + n * 2, xp: d.xp + Math.floor(n / 3), def: { id: s.kind, name: d.name }, age: 0, rock: Math.floor(Math.random() * 4), spin: rnd(0, TAU), vspin: rnd(-1.5, 1.5) };
  if (s.kind === 'boss') {
    m.tier = s.tier; m.name = A.look.name;
    m.hp = Math.round(WAVE.planetHp * Math.pow(WAVE.planetGrowth, n - 1) * Math.pow(WAVE.deepGrowth, Math.max(0, n - WAVE.deepFrom)) * (s.tier === 2 ? WAVE.zoneBossHp : WAVE.midBossHp));
    m.atk = WAVE.shipAtk * A.m * WAVE.conAtk; m.x = W / 2; m.y = -60; m.st = 'enter'; m.dArmor += 10; m.mArmor += 10;
    A.boss = m; banner(s.tier === 2 ? '구역 보스 출현' : '모선 출현', m.name, 1.3);
  } else if (isShip(m)) {
    m.hp = Math.round(d.hp() * A.m * WAVE.conHp); m.atk = WAVE.shipAtk * A.m * WAVE.conAtk;
    Object.assign(m, { row: s.row, col: s.col, cols: s.cols, side0: s.side, st: 'enter', t0: A.t, dur: 2.4, cd: rnd(1.5, 3.5) });
    m.p0 = s.fromTop ? [W / 2 + s.side * W * .3, -24] : [s.side < 0 ? -24 : W + 24, fieldTop() + rnd(20, 70)];
    m.x = m.p0[0]; m.y = m.p0[1];
  } else {
    m.hp = Math.round(d.hp() * A.m * WAVE.conHp); m.pct = d.pct() * (1 + .02 * (n - 1));
    m.sp = rnd(...d.sp) * (1 + Math.min(.6, n * .015));
    const top = fieldTop(), bot = fieldBot();
    if (chance(.5)) { // warps in somewhere in the open field (화면 내 무작위 생성)
      m.x = rnd(28, W - 28); m.y = rnd(top, top + (bot - top) * .5); m.warp = .5;
    } else { // or comes in from an edge: top, left or right
      const e = Math.floor(Math.random() * 3);
      if (e === 0) { m.x = rnd(20, W - 20); m.y = -r; }
      else { m.x = e === 1 ? -r : W + r; m.y = rnd(top - 40, top + (bot - top) * .6); }
    }
  }
  m.maxHp = m.hp;
  G.foe.cons.push(m);
}

/* ---------- Update ---------- */
function slotPos(m) {
  const gx = Math.min(48, (W - 48) / Math.max(1, m.cols - 1 || 1)), sway = Math.sin(G.arc.t * .7) * W * .05;
  return [W / 2 + (m.col - (m.cols - 1) / 2) * gx + sway, fieldTop() + 26 + m.row * 38 + (G.arc.boss ? 70 : 0)];
}
const bez = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d; };
function enemyShot(m, opt = {}) {
  const P = G.me.planet;
  G.proj.push(Object.assign({ x: m.x, y: m.y + m.r * .6, t: P, src: m, sp: 170, dmg: m.atk, kind: 'magic', col: '#7dffb0', w: 3.2, len: 0, orb: true, foeShot: true }, opt));
}
function updateArcade(dt) {
  const A = G.arc, F = G.foe;
  if (!A) return;
  for (let i = F.cons.length - 1; i >= 0; i--) {
    const m = F.cons[i];
    if (m.flash > 0) m.flash -= dt;
    if (m.dead) { m.alpha -= dt * 3; if (m.alpha <= 0) F.cons.splice(i, 1); }
  }
  if (G.state !== 'fight') return;
  A.t += dt;
  while (A.q.length && A.q[0].at <= A.t) spawnMob(A.q.shift());
  const S = G.me, P = S.planet, rage = G.enraged ? 1.3 : 1;
  for (const m of F.cons) {
    if (m.dead) continue;
    m.age += dt; m.spin += m.vspin * dt;
    if (m.warp > 0) { m.warp -= dt; continue; }
    tickDot(m, dt); if (m.dead) continue;
    if (m.slow > 0) m.slow -= dt;
    if (m.stun > 0) { m.stun -= dt; continue; }
    const k = m.slow > 0 ? 1 - (m.slowV || .3) : 1;
    if (m.mob === 'rock' || m.mob === 'meteor') {
      const dx = S.cx - m.x, dy = S.cy - m.y, d = Math.hypot(dx, dy) || 1;
      m.x += dx / d * m.sp * k * rage * dt; m.y += dy / d * m.sp * k * rage * dt; m.dir = Math.atan2(dy, dx);
      if (d < S.pr + m.r * .5) crash(m);
    } else if (m.mob === 'boss') bossUpdate(m, dt * k);
    else shipUpdate(m, dt * k);
  }
  if (A.bossTier && A.boss && !A.boss.dead) bossSkills(dt);
  // a formed ship breaks off and dives at the planet (Galaga style)
  if (G.wave >= 3 && (A.diveCd -= dt) <= 0) {
    A.diveCd = rnd(4, 7) / Math.min(2, 1 + G.wave * .03);
    const formed = F.cons.filter(m => !m.dead && isShip(m) && m.st === 'form');
    if (formed.length) { const m = formed[Math.floor(Math.random() * formed.length)]; m.st = 'dive'; m.t0 = A.t; m.fired = false; m.ddir = m.x < W / 2 ? 1 : -1; }
  }
  if (!A.q.length && !F.cons.some(m => !m.dead)) arcadeClear();
}
function crash(m) {
  const P = G.me.planet;
  m.dead = true; m.alpha = 0; m.crashed = true;
  if (G.focus === m) G.focus = null;
  burst(m.x, m.y, m.mob === 'rock' ? 30 : 18, m.mob === 'rock' ? '#c9a27a' : '#ffb15a'); burst(m.x, m.y, 10, '#fff1c4');
  G.rings = (G.rings || []).concat({ x: m.x, y: m.y, r: m.r, t: .35, c: '#ffb15a' });
  if (!REDUCED_MOTION) G.shake = Math.min(SHAKE_MAX, G.shake + (m.mob === 'rock' ? 4 : 2.5));
  applyDamage(P, P.maxHp * m.pct, 'phys', { color: '#ff8a9a' }); // no src: a crash can't be dodged
  G.arc.killed += 1;
}
function shipUpdate(m, dt) {
  const A = G.arc, [sx, sy] = slotPos(m);
  if (m.st === 'enter') {
    const u = clamp((A.t - m.t0) / m.dur, 0, 1), s = m.side0, mid = (fieldTop() + fieldBot()) / 2;
    const c1 = [W / 2 - s * W * .15, mid + 40], c2 = [W / 2 + s * W * .35, fieldTop() - 10];
    const nx = bez(m.p0[0], c1[0], c2[0], sx, u), ny = bez(m.p0[1], c1[1], c2[1], sy, u);
    m.dir = Math.atan2(ny - m.y, nx - m.x); m.x = nx; m.y = ny;
    if (u >= 1) { m.st = 'form'; m.dir = Math.PI / 2; }
    return;
  }
  if (m.st === 'dive') {
    const u = clamp((A.t - m.t0) / 2.8, 0, 1), ty = G.me.cy - G.me.ry - G.me.R * .3;
    const nx = sx + Math.sin(u * TAU) * 70 * m.ddir, ny = sy + (ty - sy) * Math.sin(u * Math.PI);
    m.dir = Math.atan2(ny - m.y, nx - m.x); m.x = nx; m.y = ny;
    if (!m.fired && u > .42) { m.fired = true; for (let i = 0; i < 3; i++) enemyShot(m, { x: m.x + (i - 1) * 6, sp: 200 + i * 20 }); }
    if (u >= 1) { m.st = 'form'; m.dir = Math.PI / 2; }
    return;
  }
  m.x = sx; m.y = sy + Math.sin(A.t * 2 + m.col) * 2; m.dir = Math.PI / 2;
  m.cd -= dt * (G.enraged ? 1.4 : 1);
  if (m.cd <= 0) { m.cd = rnd(2.6, 4.4); enemyShot(m); }
}
function bossUpdate(m, dt) {
  const A = G.arc, by = fieldTop() + 40;
  if (m.st === 'enter') { m.y += 60 * dt; if (m.y >= by) { m.y = by; m.st = 'form'; } return; }
  m.x = W / 2 + Math.sin(A.t * .45) * W * .18; m.y = by + Math.sin(A.t * 1.3) * 4;
  if ((A.bossCd -= dt * (G.enraged ? 1.4 : 1)) <= 0) { // fan of 5 bullets that curve in on the planet
    A.bossCd = m.tier === 2 ? 3.2 : 3.8;
    for (let i = 0; i < 5; i++) enemyShot(m, { x: m.x + (i - 2) * 10, sp: 150, swerve: (i - 2) * .32, steer: 1.4, col: '#ff7ad9', w: 4 });
  }
}
// The boss stuns one of my constellations now and then; a zone boss also uses its zone ability
function bossSkills(dt) {
  const A = G.arc, B = A.boss, P = G.me.planet;
  if ((A.bossCd2 -= dt) <= 0) {
    A.bossCd2 = A.bossTier === 2 ? 5 : 6;
    const live = G.me.cons.filter(c => !c.dead);
    if (live.length) {
      const c = live[Math.floor(Math.random() * live.length)];
      c.stun = G.me.cons.some(x => x.def.id === 'sco' && !x.dead) ? 1.3 : 2.6;
      G.beams.push({ x1: B.x, y1: B.y, x2: c.x, y2: c.y, t: .4, c: '#c35bff', w: 3, zig: true });
      say(c.x, c.y - 24, '기절', '#d58bff', 1);
    }
  }
  if (A.bossTier !== 2 || (A.bossCd3 -= dt) > 0) return;
  A.bossCd3 = 8;
  const ab = A.look.ability;
  if (ab === 'burn') { P.dot = { dps: P.maxHp * .012, t: 5 }; banner('태양 플레어', '행성이 불타요', .9); }
  else if (ab === 'meteor') { for (let i = 0; i < 4; i++) A.q.unshift({ at: A.t + i * .25, kind: 'meteor' }); A.total += 4; banner('고리 파편 낙하', '', .9); }
  else if (ab === 'drain' && G.energy > 0) { G.energy -= 1; say(G.me.cx, G.me.cy - G.me.pr - 12, '기력 -1', '#c35bff', 1); }
}
function arcadeClear() {
  G.state = 'clear'; G.clearT = 1.4; G.proj = G.proj.filter(p => !p.foeShot);
  gainXp(15 + G.wave * 2);
  banner('CLEAR', G.wave % 10 === 0 ? '구역 보스 격파' : G.wave % 5 === 0 ? '모선 격파' : `WAVE ${G.wave}`, 1.2);
}
// called from killCon for every mob my side destroys
function arcadeKilled(m) {
  G.arc.killed += 1;
  if (m.mob === 'boss') { burst(m.x, m.y, 60, '#ffe9a8'); burst(m.x, m.y, 40, '#ff7a3c'); if (!REDUCED_MOTION) G.shake = SHAKE_MAX; }
  else if (m.mob === 'rock') { burst(m.x, m.y, 14, '#c9a27a'); }
}

/* ---------- Targeting / tap ---------- */
// My constellations shoot whatever is closest to the planet (the biggest threat), spread over the top three
function arcadeTarget(c, exclude) {
  if (G.focus && !G.focus.isPlanet && alive(G.focus) && G.focus !== exclude && onField(G.focus)) return G.focus;
  const S = G.me, live = G.foe.cons.filter(m => !m.dead && m !== exclude && !(m.warp > 0) && onField(m));
  if (!live.length) return null;
  live.sort((a, b) => Math.hypot(a.x - S.cx, a.y - S.cy) - Math.hypot(b.x - S.cx, b.y - S.cy));
  return live[Math.floor(Math.random() * Math.min(3, live.length))];
}
function arcadeHit(x, y) {
  return G.foe.cons.find(m => !m.dead && Math.hypot(m.x - x, m.y - y) < m.r * 1.3 + 8) || null;
}

/* ---------- Draw ---------- */
function drawArcade(t) {
  if (!G.foe) return;
  for (const m of G.foe.cons) {
    if (m.alpha <= 0) continue;
    ctx.save(); ctx.globalAlpha = clamp(m.alpha, 0, 1);
    if (m.warp > 0) { // warp portal: a shrinking ring, then the mob pops in
      const f = m.warp / .5;
      ctx.strokeStyle = `rgba(200,150,255,${1 - f * .4})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(m.x, m.y, m.r * (1 + 2 * f), m.r * (1 + 2 * f) * .6, 0, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1 - f;
    }
    if (m.mob === 'rock') {
      const im = pxSprite('rock_' + m.rock);
      if (im) pxDraw(ctx, im, m.x, m.y, m.r * 2.3, m.spin); else { ctx.fillStyle = '#9b7b5c'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill(); }
      if (m.flash > 0 && im) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha *= .7; pxDraw(ctx, im, m.x, m.y, m.r * 2.3, m.spin); }
    } else if (m.mob === 'meteor') {
      const im = pxSprite('meteor_fire'), vx = Math.cos(m.dir || Math.PI / 2), vy = Math.sin(m.dir || Math.PI / 2);
      if (im) { const w = m.r * 2.4, h = w * im.naturalHeight / im.naturalWidth, back = h / 2 - w * .45; pxDraw(ctx, im, m.x - vx * back, m.y - vy * back, w, Math.atan2(vy, vx) - Math.PI / 2); }
      else { ctx.fillStyle = '#ffb15a'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill(); }
      if (save.settings.glow !== false && Math.random() < .5) G.fx.push({ x: m.x - vx * m.r, y: m.y - vy * m.r, vx: rnd(-15, 15) - vx * 30, vy: rnd(-15, 15) - vy * 30, t: rnd(.2, .4), c: Math.random() < .5 ? '#ffb15a' : '#ff6a2a' });
    } else {
      const L = SHIP_LOOK[m.mob], im = pxSprite('ship_' + m.mob);
      const w = m.r * L.w, h = im ? w * im.naturalHeight / im.naturalWidth : w;
      ctx.imageSmoothingEnabled = false;
      ctx.translate(m.x, m.y);
      if (L.rot) ctx.rotate((m.dir ?? Math.PI / 2) - Math.PI / 2 + (L.up ? Math.PI : 0));
      if (m.mob === 'boss' && save.settings.glow !== false) { // menacing red halo behind the mothership
        const g = ctx.createRadialGradient(0, 0, m.r * .3, 0, 0, m.r * 1.4); g.addColorStop(0, 'rgba(255,90,110,.3)'); g.addColorStop(1, 'rgba(255,90,110,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, m.r * 1.4, 0, TAU); ctx.fill();
      }
      if (im) {
        ctx.drawImage(im, -w / 2, -h / 2, w, h);
        if (m.flash > 0) { ctx.globalAlpha *= .7; ctx.drawImage(shipWhite(m.mob, im), -w / 2, -h / 2, w, h); }
      } else { ctx.fillStyle = '#6a5acd'; ctx.beginPath(); ctx.arc(0, 0, m.r, 0, TAU); ctx.fill(); }
    }
    ctx.restore();
    if (m.dead) continue;
    if (m.stun > 0) { ctx.strokeStyle = 'rgba(195,91,255,.8)'; ctx.lineWidth = 1.6; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 1.25, t * 3, t * 3 + TAU); ctx.stroke(); ctx.setLineDash([]); }
    if (m.dot) { ctx.fillStyle = m.dot.burn ? 'rgba(255,138,74,.95)' : 'rgba(157,255,106,.9)'; for (let i = 0; i < (m.dot.stacks || 1); i++) { ctx.beginPath(); ctx.arc(m.x + m.r + i * 5, m.y - m.r * .6, 2.3, 0, TAU); ctx.fill(); } }
    if (m.mob !== 'boss' && m.hp < m.maxHp) { // small HP bar once hit
      const bw = m.r * 1.8, bx = m.x - bw / 2, by = m.y + m.r + 3;
      ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(bx, by, bw, 3);
      ctx.fillStyle = '#ff5a6e'; ctx.fillRect(bx, by, bw * clamp(m.hp / m.maxHp, 0, 1), 3);
    }
  }
}

/* ---------- HUD ---------- */
function arcadeHud() {
  const A = G.arc; if (!A) return;
  const B = A.boss && !A.boss.dead ? A.boss : null;
  const left = A.q.length + G.foe.cons.filter(m => !m.dead).length;
  if (B) {
    $('foeName').textContent = (A.bossTier === 2 ? '구역 보스 · ' : 'BOSS · ') + B.name;
    $('foeHp').style.transform = `scaleX(${clamp(B.hp / B.maxHp, 0, 1)})`;
    $('foeHpTxt').textContent = `${Math.ceil(B.hp).toLocaleString()} / ${B.maxHp.toLocaleString()}`;
  } else {
    $('foeName').textContent = `남은 적 ${left}`;
    $('foeHp').style.transform = `scaleX(${clamp(left / Math.max(1, A.total), 0, 1)})`;
    $('foeHpTxt').textContent = `${A.killed} / ${A.total} 처치`;
  }
}
