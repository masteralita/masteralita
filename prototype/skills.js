'use strict';
/* ---------- Gauge skills (게이지 스킬) ----------
   The three skill buttons are the main planet's unique skill (UR) and its two equip slots
   (data.js PLANET_USKILL / ESKILL, editable in admin/); each costs 기력.
   Loaded after battle.js: it uses the battle state and damage helpers. */
const SK = { list: [], dur: [0, 0, 0], durT: [1, 1, 1], crit: 0, critV: 0, cd: 0, cdV: 0, expose: 0, exposeV: 0, regen: 0, regenV: 0 };
const skBtns = [0, 1, 2].map(i => $('sk' + i));

// Called at the start of every battle: picks the planet's skills and relabels the buttons
function setupSkills() {
  SK.list = planetSkills(save.mainPlanet).filter(Boolean).map(s => GSKILL[s.type] ? s : { ...s, type: 'meteor' });
  SK.dur = [0, 0, 0]; SK.durT = [1, 1, 1]; SK.crit = 0; SK.cd = 0; SK.expose = 0; SK.regen = 0;
  G.shieldV = .7; G.novaV = 1;
  skBtns.forEach((b, i) => {
    const s = SK.list[i]; b.hidden = !s; if (!s) return;
    b.querySelector('img').src = `img/sk_${GSKILL[s.type].icon}.png`;
    b.querySelector('.nm').textContent = s.name;
    b.querySelector('.cs').textContent = `${s.grade} · 기력 ${s.cost}`;
    b.style.setProperty('--sg', SKILL_GRADES[s.grade].col);
    b.title = skillDesc(s);
  });
}

function castSkill(i) {
  const s = SK.list[i];
  if (!s || G.state !== 'fight' || G.paused || G.choosing || G.energy < s.cost) return;
  G.energy -= s.cost;
  const foes = G.foe.cons.filter(c => !c.dead), P = G.me.planet;
  const timed = d => { SK.dur[i] = SK.durT[i] = Math.max(.01, d); };
  switch (s.type) {
    case 'meteor': {
      const t = G.focus && alive(G.focus) ? G.focus : foes[0] || G.foe.planet, [tx] = posOf(t);
      for (let k = 0; k < 5; k++) G.proj.push({ x: tx + rnd(-60, 60) - 90, y: -20 - k * 40, t, src: null, sp: 700, dmg: 40 + t.maxHp * s.v + G.wave * 6, kind: 'phys', col: '#ffe9a8', w: 4, len: 26, meteor: true });
      break;
    }
    case 'strike': {
      const F = G.foe.planet;
      G.beams.push({ x1: G.me.cx, y1: G.me.cy, x2: G.foe.cx, y2: G.foe.cy, t: .5, c: '#ffe9a8', w: 6 });
      applyDamage(F, F.maxHp * s.v * (100 + F.dArmor) / 100, 'phys', { color: '#ffe9a8' }); // armor-adjusted so it lands ≈ v of max HP
      break;
    }
    case 'volley': {
      if (!foes.length) break;
      for (let k = 0; k < 8; k++) {
        const t = foes[Math.floor(Math.random() * foes.length)];
        G.proj.push({ x: G.me.cx + rnd(-12, 12), y: G.me.cy + rnd(-12, 12), t, src: null, sp: 520 + k * 30, dmg: 20 + t.maxHp * s.v, kind: 'phys', col: '#ffd27a', w: 3, len: 12 });
      }
      break;
    }
    case 'execute': {
      const t = foes.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
      if (!t) break;
      const low = t.hp / t.maxHp <= .3;
      G.beams.push({ x1: G.me.cx, y1: G.me.cy, x2: t.x, y2: t.y, t: .4, c: '#ff7a59', w: low ? 7 : 4 });
      applyDamage(t, t.maxHp * s.v * (low ? 2 : 1), 'phys', { color: '#ff7a59' });
      break;
    }
    case 'blast': foes.forEach(c => { burst(c.x, c.y, 10, '#b9a8ff'); applyDamage(c, c.maxHp * s.v, 'magic', { color: '#b9a8ff' }); }); break;
    case 'chain': {
      let x = G.me.cx, y = G.me.cy, v = s.v;
      for (const c of foes.slice().sort(() => Math.random() - .5)) {
        G.beams.push({ x1: x, y1: y, x2: c.x, y2: c.y, t: .35, c: '#9fd8ff', w: 3 });
        applyDamage(c, c.maxHp * v, 'magic', { color: '#9fd8ff' }); x = c.x; y = c.y; v *= .85;
      }
      const F = G.foe.planet;
      G.beams.push({ x1: x, y1: y, x2: G.foe.cx, y2: G.foe.cy, t: .35, c: '#9fd8ff', w: 3 });
      applyDamage(F, F.maxHp * v * .3, 'magic', { color: '#9fd8ff' });
      break;
    }
    case 'burn': foes.forEach(c => { c.dot = { dps: c.maxHp * s.v, t: s.dur, stacks: 1, burn: true }; }); timed(s.dur); break;
    case 'expose': SK.expose = s.dur; SK.exposeV = s.v; foes.forEach(c => say(c.x, c.y - 22, '약화', '#b9a8ff', .6)); timed(s.dur); break;
    case 'shield': G.shield = s.dur; G.shieldV = s.v; timed(s.dur); break;
    case 'barrier': G.pShield = Math.min(P.maxHp * .5, G.pShield + P.maxHp * s.v); break;
    case 'heal': heal(P, P.maxHp * s.v); G.me.cons.forEach(c => heal(c, c.maxHp * s.v)); break;
    case 'regen': SK.regen = s.dur; SK.regenV = s.v; timed(s.dur); break;
    case 'revive': {
      const down = G.me.cons.filter(c => c.dead);
      down.forEach(c => { c.dead = false; c.hp = c.maxHp * s.v; c.alpha = 1; c.stun = 0; c.dot = null; say(c.x, c.y - 24, '부활', '#5fe0a0', 1); burst(c.x, c.y, 14, '#5fe0a0'); });
      if (!down.length) { heal(P, P.maxHp * s.v); G.me.cons.forEach(c => heal(c, c.maxHp * s.v)); }
      break;
    }
    case 'haste': G.nova = s.dur; G.novaV = s.v; timed(s.dur); break;
    case 'rally': G.roar = Math.max(G.roar, s.dur); G.roarV = s.v; timed(s.dur); break;
    case 'overdrive': G.nova = s.dur; G.novaV = s.v; G.roar = Math.max(G.roar, s.dur); G.roarV = s.v; timed(s.dur); break;
    case 'crit': SK.crit = s.dur; SK.critV = s.v; timed(s.dur); break;
    case 'critdmg': SK.cd = s.dur; SK.cdV = s.v; timed(s.dur); break;
    case 'stun': foes.forEach(c => { c.stun = Math.max(c.stun, s.dur); say(c.x, c.y - 22, '기절', '#d58bff', .6); }); timed(s.dur); break;
    case 'slow': foes.forEach(c => { c.slow = s.dur; c.slowV = s.v; }); timed(s.dur); break;
  }
  banner(s.name, '', .7);
}
const skillCrit = () => SK.crit > 0 ? SK.critV : 0;
const skillCritDmg = () => SK.cd > 0 ? SK.cdV : 0;
const skillExpose = () => SK.expose > 0 ? SK.exposeV : 0;
function skillTick(dt) {
  if (SK.crit > 0) SK.crit -= dt;
  if (SK.cd > 0) SK.cd -= dt;
  if (SK.expose > 0) SK.expose -= dt;
  if (SK.regen > 0) {
    SK.regen -= dt;
    const P = G.me.planet; for (const t of [P, ...G.me.cons]) if (alive(t)) t.hp = Math.min(t.maxHp, t.hp + t.maxHp * SK.regenV * dt);
  }
  for (let i = 0; i < 3; i++) if (SK.dur[i] > 0) SK.dur[i] -= dt;
}
function skillHud() {
  skBtns.forEach((b, i) => {
    const s = SK.list[i]; if (!s) return;
    const ok = G.energy >= s.cost && G.state === 'fight';
    b.disabled = !ok; b.classList.toggle('ready', ok);
    b.querySelector('.dur').style.width = `${clamp(SK.dur[i] / SK.durT[i], 0, 1) * 100}%`;
  });
}
skBtns.forEach((b, i) => b.addEventListener('click', () => castSkill(i)));
