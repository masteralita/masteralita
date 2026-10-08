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
  { id:'sgr', name:'궁수', en:'Sagittarius', stat:'공격속도', role:'atk', kind:'phys', style:'arrow', hp:240, atk:8, rate:2.4, def:10, mdef:10,
    sig:'빠르게 화살을 연사해요.',
    sh: shape([[-.9,.5],[-.5,.1],[-.1,.3],[.2,-.1],[.6,.1],[.5,-.5],[.1,-.6],[-.3,-.3],[.9,-.3]], '0-1 1-2 2-3 3-4 4-5 5-6 6-7 7-1 3-7 4-8', 3) },
  { id:'cap', name:'염소', en:'Capricorn', stat:'물리 공격', role:'atk', kind:'phys', style:'missile', hp:260, atk:24, rate:.9, def:12, mdef:8,
    sig:'점점 빨라지는 유도 미사일을 쏴요.',
    sh: shape([[-.9,-.3],[-.3,-.1],[.3,-.4],[.9,-.5],[.6,.3],[.1,.6],[-.5,.3]], '0-1 1-2 2-3 3-4 4-5 5-6 6-0', 2) },
  { id:'aqr', name:'물병', en:'Aquarius', stat:'마법 방어', role:'def', kind:'magic', style:'drop', hp:300, atk:13, rate:1, def:10, mdef:45,
    sig:'물방울을 포물선으로 던지고, 마법 공격에 강해요.',
    sh: shape([[-.9,-.6],[-.5,-.2],[-.1,-.5],[.2,-.1],[.5,-.4],[.3,.3],[.7,.6],[-.2,.5]], '0-1 1-2 2-3 3-4 3-5 5-6 5-7', 3) },
  { id:'psc', name:'물고기', en:'Pisces', stat:'마법 공격', role:'atk', kind:'magic', style:'curve', hp:230, atk:22, rate:.95, def:8, mdef:15,
    sig:'양쪽으로 휘어 들어가는 유도 레이저를 쏴요.',
    sh: shape([[-.9,-.7],[-.6,-.2],[-.3,.3],[0,.7],[.4,.4],[.8,.2],[.9,.6],[.6,.7]], '0-1 1-2 2-3 3-4 4-5 5-6 6-7 7-5', 3) },
  { id:'ari', name:'양', en:'Aries', stat:'방어력', role:'def', kind:'phys', style:'bullet', hp:300, atk:12, rate:1, def:45, mdef:10,
    sig:'빠른 총알을 쏘는, 물리 공격에 강한 방어형이에요.',
    sh: shape([[-.8,-.3],[-.2,-.5],[.4,-.2],[.8,.4]], '0-1 1-2 2-3', 1) },
  { id:'tau', name:'황소', en:'Taurus', stat:'HP', role:'def', kind:'phys', style:'boulder', hp:520, atk:11, rate:.9, def:15, mdef:15,
    sig:'바위를 던지는, HP가 가장 높은 탱커예요.',
    sh: shape([[-.9,-.7],[-.4,-.2],[0,0],[.3,.2],[.9,-.1],[.2,.6],[-.3,.3]], '0-1 1-2 2-3 3-4 2-6 6-5 3-5', 2) },
  { id:'gem', name:'쌍둥이', en:'Gemini', stat:'물리·마법 공격', role:'atk', kind:'both', style:'twin', hp:240, atk:11, rate:1, def:10, mdef:10,
    sig:'물리탄과 마법탄을 동시에 쏴요.',
    sh: shape([[-.6,-.9],[-.5,-.3],[-.6,.3],[-.8,.8],[.3,-.9],[.4,-.3],[.3,.3],[.5,.8]], '0-1 1-2 2-3 4-5 5-6 6-7 1-5', 0) },
  { id:'cnc', name:'게', en:'Cancer', stat:'물리 방어', role:'def', kind:'phys', style:'bubble', hp:320, atk:12, rate:1, def:40, mdef:12,
    sig:'거품을 뿜고, 단단한 껍질로 버티는 방어형이에요.',
    sh: shape([[0,-.2],[-.5,-.8],[.1,.2],[-.6,.7],[.7,.5]], '0-1 0-2 2-3 2-4', 0) },
  { id:'leo', name:'사자', en:'Leo', stat:'공격력', role:'atk', kind:'phys', style:'beam', hp:260, atk:30, rate:.7, def:14, mdef:10,
    sig:'즉시 명중하는 굵은 직선 레이저를 쏴요.',
    sh: shape([[-.9,.4],[-.3,.3],[.2,.4],[.5,-.1],[.3,-.5],[.6,-.8],[.9,-.5],[-.2,-.1]], '0-1 1-2 2-3 3-4 4-5 5-6 1-7 7-3', 2) },
  { id:'vir', name:'처녀', en:'Virgo', stat:'HP 회복', role:'sup', kind:'magic', style:'heal', hp:250, atk:9, rate:.8, def:10, mdef:18,
    sig:'공격할 때마다 행성과 다친 별자리를 회복해요.',
    sh: shape([[-.9,-.2],[-.4,0],[0,-.3],[.4,-.1],[.8,-.5],[.1,.3],[.4,.8],[-.3,.6]], '0-1 1-2 2-3 3-4 2-5 5-6 5-7', 6) },
  { id:'lib', name:'천칭', en:'Libra', stat:'물리·마법 방어', role:'def', kind:'magic', style:'sword', hp:300, atk:12, rate:1, def:30, mdef:30,
    sig:'날아가는 검을 던지는, 물리와 마법 모두 버티는 균형형이에요.',
    sh: shape([[0,-.8],[-.6,-.1],[.6,-.2],[-.4,.7],[.5,.6]], '0-1 0-2 1-2 1-3 2-4', 0) },
  { id:'sco', name:'전갈', en:'Scorpio', stat:'상태이상 감소', role:'sup', kind:'phys', style:'poison', hp:260, atk:10, rate:1, def:14, mdef:14,
    sig:'독을 걸고, 아군의 기절 시간을 줄여줘요.',
    sh: shape([[-.9,-.8],[-.7,-.4],[-.8,0],[-.4,.1],[0,.2],[.3,.5],[.6,.8],[.9,.5],[.8,.1]], '0-1 1-2 1-3 3-4 4-5 5-6 6-7 7-8', 3) },
];
const SPECIAL = { id:'oph', name:'뱀주인', en:'Ophiuchus', stat:'행성 직접 타격', role:'atk', kind:'magic', style:'serpent', hp:220, atk:18, rate:.6, def:10, mdef:10, special:true,
  sig:'꿈틀대는 뱀 레이저로 적 별자리를 무시하고 행성을 바로 공격해요.',
  sh: shape([[-.5,-.9],[.3,-.8],[.7,0],[.4,.8],[-.3,.8],[-.7,.1],[0,-.1]], '0-1 1-2 2-3 3-4 4-5 5-0 6-0 6-3', 6) };
const ALL_CONS = [...ZODIAC, SPECIAL];
const CON = Object.fromEntries(ALL_CONS.map(c => [c.id, c]));

/* ---------- Perks: stackable stats + sequential awakenings (벤치마킹: 스킬 목록 Lv5→Lv10→…) ---------- */
const STAT = {
  atk:     { v:.15, txt:v => `공격력이 <b>${v*100}%</b> 올라요.` },
  rate:    { v:.12, txt:v => `공격속도가 <b>${v*100}%</b> 빨라져요.` },
  crit:    { v:.12, txt:v => `치명타율이 <b>${Math.round(v*100)}%</b> 올라요.` },
  critDmg: { v:.35, txt:v => `치명타 피해가 <b>${Math.round(v*100)}%</b> 늘어나요.` },
  hp:      { v:.25, txt:v => `최대 HP가 <b>${v*100}%</b> 늘어나요.` },
  heal:    { v:.3,  txt:v => `회복량이 <b>${v*100}%</b> 늘어나요.` },
  poison:  { v:.3,  txt:v => `독 피해가 <b>${v*100}%</b> 늘어나요.` },
  tArmor:  { v:10,  txt:v => `모든 아군 별자리의 물리 방어가 <b>${v}</b> 올라요.` },
  tMArmor: { v:10,  txt:v => `모든 아군 별자리의 마법 방어가 <b>${v}</b> 올라요.` },
  tEvade:  { v:.08, txt:v => `아군 전체의 회피율이 <b>${Math.round(v*100)}%</b> 올라요.` },
  pHp:     { v:.1,  txt:v => `행성 최대 HP가 <b>${v*100}%</b> 늘어나요.` },
};
/* ---------- Skins: each skin swaps a constellation's look, attack style and whole skill set ---------- */
// Awakening effects are shared building blocks; a skin picks three of them with its own numbers.
const pct = v => Math.round(v * 100) + '%';
const FX = {
  multishot:   p => `${p.every}번째 공격마다 다른 적에게 ${p.n}발을 추가로 쏴요.`,
  planetChip:  p => `명중할 때 적 행성에도 피해의 ${pct(p.v)}를 줘요. 별자리가 살아 있어도 적용돼요.`,
  focus:       p => `같은 대상을 연속으로 맞히면 공격력이 ${pct(p.v)}씩 올라요 (최대 +${pct(p.v * p.max)}).`,
  stun:        p => `공격 시 ${pct(p.p)} 확률로 적 별자리를 ${p.dur}초 기절시켜요.`,
  execute:     p => `HP ${pct(p.th)} 이하인 적에게 주는 피해가 ${pct(p.mul - 1)} 늘어요.`,
  nth:         p => `${p.every}번째 공격마다 피해가 ${p.mul}배예요.`,
  splash:      p => `명중하면 주변 적 별자리에게 ${pct(p.v)} 피해가 퍼져요.`,
  cleanse:     p => `${p.every}초마다 아군의 기절과 독을 풀고 HP를 ${pct(p.heal)} 회복해요.`,
  amp:         p => `공격력이 ${pct(p.mul - 1)} 늘어요.`,
  extraProj:   p => `같은 대상에게 투사체를 ${p.n}개 더 쏴요.`,
  shred:       p => `명중할 때마다 대상의 마법 방어가 ${p.v} 줄어요 (최대 -${p.max}).`,
  bounce:      p => `투사체가 명중 후 다른 적에게 한 번 튕겨요 (${pct(p.v)} 피해).`,
  teamGuard:   p => `아군 별자리와 행성이 받는 피해가 ${pct(p.v)} 줄어요.`,
  counter:     p => `피격 시 ${pct(p.p)} 확률로 즉시 반격해요.`,
  revive:      p => `파괴되면 웨이브마다 한 번, HP ${pct(p.hp)}로 되살아나요.`,
  rage:        p => `잃은 HP 비율만큼 공격력이 올라요 (최대 +${pct(p.max)}).`,
  quake:       p => `${p.every}초마다 모든 적 별자리에게 공격력 ${pct(p.mul)} 피해를 줘요.`,
  planetGuard: p => `행성이 받는 피해가 ${pct(p.v)} 줄어요.`,
  echo:        p => `${pct(p.p)} 확률로 한 번 더 공격해요.`,
  critDmg:     p => `치명타 피해가 ${pct(p.v)} 늘어요.`,
  reflect:     p => `받은 피해의 ${pct(p.v)}를 공격자에게 돌려줘요.`,
  slow:        p => `명중한 적의 공격속도를 ${p.dur}초 동안 ${pct(p.v)} 낮춰요.`,
  molt:        p => `HP가 ${pct(p.th)} 아래로 떨어지면 웨이브마다 한 번, ${p.dur}초 무적이 돼요.`,
  roar:        p => `${p.every}초마다 아군 전체 공격력이 ${p.dur}초 동안 ${pct(p.v)} 올라요.`,
  pierceBeam:  p => `레이저가 다른 적 하나를 더 관통해요 (${pct(p.v)} 피해).`,
  energyKill:  p => `적 별자리를 처치하면 기력을 ${p.v} 얻어요.`,
  overheal:    p => `행성 회복량이 넘치면 넘친 만큼 보호막이 생겨요 (최대 HP ${pct(p.cap)}).`,
  nthHeal:     p => `${p.every}번째 회복마다 아군 별자리 전체 HP를 ${pct(p.v)} 회복해요.`,
  lowHpHeal:   p => `행성 HP가 ${pct(p.th)} 이하이면 회복량이 ${p.mul}배예요.`,
  balance:     p => `적 행성의 HP 비율이 내 행성보다 높으면 공격력이 ${pct(p.mul - 1)} 올라요.`,
  pctDmg:      p => `공격이 대상 최대 HP의 ${pct(p.v)}만큼 추가 피해를 줘요.`,
  evadeCounter:p => `아군이 회피할 때마다 즉시 반격해요.`,
  poisonStack: p => `독이 최대 ${p.max}번까지 중첩돼요.`,
  poisonSpread:p => `독에 걸린 적이 파괴되면 가까운 적에게 독이 옮아가요.`,
  poisonBonus: p => `독에 걸린 대상에게 주는 피해가 ${pct(p.mul - 1)} 늘어요.`,
  leech:       p => `준 피해의 ${pct(p.v)}만큼 내 행성 HP를 회복해요.`,
  applyPoison: p => `명중한 ${p.planetOnly ? '적 행성' : '대상'}에 ${p.burn ? '화상' : '독'}을 걸어요 (초당 공격력 ${pct(p.v)}, 4초).`,
  twinBeam:    p => `레이저를 2줄씩 쏴요 (두 번째 ${pct(p.v)} 피해).`,
  shieldPulse: p => `${p.every}초마다 행성에 최대 HP ${pct(p.v)}의 보호막을 씌워요.`,
  energyPulse: p => `${p.every}초마다 기력을 1 얻어요.`,
  meteorCall:  p => `${p.every}초마다 조준한 적에게 유성 ${p.n}개를 떨어뜨려요 (공격력 ${pct(p.mul)}).`,
};
// team-wide effects that apply the moment they are picked
const FX_TEAM = { teamGuard: 'dmgRed', planetGuard: 'planetRed' };

// palette: line = constellation rgb, star = star dot colour, proj = projectile colour
const PAL = {
  classic:   { line:'245,196,81',  star:'#fff1c2', proj:'#ffd76a' },
  nebula:    { line:'170,140,255', star:'#efe3ff', proj:'#b59cff' },
  supernova: { line:'255,120,80',  star:'#ffe0cc', proj:'#ff8a4a' },
  special:   { line:'213,139,255', star:'#f6e3ff', proj:'#d58bff' },
};
// source: how the skin is obtained — free / chest drop only / purchase only (별자리 탭)
const SKIN_TIER = {
  classic:   { name:'기본',   src:'free',  price:0 },
  nebula:    { name:'성운',   src:'chest', price:0 },
  supernova: { name:'스페셜', src:'buy',   price:1200 },
};
const c3 = (a, b, c) => [a, b, c].map(([name, type, p]) => ({ name, type, p }));
const SKINS = {
  sgr: [
    { id:'sgr', tier:'classic', name:'궁수', sig:'빠르게 화살을 연사해요.', stats:[['rate','연사 강화'],['crit','날카로운 촉']],
      chain: c3(['분열 화살','multishot',{ every:3, n:2 }], ['꿰뚫는 화살','planetChip',{ v:.25 }], ['사수의 집중','focus',{ v:.08, max:10 }]) },
    { id:'sgr_nb', tier:'nebula', name:'성운 사냥꾼', style:'orb', kind:'magic', mod:{ atk:1.35, rate:.8 }, sig:'튕기는 성운 구체로 사냥해요.', stats:[['crit','별빛 조준'],['rate','사냥 리듬']],
      chain: c3(['유성 추적','bounce',{ v:.6 }], ['별빛 저주','shred',{ v:10, max:40 }], ['사냥꾼의 표식','execute',{ th:.5, mul:1.5 }]) },
    { id:'sgr_sn', tier:'supernova', name:'불화살 궁수', mod:{ atk:1.1 }, sig:'불붙은 화살로 적을 태워요.', stats:[['atk','화염 촉'],['critDmg','작열']],
      chain: c3(['화염 화살','applyPoison',{ v:.35, burn:true }], ['연쇄 폭발','splash',{ v:.4 }], ['태양 화살','nth',{ every:4, mul:3 }]) },
  ],
  cap: [
    { id:'cap', tier:'classic', name:'염소', sig:'점점 빨라지는 유도 미사일을 쏴요.', stats:[['atk','단단한 뿔'],['critDmg','급소 찌르기']],
      chain: c3(['뿔 들이받기','stun',{ p:.2, dur:1 }], ['산악 돌파','execute',{ th:.5, mul:1.4 }], ['거인의 일격','nth',{ every:5, mul:3 }]) },
    { id:'cap_nb', tier:'nebula', name:'심연의 뿔', style:'orb', kind:'magic', sig:'심연의 구체로 적을 묶어요.', stats:[['atk','심연의 힘'],['crit','어둠의 눈']],
      chain: c3(['심연 속박','stun',{ p:.25, dur:1.2 }], ['공허의 부식','shred',{ v:12, max:48 }], ['심연 개방','amp',{ mul:1.5 }]) },
    { id:'cap_sn', tier:'supernova', name:'용암 산양', mod:{ hp:1.2 }, sig:'용암 덩어리를 던져 주변까지 태워요.', stats:[['hp','용암 갑각'],['atk','분화']],
      chain: c3(['용암 파편','splash',{ v:.5 }], ['녹이는 열기','execute',{ th:.5, mul:1.5 }], ['화산 폭발','quake',{ every:7, mul:1.6 }]) },
  ],
  aqr: [
    { id:'aqr', tier:'classic', name:'물병', sig:'물방울을 포물선으로 던지고, 마법 공격에 강해요.', stats:[['tMArmor','물의 장막'],['atk','수압']],
      chain: c3(['물결','splash',{ v:.5 }], ['정화의 비','cleanse',{ every:8, heal:.08 }], ['범람','amp',{ mul:1.6 }]) },
    { id:'aqr_nb', tier:'nebula', name:'은하수 물병', sig:'은하수를 흘려 적 사이를 튕겨요.', stats:[['tMArmor','별빛 장막'],['rate','흐르는 별']],
      chain: c3(['은하 물줄기','bounce',{ v:.55 }], ['별비','cleanse',{ every:7, heal:.1 }], ['쏟아지는 은하','extraProj',{ n:1 }]) },
    { id:'aqr_sn', tier:'supernova', name:'증기 폭발', style:'shot', mod:{ atk:1.2 }, sig:'뜨거운 증기탄으로 적을 느리게 해요.', stats:[['atk','고압 증기'],['crit','과열']],
      chain: c3(['끓는 안개','slow',{ v:.3, dur:3 }], ['증기 폭발','splash',{ v:.6 }], ['임계점','nth',{ every:4, mul:2.5 }]) },
  ],
  psc: [
    { id:'psc', tier:'classic', name:'물고기', sig:'양쪽으로 휘어 들어가는 유도 레이저를 쏴요.', stats:[['atk','심해의 힘'],['rate','유영']],
      chain: c3(['쌍어','extraProj',{ n:1 }], ['심해의 저주','shred',{ v:10, max:40 }], ['회유','bounce',{ v:.6 }]) },
    { id:'psc_nb', tier:'nebula', name:'심해 성어', sig:'독을 품은 심해의 구체를 쏴요.', stats:[['poison','심해 독'],['atk','수압']],
      chain: c3(['심해의 저주','shred',{ v:12, max:48 }], ['해파리 독','applyPoison',{ v:.5 }], ['소용돌이','bounce',{ v:.7 }]) },
    { id:'psc_sn', tier:'supernova', name:'불새 물고기', style:'beam', mod:{ atk:1.25, rate:.85 }, sig:'불꽃 레이저를 뿜어요.', stats:[['critDmg','불꽃 비늘'],['crit','날쌘 지느러미']],
      chain: c3(['불꽃 조준','focus',{ v:.1, max:8 }], ['열선','critDmg',{ v:.6 }], ['관통 불꽃','pierceBeam',{ v:.7 }]) },
  ],
  ari: [
    { id:'ari', tier:'classic', name:'양', sig:'빠른 총알을 쏘는, 물리 공격에 강한 방어형이에요.', stats:[['tArmor','양털 갑옷'],['hp','두꺼운 털']],
      chain: c3(['황금 양털','teamGuard',{ v:.15 }], ['돌진','counter',{ p:.25 }], ['불굴','revive',{ hp:.4 }]) },
    { id:'ari_nb', tier:'nebula', name:'꿈꾸는 양', style:'orb', kind:'magic', sig:'꿈의 장막으로 행성을 감싸요.', stats:[['tMArmor','꿈의 장막'],['hp','포근한 털']],
      chain: c3(['자장가','teamGuard',{ v:.1 }], ['꿈의 방패','shieldPulse',{ every:12, v:.1 }], ['다시 꾸는 꿈','revive',{ hp:.5 }]) },
    { id:'ari_sn', tier:'supernova', name:'불꽃 뿔 양', mod:{ atk:1.3 }, sig:'맞을수록 뜨거워지는 반격형이에요.', stats:[['atk','달군 뿔'],['tArmor','그을린 털']],
      chain: c3(['불꽃 돌진','counter',{ p:.35 }], ['타오르는 분노','rage',{ max:1 }], ['화염 가시','reflect',{ v:.3 }]) },
  ],
  tau: [
    { id:'tau', tier:'classic', name:'황소', sig:'바위를 던지는, HP가 가장 높은 탱커예요.', stats:[['hp','강인한 몸'],['pHp','대지의 뿌리']],
      chain: c3(['분노의 뿔','rage',{ max:1 }], ['지진','quake',{ every:6, mul:2 }], ['대지의 가호','planetGuard',{ v:.15 }]) },
    { id:'tau_nb', tier:'nebula', name:'플레이아데스', style:'orb', kind:'magic', sig:'일곱 자매 성단이 행성을 지켜요.', stats:[['pHp','성단의 품'],['hp','푸른 별빛']],
      chain: c3(['성단의 가호','planetGuard',{ v:.12 }], ['일곱 자매','cleanse',{ every:10, heal:.1 }], ['성단 방벽','shieldPulse',{ every:10, v:.12 }]) },
    { id:'tau_sn', tier:'supernova', name:'성난 황소', mod:{ atk:1.25, hp:.9 }, sig:'다칠수록 강해지는 돌격형이에요.', stats:[['atk','돌격'],['critDmg','들이받기']],
      chain: c3(['광분','rage',{ max:1.5 }], ['짓밟기','nth',{ every:4, mul:2.5 }], ['대지 붕괴','quake',{ every:5, mul:2.5 }]) },
  ],
  gem: [
    { id:'gem', tier:'classic', name:'쌍둥이', sig:'물리탄과 마법탄을 동시에 쏴요.', stats:[['rate','호흡 맞추기'],['crit','쌍성의 눈']],
      chain: c3(['거울상','echo',{ p:.25 }], ['카스토르','critDmg',{ v:.6 }], ['폴룩스','planetChip',{ v:.3 }]) },
    { id:'gem_nb', tier:'nebula', name:'거울 성운', sig:'거울에 비친 탄이 계속 늘어나요.', stats:[['rate','반사광'],['atk','겹친 별빛']],
      chain: c3(['거울 반사','echo',{ p:.35 }], ['분광','extraProj',{ n:1 }], ['난반사','bounce',{ v:.6 }]) },
    { id:'gem_sn', tier:'supernova', name:'쌍성 폭발', style:'beam', mod:{ atk:1.15 }, sig:'두 별의 레이저를 동시에 쏴요.', stats:[['critDmg','쌍성 공명'],['crit','동기화']],
      chain: c3(['쌍둥이 광선','twinBeam',{ v:.8 }], ['공명','critDmg',{ v:.6 }], ['마무리','execute',{ th:.4, mul:1.6 }]) },
  ],
  cnc: [
    { id:'cnc', tier:'classic', name:'게', sig:'거품을 뿜고, 단단한 껍질로 버티는 방어형이에요.', stats:[['tArmor','껍질 연마'],['hp','단단한 등딱지']],
      chain: c3(['가시 껍질','reflect',{ v:.25 }], ['집게','slow',{ v:.3, dur:3 }], ['탈피','molt',{ th:.3, dur:3 }]) },
    { id:'cnc_nb', tier:'nebula', name:'달빛 게', style:'orb', kind:'magic', sig:'달빛으로 적의 발을 묶어요.', stats:[['tMArmor','달빛 껍질'],['hp','조수']],
      chain: c3(['밀물','slow',{ v:.4, dur:3 }], ['달의 허물','molt',{ th:.35, dur:4 }], ['조석의 수호','planetGuard',{ v:.1 }]) },
    { id:'cnc_sn', tier:'supernova', name:'용암 집게', mod:{ atk:1.3 }, sig:'뜨거운 집게로 붙잡고 부숴요.', stats:[['atk','달군 집게'],['tArmor','흑요석 껍질']],
      chain: c3(['용암 가시','reflect',{ v:.35 }], ['조이기','stun',{ p:.2, dur:1 }], ['부수기','execute',{ th:.5, mul:1.5 }]) },
  ],
  leo: [
    { id:'leo', tier:'classic', name:'사자', sig:'즉시 명중하는 굵은 직선 레이저를 쏴요.', stats:[['atk','맹수의 이빨'],['critDmg','사냥 본능']],
      chain: c3(['포효','roar',{ every:10, dur:4, v:.3 }], ['레굴루스','pierceBeam',{ v:.7 }], ['왕의 위엄','energyKill',{ v:1 }]) },
    { id:'leo_nb', tier:'nebula', name:'별무리 사자', style:'orb', kind:'magic', sig:'별무리를 흩뿌려 무리를 이끌어요.', stats:[['atk','별의 갈기'],['rate','무리 사냥']],
      chain: c3(['별무리 포효','roar',{ every:10, dur:4, v:.25 }], ['흩날리는 별','splash',{ v:.5 }], ['무리의 왕','energyKill',{ v:1 }]) },
    { id:'leo_sn', tier:'supernova', name:'태양 사자', mod:{ atk:1.2 }, sig:'태양 레이저로 전장을 가로질러요.', stats:[['critDmg','태양 갈기'],['atk','열풍']],
      chain: c3(['태양 관통','pierceBeam',{ v:.8 }], ['코로나','nth',{ every:3, mul:2 }], ['태양의 포효','roar',{ every:8, dur:4, v:.35 }]) },
  ],
  vir: [
    { id:'vir', tier:'classic', name:'처녀', sig:'공격할 때마다 행성과 다친 별자리를 회복해요.', stats:[['heal','풍요의 손길'],['rate','수확의 계절']],
      chain: c3(['풍요의 가호','overheal',{ cap:.2 }], ['스피카','nthHeal',{ every:5, v:.12 }], ['정결','lowHpHeal',{ th:.3, mul:2 }]) },
    { id:'vir_nb', tier:'nebula', name:'성운의 성녀', sig:'성운의 장막으로 행성을 감싸요.', stats:[['heal','성운의 축복'],['pHp','품어주는 빛']],
      chain: c3(['성운의 기도','nthHeal',{ every:4, v:.1 }], ['성운 장막','shieldPulse',{ every:10, v:.1 }], ['넘치는 은총','overheal',{ cap:.3 }]) },
    { id:'vir_sn', tier:'supernova', name:'불사조 처녀', mod:{ atk:1.2 }, sig:'위기에 강해지는 불꽃 회복형이에요.', stats:[['heal','재의 온기'],['rate','날갯짓']],
      chain: c3(['불씨','energyPulse',{ every:15 }], ['재에서 피어남','lowHpHeal',{ th:.4, mul:2.5 }], ['불사조의 노래','nthHeal',{ every:3, v:.15 }]) },
  ],
  lib: [
    { id:'lib', tier:'classic', name:'천칭', sig:'날아가는 검을 던지는, 물리와 마법 모두 버티는 균형형이에요.', stats:[['tEvade','기울어진 저울'],['tMArmor','공정한 법정']],
      chain: c3(['저울질','balance',{ mul:1.3 }], ['심판','pctDmg',{ v:.02 }], ['평형','evadeCounter',{}]) },
    { id:'lib_nb', tier:'nebula', name:'성간 저울', sig:'별의 무게로 적을 짓눌러요.', stats:[['tEvade','별의 기울기'],['atk','무게']],
      chain: c3(['중력','pctDmg',{ v:.025 }], ['되갚음','evadeCounter',{}], ['균형의 장막','teamGuard',{ v:.1 }]) },
    { id:'lib_sn', tier:'supernova', name:'심판의 칼', style:'beam', kind:'phys', mod:{ atk:1.3 }, sig:'판결의 레이저를 내려요.', stats:[['critDmg','단죄'],['crit','판결']],
      chain: c3(['역전의 저울','balance',{ mul:1.4 }], ['처형','execute',{ th:.3, mul:2 }], ['최후 판결','critDmg',{ v:.6 }]) },
  ],
  sco: [
    { id:'sco', tier:'classic', name:'전갈', sig:'독을 걸고, 아군의 기절 시간을 줄여줘요.', stats:[['poison','맹독 분비'],['crit','급소 노리기']],
      chain: c3(['맹독','poisonStack',{ max:3 }], ['안타레스','poisonSpread',{}], ['꼬리침','poisonBonus',{ mul:1.4 }]) },
    { id:'sco_nb', tier:'nebula', name:'보라 독침', kind:'magic', sig:'마법 독으로 방어를 녹여요.', stats:[['poison','보랏빛 독'],['atk','독니']],
      chain: c3(['겹겹의 독','poisonStack',{ max:5 }], ['부식','shred',{ v:10, max:40 }], ['독의 절정','poisonBonus',{ mul:1.5 }]) },
    { id:'sco_sn', tier:'supernova', name:'작열 전갈', sig:'화상이 번지며 폭발해요.', stats:[['poison','작열 독'],['critDmg','불꽃 꼬리']],
      chain: c3(['번지는 불','poisonSpread',{}], ['화염 폭발','splash',{ v:.4 }], ['초열 꼬리','nth',{ every:4, mul:3 }]) },
  ],
  oph: [
    { id:'oph', tier:'classic', name:'뱀주인', sig:'꿈틀대는 뱀 레이저로 적 별자리를 무시하고 행성을 바로 공격해요.', stats:[['atk','뱀의 독니'],['rate','치유의 지팡이']],
      chain: c3(['의술','leech',{ v:.1 }], ['독사의 입맞춤','applyPoison',{ v:.4, planetOnly:true }], ['아스클레피오스','twinBeam',{ v:.8 }]) },
    { id:'oph_nb', tier:'nebula', name:'성운 뱀', style:'orb', sig:'성운 독을 행성에 스며들게 해요.', stats:[['poison','성운 독'],['atk','휘감기']],
      chain: c3(['생명 흡수','leech',{ v:.15 }], ['성운 독','applyPoison',{ v:.5, planetOnly:true }], ['탈피하는 뱀','extraProj',{ n:1 }]) },
    { id:'oph_sn', tier:'supernova', name:'신의 의사', mod:{ atk:1.2 }, sig:'하늘의 유성을 불러 행성을 내리쳐요.', stats:[['atk','신의 손'],['critDmg','천벌']],
      chain: c3(['쌍두 뱀','twinBeam',{ v:.8 }], ['유성 소환','meteorCall',{ every:12, n:3, mul:1.2 }], ['천상의 기운','energyPulse',{ every:12 }]) },
  ],
};
const SKIN = Object.fromEntries(Object.values(SKINS).flat().map(s => [s.id, s]));
function prepSkin(s, cid) {
  s.con = cid; s.pal = cid === 'oph' && s.tier === 'classic' ? PAL.special : PAL[s.tier];
  for (const ch of s.chain) ch.desc = FX[ch.type](ch.p);
}
for (const [cid, list] of Object.entries(SKINS)) for (const s of list) prepSkin(s, cid);
const STYLE_LABEL = { arrow:'화살', shot:'탄환', bullet:'총알', missile:'미사일', drop:'물방울', bubble:'거품', boulder:'바위', sword:'날아가는 검',
  curve:'곡선 유도 레이저', orb:'구체', beam:'직선 레이저', serpent:'뱀 레이저', heal:'회복', poison:'독침', twin:'쌍탄' };
const KIND_LABEL = { phys:'물리', magic:'마법', both:'물리·마법' };
// 별자리 타입: 공격형은 물리/마법(속성)으로 나뉘어요. col = 타입 칩 색
const ROLE = { atk:{ name:'공격', col:'#ff6b5a', desc:'적을 쓰러뜨리는 딜러' }, def:{ name:'방어', col:'#4aa8ff', desc:'피해를 버티는 탱커' }, sup:{ name:'보조', col:'#6be08a', desc:'회복·상태이상으로 아군을 돕는' } };
const ROLE_LABEL = Object.fromEntries(Object.entries(ROLE).map(([k, r]) => [k, r.name]));
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
// orbits: how many orbits (1–2) the planet carries; each orbit holds up to 2 constellations, a team 1–3 in total
// trait fields: rateMul, regen (HP/s), atkMul, dmgRed (planet damage cut), energy (start), crit
const PLANETS = [
  { id:'earth',   name:'지구',   en:'Earth',   kind:'earth', hp:2400, orbits:2, unlock:0,    trait:{},                 desc:'HP가 높은 기본 행성' },
  { id:'moon',    name:'달',     en:'Moon',    kind:'moon',  hp:2000, orbits:1, unlock:600,  trait:{ regen:8 },        desc:'초당 HP 8 회복' },
  { id:'mercury', name:'수성',   en:'Mercury', kind:'rock',  hp:1700, orbits:1, unlock:600,  trait:{ rateMul:1.25 },   desc:'공격속도 +25%', look:{ c:['#e8d9c9','#8d7663','#2c2119'], glow:'220,180,140' } },
  { id:'venus',   name:'금성',   en:'Venus',   kind:'gas',   hp:2300, orbits:1, unlock:800,  trait:{ dmgRed:.12 },     desc:'행성이 받는 피해 -12%', look:{ c:['#fff0c2','#e0a94a','#5e3a0e'], glow:'255,200,110' } },
  { id:'mars',    name:'화성',   en:'Mars',    kind:'rock',  hp:2100, orbits:2, unlock:1000, trait:{ atkMul:1.1 },     desc:'공격력 +10%', look:{ c:['#ffb199','#c2391b','#3d0c05'], glow:'255,90,60' } },
  { id:'jupiter', name:'목성',   en:'Jupiter', kind:'gas',   hp:3400, orbits:2, unlock:1500, trait:{ rateMul:.9 },     desc:'HP 최대 · 공격속도 -10%', look:{ c:['#ffe3c4','#c98a52','#4a2610'], glow:'230,160,100', bands:true } },
  { id:'saturn',  name:'토성',   en:'Saturn',  kind:'gas',   hp:2600, orbits:2, unlock:1500, trait:{ dmgRed:.2 },      desc:'고리 방어 · 받는 피해 -20%', look:{ c:['#fff2cc','#d9b56a','#5a4214'], glow:'240,210,130', ring:true } },
  { id:'uranus',  name:'천왕성', en:'Uranus',  kind:'gas',   hp:2300, orbits:2, unlock:1200, trait:{ energy:3 },       desc:'시작 기력 +3', look:{ c:['#cffcff','#3fb9c9','#0b3a44'], glow:'90,220,230' } },
  { id:'neptune', name:'해왕성', en:'Neptune', kind:'gas',   hp:2300, orbits:2, unlock:1200, trait:{ atkMul:1.15 },    desc:'공격력 +15%', look:{ c:['#b9d6ff','#2d57d8','#0a1450'], glow:'80,120,255' } },
  { id:'pluto',   name:'명왕성', en:'Pluto',   kind:'rock',  hp:1500, orbits:1, unlock:2000, trait:{ crit:.15 },       desc:'치명타율 +15% · HP 낮음', look:{ c:['#f3e3d6','#a07c6a','#3a2820'], glow:'230,190,170' } },
  { id:'sun',     name:'태양',   en:'Sun',     kind:'sun',   hp:1800, orbits:2, unlock:2500, trait:{ rateMul:1.15 },   desc:'공격속도 +15%' },
];
const PLANET = Object.fromEntries(PLANETS.map(p => [p.id, p]));
/* ---------- Gauge skills (게이지 스킬): paid with 기력 in battle ---------- */
// Each planet has 1 unique skill (UR, 고유: tied to the planet, the same whatever skin it wears)
// and 2 equip slots for skills drawn in the store (R · SR · SSR · MR), which fit any planet.
// Each skill: { type, name, cost (기력), v (power, fraction), dur (seconds, for timed types) }. Types are implemented in skills.js.
// icon: which of the three skill images (img/sk_*.png) the button shows.
const GSKILL = {
  // 공격계: physical damage (물리 방어로 줄어요)
  meteor:    { cat:'atk',  label:'유성 낙하',   icon:'meteor', desc: s => `조준한 적에게 유성 5개를 떨어뜨려요. 유성 하나가 대상 최대 HP의 ${pct(s.v)}에 기본 물리 피해를 더해 입혀요.` },
  strike:    { cat:'atk',  label:'행성 포격',   icon:'meteor', desc: s => `적 행성에 최대 HP의 ${pct(s.v)}만큼 물리 피해를 바로 입혀요. 적 별자리가 살아 있어도 맞아요.` },
  volley:    { cat:'atk',  label:'연속 사격',   icon:'meteor', desc: s => `행성에서 탄 8발을 무작위 적에게 쏴요. 한 발마다 대상 최대 HP의 ${pct(s.v)}만큼 물리 피해를 입혀요.` },
  execute:   { cat:'atk',  label:'처형',        icon:'meteor', desc: s => `HP 비율이 가장 낮은 적에게 최대 HP의 ${pct(s.v)}만큼 물리 피해를 입혀요. 대상 HP가 30% 이하이면 피해가 2배가 돼요.` },
  // 마법계: magic damage and control (마법 방어로 줄어요)
  blast:     { cat:'mag',  label:'마력 폭발',   icon:'nova',   desc: s => `모든 적에게 최대 HP의 ${pct(s.v)}만큼 마법 피해를 입혀요.` },
  burn:      { cat:'mag',  label:'지속 피해',   icon:'meteor', desc: s => `모든 적이 ${s.dur}초 동안 매초 최대 HP의 ${pct(s.v)}만큼 피해를 입어요.` },
  chain:     { cat:'mag',  label:'연쇄 번개',   icon:'nova',   desc: s => `번개가 적을 차례로 튀며 최대 HP의 ${pct(s.v)}만큼 마법 피해를 입혀요. 튈 때마다 피해가 15%씩 줄고, 대전에서는 마지막에 적 행성도 맞아요.` },
  stun:      { cat:'mag',  label:'전체 기절',   icon:'nova',   desc: s => `모든 적을 ${s.dur}초 동안 기절시켜요.` },
  slow:      { cat:'mag',  label:'전체 둔화',   icon:'nova',   desc: s => `${s.dur}초 동안 모든 적의 공격속도를 ${pct(s.v)} 낮춰요.` },
  expose:    { cat:'mag',  label:'약화 표식',   icon:'nova',   desc: s => `${s.dur}초 동안 적이 받는 피해가 ${pct(s.v)} 늘어나요.` },
  // 버프계: my side gets stronger for a while
  haste:     { cat:'buf',  label:'공속 증가',   icon:'nova',   desc: s => `${s.dur}초 동안 내 별자리의 공격속도를 ${pct(s.v)} 올려요.` },
  rally:     { cat:'buf',  label:'공격력 증가', icon:'nova',   desc: s => `${s.dur}초 동안 내 별자리의 공격력을 ${pct(s.v)} 올려요.` },
  crit:      { cat:'buf',  label:'치명타 증가', icon:'nova',   desc: s => `${s.dur}초 동안 내 별자리의 치명타율을 ${pct(s.v)} 올려요.` },
  critdmg:   { cat:'buf',  label:'치명 피해',   icon:'nova',   desc: s => `${s.dur}초 동안 내 별자리의 치명타 피해를 ${pct(s.v)} 올려요.` },
  shield:    { cat:'buf',  label:'피해 감소',   icon:'shield', desc: s => `${s.dur}초 동안 내 행성과 별자리가 받는 피해를 ${pct(s.v)} 줄여요.` },
  overdrive: { cat:'buf',  label:'총공격',      icon:'nova',   desc: s => `${s.dur}초 동안 내 별자리의 공격력과 공격속도를 ${pct(s.v)} 올려요.` },
  // 치유계: HP back
  heal:      { cat:'heal', label:'회복',        icon:'shield', desc: s => `내 행성과 별자리의 HP를 최대 HP의 ${pct(s.v)}만큼 회복해요.` },
  barrier:   { cat:'heal', label:'행성 보호막', icon:'shield', desc: s => `내 행성에 최대 HP의 ${pct(s.v)}만큼 보호막을 씌워요.` },
  regen:     { cat:'heal', label:'지속 회복',   icon:'shield', desc: s => `${s.dur}초 동안 내 행성과 별자리가 매초 최대 HP의 ${pct(s.v)}씩 회복해요.` },
  revive:    { cat:'heal', label:'부활',        icon:'shield', desc: s => `쓰러진 내 별자리를 모두 최대 HP의 ${pct(s.v)}로 되살려요. 쓰러진 별자리가 없으면 그만큼 회복해요.` },
};
const SKILL_CATS = { atk:{ name:'공격', col:'#ff7a59' }, mag:{ name:'마법', col:'#8f7bff' }, buf:{ name:'버프', col:'#f5c451' }, heal:{ name:'치유', col:'#5fe0a0' } };
// Skill grades, low → high. UR is the planet's unique skill and is not in the draw (UR 뽑기는 추후 업데이트).
const SKILL_GRADES = {
  R:   { name:'희귀',   en:'Rare Rank',            col:'#46a8ff' },
  SR:  { name:'특급',   en:'Special Rank',         col:'#b26bff' },
  SSR: { name:'초특급', en:'Super Special Rank',   col:'#ffb020' },
  UR:  { name:'고유',   en:'Unique Rank',          col:'#ff4d6d' },
  LR:  { name:'전설',   en:'Legend Rank',          col:'#ff7ad9' },
  MR:  { name:'신화',   en:'Mythical Rank',        col:'#7dfff0' },
};
const DRAW_GRADES = ['R', 'SR', 'SSR', 'LR', 'MR'];
const gsk = (type, name, cost, v, dur = 0) => ({ type, name, cost, v, dur });
// Unique (UR) skill per planet: 공격 4 · 마법 3 · 버프 2 · 치유 2
const PLANET_USKILL = {
  earth:   gsk('meteor', '유성우', 4, 0.095),
  mars:    gsk('volley', '화성 포화', 4, 0.076),
  jupiter: gsk('strike', '중력 붕괴', 5, 0.076),
  pluto:   gsk('execute', '저승의 일격', 4, 0.28),
  venus:   gsk('burn', '산성 구름', 4, 0.057, 6.0),
  uranus:  gsk('stun', '자기 폭풍', 4, 0, 1.9),
  sun:     gsk('blast', '태양 플레어', 4, 0.11),
  mercury: gsk('haste', '쾌속 공전', 4, 1.14, 6.0),
  saturn:  gsk('shield', '고리 방패', 3, 0.85, 6.0),
  moon:    gsk('heal', '달빛 치유', 4, 0.19),
  neptune: gsk('regen', '심해의 샘', 4, 0.038, 6.0),
};
for (const p of PLANETS) p.uskill = PLANET_USKILL[p.id];
// Equip skills (장착 스킬), drawn in the store. id → { grade, ...skill }; category comes from the type (GSKILL[type].cat)
const ESKILL = {
  r_meteor:     { grade:'R',   ...gsk('meteor', '유성 파편', 3, 0.05) },
  r_meteor2:    { grade:'R',   ...gsk('meteor', '운석 낙하', 4, 0.068) },
  r_strike:     { grade:'R',   ...gsk('strike', '궤도 사격', 4, 0.04) },
  r_strike2:    { grade:'R',   ...gsk('strike', '위성 저격', 3, 0.028) },
  r_volley:     { grade:'R',   ...gsk('volley', '별똥 연사', 3, 0.04) },
  r_volley2:    { grade:'R',   ...gsk('volley', '파편 산탄', 2, 0.028) },
  r_volley3:    { grade:'R',   ...gsk('volley', '유성 기관포', 4, 0.054) },
  r_exec:       { grade:'R',   ...gsk('execute', '마무리 일격', 3, 0.15) },
  r_exec2:      { grade:'R',   ...gsk('execute', '소행성 망치', 4, 0.2) },
  r_blast:      { grade:'R',   ...gsk('blast', '성운 파동', 3, 0.06) },
  r_blast2:     { grade:'R',   ...gsk('blast', '별빛 파문', 2, 0.042) },
  r_burn:       { grade:'R',   ...gsk('burn', '태양풍', 3, 0.03, 5.0) },
  r_burn2:      { grade:'R',   ...gsk('burn', '잔불 성운', 2, 0.021, 5.0) },
  r_chain:      { grade:'R',   ...gsk('chain', '정전기 사슬', 3, 0.07) },
  r_stun:       { grade:'R',   ...gsk('stun', '섬광', 3, 0, 1) },
  r_slow:       { grade:'R',   ...gsk('slow', '냉기 안개', 2, 0.3, 4.0) },
  r_slow2:      { grade:'R',   ...gsk('slow', '중력 늪', 3, 0.41, 4.0) },
  r_expose:     { grade:'R',   ...gsk('expose', '약점 표식', 2, 0.15, 5.0) },
  r_haste:      { grade:'R',   ...gsk('haste', '초신성 가속', 3, 0.6, 5.0) },
  r_rally:      { grade:'R',   ...gsk('rally', '투지', 3, 0.3, 5.0) },
  r_crit:       { grade:'R',   ...gsk('crit', '조준 보정', 2, 0.15, 5.0) },
  r_critdmg:    { grade:'R',   ...gsk('critdmg', '급소 노리기', 2, 0.4, 5.0) },
  r_shield:     { grade:'R',   ...gsk('shield', '성운 방패', 2, 0.5, 5.0) },
  r_shield2:    { grade:'R',   ...gsk('shield', '먼지 장막', 1, 0.35, 5.0) },
  r_heal:       { grade:'R',   ...gsk('heal', '별빛 치유', 3, 0.1) },
  r_heal2:      { grade:'R',   ...gsk('heal', '위성 응급처치', 2, 0.07) },
  r_barrier:    { grade:'R',   ...gsk('barrier', '얇은 보호막', 2, 0.08) },
  r_barrier2:   { grade:'R',   ...gsk('barrier', '단단한 껍질', 3, 0.11) },
  r_regen:      { grade:'R',   ...gsk('regen', '은하수 샘', 3, 0.02, 5.0) },
  r_revive:     { grade:'R',   ...gsk('revive', '재점화', 3, 0.21) },
  sr_strike:    { grade:'SR',  ...gsk('strike', '궤도 포격', 4, 0.052) },
  sr_strike2:   { grade:'SR',  ...gsk('strike', '중력 해머', 5, 0.07) },
  sr_meteor:    { grade:'SR',  ...gsk('meteor', '유성 소나기', 3, 0.065) },
  sr_volley:    { grade:'SR',  ...gsk('volley', '쌍둥이 포화', 3, 0.052) },
  sr_volley2:   { grade:'SR',  ...gsk('volley', '항성 탄막', 4, 0.07) },
  sr_exec:      { grade:'SR',  ...gsk('execute', '처형자의 별', 3, 0.2) },
  sr_burn:      { grade:'SR',  ...gsk('burn', '화염 폭풍', 3, 0.039, 5.5) },
  sr_stun:      { grade:'SR',  ...gsk('stun', '섬광탄', 3, 0, 1.3) },
  sr_chain:     { grade:'SR',  ...gsk('chain', '번개 성좌', 3, 0.091) },
  sr_blast:     { grade:'SR',  ...gsk('blast', '오로라 폭발', 3, 0.078) },
  sr_expose:    { grade:'SR',  ...gsk('expose', '저주의 성흔', 2, 0.2, 5.5) },
  sr_slow:      { grade:'SR',  ...gsk('slow', '빙하기', 2, 0.39, 4.5) },
  sr_rally:     { grade:'SR',  ...gsk('rally', '전투 함성', 3, 0.39, 5.5) },
  sr_crit:      { grade:'SR',  ...gsk('crit', '예리한 시선', 2, 0.2, 5.5) },
  sr_haste:     { grade:'SR',  ...gsk('haste', '가속 궤도', 3, 0.78, 5.5) },
  sr_critdmg:   { grade:'SR',  ...gsk('critdmg', '치명의 별', 2, 0.52, 5.5) },
  sr_heal:      { grade:'SR',  ...gsk('heal', '성운 치유', 3, 0.13) },
  sr_regen:     { grade:'SR',  ...gsk('regen', '생명의 성운', 3, 0.026, 5.5) },
  sr_barrier:   { grade:'SR',  ...gsk('barrier', '오존 보호막', 2, 0.1) },
  sr_revive:    { grade:'SR',  ...gsk('revive', '불사조 깃털', 4, 0.39) },
  ssr_meteor:   { grade:'SSR', ...gsk('meteor', '유성 폭격', 4, 0.085) },
  ssr_strike:   { grade:'SSR', ...gsk('strike', '혜성 충돌', 5, 0.068) },
  ssr_exec:     { grade:'SSR', ...gsk('execute', '심판의 창', 4, 0.26) },
  ssr_chain:    { grade:'SSR', ...gsk('chain', '뇌신의 사슬', 4, 0.12) },
  ssr_blast:    { grade:'SSR', ...gsk('blast', '초신성 폭발', 4, 0.1) },
  ssr_expose:   { grade:'SSR', ...gsk('expose', '붕괴의 낙인', 3, 0.26, 6.0) },
  ssr_shield:   { grade:'SSR', ...gsk('shield', '은하 방벽', 3, 0.85, 6.0) },
  ssr_haste:    { grade:'SSR', ...gsk('haste', '광속 질주', 4, 1.02, 6.0) },
  ssr_regen:    { grade:'SSR', ...gsk('regen', '별의 요람', 4, 0.034, 6.0) },
  ssr_heal:     { grade:'SSR', ...gsk('heal', '대천사의 가호', 4, 0.17) },
  lr_volley:    { grade:'LR',  ...gsk('volley', '천 개의 별', 4, 0.088) },
  lr_meteor:    { grade:'LR',  ...gsk('meteor', '별똥 대재앙', 4, 0.11) },
  lr_strike:    { grade:'LR',  ...gsk('strike', '행성 파쇄포', 5, 0.088) },
  lr_burn:      { grade:'LR',  ...gsk('burn', '항성 불꽃', 4, 0.066, 6.5) },
  lr_stun:      { grade:'LR',  ...gsk('stun', '사건의 지평선', 4, 0, 2.2) },
  lr_chain:     { grade:'LR',  ...gsk('chain', '펄서 폭풍', 4, 0.15) },
  lr_overdrive: { grade:'LR',  ...gsk('overdrive', '전설의 함성', 5, 0.66, 6.5) },
  lr_critdmg:   { grade:'LR',  ...gsk('critdmg', '별자리의 눈', 3, 0.88, 6.5) },
  lr_revive:    { grade:'LR',  ...gsk('revive', '윤회의 별', 5, 0.66) },
  lr_barrier:   { grade:'LR',  ...gsk('barrier', '다이슨 구체', 3, 0.18) },
  mr_exec:      { grade:'MR',  ...gsk('execute', '신살의 일격', 5, 0.42) },
  mr_meteor:    { grade:'MR',  ...gsk('meteor', '은하 붕괴', 5, 0.14) },
  mr_volley:    { grade:'MR',  ...gsk('volley', '빅뱅 탄막', 5, 0.11) },
  mr_stun:      { grade:'MR',  ...gsk('stun', '시간 정지', 5, 0, 2.8) },
  mr_burn:      { grade:'MR',  ...gsk('burn', '종말의 불꽃', 5, 0.084, 7.0) },
  mr_expose:    { grade:'MR',  ...gsk('expose', '엔트로피', 4, 0.42, 7.0) },
  mr_overdrive: { grade:'MR',  ...gsk('overdrive', '창조주의 의지', 6, 0.84, 7.0) },
  mr_shield:    { grade:'MR',  ...gsk('shield', '절대 영역', 4, 0.85, 7.0) },
  mr_heal:      { grade:'MR',  ...gsk('heal', '창세의 빛', 5, 0.28) },
  mr_regen:     { grade:'MR',  ...gsk('regen', '영원의 샘', 5, 0.056, 7.0) },
};
const STARTER_SKILLS = ['r_shield', 'r_haste']; // every player owns these two from the start
/* ---------- 스킬 레벨: duplicate draws pile up and level an equip skill ----------
   SKILL_LV[i] is the step from Lv i+1 to Lv i+2: need = copies used, step = that level's 구간 배율.
   Power at Lv L = base × (1 + up% × (sum of steps up to L)), where up (레벨당 증가 %) is set per skill.
   Stun has no power number, so its duration grows instead. */
const SKILL_LV = Array.from({ length: 9 }, (_, i) => ({ need: 2 * (i + 1), step: 1 }));
const SKILL_UP = { R:10, SR:12, SSR:14, LR:16, MR:18 }; // default 레벨당 증가 % by grade
for (const k of Object.values(ESKILL)) k.up = SKILL_UP[k.grade];
const SKILL_CAP = { slow:.9, shield:.9 };
const skillMaxLv = () => SKILL_LV.length + 1;
const skillLvMul = (up, lv) => 1 + (up || 0) / 100 * SKILL_LV.slice(0, Math.max(0, lv - 1)).reduce((a, x) => a + (x.step || 0), 0);
function skillAtLv(s, lv) {
  const m = skillLvMul(s.up, lv), o = { ...s, lv };
  if (s.type === 'stun') o.dur = +(s.dur * m).toFixed(1);
  else o.v = +Math.min(SKILL_CAP[s.type] || 99, s.v * m).toFixed(4);
  return o;
}
// 스킬 뽑기 (상점): free = 미네랄 (dust, R~SSR), paid = 별모래 (piece, R~MR); weights per grade, and 미네랄 paid back for a skill already owned
const SKILL_GACHA = {
  free: { name:'미네랄 스킬 뽑기', cur:'dust',  cost:5000, cost10:45000, w:{ R:75, SR:22, SSR:3, LR:0, MR:0 } },
  paid: { name:'별모래 스킬 뽑기', cur:'piece', cost:250,  cost10:2250,  w:{ R:55, SR:28, SSR:12, LR:4, MR:1 } },
  dupe: { R:200, SR:600, SSR:2000, LR:4000, MR:8000 },
};
const SKILL_DRAWS = ['free', 'paid'];
// 뽑기 관리 (관리자): which constellations / skills each draw can give. con: gold · paid, skill: free · paid
const GACHA_POOL = { con: {}, skill: {} };
for (const id of Object.keys(ESKILL)) GACHA_POOL.skill[id] = { free: true, paid: true };
// Effective grade weights of a skill draw: a grade with no skill in the pool can't come up
const skPoolW = (k, w = SKILL_GACHA[k].w, inPool = id => GACHA_POOL.skill[id] && GACHA_POOL.skill[id][k]) =>
  Object.fromEntries(DRAW_GRADES.map(g => [g, Object.keys(ESKILL).some(id => ESKILL[id].grade === g && inPool(id)) ? (w[g] || 0) : 0]));
const skillDesc = s => (GSKILL[s.type] || GSKILL.meteor).desc(s);
/* ---------- Orbits (궤도): belong to the planet, carry their own base stats and skin ---------- */
// A planet with a single orbit gets a stronger orbit to make up for fewer constellations.
const ORBIT_BASE = {
  single: [{ name:'단일 궤도', atk:.18, rate:.12, hp:.12 }],
  dual:   [{ name:'안쪽 궤도', atk:0,   rate:.12, hp:0 },
           { name:'바깥 궤도', atk:.1,  rate:0,   hp:.1 }],
};
const ORBIT_CAP = 2, TEAM_MIN = 1, TEAM_MAX = 3;
const orbitStats = (pid, k) => (PLANET[pid].orbits === 1 ? ORBIT_BASE.single : ORBIT_BASE.dual)[k];
const teamCap = pid => Math.min(TEAM_MAX, PLANET[pid].orbits * ORBIT_CAP);

/* ---------- Planet & orbit skins: bought once, usable on every planet / orbit, each with a small bonus ---------- */
// planet bonus: hp (planet max HP), atk (all constellations), dmgRed (planet damage cut)
// orbit bonus: atk / rate / hp for the constellations riding that orbit
const PLANET_SKINS = [
  { id:'basic',   name:'기본',   price:0,    bonus:{},                    flavor:'행성 본래의 모습이에요.' },
  { id:'aurora',  name:'오로라', price:800,  bonus:{ hp:.06 },            flavor:'극지방의 빛이 행성을 감싸요.', tint:'110,255,210' },
  { id:'eclipse', name:'일식',   price:800,  bonus:{ atk:.05 },           flavor:'붉은 그림자가 드리운 행성이에요.', tint:'255,70,120' },
  { id:'gold',    name:'황금',   price:1200, bonus:{ hp:.05, dmgRed:.05 }, flavor:'황금빛 대기로 뒤덮인 행성이에요.', tint:'255,205,80' },
];
const ORBIT_SKINS = [
  { id:'dash',   name:'기본 점선', price:0,   bonus:{},          flavor:'가장 기본적인 궤도선이에요.' },
  { id:'dust',   name:'별먼지',    price:400, bonus:{ rate:.04 }, flavor:'반짝이는 별먼지가 궤도를 따라 흘러요.' },
  { id:'aurora', name:'오로라 띠', price:400, bonus:{ hp:.06 },   flavor:'빛나는 오로라 띠가 궤도를 감싸요.' },
  { id:'comet',  name:'유성 고리', price:600, bonus:{ atk:.06 },  flavor:'유성 세 개가 궤도를 따라 달려요.' },
];
const OSKIN = Object.fromEntries(ORBIT_SKINS.map(s => [s.id, s]));
const BONUS_TXT = { hp:'HP', atk:'공격력', rate:'공격속도', dmgRed:'받는 피해' };
const bonusLines = (b, who) => Object.entries(b).map(([k, v]) => `${who} ${BONUS_TXT[k]} ${k === 'dmgRed' ? '-' : '+'}${Math.round(v * 100)}%`);
const PSKIN = Object.fromEntries(PLANET_SKINS.map(s => [s.id, s]));

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
  gold: { name:'미네랄 뽑기', cur:'dust',  cost:3000, cost10:27000, w:[50, 28, 15, 5, 1.7, .3] },
  paid: { name:'별모래 뽑기', cur:'piece', cost:300,  cost10:2700,  w:[0, 0, 55, 28, 13, 4] },
};

for (const c of ALL_CONS) GACHA_POOL.con[c.id] = { gold: !c.special, paid: true }; // 뱀주인 only from the 별모래 draw

/* ---------- 상점 상품 (관리자 [상점 관리]에서 바꿀 수 있어요) ----------
   tab: rec 추천 · con 별자리 · skill 스킬 · piece 별모래 / type: always 상시 · banner 배너 (별자리·스킬 탭 위 최대 2개)
   cur: krw (실결제, 프로토타입은 바로 지급) · piece · dust / limit: 계정당 구매 횟수 (0 = 무제한)
   start / end: 노출 기간 'YYYY-MM-DDTHH:mm' (비우면 제한 없음) / reward: { piece, dust, con, grade, skill, ads, pass }
   pass: 패스 일수 (save.passUntil, 다시 사면 남은 기간에 더해져요). 패스 혜택: 전투 2배속 (SPEED) */
const SHOP_TABS = { rec:'추천', con:'별자리', skill:'스킬', piece:'별모래' };
const SHOP_TYPES = { always:'상시', banner:'배너' };
const SHOP_DEFAULT = [
  { id:'pass30', tab:'rec', type:'always', order:0, name:'30일 패스', desc:'30일 동안 전투 2배속 · 패스 혜택은 계속 늘어나요', cur:'krw', price:5500, limit:0, start:'', end:'', reward:{ pass:30 } },
  { id:'noads', tab:'rec', type:'always', order:1, name:'광고 제거', desc:'모든 광고 제거 · 로비 보물 상자와 광고 보상을 광고 없이 바로 받아요', cur:'krw', price:9900, limit:1, start:'', end:'', reward:{ ads:true } },
  { id:'pkg_oph', tab:'con', type:'banner', order:1, name:'특수 별자리 패키지', desc:'뱀주인자리 (에픽) 확정 + 별모래 500', cur:'krw', price:9900, limit:0, start:'', end:'', reward:{ con:'oph', grade:4, piece:500 } },
  ...[[100, 1200], [400, 4900], [1200, 14000], [2700, 29000], [4500, 49000], [9000, 99000]].map(([n, p], i) =>
    ({ id:`piece_${n}`, tab:'piece', type:'always', order:i + 1, name:`별모래 ${n.toLocaleString('ko-KR')}`, desc:'', cur:'krw', price:p, limit:0, start:'', end:'', reward:{ piece:n } })),
];
const SHOP = JSON.parse(JSON.stringify(SHOP_DEFAULT));
// A shop published before the pass existed still gets the 30일 패스 (관리자에서 저장하면 그 뒤로는 관리자 목록 그대로)
const withPassProduct = list => list.some(p => p && p.reward && p.reward.pass > 0) ? list : [...list, JSON.parse(JSON.stringify(SHOP_DEFAULT.find(p => p.id === 'pass30')))];

/* ---------- 전투 배속 ----------
   1배 기본 · 1.5배 = 아케이드 WAVE unlock 클리어 (save.arcClear) · 2배 = 패스 기간 중 (save.passUntil) */
const SPEED = { steps: [1, 1.5, 2], unlockWave: 10 };

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
const ENHANCE_RATE = [1, 1, 1, 1, 1, .9, .8, .7, .6, .5];             // success rate for +0→+1 … +9→+10
const enhanceRate = en => ENHANCE_RATE[en] ?? .5;
const enhanceCost = p => 300 * (p.en + 1) * (p.g + 1);
const SUMMON_COST = 1000, RESUMMON_COST = 800, promoteCost = p => 60 * (p.g + 1);

/* ---------- Economy (필요 화면 시트: 공통) ---------- */
const INCOME = { dustBase:90, dustPerLv:10, pieceRate:1, capHours:12,
  dust(lv) { return this.dustBase + lv * this.dustPerLv; }, piece() { return this.pieceRate; } };
/* ---------- Arcade wave scaling ---------- */
const WAVE = { planetHp:900, planetGrowth:1.2, statGrowth:1.13, deepFrom:20, deepGrowth:1.03,
  midBossHp:1.8, zoneBossHp:2.6, conHp:.9, conAtk:.8, timer:40,
  // 아케이드 몹: base HP (× statGrowth per wave × conHp), ship shot damage (× conAtk), crash damage as a share of my planet's max HP
  rockHp:100, meteorHp:35, shipHp:48, shipAtk:16, rockPct:.06, meteorPct:.035, shipMax:30 };
// 대전 블랙홀: 30초에 열려 매초 양쪽 행성(dmg)과 모든 별자리(conDmg)에 방어를 무시하는 고정 피해
const HOLE = { at:30, dmg:50, conDmg:20, every:1 };
/* ---------- 에너지: 배틀(최대 max)과 아케이드(최대 arcadeMax)가 따로, 한 판마다 cost 소모, regenMin분마다 1 충전 (접속하지 않아도 시간으로 계산) ---------- */
const STAMINA = { max:10, arcadeMax:15, regenMin:60, cost:1 };
/* ---------- 계정 레벨: 판이 끝나면 경험치를 받고, 필요 경험치 = need × 현재 레벨 ----------
   경험치: 아케이드 arcadeXp × 도달 웨이브 · 대전 승리 winXp / 패배 loseXp
   레벨업 보상: 에너지 가득 충전 · 미네랄 dust × 새 레벨 · 별모래 piece, 방치 수입은 레벨마다 INCOME.dustPerLv 증가 */
const ACCOUNT = { need:100, arcadeXp:12, winXp:40, loseXp:15, dust:300, piece:30 };
const CHEST_STEP = 10, CHEST_MAX = 1000;
// per chest: 성운 스킨 → 미네랄 → 별모래 → 별자리 카드 (cumulative bands)
const CHEST_ODDS = { skin:.12, dust:.5, piece:.23, con:.15 };
const accNeed = lv => ACCOUNT.need * lv;
const ZODIAC_DATES = [ // 생일 → 별자리 (별자리 시트 조건 열)
  ['cap', 1, 19], ['aqr', 2, 18], ['psc', 3, 20], ['ari', 4, 19], ['tau', 5, 20], ['gem', 6, 20],
  ['cnc', 7, 22], ['leo', 8, 22], ['vir', 9, 22], ['lib', 10, 22], ['sco', 11, 21], ['sgr', 12, 21], ['cap', 12, 31],
];
function zodiacOf(m, d) { for (const [id, mm, dd] of ZODIAC_DATES) if (m < mm || (m === mm && d <= dd)) return id; return 'cap'; }
/* ---------- Rewards (우편함 · 쿠폰): { type, n, id?, g? } ---------- */
const REWARD_TYPES = { dust:'미네랄', piece:'별모래', chest:'보물 상자 칸', con:'별자리 카드', skin:'스킨' };
function rewardText(r) {
  const n = Math.max(1, r.n | 0);
  if (r.type === 'con') return `${CON[r.id] ? CON[r.id].name + '자리' : '별자리'} ${(GRADES[r.g | 0] || GRADES[0]).name} 카드 ×${n}`;
  if (r.type === 'skin') return `${SKIN[r.id] ? SKIN[r.id].name : '스킨'} 스킨`;
  return `${REWARD_TYPES[r.type] || r.type} ×${n.toLocaleString('ko-KR')}`;
}
const GHOST_NAMES = ['Gesut4565', 'NovaKatze', 'Orbiter77', '별헤는밤', 'Andromeda_J', '은하수산책', 'Halley86', 'ZENITH'];


/* ---------- Ads (per OS) & lobby treasure chest ---------- */
// Unit ids below are Google's public AdMob *test* ids — replace with the real ones before release.
const AD_CONFIG = {
  testMode: true,
  simSeconds: 5,
  ios:     { label:'iOS',     network:'AdMob', rewarded:{ default:'ca-app-pub-3940256099942544/1712485313', lobby_chest:'ca-app-pub-3940256099942544/1712485313' } },
  android: { label:'Android', network:'AdMob', rewarded:{ default:'ca-app-pub-3940256099942544/5224354917', lobby_chest:'ca-app-pub-3940256099942544/5224354917' } },
  web:     { label:'Web',     network:'테스트', rewarded:null },
};
// 로비 낙하 보물상자: falls among the meteors, needs `hp` hits, then opens via rewarded ad (or instantly with the ad pass)
const AD_CHEST = { first:[8, 14], cd:[45, 90], every:300, stay:30, hp:3, reward:[20, 40], life:40 }; // every: 보물 우주선 재등장 (초), stay: 로비에 머무는 시간 (초) · cd는 예전 값 (안 씀)

/* ---------- 퀘스트 (로비 두루마리 버튼) ----------
   일일 6개 · 주간 6개. 모두 완료하면 묶음 보상 (별모래). 리셋 시각은 한국 시간 기준:
   일일 = 매일 resetHour시, 주간 = weekDay 요일 resetHour시 (0 일 · 1 월 … 6 토).
   ev: 진행이 오르는 행동 (app.js questAdd), go: '이동' 버튼이 데려가는 곳 */
const QUEST = {
  resetHour: 0, weekDay: 1, xp: 50, // xp: 항목 하나 완료하면 '보상 받기'로 받는 계정 경험치
  daily: { reward: 50, list: [
    { id:'login',  ev:'login',  n:1, name:'로그인 1회',      go:null },
    { id:'arcade', ev:'arcade', n:1, name:'아케이드 1회',    go:'arcade' },
    { id:'battle', ev:'battle', n:1, name:'배틀 1회',        go:'pvp' },
    { id:'conUp',  ev:'conUp',  n:1, name:'별자리 강화 1회', go:'stars' },
    { id:'plUp',   ev:'plUp',   n:1, name:'행성 강화 1회',   go:'planets' },
    { id:'claim',  ev:'claim',  n:2, name:'자원 수령 2회',   go:'home' },
  ] },
  weekly: { reward: 300, list: [
    { id:'kill',   ev:'kill',   n:1000, name:'적 처치 (아케이드) 1,000회', go:'arcade' },
    { id:'boss',   ev:'boss',   n:10,   name:'보스 처치 (아케이드) 10회',  go:'arcade' },
    { id:'conUp',  ev:'conUp',  n:5,    name:'별자리 강화 5회',            go:'stars' },
    { id:'plUp',   ev:'plUp',   n:5,    name:'행성 강화 5회',              go:'planets' },
    { id:'daily',  ev:'daily',  n:5,    name:'일일퀘스트 완료 5회',        go:'daily' },
    { id:'battle', ev:'battle', n:7,    name:'배틀 7회',                   go:'pvp' },
  ] },
};
