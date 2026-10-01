/* ==========================================================================
   통계: counts from players/{uid}, daily counters from stats/{yyyy-mm-dd} (KST, written
   by prototype/cloud.js), distributions from leaderboard/{uid}.
   Charts: one series each, single hue, baseline-anchored bars, hover tooltips, plus a table.
   ========================================================================== */
import { collection, getDocs, getCountFromServer, query, where, limit, documentId, Timestamp } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const DAYS = 14;
const kstDay = ms => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);
const KEYS = [['active', '활동'], ['newPlayers', '신규'], ['sessions', '실행'], ['runs', '아케이드'], ['battles', '배틀'], ['gacha', '뽑기'],
  ['ads', '광고 시청'], ['skinBuys', '스킨 구매'], ['mailClaims', '우편 수령'], ['coupons', '쿠폰']];

export function makeStats({ db, ADM, esc, toast, render }) {
  const S = { data: null, loading: false, at: 0 };
  const root = document.getElementById('admin');
  const n = v => (v || 0).toLocaleString('ko-KR');

  async function load() {
    if (S.loading) return;
    S.loading = true; render();
    try {
      const now = Date.now(), players = collection(db, 'players'), cnt = async q => (await getCountFromServer(q)).data().count;
      const todayStart = new Date(kstDay(now) + 'T00:00:00+09:00').getTime();
      const days = Array.from({ length: DAYS }, (_, i) => kstDay(now - (DAYS - 1 - i) * 86400e3));
      const [total, d7, d30, linked, newToday, statSnap, lbSnap] = await Promise.all([
        cnt(players), cnt(query(players, where('updatedAt', '>=', now - 7 * 86400e3))), cnt(query(players, where('updatedAt', '>=', now - 30 * 86400e3))),
        cnt(query(players, where('provider', '==', 'google.com'))), cnt(query(players, where('createdAt', '>=', Timestamp.fromMillis(todayStart)))),
        getDocs(query(collection(db, 'stats'), where(documentId(), '>=', days[0]))),
        getDocs(query(collection(db, 'leaderboard'), limit(2000))),
      ]);
      const byDay = Object.fromEntries(statSnap.docs.map(d => [d.id, d.data()]));
      const lb = lbSnap.docs.map(d => d.data());
      const bucket = (vals, edges) => edges.map(([lo, hi, label]) => ({ label, value: vals.filter(v => v >= lo && v <= hi).length }));
      S.data = { total, d7, d30, linked, newToday, days: days.map(d => ({ day: d, ...(byDay[d] || {}) })),
        wave: bucket(lb.map(x => x.best), [[1, 4, '1–4'], [5, 9, '5–9'], [10, 19, '10–19'], [20, 29, '20–29'], [30, 49, '30–49'], [50, 1e9, '50+']]),
        level: bucket(lb.map(x => x.lv), [[1, 4, '1–4'], [5, 9, '5–9'], [10, 19, '10–19'], [20, 29, '20–29'], [30, 1e9, '30+']]), ranked: lb.length };
      S.at = now;
    } catch (err) { toast(`통계를 불러오지 못했어요 (${err.code || err.message})`); S.data = S.data || null; }
    S.loading = false; render();
  }

  // Single-series bar chart (SVG). Bars: 2px gaps, 4px rounded tops anchored to the baseline; recessive grid; hover tooltip via data-tip.
  function bars(items, { title, unit, labelEvery = 1 }) {
    const W = 640, H = 190, padL = 36, padB = 26, padT = 18, w = W - padL - 8, h = H - padB - padT;
    const max = Math.max(1, ...items.map(d => d.value)), step = niceStep(max), top = Math.ceil(max / step) * step;
    const bw = w / items.length, gap = 2, r = 4;
    const y = v => padT + h - (v / top) * h;
    const grid = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step)
      .map(v => `<line x1="${padL}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" class="st-grid"/><text x="${padL - 6}" y="${y(v) + 4}" class="st-ax" text-anchor="end">${n(v)}</text>`).join('');
    const last = items.length - 1;
    const marks = items.map((d, i) => {
      const bwi = Math.max(1, Math.min(bw - gap, 40)), x = padL + i * bw + (bw - bwi) / 2, yy = y(d.value), hh = padT + h - yy; // thin marks, centred in the column
      const path = hh <= 0 ? '' : hh < r ? `<rect x="${x}" y="${yy}" width="${bwi}" height="${hh}" class="st-bar"/>`
        : `<path d="M${x},${padT + h}V${yy + r}Q${x},${yy} ${x + r},${yy}H${x + bwi - r}Q${x + bwi},${yy} ${x + bwi},${yy + r}V${padT + h}Z" class="st-bar"/>`;
      return `<g class="st-col" data-tip="${esc(d.tip || `${d.label} · ${n(d.value)}${unit}`)}"><rect x="${padL + i * bw}" y="${padT}" width="${bw}" height="${h}" class="st-hit"/>${path}
        ${i % labelEvery === 0 || i === last ? `<text x="${x + bwi / 2}" y="${H - 8}" class="st-ax" text-anchor="middle">${esc(d.label)}</text>` : ''}
        ${i === last && d.value ? `<text x="${x + bwi / 2}" y="${yy - 5}" class="st-val" text-anchor="middle">${n(d.value)}</text>` : ''}</g>`;
    }).join('');
    return `<figure class="st-fig"><figcaption>${title}</figcaption>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}">${grid}<line x1="${padL}" x2="${W - 8}" y1="${padT + h}" y2="${padT + h}" class="st-base"/>${marks}</svg></figure>`;
  }
  function niceStep(max) { const raw = max / 4, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p; return Math.max(1, (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p); }

  // tooltip for every chart in this area
  let tipEl = null;
  root.addEventListener('mousemove', e => {
    if (ADM.area !== 'stats') return;
    const g = e.target.closest('.st-col');
    if (!g) { if (tipEl) tipEl.hidden = true; return; }
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'st-tip'; document.body.appendChild(tipEl); }
    tipEl.textContent = g.dataset.tip; tipEl.hidden = false;
    tipEl.style.left = `${Math.min(innerWidth - tipEl.offsetWidth - 8, e.clientX + 12)}px`; tipEl.style.top = `${e.clientY - 36}px`;
  });
  root.addEventListener('mouseleave', () => { if (tipEl) tipEl.hidden = true; }, true);
  root.addEventListener('click', e => { if (ADM.area === 'stats' && e.target.closest('[data-streload]')) load(); });

  return {
    html() {
      if (!S.data) { if (!S.loading) setTimeout(load); return '<p class="empty">통계를 모으는 중…</p>'; }
      const D = S.data, today = D.days[D.days.length - 1], md = d => d.slice(5).replace('-', '/');
      const tile = (label, value, sub) => `<div class="st-tile"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
      return `<div class="ad-desc"><h2>통계</h2><p>플레이어 DB와 게임이 하루 단위(한국 시간)로 올리는 카운터로 계산해요. 일별 카운터는 이 기능을 배포한 날부터 쌓여요.</p>
          <button class="ghost sm" type="button" data-streload${S.loading ? ' disabled' : ''}>${S.loading ? '불러오는 중…' : '새로고침'}</button></div>
        <div class="st-tiles">
          ${tile('전체 플레이어', n(D.total), `Google 연동 ${D.total ? Math.round(D.linked / D.total * 100) : 0}%`)}
          ${tile('오늘 활동', n(today.active), `실행 ${n(today.sessions)}회`)}
          ${tile('7일 활동', n(D.d7), '최근 7일 저장한 플레이어')}
          ${tile('30일 활동', n(D.d30), '최근 30일 저장한 플레이어')}
          ${tile('오늘 신규', n(Math.max(D.newToday, today.newPlayers || 0)), '닉네임을 정한 플레이어')}
        </div>
        <div class="st-charts">
          ${bars(D.days.map(d => ({ label: md(d.day), value: d.active || 0, tip: `${md(d.day)} · 활동 ${n(d.active)}명` })), { title: '일별 활동 플레이어 (최근 14일)', unit: '명', labelEvery: 2 })}
          ${bars(D.days.map(d => ({ label: md(d.day), value: d.newPlayers || 0, tip: `${md(d.day)} · 신규 ${n(d.newPlayers)}명` })), { title: '일별 신규 플레이어 (최근 14일)', unit: '명', labelEvery: 2 })}
          ${bars(D.wave.map(b => ({ label: b.label, value: b.value, tip: `최고 웨이브 ${b.label} · ${n(b.value)}명` })), { title: `최고 웨이브 분포 (랭킹 등록 ${n(D.ranked)}명)`, unit: '명' })}
          ${bars(D.level.map(b => ({ label: `Lv ${b.label}`, value: b.value, tip: `레벨 ${b.label} · ${n(b.value)}명` })), { title: '계정 레벨 분포 (랭킹 등록 플레이어)', unit: '명' })}
        </div>
        <h3 class="op-h">일별 기록</h3>
        <div class="ad-scroll"><table class="ad-t st-t"><thead><tr><th>날짜</th>${KEYS.map(([, l]) => `<th>${l}</th>`).join('')}<th>평균 도달 웨이브</th></tr></thead><tbody>
          ${[...D.days].reverse().map(d => `<tr><th scope="row">${d.day}</th>${KEYS.map(([k]) => `<td>${n(d[k])}</td>`).join('')}<td>${d.runs ? (d.waves / d.runs).toFixed(1) : '-'}</td></tr>`).join('')}
        </tbody></table></div>
        <p class="ct-desc">Google 애널리틱스를 연결하면 이벤트가 GA에도 같이 기록돼요 (docs/FIREBASE.md 참고). 마지막 갱신 ${new Date(S.at).toLocaleTimeString('ko-KR')}</p>`;
    },
  };
}
