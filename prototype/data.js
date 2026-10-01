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
    { id:'cap', tier:'classic', name:'염소', sig:'묵직한 물리탄을 쏴요.', stats:[['atk','단단한 뿔'],['critDmg','급소 찌르기']],
      chain: c3(['뿔 들이받기','stun',{ p:.2, dur:1 }], ['산악 돌파','execute',{ th:.5, mul:1.4 }], ['거인의 일격','nth',{ every:5, mul:3 }]) },
    { id:'cap_nb', tier:'nebula', name:'심연의 뿔', style:'orb', kind:'magic', sig:'심연의 구체로 적을 묶어요.', stats:[['atk','심연의 힘'],['crit','어둠의 눈']],
      chain: c3(['심연 속박','stun',{ p:.25, dur:1.2 }], ['공허의 부식','shred',{ v:12, max:48 }], ['심연 개방','amp',{ mul:1.5 }]) },
    { id:'cap_sn', tier:'supernova', name:'용암 산양', mod:{ hp:1.2 }, sig:'용암 덩어리를 던져 주변까지 태워요.', stats:[['hp','용암 갑각'],['atk','분화']],
      chain: c3(['용암 파편','splash',{ v:.5 }], ['녹이는 열기','execute',{ th:.5, mul:1.5 }], ['화산 폭발','quake',{ every:7, mul:1.6 }]) },
  ],
  aqr: [
    { id:'aqr', tier:'classic', name:'물병', sig:'마법 구체를 쏘고, 마법 공격에 강해요.', stats:[['tMArmor','물의 장막'],['atk','수압']],
      chain: c3(['물결','splash',{ v:.5 }], ['정화의 비','cleanse',{ every:8, heal:.08 }], ['범람','amp',{ mul:1.6 }]) },
    { id:'aqr_nb', tier:'nebula', name:'은하수 물병', sig:'은하수를 흘려 적 사이를 튕겨요.', stats:[['tMArmor','별빛 장막'],['rate','흐르는 별']],
      chain: c3(['은하 물줄기','bounce',{ v:.55 }], ['별비','cleanse',{ every:7, heal:.1 }], ['쏟아지는 은하','extraProj',{ n:1 }]) },
    { id:'aqr_sn', tier:'supernova', name:'증기 폭발', style:'shot', mod:{ atk:1.2 }, sig:'뜨거운 증기탄으로 적을 느리게 해요.', stats:[['atk','고압 증기'],['crit','과열']],
      chain: c3(['끓는 안개','slow',{ v:.3, dur:3 }], ['증기 폭발','splash',{ v:.6 }], ['임계점','nth',{ every:4, mul:2.5 }]) },
  ],
  psc: [
    { id:'psc', tier:'classic', name:'물고기', sig:'강한 마법 구체를 쏴요.', stats:[['atk','심해의 힘'],['rate','유영']],
      chain: c3(['쌍어','extraProj',{ n:1 }], ['심해의 저주','shred',{ v:10, max:40 }], ['회유','bounce',{ v:.6 }]) },
    { id:'psc_nb', tier:'nebula', name:'심해 성어', sig:'독을 품은 심해의 구체를 쏴요.', stats:[['poison','심해 독'],['atk','수압']],
      chain: c3(['심해의 저주','shred',{ v:12, max:48 }], ['해파리 독','applyPoison',{ v:.5 }], ['소용돌이','bounce',{ v:.7 }]) },
    { id:'psc_sn', tier:'supernova', name:'불새 물고기', style:'beam', mod:{ atk:1.25, rate:.85 }, sig:'불꽃 레이저를 뿜어요.', stats:[['critDmg','불꽃 비늘'],['crit','날쌘 지느러미']],
      chain: c3(['불꽃 조준','focus',{ v:.1, max:8 }], ['열선','critDmg',{ v:.6 }], ['관통 불꽃','pierceBeam',{ v:.7 }]) },
  ],
  ari: [
    { id:'ari', tier:'classic', name:'양', sig:'물리 공격에 강한 방어형이에요.', stats:[['tArmor','양털 갑옷'],['hp','두꺼운 털']],
      chain: c3(['황금 양털','teamGuard',{ v:.15 }], ['돌진','counter',{ p:.25 }], ['불굴','revive',{ hp:.4 }]) },
    { id:'ari_nb', tier:'nebula', name:'꿈꾸는 양', style:'orb', kind:'magic', sig:'꿈의 장막으로 행성을 감싸요.', stats:[['tMArmor','꿈의 장막'],['hp','포근한 털']],
      chain: c3(['자장가','teamGuard',{ v:.1 }], ['꿈의 방패','shieldPulse',{ every:12, v:.1 }], ['다시 꾸는 꿈','revive',{ hp:.5 }]) },
    { id:'ari_sn', tier:'supernova', name:'불꽃 뿔 양', mod:{ atk:1.3 }, sig:'맞을수록 뜨거워지는 반격형이에요.', stats:[['atk','달군 뿔'],['tArmor','그을린 털']],
      chain: c3(['불꽃 돌진','counter',{ p:.35 }], ['타오르는 분노','rage',{ max:1 }], ['화염 가시','reflect',{ v:.3 }]) },
  ],
  tau: [
    { id:'tau', tier:'classic', name:'황소', sig:'HP가 가장 높은 탱커예요.', stats:[['hp','강인한 몸'],['pHp','대지의 뿌리']],
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
    { id:'cnc', tier:'classic', name:'게', sig:'단단한 껍질로 버티는 방어형이에요.', stats:[['tArmor','껍질 연마'],['hp','단단한 등딱지']],
      chain: c3(['가시 껍질','reflect',{ v:.25 }], ['집게','slow',{ v:.3, dur:3 }], ['탈피','molt',{ th:.3, dur:3 }]) },
    { id:'cnc_nb', tier:'nebula', name:'달빛 게', style:'orb', kind:'magic', sig:'달빛으로 적의 발을 묶어요.', stats:[['tMArmor','달빛 껍질'],['hp','조수']],
      chain: c3(['밀물','slow',{ v:.4, dur:3 }], ['달의 허물','molt',{ th:.35, dur:4 }], ['조석의 수호','planetGuard',{ v:.1 }]) },
    { id:'cnc_sn', tier:'supernova', name:'용암 집게', mod:{ atk:1.3 }, sig:'뜨거운 집게로 붙잡고 부숴요.', stats:[['atk','달군 집게'],['tArmor','흑요석 껍질']],
      chain: c3(['용암 가시','reflect',{ v:.35 }], ['조이기','stun',{ p:.2, dur:1 }], ['부수기','execute',{ th:.5, mul:1.5 }]) },
  ],
  leo: [
    { id:'leo', tier:'classic', name:'사자', sig:'즉시 명중하는 강한 레이저를 쏴요.', stats:[['atk','맹수의 이빨'],['critDmg','사냥 본능']],
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
    { id:'lib', tier:'classic', name:'천칭', sig:'물리와 마법 모두 버티는 균형형이에요.', stats:[['tEvade','기울어진 저울'],['tMArmor','공정한 법정']],
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
    { id:'oph', tier:'classic', name:'뱀주인', sig:'적 별자리를 무시하고 행성을 바로 공격해요.', stats:[['atk','뱀의 독니'],['rate','치유의 지팡이']],
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
const STYLE_LABEL = { arrow:'화살', shot:'탄환', orb:'구체', beam:'레이저', heal:'회복', poison:'독침', twin:'쌍탄' };
const KIND_LABEL = { phys:'물리', magic:'마법', both:'물리·마법' };
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
const ENHANCE_RATE = [1, 1, 1, 1, 1, .9, .8, .7, .6, .5];             // success rate for +0→+1 … +9→+10
const enhanceRate = en => ENHANCE_RATE[en] ?? .5;
const enhanceCost = p => 300 * (p.en + 1) * (p.g + 1);
const SUMMON_COST = 1000, RESUMMON_COST = 800, promoteCost = p => 60 * (p.g + 1);

/* ---------- Economy (필요 화면 시트: 공통) ---------- */
const INCOME = { dustBase:90, dustPerLv:10, pieceRate:1, capHours:12,
  dust(lv) { return this.dustBase + lv * this.dustPerLv; }, piece() { return this.pieceRate; } };
/* ---------- Arcade wave scaling ---------- */
const WAVE = { planetHp:900, planetGrowth:1.2, statGrowth:1.13, deepFrom:20, deepGrowth:1.03,
  midBossHp:1.8, zoneBossHp:2.6, conHp:.9, conAtk:.8, timer:40 };
const CHEST_STEP = 10, CHEST_MAX = 1000;
// per chest: 성운 스킨 → Star Dust → Star Piece → 별자리 카드 (cumulative bands)
const CHEST_ODDS = { skin:.12, dust:.5, piece:.23, con:.15 };
const accNeed = lv => 100 * lv;
const ZODIAC_DATES = [ // 생일 → 별자리 (별자리 시트 조건 열)
  ['cap', 1, 19], ['aqr', 2, 18], ['psc', 3, 20], ['ari', 4, 19], ['tau', 5, 20], ['gem', 6, 20],
  ['cnc', 7, 22], ['leo', 8, 22], ['vir', 9, 22], ['lib', 10, 22], ['sco', 11, 21], ['sgr', 12, 21], ['cap', 12, 31],
];
function zodiacOf(m, d) { for (const [id, mm, dd] of ZODIAC_DATES) if (m < mm || (m === mm && d <= dd)) return id; return 'cap'; }
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
const AD_CHEST = { first:[8, 14], cd:[45, 90], hp:3, reward:[20, 40], life:40 };
