/* ==========================================================================
   운영: 공지사항 (notices) · 우편 (mail) · 쿠폰 (coupons) · 점검 (site/status)
   The game reads these in prototype/live.js; access rules are in firestore.rules.
   ========================================================================== */
import { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

const TABS = [['notices', '공지사항'], ['mail', '우편 발송'], ['coupons', '쿠폰'], ['status', '점검']];
const DAY = 86400e3;
// <input type="datetime-local"> ↔ ms (local time)
const toLocal = ms => { if (!ms) return ''; const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60e3); return d.toISOString().slice(0, 16); };
const fromLocal = v => (v ? new Date(v).getTime() : 0);

export function makeOps({ db, ADM, esc, toast, confirmBox, render, fmtTime }) {
  const O = { tab: 'notices', notices: null, mails: null, coupons: null, status: null, form: null, picker: { q: '', list: null } };
  const root = document.getElementById('admin');
  const by = () => ADM.user.email || ADM.user.uid;
  const opt = (v, label, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`;
  const chk = (f, on, label) => `<label class="op-chk"><input type="checkbox" data-f="${f}"${on ? ' checked' : ''}> ${label}</label>`;
  const field = (label, inner, wide) => `<label class="ct-f${wide ? ' wide' : ''}"><span>${label}</span>${inner}</label>`;

  /* ---------- Loading ---------- */
  async function load(what) {
    try {
      if (what === 'notices') O.notices = (await getDocs(query(collection(db, 'notices'), orderBy('createdAt', 'desc'), limit(100)))).docs.map(d => ({ id: d.id, ...d.data() }));
      if (what === 'mail') O.mails = (await getDocs(query(collection(db, 'mail'), orderBy('createdAt', 'desc'), limit(50)))).docs.map(d => ({ id: d.id, ...d.data() }));
      if (what === 'coupons') O.coupons = (await getDocs(query(collection(db, 'coupons'), orderBy('createdAt', 'desc'), limit(100)))).docs.map(d => ({ id: d.id, ...d.data() }));
      if (what === 'status') { const s = await getDoc(doc(db, 'site', 'status')); O.status = s.exists() ? s.data() : { maintenance: false, message: '', until: 0 }; }
    } catch (err) {
      toast(`불러오지 못했어요 (${err.code || err.message})`);
      if (what === 'status') O.status = { maintenance: false, message: '', until: 0 }; else O[what === 'mail' ? 'mails' : what] = [];
    }
    render();
  }
  const loaded = what => O[what === 'mail' ? 'mails' : what] !== null;

  /* ---------- Rewards editor (mail + coupons) ---------- */
  function rewardRows(list) {
    return `<div class="rw-ed">${list.map((r, i) => `<div class="rw-row">
      <select data-rw="${i}|type">${Object.entries(REWARD_TYPES).map(([k, l]) => opt(k, l, r.type)).join('')}</select>
      ${r.type === 'con' ? `<select data-rw="${i}|id">${ALL_CONS.map(c => opt(c.id, `${c.name}자리`, r.id)).join('')}</select>
        <select data-rw="${i}|g">${GRADES.map((g, gi) => opt(gi, g.name, r.g | 0)).join('')}</select>` : ''}
      ${r.type === 'skin' ? `<select data-rw="${i}|id">${Object.values(SKIN).filter(s => s.tier !== 'classic').map(s => opt(s.id, `${s.name} (${CON[s.con].name} · ${SKIN_TIER[s.tier].name})`, r.id)).join('')}</select>` : ''}
      ${r.type === 'skin' ? '' : `<label class="rw-n">×<input type="number" min="1" step="1" data-rw="${i}|n" value="${r.n}"></label>`}
      <button class="ghost sm" type="button" data-rwdel="${i}" aria-label="보상 삭제">삭제</button></div>`).join('')}
      <button class="ghost sm" type="button" data-rwadd>+ 보상 추가</button></div>`;
  }
  function newReward(type = 'piece') {
    if (type === 'con') return { type, id: ZODIAC[0].id, g: 2, n: 1 };
    if (type === 'skin') return { type, id: Object.values(SKIN).find(s => s.tier !== 'classic').id, n: 1 };
    return { type, n: type === 'dust' ? 10000 : type === 'chest' ? 10 : 100 };
  }
  const cleanRewards = list => list.map(r => r.type === 'con' ? { type: 'con', id: r.id, g: r.g | 0, n: Math.max(1, r.n | 0) }
    : r.type === 'skin' ? { type: 'skin', id: r.id, n: 1 } : { type: r.type, n: Math.max(1, r.n | 0) });

  /* ---------- Views ---------- */
  function noticesHtml() {
    const f = O.form && O.form.kind === 'notice' ? O.form : null;
    const now = Date.now(), state = n => !n.active ? '<span class="ad-chip">숨김</span>' : n.startAt > now ? '<span class="ad-chip gold">예약</span>'
      : n.endAt && n.endAt <= now ? '<span class="ad-chip">종료</span>' : '<span class="ad-chip ok">게시 중</span>';
    return `<div class="ad-desc"><h2>공지사항</h2><p>게임의 [공지] 버튼과 설정 → 공지사항에 보여요. "팝업"을 켜면 로비에 들어올 때 한 번 띄워요.</p>
      <button class="cta sm" type="button" data-op="newNotice">+ 새 공지</button></div>
      ${f ? `<form class="op-card" data-form="notice"><h3>${f.id ? '공지 수정' : '새 공지'}</h3><div class="ct-grid">
        ${field('제목', `<input type="text" data-f="title" value="${esc(f.title)}" maxlength="80">`, true)}
        ${field('내용', `<textarea data-f="body" rows="8">${esc(f.body)}</textarea>`, true)}
        ${field('게시 시작', `<input type="datetime-local" data-f="startAt" data-t="time" value="${toLocal(f.startAt)}">`)}
        ${field('게시 종료 (비우면 계속)', `<input type="datetime-local" data-f="endAt" data-t="time" value="${toLocal(f.endAt)}">`)}
        </div><div class="op-chks">${chk('active', f.active, '게시')}${chk('pinned', f.pinned, '상단 고정')}${chk('popup', f.popup, '로비 팝업')}</div>
        <div class="op-btns"><button class="ghost sm" type="button" data-op="cancel">취소</button><button class="cta sm" type="submit">${f.id ? '저장' : '등록'}</button></div></form>` : ''}
      ${!loaded('notices') ? '<p class="empty">불러오는 중…</p>' : !O.notices.length ? '<p class="empty">공지가 없어요.</p>' : `<div class="ad-scroll"><table class="ad-t op-t"><thead><tr><th>제목</th><th>상태</th><th>기간</th><th>표시</th><th>작성</th><th></th></tr></thead><tbody>
        ${O.notices.map(n => `<tr><th scope="row">${esc(n.title)}</th><td>${state(n)}</td><td>${fmtTime(n.startAt)}${n.endAt ? ` ~ ${fmtTime(n.endAt)}` : ' ~'}</td>
          <td>${[n.pinned && '고정', n.popup && '팝업'].filter(Boolean).join(' · ') || '-'}</td><td>${esc(n.by || '')}</td>
          <td class="op-acts"><button class="ghost sm" type="button" data-op="editNotice" data-id="${n.id}">수정</button><button class="ghost sm" type="button" data-op="delNotice" data-id="${n.id}">삭제</button></td></tr>`).join('')}
        </tbody></table></div>`}`;
  }
  function pickerHtml(f) {
    const P = O.picker, list = Array.isArray(P.list) ? P.list : [];
    return `<div class="op-pick">
      <div class="pl-search"><input type="search" data-pq value="${esc(P.q)}" placeholder="닉네임 정확히 (비우면 최근 접속 30명)"><button class="ghost sm" type="button" data-op="pickSearch">찾기</button></div>
      ${P.list === 'loading' ? '<p class="empty">찾는 중…</p>' : P.list === null ? '' : !list.length ? '<p class="empty">찾지 못했어요.</p>' : `<div class="op-results">${list.map(p => `<label class="op-res">
        <input type="checkbox" data-pick="${p.uid}" data-name="${esc(p.name)}"${f.uids.includes(p.uid) ? ' checked' : ''}> <b>${esc(p.name)}</b> <small>Lv ${p.lv} · ${p.provider === 'google.com' ? 'Google' : '게스트'} · ${fmtTime(p.updatedAt)}</small></label>`).join('')}</div>`}
      ${field('UID 직접 입력 (쉼표·줄바꿈으로 여러 개)', `<textarea data-f="uidText" rows="2" placeholder="예) qxH1RW7Uw2g0l0JM4M57PGY7hGq1"></textarea>`, true)}
      <div class="op-sel"><span>받는 사람 ${f.uids.length}명</span>${f.uids.map(u => `<span class="op-tag">${esc(f.names[u] || u.slice(0, 8) + '…')}<button type="button" data-unpick="${u}" aria-label="빼기">×</button></span>`).join('')}</div>
    </div>`;
  }
  function mailHtml() {
    const f = O.form && O.form.kind === 'mail' ? O.form : null;
    return `<div class="ad-desc"><h2>우편 발송</h2><p>보낸 우편은 게임의 [우편함]에 나타나고, 플레이어가 [받기]를 눌러 보상을 받아요. 만료되면 사라져요.</p>
      <button class="cta sm" type="button" data-op="newMail">+ 우편 쓰기</button></div>
      ${f ? `<form class="op-card" data-form="mail"><h3>우편 쓰기</h3><div class="ct-grid">
        ${field('제목', `<input type="text" data-f="title" value="${esc(f.title)}" maxlength="60">`, true)}
        ${field('내용', `<textarea data-f="body" rows="4">${esc(f.body)}</textarea>`, true)}
        ${field('만료', `<input type="datetime-local" data-f="expiresAt" data-t="time" value="${toLocal(f.expiresAt)}">`)}
        </div>
        <h4>받는 사람</h4>
        <div class="op-chks"><label class="op-chk"><input type="radio" name="target" data-f="target" value="all"${f.target === 'all' ? ' checked' : ''}> 전체 플레이어</label>
          <label class="op-chk"><input type="radio" name="target" data-f="target" value="some"${f.target === 'some' ? ' checked' : ''}> 선택한 플레이어</label></div>
        ${f.target === 'all' ? `<div class="op-chks">${chk('includeNew', f.includeNew, '발송 후 가입한 플레이어도 받기 (예: 오픈 기념 선물)')}</div>` : pickerHtml(f)}
        <h4>보상</h4>${rewardRows(f.rewards)}
        <div class="op-btns"><button class="ghost sm" type="button" data-op="cancel">취소</button><button class="cta sm" type="submit">발송</button></div></form>` : ''}
      <h3 class="op-h">보낸 우편</h3>
      ${!loaded('mail') ? '<p class="empty">불러오는 중…</p>' : !O.mails.length ? '<p class="empty">보낸 우편이 없어요.</p>' : `<div class="ad-scroll"><table class="ad-t op-t"><thead><tr><th>제목</th><th>대상</th><th>보상</th><th>보낸 시각</th><th>만료</th><th>보낸 사람</th><th></th></tr></thead><tbody>
        ${O.mails.map(m => `<tr><th scope="row">${esc(m.title)}</th><td>${m.target === 'all' ? `전체${m.includeNew ? ' (신규 포함)' : ''}` : `${(m.uids || []).length}명`}</td>
          <td class="note">${(m.rewards || []).map(r => esc(rewardText(r))).join(', ')}</td><td>${fmtTime(m.createdAt)}</td>
          <td>${m.expiresAt ? (m.expiresAt < Date.now() ? '<span class="ad-chip">만료</span>' : fmtTime(m.expiresAt)) : '-'}</td><td>${esc(m.by || '')}</td>
          <td class="op-acts"><button class="ghost sm" type="button" data-op="delMail" data-id="${m.id}">회수</button></td></tr>`).join('')}
        </tbody></table></div>`}`;
  }
  function couponsHtml() {
    const f = O.form && O.form.kind === 'coupon' ? O.form : null;
    return `<div class="ad-desc"><h2>쿠폰</h2><p>플레이어가 설정 → 쿠폰 입력에 코드를 넣으면 보상을 받아요. 계정마다 한 번만 쓸 수 있어요 (서버 규칙으로 막아요).</p>
      <button class="cta sm" type="button" data-op="newCoupon">+ 쿠폰 만들기</button></div>
      ${f ? `<form class="op-card" data-form="coupon"><h3>쿠폰 만들기</h3><div class="ct-grid">
        ${field('코드 (영문 대문자·숫자)', `<span class="op-inline"><input type="text" data-f="code" value="${esc(f.code)}" maxlength="24"><button class="ghost sm" type="button" data-op="genCode">자동 생성</button></span>`)}
        ${field('사용 가능 횟수 (0 = 무제한)', `<input type="number" min="0" step="1" data-f="maxUses" data-t="int" value="${f.maxUses}">`)}
        ${field('만료 (비우면 무기한)', `<input type="datetime-local" data-f="expiresAt" data-t="time" value="${toLocal(f.expiresAt)}">`)}
        ${field('메모 (관리자만 보임)', `<input type="text" data-f="note" value="${esc(f.note)}" maxlength="80">`, true)}
        </div><h4>보상</h4>${rewardRows(f.rewards)}
        <div class="op-btns"><button class="ghost sm" type="button" data-op="cancel">취소</button><button class="cta sm" type="submit">만들기</button></div></form>` : ''}
      ${!loaded('coupons') ? '<p class="empty">불러오는 중…</p>' : !O.coupons.length ? '<p class="empty">쿠폰이 없어요.</p>' : `<div class="ad-scroll"><table class="ad-t op-t"><thead><tr><th>코드</th><th>상태</th><th>사용</th><th>보상</th><th>만료</th><th>메모</th><th></th></tr></thead><tbody>
        ${O.coupons.map(c => { const exp = c.expiresAt && c.expiresAt < Date.now(), out = c.maxUses && c.uses >= c.maxUses;
          return `<tr><th scope="row"><code class="op-code">${esc(c.id)}</code></th>
          <td>${!c.active ? '<span class="ad-chip">중지</span>' : exp ? '<span class="ad-chip">만료</span>' : out ? '<span class="ad-chip">소진</span>' : '<span class="ad-chip ok">사용 가능</span>'}</td>
          <td>${c.uses}${c.maxUses ? ` / ${c.maxUses}` : ' / 무제한'}</td><td class="note">${(c.rewards || []).map(r => esc(rewardText(r))).join(', ')}</td>
          <td>${c.expiresAt ? fmtTime(c.expiresAt) : '무기한'}</td><td class="note">${esc(c.note || '')}</td>
          <td class="op-acts"><button class="ghost sm" type="button" data-op="toggleCoupon" data-id="${c.id}">${c.active ? '중지' : '재개'}</button><button class="ghost sm" type="button" data-op="delCoupon" data-id="${c.id}">삭제</button></td></tr>`; }).join('')}
        </tbody></table></div>`}`;
  }
  function statusHtml() {
    if (!loaded('status')) return '<p class="empty">불러오는 중…</p>';
    const f = O.form && O.form.kind === 'status' ? O.form : (O.form = { kind: 'status', ...O.status });
    return `<div class="ad-desc"><h2>점검</h2><p>점검을 켜면 게임 화면이 점검 안내로 바로 가려져요 (관리자 계정은 [계속하기]로 들어갈 수 있어요).</p></div>
      <form class="op-card" data-form="status">
        <div class="op-chks">${chk('maintenance', f.maintenance, '<b>점검 중</b> (켜면 바로 적용)')}</div>
        <div class="ct-grid">${field('안내 문구', `<textarea data-f="message" rows="3" placeholder="더 좋은 게임을 위해 점검하고 있어요.">${esc(f.message || '')}</textarea>`, true)}
        ${field('예상 종료 (선택)', `<input type="datetime-local" data-f="until" data-t="time" value="${toLocal(f.until)}">`)}</div>
        <p class="ct-desc">현재: ${O.status.maintenance ? '<span class="ad-chip warn">점검 중</span>' : '<span class="ad-chip ok">정상 운영</span>'}${O.status.updatedAt ? ` · ${fmtTime(O.status.updatedAt)} ${esc(O.status.by || '')}` : ''}</p>
        <div class="op-btns"><button class="cta sm" type="submit">저장</button></div></form>`;
  }

  /* ---------- Events ---------- */
  const setPath = (f, k, v) => { f[k] = v; };
  root.addEventListener('input', e => {
    if (ADM.area !== 'ops' || !O.form) return;
    const el = e.target;
    if (el.dataset.f && el.type !== 'checkbox' && el.type !== 'radio') {
      if (el.dataset.f === 'uidText') return; // parsed on change
      setPath(O.form, el.dataset.f, el.dataset.t === 'time' ? fromLocal(el.value) : el.dataset.t === 'int' ? Math.max(0, Math.round(+el.value || 0)) : el.value);
    }
    if (el.dataset.pq !== undefined) O.picker.q = el.value;
    if (el.dataset.rw && el.tagName === 'INPUT') { const [i, k] = el.dataset.rw.split('|'); O.form.rewards[+i][k] = Math.max(1, Math.round(+el.value || 1)); }
  });
  root.addEventListener('change', e => {
    if (ADM.area !== 'ops' || !O.form) return;
    const el = e.target, f = O.form;
    if (el.type === 'checkbox' && el.dataset.f) { f[el.dataset.f] = el.checked; if (f.kind === 'status') return; }
    else if (el.type === 'radio' && el.dataset.f) { f[el.dataset.f] = el.value; render(); }
    else if (el.dataset.f === 'uidText') {
      const add = el.value.split(/[\s,]+/).map(x => x.trim()).filter(x => /^[A-Za-z0-9_-]{6,128}$/.test(x));
      f.uids = [...new Set([...f.uids, ...add])]; el.value = ''; render();
    }
    else if (el.dataset.pick) { const u = el.dataset.pick; if (el.checked) { f.uids = [...new Set([...f.uids, u])]; f.names[u] = el.dataset.name; } else f.uids = f.uids.filter(x => x !== u); render(); }
    else if (el.dataset.rw && el.tagName === 'SELECT') {
      const [i, k] = el.dataset.rw.split('|');
      if (k === 'type') f.rewards[+i] = newReward(el.value); else f.rewards[+i][k] = k === 'g' ? +el.value : el.value;
      render();
    }
  });
  root.addEventListener('click', async e => {
    if (ADM.area !== 'ops') return;
    const t = e.target.closest('[data-optab]'); if (t) { O.tab = t.dataset.optab; O.form = null; O[O.tab === 'mail' ? 'mails' : O.tab] = null; render(); return; } // reload on every visit
    const ra = e.target.closest('[data-rwadd]'); if (ra) { O.form.rewards.push(newReward()); render(); return; }
    const rd = e.target.closest('[data-rwdel]'); if (rd) { O.form.rewards.splice(+rd.dataset.rwdel, 1); render(); return; }
    const up = e.target.closest('[data-unpick]'); if (up) { O.form.uids = O.form.uids.filter(x => x !== up.dataset.unpick); render(); return; }
    const b = e.target.closest('[data-op]'); if (!b) return;
    const op = b.dataset.op, id = b.dataset.id;
    if (op === 'cancel') { O.form = null; render(); }
    else if (op === 'newNotice') { O.form = { kind: 'notice', title: '', body: '', active: true, pinned: false, popup: false, startAt: Date.now(), endAt: 0 }; render(); }
    else if (op === 'editNotice') { const n = O.notices.find(x => x.id === id); O.form = { kind: 'notice', ...n }; render(); }
    else if (op === 'delNotice') { if (await confirmBox('공지 삭제', '이 공지를 지워요. 게임에서도 바로 사라져요.', '삭제')) { await deleteDoc(doc(db, 'notices', id)).catch(err => toast(err.code)); load('notices'); } }
    else if (op === 'newMail') { O.form = { kind: 'mail', title: '', body: '', target: 'all', includeNew: false, uids: [], names: {}, rewards: [newReward('piece')], expiresAt: Date.now() + 30 * DAY }; render(); }
    else if (op === 'delMail') { if (await confirmBox('우편 회수', '이 우편을 지워요. 아직 받지 않은 플레이어의 우편함에서 사라져요. 이미 받은 보상은 그대로예요.', '회수')) { await deleteDoc(doc(db, 'mail', id)).catch(err => toast(err.code)); load('mail'); } }
    else if (op === 'pickSearch') {
      O.picker.list = 'loading'; render();
      const q = O.picker.q.trim(), col = collection(db, 'players');
      try { O.picker.list = (await getDocs(q ? query(col, where('name', '==', q), limit(30)) : query(col, orderBy('updatedAt', 'desc'), limit(30)))).docs.map(d => ({ uid: d.id, ...d.data() })); }
      catch (err) { O.picker.list = []; toast(err.code || err.message); }
      render();
    }
    else if (op === 'newCoupon') { O.form = { kind: 'coupon', code: genCode(), maxUses: 0, expiresAt: Date.now() + 30 * DAY, note: '', rewards: [newReward('piece')] }; render(); }
    else if (op === 'genCode') { O.form.code = genCode(); render(); }
    else if (op === 'toggleCoupon') { const c = O.coupons.find(x => x.id === id); await updateDoc(doc(db, 'coupons', id), { active: !c.active }).catch(err => toast(err.code)); load('coupons'); }
    else if (op === 'delCoupon') { if (await confirmBox('쿠폰 삭제', `${esc(id)} 쿠폰을 지워요. 더 이상 쓸 수 없어요.`, '삭제')) { await deleteDoc(doc(db, 'coupons', id)).catch(err => toast(err.code)); load('coupons'); } }
  });
  const genCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), b => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('');
  root.addEventListener('submit', async e => {
    const form = e.target.closest('[data-form]'); if (!form || ADM.area !== 'ops') return;
    e.preventDefault();
    const f = O.form, now = Date.now();
    try {
      if (f.kind === 'notice') {
        if (!f.title.trim() || !f.body.trim()) { toast('제목과 내용을 입력해 주세요'); return; }
        const data = { title: f.title.trim(), body: f.body, active: !!f.active, pinned: !!f.pinned, popup: !!f.popup, startAt: f.startAt || now, endAt: f.endAt || 0, updatedAt: now, by: by() };
        if (f.id) await updateDoc(doc(db, 'notices', f.id), data); else await addDoc(collection(db, 'notices'), { ...data, createdAt: now });
        toast(f.id ? '공지를 저장했어요' : '공지를 등록했어요'); O.form = null; load('notices');
      } else if (f.kind === 'mail') {
        if (!f.title.trim()) { toast('제목을 입력해 주세요'); return; }
        if (!f.rewards.length) { toast('보상을 하나 이상 넣어 주세요'); return; }
        if (f.target === 'some' && !f.uids.length) { toast('받는 사람을 골라 주세요'); return; }
        if (f.expiresAt && f.expiresAt <= now) { toast('만료 시각이 지났어요'); return; }
        const rewards = cleanRewards(f.rewards), who = f.target === 'all' ? '전체 플레이어' : `${f.uids.length}명`;
        if (!await confirmBox('우편 발송', `${esc(who)}에게 "${esc(f.title)}" 우편을 보내요.<br>보상: ${rewards.map(r => esc(rewardText(r))).join(', ')}`, '발송')) return;
        await addDoc(collection(db, 'mail'), { title: f.title.trim(), body: f.body, target: f.target, uids: f.target === 'all' ? [] : f.uids,
          includeNew: f.target === 'all' && !!f.includeNew, rewards, createdAt: now, expiresAt: f.expiresAt || 0, by: by() });
        toast('우편을 보냈어요'); O.form = null; load('mail');
      } else if (f.kind === 'coupon') {
        const code = String(f.code).trim().toUpperCase();
        if (!/^[A-Z0-9_-]{4,24}$/.test(code)) { toast('코드는 영문 대문자·숫자 4~24자예요'); return; }
        if (!f.rewards.length) { toast('보상을 하나 이상 넣어 주세요'); return; }
        if ((await getDoc(doc(db, 'coupons', code))).exists()) { toast('이미 있는 코드예요'); return; }
        await setDoc(doc(db, 'coupons', code), { code, rewards: cleanRewards(f.rewards), maxUses: f.maxUses | 0, uses: 0, expiresAt: f.expiresAt || 0, active: true, note: f.note || '', createdAt: now, by: by() });
        toast(`쿠폰 ${code}을 만들었어요`); O.form = null; load('coupons');
      } else if (f.kind === 'status') {
        const data = { maintenance: !!f.maintenance, message: f.message || '', until: f.until || 0, updatedAt: now, by: by() };
        if (data.maintenance && !O.status.maintenance && !await confirmBox('점검 시작', '지금 접속 중인 플레이어 화면도 바로 점검 안내로 바뀌어요.', '점검 시작')) return;
        await setDoc(doc(db, 'site', 'status'), data);
        O.status = data; O.form = null; toast(data.maintenance ? '점검을 켰어요' : '점검 설정을 저장했어요'); render();
      }
    } catch (err) { toast(`저장하지 못했어요 (${err.code || err.message})`); }
  });

  return {
    tabsHtml: () => `<nav class="ad-tabs" aria-label="운영 메뉴">${TABS.map(([id, l]) => `<button type="button" data-optab="${id}" aria-current="${id === O.tab ? 'page' : 'false'}">${l}</button>`).join('')}</nav>`,
    html() {
      const key = O.tab === 'mail' ? 'mail' : O.tab;
      if (!loaded(key)) setTimeout(() => load(key));
      return { notices: noticesHtml, mail: mailHtml, coupons: couponsHtml, status: statusHtml }[O.tab]();
    },
    // 플레이어 tab → 우편 쓰기 to one player
    mailTo(uid, name) {
      O.tab = 'mail';
      O.form = { kind: 'mail', title: '', body: '', target: 'some', includeNew: false, uids: [uid], names: { [uid]: name }, rewards: [newReward('piece')], expiresAt: Date.now() + 30 * DAY };
      ADM.area = 'ops'; render();
    },
  };
}
