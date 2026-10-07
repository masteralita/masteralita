'use strict';
/* ==========================================================================
   App shell: save data, title/login, lobby, bottom tabs (상점 · 행성 · 로비 · 별자리 · 팀),
   settings, rewards. The battle itself lives in battle.js.
   ========================================================================== */

/* ---------- Save: kept in this browser, mirrored to players/{uid} by cloud.js ---------- */
const SAVE_KEY = 'gw.save.v1';
function freshSave() {
  return {
    v: 1, name: '', lv: 1, xp: 0, dust: 30000, piece: 1500, birthday: null,
    skins: [], lastCollect: Date.now(), chest: 0, stamina: { n: STAMINA.max, t: Date.now() }, staminaA: { n: STAMINA.arcadeMax, t: Date.now() }, best: 0, wins: 0, losses: 0, adPass: false,
    planets: { earth: { lv: 1 } }, mainPlanet: 'earth',
    cons: { sgr: newCon(0), leo: newCon(0), vir: newCon(0) },
    team: ['sgr', 'leo', 'vir'], form: [['sgr', 'leo'], ['vir']],
    pSkins: ['basic'], oSkins: ['dash'],
    skills: [...STARTER_SKILLS], equip: {}, shopBuys: {}, // 장착 스킬: owned ids, and the two slots per planet (unset → the starter pair)
    skillLv: {}, skillCopies: {}, // per owned skill: level (unset = 1) and duplicate copies toward the next level
    settings: { glow: true, fps: 60, sfx: true, bgm: true, push: true },
  };
}
function newCon(g) { return { g, slots: {}, skins: [], skin: null }; }
// Every constellation owns its classic skin; others are bought with 별모래 in the 별자리 tab
const equippedSkin = id => { const s = save.cons[id] && save.cons[id].skin; return s && SKIN[s] ? s : id; }; // a skin a later release removed → classic
// The classic skin comes with the constellation; other skins can be owned before it (chest, mail, purchase)
const ownsSkin = (id, sid) => (sid === id ? !!save.cons[id] : (save.skins || []).includes(sid) || !!(save.cons[id] && (save.cons[id].skins || []).includes(sid)));
const addSkin = sid => { save.skins = [...new Set([...(save.skins || []), sid])]; };
// 게이지 스킬: slot 0 = the planet's unique skill (UR), slots 1–2 = equip skills from the store (any planet)
const equipOf = pid => { const e = save.equip[pid] || STARTER_SKILLS; return [0, 1].map(k => ESKILL[e[k]] && save.skills.includes(e[k]) ? e[k] : null); };
const skLv = id => clamp(save.skillLv[id] || 1, 1, skillMaxLv());
const skNeed = id => skLv(id) >= skillMaxLv() ? 0 : SKILL_LV[skLv(id) - 1].need;
const skillOf = id => ({ ...skillAtLv(ESKILL[id], skLv(id)), id }); // the skill at the player's level
const planetSkills = pid => [{ ...PLANET[pid].uskill, grade: 'UR' }, ...equipOf(pid).map(id => id ? skillOf(id) : null)];
// 별자리 타입 (방어/공격/보조). 공격형은 장착 스킨의 속성으로 물리/마법이 갈려요
function conRole(id, sk) {
  const d = CON[id], r = ROLE[d.role] || ROLE.atk, k = (sk && sk.kind) || d.kind;
  return { ...r, id: d.role, sub: d.role === 'atk' ? KIND_LABEL[k] : '' };
}
const roleChip = r => `<span class="rchip" style="--r:${r.col}">${r.name}${r.sub ? ` · ${r.sub}` : ''}</span>`;
const skinStyle = sk => { const d = CON[sk.con]; return `${STYLE_LABEL[sk.style || d.style]} · ${KIND_LABEL[sk.kind || d.kind]}`; };
let save = (() => {
  try { const v = JSON.parse(localStorage.getItem(SAVE_KEY)); if (v && v.v === 1) return loadSave(v); } catch {}
  return freshSave();
})();
// Team formation (팀업): save.form[k] = constellations on orbit k of the main planet.
// Keeps 1 orbit's worth on single-orbit planets, ≤ ORBIT_CAP per orbit and ≤ TEAM_MAX in total; save.team mirrors it flat.
function normalizeForm() {
  const pid = save.mainPlanet, n = PLANET[pid].orbits, seen = new Set();
  const src = save.form || [save.team || [], []];
  let [o0, o1] = [0, 1].map(k => (src[k] || []).filter(id => save.cons[id] && !seen.has(id) && seen.add(id)));
  if (n === 1) { o0 = [...o0, ...o1]; o1 = []; }
  if (o0.length > ORBIT_CAP) { const extra = o0.splice(ORBIT_CAP); if (n === 2) o1 = [...extra, ...o1]; }
  o1 = o1.slice(0, ORBIT_CAP);
  while (o0.length + o1.length > TEAM_MAX) (o1.length ? o1 : o0).pop();
  save.form = [o0, o1]; save.team = [...o0, ...o1];
  const ps = save.planets[pid]; if (ps) { ps.skin = ps.skin || 'basic'; ps.orbitSkins = ps.orbitSkins || []; }
}
// ov (skin previews): pskin = planet skin, oskin = { orbit: skin }, onlyCon + conSkin = one constellation in a given skin
function buildMySystem(ov = {}) {
  normalizeForm();
  const pid = ov.pid || save.mainPlanet, ps = save.planets[pid], n = PLANET[pid].orbits;
  ps.skin = ps.skin || 'basic'; ps.orbitSkins = ps.orbitSkins || [];
  const oSk = [0, 1].map(k => (ov.oskin && ov.oskin[k]) || ps.orbitSkins[k] || 'dash');
  const P = makePlayerPlanet(pid, ps.lv, { skin: ov.pskin || ps.skin, orbitSkins: oSk });
  const cons = [], ringOf = [], form = ov.onlyCon ? [[ov.onlyCon], []]
    : pid !== save.mainPlanet && n === 1 ? [save.team.slice(0, ORBIT_CAP), []] : save.form; // previewing another planet: show the current team on its orbits
  form.forEach((a, k) => a.forEach(id => {
    const os = orbitStats(pid, k), ob = (OSKIN[oSk[k]] || OSKIN.dash).bonus;
    cons.push(makeMyCon(id, { atk: os.atk + (ob.atk || 0), rate: os.rate + (ob.rate || 0), hp: os.hp + (ob.hp || 0) }, ov.onlyCon ? ov.conSkin : null));
    ringOf.push(k);
  }));
  return makeSystem('me', P, cons, ringOf);
}
/* ---------- Account (cloud.js) ---------- */
function accountRows() {
  const C = window.CLOUD, a = C && C.account;
  const sync = !C || C.state === 'off' ? '이 기기에만 저장돼요'
    : C.state === 'connecting' ? '서버에 연결 중…' : C.state === 'saving' ? '저장 중…'
    : C.state === 'offline' ? '오프라인 · 연결되면 저장해요'
    : C.savedAt ? `서버에 저장됨 · ${new Date(C.savedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : '서버 연결됨';
  const who = !a ? '게스트 계정' : a.guest ? '게스트 계정 · 이 기기에서만 이어할 수 있어요' : `Google · ${a.email || '연결됨'}`;
  const btn = !C || C.state === 'off' ? '' : !a || a.guest ? '<button class="ghost sm" data-act="link" type="button">Google 연동</button>'
    : '<button class="ghost sm" data-act="signout" type="button">로그아웃</button>';
  return `<div class="set-row"><span>연동 계정<small>${who}</small></span>${btn}</div>
    <div class="set-row"><span>클라우드 저장<small>${sync}</small></span></div>`;
}
addEventListener('gw-cloud', () => { const el = document.getElementById('acctRows'); if (el) el.innerHTML = accountRows(); });
function persist() {
  save.updatedAt = Date.now(); // cloud.js keeps whichever copy is newer
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
  if (window.CLOUD) CLOUD.schedule();
}
function loadSave(v) {
  const o = Object.assign(freshSave(), v);
  if (!v.form) o.form = [v.team || [], []];
  if (o.adsRemoved && !o.adPass) o.adPass = true; // older saves bought the previous ad item
  if (!o.shopBuys || typeof o.shopBuys !== 'object') o.shopBuys = {}; // 상점 상품 id → 구매 횟수
  o.skills = [...new Set([...STARTER_SKILLS, ...(Array.isArray(o.skills) ? o.skills : [])])];
  if (!o.equip || typeof o.equip !== 'object') o.equip = {};
  for (const k of ['skillLv', 'skillCopies']) if (!o[k] || typeof o[k] !== 'object') o[k] = {};
  if (!o.stamina || typeof o.stamina.n !== 'number') o.stamina = { n: STAMINA.max, t: Date.now() }; // older saves start full
  if (!o.staminaA || typeof o.staminaA.n !== 'number') o.staminaA = { n: STAMINA.arcadeMax, t: Date.now() }; // 아케이드 에너지 (added later): starts full
  delete o.title; // the old 'Star Wanderer' subtitle
  return o;
}
// cloud.js: the server copy is newer (or the player switched accounts) → replace this device's progress
window.gwAdoptSave = remote => {
  save = loadSave(remote);
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {}
  closeModal();
  if (G.state === 'title') showTitle(); else enterHome();
};
// cloud.js: signed out / deleted → start over as a new guest
window.gwResetLocal = () => {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  save = freshSave(); tab = 'home'; closeModal(); showTitle();
};

const fmt = n => Math.floor(n).toLocaleString('en-US');
const CUR = { dust: '미네랄', piece: '별모래' };
function spend(cur, n) {
  if (save[cur] < n) { toast(`${CUR[cur]}${cur === 'dust' ? '이' : '가'} ${fmt(n - save[cur])} 부족해요`); return false; }
  save[cur] -= n; persist(); renderTopBar(); return true;
}
function gain(cur, n) { save[cur] += n; persist(); renderTopBar(); }
// 계정 레벨업 보상 (ACCOUNT in data.js): 에너지 가득 충전 + 미네랄 (dust × 새 레벨) + 별모래; 방치 수입도 레벨마다 늘어요
function gainAccXp(v) {
  save.xp += v; const out = { up: 0, dust: 0, piece: 0 };
  while (save.xp >= accNeed(save.lv)) {
    save.xp -= accNeed(save.lv); save.lv += 1; out.up += 1;
    out.dust += ACCOUNT.dust * save.lv; out.piece += ACCOUNT.piece;
  }
  if (out.up) { save.dust += out.dust; save.piece += out.piece; for (const m of ['pvp', 'arcade']) { const st = staminaNow(m); st.n = Math.max(st.n, staMax(m)); st.t = Date.now(); } }
  persist(); return out;
}

/* ---------- 에너지 (STAMINA in data.js): 배틀과 아케이드가 따로 · 한 판에 cost, regenMin분마다 1칸 ----------
   save.stamina (배틀, 최대 max) and save.staminaA (아케이드, 최대 arcadeMax) = { n, t }: t is when the current
   regen period started, so the count catches up from the clock alone, even after days offline. */
const STA_NAME = { pvp: '배틀', arcade: '아케이드' };
const staMode = m => (m === 'arcade' ? 'arcade' : 'pvp');
const staMax = m => (staMode(m) === 'arcade' ? STAMINA.arcadeMax : STAMINA.max);
const regenMs = () => Math.max(1, STAMINA.regenMin) * 60000;
function staminaNow(m) {
  const st = staMode(m) === 'arcade' ? save.staminaA : save.stamina, now = Date.now(), max = staMax(m);
  if (st.n >= max) { st.t = now; return st; }
  if (st.t > now) st.t = now; // clock moved backwards
  const k = Math.floor((now - st.t) / regenMs());
  if (k > 0) { st.n = Math.min(max, st.n + k); st.t = st.n >= max ? now : st.t + k * regenMs(); }
  return st;
}
const staminaNext = m => { const st = staminaNow(m); return st.n >= staMax(m) ? 0 : regenMs() - (Date.now() - st.t); };
const clock = ms => { const t = Math.ceil(ms / 1000), h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), x = t % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
function useStamina(m) {
  const st = staminaNow(m);
  if (st.n < STAMINA.cost) {
    if (G.state === 'home') openStaminaInfo(m); else toast(`${STA_NAME[staMode(m)]} 에너지가 부족해요 · ${clock(staminaNext(m))} 후 1칸 충전돼요`);
    return false;
  }
  st.n -= STAMINA.cost; persist(); renderEnergy(); return true;
}
// Every battle start (로비 · 다시 출항 · 재시작) goes through here: team check, then one energy of that mode
function tryStart(mode) {
  if (!checkTeam() || !useStamina(mode)) return false;
  startRun(mode); return true;
}
function openStaminaInfo(focus) {
  const row = m => {
    const st = staminaNow(m), next = staminaNext(m), max = staMax(m);
    return `<h4 class="set-h">${STA_NAME[m]} 에너지 ${st.n} / ${max}</h4>
    <p class="mtxt">${next ? `다음 충전까지 <b>${clock(next)}</b> · 가득 차기까지 ${clock(next + (max - st.n - 1) * regenMs())}` : '지금 가득 차 있어요.'}</p>`;
  };
  const order = staMode(focus) === 'arcade' ? ['arcade', 'pvp'] : ['pvp', 'arcade'];
  openModal(`<h3>에너지</h3>
    <p class="mtxt">배틀과 아케이드는 에너지를 따로 써요. 한 판에 <b>${STAMINA.cost}</b>칸, <b>${STAMINA.regenMin}분</b>마다 1칸씩 게임을 꺼 두어도 차올라요 (배틀 최대 ${STAMINA.max}칸 · 아케이드 최대 ${STAMINA.arcadeMax}칸).</p>
    ${order.map(row).join('')}
    <p class="mtxt">계정 레벨이 오르면 두 에너지가 모두 가득 채워져요.</p>
    <div class="mbtns"><button class="cta sm" data-act="ok" type="button">확인</button></div>`, () => closeModal());
}
// 상단 재화 영역의 에너지 칩 (배틀 · 아케이드)
function renderEnergy() {
  for (const m of ['pvp', 'arcade']) {
    const st = staminaNow(m), el = $(m === 'pvp' ? 'tbEnPvp' : 'tbEnArc');
    el.querySelector('b').textContent = `${st.n}/${staMax(m)}`;
    el.classList.toggle('low', st.n < STAMINA.cost);
    const next = staminaNext(m);
    el.title = `${STA_NAME[m]} 에너지 · ${next ? clock(next) + ' 후 +1' : '가득'}`;
  }
}
// 계정 레벨: what earns XP and what a level-up gives
function openAccountInfo() {
  const need = accNeed(save.lv);
  openModal(`<h3>계정 Lv ${save.lv}</h3>
    <div class="gauge"><i style="transform:scaleX(${clamp(save.xp / need, 0, 1)})"></i></div>
    <p class="mtxt">경험치 <b>${fmt(save.xp)} / ${fmt(need)}</b> · 다음 레벨까지 ${fmt(need - save.xp)}</p>
    <h4 class="set-h">경험치 얻는 법</h4>
    <p class="mtxt">아케이드: 도달한 웨이브 × ${ACCOUNT.arcadeXp}<br>대전: 승리 ${ACCOUNT.winXp} · 패배 ${ACCOUNT.loseXp}<br>레벨 L에서 L+1로 가려면 ${ACCOUNT.need} × L 이 필요해요.</p>
    <h4 class="set-h">레벨업 보상</h4>
    <p class="mtxt">에너지 가득 충전<br>미네랄 ${fmt(ACCOUNT.dust)} × 새 레벨 (Lv ${save.lv + 1} → ${fmt(ACCOUNT.dust * (save.lv + 1))})<br>별모래 ${fmt(ACCOUNT.piece)}<br>방치 수입 시간당 미네랄 +${INCOME.dustPerLv}</p>
    <div class="mbtns"><button class="cta sm" data-act="ok" type="button">확인</button></div>`, () => closeModal());
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
const orbStyle = (pid, tint = null) => {
  const d = PLANET[pid], glow = { earth: '80,150,255', sun: '255,160,40', moon: '200,205,235' }[d.kind] || d.look.glow;
  return `background:url(${pxPlanetUrl(pid, tint)}) center/contain no-repeat;filter:drop-shadow(0 0 8px rgba(${glow},.45))${d.look && d.look.ring ? ';transform:scale(1.7)' : ''}`;
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
      save.form = [[id, ...save.form[0].filter(x => x !== id)], save.form[1].filter(x => x !== id)]; normalizeForm();
    }
    save.lastCollect = Date.now(); save.joinedAt = Date.now(); persist(); gwEvent('sign_up', {});
    enterHome();
    if (save.birthday) { const id = save.team[0]; setTimeout(() => showGachaResult([{ id, g: 4, res: 'new' }], '탄생 별자리 지급'), 350); }
  });
  $('titleTap').addEventListener('click', () => enterHome());
  $('titleLink').addEventListener('click', () => window.CLOUD && CLOUD.linkGoogle());
  // offered only while a guest can still pick up an existing Google account's progress
  addEventListener('gw-cloud', () => { const C = window.CLOUD; $('titleLink').hidden = !C || C.state === 'off' || !!(C.account && !C.account.guest); });
})();

/* ---------- Screen switching ---------- */
const TABS = ['home', 'team', 'planets', 'stars', 'skills', 'store'];
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
  ({ store: renderStore, planets: renderPlanets, home: renderHome, stars: renderStars, team: renderTeam, skills: renderSkills })[t]();
  if (t === 'home') requestAnimationFrame(layoutHome);
}
document.querySelector('.nav').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; if (b.dataset.tab === 'stars') starView = 'list'; if (b.dataset.tab === 'planets') planetView = 'list'; setTab(b.dataset.tab); });

function renderTopBar() {
  $('tbLv').textContent = save.lv;
  $('tbName').textContent = save.name || '게스트';
  $('tbDust').textContent = fmt(save.dust);
  $('tbPiece').textContent = fmt(save.piece);
  $('tbXp').style.transform = `scaleX(${clamp(save.xp / accNeed(save.lv), 0, 1)})`;
  renderEnergy();
}
$('gearBtn').addEventListener('click', openSettings);

/* ---------- Lobby (화면설계서 5–10p) ---------- */
const HOME = { sys: null, rocks: [], shots: [], booms: [], spawn: 0, skyBottom: 0, chestCd: rnd(...AD_CHEST.first), loot: null };
function enterHome() {
  G.state = 'home'; G.me = null; G.foe = null; G.zone = ZONES[1]; G.shield = 0; G.pShield = 0;
  G.fx = []; G.texts = []; G.proj = []; G.beams = []; $('banner').classList.remove('show');
  HOME.sys = buildMySystem(); HOME.rocks = []; HOME.shots = []; HOME.booms = []; HOME.loot = null;
  setScreen('shell'); renderTopBar(); setTab(tab); layoutHome();
}
// The home system sits just above the lobby cards so meteors cross a tall stretch of open sky
function layoutHome() {
  const s = HOME.sys; if (!s) return;
  const top = 70, cardEl = document.querySelector('#pane-home .power');
  const cvTop = cv.getBoundingClientRect().top;
  const cardTop = cardEl && !$('shell').hidden && tab === 'home' ? cardEl.getBoundingClientRect().top - cvTop : H - 370;
  s.R = Math.min(W * .41, 165); s.ry = s.R * ORBIT_TILT; s.pr = s.R * PLANET_RF[0];
  s.cx = W / 2;
  s.cy = Math.max(top + (cardTop - top) * .55, cardTop - s.ry - s.R * .32 - 6);
  HOME.skyBottom = s.cy - s.ry - s.R * .25; // interceptions happen above this line
}
function pendingIncome() {
  const hrs = Math.min(INCOME.capHours, (Date.now() - save.lastCollect) / 3600000);
  return { dust: Math.floor(hrs * INCOME.dust(save.lv)), piece: Math.floor(hrs * INCOME.piece()), hrs };
}
function renderHome() {
  const inc = pendingIncome();
  $('incDust').textContent = '+' + fmt(inc.dust);
  $('incPiece').textContent = '+' + fmt(inc.piece);
  $('incRate').textContent = `시간당 미네랄 ${INCOME.dust(save.lv)} · 별모래 ${INCOME.piece()} · 최대 ${INCOME.capHours}시간`;
  $('collectBtn').disabled = inc.dust < 1 && inc.piece < 1;
  const chests = Math.floor(save.chest / CHEST_STEP);
  $('chestFill').style.transform = `scaleX(${(save.chest % CHEST_STEP) / CHEST_STEP})`;
  $('chestTxt').textContent = `${save.chest % CHEST_STEP} / ${CHEST_STEP}`;
  $('chestOpen').textContent = chests ? `열기 ×${chests}` : `${save.chest % CHEST_STEP} / ${CHEST_STEP}`;
  $('chestBtn').disabled = chests === 0;
  renderEnergy();
  document.querySelectorAll('.mode .en').forEach(e => { e.textContent = `⚡${STAMINA.cost}`; });
  $('homeBest').textContent = save.best ? `최고 WAVE ${save.best}` : '기록 없음';
  $('homePvp').textContent = `${save.wins}승 ${save.losses}패`;
  $('homePower').textContent = fmt(teamPower());
  refreshPowerRank();
}
// 전투력 옆의 전체 랭킹: Firestore count, at most every 60s or when 전투력 changes
const PRANK = { at: 0, power: -1, busy: false };
function refreshPowerRank() {
  const power = Math.round(teamPower());
  if (PRANK.busy || !window.CLOUD || !CLOUD.powerRank || !CLOUD.uid) return;
  if (power === PRANK.power && Date.now() - PRANK.at < 60000) return;
  PRANK.busy = true; PRANK.power = power; PRANK.at = Date.now();
  CLOUD.powerRank(power).then(r => {
    $('homeRankN').textContent = `${fmt(r.rank)}위`; $('homeRankT').textContent = `/ ${fmt(r.total)}명`; $('homeRank').hidden = false;
  }).catch(err => console.warn('power rank', err)).finally(() => { PRANK.busy = false; });
}
$('homeRank').addEventListener('click', () => window.LIVE && LIVE.open('ranking', 'power'));
$('collectBtn').addEventListener('click', () => {
  const inc = pendingIncome();
  save.dust += inc.dust; save.piece += inc.piece;
  save.lastCollect = Date.now(); persist(); renderTopBar(); renderHome();
  toast(`미네랄 ${fmt(inc.dust)} · 별모래 ${fmt(inc.piece)} 수령`);
});
$('chestBtn').addEventListener('click', () => {
  const n = Math.floor(save.chest / CHEST_STEP); if (!n) return;
  save.chest -= n * CHEST_STEP;
  const got = []; let dust = 0, piece = 0;
  const O = CHEST_ODDS;
  for (let i = 0; i < n; i++) {
    const r = Math.random();
    const skin = r < O.skin ? dropSkin() : null;
    if (skin) got.push(skin);
    else if (r < O.skin + O.dust) dust += Math.round(rnd(800, 1500));
    else if (r < O.skin + O.dust + O.piece) piece += Math.round(rnd(20, 50));
    else got.push(rollCon(GACHA.gold.w, 'gold'));
  }
  save.dust += dust; save.piece += piece; persist(); renderTopBar(); renderHome();
  showGachaResult(got, `상자 ${n}개`, [dust && `미네랄 +${fmt(dust)}`, piece && `별모래 +${fmt(piece)}`].filter(Boolean));
});
$('arcadeBtn').addEventListener('click', () => tryStart('arcade'));
$('pvpBtn').addEventListener('click', () => tryStart('pvp'));
$('tbEnPvp').addEventListener('click', () => openStaminaInfo('pvp'));
$('tbEnArc').addEventListener('click', () => openStaminaInfo('arcade'));
document.querySelector('.lvbadge').addEventListener('click', openAccountInfo);
function checkTeam() { normalizeForm(); if (save.team.length < TEAM_MIN) { toast('팀 탭에서 별자리를 1개 이상 편성해 주세요'); setTab('team'); return false; } return true; }

function updateHome(dt) {
  const s = HOME.sys; if (!s) return;
  updateSystem(s, dt);
  HOME.spawn -= dt;
  if (HOME.spawn <= 0) { // 운석 요격 연출
    HOME.spawn = rnd(.6, 1.1);
    const x = rnd(W * .05, W * .95), tx = s.cx + rnd(-s.R, s.R), vy = rnd(38, 62);
    const pts = Array.from({ length: 8 }, (_, i) => [Math.cos(i / 8 * TAU) * rnd(.72, 1), Math.sin(i / 8 * TAU) * rnd(.72, 1)]);
    HOME.rocks.push({ x, y: -24, vx: (tx - x) / ((s.cy + 24) / vy), vy, r: rnd(8, 15), rot: rnd(0, TAU), vr: rnd(-1.2, 1.2), pts, v: Math.floor(Math.random() * 4), hp: 1, locked: 0 });
  }
  // 낙하 보물상자: at most one falling or waiting at a time
  HOME.chestCd -= dt;
  if (HOME.chestCd <= 0 && !HOME.loot && !HOME.rocks.some(r => r.kind === 'chest')) {
    HOME.chestCd = rnd(...AD_CHEST.cd);
    const x = rnd(W * .2, W * .8);
    HOME.rocks.push({ kind: 'chest', x, y: -30, vx: (s.cx - x) / ((s.cy + 30) / 34), vy: 34, r: 15, rot: 0, vr: 0, hp: AD_CHEST.hp, locked: 0 });
  }
  if (HOME.loot && (HOME.loot.t += dt) > AD_CHEST.life) { HOME.loot = null; } // unclaimed chest drifts away
  const sky = HOME.skyBottom || H * .5;
  for (const c of s.cons) {
    c.cd -= dt * c.rate * .55;
    if (c.cd > 0) continue;
    // aim only at meteors that are well inside the open sky and not already locked by two shots
    const skyTop = 70 + (sky - 70) * .35; // let meteors fall into view first
    const cand = HOME.rocks.filter(r => r.hp > 0 && r.y > skyTop && r.y < sky && r.locked < (r.kind === 'chest' ? r.hp : 2));
    if (!cand.length) { c.cd = .1; continue; }
    const t = cand.sort((a, b) => b.y - a.y)[0];
    t.locked += 1; c.cd = 1;
    HOME.shots.push({ x: c.x, y: c.y, t, col: c.skin ? c.skin.pal.proj : '#ffd76a', trail: [] });
  }
  for (let i = HOME.shots.length - 1; i >= 0; i--) {
    const p = HOME.shots[i], dx = p.t.x - p.x, dy = p.t.y - p.y, d = Math.hypot(dx, dy);
    p.trail.push([p.x, p.y]); if (p.trail.length > 6) p.trail.shift();
    if (p.t.hp <= 0) { HOME.shots.splice(i, 1); continue; }
    if (d < p.t.r && p.t.kind === 'chest') {
      HOME.shots.splice(i, 1); p.t.hp -= 1; p.t.locked -= 1; p.t.flash = .15;
      burst(p.t.x, p.t.y, 8, '#ffe08a');
      if (p.t.hp <= 0) chestBroken(p.t);
      continue;
    }
    if (d < p.t.r) {
      p.t.hp = 0; HOME.shots.splice(i, 1);
      burst(p.t.x, p.t.y, 16, '#ffb05a'); burst(p.t.x, p.t.y, 10, '#c9b89a');
      HOME.booms.push({ x: p.t.x, y: p.t.y, r: p.t.r, t: .45, col: p.col });
      continue;
    }
    p.vx = dx / d; p.vy = dy / d; p.x += p.vx * 420 * dt; p.y += p.vy * 420 * dt;
  }
  HOME.rocks = HOME.rocks.filter(r => {
    r.x += r.vx * dt; r.y += r.vy * dt; r.rot += r.vr * dt;
    if (r.flash > 0) r.flash -= dt;
    if (r.hp > 0 && r.kind === 'chest' && r.y > sky + 10) { chestBroken(r); return false; } // caught before it reaches the planet
    if (r.hp > 0 && Math.hypot(r.x - s.cx, r.y - s.cy) < s.pr) { burst(r.x, r.y, 10, '#9fb8ff'); return false; } // absorbed by the planet's field
    return r.hp > 0 && r.y < H + 30;
  });
  HOME.booms = HOME.booms.filter(b => (b.t -= dt) > 0);
  for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t -= dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.t <= 0) G.fx.splice(i, 1); }
}
function chestBroken(r) {
  r.hp = 0;
  const sky = HOME.skyBottom || H * .5;
  HOME.loot = { x: clamp(r.x, 40, W - 40), y: clamp(r.y, 110, sky - 20), t: 0 };
  burst(r.x, r.y, 26, '#ffd76a'); HOME.booms.push({ x: r.x, y: r.y, r: 18, t: .45, col: '#ffd76a' });
}
function drawChest(x, y, w, open, flash) {
  const im = pxSprite('chest_closed');
  if (im) { // pixel chest (img/chest_closed.png); a hit flashes it white
    pxDraw(ctx, im, x, y, w * 1.15);
    if (flash > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7; pxDraw(ctx, im, x, y, w * 1.15); ctx.restore(); }
    return;
  }
  const h = w * .72;
  ctx.fillStyle = flash > 0 ? '#fff' : '#e39a1f';
  const g = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
  g.addColorStop(0, '#ffe08a'); g.addColorStop(.55, '#e39a1f'); g.addColorStop(1, '#8a5208');
  if (!flash || flash <= 0) ctx.fillStyle = g;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, 5) : ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill();
  ctx.fillStyle = '#6b3c05'; ctx.fillRect(x - w / 2, y - h / 2 + h * .32, w, h * .09);
  ctx.fillStyle = '#fff1c2'; ctx.fillRect(x - w * .08, y - h / 2 + h * .22, w * .16, h * .3);
}
// blocky fire trail behind a falling rock: squares shrink and cool from white-hot to ember
const TRAIL_COL = ['#fff1a8', '#ffd24a', '#ff9a2a', '#ff6a2a', '#d8452a', '#8a2c3a'];
function pixelTrail(x, y, ux, uy, r) {
  const u = Math.max(2, Math.round(r / 5));
  TRAIL_COL.forEach((c, i) => {
    const d = r * .7 + i * r * .62, sz = u * Math.max(1, Math.round((6 - i) * .55 + 1));
    ctx.globalAlpha = 1 - i * .13; ctx.fillStyle = c;
    ctx.fillRect(Math.round((x - ux * d - sz / 2) / u) * u, Math.round((y - uy * d - sz / 2) / u) * u, sz, sz);
  });
  ctx.globalAlpha = 1;
}
function drawHome(t) {
  drawBg(t);
  const s = HOME.sys; if (!s) return;
  for (const r of HOME.rocks) {
    // fiery entry trail, then the rock itself
    const sp = Math.hypot(r.vx, r.vy), ux = r.vx / sp, uy = r.vy / sp;
    if (save.settings.glow) pixelTrail(r.x, r.y, ux, uy, r.r);
    if (r.kind === 'chest') {
      ctx.save(); ctx.globalAlpha = .35 + .15 * Math.sin(t * 6); ctx.fillStyle = '#ffd76a';
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r * 1.9, 0, TAU); ctx.fill(); ctx.restore();
      drawChest(r.x, r.y + Math.sin(t * 3) * 2, r.r * 2, false, r.flash);
      for (let i = 0; i < AD_CHEST.hp; i++) { ctx.fillStyle = i < r.hp ? '#ffd76a' : 'rgba(255,255,255,.2)'; ctx.fillRect(r.x - 12 + i * 9, r.y + r.r + 6, 7, 3); }
      continue;
    }
    const rim = pxSprite('rock_' + (r.v || 0));
    if (rim) pxDraw(ctx, rim, r.x, r.y, r.r * 2.3, r.rot);
    else {
    ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rot);
    const rg = ctx.createRadialGradient(-r.r * .3, -r.r * .3, 0, 0, 0, r.r);
    rg.addColorStop(0, '#b3a7bf'); rg.addColorStop(1, '#4e4658');
    ctx.fillStyle = rg; ctx.strokeStyle = 'rgba(255,190,130,.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); r.pts.forEach(([px, py], i) => i ? ctx.lineTo(px * r.r, py * r.r) : ctx.moveTo(px * r.r, py * r.r)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    }
    if (r.locked) { ctx.strokeStyle = 'rgba(245,196,81,.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(r.x, r.y, r.r + 5, 0, TAU); ctx.stroke(); }
  }
  drawSystem(s, t);
  for (const p of HOME.shots) {
    ctx.fillStyle = p.col; // dotted pixel trail, white-hot square head
    p.trail.forEach(([x, y], i) => { ctx.globalAlpha = (i + 1) / p.trail.length; ctx.fillRect(Math.round(x) - 1.5, Math.round(y) - 1.5, 3, 3); });
    ctx.globalAlpha = 1; ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4);
  }
  for (const b of HOME.booms) {
    const k = 1 - b.t / .45;
    // pixel blast: a ring of square sparks flying out around a shrinking hot core
    const rr = b.r + k * 26, u = Math.max(2, Math.round(4 * (1 - k)));
    ctx.globalAlpha = 1 - k; ctx.fillStyle = b.col;
    for (let i = 0; i < 12; i++) { const a = i * TAU / 12; ctx.fillRect(Math.round(b.x + Math.cos(a) * rr - u / 2), Math.round(b.y + Math.sin(a) * rr - u / 2), u, u); }
    const c = Math.round((b.r * (1 - k) + 2) * .6);
    ctx.fillStyle = `rgba(255,230,180,${.6 * (1 - k)})`; ctx.fillRect(Math.round(b.x - c), Math.round(b.y - c), c * 2, c * 2);
  }
  for (const f of G.fx) { ctx.globalAlpha = clamp(f.t * 1.6, 0, 1); ctx.fillStyle = f.c; ctx.fillRect(f.x - 1.4, f.y - 1.4, 2.8, 2.8); }
  ctx.globalAlpha = 1;
  const L = HOME.loot;
  if (L) { // waiting reward chest: rays, bobbing box, call to action
    const y = L.y + Math.sin(t * 2.4) * 4, fade = clamp((AD_CHEST.life - L.t) / 3, 0, 1);
    ctx.globalAlpha = fade;
    ctx.save(); ctx.translate(L.x, y); ctx.rotate(t * .6);
    for (let i = 0; i < 10; i++) { ctx.rotate(TAU / 10); ctx.fillStyle = 'rgba(255,215,106,.16)'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-7, -46); ctx.lineTo(7, -46); ctx.fill(); }
    ctx.restore();
    drawChest(L.x, y, 38, false, 0);
    ctx.font = '700 12px "Noto Sans KR", sans-serif'; ctx.textAlign = 'center';
    const label = save.adPass ? '탭해서 열기' : '▶ 광고 보고 열기';
    const tw = ctx.measureText(label).width + 20;
    ctx.fillStyle = 'rgba(10,14,36,.85)'; ctx.strokeStyle = 'rgba(245,196,81,.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(L.x - tw / 2, y + 26, tw, 22, 11) : ctx.rect(L.x - tw / 2, y + 26, tw, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f5c451'; ctx.fillText(label, L.x, y + 41);
    ctx.globalAlpha = 1;
  }
}

/* ---------- 광고 보상 상자 ---------- */
$('shell').addEventListener('pointerdown', e => {
  if (tab !== 'home' || !HOME.loot || e.target.closest('button, .hcard, .modes, .power, .topbar, .nav')) return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (Math.hypot(x - HOME.loot.x, y - (HOME.loot.y + 18)) < 48) openAdChest();
});
function openAdChest() {
  const pass = save.adPass;
  openModal(`<div class="loot-art"><span class="box"></span></div>
    <h3>보물 상자</h3>
    <p class="mtxt">열면 <b class="piece">별모래 ${AD_CHEST.reward[0]}~${AD_CHEST.reward[1]}개</b>를 받아요.</p>
    <div class="mbtns">
      <button class="ghost" data-act="later" type="button">나중에</button>
      <button class="cta sm" data-act="open" type="button">${pass ? '바로 열기' : '▶ 광고 보고 열기'}</button>
    </div>
    <p class="ad-note">${pass ? '광고 무제한 패키지 적용 중 · 광고 없이 열려요' : `${Ads.label} · ${Ads.network} 보상형 광고${Ads.native ? '' : ' (프로토타입에서는 테스트 광고)'} · 광고 무제한 패키지를 사면 바로 열 수 있어요`}</p>`,
  async act => {
    if (act === 'later') { closeModal(); return; }
    closeModal();
    let ok = pass;
    if (!pass) { const res = await Ads.showRewarded('lobby_chest'); ok = res.rewarded; if (!ok) { toast(res.error ? '광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요' : '광고를 끝까지 보면 보상을 받아요'); return; } }
    if (!HOME.loot) return;
    const n = Math.round(rnd(...AD_CHEST.reward));
    const { x, y } = HOME.loot; HOME.loot = null;
    burst(x, y, 30, '#c77dff'); HOME.booms.push({ x, y, r: 20, t: .45, col: '#c77dff' });
    gain('piece', n);
    showGachaResult([], '보물 상자', [`별모래 +${fmt(n)}`]);
  });
}

const gwEvent = (name, params) => window.CLOUD && CLOUD.event(name, params); // cloud.js: stats + analytics
// 우편함 · 쿠폰 rewards → applied to the save, shown like a gacha result
function grantRewards(rewards, title) {
  const cards = [], extra = [];
  for (const r of rewards || []) {
    const n = Math.max(1, r.n | 0);
    if (r.type === 'dust') { save.dust += n; extra.push(`미네랄 +${fmt(n)}`); }
    else if (r.type === 'piece') { save.piece += n; extra.push(`별모래 +${fmt(n)}`); }
    else if (r.type === 'chest') { save.chest = Math.min(CHEST_MAX, save.chest + n); extra.push(`보물 상자 +${n}칸`); }
    else if (r.type === 'con' && CON[r.id]) for (let i = 0; i < Math.min(n, 30); i++) cards.push(grantCon(r.id, clamp(r.g | 0, 0, GRADES.length - 1)));
    else if (r.type === 'skin' && SKIN[r.id]) {
      const sk = SKIN[r.id];
      if (ownsSkin(sk.con, sk.id)) { save.piece += 100; extra.push(`${sk.name} (보유 중) → 별모래 +100`); }
      else { addSkin(sk.id); cards.push({ skin: sk.id, id: sk.con }); }
    }
  }
  showGachaResult(cards, title, extra);
}

// 확률 정보 (확률형 아이템 표시): straight from the live data, so it always matches the released balance
function showProbability() {
  const pct = (v, sum) => `${(+(v / sum * 100).toFixed(2))}%`;
  const gacha = Object.keys(GACHA).map(k => conOddsHtml(k)).join('');
  const csum = Object.values(CHEST_ODDS).reduce((a, b) => a + b, 0), cl = { skin: '성운 스킨', dust: '미네랄', piece: '별모래', con: '별자리 카드' };
  openModal(`<h3>확률 정보</h3><div class="doc-body prob-body">${gacha}
    ${SKILL_DRAWS.map(skillOddsHtml).join('')}
    <p class="mtxt">등급 안에서는 스킬마다 같은 확률이에요. UR(고유) 스킬은 뽑기에 나오지 않아요.</p>
    <h4>보물 상자</h4><ul class="prob">${Object.entries(CHEST_ODDS).map(([k, v]) => `<li><span>${cl[k] || k}</span><b>${pct(v, csum)}</b></li>`).join('')}</ul>
    <h4>강화 성공률</h4><ul class="prob">${ENHANCE_RATE.map((v, i) => `<li><span>+${i} → +${i + 1}</span><b>${Math.round(v * 100)}%</b></li>`).join('')}</ul></div>
    <div class="mbtns"><button class="cta sm" data-act="close" type="button">닫기</button></div>`, () => closeModal());
}

// 별자리 뽑기 확률 (상점 별자리 탭 · 확률 정보): grade by weight, then a constellation of the pool at equal odds
const conPool = k => ALL_CONS.filter(c => GACHA_POOL.con[c.id] && GACHA_POOL.con[c.id][k]);
function conOddsHtml(k) {
  const g = GACHA[k], sum = g.w.reduce((a, b) => a + b, 0) || 1, pool = conPool(k);
  return `<h4>${g.name}</h4><ul class="prob">${GRADES.map((gr, i) => g.w[i] ? `<li><span>${gr.name}</span><b>${+(g.w[i] / sum * 100).toFixed(2)}%</b></li>` : '').join('')}</ul>
    <p class="mtxt">별자리는 ${pool.map(c => c.name).join(' · ')} ${pool.length}종 중 같은 확률(각 ${+(100 / (pool.length || 1)).toFixed(2)}%)로 정해져요.</p>`;
}
function skillOddsHtml(k) {
  const pw = skPoolW(k), ids = Object.keys(ESKILL).filter(id => skInPool(k, id));
  return `<h4>${SKILL_GACHA[k].name}</h4><ul class="prob">${DRAW_GRADES.filter(g => pw[g] > 0).map(g => { const n = ids.filter(id => ESKILL[id].grade === g).length;
    return `<li><span>${g} ${SKILL_GRADES[g].name} <small>${n}종 · 각 ${+(parseFloat(skPct(k, g)) / n).toFixed(3)}%</small></span><b>${skPct(k, g)}</b></li>`; }).join('')}</ul>`;
}

/* ---------- Gacha / constellation rewards ---------- */
function rollGrade(w) {
  const sum = w.reduce((a, b) => a + b, 0); let r = Math.random() * sum;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r < 0) return i; }
  return w.length - 1;
}
// Grants a constellation card: new → owned, higher grade → upgrade, otherwise converts to 미네랄
function rollCon(w, draw) {
  let pool = ALL_CONS.filter(c => GACHA_POOL.con[c.id] && GACHA_POOL.con[c.id][draw]); // 뽑기 관리 (관리자)
  if (!pool.length) pool = ZODIAC;
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
// 성운 스킨 drop from a chest: an unowned chest skin, preferring constellations the player owns
function dropSkin() {
  const pool = Object.values(SKIN).filter(s => SKIN_TIER[s.tier].src === 'chest' && !ownsSkin(s.con, s.id));
  if (!pool.length) return null;
  const mine = pool.filter(s => save.cons[s.con]), from = mine.length ? mine : pool;
  const s = from[Math.floor(Math.random() * from.length)];
  addSkin(s.id);
  return { skin: s.id, id: s.con };
}
function showGachaResult(list, title, extra = []) {
  persist(); renderTopBar();
  const label = r => r.res === 'new' ? '<em class="new">NEW</em>' : r.res === 'up' ? '<em class="up">등급 상승</em>' : `<em>미네랄 +${fmt(r.dust)}</em>`;
  const card = (r, i) => r.skin
    ? `<div class="gcard skin" style="--g:rgb(${SKIN[r.skin].pal.line});animation-delay:${i * 70}ms">
        ${conSvg(r.id, 64, { skin: r.skin })}<b>${SKIN[r.skin].name}</b><span class="gchip" style="--g:rgb(${SKIN[r.skin].pal.line})">${SKIN_TIER[SKIN[r.skin].tier].name} 스킨</span><em class="new">SKIN</em>
      </div>`
    : `<div class="gcard" data-g="${r.g}" style="--g:${GRADES[r.g].col};animation-delay:${i * 70}ms">
        ${conSvg(r.id, 64)}<b>${CON[r.id].name}</b>${gradeChip(r.g)}${label(r)}
      </div>`;
  openModal(`<h3>${title}</h3>
    ${extra.length ? `<p class="mtxt">${extra.join(' · ')}</p>` : ''}
    ${list.length ? `<div class="gres">${list.map(card).join('')}</div>` : ''}
    <div class="mbtns"><button class="cta sm" data-act="ok" type="button">확인</button></div>`, () => { closeModal(); if (tab !== 'home') setTab(tab); else renderHome(); });
}
function conSvg(id, size, opts = {}) {
  const sk = SKIN[opts.skin || (save.cons[id] ? equippedSkin(id) : id)];
  // every skin has its own pixel art: img/con_<skin id>.webp (classic skin id = constellation id)
  return `<img class="csvg cimg${opts.dim ? ' dim' : ''}" src="img/con_${sk.id}.webp" width="${size}" height="${size}" alt="" aria-hidden="true">`;
}

/* ---------- 스킬 뽑기 ---------- */
const skInPool = (k, id) => !!(GACHA_POOL.skill[id] && GACHA_POOL.skill[id][k]);
const skSum = k => { const w = skPoolW(k); return DRAW_GRADES.reduce((a, g) => a + w[g], 0); };
const skPct = (k, g) => `${+(skPoolW(k)[g] / (skSum(k) || 1) * 100).toFixed(2)}%`;
const skOdds = (k, long) => DRAW_GRADES.filter(g => skPoolW(k)[g] > 0).map(g => `${g}${long ? `(${SKILL_GRADES[g].name})` : ''} ${skPct(k, g)}`).join(' · ');
// Grade by weight, then a skill of that grade at equal odds; a skill already owned turns into 미네랄
function rollSkill(k) {
  const pw = skPoolW(k), w = DRAW_GRADES.map(g => pw[g]), ids = Object.keys(ESKILL);
  let grade = DRAW_GRADES[rollGrade(w)], pool = ids.filter(id => ESKILL[id].grade === grade && skInPool(k, id));
  if (!pool.length) { pool = ids; grade = null; }
  const id = pool[Math.floor(Math.random() * pool.length)];
  if (!save.skills.includes(id)) { save.skills.push(id); return { id, res: 'new' }; }
  if (skLv(id) >= skillMaxLv()) { const d = SKILL_GACHA.dupe[ESKILL[id].grade] || 0; save.dust += d; return { id, res: 'dup', dust: d }; } // max level: 미네랄
  save.skillCopies[id] = (save.skillCopies[id] || 0) + 1;
  let up = false;
  while (skLv(id) < skillMaxLv() && save.skillCopies[id] >= skNeed(id)) { save.skillCopies[id] -= skNeed(id); save.skillLv[id] = skLv(id) + 1; up = true; }
  return { id, res: up ? 'up' : 'copy', lv: skLv(id), copies: save.skillCopies[id], need: skNeed(id) };
}
function showSkillResult(list, title) {
  persist(); renderTopBar();
  const card = (r, i) => { const d = ESKILL[r.id], col = SKILL_GRADES[d.grade].col; return `<div class="gcard skill" style="--g:${col};animation-delay:${i * 70}ms">
      <img class="sk-ic" src="img/sk_${(GSKILL[d.type] || GSKILL.meteor).icon}.png" width="48" height="48" alt="" aria-hidden="true">
      <b>${d.name}</b><span>${skillChip(d.grade)} ${catChip(d)}</span>${r.res === 'new' ? '<em class="new">NEW</em>' : r.res === 'up' ? `<em class="up">Lv ${r.lv} 달성</em>` : r.res === 'copy' ? `<em>누적 ${r.copies}/${r.need}</em>` : `<em>MAX · 미네랄 +${fmt(r.dust)}</em>`}</div>`; };
  openModal(`<h3>${title}</h3><div class="gres">${list.map(card).join('')}</div>
    <p class="mtxt">새 스킬은 행성 탭에서 장착할 수 있어요.</p>
    <div class="mbtns"><button class="cta sm" data-act="ok" type="button">확인</button></div>`, () => { closeModal(); setTab(tab); });
}

/* ---------- 상점 (Store) ---------- */
function renderStore() {
  const t = SHOP_TABS[storeTab] ? storeTab : 'rec', items = SHOP.filter(p => p.tab === t && shopOpen(p));
  const banners = items.filter(p => p.type === 'banner'), always = items.filter(p => p.type !== 'banner');
  const gachaCards = t === 'con' ? ['gold', 'paid'].map(k => { const g = GACHA[k]; return `
        <section class="shop-card gacha-${k}">
          <h3>${g.name}</h3>
          <p class="mini">${k === 'paid' ? '레어 이상 확정' : '별자리 카드'} · ${conPool(k).length}종</p>
          <button class="buy" data-gacha="${k}" data-n="1" type="button"><span>1회</span><b class="${g.cur}">${fmt(g.cost)}</b></button>
          <button class="buy" data-gacha="${k}" data-n="10" type="button"><span>10회</span><b class="${g.cur}">${fmt(g.cost10)}</b></button>
        </section>`; }).join('')
    : t === 'skill' ? SKILL_DRAWS.map(k => { const g = SKILL_GACHA[k]; return `
        <section class="shop-card gacha-skill sk-${k}">
          <h3>${g.name}</h3>
          <p class="mini">${skOdds(k)}</p>
          <button class="buy" data-skgacha="${k}" data-n="1" type="button"><span>1회</span><b class="${g.cur}">${fmt(g.cost)}</b></button>
          <button class="buy" data-skgacha="${k}" data-n="10" type="button"><span>10회</span><b class="${g.cur}">${fmt(g.cost10)}</b></button>
        </section>`; }).join('') : '';
  const top = t === 'con' || t === 'skill' ? banners.slice(0, 2) : banners; // 별자리·스킬 탭: 배너 최대 2개
  const odds = t === 'con' ? `${Object.keys(GACHA).map(conOddsHtml).join('')}
      <h4>보물 상자 1개</h4><p class="mtxt">성운 스킨 ${pct(CHEST_ODDS.skin)} · 미네랄 ${pct(CHEST_ODDS.dust)} · 별모래 ${pct(CHEST_ODDS.piece)} · 별자리 카드 ${pct(CHEST_ODDS.con)} (성운 스킨을 모두 가지면 미네랄로 바뀌어요)</p>
      <p class="mtxt">이미 가진 별자리는 더 높은 등급이면 등급이 오르고, 아니면 미네랄로 바뀌어요. 스페셜 스킨은 별자리 탭에서만 구매할 수 있어요.</p>`
    : t === 'skill' ? `${SKILL_DRAWS.map(skillOddsHtml).join('')}
      <p class="mtxt">등급 안에서는 스킬마다 같은 확률이에요. 이미 가진 스킬은 누적돼서 레벨이 올라요 (최고 레벨이면 미네랄). UR 고유 스킬은 행성마다 정해져 있어 뽑기에 나오지 않아요.</p>` : '';
  $('pane-store').innerHTML = `
    <nav class="store-tabs" aria-label="상점 분류">${Object.entries(SHOP_TABS).map(([k, n]) => `<button type="button" data-stab="${k}" aria-pressed="${k === t}">${n}</button>`).join('')}</nav>
    ${top.map(shopBanner).join('')}
    ${gachaCards ? `<div class="grid2">${gachaCards}</div>` : ''}
    ${always.length ? t === 'piece' ? `<div class="grid3">${always.map(piecePack).join('')}</div>` : always.map(shopRow).join('') : ''}
    ${!top.length && !gachaCards && !always.length ? '<p class="fine">지금 판매 중인 상품이 없어요.</p>' : ''}
    ${odds ? `<section class="shop-odds"><div class="sec-h"><h2>확률 안내</h2></div><div class="prob-body">${odds}</div></section>` : ''}
    <p class="fine">프로토타입이라 실제 결제는 일어나지 않고 바로 지급돼요.</p>`;
}
// 상점 상품 (data.js SHOP, 관리자 [상점 관리]): 노출 기간 안이면 보여요; 다 산 상품은 '구매 완료'
let storeTab = 'rec';
const shopBought = p => (save.shopBuys || {})[p.id] || (p.reward && p.reward.ads && save.adPass ? 1 : 0);
const shopSoldOut = p => (p.limit > 0 && shopBought(p) >= p.limit) || (p.reward && p.reward.ads && !p.reward.piece && !p.reward.dust && !p.reward.con && !p.reward.skill && save.adPass);
function shopPrice(p) {
  if (shopSoldOut(p)) return '구매 완료';
  return p.cur === 'krw' ? `₩${fmt(p.price)}` : `<b class="${p.cur}">${fmt(p.price)}</b>`;
}
function shopSub(p) {
  const out = [];
  if (p.limit > 0) out.push(`계정당 ${p.limit}회${shopBought(p) ? ` · ${Math.min(shopBought(p), p.limit)}회 구매` : ''}`);
  if (p.end && shopOpen(p)) { const d = new Date(p.end); out.push(`${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}까지`); }
  return out.join(' · ');
}
function shopArt(p, size) {
  const r = p.reward || {};
  if (r.con && CON[r.con]) return conSvg(r.con, size);
  if (r.skill && ESKILL[r.skill]) return `<img class="sk-ic" src="img/sk_${(GSKILL[ESKILL[r.skill].type] || GSKILL.meteor).icon}.png" width="${size * .6}" height="${size * .6}" alt="" aria-hidden="true">`;
  return '';
}
const shopBanner = p => `
    <section class="banner-card">
      <div class="bc-art">${shopArt(p, 110)}</div>
      <div class="bc-txt">
        <span class="eyebrow">${p.limit > 0 ? 'LIMITED PACKAGE' : 'PACKAGE'}</span>
        <h3>${p.name}</h3>
        <p>${p.desc || ''}${shopSub(p) ? `<br><small>${shopSub(p)}</small>` : ''}</p>
        <button class="cta sm" data-prod="${p.id}" type="button" ${shopSoldOut(p) ? 'disabled' : ''}>${shopPrice(p)}</button>
      </div>
    </section>`;
const shopRow = p => `
    <section class="shop-card row-card">
      <div><h3>${p.name}</h3><p class="mini">${p.reward && p.reward.ads && save.adPass ? '적용 중 · 모든 광고 없이 바로 보상' : p.desc || ''}${shopSub(p) ? ` · ${shopSub(p)}` : ''}</p></div>
      <button class="buy fit" data-prod="${p.id}" type="button" ${shopSoldOut(p) ? 'disabled' : ''}>${shopPrice(p)}</button>
    </section>`;
const piecePack = p => `
    <button class="piece-pack" data-prod="${p.id}" type="button" ${shopSoldOut(p) ? 'disabled' : ''}><b class="piece">${fmt((p.reward || {}).piece || 0)}</b><small>${p.name}</small><span>${shopPrice(p)}</span></button>`;
function buyProduct(p) {
  if (!shopOpen(p)) { toast('판매 기간이 아니에요'); renderStore(); return; }
  if (shopSoldOut(p)) { toast('이미 구매한 상품이에요'); return; }
  if (p.cur !== 'krw' && !spend(p.cur, p.price)) return;
  const r = p.reward || {}, extra = [], cards = [];
  save.shopBuys = { ...(save.shopBuys || {}), [p.id]: shopBought(p) + 1 };
  if (r.ads) { save.adPass = true; extra.push('광고 제거 적용'); }
  if (r.piece > 0) { save.piece += r.piece; extra.push(`별모래 +${fmt(r.piece)}`); }
  if (r.dust > 0) { save.dust += r.dust; extra.push(`미네랄 +${fmt(r.dust)}`); }
  if (r.con && CON[r.con]) cards.push(grantCon(r.con, clamp(r.grade | 0, 0, GRADES.length - 1)));
  if (r.skill && ESKILL[r.skill]) {
    if (!save.skills.includes(r.skill)) save.skills.push(r.skill); else save.skillCopies[r.skill] = (save.skillCopies[r.skill] || 0) + 1;
    extra.push(`${ESKILL[r.skill].name} 스킬`);
  }
  if (p.cur === 'krw') extra.push('테스트 지급');
  gwEvent('shop', { id: p.id });
  if (cards.length) showGachaResult(cards, p.name, extra);
  else { persist(); renderTopBar(); toast(`${p.name} · ${extra.join(' · ')}`); renderStore(); }
}
$('pane-store').addEventListener('click', e => {
  const st = e.target.closest('[data-stab]');
  if (st) { storeTab = st.dataset.stab; renderStore(); $('pane-store').scrollTop = 0; return; }
  const sg = e.target.closest('[data-skgacha]');
  if (sg) {
    const k = sg.dataset.skgacha, n = +sg.dataset.n, def = SKILL_GACHA[k];
    if (!spend(def.cur, n === 10 ? def.cost10 : def.cost)) return;
    showSkillResult(Array.from({ length: n }, () => rollSkill(k)), `${def.name} ${n}회`); gwEvent('gacha', { kind: 'skill_' + k, n });
    return;
  }
  const g = e.target.closest('[data-gacha]');
  if (g) {
    const k = g.dataset.gacha, n = +g.dataset.n, def = GACHA[k];
    if (!spend(def.cur, n === 10 ? def.cost10 : def.cost)) return;
    const list = Array.from({ length: n }, () => rollCon(def.w, k));
    showGachaResult(list, `${def.name} ${n}회`); gwEvent('gacha', { kind: k, n });
    return;
  }
  const b = e.target.closest('[data-prod]'); if (!b) return;
  const p = SHOP.find(x => x.id === b.dataset.prod); if (p) buyProduct(p);
});


/* ---------- 행성 (Planets): list → detail ---------- */
let planetSel = null, planetView = 'list';
function renderPlanetList() {
  const owned = PLANETS.filter(p => save.planets[p.id]).length;
  $('pane-planets').innerHTML = `
    <div class="sec-h"><h2>행성</h2><span>보유 ${owned} / ${PLANETS.length} · 눌러서 상세 보기</span></div>
    <div class="planet-list">
      ${PLANETS.map(p => { const o = save.planets[p.id]; return `
        <button class="prow${o ? '' : ' locked'}" type="button" data-pid="${p.id}">
          <span class="orb" style="${orbStyle(p.id, o && PSKIN[o.skin] && PSKIN[o.skin].tint)}${o ? '' : ';filter:grayscale(.85) brightness(.55)'}"></span>
          <span class="pr-txt"><b>${p.name} ${o ? `<small>Lv ${o.lv}</small>` : ''}</b><span class="mini">${p.desc} · 궤도 ${p.orbits}개</span></span>
          ${save.mainPlanet === p.id ? '<em class="tag">대표</em>' : o ? '<em class="own">보유</em>' : `<em class="piece">${fmt(p.unlock)}</em>`}
        </button>`; }).join('')}
    </div>`;
}
function renderPlanets() {
  if (planetView === 'list' || !PLANET[planetSel]) { renderPlanetList(); return; }
  const d = PLANET[planetSel], own = save.planets[planetSel];
  const lv = own ? own.lv : 1;
  if (own) { own.skin = own.skin || 'basic'; own.orbitSkins = own.orbitSkins || []; }
  $('pane-planets').innerHTML = `
    <div class="detail-head"><button class="back" type="button" data-pact="list" aria-label="행성 목록으로">‹ 목록</button>
      <b>${d.name}</b><span>${d.en.toUpperCase()}</span></div>
    <section class="planet-hero">
      <span class="orb xl" style="${orbStyle(planetSel, own && PSKIN[own.skin] && PSKIN[own.skin].tint)}"></span>
      <div class="ph-txt">
        <span class="eyebrow">${d.en.toUpperCase()}</span>
        <h2>${d.name} ${own ? `<small>Lv ${lv}</small>` : ''}</h2>
        <p>${d.desc}</p>
        <dl class="stats">
          <div><dt>HP</dt><dd>${fmt(d.hp * planetHpMul(lv))}</dd></div>
          <div><dt>궤도</dt><dd>${d.orbits}개</dd></div>
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
    <section class="psk">
      <h3>스킨 <small>${own ? '눌러서 미리 보고 구매하거나 적용해요' : '행성을 해금하면 스킨을 적용할 수 있어요'}</small></h3>
      <div class="skin-line"><span class="lbl">행성 스킨</span><b>${own ? (PSKIN[own.skin] || PSKIN.basic).name : '-'}</b><button class="ghost sm" data-pact="pskin" type="button" ${own ? '' : 'disabled'}>변경</button></div>
      ${Array.from({ length: d.orbits }, (_, k) => `
      <div class="skin-line"><span class="lbl">${d.orbits === 1 ? '궤도 스킨' : `궤도 ${k + 1} 스킨`}</span><b>${own ? (OSKIN[own.orbitSkins[k]] || OSKIN.dash).name : '-'}</b><button class="ghost sm" data-pact="oskin" data-k="${k}" type="button" ${own ? '' : 'disabled'}>변경</button></div>`).join('')}
    </section>
    <section class="psk">
      <div class="psk-h"><h3>게이지 스킬 <small>전투에서 기력을 써서 발동해요</small></h3>
        <button class="ghost sm" data-pact="eskill" type="button" ${own ? '' : 'disabled'}>변경</button></div>
      ${planetSkills(planetSel).map((s, k) => skillRow(s, k ? `장착 ${k}` : '고유')).join('')}
      <p class="fine">고유 스킬은 행성마다 정해져 있고 스킨을 바꿔도 그대로예요. 장착 스킬은 상점 스킬 뽑기로 얻고, 어느 행성에나 장착할 수 있어요.</p>
    </section>`;
}
const skillChip = g => `<span class="gchip sg" style="--g:${SKILL_GRADES[g].col}">${g}</span>`;
const catChip = s => { const c = SKILL_CATS[(GSKILL[s.type] || GSKILL.meteor).cat]; return `<span class="cat" style="--c:${c.col}">${c.name}</span>`; };
function skillRow(s, label, btn = '') {
  if (!s) return `<div class="psk-row empty"><span class="sk-empty" aria-hidden="true">+</span>
    <div><b><span class="lbl">${label}</span> 비어 있음</b><p>상점 스킬 뽑기로 얻은 스킬을 장착할 수 있어요.</p></div>${btn}</div>`;
  return `<div class="psk-row"><img src="img/sk_${(GSKILL[s.type] || GSKILL.meteor).icon}.png" alt="" aria-hidden="true">
    <div><b><span class="lbl">${label}</span> ${skillChip(s.grade)} ${s.name}${s.lv ? ` <span class="lvt">Lv ${s.lv}</span>` : ''} ${catChip(s)} <span class="cs">기력 ${s.cost}</span></b><p>${skillDesc(s)}</p></div>${btn}</div>`;
}
// 장착 스킬 변경: every owned equip skill, the two equipped on top and the rest below.
// 장착 fills an empty slot; with both slots full it asks which one to replace. Changes save at once.
const GRADE_ORDER = ['MR', 'LR', 'UR', 'SSR', 'SR', 'R'], CAT_ORDER = ['atk', 'mag', 'buf', 'heal'];
const skCat = s => (GSKILL[s.type] || GSKILL.meteor).cat;
function openSkillEquip(pid) {
  let pick = null, cat = 'all'; // pick: unequipped skill waiting for a slot to replace; cat: list filter
  const body = () => {
    const cur = equipOf(pid), owned = save.skills.filter(id => ESKILL[id] && !cur.includes(id) && (cat === 'all' || skCat(ESKILL[id]) === cat))
      .sort((a, b) => GRADE_ORDER.indexOf(ESKILL[a].grade) - GRADE_ORDER.indexOf(ESKILL[b].grade) || CAT_ORDER.indexOf(skCat(ESKILL[a])) - CAT_ORDER.indexOf(skCat(ESKILL[b])));
    const info = d => `<div><b>${skillChip(d.grade)} ${d.name}${d.lv ? ` <span class="lvt">Lv ${d.lv}</span>` : ''} ${catChip(d)} <span class="cs">기력 ${d.cost}</span></b><span class="mini">${skillDesc(d)}</span></div>`;
    const slot = (id, k) => id
      ? `<div class="esk-item on"><span class="esk-k">장착 ${k + 1}</span>${info(skillOf(id))}
          <button class="${pick ? 'cta' : 'ghost'} sm" data-act="${pick ? 'swap' : 'off'}" data-k="${k}" type="button">${pick ? '교체' : '해제'}</button></div>`
      : `<div class="esk-item on empty"><span class="esk-k">장착 ${k + 1}</span><div><b>비어 있음</b><span class="mini">아래 목록에서 장착할 스킬을 골라요.</span></div></div>`;
    return `<h3>${PLANET[pid].name} · 장착 스킬</h3>
      <div class="skin-list esk-list">
        <span class="set-h">장착 중</span>${cur.map(slot).join('')}
        <span class="set-h">미장착 ${owned.length}</span>
        <div class="esk-cats">${[['all', '전체'], ...CAT_ORDER.map(k => [k, SKILL_CATS[k].name])].map(([k, n]) => `<button type="button" data-act="cat" data-cat="${k}" aria-pressed="${k === cat}">${n}</button>`).join('')}</div>
        ${owned.map(id => `<div class="esk-item${pick === id ? ' pick' : ''}">${info(skillOf(id))}
          <button class="${pick === id ? 'ghost' : 'cta'} sm" data-act="${pick === id ? 'unpick' : 'on'}" data-id="${id}" type="button">${pick === id ? '취소' : '장착'}</button></div>`).join('')
          || '<p class="mtxt">미장착 스킬이 없어요. 상점 스킬 뽑기로 더 얻을 수 있어요.</p>'}
      </div>
      ${pick ? `<p class="mtxt">${ESKILL[pick].name}(으)로 바꿀 장착 스킬의 <b>교체</b>를 눌러요.</p>` : ''}
      <div class="mbtns"><button class="cta sm" data-act="close" type="button">완료</button></div>`;
  };
  const set = e => { save.equip[pid] = e; persist(); if (tab === 'team') renderTeam(); else renderPlanets(); };
  const redraw = () => openModal(body(), onAct);
  function onAct(act, b) {
    const cur = equipOf(pid);
    if (act === 'close') { closeModal(); return; }
    if (act === 'off') { const e = [...cur]; e[+b.dataset.k] = null; set(e); }
    else if (act === 'on') {
      const k = cur.indexOf(null);
      if (k < 0) pick = b.dataset.id;
      else { const e = [...cur]; e[k] = b.dataset.id; set(e); }
    }
    else if (act === 'swap') { const e = [...cur]; e[+b.dataset.k] = pick; pick = null; set(e); }
    else if (act === 'unpick') pick = null;
    else if (act === 'cat') cat = b.dataset.cat;
    redraw();
  }
  redraw();
}
/* ---------- 스킬 (도감): every skill, owned first; filter by grade and category ---------- */
let skFilter = { g: 'all', c: 'all' };
const skIcon = s => `img/sk_${(GSKILL[s.type] || GSKILL.meteor).icon}.png`;
function renderSkills() {
  const where = id => PLANETS.filter(p => save.planets[p.id] && equipOf(p.id).includes(id)).map(p => p.name);
  const uniq = PLANETS.map(p => ({ key: 'u:' + p.id, s: { ...p.uskill, grade: 'UR' }, own: !!save.planets[p.id], sub: p.name }));
  const eq = Object.entries(ESKILL).map(([id, s]) => { const own = save.skills.includes(id); return { key: id, s: own ? skillOf(id) : s, own, sub: where(id).join(' · ') }; });
  const list = [...uniq, ...eq].filter(x => (skFilter.g === 'all' || x.s.grade === skFilter.g) && (skFilter.c === 'all' || skCat(x.s) === skFilter.c))
    .sort((a, b) => (b.own - a.own) || GRADE_ORDER.indexOf(a.s.grade) - GRADE_ORDER.indexOf(b.s.grade) || CAT_ORDER.indexOf(skCat(a.s)) - CAT_ORDER.indexOf(skCat(b.s)));
  const ownedN = eq.filter(x => x.own).length;
  const chips = (key, opts) => `<div class="skf">${opts.map(([v, n]) => `<button type="button" data-skf="${key}" data-v="${v}" aria-pressed="${skFilter[key] === v}">${n}</button>`).join('')}</div>`;
  $('pane-skills').innerHTML = `
    <div class="sec-h"><h2>스킬</h2><span>장착 스킬 보유 ${ownedN} / ${eq.length} · 고유 스킬 ${uniq.filter(x => x.own).length} / ${uniq.length}</span></div>
    ${chips('g', [['all', '전체 등급'], ['MR', 'MR'], ['LR', 'LR'], ['UR', 'UR 고유'], ['SSR', 'SSR'], ['SR', 'SR'], ['R', 'R']])}
    ${chips('c', [['all', '전체 분류'], ...CAT_ORDER.map(k => [k, SKILL_CATS[k].name])])}
    <div class="sk-grid">${list.map(x => `
      <button class="skc${x.own ? '' : ' locked'}" type="button" data-skd="${x.key}" style="--g:${SKILL_GRADES[x.s.grade].col}">
        ${x.sub && x.own && x.s.grade !== 'UR' ? '<em class="tm">장착</em>' : ''}
        <img src="${skIcon(x.s)}" alt="" aria-hidden="true"><b>${x.s.name}</b>
        <span>${skillChip(x.s.grade)} ${catChip(x.s)}</span>
        ${x.own && x.s.lv ? `<small class="lvp">Lv ${x.s.lv}${skNeed(x.key) ? ` · ${save.skillCopies[x.key] || 0}/${skNeed(x.key)}` : ' · MAX'}</small>` : ''}
      </button>`).join('') || '<p class="mtxt">조건에 맞는 스킬이 없어요.</p>'}</div>
    <button class="cta wide" data-skgo="store" type="button">상점에서 스킬 뽑기</button>
    <p class="fine">고유(UR) 스킬은 행성마다 정해져 있어 그 행성을 해금하면 쓸 수 있어요. 장착 스킬은 행성 화면의 게이지 스킬 [변경]에서 장착해요.</p>`;
}
// 레벨 정보: current level, copies toward the next one, and what the next level does
function lvInfo(id, own) {
  const lv = own ? skLv(id) : 1, max = skillMaxLv(), b = ESKILL[id];
  const next = lv < max ? skillAtLv(b, lv + 1) : null, pctUp = Math.round((skillLvMul(b.up, lv) - 1) * 100);
  return `<div class="lv-box"><b>Lv ${lv} / ${max}</b> <small>레벨당 +${b.up}% · 현재 +${pctUp}%</small>
    ${own && next ? `<div class="bar"><i style="width:${Math.min(100, (save.skillCopies[id] || 0) / skNeed(id) * 100)}%"></i></div>
      <small>같은 스킬 ${save.skillCopies[id] || 0} / ${skNeed(id)}개 모으면 Lv ${lv + 1}: ${skillDesc(next)}</small>`
      : own ? '<small>최고 레벨이에요. 더 뽑히면 미네랄로 바뀌어요.</small>' : `<small>뽑으면 Lv 1. 같은 스킬을 더 뽑으면 레벨이 올라요 (Lv 2까지 ${SKILL_LV[0].need}개).</small>`}</div>`;
}
$('pane-skills').addEventListener('click', e => {
  const f = e.target.closest('[data-skf]'); if (f) { skFilter[f.dataset.skf] = f.dataset.v; renderSkills(); return; }
  if (e.target.closest('[data-skgo]')) { storeTab = 'skill'; setTab('store'); return; }
  const d = e.target.closest('[data-skd]'); if (!d) return;
  const key = d.dataset.skd, isU = key.startsWith('u:'), pid = isU ? key.slice(2) : null;
  const own = isU ? !!save.planets[pid] : save.skills.includes(key), s = isU ? { ...PLANET[pid].uskill, grade: 'UR' } : own ? skillOf(key) : ESKILL[key];
  const on = isU ? [] : PLANETS.filter(p => save.planets[p.id] && equipOf(p.id).includes(key)).map(p => p.name);
  const status = isU ? `${PLANET[pid].name} 고유 스킬 · ${own ? '사용 가능' : '행성을 해금하면 사용 가능'}`
    : own ? (on.length ? `장착 중: ${on.join(', ')}` : '보유 · 장착 안 함') : '미보유 · 상점 스킬 뽑기에서 얻을 수 있어요';
  openModal(`<h3>${s.name}</h3><div class="sk-detail"><img src="${skIcon(s)}" alt="" aria-hidden="true">
      <span>${skillChip(s.grade)} ${SKILL_GRADES[s.grade].name} · ${catChip(s)} ${GSKILL[s.type].label} · 기력 ${s.cost}</span>
      <p class="mtxt">${skillDesc(s)}</p><p class="mtxt">${status}</p>${isU ? '' : lvInfo(key, own)}</div>
    <div class="mbtns"><button class="ghost" data-act="close" type="button">닫기</button>
      ${isU ? `<button class="cta sm" data-act="planet" type="button">행성 보기</button>`
        : own ? `<button class="cta sm" data-act="planet" type="button">대표 행성에 장착하기</button>` : `<button class="cta sm" data-act="store" type="button">상점으로</button>`}</div>`,
  act => {
    closeModal();
    if (act === 'store') { storeTab = 'skill'; setTab('store'); }
    else if (act === 'planet') { planetSel = pid || save.mainPlanet; planetView = 'detail'; setTab('planets'); if (!isU) openSkillEquip(planetSel); }
  });
});
$('pane-planets').addEventListener('click', e => {
  const c = e.target.closest('[data-pid]'); if (c) { planetSel = c.dataset.pid; planetView = 'detail'; renderPlanets(); $('pane-planets').closest('.panes').scrollTop = 0; return; }
  const a = e.target.closest('[data-pact]'); if (!a) return;
  const d = PLANET[planetSel], act = a.dataset.pact;
  if (act === 'list') { planetView = 'list'; renderPlanets(); return; }
  if (act === 'pskin') { openSkinList('p', 0, planetSel); return; }
  if (act === 'oskin') { openSkinList('o', +a.dataset.k, planetSel); return; }
  if (act === 'eskill') { openSkillEquip(planetSel); return; }
  if (act === 'unlock') { if (spend('piece', d.unlock)) { save.planets[planetSel] = { lv: 1, skin: 'basic', orbitSkins: [] }; persist(); toast(`${d.name} 해금`); renderPlanets(); } }
  else if (act === 'up') { const o = save.planets[planetSel]; if (spend('dust', planetUpCost(o.lv))) { o.lv += 1; persist(); toast(`${d.name} Lv ${o.lv}`); renderPlanets(); } }
  else if (act === 'main') {
    save.mainPlanet = planetSel;
    normalizeForm();
    persist(); toast(`대표 행성을 ${d.name}(으)로 바꿨어요`); renderPlanets(); enterHome(); setTab('planets');
  }
});

/* ---------- 별자리 (Stars) — 컨셉 이미지 23·24 ---------- */
let starSel = null, slotSel = null, skinSel = null, starView = 'list'; // 별자리 tab: list (3-column grid) → detail
// 별자리 목록: every constellation in a 3-column grid, owned first (by grade), then the ones still to find
function renderStarList() {
  const team = new Set(save.team);
  const list = [...ALL_CONS].sort((a, b) => (save.cons[b.id] ? save.cons[b.id].g + 1 : 0) - (save.cons[a.id] ? save.cons[a.id].g + 1 : 0));
  const owned = ALL_CONS.filter(c => save.cons[c.id]).length;
  $('pane-stars').innerHTML = `
    <div class="sec-h"><h2>별자리</h2><span>보유 ${owned} / ${ALL_CONS.length} · 눌러서 상세 보기</span></div>
    <div class="con-grid">${list.map(c => { const o = save.cons[c.id]; return `
      <button class="ccell${o ? '' : ' locked'}" type="button" data-sid="${c.id}"${o ? ` data-g="${o.g}"` : ''} style="--g:${o ? GRADES[o.g].col : '#3a4270'}">
        ${team.has(c.id) ? '<em class="tm">편성</em>' : ''}
        ${conSvg(c.id, 64, { dim: !o })}
        <b>${c.name}자리</b>
        ${o ? `${gradeChip(o.g)}<small>전투력 ${fmt(conPower(c.id))}</small>` : '<span class="gchip" style="--g:#59608a">미보유</span><small>&nbsp;</small>'}
      </button>`; }).join('')}</div>`;
}
// 도트 별자리 그래프: edges become rows of square dots, slots become pixel frames with a plus-shaped star core
function pxLine([x1, y1], [x2, y2]) {
  const n = Math.max(1, Math.round(Math.hypot(x2 - x1, y2 - y1) / 7));
  let out = '';
  for (let k = 1; k < n; k++) out += `<rect x="${Math.round(x1 + (x2 - x1) * k / n) - 1.5}" y="${Math.round(y1 + (y2 - y1) * k / n) - 1.5}" width="3" height="3"/>`;
  return out;
}
function pxSlot(x, y, r, col) {
  const st = col ? ` style="fill:${col}"` : '';
  return `<rect class="ring" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}"/>
      <rect class="core" x="${x - 6}" y="${y - 2}" width="12" height="4"${st}/><rect class="core" x="${x - 2}" y="${y - 6}" width="4" height="12"${st}/>`;
}
function renderStars() {
  if (starView === 'list') { renderStarList(); return; }
  const owned = ALL_CONS.filter(c => save.cons[c.id]);
  if (!starSel || !CON[starSel]) starSel = (owned[0] || ALL_CONS[0]).id;
  const d = CON[starSel], o = save.cons[starSel];
  if (slotSel == null || slotSel >= d.sh.pts.length) slotSel = d.sh.key;
  const b = conBonus(starSel), eq = SKIN[equippedSkin(starSel)];
  if (!skinSel || SKIN[skinSel].con !== starSel) skinSel = eq.id;
  const sw = 300, P = d.sh.pts.map(([x, y]) => [x * 120, y * 100]);
  const slotsSvg = P.map(([x, y], i) => {
    const t = slotType(d, i), s = o && o.slots[i], open = s && s.open, part = s && s.part;
    return `<g class="slot${i === slotSel ? ' sel' : ''}${open ? '' : ' closed'}" data-slot="${i}" style="--c:${SLOT[t].col}">
      <circle class="hit" cx="${x}" cy="${y}" r="22"/>
      ${pxSlot(x, y, i === d.sh.key ? 14 : 11, part ? GRADES[part.g].col : null)}
      ${part ? `<text x="${x + 13}" y="${y - 11}">+${part.en}</text>` : ''}
    </g>`;
  }).join('');
  $('pane-stars').innerHTML = `
    <div class="detail-head"><button class="back" type="button" data-sact="list" aria-label="별자리 목록으로">‹ 목록</button>
      <b>${d.name}자리</b><span>${d.en}</span>${o ? gradeChip(o.g) : '<span class="gchip" style="--g:#59608a">미보유</span>'}</div>
    <div class="role-row">${(r => `${roleChip(r)}<span class="mini">${r.desc} 타입${r.sub ? ` · ${r.sub} 피해를 줘요` : ''}</span>`)(conRole(starSel, eq))}</div>
    ${skinSection(starSel, o)}
    <section class="star-stage">
      <svg class="graph" style="--ln:rgb(${eq.pal.line})" viewBox="${-sw / 2} -125 ${sw} 250" role="img" aria-label="${d.name}자리 별 슬롯">
        <image class="art" href="img/con_${eq.id}.webp" x="-110" y="-110" width="220" height="220"/>
        <g class="ln">${d.sh.edges.map(([a, c]) => pxLine(P[a], P[c])).join('')}</g>
        ${slotsSvg}
      </svg>
      <div class="sname"><b>${eq.id === starSel ? d.name + '자리' : eq.name}</b> ${o ? gradeChip(o.g) : '<span class="gchip" style="--g:#59608a">미보유</span>'}</div>
    </section>
    <section class="slot-panel" id="slotPanel">${o ? slotPanel(d, o) : `
      <p class="mtxt">아직 없는 별자리예요. 상점 뽑기나 로비 상자에서 얻을 수 있어요.</p>
      <button class="cta sm" data-sact="store" type="button">상점으로</button>`}</section>
    <div class="statbar">
      <span title="공격력">⚔ ${(d.atk * b.atk).toFixed(1)}</span>
      <span title="HP">♥ ${fmt(d.hp * b.hp)}</span>
      <span title="공격속도">≫ ${(d.rate * b.rate).toFixed(2)}/s</span>
      <span class="pw">전투력 ${fmt(conPower(starSel))}</span>
    </div>
    <div class="legend"><i style="--c:${SLOT.act.col}"></i>액티브 · 공격력 <i style="--c:${SLOT.pas.col}"></i>패시브 · HP <i style="--c:${SLOT.lim.col}"></i>한정 · 공격속도</div>
    <div class="detail">${perkList(eq)}</div>`;
}
function skinSection(id, o) {
  const list = SKINS[id], eq = equippedSkin(id);
  return `<section class="skins">
    <div class="sec-h"><h2>스킨</h2><span>눌러서 미리보기 · 스킨마다 공격 방식과 스킬셋이 달라요</span></div>
    <div class="skin-row">${list.map(sk => `
      <button class="skin-card tier-${sk.tier}" type="button" data-skin="${sk.id}" aria-pressed="${sk.id === eq}" style="--ln:rgb(${sk.pal.line})">
        ${conSvg(id, 54, { skin: sk.id, dim: !ownsSkin(id, sk.id) })}
        <b>${sk.name}</b><span class="mini">${SKIN_TIER[sk.tier].name} · ${skinStyle(sk)}</span>
        ${sk.id === eq && o ? '<em class="eq">장착</em>' : ownsSkin(id, sk.id) ? '<em class="own">보유</em>' : sk.tier === 'classic' ? '<em>미보유</em>' : SKIN_TIER[sk.tier].src === 'chest' ? '<em>상자</em>' : `<em class="piece">${fmt(SKIN_TIER[sk.tier].price)}</em>`}
      </button>`).join('')}</div>
  </section>`;
}
function perkList(sk) {
  const mods = sk.mod ? Object.entries(sk.mod).map(([k, v]) => `${{ atk:'공격력', rate:'공격속도', hp:'HP' }[k]} ${v >= 1 ? '+' : ''}${Math.round((v - 1) * 100)}%`).join(' · ') : '';
  return `<h3>${sk.name} <small>${SKIN_TIER[sk.tier].name} 스킨 · ${skinStyle(sk)}</small></h3>
    <div class="sig">${sk.sig}${mods ? ` <b class="mods">${mods}</b>` : ''} 아케이드 레벨업 때 아래 능력이 카드로 나와요.</div>
    <ul class="chain">
      ${sk.stats.map(([k, n]) => `<li><span class="tier stat">×3</span><div><b>${n}</b><span>${STAT[k].txt(STAT[k].v)} 최대 3번까지 중첩돼요.</span></div></li>`).join('')}
      ${sk.chain.map((ch, i) => `<li><span class="tier">${ROMAN[i + 1]}</span><div><b>각성 ${ROMAN[i + 1]} · ${ch.name}</b><span>${ch.desc}</span></div></li>`).join('')}
    </ul>`;
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
  const c = e.target.closest('[data-sid]'); if (c) { starSel = c.dataset.sid; slotSel = null; skinSel = null; starView = 'detail'; renderStars(); $('pane-stars').closest('.panes').scrollTop = 0; return; }
  const sl = e.target.closest('[data-slot]'); if (sl) { slotSel = +sl.dataset.slot; renderStars(); return; }
  const sk = e.target.closest('[data-skin]'); if (sk) { openSkinPopup('c', sk.dataset.skin); return; }
  const a = e.target.closest('[data-sact]'); if (!a) return;
  const act = a.dataset.sact;
  if (act === 'store') { storeTab = 'con'; setTab('store'); return; }
  if (act === 'list') { starView = 'list'; renderStars(); return; }
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

/* ---------- 스킨 팝업: live preview + stats + buy / equip / cancel ---------- */
let PREVIEW = null; // { canvas, sys } while a skin popup is open
function skinBonusText(kind, b) {
  const who = { p: { hp: '행성 HP', atk: '모든 별자리 공격력', dmgRed: '행성이 받는 피해' }, o: { hp: '이 궤도 별자리 HP', atk: '이 궤도 별자리 공격력', rate: '이 궤도 별자리 공격속도' } }[kind];
  const out = Object.entries(b).map(([k, v]) => `<li>${who[k]} <b>${k === 'dmgRed' ? '-' : '+'}${Math.round(v * 100)}%</b></li>`);
  return out.length ? `<ul class="sk-stats">${out.join('')}</ul>` : '<p class="mtxt">추가 능력치가 없는 기본 스킨이에요.</p>';
}
// 행성 / 궤도 스킨 목록: owned first, then not owned; the preview follows the selection.
// kind 'p' = planet skin, 'o' = orbit skin for orbit k
// k === 'all': one orbit skin for every orbit of the planet. next: popup to chain after this one (팀 화면 행성 변경 흐름)
function openSkinList(kind, k, pid = save.mainPlanet, next = null) {
  const ps = save.planets[pid], isP = kind === 'p', all = k === 'all';
  if (all) k = 0;
  ps.skin = ps.skin || 'basic'; ps.orbitSkins = ps.orbitSkins || [];
  const LIST = isP ? PLANET_SKINS : ORBIT_SKINS, MAP = isP ? PSKIN : OSKIN, ownKey = isP ? 'pSkins' : 'oSkins';
  const cur = isP ? (PSKIN[ps.skin] ? ps.skin : 'basic') : (OSKIN[ps.orbitSkins[k]] ? ps.orbitSkins[k] : 'dash');
  const ov = id => isP ? { pid, pskin: id } : { pid, oskin: all ? { 0: id, 1: id } : { [k]: id } };
  const owned = LIST.filter(s => save[ownKey].includes(s.id)), locked = LIST.filter(s => !save[ownKey].includes(s.id));
  let sel = cur;
  const item = s => `<button class="skin-item" type="button" role="radio" data-os="${s.id}" aria-checked="${s.id === sel}">
      <b>${s.name}</b><span class="mini">${Object.keys(s.bonus).length ? bonusLines(s.bonus, '').map(x => x.trim()).join(' · ') : '능력치 없음'}</span>
      ${s.id === cur ? '<em class="eq">장착</em>' : save[ownKey].includes(s.id) ? '<em class="own">보유</em>' : `<em class="piece">${fmt(s.price)}</em>`}
    </button>`;
  const info = () => {
    const d = MAP[sel], own = save[ownKey].includes(sel);
    const btn = sel === cur ? '<button class="cta sm" type="button" disabled>장착 중</button>'
      : own ? '<button class="cta sm" data-act="equip" type="button">장착</button>'
      : `<button class="cta sm" data-act="buy" type="button">구매 <b class="piece">${fmt(d.price)}</b></button>`;
    return `<p class="mtxt">${d.flavor}</p>${skinBonusText(kind, d.bonus)}
      <div class="mbtns"><button class="ghost" data-act="close" type="button">${next ? '다음' : '취소'}</button>${btn}</div>`;
  };
  const title = isP ? '행성 스킨' : all || PLANET[pid].orbits === 1 ? '궤도 스킨' : `궤도 ${k + 1} 스킨`;
  openModal(`
    <div class="sk-preview"><canvas id="pvCv" aria-label="${title} 미리보기"></canvas><span class="sk-badge">미리보기</span></div>
    <h3>${title}</h3>
    <div class="skin-list" role="radiogroup" aria-label="${title}">
      ${owned.length ? `<span class="set-h">보유</span>${owned.map(item).join('')}` : ''}
      ${locked.length ? `<span class="set-h">미보유</span>${locked.map(item).join('')}` : ''}
    </div>
    <div id="osInfo">${info()}</div>`,
  act => {
    if (act === 'close') { closeModal(); if (next) next(); return; }
    if (act === 'buy') { if (!spend('piece', MAP[sel].price)) return; save[ownKey].push(sel); }
    if (act === 'buy' || act === 'equip') {
      if (isP) ps.skin = sel; else if (all) ps.orbitSkins = [sel, sel]; else ps.orbitSkins[k] = sel;
      persist(); closeModal();
      toast(`${MAP[sel].name} 스킨을 ${act === 'buy' ? '구매하고 ' : ''}장착했어요`);
      if (tab === 'planets') renderPlanets(); else renderTeam();
      if (pid === save.mainPlanet) enterHomeSystemOnly();
      if (next) next();
    }
  });
  $('modalBody').querySelector('.skin-list').addEventListener('click', e => {
    const b = e.target.closest('[data-os]'); if (!b) return;
    sel = b.dataset.os;
    $('modalBody').querySelectorAll('[data-os]').forEach(x => x.setAttribute('aria-checked', x === b));
    $('osInfo').innerHTML = info();
    PREVIEW.sys = buildMySystem(ov(sel));
  });
  PREVIEW = { canvas: $('pvCv'), sys: buildMySystem(ov(cur)) };
}
function openSkinPopup(kind, id, k) {
  const pid = save.mainPlanet, ps = save.planets[pid];
  let name, tag, body, owned, equipped, price = 0, lock = '', ov;
  if (kind === 'c') {
    const sk = SKIN[id], con = sk.con, have = !!save.cons[con], src = SKIN_TIER[sk.tier].src;
    name = sk.name; tag = `${CON[con].name}자리 · ${SKIN_TIER[sk.tier].name} 스킨`;
    body = `<div class="detail">${perkList(sk)}</div>`;
    owned = ownsSkin(con, id); equipped = have && equippedSkin(con) === id; price = SKIN_TIER[sk.tier].price;
    if (!have && sk.tier === 'classic') lock = '별자리를 얻으면 기본 스킨으로 함께 받아요.';
    else if (!owned && src === 'chest') lock = `로비 보물 상자에서 ${Math.round(CHEST_ODDS.skin * 100)}% 확률로 얻을 수 있어요.`;
    else if (!have) lock = owned ? '보유 중이에요. 별자리를 얻으면 장착할 수 있어요.' : '별자리를 먼저 얻어야 구매할 수 있어요.';
    ov = { onlyCon: con, conSkin: id };
  } else {
    const def = kind === 'p' ? PSKIN[id] : OSKIN[id];
    name = def.name; tag = kind === 'p' ? '행성 스킨 · 모든 행성에 사용' : `궤도 스킨 · ${PLANET[pid].orbits === 1 ? '단일 궤도' : `궤도 ${k + 1}`}에 적용`;
    body = `<p class="mtxt">${def.flavor}</p>${skinBonusText(kind, def.bonus)}`;
    owned = (kind === 'p' ? save.pSkins : save.oSkins).includes(id);
    equipped = kind === 'p' ? ps.skin === id : (ps.orbitSkins[k] || 'dash') === id;
    price = def.price;
    ov = kind === 'p' ? { pskin: id } : { oskin: { [k]: id } };
  }
  const btns = equipped ? '<button class="ghost" data-act="close" type="button">닫기</button><button class="cta sm" type="button" disabled>장착 중</button>'
    : lock ? '<button class="ghost" data-act="close" type="button">닫기</button>'
    : owned ? '<button class="ghost" data-act="close" type="button">취소</button><button class="cta sm" data-act="equip" type="button">장착</button>'
    : `<button class="ghost" data-act="close" type="button">취소</button><button class="cta sm" data-act="buy" type="button">구매 <b class="piece">${fmt(price)}</b></button>`;
  openModal(`
    <div class="sk-preview"><canvas id="pvCv" aria-label="${name} 미리보기"></canvas><span class="sk-badge">미리보기</span></div>
    <div class="sk-head"><h3>${name}</h3><span class="mini">${tag}</span></div>
    ${body}
    ${lock ? `<p class="ad-note">${lock}</p>` : ''}
    <div class="mbtns">${btns}</div>`,
  act => {
    if (act === 'close') { closeModal(); return; }
    if (act === 'buy') {
      if (!spend('piece', price)) return;
      if (kind === 'c') addSkin(id); else save[kind === 'p' ? 'pSkins' : 'oSkins'].push(id);
      gwEvent('skin_buy', { kind, id });
    }
    if (kind === 'c') save.cons[SKIN[id].con].skin = id;
    else if (kind === 'p') ps.skin = id; else ps.orbitSkins[k] = id;
    persist(); closeModal(); toast(`${name} 스킨을 ${act === 'buy' ? '구매하고 ' : ''}장착했어요`);
    enterHomeSystemOnly(); if (tab === 'team') renderTeam(); else if (tab === 'stars') renderStars();
  });
  PREVIEW = { canvas: $('pvCv'), sys: buildMySystem(ov) };
}

/* ---------- 팀 (Team formation): planet → orbits → constellations ---------- */
const statChips = o => [o.atk && `공격력 +${Math.round(o.atk * 100)}%`, o.rate && `공격속도 +${Math.round(o.rate * 100)}%`, o.hp && `HP +${Math.round(o.hp * 100)}%`].filter(Boolean).map(x => `<span class="schip">${x}</span>`).join('');
let TEAM_PV = null; // live, rotating view of the main planet with its current skins and team
function renderTeam() {
  normalizeForm();
  const pid = save.mainPlanet, pd = PLANET[pid], ps = save.planets[pid], n = pd.orbits, cap = teamCap(pid);
  $('pane-team').innerHTML = `
    <section class="team-planet">
      <div class="sk-preview tp-pv"><canvas id="teamPv" aria-label="${pd.name} 미리보기"></canvas></div>
      <div class="tp-head">
        <b>${pd.name} (${(PSKIN[ps.skin] || PSKIN.basic).name}) <small>Lv ${ps.lv}</small></b>
        <span class="schip">HP ${fmt(pd.hp * planetHpMul(ps.lv))}</span><span class="schip">궤도 ${n}개 · ${(OSKIN[ps.orbitSkins[0]] || OSKIN.dash).name}</span>${pd.desc !== 'HP가 높은 기본 행성' ? `<span class="schip">${pd.desc}</span>` : ''}
      </div>
      <div class="tp-btns">
        <button class="ghost sm" data-tact="planet" type="button">행성 변경</button>
        <button class="ghost sm" data-pskin type="button">행성 스킨</button>
        <button class="ghost sm" data-oskin type="button">궤도 스킨</button>
      </div>
      <div class="team-sk">
        ${planetSkills(pid).map((s, k) => (k === 1 ? '<hr class="sk-div">' : '') + (k ? skillRow(s, `장착 ${k}`, `<button class="ghost sm" data-teq="${k - 1}" type="button">${s ? '변경' : '장착'}</button>`) : skillRow(s, '고유'))).join('')}
      </div>
    </section>
    ${Array.from({ length: n }, (_, k) => { const os = orbitStats(pid, k), a = save.form[k]; return `
    <section class="orbit-card">
      <div class="oc-head"><b>${n === 1 ? os.name : `궤도 ${k + 1} · ${os.name}`}</b><span class="schips">${statChips(os)}</span></div>
      <div class="oslots">
        ${Array.from({ length: ORBIT_CAP }, (_, j) => a[j] ? `
          <button class="oslot" type="button" data-slot="${k}:${j}" aria-label="${CON[a[j]].name}자리 변경">${conSvg(a[j], 44)}<b>${SKIN[equippedSkin(a[j])].name}</b><span class="x">변경</span></button>`
          : `<button class="oslot empty" type="button" data-slot="${k}:${j}"><span>+</span><span class="mini">빈 자리</span></button>`).join('')}
      </div>
    </section>`; }).join('')}
    <p class="fine">별자리 <b>${save.team.length} / ${cap}</b> · 최소 ${TEAM_MIN}개 · 궤도마다 최대 ${ORBIT_CAP}개 · 칸을 눌러 별자리를 등록하거나 바꿔요${n === 1 ? ' · 궤도가 1개인 행성은 궤도 능력치가 더 높아요' : ''}</p>`;
  TEAM_PV = { canvas: $('teamPv'), sys: buildMySystem() };
}
$('pane-team').addEventListener('click', e => {
  const pid = save.mainPlanet, ps = save.planets[pid];
  if (e.target.closest('[data-tact="planet"]')) { pickPlanetPopup(); return; }
  if (e.target.closest('[data-oskin]')) { openSkinList('o', 'all'); return; }
  if (e.target.closest('[data-pskin]')) { openSkinList('p'); return; }
  if (e.target.closest('[data-teq]')) { openSkillEquip(pid); return; }
  const sl = e.target.closest('[data-slot]'); if (!sl) return;
  const [k, j] = sl.dataset.slot.split(':').map(Number), cur = save.form[k][j];
  if (cur) confirmBox('별자리 변경', `${CON[cur].name}자리를 변경하시겠습니까?`, '변경', () => pickConPopup(k, j));
  else pickConPopup(k, j);
});
// 행성 변경: owned planets → 행성 스킨 → 궤도 스킨, one popup after another
function pickPlanetPopup() {
  let sel = save.mainPlanet;
  const owned = PLANETS.filter(p => save.planets[p.id]);
  openModal(`
    <h3>행성 변경</h3>
    <div class="skin-list" role="radiogroup" aria-label="행성 선택">
      ${owned.map(p => { const o = save.planets[p.id]; return `
        <button class="skin-item pp-item" type="button" role="radio" data-pp="${p.id}" aria-checked="${p.id === sel}">
          <span class="orb" style="${orbStyle(p.id, PSKIN[o.skin] && PSKIN[o.skin].tint)}"></span>
          <span><b>${p.name} <small>Lv ${o.lv}</small></b><span class="mini">${p.desc} · 궤도 ${p.orbits}개</span></span>
          ${p.id === save.mainPlanet ? '<em class="eq">현재</em>' : ''}
        </button>`; }).join('')}
    </div>
    <div class="mbtns"><button class="ghost" data-act="close" type="button">취소</button><button class="cta sm" data-act="ok" type="button">다음</button></div>`,
  act => {
    if (act === 'close') { closeModal(); return; }
    if (act !== 'ok') return;
    closeModal();
    if (sel !== save.mainPlanet) {
      save.mainPlanet = sel; normalizeForm(); persist(); enterHomeSystemOnly(); renderTeam();
      toast(`대표 행성을 ${PLANET[sel].name}(으)로 바꿨어요`);
    }
    openSkinList('p', 0, sel, () => openSkinList('o', 'all', sel));
  });
  $('modalBody').querySelector('.skin-list').addEventListener('click', e => {
    const b = e.target.closest('[data-pp]'); if (!b) return;
    sel = b.dataset.pp;
    $('modalBody').querySelectorAll('[data-pp]').forEach(x => x.setAttribute('aria-checked', x === b));
  });
}
// 별자리 선택 팝업: 해제 + owned constellations, confirm to register into orbit k, slot j
function pickConPopup(k, j) {
  const pid = save.mainPlanet, n = PLANET[pid].orbits, cur = save.form[k][j] || null;
  let sel = cur;
  const where = id => save.form.findIndex(a => a.includes(id));
  const owned = ALL_CONS.filter(c => save.cons[c.id]);
  openModal(`
    <h3>${n === 1 ? '' : `궤도 ${k + 1} · `}별자리 선택</h3>
    <div class="pick-grid" role="radiogroup" aria-label="별자리 선택">
      <button class="con-pick none" type="button" role="radio" data-pick="" aria-checked="${sel == null}"><span class="none-ic">∅</span><b>해제</b></button>
      ${owned.map(c => { const w = where(c.id); return `
        <button class="con-pick${c.special ? ' special' : ''}" type="button" role="radio" data-pick="${c.id}" aria-checked="${sel === c.id}">
          ${conSvg(c.id, 46)}<b>${SKIN[equippedSkin(c.id)].name}</b>${w >= 0 ? `<em>${c.id === cur ? '현재' : n === 1 ? '편성 중' : `궤도 ${w + 1}`}</em>` : ''}</button>`; }).join('')}
    </div>
    <p class="ad-note">다른 칸에 있는 별자리를 고르면 이 칸으로 옮겨져요.</p>
    <div class="mbtns"><button class="ghost" data-act="close" type="button">취소</button><button class="cta sm" data-act="ok" type="button">확인</button></div>`,
  (act, el) => {
    if (act === 'close') { closeModal(); return; }
    if (act !== 'ok') return;
    if (sel === cur) { closeModal(); return; }
    const inTeam = sel && save.team.includes(sel);
    if (sel == null && save.team.length <= TEAM_MIN) { toast(`별자리는 최소 ${TEAM_MIN}개 편성해야 해요`); return; }
    if (sel && !inTeam && !cur && save.team.length >= teamCap(pid)) { toast(`별자리는 최대 ${teamCap(pid)}개까지 편성할 수 있어요`); return; }
    const f = save.form.map(a => a.filter(x => x !== sel)); // lift the pick out of any other slot
    const row = f[k], at = cur ? row.indexOf(cur) : -1;
    if (sel == null) row.splice(at, 1);
    else if (at >= 0) row[at] = sel;
    else row.push(sel);
    save.form = f; persist(); closeModal(); renderTeam(); enterHomeSystemOnly();
    toast(sel ? `${CON[sel].name}자리를 등록했어요` : '별자리를 해제했어요');
  });
  $('modalBody').querySelector('.pick-grid').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    sel = b.dataset.pick || null;
    $('modalBody').querySelectorAll('[data-pick]').forEach(x => x.setAttribute('aria-checked', x === b));
  });
}
function enterHomeSystemOnly() { // refresh the orbiting lobby system after formation or skin changes
  HOME.sys = buildMySystem(); layoutHome();
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
      <div id="acctRows">${accountRows()}</div>
    </div>
    <div class="set-group"><span class="set-h">서비스 이용</span>
      <div class="links">
        <button type="button" data-act="soon">플레이 방법</button><button type="button" data-act="restore">구매 복원</button>
        <button type="button" data-act="soon">리뷰 남기기</button><button type="button" data-act="mail">문의하기</button>
        <button type="button" data-act="terms">이용약관</button><button type="button" data-act="privacy">개인정보 처리방침</button>
        <button type="button" data-act="notices">공지사항</button><button type="button" data-act="coupon">쿠폰 입력</button>
        <button type="button" data-act="probability">확률 정보</button><button type="button" data-act="reset" class="danger">서비스 탈퇴</button>
        <button type="button" data-act="admin">밸런스 관리자</button>
      </div>
    </div>
    <div class="mbtns"><button class="cta sm" data-act="close" type="button">닫기</button></div>`,
  (act, el) => {
    if (act === 'close') closeModal();
    else if (act === 'soon') toast('정식 버전에서 열려요');
    else if (act === 'admin') { closeModal(); window.open(`https://${FIREBASE_CONFIG.projectId}.web.app/admin/`, '_blank', 'noopener'); }
    else if (act === 'restore') toast('복원할 구매 내역이 없어요');
    else if (act === 'mail') { if (window.LIVE) LIVE.contact(); else toast('서버에 연결되면 문의처를 볼 수 있어요'); }
    else if (act === 'probability') showProbability();
    else if (['terms', 'privacy', 'notices', 'coupon'].includes(act)) {
      if (window.LIVE) LIVE.open(act); else toast('서버에 연결되면 볼 수 있어요');
    }
    else if (act === 'rename') {
      openModal(`<h3>닉네임 변경</h3><form id="renameForm" class="rename"><input id="renameInput" maxlength="12" value="${save.name}" aria-label="닉네임"><button class="cta sm" type="submit">저장</button></form>`);
      $('renameForm').onsubmit = ev => { ev.preventDefault(); const v = $('renameInput').value.trim(); if (v) { save.name = v; persist(); renderTopBar(); } closeModal(); };
    }
    else if (act === 'link') { closeModal(); window.CLOUD && CLOUD.linkGoogle(); }
    else if (act === 'signout') confirmBox('로그아웃', '진행은 Google 계정에 저장돼 있어요. 이 기기는 새 게스트로 처음부터 시작해요.', '로그아웃', async () => {
      await CLOUD.signOut(); toast('로그아웃했어요');
    });
    else if (act === 'reset') confirmBox('서비스 탈퇴', '이 기기와 서버에 저장된 진행 데이터를 모두 지우고 처음부터 시작해요. 되돌릴 수 없어요.', '모두 지우기', async () => {
      if (window.CLOUD) await CLOUD.deleteData();
      window.gwResetLocal();
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
  if (arcade) { dust = arcadeDust(); chest = G.wave >= 5 ? 3 : 1; xp = ACCOUNT.arcadeXp * G.wave; save.best = Math.max(save.best, G.wave); }
  else { dust = win ? 600 : 180; chest = win ? 3 : 1; xp = win ? ACCOUNT.winXp : ACCOUNT.loseXp; win ? save.wins++ : save.losses++; }
  save.dust += dust; save.chest = Math.min(CHEST_MAX, save.chest + chest);
  const up = gainAccXp(xp);
  persist();
  gwEvent(arcade ? 'arcade_end' : 'battle_end', arcade ? { wave: G.wave } : { win: !!win });
  $('resEyebrow').textContent = arcade ? 'PLANET DESTROYED' : win ? 'VICTORY' : 'DEFEAT';
  $('resEyebrow').style.color = !arcade && win ? 'var(--gold)' : 'var(--act)';
  $('resWave').textContent = arcade ? `WAVE ${G.wave}` : win ? '승리' : '패배';
  $('resTxt').textContent = arcade
    ? `${G.me.planet.name} 행성계가 ${G.zone.name} ${G.wave}웨이브에서 무너졌어요. 전투 Lv ${G.lv}까지 성장했어요. 최고 기록 WAVE ${save.best}.`
    : `${G.ghost.name}의 ${G.ghost.planet} 행성계와 싸웠어요. 전적 ${save.wins}승 ${save.losses}패.`;
  $('resRewards').innerHTML = [`<span class="dust">+${fmt(dust)}</span>`, `<span>상자 게이지 +${chest}</span>`, `<span>계정 경험치 +${xp}</span>`,
    up.up ? `<span class="lvup-tag">계정 Lv ${save.lv} 달성 · 에너지 가득 · 미네랄 +${fmt(up.dust)} · 별모래 +${fmt(up.piece)}</span>` : ''].join('');
  $('resPerks').innerHTML = arcade ? G.taken.map(t => `<span>${t}</span>`).join('') : '';
  $('retryBtn').textContent = arcade ? '다시 출항' : '다른 상대와 대전';
  $('hudTop').hidden = true; $('hudBot').hidden = true; $('lvup').hidden = true; $('resultScr').hidden = false;
}
$('retryBtn').addEventListener('click', () => { if (tryStart(G.mode)) $('resultScr').hidden = true; });
$('lobbyBtn').addEventListener('click', () => { $('resultScr').hidden = true; enterHome(); });

/* ---------- Pause menu ---------- */
// 일시정지: the skills picked up this run (one orb per stat card / awakening, with its level),
// a damage-by-constellation view (top-right button), 미네랄 earned so far, and sound · resume · home.
const arcadeDust = () => 120 * G.wave + 20 * G.kills;
function pauseSkills() {
  const out = [];
  for (const id of new Set(G.me.cons.map(c => c.def.id))) {
    const c = G.me.cons.find(x => x.def.id === id), img = `img/con_${c.skin.id}.webp`;
    for (const [k, name] of c.skin.stats) if (c.stacks[k]) out.push({ img, name, sub: `Lv${c.stacks[k]} · ${c.skin.name}` });
    if (c.chain) out.push({ img, name: c.skin.chain[c.chain - 1].name, sub: `각성 ${ROMAN[c.chain]} · ${c.skin.name}`, cls: 'chain' });
  }
  const fix = G.taken.filter(t => t === '행성 수리').length;
  if (fix) out.push({ img: pxPlanetUrl(save.mainPlanet), name: '행성 수리', sub: `×${fix} · ${G.me.planet.name}`, cls: 'repair', pl: true });
  return out;
}
function renderPause() {
  const pvp = G.mode === 'pvp', stats = $('pauseStats').getAttribute('aria-selected') === 'true';
  $('pauseTabSkills').setAttribute('aria-selected', String(!stats));
  $('pauseSkills').hidden = stats; $('pauseStatsList').hidden = !stats;
  const list = pauseSkills();
  $('pauseSkills').innerHTML = pvp ? '<p class="pm-empty">대전은 모든 능력치와 각성이 최대로 시작해요</p>'
    : list.length ? list.map(o => `<div class="pm-skill ${o.cls || ''}"><span class="pm-orb"><img ${o.pl ? 'class="pl" ' : ''}src="${o.img}" alt="" aria-hidden="true"></span><b>${o.name}</b><small>${o.sub}</small></div>`).join('')
    : '<p class="pm-empty">아직 습득한 스킬이 없어요.<br>적을 부숴 레벨업하면 새 스킬을 골라요.</p>';
  const by = G.dmgBy || {}, rows = Object.entries(by).sort((a, b) => b[1] - a[1]), top = rows.length ? rows[0][1] : 1;
  $('pauseStatsList').innerHTML = rows.length ? rows.map(([id, v]) => {
    const c = G.me.cons.find(x => x.def.id === id);
    const img = c ? `img/con_${c.skin.id}.webp` : 'img/sk_meteor.png', name = c ? c.skin.name : '게이지 스킬 · 기타';
    return `<div class="pm-row"><img src="${img}" alt="" aria-hidden="true"><span><span class="top"><b>${name}</b><em>${fmt(Math.round(v))}</em></span><span class="bar"><i style="width:${(v / top * 100).toFixed(1)}%"></i></span></span></div>`;
  }).join('') : '<p class="pm-empty">아직 입힌 피해가 없어요</p>';
  $('pauseCoin').hidden = pvp;
  $('pauseDust').textContent = fmt(arcadeDust());
}
// 재시작 and 나가기 both end the run, so each needs a second tap within 2.5 s
let armed = null, armedAt = 0;
function disarm() { armed = null; $('quitWarn').hidden = true; ['restartBtn', 'quitBtn'].forEach(id => $(id).classList.remove('armed')); }
function confirmTap(id, msg) {
  if (armed === id && performance.now() - armedAt < 2500) { disarm(); return true; }
  disarm(); armed = id; armedAt = performance.now(); $(id).classList.add('armed');
  $('quitWarn').textContent = msg; $('quitWarn').hidden = false;
  return false;
}
function setPaused(p) {
  G.paused = p; $('pauseMenu').hidden = !p;
  disarm();
  if (p) { $('pauseStats').setAttribute('aria-selected', 'false'); renderPause(); }
}
$('pauseBtn').addEventListener('click', () => setPaused(true));
$('resumeBtn').addEventListener('click', () => setPaused(false));
$('pauseTabSkills').addEventListener('click', () => { $('pauseStats').setAttribute('aria-selected', 'false'); renderPause(); });
$('pauseStats').addEventListener('click', () => { $('pauseStats').setAttribute('aria-selected', 'true'); renderPause(); });
$('restartBtn').addEventListener('click', () => {
  if (!confirmTap('restartBtn', `한 번 더 누르면 처음부터 다시 시작해요 (보상 없음 · 에너지 ${STAMINA.cost} 소모)`)) return;
  if (!(G.state === 'fight' || G.state === 'clear' || G.state === 'intro')) return;
  if (!useStamina(G.mode)) return;
  setPaused(false); startRun(G.mode);
});
$('quitBtn').addEventListener('click', () => {
  if (!confirmTap('quitBtn', '한 번 더 누르면 전투를 끝내고 결과를 봐요')) return;
  setPaused(false);
  if (G.state === 'fight' || G.state === 'clear' || G.state === 'intro') { G.state = 'over'; finishBattle(false); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && (G.state === 'fight' || G.state === 'intro') && !G.choosing) setPaused(true); });

/* ---------- Loop ---------- */
let last = performance.now(), lastDraw = 0, incT = 0;
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const fps = save.settings.fps;
  if (fps < 60 && now - lastDraw < 1000 / fps - 2) { requestAnimationFrame(frame); return; }
  const ddt = Math.min(.05, (now - (lastDraw || now)) / 1000) || dt; lastDraw = now;
  if (PREVIEW) { if ($('modal').hidden) PREVIEW = null; else drawPreview(PREVIEW.canvas, PREVIEW.sys, now / 1000, ddt); }
  if (TEAM_PV && tab === 'team' && !$('shell').hidden && TEAM_PV.canvas.isConnected) drawPreview(TEAM_PV.canvas, TEAM_PV.sys, now / 1000, ddt);
  if (G.state === 'home') {
    updateHome(ddt); drawHome(now / 1000);
    incT += ddt; if (incT > 1) { incT = 0; if (tab === 'home') renderHome(); else renderEnergy(); }
  } else if (G.state === 'title') { drawBg(now / 1000); }
  else {
    if (!G.paused && !G.choosing) update(ddt);
    draw(now / 1000); hud();
  }
  requestAnimationFrame(frame);
}

// A newer balance release arrived after the first render: redraw the home tab with the new numbers
onBalance(() => { if (G.state === 'home' && !$('shell').hidden) setTab(tab); });

window.__gw = G; window.__save = () => save; // test handles
resize();
showTitle();
requestAnimationFrame(frame);
