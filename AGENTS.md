# 군번여지도 강원 — agent 작업 안내

장병과 가족·연인·친구가 강원 접경 여행을 계획하고, 개인 복귀 기준을 확인하며, 다녀온 하루를 기록하는 모바일 웹/PWA다. 2026 관광데이터 활용 공모전 웹·앱 개발 부문 제출 목표는 **9월 21일 16:00 KST**다. 제출 직전 공식 안내를 재확인한다.

## 시작

1. `README.md`, `docs/handoff.md`, `docs/local-setup.md`, `docs/roadmap.md`를 읽는다.
2. 루트에서 현재 작업을 확인한다. 기존 변경을 되돌리거나 덮어쓰지 않는다.

```sh
git status --short
git branch --show-current
git log -5 --oneline
```

3. 새 PC는 `docs/local-setup.md`의 fresh clone/bootstrap을 따른다. 이전 PC의 임시 checkout·브라우저·홈 경로는 사용하지 않는다.
4. 사용자 최신 지시와 확인한 코드가 과거 보고서보다 우선한다. 구현·검사·push·배포는 각각 상태를 기록한다.

## 최우선: 정상 API 기능 유지와 제공량 확대

- 사용자가 정상적으로 쓰던 TourAPI 검색·목록·상세·사진·일정 연결과 Kakao 지도 기능을 보존한다.
- 실제 관광정보 제공량과 지원 가능한 이용 규모를 최대화한다. 불필요·중복 호출 감소, 필요한 데이터의 충분한 조회, 실제 승인량 확인과 증설을 함께 진행한다.
- 날짜가 다른 오류 기록만으로 현재 서비스 전체를 차단하지 않는다. 인증·일일 한도·일시 오류를 구분하고 회복 경로를 확인한다.
- 실제 API 성공, quota/fallback 응답, mock 검사를 별도로 기록한다. mock 통과를 실연동 성공으로 쓰지 않는다.
- 응답 저장·캐시 범위는 `reports/tourapi_operations_policy.md`, 용량 확대는 `reports/api_capacity_strategy.md`와 `reports/api_capacity_requests.md`를 따른다. 계정 한도나 초기화 시각을 추정하지 않는다.

## 코드와 명령

- 앱: `web/`; React 19·TypeScript·Vinext·Vite·Tailwind·Sites/Cloudflare Workers·D1/Drizzle.
- Node 22를 사용한다. 최소 22.13.0, 기존 CI 기준 22.18. 의존성은 추적된 lockfile로 설치한다.

```sh
cd web
npm ci
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
npm run dev
```

환경 파일 생성은 `docs/local-setup.md`를 먼저 따른다. 개발 URL은 `http://localhost:3000`이다.

변경 후 `web/`에서 필요한 검사를 실행한다.

```sh
npm run typecheck
npm test
npm run build
```

브라우저 QA는 `docs/local-setup.md`의 키 없는 Chromium 명령을 기본으로 쓴다. Chrome/Edge는 해당 PC에 설치돼 있을 때 추가한다. 전체 lint에는 기존 오류가 있으므로 실제 실행 결과와 신규 오류를 구분한다.

## 저장·배포·비밀값

- `web/.openai/hosting.json`은 기존 Sites 연결이다. 실제 앱/배포 작업은 해당 환경의 Sites building·hosting 지침을 읽고 기존 프로젝트에서 진행한다.
- GitHub 전체 저장소와 Sites 앱 소스 Git은 별개다. 새 PC에서는 기존 프로젝트의 현행 연결 정보를 조회하여 앱 소스를 새로 clone한다. 과거 임시 clone 경로에 의존하지 않는다.
- `web/wrangler.local.jsonc`의 DB ID는 **로컬 placeholder**다. `--local`로만 사용한다. 운영 D1은 Sites의 서버 DB이며 배포 환경에서 migration 상태를 따로 확인한다.
- `.env.local`, `.dev.vars`, 실제 키·쿠키·토큰을 Git·문서·채팅에 기록하지 않는다. 설정 확인은 변수명과 설정 유무를 우선한다. 로컬 환경 파일과 배포 secret은 독립이다.
- 로그인한 개인 여행·즐겨찾기·출타·스탬프와 그룹·초대·공유 일정·공개 한 수 제안은 D1이다. 체험 개인 여행은 브라우저 저장을 유지한다. Git clone으로 개인 localStorage·참여 쿠키·로컬 DB가 옮겨지지 않는다.
- 운영 DB를 로컬 테스트 DB처럼 초기화하지 않는다. 자동 검사 데이터는 생성한 테스트 그룹만 정리한다.

## 제품 계약

- 지역은 철원·화천·양구·인제·고성, 관문은 춘천·속초다.
- 계획 계산은 여행 날짜를 사용한다. 진행 중 출타의 편집 잠금과 완료 취소 흐름을 보존한다.
- 여유 조정은 비교·적용·되돌리기를 제공한다. 만남/복귀 지점을 자동 삭제하거나 좌표가 없는 이동시간을 만들어내지 않는다.
- 완료 기록은 사용자가 실제 다녀온 장소를 선택한다. 개인 복귀 시각·상세 좌표·민감한 직접 입력 장소는 공개 카드에서 제외한다.
- 개인 출타 진행·스탬프·복귀 시각을 그룹에 자동 전송하지 않는다. 군번·휴가증·작전/근무 정보·GPS 자동 수집을 추가하지 않는다.
- 외부 사진 출처·저작자·라이선스·크롭/재배포 범위는 `reports/photo_sources.md`를 확인한다.

## 공개 한 수와 기록 수정 계약

- `reports/advice_implementation.md`에 모델·권한·검사·사용 흐름이 있다. `/p/{id}`와 명시된 공개 제안 API만 비밀번호 예외이며 개인/그룹/일반 관광 API는 계속 보호한다.
- 공개 DTO에는 서버 검증한 관광지 참조·권역·질문만 넣는다. 기존 그룹의 `SharedPlan`을 재사용하지 않는다. 정상 TourAPI 검색과 상세를 유지하고 원문 응답은 D1에 적재하지 않는다.
- 제안 검토를 눌렀다고 반영 완료로 표시하지 않는다. 개인 계획의 실제 저장 후 서버 표시를 남기며 `adviceReceipt`로 중단 복구한다. 진행 중 출타·완료 기록을 덮지 않는다.
- 기록 수정은 원래 완료 시각 유지, 스탬프 선택 교체. `recordStatus`는 이전 기록의 날짜를 지어내지 않고 기록 상태를 유지한다. 계획 복원은 완료/방문 정보만 제거하고 새 출타를 시작하지 않는다.
- 신규 검사: `npm run test:advice`, `npm run test:advice-ui`. D1 0002/0003 migration은 추가 적용하며 기존 migration/스냅샷은 다시 쓰지 않는다.

## 종료 기록

- `docs/handoff.md`에 최종 branch/SHA/PR/push, 검사 결과, Sites source SHA/버전/배포 여부, 다음 첫 행동을 갱신한다.
- `docs/roadmap.md`의 완료 조건을 실제 증거에 따라 갱신한다. 새로운 실행 기록은 관련 `reports/`에 남긴다.
- 다른 PC에서 필요한 소스·문서·스크립트가 commit/push됐는지 확인한다. 미커밋/미push 항목은 명시한다.
- 문의 발송·계정 신청·결제·최종 접수는 사용자 지시와 기존 승인 범위에 맞춰 진행한다. 이미 승인된 범위를 다시 묻지 않는다.

## 개인 계정 저장 계약

- `docs/social-login-setup.md`, `reports/accounts_delivery.md`를 읽는다. Google/Naver 키·실동의가 없으면 소셜 로그인 완료로 보고하지 않는다. `.env.local`과 운영 Secret은 별개다.
- 개인 상태는 계정 조회·서버 hydration 성공 후 저장. `account-client.ts`의 저장 큐/revision/실패 상태를 우회하지 않는다. 같은 계정의 다른 기기를 동기적으로 따라가는 실시간 편집이 아니라, 충돌을 감지하는 서버 저장이다.
- `X-Gunbeon-Account`를 서버 쿠키와 대조한다. 다른 탭에서 계정이 바뀌었을 때 예전 화면을 새 계정으로 저장하지 않는다. 개인 API는 page cache에 넣지 않는다.
- 기기 기록은 명시적으로 가져온다. 충돌 사본과 가져오는 현재 출타의 recordId는 같은 매핑을 사용한다. 기존 그룹/공유/제안은 검증한 이전 쿠키 권한만 연결하며 소비된 쿠키를 다시 익명 권한으로 쓰지 않는다.
- 정상 TourAPI 응답/사진은 개인 DB에 저장하지 않는다. `cleanTravelState`의 user-authored/reference whitelist를 유지한다. 공개 DTO에 개인 계정 데이터가 섞이지 않게 한다.
- `npm run test:accounts`, `npm run test:accounts-ui`와 기존 메뉴 회귀 검사를 유지한다. migration0004는 추가 적용하며 기존 SQL/스냅샷을 다시 쓰지 않는다.
