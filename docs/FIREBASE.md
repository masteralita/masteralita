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
| `releases/{version}` | 게임이 받는 **확정본** 한 벌 (관리자가 "배포"를 누르면 만들어짐) |
| `meta/current` | 현재 배포 버전 번호 — 게임은 이 번호가 바뀌었을 때만 새로 받음 |
| `admins/{uid}` | 관리자 목록 (쓰기 권한) |

- 관리자 화면에서 고친 내용은 **초안**으로 저장되고, **배포**를 눌러야 게임에 나가요 (실수 방지, 되돌리기 가능).
- 이미지는 Storage `images/{종류}/{id}.png` 에 저장하고, 문서에는 경로만 기록해요.

## 3. 보안 규칙 (요약)

- 읽기: `releases`, `meta`, 이미지 → 누구나 (게임이 로그인 없이 받음)
- 쓰기: `content`, `config`, `releases`, `meta`, 이미지 → `admins/{uid}` 에 등록된 사람만
- 첫 관리자는 서비스 계정으로 등록 (사용자 Google 계정 1개)

## 4. 진행 순서 (Claude)

1. 관리자 웹사이트 (`admin/`): 로그인, 콘텐츠 목록/등록/수정, 이미지 업로드, 수치 편집(지금의 #admin 기능 이전), 엑셀 내보내기/가져오기, 초안 → 배포
2. 현재 `prototype/data.js` 값을 Firestore로 옮기는 초기 등록 스크립트 (`tools/seed.mjs`)
3. 보안 규칙 (`firestore.rules`, `storage.rules`) 과 Hosting 설정 (`firebase.json`) 배포
4. 게임이 `meta/current` → `releases/{version}` 을 읽어 데이터를 적용하도록 변경 (못 받으면 내장 기본값 사용)
5. 웹 프로토타입도 Hosting의 `/play` 에 올려서 claude.ai 밖에서도 접속 가능하게

## 5. 이어받기 메모 (이전 세션 → 새 세션)

- 작업 브랜치: `claude/vibrant-einstein-sc3mji` — 지금까지의 모든 작업이 여기에 있어요. 새 작업도 이 브랜치를 기준으로 이어가요.
- 웹 프로토타입: `prototype/` (index.html + data.js, balance.js, battle.js, ads.js, app.js, admin.js)
  - claude.ai 아티팩트로 배포 중: https://claude.ai/artifact/JN1fdTjTXAbeJoF3GsMeHj (게임), `#admin` (게임 안 밸런스 관리자)
  - 수치 레지스트리: `prototype/balance.js` 의 `BAL_SECTIONS` (513개 값, `path → value`). Firebase의 `config/balance` 도 같은 형식으로 쓰면 돼요.
- 사용자가 환경 변수 `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` 를 등록함 (API 자격 증명이 아닌 일반 환경 변수).
  - 먼저 값이 있는지만 확인하고(내용은 출력하지 않기), 서비스 계정으로 토큰 발급 → Firestore/Storage/Hosting 접근을 점검해요.
  - 권한 오류가 나면 1-7번(IAM 역할)을 사용자에게 다시 안내해요.
- 다음 순서: 4번 "진행 순서"의 1번(관리자 웹사이트)부터.
