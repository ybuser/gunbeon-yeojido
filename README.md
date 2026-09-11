# 군번여지도 강원

**휴전선 밖 첫 하루. 장병과 가족·연인·친구가 함께 만드는 강원 여행.**

출타에 맞는 여행을 계획하고, 만나는 사람마다 그룹으로 일정을 나눕니다. 여행 중에는 개인 복귀 기준을 확인하고, 다녀온 뒤 비무장 패스포트에 기록합니다. **2026 관광데이터 활용 공모전 ① 웹·앱 개발 부문**을 위한 모바일 웹/PWA입니다.

[테스트 사이트 열기](https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/) · 개인 계정 로그인 · 체험 입장 **1234** · ChatGPT 로그인 불필요

[화면으로 보는 사용 가이드](https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/guide) · [사진 원문·이용조건 검토 목록](reports/photo_sources.md)

소스 저장소: [MySonIsSoldier/gunbeon-yeojido](https://github.com/MySonIsSoldier/gunbeon-yeojido) · [기존 clone 연결 변경 안내](docs/local-setup.md#기존-clone의-조직-저장소-연결)

## 실제 화면

실행 중인 앱을 Chrome에서 촬영했습니다. 예시 그룹·일정은 검증용 데이터입니다.

| 홈 · 하루 여권 | 그룹 · 함께 관리하는 일정 |
|---|---|
| ![모바일 홈](web/public/guide/09-home.png) | ![모바일 그룹 일정](reports/screenshots/group-mobile.png) |

![데스크톱 홈](reports/screenshots/day-passport-desktop.png)

<img src="web/public/guide/01-discover.png" width="280" alt="날짜 없는 추천 코스 탐색" /> <img src="web/public/guide/02-course.png" width="280" alt="장소별 사진이 나뉜 코스 상세" />

<img src="web/public/guide/15-advice-public.png" width="280" alt="외부 방문자에게 공유한 여행안" /> <img src="web/public/guide/16-advice-proposal.png" width="280" alt="특정 관광지에 구체적인 한 수 보태기" /> <img src="web/public/guide/18-record-edit.png" width="280" alt="여행 기록 수정" />

<img src="web/public/guide/21-account-login.png" width="280" alt="개인 계정 로그인" /> <img src="web/public/guide/23-record-menu.png" width="280" alt="여행 기록 더보기와 별도 공유 카드" />

[Google·Naver 연결 방법](docs/social-login-setup.md) · [계정 구현·검증](reports/accounts_delivery.md)

## 이렇게 사용합니다

0. **계정으로 이어가기** — 로그인 → 계정 만들기. 기존 여행은 내 계정의 ‘이 기기의 여행·그룹 연결’에서 가져옵니다. 같은 계정으로 다른 브라우저에서도 이어갑니다.
1. **함께 준비하기** — 홈 → 그룹 만들기 → 가족·연인·친구·동행 선택 → 초대 링크 전달. 초대받은 사람은 자기 브라우저에서 참여해 같은 여행을 봅니다.
2. **날짜 없이 둘러보기** — 강원 접경 5군의 추천 코스 15개를 지역·취향으로 살펴봅니다. 코스를 고른 뒤 일정표에서 날짜·시간을 정합니다. 둘러보기는 현재 시각과 개인 복귀 조건을 사용하지 않습니다.
3. **내 코스 만들기** — 빈 여행을 먼저 저장하거나 추천 코스를 가져옵니다. TourAPI 검색·가까운 장소·즐겨찾기·지도/직접 입력으로 최대 12곳을 담고 순서와 체류 시간을 바꿉니다.
4. **그룹에 공유하기** — 개인 여행을 선택하거나 그룹 안에서 새 일정을 만듭니다. 직접 지정한 장소는 포함 여부를 확인합니다. 동시 수정 충돌 시 자신의 변경을 새 여행 사본으로 저장할 수 있습니다.
5. **여유 조정** — 일정표에서 한 곳 생략·머무는 시간 변경 전후의 복귀 여유와 도보 추정을 비교합니다. 적용 후 저장하고, 다른 편집 전에는 되돌릴 수 있습니다.
6. **출타와 기록** — 내 여행에 담은 뒤 개인 복귀 기준을 정하고 ‘출타 시작’을 누릅니다. 여행이 끝나면 실제 다녀온 관광지를 선택하고 스탬프를 남깁니다. ‘하루의 한 장’은 이미지·문구로 저장할 수 있습니다. 홈에는 건너뛸 수 있는 16초 이야기 사용법도 있습니다.

7. **한 수 부탁하기** — 준비 중인 여행안을 공개하고 장소를 추가·바꾸거나 덜어내는 아이디어를 받습니다. 링크 방문자는 가입·비밀번호 없이 제안하고, 작성자는 개인 일정에서 검토·저장한 뒤 반영 표시를 남깁니다. 참여자는 공개안으로 새 여행을 시작할 수 있습니다.
8. **기록 고치기** — 기록 오른쪽 위 ⋮에서 여행 이름·방문 장소·스탬프를 수정합니다. 잘못 완료했다면 확인 후 계획으로 되돌리고, 원래 기록도 남기려면 새 여행으로 가져옵니다.

[한 수 보태기 설계·공개 범위](reports/advice_implementation.md) · [공식 서비스 벤치마크](reports/advice_benchmark.md)

## 구현 범위

- 개인 계정·서버 저장·기기 여행 가져오기, Google/Naver 연결 준비, 여행 카드 더보기 메뉴
- 공개 관광지 제안·작성자 검토/반영·새 여행 가져오기, 인스타 PNG/링크·X 공유, 기록 수정/계획 복원
- 하루 여권 표지·여유 조정 비교/되돌리기·실제 방문 선택·공개 기록 카드·선택형 16초 사용법
- 홈의 예정된 여행·소속 그룹, 그룹별 여러 일정, 다른 기기 초대·공동 편집
- 1~4칸 코스 사진, 직접 코스 편집, 즐겨찾는 만남 장소, 빈 일정 저장
- 계획용 지도·미션과 실시간 현재 출타 분리, 거리 추정 기반 복귀 여유
- 부모의 도보·주차·실내 대안·식사·날씨 브리핑, 비무장 패스포트와 방문 준비 안내
- 출처·갱신 상태 표시, 한국관광공사 서버 API 어댑터, 무장애·기상청·Kakao 지도
- SVG 로고·파비콘·PWA 아이콘, 모바일 하단 5메뉴와 데스크톱 반응형

## 데이터와 저장

TourAPI는 **2026-09-09 고성의 5유형 조회 성공, 149개 장소 수신**을 확인했습니다. 9/8에는 일일 한도(오류 22)가 발생했습니다. 정상 기능을 축소하지 않고 **운영계정 기본 일 10만 신청 및 운영팀 추가 증설**을 준비합니다. 현재 우리 계정의 승인량은 별도 확인 대상입니다. JSON/XML의 일일·순간 한도와 인증 오류를 구분합니다. [실연동 증빙](reports/qa/day-passport/tourapi-live.json) · [증설·저장 정책](reports/api_capacity_strategy.md).

관광공사 정책과 개발 부문 FAQ에 별도 저장 조건이 있어 **TourAPI 응답을 운영 DB에 적재하는 기능은 적용하지 않았습니다.** 페이지 메모리로 API 응답을 재사용하고 새로고침 시 초기화합니다. 이미지는 CORS가 허용되면 Blob 메모리(최대 48 MiB), 그 외에는 원본과 브라우저 캐시를 사용합니다. 모든 출처의 이미지 재사용이 보장되는 것은 아닙니다.

공개 ‘한 수 보태기’의 장소 참조·질문·제안은 D1에 저장합니다. 개인 제목·정확한 시간·직접 지정한 장소는 공개하지 않습니다. 링크는 30일 유효하며 작성자가 마감/삭제할 수 있습니다. 로그인 계정에 연결한 공유는 다른 기기에서도 관리합니다. 체험 이용은 브라우저 쿠키에 권한이 남습니다.

그룹·멤버·공유 일정은 D1 DB에 저장합니다. 로그인한 개인 일정·즐겨찾기·출타·스탬프도 계정별 D1에 저장됩니다. 체험 이용은 브라우저 저장을 유지합니다. 저장 실패는 재시도/백업, 동시 수정은 revision 충돌로 보호합니다. 그룹에는 출발 예정 시각과 선택한 장소를 공유하되, 개인 복귀시각·진행 상태·스탬프는 보내지 않습니다. 직접 입력한 장소 이름·주소·좌표는 확인창에서 선택했을 때만 그룹에 포함합니다. 공개 공유 카드는 개인 장소와 정확한 시각을 제외합니다.

개인 아이디 로그인과 계정별 서버 저장을 지원합니다. Google/Naver OAuth 어댑터는 준비했으며 발급·검수·실로그인은 설정 후 검증합니다. 비밀번호 재설정 메일은 아직 없습니다. 게스트 참여는 브라우저 쿠키를 유지해야 합니다. 초대는 72시간 동안 유효하고 관리자에게 취소·멤버 제외·그룹 삭제 기능이 있습니다.

## 시작

**다른 PC에서 이어서 개발:** [Agent 안내](AGENTS.md) → [현재 상태](docs/handoff.md) → [키 없는 새 PC 설정](docs/local-setup.md) → [남은 목표](docs/roadmap.md).

Node.js 22.13 이상.

```sh
cp .env.example .env.local
cd web
npm ci
# web/.env.local이 없다면 상위 설정 연결
ln -s ../.env.local .env.local
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
npm run dev
```

저장소 루트 `.env.local`의 `DATA_GO_KR_SERVICE_KEY`에 공통 일반 인증키를 한 번 입력한 후 개발 서버를 재시작하세요. [신청할 API와 키 형식](reports/api_setup.md). 키는 서버에만 보관하고 Git/채팅에 올리지 않습니다. `TEST_ACCESS_PASSWORD`와 32바이트 이상의 무작위 `TEST_SESSION_SECRET`도 설정해야 합니다. 로컬 설정과 배포 secret은 별개입니다. Kakao JavaScript 키는 공개 브라우저 키로 사용하며 허용 도메인 등록이 필요합니다.

```sh
cd web
npm run typecheck
npm test
npm run build
# 설치된 Chrome·Edge에서 실제 API 사용 (별도 브라우저 프로필)
npm run test:browser
npm run test:custom
npm run test:outing
npm run test:groups
npm run test:groups-ui
npm run test:day
```

브라우저 재현 방법과 API 실패 검사 설정은 [QA 보고서](reports/browser_qa_report.md)에 있습니다. CI는 키 없이 Chromium에서 장애 대응 흐름을 실행합니다.

## 개발 및 검증

React 19 · TypeScript · Tailwind · Vinext/App Router · Sites · D1/Drizzle. 환경변수는 `.env.local`과 배포 secret으로 관리하며 키는 Git에 저장하지 않습니다.

- [이번 공개 적용·CI 기록](reports/discovery_delivery.md)
- [API 한도 대응 실행안](reports/api_capacity_strategy.md) · [운영 신청·문의 준비본](reports/api_capacity_requests.md) · [하루 여권·여유 조정 구현](reports/day_passport_delivery.md)
- [이번 UX 검토와 다음 계획](reports/discovery_ux_review.md) · [사용 시나리오 가이드](reports/usage_guide.md) · [이번 검증 결과](reports/qa/discovery/)
- [그룹·UX·데이터 운영 및 다음 계획](reports/travel_groups_delivery.md)
- [공식 규정](reports/notion_requirements.md) · [개발 계획](reports/implementation_plan.md) · [제출 준비](reports/submission_assets.md)
- [검증 결과](reports/qa/travel-groups/) · [이전 계획/현재 출타 검증](reports/planning_outing_delivery.md)
- `web/lib/domain.ts`: 복귀 시간·미션·공유 모델 / `web/lib/tour-api.ts`: 관광공사 어댑터
- `web/db/schema.ts`, `web/drizzle/`: 그룹 DB 스키마와 마이그레이션
- `web/scripts/`: 재현 가능한 브라우저·API 검사 / `reports/`: 요구사항·결정·근거

최신 계정 변경은 단위 검사 89개와 Chrome·Edge 360/430/1440/1920px 가입·기록·다른 브라우저 복원·저장 실패/충돌 흐름을 통과했습니다. [현재 근거](reports/qa/accounts/). 이전 검증: 새 탐색·편집 흐름은 Chrome·Edge 4개 화면 크기(360/430/1440/1920px), 그룹·맞춤 코스·현재 출타는 두 브라우저의 작은 화면·데스크톱으로 검증했습니다. 실제 카카오맵으로 만남 장소 설정과 복귀시각 보존도 확인했습니다. 그룹 API의 이전 11개 케이스는 유지됩니다. 실제 휴대폰 OS/Safari·현장 조건은 별도 검증 대상입니다. 이번 UI 검사에서 관광공사 목록은 한도 초과 응답으로 격리했으며 실시간 목록 성공을 의미하지 않습니다. 전체 lint의 기존 규칙 오류는 남아 있습니다.

## 출처와 한계

강원 접경 5군 중심이며 춘천·속초는 관문으로 활용합니다. 통일부 DMZ 관광/카페 CSV와 국가보훈부 공개 데이터를 정규화한 기본 장소를 사용하고, 한국관광공사 응답은 수신 여부·출처를 구분합니다. 이전 실응답 검증: [데이터 리포트](reports/data_validation_summary.md).

교통·도보는 거리 기반 추정입니다. 예약·운영·실제 이동과 소속 부대 복귀 규정은 직접 확인해야 합니다. 휴가회수 레이더는 제도 준비 안내이며 보상을 보장하지 않습니다. GPS 자동 수집·군번·작전·근무정보·휴가증·신분증 이미지 입력 기능은 없습니다.

공사 출처: ⓒ한국관광공사. 고석정 사진: 한국문화관광연구원(2015), [공공누리 제1유형](https://www.kogl.or.kr/recommend/recommendDivView.do?division=img&oc=&recommendIdx=2453). 각 원천의 이미지 이용조건을 따릅니다.

추가 사진 6장은 공공누리·Wikimedia Commons에서 실제 장소와 개별 이용조건을 확인해 적용했습니다. [적용·보류·제외 전체 17건](reports/photo_sources.md)과 앱의 사진 출처 화면에서 원문·저작자·촬영 시점·라이선스를 확인할 수 있습니다.
