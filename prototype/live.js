/* ==========================================================================
   Live operations, written in the admin site (docs/FIREBASE.md):
     랭킹 leaderboard/{uid} · 우편함 mail/{id} · 공지 notices/{id} · 쿠폰 coupons/{code}
     약관/개인정보/문의 site/legal · 점검 site/status
   Uses the Firebase connection cloud.js opens (CLOUD.fb). Loaded as a module
   after cloud.js; app.js calls window.LIVE.open(name) from the lobby and settings.
   ========================================================================== */
const ready = (ms = 8000) => new Promise(res => {
  const t0 = Date.now();
  const t = () => (window.CLOUD && CLOUD.fb && CLOUD.uid ? res(true) : (window.CLOUD && CLOUD.failed) || Date.now() - t0 > ms ? res(false) : setTimeout(t, 250));
  t();
});
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const day = t => new Date(t).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
const LIVE = window.LIVE = { mail: [], notices: [], legal: null };
const fb = () => CLOUD.fb, D = (...p) => fb().F.doc(fb().db, ...p), C = p => fb().F.collection(fb().db, p);

LIVE.open = async name => {
  if (!await ready()) { toast('서버에 연결되지 않았어요. 잠시 후 다시 시도해 주세요'); return; }
  ({ ranking: openRanking, mailbox: openMailbox, notices: openNotices, coupon: openCoupon,
     terms: () => openDoc('terms', '이용약관'), privacy: () => openDoc('privacy', '개인정보 처리방침') })[name]?.();
};
document.querySelector('.side-icons').addEventListener('click', e => { const b = e.target.closest('[data-live]'); if (b) LIVE.open(b.dataset.live); });

/* ---------- 랭킹: best wave, standard competition ranking (ties share a rank) ---------- */
async function openRanking() {
  openModal('<h3>랭킹 <small>최고 웨이브</small></h3><p class="mtxt">불러오는 중…</p>');
  const { F } = fb(), me = CLOUD.uid, s = window.__save();
  try {
    const snap = await F.getDocs(F.query(C('leaderboard'), F.orderBy('best', 'desc'), F.limit(60)));
    const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() })).filter(r => !r.hidden).slice(0, 50);
    rows.forEach((r, i) => { r.rank = i && r.best === rows[i - 1].best ? rows[i - 1].rank : i + 1; });
    const mine = rows.find(r => r.uid === me);
    let myRank = mine ? mine.rank : null;
    if (!myRank && s.best) myRank = (await F.getCountFromServer(F.query(C('leaderboard'), F.where('best', '>', s.best)))).data().count + 1;
    openModal(`<h3>랭킹 <small>최고 웨이브 · 상위 50명</small></h3>
      <div class="lv-me"><span>${esc(s.name || '나')}</span><span>${s.best ? `<b>${myRank}위</b> · WAVE ${s.best}` : '아케이드 기록이 없어요'}</span></div>
      <ol class="lv-list">${rows.length ? rows.map(r => `<li class="lv-row${r.uid === me ? ' me' : ''}"><span class="rk${r.rank <= 3 ? ' top' : ''}">${r.rank}</span>
        <b>${esc(r.name)}</b><em>WAVE ${r.best}</em><small>Lv ${r.lv}${r.linked ? '' : ' · 게스트'}</small></li>`).join('') : '<li class="mtxt">아직 기록이 없어요. 첫 번째가 되어 보세요!</li>'}</ol>
      <div class="mbtns"><button class="cta sm" data-act="close" type="button">닫기</button></div>`, act => { if (act === 'close') closeModal(); });
  } catch (err) { console.warn('ranking', err); openModal('<h3>랭킹</h3><p class="mtxt">랭킹을 불러오지 못했어요.</p><div class="mbtns"><button class="cta sm" data-act="close" type="button">닫기</button></div>', () => closeModal()); }
}

/* ---------- 우편함: mail to everyone or to this account; claims live in the save ---------- */
async function loadMail() {
  const { F } = fb(), uid = CLOUD.uid, now = Date.now(), s = window.__save();
  const [all, mine] = await Promise.all([
    F.getDocs(F.query(C('mail'), F.where('target', '==', 'all'))),
    F.getDocs(F.query(C('mail'), F.where('uids', 'array-contains', uid))),
  ]);
  const seen = new Map();
  for (const d of [...all.docs, ...mine.docs]) seen.set(d.id, { id: d.id, ...d.data() });
  LIVE.mail = [...seen.values()]
    .filter(m => (!m.expiresAt || m.expiresAt > now) && (m.target !== 'all' || m.includeNew || !s.joinedAt || s.joinedAt <= m.createdAt))
    .sort((a, b) => b.createdAt - a.createdAt);
  updateMailDot();
}
const claimed = id => (window.__save().mailClaimed || []).includes(id);
function updateMailDot() { const el = document.getElementById('mailDot'); if (el) el.hidden = !LIVE.mail.some(m => !claimed(m.id)); }
function markClaimed(ids) { const s = window.__save(); s.mailClaimed = [...(s.mailClaimed || []), ...ids].slice(-500); }
function mailHtml() {
  const open = LIVE.mail.filter(m => !claimed(m.id)).length;
  return `<h3>우편함 <small>${open ? `받지 않은 우편 ${open}개` : '모두 받았어요'}</small></h3>
    <div class="lv-list">${LIVE.mail.length ? LIVE.mail.map(m => { const done = claimed(m.id); return `<article class="mail-row${done ? ' done' : ''}">
      <header><b>${esc(m.title)}</b><small>${m.expiresAt ? `${day(m.expiresAt)}까지` : ''}</small></header>
      ${m.body ? `<p>${esc(m.body)}</p>` : ''}
      <div class="rw">${(m.rewards || []).map(r => `<span>${esc(rewardText(r))}</span>`).join('')}</div>
      ${done ? '<small class="mtxt">받음</small>' : `<button class="cta sm" data-act="claim" data-id="${m.id}" type="button">받기</button>`}
    </article>`; }).join('') : '<p class="mtxt">우편이 없어요.</p>'}</div>
    <div class="mbtns"><button class="ghost" data-act="close" type="button">닫기</button><button class="cta sm" data-act="claimAll" type="button"${open ? '' : ' disabled'}>모두 받기</button></div>`;
}
async function openMailbox() {
  openModal('<h3>우편함</h3><p class="mtxt">불러오는 중…</p>');
  try { await loadMail(); } catch (err) { console.warn('mail', err); }
  const onAct = (act, el) => {
    if (act === 'close') { closeModal(); return; }
    const list = act === 'claimAll' ? LIVE.mail.filter(m => !claimed(m.id)) : act === 'claim' ? LIVE.mail.filter(m => m.id === el.dataset.id && !claimed(m.id)) : [];
    if (!list.length) return;
    markClaimed(list.map(m => m.id));
    grantRewards(list.flatMap(m => m.rewards || []), list.length === 1 ? list[0].title : `우편 ${list.length}개`); // persists
    gwEvent('mail_claim', { n: list.length });
    updateMailDot();
  };
  openModal(mailHtml(), onAct);
}

/* ---------- 공지 ---------- */
async function loadNotices() {
  const { F } = fb(), now = Date.now();
  const snap = await F.getDocs(F.query(C('notices'), F.where('active', '==', true)));
  LIVE.notices = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .filter(n => (!n.startAt || n.startAt <= now) && (!n.endAt || n.endAt > now))
    .sort((a, b) => (b.pinned - a.pinned) || (b.startAt || b.createdAt) - (a.startAt || a.createdAt));
}
function noticeView(n, back) {
  openModal(`<h3>${esc(n.title)}</h3><p class="mtxt">${day(n.startAt || n.createdAt)}</p><div class="doc-body">${esc(n.body)}</div>
    <div class="mbtns">${back ? '<button class="ghost" data-act="back" type="button">목록</button>' : ''}<button class="cta sm" data-act="close" type="button">확인</button></div>`,
  act => { if (act === 'back') openNotices(); else closeModal(); });
}
async function openNotices() {
  try { await loadNotices(); } catch (err) { console.warn('notices', err); }
  openModal(`<h3>공지사항</h3><div class="lv-list">${LIVE.notices.length ? LIVE.notices.map(n => `<button class="notice-row" data-act="view" data-id="${n.id}" type="button">
      <b>${n.pinned ? '<span class="pin">📌</span>' : ''}${esc(n.title)}</b><small>${day(n.startAt || n.createdAt)}</small></button>`).join('') : '<p class="mtxt">공지사항이 없어요.</p>'}</div>
    <div class="mbtns"><button class="cta sm" data-act="close" type="button">닫기</button></div>`,
  (act, el) => { if (act === 'view') noticeView(LIVE.notices.find(n => n.id === el.dataset.id), true); else closeModal(); });
}
// Pop-up notices: once each, the first time the lobby is free after launch
function popupNotices() {
  let seen = []; try { seen = JSON.parse(localStorage.getItem('gw-notice-seen')) || []; } catch {}
  const queue = LIVE.notices.filter(n => n.popup && !seen.includes(n.id));
  const next = () => {
    if (!queue.length) return;
    if (!window.__gw || window.__gw.state !== 'home' || !document.getElementById('modal').hidden) { setTimeout(next, 1500); return; }
    const n = queue.shift(); seen.push(n.id);
    try { localStorage.setItem('gw-notice-seen', JSON.stringify(seen.slice(-200))); } catch {}
    noticeView(n, false);
    const wait = () => (document.getElementById('modal').hidden ? next() : setTimeout(wait, 800)); setTimeout(wait, 800);
  };
  next();
}

/* ---------- 쿠폰: uses +1 and coupons/{code}/redeemed/{uid} in one transaction (the rules enforce once per account) ---------- */
const COUPON_ERR = { notfound: '없는 쿠폰 코드예요', inactive: '사용할 수 없는 쿠폰이에요', expired: '기간이 지난 쿠폰이에요',
  soldout: '선착순 사용이 끝난 쿠폰이에요', used: '이미 사용한 쿠폰이에요' };
function openCoupon() {
  openModal(`<h3>쿠폰 입력</h3><p class="mtxt">받은 쿠폰 코드를 입력하세요. 계정마다 한 번씩 쓸 수 있어요.</p>
    <form class="coupon" id="couponForm"><input id="couponCode" maxlength="24" placeholder="쿠폰 코드" autocomplete="off" aria-label="쿠폰 코드"><button class="cta sm" type="submit">사용</button></form>
    <div class="mbtns"><button class="ghost" data-act="close" type="button">닫기</button></div>`, act => { if (act === 'close') closeModal(); });
  document.getElementById('couponForm').onsubmit = async e => {
    e.preventDefault();
    const code = document.getElementById('couponCode').value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (!code) return;
    const { F, db } = fb(), uid = CLOUD.uid, cref = D('coupons', code), rref = D('coupons', code, 'redeemed', uid);
    try {
      const c = await F.runTransaction(db, async tx => {
        const snap = await tx.get(cref);
        if (!snap.exists()) throw { code: 'notfound' };
        const d = snap.data();
        if (!d.active) throw { code: 'inactive' };
        if (d.expiresAt && d.expiresAt <= Date.now()) throw { code: 'expired' };
        if ((await tx.get(rref)).exists()) throw { code: 'used' };
        if (d.maxUses && d.uses >= d.maxUses) throw { code: 'soldout' };
        tx.update(cref, { uses: d.uses + 1 });
        tx.set(rref, { at: Date.now() });
        return d;
      });
      const s = window.__save(); s.coupons = [...(s.coupons || []), code].slice(-200);
      grantRewards(c.rewards, `쿠폰 ${code}`);
      gwEvent('coupon', { code });
    } catch (err) {
      toast(COUPON_ERR[err.code] || (err.code === 'permission-denied' ? '사용할 수 없는 쿠폰이에요' : '쿠폰을 확인하지 못했어요. 잠시 후 다시 시도해 주세요'));
    }
  };
}

/* ---------- 약관 · 개인정보 처리방침 · 문의 (site/legal) ---------- */
async function loadLegal() {
  if (!LIVE.legal) { const snap = await fb().F.getDoc(D('site', 'legal')); LIVE.legal = snap.exists() ? snap.data() : {}; }
  return LIVE.legal;
}
async function openDoc(key, title) {
  let L = {}; try { L = await loadLegal(); } catch {}
  openModal(`<h3>${title}</h3>${L.updatedAt ? `<p class="mtxt">최종 수정 ${new Date(L.updatedAt).toLocaleDateString('ko-KR')}</p>` : ''}
    <div class="doc-body">${esc(L[key] || '준비 중이에요.')}</div>
    <div class="mbtns"><button class="cta sm" data-act="close" type="button">닫기</button></div>`, () => closeModal());
}
LIVE.contact = async () => {
  if (!await ready()) { toast('서버에 연결되지 않았어요'); return; }
  let L = {}; try { L = await loadLegal(); } catch {}
  const mail = L.contact || '';
  openModal(`<h3>문의하기</h3><p class="mtxt">${mail ? `아래 메일로 문의해 주세요. 닉네임과 계정 ID를 함께 적어 주시면 빨리 도와드릴 수 있어요.<br><b>${esc(mail)}</b>`
      : '문의처를 준비 중이에요.'}</p><p class="mtxt">계정 ID: <code>${esc(CLOUD.uid)}</code></p>
    <div class="mbtns"><button class="ghost" data-act="close" type="button">닫기</button>${mail ? `<a class="cta sm" href="mailto:${esc(mail)}?subject=${encodeURIComponent('[갤럭시워 문의] ' + (window.__save().name || ''))}&body=${encodeURIComponent('\n\n계정 ID: ' + CLOUD.uid)}">메일 보내기</a>` : ''}</div>`,
  () => closeModal());
};

/* ---------- 점검: site/status.maintenance blocks the game (admins see it but can continue) ---------- */
function watchStatus() {
  const { F } = fb();
  let isAdmin = null;
  F.onSnapshot(D('site', 'status'), async snap => {
    const st = snap.exists() ? snap.data() : {};
    let el = document.getElementById('maint');
    if (!st.maintenance) { if (el) el.remove(); return; }
    if (isAdmin === null) isAdmin = await F.getDoc(D('admins', CLOUD.uid)).then(d => d.exists()).catch(() => false);
    if (!el) { el = document.createElement('div'); el.id = 'maint'; el.className = 'maint'; el.setAttribute('role', 'alertdialog'); document.body.appendChild(el); }
    el.innerHTML = `<span class="eyebrow">MAINTENANCE</span><h2>서버 점검 중이에요</h2><p>${esc(st.message || '더 좋은 게임을 위해 점검하고 있어요. 잠시 후 다시 접속해 주세요.')}</p>
      ${st.until ? `<p>예상 종료: ${new Date(st.until).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>` : ''}
      ${isAdmin ? '<button class="ghost sm" type="button" id="maintSkip">관리자 · 계속하기</button>' : ''}`;
    const skip = document.getElementById('maintSkip'); if (skip) skip.onclick = () => el.remove();
  }, () => {});
}

/* ---------- Start ---------- */
(async function start() {
  if (!await ready(20000)) return;
  watchStatus();
  try { await loadNotices(); popupNotices(); } catch (err) { console.warn('notices', err); }
  try { await loadMail(); } catch (err) { console.warn('mail', err); }
  setInterval(() => { if (document.visibilityState === 'visible') loadMail().catch(() => {}); }, 5 * 60e3);
  let uid = CLOUD.uid;
  addEventListener('gw-cloud', () => { if (CLOUD.uid && CLOUD.uid !== uid) { uid = CLOUD.uid; loadMail().catch(() => {}); } }); // switched accounts
})();
