'use strict';
/* ---------- 로비 쪽 업데이트: 출항 준비 (모드 선택) · 연구소 · 업적 · 도감 · 7일 출석 · 시즌 패스 ·
   보관 자원 광고 2배 · 결과 화면 · 기록 (save.st / save.dex / save.lab / save.att / save.sp / save.chapters / save.daily / save.raid).
   숫자는 data.js. Loaded after app.js. */
const DAYMS = 86400000;
function metaSave() { // fills in what older saves don't have
  const s = save;
  for (const k of ['st', 'dex', 'lab', 'chapters', 'achGot']) if (!s[k] || typeof s[k] !== 'object') s[k] = {};
  if (!s.att || typeof s.att !== 'object') s.att = { n: 0, last: '' };
  if (!s.daily || typeof s.daily !== 'object') s.daily = { day: '', best: 0 };
  if (!s.raid || typeof s.raid !== 'object') s.raid = { w: -1, best: 0, got: 0 };
  if (s.raid.w !== weekNo()) s.raid = { w: weekNo(), best: 0, got: 0 };
  const si = seasonNo();
  if (!s.sp || typeof s.sp !== 'object' || s.sp.s !== si) s.sp = { s: si, pts: 0, f: [], p: [] };
  return s;
}
const stat = k => (k === 'best' ? save.best | 0 : k === 'chapters' ? Object.keys(metaSave().chapters).length
  : k === 'stars' ? Object.values(metaSave().chapters).reduce((a, x) => a + x, 0) : (metaSave().st[k] | 0));
const stAdd = (k, n) => { const st = metaSave().st; st[k] = (st[k] | 0) + n; };

/* ---------- 도감 ---------- */
const DEX = [
  ...['rock', 'meteor', 'scout', 'saucer', 'crab'].map(k => ({ key: 'mob:' + k, name: MOB[k].name, img: k === 'rock' ? 'rock_0.png' : k === 'meteor' ? 'meteor_fire.png' : `ship_${k}.png`, cat: '적' })),
  { key: 'elite', name: '엘리트 외계선', img: 'ship_crab.png', cat: '적', gold: true },
  ...ZONES.flatMap(z => [z.mid, z.boss]).map(b => ({ key: 'boss:' + b.name, name: b.name, img: 'ship_boss.png', cat: '보스' })),
  ...Object.entries(SKILL_CATS).map(([k, c]) => ({ key: 'evo:' + k, name: `${c.name} 스킬 진화`, img: 'sk_nova.png', cat: '진화', hint: Object.values(PASSIVE).find(p => p.evo === k)?.name })),
];
function dexSee(key) { const d = metaSave().dex; if (!d[key]) d[key] = 1; } // 1 = 발견 · 2 = 보상 받음
const dexReady = () => DEX.some(x => metaSave().dex[x.key] === 1);

/* ---------- 업적 ---------- */
const achTier = a => (metaSave().achGot[a.id] | 0); // 받은 단계 수
const achReady = a => achTier(a) < a.tiers.length && stat(a.id) >= a.tiers[achTier(a)];
function achClaim(a) {
  const t = achTier(a); if (!achReady(a)) return null;
  save.achGot[a.id] = t + 1; save.piece += a.piece[t];
  const pid = a.planet && a.planet[t], out = [`별모래 +${fmt(a.piece[t])}`];
  if (pid && !save.planets[pid]) { save.planets[pid] = { lv: 1 }; out.push(`행성 해금 · ${PLANET[pid].name}`); }
  else if (pid) { save.piece += 200; out.push(`${PLANET[pid].name} 보유 중 · 별모래 +200`); }
  return out;
}

/* ---------- 출석 ---------- */
const attReady = () => metaSave().att.last !== kstDay();
function openAttend(auto = false) {
  const a = metaSave().att, ready = attReady(), today = ready ? a.n % ATTEND.length : (a.n - 1 + ATTEND.length) % ATTEND.length;
  const rw = r => r.piece ? `<b class="piece">${fmt(r.piece)}</b>` : `<b class="dust">${fmt(r.dust)}</b>`;
  openModal(`<h3>7일 출석</h3>
    <p class="mtxt">매일 접속하면 보상을 받아요 · 7일째를 받으면 1일째부터 다시 시작해요</p>
    <div class="att-grid">${ATTEND.map((r, i) => {
      const got = ready ? i < today : i <= today, now = ready && i === today;
      return `<div class="att-day${got ? ' got' : ''}${now ? ' now' : ''}${i === 6 ? ' big' : ''}"><small>${i + 1}일</small>${rw(r)}${got ? '<em>받음</em>' : ''}</div>`;
    }).join('')}</div>
    <div class="mbtns"><button class="ghost sm" data-act="close" type="button">닫기</button><button class="cta sm" data-act="claim" type="button" ${ready ? '' : 'disabled'}>${ready ? '오늘 보상 받기' : '내일 또 와요'}</button></div>`,
  act => {
    if (act === 'close') { closeModal(); return; }
    if (act !== 'claim' || !attReady()) return;
    const r = ATTEND[a.n % ATTEND.length]; a.n += 1; a.last = kstDay();
    save.piece += r.piece || 0; save.dust += r.dust || 0; persist(); renderTopBar(); metaDots();
    closeModal(); showGachaResult([], `출석 ${(a.n - 1) % ATTEND.length + 1}일째`, [r.piece ? `별모래 +${fmt(r.piece)}` : `미네랄 +${fmt(r.dust)}`]);
  });
}

/* ---------- 시즌 패스 ---------- */
const seasonNo = () => Math.max(0, Math.floor((Date.now() - SEASON.epoch) / (SEASON.days * DAYMS)));
const seasonLeft = () => SEASON.epoch + (seasonNo() + 1) * SEASON.days * DAYMS - Date.now();
const spTier = () => Math.min(SEASON.tiers, Math.floor(metaSave().sp.pts / SEASON.need));
function spAdd(n) { const sp = metaSave().sp; sp.pts = Math.min(SEASON.tiers * SEASON.need, sp.pts + Math.max(0, Math.round(n))); }
const spReady = () => { const sp = metaSave().sp, t = spTier(); for (let i = 1; i <= t; i++) if (!sp.f.includes(i) || (passOn() && !sp.p.includes(i))) return true; return false; };
const rwTxt = r => r.piece ? `별모래 ${fmt(r.piece)}` : `미네랄 ${fmt(r.dust)}`;
function openSeason() {
  const sp = metaSave().sp, t = spTier(), paid = passOn();
  const cell = (r, i, got, line) => {
    const open = i <= t && (line === 'f' || paid);
    return got ? `<span class="sp-cell got">${rwTxt(r)}<em>받음</em></span>`
      : open ? `<button class="sp-cell ready" data-act="one" data-l="${line}" data-i="${i}" type="button">${rwTxt(r)}<em>받기</em></button>`
      : `<span class="sp-cell${line === 'p' && !paid ? ' lock' : ''}">${rwTxt(r)}</span>`;
  };
  const rows = Array.from({ length: SEASON.tiers }, (_, k) => k + 1).map(i => `<div class="sp-row${i <= t ? ' on' : ''}"><b>${i}</b>
    ${cell(SEASON.free(i), i, sp.f.includes(i), 'f')}${cell(SEASON.paid(i), i, sp.p.includes(i), 'p')}</div>`).join('');
  const into = sp.pts % SEASON.need;
  openModal(`<div class="season"><h3>시즌 ${seasonNo() + 1} 패스</h3>
    <p class="mtxt">단계 <b>${t} / ${SEASON.tiers}</b> · 남은 시간 ${qLeftText(seasonLeft())}</p>
    <span class="qgauge big"><i style="transform:scaleX(${t >= SEASON.tiers ? 1 : into / SEASON.need})"></i><em>${t >= SEASON.tiers ? 'MAX' : `${into} / ${SEASON.need}`}</em></span>
    <p class="mtxt small">패스 포인트: 아케이드 웨이브당 ${SEASON.ptsWave} (최대 ${SEASON.ptsWaveMax}) · 배틀 ${SEASON.ptsBattle} · 퀘스트 보상 ${SEASON.ptsQuest}</p>
    <div class="sp-head"><span>단계</span><span>무료</span><span>패스${paid ? '' : ' 🔒'}</span></div>
    <div class="sp-list">${rows}</div>
    ${paid ? '' : '<p class="mtxt small">오른쪽 줄은 상점의 30일 패스를 가진 동안 받을 수 있어요</p>'}
    <div class="mbtns"><button class="ghost sm" data-act="close" type="button">닫기</button><button class="cta sm" data-act="all" type="button" ${spReady() ? '' : 'disabled'}>모두 받기</button></div></div>`,
  (act, b) => {
    if (act === 'close') { closeModal(); return; }
    const got = [], take = (line, i) => {
      const L = line === 'f' ? sp.f : sp.p; if (L.includes(i) || i > spTier() || (line === 'p' && !passOn())) return;
      const r = (line === 'f' ? SEASON.free : SEASON.paid)(i); L.push(i);
      save.piece += r.piece || 0; save.dust += r.dust || 0; got.push(r);
    };
    if (act === 'one') take(b.dataset.l, +b.dataset.i);
    else if (act === 'all') for (let i = 1; i <= spTier(); i++) { take('f', i); take('p', i); }
    if (!got.length) return;
    const piece = got.reduce((a, r) => a + (r.piece || 0), 0), dust = got.reduce((a, r) => a + (r.dust || 0), 0);
    persist(); renderTopBar(); metaDots(); toast([piece && `별모래 +${fmt(piece)}`, dust && `미네랄 +${fmt(dust)}`].filter(Boolean).join(' · '));
    openSeason();
  });
}

/* ---------- 연구소 (영구 강화) ---------- */
function openLab() {
  const lab = metaSave().lab;
  openModal(`<h3>연구소</h3><p class="mtxt">미네랄로 아케이드 능력을 영구히 올려요 (대전에는 적용되지 않아요)</p>
    <div class="qlist lab">${LAB.map(L => {
      const lv = lab[L.id] | 0, max = lv >= L.max, cost = labCost(L, lv);
      return `<div class="qrow"><span class="qic lab-lv">${lv}</span>
        <div class="qmid"><b>${L.name} <small>Lv ${lv} / ${L.max}</small></b><small class="lab-now">지금 ${lv ? L.txt(L.v * lv) : '없음'}${max ? '' : ` → ${L.txt(L.v * (lv + 1))}`}</small></div>
        ${max ? '<span class="qok">MAX</span>' : `<button class="cta sm" data-act="up" data-id="${L.id}" type="button" ${save.dust >= cost ? '' : 'disabled'}><span class="dust">${fmtShort(cost)}</span></button>`}
      </div>`;
    }).join('')}</div>
    <div class="mbtns"><button class="ghost sm" data-act="close" type="button">닫기</button></div>`,
  (act, b) => {
    if (act === 'close') { closeModal(); return; }
    const L = LAB.find(x => x.id === b.dataset.id); if (!L) return;
    const lv = lab[L.id] | 0, cost = labCost(L, lv);
    if (lv >= L.max || !spend('dust', cost)) return;
    lab[L.id] = lv + 1; persist(); toast(`${L.name} Lv ${lv + 1}`); openLab();
  });
}

/* ---------- 기록: 업적 · 도감 ---------- */
let recTab = 'ach';
function openRecords(tabK = recTab) {
  recTab = tabK; const dex = metaSave().dex;
  const ach = ACH.map(a => {
    const t = achTier(a), done = t >= a.tiers.length, goal = a.tiers[Math.min(t, a.tiers.length - 1)], v = stat(a.id), pid = a.planet && a.planet[t];
    return `<div class="qrow${done ? ' done' : ''}"><span class="qic lab-lv">${t}</span>
      <div class="qmid"><b>${a.name} ${done ? '' : fmt(goal)}${pid && !done ? ` <small class="gold">+ 행성 ${PLANET[pid].name}</small>` : ''}</b>
        <span class="qgauge"><i style="transform:scaleX(${done ? 1 : clamp(v / goal, 0, 1)})"></i><em>${fmt(Math.min(v, goal))} / ${fmt(goal)}</em></span></div>
      ${done ? '<span class="qok">완료</span>' : achReady(a) ? `<button class="cta sm" data-act="ach" data-id="${a.id}" type="button">받기<small class="piece">${a.piece[t]}</small></button>` : `<span class="qok wait"><b class="piece">${a.piece[t]}</b></span>`}</div>`;
  }).join('');
  const found = DEX.filter(x => dex[x.key]).length;
  const dexHtml = `<p class="mtxt">발견 ${found} / ${DEX.length} · 처음 발견하면 별모래 ${DEX_PIECE}개</p><div class="dex-grid">${DEX.map(x => {
    const st = dex[x.key] | 0;
    return `<button class="dex-cell${st ? '' : ' unk'}${st === 1 ? ' ready' : ''}${x.gold ? ' gold' : ''}" data-act="dex" data-k="${x.key}" type="button" ${st === 1 ? '' : 'tabindex="-1"'}>
      <img src="${imgUrl(x.img)}" alt="" aria-hidden="true"><b>${st ? x.name : '???'}</b><small>${st === 1 ? '보상 받기' : st ? x.cat : x.hint ? `${x.hint} 최대` : x.cat}</small></button>`;
  }).join('')}</div>`;
  openModal(`<div class="records"><h3>${recTab === 'ach' ? '업적' : '도감'}</h3>
    <div class="qtabs" role="tablist">${[['ach', '업적', ACH.some(achReady)], ['dex', '도감', dexReady()]].map(([k, l, d]) => `<button type="button" role="tab" data-act="tab" data-k="${k}" aria-selected="${k === recTab}">${l}${d ? '<i class="dot"></i>' : ''}</button>`).join('')}</div>
    ${recTab === 'ach' ? `<div class="qlist">${ach}</div>` : dexHtml}
    <button class="ghost sm qclose" data-act="close" type="button">닫기</button></div>`,
  (act, b) => {
    if (act === 'close') closeModal();
    else if (act === 'tab') openRecords(b.dataset.k);
    else if (act === 'ach') { const out = achClaim(ACH.find(a => a.id === b.dataset.id)); if (!out) return; persist(); renderTopBar(); metaDots(); toast(out.join(' · ')); openRecords('ach'); }
    else if (act === 'dex') { if (dex[b.dataset.k] !== 1) return; dex[b.dataset.k] = 2; save.piece += DEX_PIECE; persist(); renderTopBar(); metaDots(); toast(`도감 등록 · 별모래 +${DEX_PIECE}`); openRecords('dex'); }
  });
}

/* ---------- 로비 버튼 빨간 점 ---------- */
function metaDots() {
  metaSave();
  $('attDot').hidden = !attReady();
  $('spDot').hidden = !spReady();
  $('recDot').hidden = !(ACH.some(achReady) || dexReady());
  $('labDot').hidden = !LAB.some(L => (save.lab[L.id] | 0) < L.max && save.dust >= labCost(L, save.lab[L.id] | 0) && (save.lab[L.id] | 0) === 0);
}
$('attBtn').addEventListener('click', () => openAttend());
$('spBtn').addEventListener('click', openSeason);
$('recBtn').addEventListener('click', () => openRecords());
$('labBtn').addEventListener('click', openLab);
let attShown = false;
function metaHome() { // enterHome
  metaDots();
  if (!attShown && attReady() && save.name) { attShown = true; setTimeout(() => { if (G.state === 'home' && $('modal').hidden) openAttend(true); }, 500); }
}

/* ---------- 출항 준비: 아케이드 모드 고르기 ---------- */
let vyKind = 'endless';
const chOpen = n => n === 1 || (metaSave().chapters[n - 1] | 0) > 0;
const curseBonus = cs => cs.reduce((a, id) => a + (CURSES.find(c => c.id === id) || { bonus: 0 }).bonus, 0);
function openVoyage(kind = vyKind) {
  vyKind = kind; metaSave();
  const best = save.best | 0, modes = [['endless', '끝없는 항해'], ['chapter', '챕터'], ['daily', '일일 도전'], ['rush', '보스 러시'], ['raid', '이벤트 보스']];
  const lockMsg = { rush: best < RUSH.unlock ? `최고 WAVE ${RUSH.unlock} 이상이면 열려요` : '' };
  let body = '';
  if (kind === 'endless') {
    const open = best >= CURSE_UNLOCK;
    body = `<p class="mtxt">웨이브가 끝없이 이어져요 · 최고 기록 <b>WAVE ${best}</b> · ${RUN.supplyEvery}웨이브마다 보급 선택</p>
      <h4 class="set-h">저주 <small>${open ? `켤수록 어렵고 미네랄 +${Math.round(curseBonus(VAR.curses) * 100)}%` : `최고 WAVE ${CURSE_UNLOCK} 이상이면 열려요`}</small></h4>
      <div class="vy-curses">${CURSES.map(c => `<button class="chip" data-act="curse" data-id="${c.id}" type="button" aria-pressed="${VAR.curses.includes(c.id)}" ${open ? '' : 'disabled'}>${c.name}<small>${c.desc} · +${Math.round(c.bonus * 100)}%</small></button>`).join('')}</div>`;
  } else if (kind === 'chapter') {
    body = `<p class="mtxt">정해진 10웨이브를 깨면 클리어 · ★1 클리어 · ★2 행성 HP 50% 이상 · ★3 부활 없이 HP 80% 이상</p>
      <div class="vy-ch">${CHAPTERS.map(C => {
        const st = save.chapters[C.n] | 0, op = chOpen(C.n);
        return `<button class="vy-chb" data-act="ch" data-n="${C.n}" type="button" aria-pressed="${VAR.ch === C.n}" ${op ? '' : 'disabled'}>
          <b>챕터 ${C.n}</b><small>WAVE ${C.from}–${C.from + C.waves - 1}${C.startLv ? ` · 시작 Lv ${C.startLv + 1}` : ''}</small>
          <span class="stars">${[1, 2, 3].map(k => `<i class="${k <= st ? 'on' : ''}"></i>`).join('')}</span>
          <small>${op ? (st ? `별 하나당 별모래 ${C.star}` : `첫 클리어 별모래 ${C.piece} · 미네랄 ${fmtShort(C.dust)}`) : '이전 챕터를 깨면 열려요'}</small></button>`;
      }).join('')}</div>`;
  } else if (kind === 'daily') {
    const d = save.daily.day === kstDay() ? save.daily.best : 0, cs = dailyCurses();
    body = `<p class="mtxt">오늘은 모두 같은 저주로 겨뤄요 · 하루 종일 몇 번이든 도전할 수 있어요</p>
      <div class="vy-curses">${cs.map(id => { const c = CURSES.find(x => x.id === id); return `<span class="chip" aria-pressed="true">${c.name}<small>${c.desc}</small></span>`; }).join('')}</div>
      <p class="mtxt">오늘 최고 <b>WAVE ${d}</b> · 기록 보상 별모래 = 웨이브 × ${DAILY.pieceWave} (최대 ${DAILY.pieceMax}, 기록을 넘긴 만큼)</p>
      <div class="mbtns"><button class="ghost sm" data-act="rank" type="button">오늘의 순위</button></div>`;
  } else if (kind === 'rush') {
    body = `<p class="mtxt">모선과 구역 보스만 연달아 나와요 · 보스 하나에 별모래 <b>${RUSH.piece}</b>개${lockMsg.rush ? `<br><b>${lockMsg.rush}</b>` : ''}</p>`;
  } else {
    const R = save.raid, b = raidBoss();
    body = `<p class="mtxt">이번 주 보스 <b>${b.name}</b> · ${RAID.time}초 동안 입힌 피해로 보상을 받아요 (매주 월요일 바뀜)</p>
      <p class="mtxt">이번 주 최고 피해 <b>${fmtBig(R.best)}</b></p>
      <div class="qlist">${RAID.tiers.map((t, i) => `<div class="qrow${i < R.got ? ' done' : ''}"><span class="qic lab-lv">${i + 1}</span><div class="qmid"><b>피해 ${fmtBig(t)}</b>
        <span class="qgauge"><i style="transform:scaleX(${clamp(R.best / t, 0, 1)})"></i><em>${i < R.got ? '달성' : fmtBig(Math.min(R.best, t))}</em></span></div><span class="qok"><b class="piece">${RAID.piece[i]}</b></span></div>`).join('')}</div>`;
  }
  const can = kind !== 'rush' || !lockMsg.rush;
  openModal(`<div class="voyage"><h3>출항 준비</h3>
    <div class="lv-tabs vy-tabs">${modes.map(([k, l]) => `<button class="chip" aria-pressed="${k === kind}" data-act="mode" data-k="${k}" type="button">${l}</button>`).join('')}</div>
    ${body}
    <div class="mbtns"><button class="ghost sm" data-act="close" type="button">닫기</button><button class="cta sm" data-act="go" type="button" ${can ? '' : 'disabled'}>출항 · 에너지 ${STAMINA.cost}</button></div></div>`,
  (act, b) => {
    if (act === 'close') closeModal();
    else if (act === 'mode') openVoyage(b.dataset.k);
    else if (act === 'curse') { const id = b.dataset.id; VAR.curses = VAR.curses.includes(id) ? VAR.curses.filter(x => x !== id) : [...VAR.curses, id]; save.settings.curses = VAR.curses; persist(); openVoyage('endless'); }
    else if (act === 'ch') { VAR.ch = +b.dataset.n; openVoyage('chapter'); }
    else if (act === 'rank') { if (window.LIVE) LIVE.open('ranking', 'daily'); else toast('서버에 연결되면 볼 수 있어요'); }
    else if (act === 'go') {
      if (kind === 'chapter' && !chOpen(VAR.ch)) VAR.ch = 1;
      VAR.kind = kind; closeModal(); tryStart('arcade');
    }
  });
}
VAR.curses = (save.settings.curses || []).filter(id => CURSES.some(c => c.id === id));

/* ---------- 결과 정산 (app.js finishBattle) ---------- */
// 아케이드 모드별 보상을 정산하고 결과 화면에 붙일 줄을 돌려줘요
function metaFinish(win) {
  metaSave();
  const v = G.variant || { kind: 'pvp', curses: [] }, lines = [];
  if (G.mode !== 'arcade') { spAdd(SEASON.ptsBattle); lines.push(`패스 포인트 +${SEASON.ptsBattle}`); return { lines, dustMul: 1, extraDust: 0 }; }
  stAdd('kills', G.kills); stAdd('bosses', G.runStats.bosses); stAdd('elites', G.runStats.elites); stAdd('evos', G.runStats.evos); stAdd('runs', 1);
  let piece = 0, dust = 0;
  if (v.kind === 'chapter' && win) {
    const C = CHAPTERS[v.ch - 1], P = G.me.planet, r = P.hp / P.maxHp, old = save.chapters[v.ch] | 0;
    const stars = 1 + (r >= .5 ? 1 : 0) + (r >= .8 && !G.revived ? 1 : 0);
    if (!old) { piece += C.piece; dust += C.dust; lines.push(`챕터 ${v.ch} 첫 클리어`); }
    if (stars > old) { piece += (stars - old) * C.star; save.chapters[v.ch] = stars; }
    lines.push(`★${'★'.repeat(stars - 1)}${'☆'.repeat(3 - stars)}`);
  }
  if (v.kind === 'daily') {
    const D = save.daily, day = kstDay(); if (D.day !== day) { D.day = day; D.best = 0; }
    const pc = w => Math.min(DAILY.pieceMax, w * DAILY.pieceWave), add = pc(G.wave) - pc(D.best);
    if (add > 0) { piece += add; lines.push(`일일 도전 기록 WAVE ${G.wave}`); }
    D.best = Math.max(D.best, G.wave);
  }
  if (v.kind === 'rush' && G.runStats.bosses) { piece += G.runStats.bosses * RUSH.piece; lines.push(`보스 ${G.runStats.bosses}마리`); }
  if (v.kind === 'raid') {
    const R = save.raid; R.best = Math.max(R.best, Math.round(G.raidDmg));
    while (R.got < RAID.tiers.length && R.best >= RAID.tiers[R.got]) { piece += RAID.piece[R.got]; R.got += 1; lines.push(`피해 ${fmtBig(RAID.tiers[R.got - 1])} 달성`); }
  }
  const pts = v.kind === 'raid' ? 30 : Math.min(SEASON.ptsWaveMax, (v.kind === 'rush' ? G.runStats.bosses * 5 : G.wave) * SEASON.ptsWave);
  spAdd(pts);
  save.piece += piece;
  if (piece) lines.unshift(`별모래 +${fmt(piece)}`);
  lines.push(`패스 포인트 +${pts}`);
  const dustMul = (1 + labV('dust')) * (1 + curseBonus(v.curses)) * (v.kind === 'raid' ? .3 : 1);
  return { lines, dustMul, extraDust: dust + Math.round(G.bonusDust || 0) };
}
const countsForBest = () => G.variant && (G.variant.kind === 'endless' || G.variant.kind === 'daily');
// 결과 화면: 별자리별 피해 막대 + 공유
function resultDamage() {
  const by = G.dmgBy || {}, rows = Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 6), top = rows.length ? rows[0][1] : 1;
  return rows.map(([id, v]) => {
    const c = G.me.cons.find(x => x.def.id === id), name = c ? c.skin.name : '게이지 스킬 · 기타';
    return `<div class="pm-row"><img src="${c ? `img/con_${c.skin.id}.webp` : 'img/sk_meteor.png'}" alt="" aria-hidden="true"><span><span class="top"><b>${name}</b><em>${fmtBig(Math.round(v))}</em></span><span class="bar"><i style="width:${(v / top * 100).toFixed(1)}%"></i></span></span></div>`;
  }).join('');
}
$('shareBtn').addEventListener('click', async () => {
  const txt = $('shareBtn').dataset.txt || '갤럭시워';
  try {
    if (navigator.share) await navigator.share({ text: txt, url: location.href });
    else { await navigator.clipboard.writeText(`${txt} ${location.href}`); toast('기록을 복사했어요'); }
  } catch {}
});

/* ---------- 보관 자원: 그냥 받기 / 광고 보고 2배 ---------- */
function openCollect() {
  const inc = pendingIncome();
  if (inc.dust < 1 && inc.piece < 1) return;
  openModal(`<h3>보관 자원</h3>
    <p class="mtxt">${inc.hrs.toFixed(1)}시간 동안 모은 자원 · 최대 ${INCOME.capHours}시간</p>
    <div class="rewards"><span class="dust">+${fmt(inc.dust)}</span><span class="piece">+${fmt(inc.piece)}</span></div>
    <div class="mbtns"><button class="ghost sm" data-act="one" type="button">받기</button><button class="cta sm" data-act="ad" type="button">광고 보고 2배</button></div>`,
  act => {
    const take = mul => {
      const now = pendingIncome();
      save.dust += now.dust * mul; save.piece += now.piece * mul;
      save.lastCollect = Date.now(); persist(); renderTopBar(); renderHome(); questAdd('claim');
      toast(`미네랄 ${fmt(now.dust * mul)} · 별모래 ${fmt(now.piece * mul)} 수령${mul > 1 ? ' (2배)' : ''}`);
    };
    if (act === 'one') { closeModal(); take(1); }
    else if (act === 'ad') { closeModal(); Ads.showRewarded('collect').then(r => take(r.rewarded ? 2 : 1)); }
  });
}
