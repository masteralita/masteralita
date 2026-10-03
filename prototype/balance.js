'use strict';
/* ==========================================================================
   Balance registry — every value the admin site (admin/) can edit.
   A value is addressed by a path like "con/sgr/hp" into the live data objects
   from data.js. Released overrides live in Firebase at releases/{version}
   ({ values: { path: value } }) and are applied on top of the defaults
   captured here, so the game and the admin site share one source.
   ========================================================================== */

const BAL_ROOTS = {
  con: CON, skin: SKIN, planet: PLANET, orbit: ORBIT_BASE, pskin: PSKIN, oskin: OSKIN,
  grade: GRADES, gacha: GACHA, tier: SKIN_TIER, chest: CHEST_ODDS, adchest: AD_CHEST,
  income: INCOME, slot: SLOT, enhance: ENHANCE_RATE, wave: WAVE, eskill: ESKILL, skgacha: SKILL_GACHA, sklv: SKILL_LV,
};

// Param defaults per effect type, taken from the first skin that uses it (for switching an awakening's type)
const FX_DEFAULTS = {};
for (const s of Object.values(SKIN)) for (const ch of s.chain) if (!FX_DEFAULTS[ch.type]) FX_DEFAULTS[ch.type] = { ...ch.p };
const FX_LABEL = {
  multishot:'추가 사격', planetChip:'행성 관통', focus:'집중 누적', stun:'기절', execute:'처형', nth:'N번째 강타', splash:'범위 피해',
  cleanse:'정화', amp:'공격력 증폭', extraProj:'투사체 추가', shred:'마방 감소', bounce:'튕김', teamGuard:'아군 피해 감소',
  counter:'반격', revive:'부활', rage:'분노', quake:'지진', planetGuard:'행성 보호', echo:'연속 공격', critDmg:'치명 피해',
  reflect:'피해 반사', slow:'둔화', molt:'탈피(무적)', roar:'포효', pierceBeam:'레이저 관통', energyKill:'처치 시 기력',
  overheal:'초과 회복 보호막', nthHeal:'N번째 전체 회복', lowHpHeal:'위기 회복', balance:'저울질', pctDmg:'최대 HP 비례',
  evadeCounter:'회피 반격', poisonStack:'독 중첩', poisonSpread:'독 전파', poisonBonus:'독 대상 추가 피해', leech:'흡혈',
  applyPoison:'독/화상 부여', twinBeam:'쌍레이저', shieldPulse:'주기 보호막', energyPulse:'주기 기력', meteorCall:'유성 소환',
};

/* ---------- Sections (tables the admin shows and the xlsx exports) ---------- */
// col: { key, label, kind: num|int|pct|text|orbits|chain, neutral? }  (pct = stored as fraction, shown ×100)
const BAL_SECTIONS = [
  { id:'con', title:'별자리', desc:'별자리 기본 능력치 (등급 배율·파츠·스킨 보정 전)',
    rows: ALL_CONS.map(c => ({ id:c.id, label:`${c.name}자리`, sub:c.en })),
    cols: [{ key:'hp', label:'HP', kind:'int' }, { key:'atk', label:'공격력', kind:'num' }, { key:'rate', label:'공격속도(/s)', kind:'num' },
           { key:'def', label:'물리 방어', kind:'int' }, { key:'mdef', label:'마법 방어', kind:'int' },
           { key:'name', label:'이름', kind:'text' }, { key:'en', label:'영문명', kind:'text' }, { key:'stat', label:'특징', kind:'text' }, { key:'sig', label:'설명', kind:'text' }],
    path: (r, c) => `con/${r}/${c}` },
  { id:'skin', title:'스킨·스킬', desc:'스킨별 능력치 보정(배율)과 각성 I~III 효과',
    rows: Object.values(SKIN).map(s => ({ id:s.id, label:s.name, sub:`${CON[s.con].name} · ${SKIN_TIER[s.tier].name}` })),
    cols: [{ key:'mod/atk', label:'공격력 ×', kind:'num', neutral:1 }, { key:'mod/rate', label:'공속 ×', kind:'num', neutral:1 }, { key:'mod/hp', label:'HP ×', kind:'num', neutral:1 },
           { key:'chain/0', label:'각성 I', kind:'chain' }, { key:'chain/1', label:'각성 II', kind:'chain' }, { key:'chain/2', label:'각성 III', kind:'chain' }],
    path: (r, c) => `skin/${r}/${c}` },
  { id:'skintext', title:'스킨 이름·설명', desc:'스킨, 각성, 능력치 카드에 보이는 글자',
    rows: Object.values(SKIN).map(s => ({ id:s.id, label:s.name, sub:`${CON[s.con].name} · ${SKIN_TIER[s.tier].name}` })),
    cols: [{ key:'name', label:'스킨 이름', kind:'text' }, { key:'sig', label:'설명', kind:'text' },
           { key:'chain/0/name', label:'각성 I 이름', kind:'text' }, { key:'chain/1/name', label:'각성 II 이름', kind:'text' }, { key:'chain/2/name', label:'각성 III 이름', kind:'text' },
           { key:'stats/0/1', label:'능력치 카드 1', kind:'text' }, { key:'stats/1/1', label:'능력치 카드 2', kind:'text' }],
    path: (r, c) => `skin/${r}/${c}` },
  { id:'planet', title:'행성', desc:'중심 행성 능력치와 특성 (궤도 수 1~2)',
    rows: PLANETS.map(p => ({ id:p.id, label:p.name, sub:p.en })),
    cols: [{ key:'hp', label:'HP', kind:'int' }, { key:'orbits', label:'궤도 수', kind:'orbits' }, { key:'unlock', label:'해금 💎', kind:'int' },
           { key:'trait/atkMul', label:'공격력 ×', kind:'num', neutral:1 }, { key:'trait/rateMul', label:'공속 ×', kind:'num', neutral:1 },
           { key:'trait/regen', label:'초당 회복', kind:'num', neutral:0 }, { key:'trait/dmgRed', label:'받는 피해 감소', kind:'pct', neutral:0 },
           { key:'trait/energy', label:'시작 기력', kind:'int', neutral:0 }, { key:'trait/crit', label:'치명타율', kind:'pct', neutral:0 },
           { key:'name', label:'이름', kind:'text' }, { key:'desc', label:'설명', kind:'text' }],
    path: (r, c) => `planet/${r}/${c}` },
  { id:'pskill', title:'고유 스킬 (UR)', desc:'행성마다 하나씩 있는 고유 게이지 스킬 (기력으로 발동). 스킨을 바꿔도 그대로예요. 위력은 종류마다 뜻이 달라요: 피해·회복·보호막은 최대 HP 대비, 버프·둔화는 증가/감소량',
    rows: PLANETS.map(p => ({ id:p.id, label:p.name, sub:p.en })),
    cols: [{ key:'type', label:'종류', kind:'gskill' }, { key:'name', label:'스킬 이름', kind:'text' }, { key:'cost', label:'기력', kind:'int' },
           { key:'v', label:'위력', kind:'pct' }, { key:'dur', label:'지속(초)', kind:'num' }],
    path: (r, c) => `planet/${r}/uskill/${c}` },
  { id:'eskill', title:'장착 스킬', desc:'상점 스킬 뽑기로 얻는 스킬 (행성마다 2칸, 어느 행성에나 장착). 등급은 고정이고 종류·이름·수치를 바꿀 수 있어요',
    rows: Object.entries(ESKILL).map(([id, k]) => ({ id, label:k.name, sub:`${k.grade} · ${SKILL_GRADES[k.grade].name}` })),
    cols: [{ key:'type', label:'종류', kind:'gskill' }, { key:'name', label:'스킬 이름', kind:'text' }, { key:'cost', label:'기력', kind:'int' },
           { key:'v', label:'위력 (Lv 1)', kind:'pct' }, { key:'dur', label:'지속(초)', kind:'num' }, { key:'up', label:'레벨당 증가 (%)', kind:'num' }],
    path: (r, c) => `eskill/${r}/${c}` },
  { id:'sklv', title:'스킬 레벨', desc:'중복으로 뽑은 장착 스킬이 쌓이면 레벨업. 필요 개수 = 그 레벨로 올리는 데 쓰는 같은 스킬 수. 구간 배율 = 그 레벨에서 스킬별 [레벨당 증가 %]를 몇 번 더할지 (1 = 한 번, 2 = 두 번, 0 = 증가 없음). 위력 = Lv 1 위력 × (1 + 레벨당 증가 % × 구간 배율 합). 기절은 지속 시간이 늘어나요',
    rows: SKILL_LV.map((_, i) => ({ id:String(i), label:`Lv ${i + 1} → ${i + 2}` })),
    cols: [{ key:'need', label:'필요 개수', kind:'int' }, { key:'step', label:'구간 배율', kind:'num' }],
    path: (r, c) => `sklv/${r}/${c}` },
  { id:'skgacha', title:'스킬 뽑기', desc:'등급별 뽑기 가중치 (가중치 합 기준 확률)와 최고 레벨 스킬이 또 나왔을 때 돌려주는 Star Dust',
    rows: DRAW_GRADES.map(g => ({ id:g, label:g, sub:SKILL_GRADES[g].name })),
    cols: [{ key:'free', label:'무료 뽑기 가중치', kind:'num' }, { key:'paid', label:'유료 뽑기 가중치', kind:'num' }, { key:'dupe', label:'최고 레벨 중복 시 Star Dust', kind:'int' }],
    path: (r, c) => c === 'dupe' ? `skgacha/dupe/${r}` : `skgacha/${c}/w/${r}` },
  { id:'orbit', title:'궤도', desc:'궤도 기본 능력치 (그 궤도의 별자리에게 적용)',
    rows: [{ id:'single/0', label:'단일 궤도', sub:'궤도 1개 행성' }, { id:'dual/0', label:'안쪽 궤도', sub:'궤도 2개 행성' }, { id:'dual/1', label:'바깥 궤도', sub:'궤도 2개 행성' }],
    cols: [{ key:'name', label:'이름', kind:'text' }, { key:'atk', label:'공격력 +', kind:'pct' }, { key:'rate', label:'공속 +', kind:'pct' }, { key:'hp', label:'HP +', kind:'pct' }],
    path: (r, c) => `orbit/${r}/${c}` },
  { id:'pskin', title:'행성 스킨', desc:'행성 스킨 가격과 보너스',
    rows: PLANET_SKINS.map(s => ({ id:s.id, label:s.name })),
    cols: [{ key:'price', label:'가격 💎', kind:'int' }, { key:'bonus/hp', label:'행성 HP +', kind:'pct', neutral:0 },
           { key:'bonus/atk', label:'전체 공격력 +', kind:'pct', neutral:0 }, { key:'bonus/dmgRed', label:'받는 피해 -', kind:'pct', neutral:0 },
           { key:'name', label:'이름', kind:'text' }, { key:'flavor', label:'설명', kind:'text' }],
    path: (r, c) => `pskin/${r}/${c}` },
  { id:'oskin', title:'궤도 스킨', desc:'궤도 스킨 가격과 보너스 (그 궤도의 별자리)',
    rows: ORBIT_SKINS.map(s => ({ id:s.id, label:s.name })),
    cols: [{ key:'price', label:'가격 💎', kind:'int' }, { key:'bonus/atk', label:'공격력 +', kind:'pct', neutral:0 },
           { key:'bonus/rate', label:'공속 +', kind:'pct', neutral:0 }, { key:'bonus/hp', label:'HP +', kind:'pct', neutral:0 },
           { key:'name', label:'이름', kind:'text' }, { key:'flavor', label:'설명', kind:'text' }],
    path: (r, c) => `oskin/${r}/${c}` },
  { id:'grade', title:'등급·뽑기', desc:'등급 배율과 뽑기 가중치 (가중치 합 기준 확률)',
    rows: GRADES.map((g, i) => ({ id:String(i), label:g.name, sub:g.en })),
    cols: [{ key:'mult', label:'능력치 배율', kind:'num' }, { key:'gold', label:'골드 뽑기 가중치', kind:'num' }, { key:'paid', label:'유료 뽑기 가중치', kind:'num' }],
    path: (r, c) => c === 'mult' ? `grade/${r}/mult` : `gacha/${c}/w/${r}` },
  { id:'econ', title:'경제·확률', desc:'가격, 확률, 보상량', kv: [
      ['gacha/gold/cost', '골드 뽑기 1회 (Star Dust)', 'int'], ['gacha/gold/cost10', '골드 뽑기 10회 (Star Dust)', 'int'],
      ['gacha/paid/cost', '유료 뽑기 1회 (Star Piece)', 'int'], ['gacha/paid/cost10', '유료 뽑기 10회 (Star Piece)', 'int'],
      ['skgacha/free/cost', '무료 스킬 뽑기 1회 (Star Dust)', 'int'], ['skgacha/free/cost10', '무료 스킬 뽑기 10회 (Star Dust)', 'int'],
      ['skgacha/paid/cost', '유료 스킬 뽑기 1회 (Star Piece)', 'int'], ['skgacha/paid/cost10', '유료 스킬 뽑기 10회 (Star Piece)', 'int'],
      ['tier/supernova/price', '스페셜 스킨 가격 (Star Piece)', 'int'],
      ['chest/skin', '보물 상자 · 성운 스킨 확률', 'pct'], ['chest/dust', '보물 상자 · Star Dust 확률', 'pct'],
      ['chest/piece', '보물 상자 · Star Piece 확률', 'pct'], ['chest/con', '보물 상자 · 별자리 카드 확률', 'pct'],
      ['adchest/reward/0', '광고 상자 보상 최소 (Star Piece)', 'int'], ['adchest/reward/1', '광고 상자 보상 최대 (Star Piece)', 'int'],
      ['adchest/cd/0', '광고 상자 등장 간격 최소 (초)', 'int'], ['adchest/cd/1', '광고 상자 등장 간격 최대 (초)', 'int'],
      ['adchest/hp', '광고 상자 격추 횟수', 'int'], ['adchest/life', '광고 상자 유지 시간 (초)', 'int'],
      ['income/dustBase', '방치 수입 · Star Dust 기본 (시간당)', 'int'], ['income/dustPerLv', '방치 수입 · 레벨당 추가', 'int'],
      ['income/pieceRate', '방치 수입 · Star Piece (시간당)', 'num'], ['income/capHours', '방치 수입 · 최대 누적 (시간)', 'int'],
      ['slot/act/cost', '액티브 슬롯 열기 (Star Dust)', 'int'], ['slot/pas/cost', '패시브 슬롯 열기 (Star Dust)', 'int'], ['slot/lim/cost', '한정 슬롯 열기 (Star Piece)', 'int'],
      ...ENHANCE_RATE.map((_, i) => [`enhance/${i}`, `강화 성공률 +${i} → +${i + 1}`, 'pct']),
    ] },
  { id:'wave', title:'웨이브', desc:'아케이드 난이도 곡선', kv: [
      ['wave/planetHp', '모선(보스) 기본 HP', 'int'], ['wave/planetGrowth', '모선 HP 증가 (웨이브마다 ×)', 'num'],
      ['wave/statGrowth', '적 능력치 증가 (웨이브마다 ×)', 'num'], ['wave/deepFrom', '외우주 가속 시작 웨이브', 'int'],
      ['wave/deepGrowth', '외우주 추가 증가 (×)', 'num'], ['wave/midBossHp', '중간 보스(모선) HP 배율', 'num'], ['wave/zoneBossHp', '구역 보스 HP 배율', 'num'],
      ['wave/conHp', '적 HP 배율 (소행성·운석·우주선)', 'num'], ['wave/conAtk', '적 공격력 배율', 'num'], ['wave/timer', '웨이브 제한 시간 (초)', 'int'],
      ['wave/rockHp', '소행성 기본 HP', 'int'], ['wave/meteorHp', '운석 기본 HP', 'int'], ['wave/shipHp', '외계 우주선 기본 HP', 'int'],
      ['wave/shipAtk', '외계 우주선 탄 피해', 'int'], ['wave/rockPct', '소행성 충돌 피해 (행성 최대 HP 비율)', 'pct'], ['wave/meteorPct', '운석 충돌 피해 (행성 최대 HP 비율)', 'pct'],
    ] },
];
// Flatten into fields: path → { kind, neutral, label }
const BAL_FIELDS = {};
for (const s of BAL_SECTIONS) {
  if (s.kv) for (const [path, label, kind] of s.kv) BAL_FIELDS[path] = { kind, label, sec: s.id };
  else for (const r of s.rows) for (const c of s.cols) BAL_FIELDS[s.path(r.id, c.key)] = { kind: c.kind, neutral: c.neutral, label: `${r.label} · ${c.label}`, sec: s.id };
}

/* ---------- Path access ---------- */
function balGet(path) {
  const seg = path.split('/');
  let o = BAL_ROOTS[seg[0]];
  if (seg[0] === 'skin' && seg[2] === 'chain' && seg.length === 4) { const ch = o[seg[1]].chain[+seg[3]]; return { type: ch.type, p: { ...ch.p } }; }
  for (let i = 1; i < seg.length; i++) { if (o == null) return undefined; o = o[seg[i]]; }
  return o;
}
function balSet(path, v) {
  const seg = path.split('/');
  let o = BAL_ROOTS[seg[0]];
  if (seg[0] === 'skin' && seg[2] === 'chain' && seg.length === 4) {
    const ch = o[seg[1]].chain[+seg[3]];
    ch.type = FX[v.type] ? v.type : ch.type; ch.p = { ...(v.p || FX_DEFAULTS[ch.type] || {}) }; // exactly the given params
    ch.desc = FX[ch.type](ch.p); return;
  }
  if (seg[seg.length - 1] === 'type' && (seg[2] === 'uskill' || seg[0] === 'eskill') && !GSKILL[v]) return; // unknown skill type: keep the current one
  const f = BAL_FIELDS[path], k = seg[seg.length - 1], isNeutral = f && f.neutral !== undefined && v === f.neutral;
  for (let i = 1; i < seg.length - 1; i++) {
    if (o[seg[i]] == null) { if (isNeutral) return; o[seg[i]] = {}; } // don't create containers just to hold a neutral value
    o = o[seg[i]];
  }
  if (isNeutral && !(k in o)) return;
  if (isNeutral && f.neutral === 0 && (seg.includes('bonus') || seg.includes('trait'))) delete o[k]; // no "+0%" lines
  else o[k] = v;
}
const balValue = path => { const v = balGet(path), f = BAL_FIELDS[path]; return v === undefined && f ? f.neutral : v; };

// Defaults as shipped in data.js (deep-copied)
const BAL_DEFAULTS = {};
for (const p of Object.keys(BAL_FIELDS)) BAL_DEFAULTS[p] = JSON.parse(JSON.stringify(balValue(p) ?? null));

const sameVal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// Reset every field to its default, then apply the saved overrides
function applyBalance(values = {}) {
  for (const [p, d] of Object.entries(BAL_DEFAULTS)) balSet(p, JSON.parse(JSON.stringify(d)));
  for (const [p, v] of Object.entries(values)) if (BAL_FIELDS[p]) { try { balSet(p, v); } catch {} }
}

/* ---------- Added content (release.content) ---------- */
// Items created in the admin site on top of data.js, keyed by id:
//   skins:  { id, con, tier: nebula|supernova, name, sig, style?, kind?, mod?: {atk,rate,hp}, stats: [{ key: STAT key, name } ×2], chain: [{ name, type, p } ×3] }
//   pskins: { id, name, price, bonus: {hp,atk,dmgRed}, flavor, tint: 'r,g,b' }
//   oskins: { id, name, price, bonus: {atk,rate,hp}, flavor, look: dash|dust|aurora|comet }
// (stats are objects, not [key, name] pairs, because Firestore can't store arrays inside arrays)
// The game drops what the previous release added and adds the new set; invalid items are skipped.
const ORBIT_LOOKS = { dash:'점선', dust:'별먼지', aurora:'오로라', comet:'유성' };
const isNum = v => typeof v === 'number' && Number.isFinite(v);
function contentProblems(kind, d) {
  const out = [];
  if (!d || typeof d.id !== 'string' || !d.id) return ['id가 없어요'];
  if (!String(d.name || '').trim()) out.push('이름을 입력해 주세요');
  if (kind === 'skins') {
    if (!CON[d.con]) out.push('별자리를 골라 주세요');
    if (!['nebula', 'supernova'].includes(d.tier)) out.push('등급은 성운 또는 스페셜이에요');
    if (d.style && !STYLE_LABEL[d.style]) out.push('공격 방식이 올바르지 않아요');
    if (d.kind && !KIND_LABEL[d.kind]) out.push('속성이 올바르지 않아요');
    if (!Array.isArray(d.stats) || d.stats.length !== 2 || d.stats.some(x => !x || !STAT[x.key])) out.push('능력치 카드 2개를 골라 주세요');
    if (!Array.isArray(d.chain) || d.chain.length !== 3 || d.chain.some(ch => !ch || !FX[ch.type])) out.push('각성 3개를 골라 주세요');
    for (const [k, v] of Object.entries(d.mod || {})) if (!isNum(v) || v <= 0) out.push(`배율 ${k} 값이 올바르지 않아요`);
  } else {
    if (!isNum(d.price) || d.price < 0) out.push('가격을 입력해 주세요');
    for (const [k, v] of Object.entries(d.bonus || {})) if (!isNum(v)) out.push(`보너스 ${k} 값이 올바르지 않아요`);
    if (kind === 'oskins' && d.look && !ORBIT_LOOKS[d.look]) out.push('모양이 올바르지 않아요');
  }
  if (kind === 'skins' ? SKIN_BASE.has(d.id) : kind === 'pskins' ? PSKIN_BASE.has(d.id) : OSKIN_BASE.has(d.id)) out.push('기본 항목과 id가 같아요');
  return out;
}
const SKIN_BASE = new Set(Object.keys(SKIN)), PSKIN_BASE = new Set(Object.keys(PSKIN)), OSKIN_BASE = new Set(Object.keys(OSKIN));
const ADDED = { skins: [], pskins: [], oskins: [] };
function applyContent(content) {
  content = content || {};
  for (const id of ADDED.skins) { const sk = SKIN[id]; if (sk) SKINS[sk.con] = SKINS[sk.con].filter(x => x.id !== id); delete SKIN[id]; }
  for (const id of ADDED.pskins) { const i = PLANET_SKINS.findIndex(x => x.id === id); if (i >= 0) PLANET_SKINS.splice(i, 1); delete PSKIN[id]; }
  for (const id of ADDED.oskins) { const i = ORBIT_SKINS.findIndex(x => x.id === id); if (i >= 0) ORBIT_SKINS.splice(i, 1); delete OSKIN[id]; }
  ADDED.skins = []; ADDED.pskins = []; ADDED.oskins = [];
  const items = kind => Object.values(content[kind] || {}).filter(d => !contentProblems(kind, d).length).map(d => JSON.parse(JSON.stringify(d)));
  for (const sk of items('skins')) { sk.stats = sk.stats.map(x => [x.key, x.name || '']); prepSkin(sk, sk.con); SKINS[sk.con].push(sk); SKIN[sk.id] = sk; ADDED.skins.push(sk.id); }
  for (const ps of items('pskins')) { ps.bonus = ps.bonus || {}; ps.flavor = ps.flavor || ''; PLANET_SKINS.push(ps); PSKIN[ps.id] = ps; ADDED.pskins.push(ps.id); }
  for (const os of items('oskins')) { os.bonus = os.bonus || {}; os.flavor = os.flavor || ''; ORBIT_SKINS.push(os); OSKIN[os.id] = os; ADDED.oskins.push(os.id); }
}

/* ---------- Released balance from Firebase (docs/FIREBASE.md) ---------- */
// The admin site publishes releases/{version} and bumps meta/current; both are public to read.
// The game checks meta/current on launch and downloads the release only when the version changed.
// The last release is cached on the device, so an offline launch still uses it; nothing at all → data.js defaults.
const BAL = { values: {}, version: 0, publishedAt: null, source: 'default', ready: false, listeners: [] };
const BAL_CACHE = 'gw-balance';
function onBalance(fn) { BAL.listeners.push(fn); }
function useBalance(rel, source) {
  BAL.values = rel.values || {}; BAL.version = rel.version || 0; BAL.publishedAt = rel.publishedAt || null; BAL.source = source;
  applyContent(rel.content);
  applyBalance(BAL.values);
}
const fsPlain = f => 'mapValue' in f ? Object.fromEntries(Object.entries(f.mapValue.fields || {}).map(([k, x]) => [k, fsPlain(x)]))
  : 'arrayValue' in f ? (f.arrayValue.values || []).map(fsPlain)
  : 'integerValue' in f ? Number(f.integerValue) : 'nullValue' in f ? null : Object.values(f)[0];
async function fsGet(path) {
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/${FIREBASE_DB}/documents/${path}?key=${FIREBASE_CONFIG.apiKey}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`firestore ${r.status}`);
  return fsPlain({ mapValue: await r.json() });
}
(async function loadBalance() {
  if (window.GW_ADMIN) return; // the admin site only uses the registry
  let cached = null;
  try { cached = JSON.parse(localStorage.getItem(BAL_CACHE)); } catch {}
  if (cached && cached.values) useBalance(cached, 'cache');
  try {
    const meta = await fsGet('meta/current');
    const version = meta && meta.version || 0;
    if (!version) { if (cached) useBalance({}, 'default'); }
    else if (!cached || cached.version !== version) {
      const rel = await fsGet(`releases/${version}`);
      if (rel) { useBalance(rel, 'server'); try { localStorage.setItem(BAL_CACHE, JSON.stringify(rel)); } catch {} }
    } else BAL.source = 'server';
  } catch { /* offline or blocked (e.g. inside claude.ai): keep the cache or the defaults */ }
  BAL.ready = true;
  BAL.listeners.forEach(f => f());
})();
