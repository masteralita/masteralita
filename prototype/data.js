'use strict';
const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const chance = p => Math.random() < p;
const $ = id => document.getElementById(id);
const ROMAN = ['', 'I', 'II', 'III'];
const CRIT_COL = ['#fff4cf', '#c07bff', '#ffd23f', '#ff4a4a', '#4aa8ff', '#16161c'];

/* ---------- Constellations (갤럭시워.xlsx 별자리 시트) ---------- */
function shape(pts, edges, key) { return { pts, edges: edges.split(' ').map(e => e.split('-').map(Number)), key }; }
const ZODIAC = [
  { id:'sgr', name:'궁수', en:'Sagittarius', stat:'공격속도', kind:'phys', style:'arrow', hp:240, atk:8, rate:2.4, def:10, mdef:10,
    sig:'빠르게 화살을 연사해요.',
    sh: shape([[-.9,.5],[-.5,.1],[-.1,.3],[.2,-.1],[.6,.1],[.5,-.5],[.1,-.6],[-.3,-.3],[.9,-.3]], '0-1 1-2 2-3 3-4 4-5 5-6 6-7 7-1 3-7 4-8', 3) },
  { id:'cap', name:'염소', en:'Capricorn', stat:'물리 공격', kind:'phys', style:'shot', hp:260, atk:24, rate:.9, def:12, mdef:8,
    sig:'묵직한 물리탄을 쏴요.',
    sh: shape([[-.9,-.3],[-.3,-.1],[.3,-.4],[.9,-.5],[.6,.3],[.1,.6],[-.5,.3]], '0-1 1-2 2-3 3-4 4-5 5-6 6-0', 2) },
  { id:'aqr', name:'물병', en:'Aquarius', stat:'마법 방어', kind:'magic', style:'orb', hp:300, atk:13, rate:1, def:10, mdef:45,
    sig:'마법 구체를 쏘고, 마법 공격에 강해요.',
    sh: shape([[-.9,-.6],[-.5,-.2],[-.1,-.5],[.2,-.1],[.5,-.4],[.3,.3],[.7,.6],[-.2,.5]], '0-1 1-2 2-3 3-4 3-5 5-6 5-7', 3) },
  { id:'psc', name:'물고기', en:'Pisces', stat:'마법 공격', kind:'magic', style:'orb', hp:230, atk:22, rate:.95, def:8, mdef:15,
    sig:'강한 마법 구체를 쏴요.',
    sh: shape([[-.9,-.7],[-.6,-.2],[-.3,.3],[0,.7],[.4,.4],[.8,.2],[.9,.6],[.6,.7]], '0-1 1-2 2-3 3-4 4-5 5-6 6-7 7-5', 3) },
  { id:'ari', name:'양', en:'Aries', stat:'방어력', kind:'phys', style:'shot', hp:300, atk:12, rate:1, def:45, mdef:10,
    sig:'물리 공격에 강한 방어형이에요.',
    sh: shape([[-.8,-.3],[-.2,-.5],[.4,-.2],[.8,.4]], '0-1 1-2 2-3', 1) },
  { id:'tau', name:'황소', en:'Taurus', stat:'HP', kind:'phys', style:'shot', hp:520, atk:11, rate:.9, def:15, mdef:15,
    sig:'HP가 가장 높은 탱커예요.',
    sh: shape([[-.9,-.7],[-.4,-.2],[0,0],[.3,.2],[.9,-.1],[.2,.6],[-.3,.3]], '0-1 1-2 2-3 3-4 2-6 6-5 3-5', 2) },
  { id:'gem', name:'쌍둥이', en:'Gemini', stat:'물리·마법 공격', kind:'both', style:'twin', hp:240, atk:11, rate:1, def:10, mdef:10,
    sig:'물리탄과 마법탄을 동시에 쏴요.',
    sh: shape([[-.6,-.9],[-.5,-.3],[-.6,.3],[-.8,.8],[.3,-.9],[.4,-.3],[.3,.3],[.5,.8]], '0-1 1-2 2-3 4-5 5-6 6-7 1-5', 0) },
  { id:'cnc', name:'게', en:'Cancer', stat:'물리 방어', kind:'phys', style:'shot', hp:320, atk:12, rate:1, def:40, mdef:12,
    sig:'단단한 껍질로 버티는 방어형이에요.',
    sh: shape([[0,-.2],[-.5,-.8],[.1,.2],[-.6,.7],[.7,.5]], '0-1 0-2 2-3 2-4', 0) },
  { id:'leo', name:'사자', en:'Leo', stat:'공격력', kind:'phys', style:'beam', hp:260, atk:30, rate:.7, def:14, mdef:10,
    sig:'즉시 명중하는 강한 레이저를 쏴요.',
    sh: shape([[-.9,.4],[-.3,.3],[.2,.4],[.5,-.1],[.3,-.5],[.6,-.8],[.9,-.5],[-.2,-.1]], '0-1 1-2 2-3 3-4 4-5 5-6 1-7 7-3', 2) },
  { id:'vir', name:'처녀', en:'Virgo', stat:'HP 회복', kind:'magic', style:'heal', hp:250, atk:9, rate:.8, def:10, mdef:18,
    sig:'공격할 때마다 행성과 다친 별자리를 회복해요.',
    sh: shape([[-.9,-.2],[-.4,0],[0,-.3],[.4,-.1],[.8,-.5],[.1,.3],[.4,.8],[-.3,.6]], '0-1 1-2 2-3 3-4 2-5 5-6 5-7', 6) },
  { id:'lib', name:'천칭', en:'Libra', stat:'물리·마법 방어', kind:'magic', style:'orb', hp:300, atk:12, rate:1, def:30, mdef:30,
    sig:'물리와 마법 모두 버티는 균형형이에요.',
    sh: shape([[0,-.8],[-.6,-.1],[.6,-.2],[-.4,.7],[.5,.6]], '0-1 0-2 1-2 1-3 2-4', 0) },
  { id:'sco', name:'전갈', en:'Scorpio', stat:'상태이상 감소', kind:'phys', style:'poison', hp:260, atk:10, rate:1, def:14, mdef:14,
    sig:'독을 걸고, 아군의 기절 시간을 줄여줘요.',
    sh: shape([[-.9,-.8],[-.7,-.4],[-.8,0],[-.4,.1],[0,.2],[.3,.5],[.6,.8],[.9,.5],[.8,.1]], '0-1 1-2 1-3 3-4 4-5 5-6 6-7 7-8', 3) },
];
const SPECIAL = { id:'oph', name:'뱀주인', en:'Ophiuchus', stat:'행성 직접 타격', kind:'magic', style:'beam', hp:220, atk:18, rate:.6, def:10, mdef:10, special:true,
  sig:'적 별자리를 무시하고 행성을 바로 공격해요.',
  sh: shape([[-.5,-.9],[.3,-.8],[.7,0],[.4,.8],[-.3,.8],[-.7,.1],[0,-.1]], '0-1 1-2 2-3 3-4 4-5 5-0 6-0 6-3', 6) };
const ALL_CONS = [...ZODIAC, SPECIAL];
const CON = Object.fromEntries(ALL_CONS.map(c => [c.id, c]));

/* ---------- Perks: stackable stats + sequential awakenings (벤치마킹: 스킬 목록 Lv5→Lv10→…) ---------- */
const STAT = {
  atk:     { v:.15, txt:v => `공격력 <b>+${v*100}%</b>` },
  rate:    { v:.12, txt:v => `공격속도 <b>+${v*100}%</b>` },
  crit:    { v:.12, txt:v => `치명타율 <b>+${Math.round(v*100)}%</b>` },
  critDmg: { v:.35, txt:v => `치명타 피해 <b>+${Math.round(v*100)}%</b>` },
  hp:      { v:.25, txt:v => `최대 HP <b>+${v*100}%</b>` },
  heal:    { v:.3,  txt:v => `회복량 <b>+${v*100}%</b>` },
  poison:  { v:.3,  txt:v => `독 피해 <b>+${v*100}%</b>` },
  tArmor:  { v:10,  txt:v => `모든 별자리 물리 방어 <b>+${v}</b>` },
  tMArmor: { v:10,  txt:v => `모든 별자리 마법 방어 <b>+${v}</b>` },
  tEvade:  { v:.08, txt:v => `아군 전체 회피율 <b>+${Math.round(v*100)}%</b>` },
  pHp:     { v:.1,  txt:v => `행성 최대 HP <b>+${v*100}%</b>` },
};
const PERKS = {
  sgr: { stats:[['rate','연사 강화'],['crit','날카로운 촉']], chain:[
    ['분열 화살','3번째 공격마다 다른 적에게 화살 2발을 추가로 쏴요.'],
    ['꿰뚫는 화살','화살이 적 행성에도 피해의 25%를 줘요. 별자리가 살아 있어도 적용돼요.'],
    ['사수의 집중','같은 대상을 연속으로 맞히면 공격력이 8%씩 올라요 (최대 +80%).'] ] },
  cap: { stats:[['atk','단단한 뿔'],['critDmg','급소 찌르기']], chain:[
    ['뿔 들이받기','공격 시 20% 확률로 적 별자리를 1초 기절시켜요.'],
    ['산악 돌파','HP 50% 이하인 적에게 주는 피해가 40% 늘어요.'],
    ['거인의 일격','5번째 공격마다 피해가 3배예요.'] ] },
  aqr: { stats:[['tMArmor','물의 장막'],['atk','수압']], chain:[
    ['물결','구체가 명중하면 주변 적 별자리에게 50% 피해가 퍼져요.'],
    ['정화의 비','8초마다 아군의 기절과 독을 풀고 HP를 8% 회복해요.'],
    ['범람','구체 피해가 60% 늘어요.'] ] },
  psc: { stats:[['atk','심해의 힘'],['rate','유영']], chain:[
    ['쌍어','구체를 2개씩 쏴요.'],
    ['심해의 저주','명중할 때마다 대상의 마법 방어가 10 줄어요 (최대 -40).'],
    ['회유','구체가 명중 후 다른 적에게 한 번 튕겨요 (60% 피해).'] ] },
  ari: { stats:[['tArmor','양털 갑옷'],['hp','두꺼운 털']], chain:[
    ['황금 양털','아군 별자리와 행성이 받는 피해가 15% 줄어요.'],
    ['돌진','피격 시 25% 확률로 즉시 반격해요.'],
    ['불굴','파괴되면 웨이브마다 한 번, HP 40%로 되살아나요.'] ] },
  tau: { stats:[['hp','강인한 몸'],['pHp','대지의 뿌리']], chain:[
    ['분노의 뿔','잃은 HP 비율만큼 공격력이 올라요 (최대 +100%).'],
    ['지진','6초마다 모든 적 별자리에게 공격력 200% 피해를 줘요.'],
    ['대지의 가호','행성이 받는 피해가 15% 줄어요.'] ] },
  gem: { stats:[['rate','호흡 맞추기'],['crit','쌍성의 눈']], chain:[
    ['거울상','25% 확률로 한 번 더 공격해요.'],
    ['카스토르','치명타 피해가 60% 늘어요.'],
    ['폴룩스','마법탄이 적 행성에도 피해의 30%를 줘요.'] ] },
  cnc: { stats:[['tArmor','껍질 연마'],['hp','단단한 등딱지']], chain:[
    ['가시 껍질','받은 피해의 25%를 공격자에게 돌려줘요.'],
    ['집게','명중한 적의 공격속도를 3초 동안 30% 낮춰요.'],
    ['탈피','HP가 30% 아래로 떨어지면 웨이브마다 한 번, 3초 무적이 돼요.'] ] },
  leo: { stats:[['atk','맹수의 이빨'],['critDmg','사냥 본능']], chain:[
    ['포효','10초마다 아군 전체 공격력이 4초 동안 30% 올라요.'],
    ['레굴루스','레이저가 뒤에 있는 적 하나를 더 관통해요.'],
    ['왕의 위엄','적 별자리를 처치하면 기력을 1 얻어요.'] ] },
  vir: { stats:[['heal','풍요의 손길'],['rate','수확의 계절']], chain:[
    ['풍요의 가호','행성 회복량이 넘치면 넘친 만큼 보호막이 생겨요 (최대 HP 20%).'],
    ['스피카','5번째 회복마다 아군 별자리 전체 HP를 12% 회복해요.'],
    ['정결','행성 HP가 30% 이하이면 회복량이 2배예요.'] ] },
  lib: { stats:[['tEvade','기울어진 저울'],['tMArmor','공정한 법정']], chain:[
    ['저울질','적 행성의 HP 비율이 내 행성보다 높으면 공격력이 30% 올라요.'],
    ['심판','공격이 대상 최대 HP의 2%만큼 추가 피해를 줘요.'],
    ['평형','아군이 회피할 때마다 천칭이 즉시 반격해요.'] ] },
  sco: { stats:[['poison','맹독 분비'],['crit','급소 노리기']], chain:[
    ['맹독','독이 최대 3번까지 중첩돼요.'],
    ['안타레스','독에 걸린 적이 파괴되면 가까운 적에게 독이 옮아가요.'],
    ['꼬리침','독에 걸린 대상에게 주는 피해가 40% 늘어요.'] ] },
  oph: { stats:[['atk','뱀의 독니'],['rate','치유의 지팡이']], chain:[
    ['의술','행성에 준 피해의 10%만큼 내 행성 HP를 회복해요.'],
    ['독사의 입맞춤','공격이 적 행성에 독을 걸어요.'],
    ['아스클레피오스','레이저를 2줄씩 쏴요.'] ] },
};
const STAT_MAX = 3;

/* ---------- Voyage zones ---------- */
const ZONES = [
  { name:'내행성계', en:'INNER SYSTEM', from:1, bg:['#150d24','#0b0a1c','#1a1026'], neb:['255,140,70', '200,80,120'],
    foes:[ { name:'수성', kind:'rock', c:['#e8d9c9','#8d7663','#2c2119'], glow:'220,180,140' },
           { name:'금성', kind:'gas',  c:['#fff0c2','#e0a94a','#5e3a0e'], glow:'255,200,110' },
           { name:'화성', kind:'rock', c:['#ffb199','#c2391b','#3d0c05'], glow:'255,90,60' },
           { name:'세레스', kind:'rock', c:['#d9d9e0','#77788a','#24242e'], glow:'190,190,210' } ],
    mid:  { name:'포보스 요새', kind:'rock', c:['#ffc3a8','#a3341a','#2a0703'], glow:'255,90,60', ring:false },
    boss: { name:'적색 항성 헬리오스', kind:'star', c:['#fff0d0','#ff6a2a','#8a1206'], glow:'255,100,40', ability:'burn' } },
  { name:'외행성계', en:'OUTER SYSTEM', from:11, bg:['#07142a','#060c1e','#0a1a30'], neb:['60,160,220', '80,90,220'],
    foes:[ { name:'목성',   kind:'gas',  c:['#ffe3c4','#c98a52','#4a2610'], glow:'230,160,100', bands:true },
           { name:'토성',   kind:'gas',  c:['#fff2cc','#d9b56a','#5a4214'], glow:'240,210,130', ring:true },
           { name:'천왕성', kind:'gas',  c:['#cffcff','#3fb9c9','#0b3a44'], glow:'90,220,230' },
           { name:'해왕성', kind:'gas',  c:['#b9d6ff','#2d57d8','#0a1450'], glow:'80,120,255' } ],
    mid:  { name:'대적점 폭풍', kind:'gas', c:['#ffd0b0','#d0512a','#3a0f06'], glow:'255,120,70', bands:true },
    boss: { name:'고리의 왕 크로노스', kind:'gas', c:['#e0b6ff','#6a1fc2','#12032b'], glow:'170,80,255', ring:true, ability:'meteor' } },
  { name:'외우주', en:'DEEP SPACE', from:21, bg:['#05040f','#030208','#0a0616'], neb:['150,70,220', '40,40,120'],
    foes:[ { name:'명왕성', kind:'rock', c:['#f3e3d6','#a07c6a','#3a2820'], glow:'230,190,170' },
           { name:'에리스', kind:'rock', c:['#f4f6ff','#9aa0c0','#2a2d44'], glow:'200,210,255' },
           { name:'혜성 핵', kind:'rock', c:['#e6fbff','#6a8ea0','#1a2830'], glow:'150,230,255' },
           { name:'떠돌이 행성', kind:'gas', c:['#c8b8ff','#3c2a8a','#0c0626'], glow:'140,110,255', bands:true } ],
    mid:  { name:'오르트 거신', kind:'rock', c:['#dfe8ff','#5a6a9a','#141a30'], glow:'160,190,255', ring:true },
    boss: { name:'사건의 지평선', kind:'hole', c:['#000','#000','#000'], glow:'255,170,90', ability:'drain' } },
];
function zoneOf(n) { return n >= 21 ? ZONES[2] : n >= 11 ? ZONES[1] : ZONES[0]; }

/* ---------- Center planets (화면설계서 11p · 행성 파츠 시트) ---------- */
// trait fields: rateMul, regen (HP/s), atkMul, dmgRed (planet damage cut), energy (start), crit
const PLANETS = [
  { id:'earth',   name:'지구',   en:'Earth',   kind:'earth', hp:2400, slots:3, unlock:0,    trait:{},                 desc:'HP가 높은 기본 행성' },
  { id:'moon',    name:'달',     en:'Moon',    kind:'moon',  hp:2000, slots:4, unlock:600,  trait:{ regen:8 },        desc:'초당 HP 8 회복' },
  { id:'mercury', name:'수성',   en:'Mercury', kind:'rock',  hp:1700, slots:3, unlock:600,  trait:{ rateMul:1.25 },   desc:'공격속도 +25%', look:{ c:['#e8d9c9','#8d7663','#2c2119'], glow:'220,180,140' } },
  { id:'venus',   name:'금성',   en:'Venus',   kind:'gas',   hp:2300, slots:3, unlock:800,  trait:{ dmgRed:.12 },     desc:'행성이 받는 피해 -12%', look:{ c:['#fff0c2','#e0a94a','#5e3a0e'], glow:'255,200,110' } },
  { id:'mars',    name:'화성',   en:'Mars',    kind:'rock',  hp:2100, slots:4, unlock:1000, trait:{ atkMul:1.1 },     desc:'공격력 +10%', look:{ c:['#ffb199','#c2391b','#3d0c05'], glow:'255,90,60' } },
  { id:'jupiter', name:'목성',   en:'Jupiter', kind:'gas',   hp:3400, slots:5, unlock:1500, trait:{ rateMul:.9 },     desc:'HP 최대 · 공격속도 -10%', look:{ c:['#ffe3c4','#c98a52','#4a2610'], glow:'230,160,100', bands:true } },
  { id:'saturn',  name:'토성',   en:'Saturn',  kind:'gas',   hp:2600, slots:4, unlock:1500, trait:{ dmgRed:.2 },      desc:'고리 방어 · 받는 피해 -20%', look:{ c:['#fff2cc','#d9b56a','#5a4214'], glow:'240,210,130', ring:true } },
  { id:'uranus',  name:'천왕성', en:'Uranus',  kind:'gas',   hp:2300, slots:4, unlock:1200, trait:{ energy:3 },       desc:'시작 기력 +3', look:{ c:['#cffcff','#3fb9c9','#0b3a44'], glow:'90,220,230' } },
  { id:'neptune', name:'해왕성', en:'Neptune', kind:'gas',   hp:2300, slots:4, unlock:1200, trait:{ atkMul:1.15 },    desc:'공격력 +15%', look:{ c:['#b9d6ff','#2d57d8','#0a1450'], glow:'80,120,255' } },
  { id:'pluto',   name:'명왕성', en:'Pluto',   kind:'rock',  hp:1500, slots:5, unlock:2000, trait:{ crit:.15 },       desc:'치명타율 +15% · HP 낮음', look:{ c:['#f3e3d6','#a07c6a','#3a2820'], glow:'230,190,170' } },
  { id:'sun',     name:'태양',   en:'Sun',     kind:'sun',   hp:1800, slots:5, unlock:2500, trait:{ rateMul:1.15 },   desc:'공격속도 +15% · 별자리 5' },
];
const PLANET = Object.fromEntries(PLANETS.map(p => [p.id, p]));
const PLANET_MAX_LV = 10, planetHpMul = lv => 1 + .08 * (lv - 1), planetUpCost = lv => 1500 * lv;

/* ---------- Grades (별자리 시트: 커먼 ~ 레전드) ---------- */
const GRADES = [
  { name:'커먼',   en:'COMMON',    col:'#d6dbef', mult:1 },
  { name:'매직',   en:'MAGIC',     col:'#35d6ff', mult:1.1 },
  { name:'레어',   en:'RARE',      col:'#46e07a', mult:1.22 },
  { name:'유니크', en:'UNIQUE',    col:'#ffd23f', mult:1.36 },
  { name:'에픽',   en:'EPIC',      col:'#ff8a2a', mult:1.52 },
  { name:'레전드', en:'LEGEND',    col:'#ff3d8b', mult:1.72 },
];
const GACHA = {
  gold: { name:'골드 뽑기', cur:'dust',  cost:3000, cost10:27000, w:[50, 28, 15, 5, 1.7, .3] },
  paid: { name:'유료 뽑기', cur:'piece', cost:300,  cost10:2700,  w:[0, 0, 55, 28, 13, 4] },
};

/* ---------- Star slots & parts (컨셉 이미지: 별자리 화면) ---------- */
const SLOT = {
  act: { name:'요동치는 별', label:'액티브', col:'#ff5a6e', cur:'dust',  cost:12000, stat:'공격력' },
  pas: { name:'바라보는 별', label:'패시브', col:'#5b8cff', cur:'dust',  cost:12000, stat:'최대 HP' },
  lim: { name:'감추어진 별', label:'한정',   col:'#c35bff', cur:'piece', cost:1200,  stat:'공격속도' },
};
const slotType = (def, i) => i === def.sh.key ? 'lim' : (i % 2 ? 'pas' : 'act');
const PART_BASE = [2, 3, 4.5, 6.5, 9, 12];               // % per grade at +0
const partValue = p => PART_BASE[p.g] * (1 + p.en * .15);
const PART_MAX_EN = 10;
// 강화성공확률 시트: 1~5 100%, 6~7 90%, 7~8 80% …
const enhanceRate = en => en < 5 ? 1 : [.9, .8, .7, .6, .5][en - 5];
const enhanceCost = p => 300 * (p.en + 1) * (p.g + 1);
const SUMMON_COST = 1000, RESUMMON_COST = 800, promoteCost = p => 60 * (p.g + 1);

/* ---------- Economy (필요 화면 시트: 공통) ---------- */
const INCOME = { dust: lv => 90 + lv * 10, piece: () => 1, capHours: 12 };
const CHEST_STEP = 10, CHEST_MAX = 1000;
const accNeed = lv => 100 * lv;
const ZODIAC_DATES = [ // 생일 → 별자리 (별자리 시트 조건 열)
  ['cap', 1, 19], ['aqr', 2, 18], ['psc', 3, 20], ['ari', 4, 19], ['tau', 5, 20], ['gem', 6, 20],
  ['cnc', 7, 22], ['leo', 8, 22], ['vir', 9, 22], ['lib', 10, 22], ['sco', 11, 21], ['sgr', 12, 21], ['cap', 12, 31],
];
function zodiacOf(m, d) { for (const [id, mm, dd] of ZODIAC_DATES) if (m < mm || (m === mm && d <= dd)) return id; return 'cap'; }
const GHOST_NAMES = ['Gesut4565', 'NovaKatze', 'Orbiter77', '별헤는밤', 'Andromeda_J', '은하수산책', 'Halley86', 'ZENITH'];

