/* ==========================================================================
   약관·정책: 이용약관, 개인정보 처리방침, 문의 메일 → site/legal (public).
   The game shows them from 설정; /legal/?doc=terms|privacy serves them as web pages
   (the URLs app stores ask for). Saving publishes immediately.
   ========================================================================== */
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

// Starting points only — fill in the 【】 parts and have them reviewed before release.
const TEMPLATE = {
  terms: `갤럭시워 서비스 이용약관

제1조 (목적)
이 약관은 【운영자명】(이하 "운영자")가 제공하는 모바일 게임 "갤럭시워"(이하 "서비스")의 이용과 관련하여 운영자와 이용자의 권리, 의무 및 책임 사항을 정하는 것을 목적으로 합니다.

제2조 (용어의 정의)
1. "이용자"란 이 약관에 따라 서비스를 이용하는 사람을 말합니다.
2. "계정"이란 이용자를 식별하기 위해 서비스가 발급하는 게스트 계정 또는 이용자가 연동한 Google 계정을 말합니다.
3. "게임 재화"란 Star Dust, Star Piece 등 서비스 안에서 사용하는 가상의 재화를 말합니다.
4. "유료 아이템"이란 이용자가 대금을 지급하고 구매한 게임 재화와 아이템을 말합니다.

제3조 (약관의 효력과 변경)
1. 이 약관은 서비스 화면에 게시하여 효력이 생깁니다.
2. 운영자는 관련 법령을 위반하지 않는 범위에서 약관을 변경할 수 있으며, 변경 시 적용일 7일 전(이용자에게 불리한 경우 30일 전)부터 서비스 안 공지사항으로 알립니다.

제4조 (계정)
1. 서비스는 처음 실행할 때 게스트 계정을 자동으로 만듭니다. 게스트 계정의 진행은 해당 기기에서만 이어할 수 있으며, Google 계정을 연동하면 다른 기기에서도 이어할 수 있습니다.
2. 이용자는 자신의 계정을 타인에게 양도하거나 대여할 수 없습니다.

제5조 (서비스의 제공과 변경)
1. 서비스는 연중무휴 제공함을 원칙으로 하나, 점검·장애 등 부득이한 경우 일시 중단될 수 있습니다.
2. 운영자는 게임 내용(능력치, 확률, 아이템 등)을 운영상 필요에 따라 변경할 수 있으며, 중요한 변경은 공지사항으로 알립니다.

제6조 (유료 아이템과 청약철회)
1. 유료 아이템은 앱 마켓(Apple App Store, Google Play)의 결제 수단으로 구매하며, 결제와 환불은 각 마켓의 정책을 따릅니다.
2. 이용자는 구매한 날부터 7일 이내에 사용하지 않은 유료 아이템에 대해 청약을 철회할 수 있습니다. 다만 구매 즉시 사용되거나 효과가 적용되는 아이템 등 관련 법령이 정한 경우에는 청약철회가 제한되며, 이를 구매 화면에 표시합니다.
3. 확률형 아이템의 종류별 획득 확률은 설정 → 확률 정보에서 확인할 수 있습니다.

제7조 (금지 행위)
이용자는 다음 행위를 해서는 안 됩니다.
1. 비정상적인 방법(프로그램 변조, 버그 악용, 데이터 조작 등)으로 게임 재화나 기록을 얻는 행위
2. 타인의 계정을 도용하는 행위
3. 서비스 운영을 방해하거나 다른 이용자에게 불쾌감을 주는 닉네임을 사용하는 행위
4. 게임 재화나 계정을 현금 등으로 거래하는 행위

제8조 (이용 제한)
운영자는 이용자가 제7조를 위반한 경우 경고, 랭킹 제외, 게임 재화 회수, 이용 정지 등의 조치를 할 수 있습니다.

제9조 (서비스 탈퇴)
이용자는 설정 → 서비스 탈퇴로 언제든지 탈퇴할 수 있으며, 탈퇴하면 계정과 게임 진행 기록이 삭제되어 복구할 수 없습니다.

제10조 (책임의 제한)
운영자는 천재지변, 이용자의 귀책 사유, 무료로 제공되는 서비스의 이용과 관련해서는 관련 법령에 특별한 규정이 없는 한 책임을 지지 않습니다.

제11조 (분쟁 해결)
서비스 이용과 관련한 분쟁은 대한민국 법을 따르며, 관할 법원은 민사소송법에 따릅니다.

문의: 【문의 이메일】

부칙
이 약관은 【시행일: 2026년 00월 00일】부터 적용합니다.`,

  privacy: `갤럭시워 개인정보 처리방침

【운영자명】(이하 "운영자")는 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고 관련 고충을 원활하게 처리하기 위해 다음과 같이 개인정보 처리방침을 둡니다.

1. 처리하는 개인정보 항목
- 필수: 계정 식별자(서비스가 발급하는 게스트 ID), 닉네임, 게임 진행 기록(재화, 보유 아이템, 기록 등), 접속 일시
- 선택: Google 계정 연동 시 Google 계정 이메일 주소, 생일(월·일, 탄생 별자리 지급용)
- 자동 수집: 광고 노출을 위한 광고 식별자(ADID/IDFA), 기기 정보, 앱 이용 기록(이용 통계)

2. 개인정보의 처리 목적
- 게임 서비스 제공, 진행 저장과 기기 간 이어하기
- 랭킹 제공(닉네임, 최고 기록, 레벨이 다른 이용자에게 공개됩니다)
- 보상 지급, 문의 응대, 부정 이용 방지
- 서비스 개선을 위한 통계 분석, 광고 제공

3. 보유 및 이용 기간
- 서비스 탈퇴 시 또는 마지막 접속 후 【1년】이 지나면 지체 없이 파기합니다.
- 다만 관련 법령(전자상거래법 등)에 따라 보존해야 하는 결제 기록 등은 해당 기간(5년) 동안 보관합니다.

4. 개인정보 처리의 위탁 및 국외 이전
운영자는 서비스 제공을 위해 다음과 같이 개인정보 처리를 위탁하며, 위탁 업무를 위해 개인정보가 국외로 이전됩니다.
- 수탁자: Google LLC (Firebase, Google AdMob, Google Analytics)
- 위탁 업무: 계정 인증, 데이터 저장, 광고 제공, 이용 통계
- 이전 국가: 미국 등 Google 데이터센터 소재 국가 (기본 저장 위치: 대한민국 서울)
- 이전 일시와 방법: 서비스 이용 시 네트워크를 통해 수시로 전송
- 이전 항목: 1번의 항목
- 보유 기간: 3번과 같음
- 국외 이전을 원하지 않으면 서비스 탈퇴로 거부할 수 있으나, 이 경우 서비스를 이용할 수 없습니다.

5. 개인정보의 제3자 제공
운영자는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따라 요구되는 경우는 예외로 합니다.

6. 개인정보의 파기
보유 기간이 지나거나 처리 목적이 달성된 개인정보는 복구할 수 없는 방법으로 지체 없이 삭제합니다.

7. 이용자의 권리
- 이용자는 언제든지 자신의 개인정보를 조회·정정·삭제·처리정지 요구할 수 있습니다.
- 닉네임은 설정 → 닉네임 변경에서, 전체 삭제는 설정 → 서비스 탈퇴에서 직접 할 수 있습니다.
- 그 밖의 요청은 아래 문의처로 연락해 주세요.

8. 만 14세 미만 아동
만 14세 미만 아동의 개인정보를 처리하려면 법정대리인의 동의가 필요합니다. 【서비스 정책에 맞게 작성】

9. 안전성 확보 조치
접근 권한 관리(관리자 계정 제한), 전송 구간 암호화(HTTPS), 데이터 접근 규칙(본인 데이터만 접근)을 적용합니다.

10. 개인정보 보호책임자
- 성명: 【이름】
- 연락처: 【문의 이메일】

11. 권익 침해 구제
개인정보 침해에 대한 신고나 상담은 개인정보침해신고센터(privacy.kisa.or.kr, 국번 없이 118), 개인정보분쟁조정위원회(www.kopico.go.kr, 1833-6972)에 문의할 수 있습니다.

12. 시행일
이 개인정보 처리방침은 【2026년 00월 00일】부터 적용합니다.`,
};

export function makeLegal({ db, ADM, esc, toast, confirmBox, render, fmtTime }) {
  const L = { doc: null, form: null };
  const root = document.getElementById('admin');
  const base = `https://${FIREBASE_CONFIG.projectId}.web.app/legal/`;
  async function load() {
    try { const s = await getDoc(doc(db, 'site', 'legal')); L.doc = s.exists() ? s.data() : {}; }
    catch (err) { L.doc = {}; toast(`불러오지 못했어요 (${err.code || err.message})`); }
    L.form = { terms: L.doc.terms || '', privacy: L.doc.privacy || '', contact: L.doc.contact || '' };
    render();
  }
  const dirty = () => L.form && L.doc && ['terms', 'privacy', 'contact'].some(k => (L.form[k] || '') !== (L.doc[k] || ''));
  const todo = t => (t.match(/【[^】]*】/g) || []).length;
  root.addEventListener('input', e => { if (ADM.area !== 'legal' || !L.form) return; const k = e.target.dataset.lg; if (k) { L.form[k] = e.target.value; const s = root.querySelector('[data-lgsave]'); if (s) s.disabled = !dirty(); } });
  root.addEventListener('click', async e => {
    if (ADM.area !== 'legal') return;
    const t = e.target.closest('[data-lgtpl]');
    if (t) {
      const k = t.dataset.lgtpl;
      if (L.form[k].trim() && !await confirmBox('기본 양식 넣기', '지금 입력한 내용을 기본 양식으로 바꿔요.', '바꾸기')) return;
      L.form[k] = TEMPLATE[k]; render(); return;
    }
    if (e.target.closest('[data-lgsave]')) {
      const c = L.form.contact.trim();
      if (c && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c)) { toast('문의 이메일 형식을 확인해 주세요'); return; }
      const left = todo(L.form.terms) + todo(L.form.privacy);
      if (left && !await confirmBox('저장', `아직 채우지 않은 【】 항목이 ${left}개 있어요. 그대로 게임에 공개할까요?`, '저장')) return;
      try {
        const data = { terms: L.form.terms, privacy: L.form.privacy, contact: c, updatedAt: Date.now(), by: ADM.user.email || ADM.user.uid };
        await setDoc(doc(db, 'site', 'legal'), data); L.doc = data; toast('저장했어요 · 게임과 웹 페이지에 바로 반영돼요'); render();
      } catch (err) { toast(`저장하지 못했어요 (${err.code || err.message})`); }
    }
  });
  return {
    html() {
      if (!L.form) { setTimeout(load); return '<p class="empty">불러오는 중…</p>'; }
      const box = (k, title) => `<section class="op-card"><div class="lg-h"><h3>${title}</h3>
          ${todo(L.form[k]) ? `<span class="ad-chip warn">채울 곳 【】 ${todo(L.form[k])}개</span>` : L.form[k].trim() ? '<span class="ad-chip ok">작성됨</span>' : '<span class="ad-chip">비어 있음</span>'}
          <button class="ghost sm" type="button" data-lgtpl="${k}">기본 양식 넣기</button>
          <a class="link" href="${base}?doc=${k}" target="_blank" rel="noopener">웹 페이지 보기</a></div>
        <textarea class="lg-text" data-lg="${k}" rows="18" spellcheck="false">${esc(L.form[k])}</textarea></section>`;
      return `<div class="ad-desc"><h2>약관·정책</h2><p>게임의 설정 → 이용약관 / 개인정보 처리방침 / 문의하기에 보여요. [저장]하면 바로 반영돼요.
          기본 양식은 출발점이에요 — 【】 부분을 채우고, 출시 전에 법률 검토를 받으세요.</p>
          <button class="cta sm" type="button" data-lgsave${dirty() ? '' : ' disabled'}>저장</button></div>
        ${L.doc.updatedAt ? `<p class="ct-desc">마지막 저장: ${fmtTime(L.doc.updatedAt)} · ${esc(L.doc.by || '')}</p>` : ''}
        <section class="op-card"><div class="ct-grid"><label class="ct-f wide"><span>문의 이메일 (설정 → 문의하기)</span><input type="email" data-lg="contact" value="${esc(L.form.contact)}" placeholder="support@example.com"></label></div>
          <p class="ct-desc">앱 마켓 등록용 주소 — 이용약관: <code>${base}?doc=terms</code> · 개인정보 처리방침: <code>${base}?doc=privacy</code></p></section>
        ${box('terms', '이용약관')}${box('privacy', '개인정보 처리방침')}`;
    },
  };
}
