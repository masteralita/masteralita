# 갤럭시워 서버 (Firebase) 설정과 설계

게임 데이터(수치·행성·별자리·스킨·이미지)를 **독립된 관리자 웹사이트**에서 등록하고,
웹 프로토타입과 이후 iOS/Android 앱이 같은 서버에서 읽는 구조예요.

```
[관리자 웹사이트]  ──등록/수정──▶  [Firebase: Firestore + Storage]  ◀──읽기──  [게임 (웹 / iOS / Android)]
 https://<프로젝트ID>.web.app/admin   (Google 로그인, 관리자만 쓰기)          (앱 실행 시 최신 데이터·이미지)
```

## 1. 사용자가 할 일 (Firebase 콘솔)

1. https://console.firebase.google.com 에 Google 계정으로 로그인 → **프로젝트 만들기**
   - 이름: `galaxywar` (프로젝트 ID는 자동으로 `galaxywar-xxxx` 형태가 돼요)
   - Google 애널리틱스: 사용 (나중에 AdMob·분석과 연결)
2. **빌드 → Authentication → 시작하기** → 로그인 방법에서 **Google** 사용 설정 → 저장
3. **빌드 → Firestore Database → 데이터베이스 만들기**
   - 위치: `asia-northeast3 (서울)` · 모드: **프로덕션 모드**
4. **빌드 → Storage → 시작하기**
   - 요금제 업그레이드를 요구하면 **Blaze(종량제)** 로 업그레이드해요. 무료 사용량 안에서는 비용이 나오지 않아요.
   - 업그레이드할 때 **예산 알림**(예: 월 5,000원)을 꼭 걸어 두세요.
   - 위치: 서울
5. **빌드 → Hosting → 시작하기** (안내 화면은 다음으로 넘기면 돼요)
6. ⚙ **프로젝트 설정 → 서비스 계정 → 새 비공개 키 생성** → JSON 파일이 내려받아져요.
   - 이 파일은 **비밀 키**예요. 채팅이나 GitHub에 올리지 마세요.
7. 서비스 계정에 배포 권한 주기: https://console.cloud.google.com/iam-admin/iam 에서 프로젝트를 고르고
   `firebase-adminsdk-…` 계정의 ✏ 편집 → 역할 추가 **Firebase 관리자(Firebase Admin)**, **Service Usage 소비자** → 저장
8. Claude Code 작업 환경에 등록 (세션 제목의 클라우드 환경 메뉴 → **Edit** → 환경 변수, `이름=값` 한 줄씩)
   ```
   FIREBASE_PROJECT_ID=galaxywar-1a2b3
   FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@galaxywar-1a2b3.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n
   ```
   - 세 값 모두 6번 JSON 파일의 `project_id`, `client_email`, `private_key` 값을 **따옴표 없이** 그대로 복사해요.
   - `private_key`의 `\n`은 글자 그대로 두세요 (한 줄로 들어가요).
9. 환경 변수는 **새 세션**부터 적용돼요. 새 세션에서 "Firebase 설정 끝났어. docs/FIREBASE.md 보고 이어서 진행해줘" 라고 말하면 돼요.

## 2. 데이터 구조 (Firestore)

| 경로 | 내용 |
|---|---|
| `content/constellations/items/{id}` | 이름, 영문명, 속성, 기본 능력치, 공격 방식, 별 모양(점·선·핵심 별), 이미지 경로, 정렬 순서, 사용 여부 |
| `content/skins/items/{id}` | 소속 별자리, 등급(기본/성운/스페셜), 공격 방식·보정, 능력치 카드 2종, 각성 I~III(효과 키 + 파라미터), 색상, 이미지 |
| `content/planets/items/{id}` | 이름, HP, 궤도 수, 해금 가격, 특성, 설명, 이미지 |
| `content/planetSkins/items/{id}`, `content/orbitSkins/items/{id}` | 가격, 보너스, 색상/이미지 |
| `config/balance` | 경제·확률·웨이브 등 수치 (지금 `#admin` 화면의 값과 같은 `path → value` 형식) |
| `releases/{version}` | 게임이 받는 **확정본** 한 벌 (관리자가 "배포"를 누르면 만들어짐) — `values`(수치·글자) + `content`(추가 항목) |
| `meta/current` | 현재 배포 버전 번호 — 게임은 이 번호가 바뀌었을 때만 새로 받음 |
| `admins/{uid}` | 관리자 목록 (쓰기 권한) |
| `leaderboard/{uid}` | 랭킹 — `name`, `best`(최고 웨이브), `lv`, `linked`, `hidden`(관리자가 숨김) |
| `stats/{yyyy-mm-dd}` | 일별 카운터 (한국 시간): active, newPlayers, sessions, runs, waves, battles, gacha, ads, skinBuys, mailClaims, coupons |
| `site/legal` · `site/status` | 이용약관·개인정보 처리방침·문의 메일 / 점검 모드 (`maintenance`, `message`, `until`) |
| `notices/{id}` | 공지 — `title`, `body`, `active`, `pinned`, `popup`, `startAt`, `endAt` |
| `mail/{id}` | 우편 — `target`('all'/'some'), `uids`, `includeNew`, `rewards`, `expiresAt` |
| `coupons/{CODE}` (+ `redeemed/{uid}`) | 쿠폰 — `rewards`, `maxUses`(0=무제한), `uses`, `expiresAt`, `active` |
| `players/{uid}` | 플레이어 진행 데이터 — `data`(저장 전체를 JSON 문자열로), 목록용 `name`·`lv`·`best`·`wins`, `provider`(anonymous/google.com), `updatedAt`, `createdAt` |

- 지금은 `content/*` 대신 `config/balance`(초안)와 `releases/{v}`에 `content: { skins, pskins, oskins }` 로 추가 항목을 함께 담아요 (형식은 `prototype/balance.js` 의 `applyContent` 주석).
- 관리자 화면에서 고친 내용은 **초안**으로 저장되고, **배포**를 눌러야 게임에 나가요 (실수 방지, 되돌리기 가능).
- 이미지는 Storage `images/{종류}/{id}.png` 에 저장하고, 문서에는 경로만 기록해요.

## 3. 보안 규칙 (요약)

- 읽기: `releases`, `meta`, 이미지 → 누구나 (게임이 로그인 없이 받음)
- 쓰기: `content`, `config`, `releases`, `meta`, 이미지 → `admins/{uid}` 에 등록된 사람만
- 첫 관리자는 서비스 계정으로 등록 (사용자 Google 계정 1개)
- `players/{uid}`: 본인만 읽기·쓰기 (필드·크기 검사), 관리자는 읽기만
- `leaderboard`: 누구나 읽기, 본인만 쓰기(`hidden`은 못 바꿈), 관리자는 `hidden`만 바꿈
- `stats`: 게임은 정해진 카운터를 한 번에 +200 이하로만 올릴 수 있고, 읽기는 관리자만
- `site`·`notices`: 누구나 읽기, 관리자만 쓰기 · `mail`: 받는 사람(전체 또는 uids)만 읽기
- `coupons`: 코드로 한 건 조회만(목록 불가). `uses +1`과 `redeemed/{uid}` 생성을 한 트랜잭션으로 해야 하고, 계정당 1회·횟수·기간을 규칙이 검사

## 4. 진행 순서 (Claude)

1. ✅ 관리자 웹사이트 (`admin/`): Google 로그인, 수치 편집(게임 안 #admin 기능 이전), 엑셀 내보내기/가져오기, 초안 저장 → 배포, 배포 기록·되돌리기
   - ✅ 글자 수정: 별자리·스킨·각성·능력치 카드·행성·행성/궤도 스킨의 이름과 설명 (각 탭의 글자 칸, `스킨 이름·설명` 탭)
   - ✅ 추가 항목: 새 스킨·행성 스킨·궤도 스킨 등록/수정/삭제 (`추가 항목` 탭)
   - ⏳ 새 별자리·새 행성 추가(별 모양·행성 그림 편집 필요), 이미지 업로드 — Storage 설정(1-4번) 후 진행
2. ✅ 초기 등록 (`tools/seed.mjs`): v1 = data.js 기본값으로 배포함
3. ✅ 보안 규칙 (`firestore.rules`) · Hosting 설정 (`firebase.json`) 배포 — `storage.rules`는 Storage 설정 후
4. ✅ 게임이 `meta/current` → `releases/{version}` 을 읽어 적용 (기기에 캐시, 못 받으면 캐시 → 내장 기본값)
5. ✅ 웹 프로토타입을 Hosting `/play/` 에 배포
6. ✅ 플레이어 계정·클라우드 저장 (`prototype/cloud.js`) + 관리자 사이트 `플레이어` 탭
7. ✅ 운영 기능 (`prototype/live.js`, `admin/ops.js` · `stats.js` · `legal.js`): 랭킹, 공지, 우편, 쿠폰, 점검, 통계, 약관·개인정보 처리방침·확률 정보

## 5. 현재 상태

| | 주소 / 값 |
|---|---|
| 게임 | https://galaxywar-e3d9a.web.app/play/ |
| 관리자 | https://galaxywar-e3d9a.web.app/admin/ |
| Firestore DB | 이름 `glaxywardb` (기본 DB가 아닌 이름 있는 DB, 서울) — 코드의 `FIREBASE_DB` |
| 웹 앱 설정 | `prototype/firebase-config.js` (공개 값이에요. 권한은 보안 규칙이 결정) |
| Storage | ❌ 아직 없음 — 1-4번(Blaze 업그레이드 + Storage 시작)이 필요해요 |

### 관리자 사이트 쓰는 법
- 표에서 값 수정 → **초안 저장** (여러 관리자가 같은 초안을 봐요) → **배포** (메모 입력) → 게임은 다음 실행 때 새 버전을 받아요.
- **배포 기록** 탭: 예전 버전을 초안으로 불러와 다시 배포하면 되돌리기예요.
- claude.ai 게임의 `#admin`에 저장했던 값이 있으면: 그 화면에서 **엑셀 내보내기** → 관리자 사이트에서 **엑셀 가져오기** → 초안 저장 → 배포.

### 플레이어 계정·저장 (`prototype/cloud.js`)
- 처음 실행하면 **익명(게스트) 계정**이 자동으로 만들어져요 (Authentication → 익명 로그인 사용 중).
- 게임은 지금처럼 기기 저장(localStorage)으로 플레이하고, 저장할 때마다 `updatedAt`을 찍어 4초 뒤 서버에 올려요. 앱을 닫을 때도 바로 올려요.
- 실행할 때 서버 사본이 더 새것이면 서버 것을 불러와요 (전투 중이면 끝난 뒤).
- 설정 → **Google 연동**: 게스트 계정에 Google을 연결해요 (uid 그대로). 다른 기기에서는 타이틀의 **Google로 이어하기**로 불러와요.
  - 이미 있는 Google 계정이면 그 계정으로 전환: 저장된 진행이 있으면 불러오고, 없으면 지금 진행을 옮겨요. 게스트 사본은 서버에 남겨 둬요.
- 설정 → **로그아웃**(Google 연동 시): 진행은 서버에 두고 이 기기는 새 게스트로 시작해요. **서비스 탈퇴**: 서버 데이터와 계정까지 지워요.
- Firebase를 못 불러오면(오프라인, claude.ai 안) 기기에만 저장해요.
- ⚠️ 저장 내용은 게임(클라이언트)이 정해서 올려요. 재화 조작을 막으려면 결제·보상 지급을 서버(Functions)에서 검증해야 해요 — 인앱 결제 붙일 때 같이 해요.

### 관리자 사이트 구성
| 영역 | 내용 |
|---|---|
| 밸런스 | 수치·글자 표, 추가 항목, 배포 기록 (초안 저장 → 배포) |
| 운영 | 공지사항(팝업·고정·기간) · 우편 발송(전체/선택, 보상 종류·개수, 만료, 회수) · 쿠폰(코드, 횟수, 기간, 중지) · 점검(켜면 게임 즉시 가림, 관리자는 통과) |
| 플레이어 | 최근 50명 / 닉네임 검색, 진행 요약, 우편 보내기, 랭킹 숨기기 |
| 통계 | 전체·오늘·7일·30일 활동, 신규, 일별 차트·표, 최고 웨이브·레벨 분포 |
| 약관·정책 | 이용약관, 개인정보 처리방침(기본 양식 제공 — 【】 채우고 법률 검토), 문의 메일. 웹 주소 `/legal/?doc=terms`, `/legal/?doc=privacy` (앱 마켓 등록용) |

보상 종류(우편·쿠폰): 미네랄, 별모래, 보물 상자 칸, 별자리 카드(별자리·등급·장수), 스킨 (`data.js`의 `REWARD_TYPES`). 이미 가진 스킨은 별모래 100으로 바꿔 줘요.

### 통계 · Google 애널리틱스
- 지금은 자체 통계: 게임이 이벤트(가입, 아케이드·배틀 종료, 뽑기, 광고 시청, 스킨 구매, 우편 수령, 쿠폰)를 기기에 모았다가 `stats/{날짜}`에 더해요.
- **Google 애널리틱스 연결됨**: 속성 `galaxywar-e3d9a` (ID 556835274), 측정 ID `G-XY3C0SLW59` (`prototype/firebase-config.js`).
  - Firebase 웹 앱과 GA 스트림이 연결돼 있지 않아서(Firebase가 측정 ID를 비워서 돌려줌) Firebase Analytics SDK 대신 **gtag.js로 측정 ID에 직접** 보내요 (`cloud.js`). `user_id` = 계정 uid.
  - 같은 이벤트 이름이 GA에도 기록돼요: sign_up, arcade_end(wave), battle_end(win), gacha(kind, n), ad_reward, skin_buy, mail_claim, coupon + 자동 page_view.

### 도구 (`tools/`, 환경 변수 3개 필요)
| 명령 | 하는 일 |
|---|---|
| `node tools/deploy.mjs` | 보안 규칙 + Hosting 배포 (`rules` / `hosting` / `build`만 따로도 가능) |
| `node tools/add-admin.mjs <이메일>` | 관리자 등록 (그 계정이 관리자 사이트에서 한 번 로그인한 뒤) · `--remove`로 해제 |
| `node tools/seed.mjs` | 배포 버전이 하나도 없을 때 v1 만들기 |

- 서비스 계정 권한: Firestore·Hosting·Rules·Auth 조회는 돼요. **Service Usage 소비자** 역할이 아직 없어서 `x-goog-user-project` 헤더를 쓰는 API는 403이에요 (지금 도구는 필요 없음).
- claude.ai 아티팩트(게임)는 외부 서버에 접속할 수 없어서 계속 내장 기본값을 써요. 서버 값이 들어간 게임은 `/play/` 주소로 열어요.

## 6. 이어받기 메모

- 작업 브랜치: `claude/upbeat-carson-fmqclr` (이전 `claude/vibrant-einstein-sc3mji` 작업 포함).
- 웹 프로토타입: `prototype/` (index.html + data.js, firebase-config.js, balance.js, battle.js, arcade.js, skills.js, ads.js, app.js, cloud.js, live.js)
- 관리자: `admin/` (admin.js = 밸런스·플레이어, ops.js, stats.js, legal.js) · 약관 웹 페이지: `legal/`
  - 수치 레지스트리: `prototype/balance.js` 의 `BAL_SECTIONS` (`path → value`). 관리자 사이트(`admin/admin.js`)가 같은 파일을 불러와 써요.
- 추가 항목이 배포에서 빠지면 그 스킨을 장착한 플레이어는 기본 스킨으로 돌아가요 (`equippedSkin`, `PSKIN.basic`, `OSKIN.dash` 대체).
- Firestore는 배열 안의 배열을 저장할 수 없어요 — 추가 스킨의 능력치 카드는 `{ key, name }` 로 저장하고 게임이 `[key, name]` 으로 바꿔요.
- 다음 작업: Storage가 생기면 → `storage.rules` + 이미지 업로드, 새 별자리(별 모양 편집기)·새 행성 추가.
