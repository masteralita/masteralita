# UI 스타일 · 그림 리소스

## 현재 스타일 (`prototype/theme.css`)
벤치마크 `벤치마킹/벤치_클라우디아` 를 참고해 CSS/SVG로 그린 다크 판타지 RPG 스타일.
남색 다마스크 배경, 은색 베벨 테두리, 상점 상품 금색 테두리, 청록 광택 버튼(취소·위험은 빨강),
비스듬한 청록 제목 띠, 원형 레벨 배지, 사각 타일 하단 메뉴(한글 라벨).
※ 벤치마크 이미지는 참고만 하고 그대로 쓰지 않아요 (저작권).

## 다음 작업: SpriteCook으로 그림 만들기
사용자가 SpriteCook 플러그인을 설치함 (2026-10-01). 플러그인은 새 세션부터 로드돼요.
새 세션에서: "docs/UI.md 보고 SpriteCook으로 그림 작업 이어서 해줘"

만들 그림 (우선순위 순, 우주·별자리 테마 + 다크 판타지 톤, 벤치마크 그림 복제 금지):
1. 재화 아이콘: Star Dust(금빛 별가루), Star Piece(보라 결정) — 64×64 PNG, 투명 배경
   → `.dust::before`, `.piece::before` 를 이미지로 교체
2. 하단 메뉴 아이콘 5개: 상점·행성·로비·별자리·팀 — 96×96 PNG, 투명 배경
   → `index.html` 의 `.nav button svg` 를 `<img>` 로 교체
3. 상점 배너: 특수 별자리 패키지(뱀주인자리), 골드/유료 뽑기 — 가로 3:1
   → `renderStore()` 의 `.banner-card`, 뽑기 카드 배경
4. 별자리 카드 배경 (등급별 6종 프레임) — `.ccell`, `.gcard`
5. 로비 우편함·랭킹 아이콘, 보물 상자 그림

이미지 위치: `prototype/img/` (deploy.mjs가 png/webp 를 /play/ 로 함께 올림 — 하위 폴더 복사 추가 필요).

## 만든 그림 (2026-10-01, SpriteCook · GPT 2.5 Flare)
`prototype/img/` 에 있어요. 아이콘은 2배 크기(레티나용)로 저장했어요. theme.css 끝의 "Art" 구역과 index.html·app.js에서 연결했어요. 게임 속 낙하 보물상자(캔버스)는 아직 기존 그림이에요.

| 파일 | 크기 | 쓰일 곳 |
|---|---|---|
| `cur_dust.png`, `cur_piece.png` | 128×128 | `.dust::before`, `.piece::before` |
| `nav_store/planets/home/const/team.png` | 192×192 | `.nav button svg` 교체 |
| `icon_mail.png`, `icon_rank.png`, `icon_chest.png` | 192×192 | 로비 우편함·랭킹, 보물 상자 |
| `banner_ophiuchus/gold/premium.webp` | 1024×~333 (3:1) | 상점 패키지 배너, 골드/유료 뽑기 카드 |
| `card_common/magic/rare/unique/epic/legend.webp` | 240×~360 | `.ccell`, `.gcard` 등급별 배경 |

배너는 왼쪽 1/3이 어두워서 글자를 올리기 좋아요.
| `con_<id>.webp` (13종: sgr cap aqr psc ari tau gem cnc leo vir lib sco oph) | 240×240 | `conSvg()`(카드·뽑기·편성)와 battle.js `drawCon()`(로비·전투 캔버스)의 기본 스킨 별자리 그림 (다른 스킨은 기존 선 그림, 적은 빨간 후광) |

별자리 그림은 2026-10-01 SpriteCook 시트 1장(4×4)으로 만들어 잘랐어요. 잠긴 별자리는 `.cimg.dim` 으로 흑백 처리돼요.
