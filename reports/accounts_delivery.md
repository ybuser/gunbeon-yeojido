# 개인 계정과 여행 기록 더보기

2026-09-09. 사용자 요청: 각 여행 기록의 관리 버튼을 세로 더보기 메뉴로 정리하고 공유 카드는 바깥에서 찾기 쉽게 유지. 개인 계정과 서버 저장을 추가하며 Google/Naver 연결 또는 상세 연결 안내 제공.

## 구현

- 여행 카드 오른쪽 위 `⋮`: 기록 수정, 계획 복원, 새 여행 복사, 장소 다시 보기, 그룹 공유, 한 수 관리. 키보드·Escape·포커스 복귀는 Base UI Menu 사용.
- `공유 카드`는 카드 아래의 전폭 버튼. 계획의 출타 시작/여행 완료는 기존 주 동작 유지.
- `/login`, `/account`: 개인 아이디·비밀번호 가입/로그인, 별명 변경, 로그인 연결, 기기 데이터 가져오기, 로그아웃. `1234`는 체험 입장/초기 가입 초대용이며 개인 비밀번호가 아니다.
- 개인 여행·즐겨찾기·출타는 로그인 계정 D1 저장. 게스트는 기존 브라우저 저장 유지. 기존 기기 기록은 동의 후 가져오며 같은 ID의 다른 여행은 사본으로 보존한다.
- 가져오는 현재 출타는 사본 ID와 함께 변경한다. 계정에 진행 중인 출타가 있으면 그것을 유지한다. 그룹·공유 관리 권한은 기존 쿠키가 증명하는 범위만 연결한다.
- 익명으로 남긴 제안/신고의 이전 권한은 계정에 귀속한 해시를 통해 유지한다. 이미 연결한 쿠키만으로 게스트 권한을 되찾을 수 없다.
- 개인 상태는 읽기가 성공하기 전 쓰지 않는다. 저장은 직렬화·revision 비교. 연결 실패 시 재시도/JSON 백업, 충돌 시 백업 후 최신 기록 불러오기. 다른 탭에서 계정을 바꿔도 예전 화면의 계정 식별자가 요청과 일치하지 않으면 거절한다.
- 한 수 반영은 계정 저장 성공 뒤 표시. 재시도도 서버의 실제 저장본을 확인한다. 느린 서버 저장 중 일정표의 추가 편집·중복 제출·닫기를 잠근다.

## 서버 계약

`0004_accounts.sql` 추가. `accounts`, `account_sessions`, `account_identities`, `account_travel_state`, `oauth_flows`, `claimed_identities` 6개 테이블을 추가해 전체 17개. 기존 migration0000~0003은 유지한다.

- 무작위 256-bit 세션, DB에는 세션 해시, HttpOnly/SameSite=Lax/운영 Secure 쿠키, 14일 만료. 로그아웃은 해당 기기의 세션 폐기. 다른 기기 세션은 유지한다.
- scrypt N=16384/r=8/p=5, 무작위 16-byte salt. 원문 비밀번호 저장/로그 없음. [OWASP scrypt 설정](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [Workers node:crypto 지원](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/).
- 계정 API는 no-store, 동일 Origin/JSON 확인, 요청 크기 제한, prepared SQL. 가입·로그인 시도 제한. 계정 ID는 서버 쿠키로 결정하며 화면의 `X-Gunbeon-Account`와 대조한다.
- 저장 DTO는 사용자가 작성한 필드와 장소 ID만 정규화한다. TourAPI 원문·대표 사진·상세 응답은 D1에 넣지 않는다. 개인 저장과 그룹 공유/공개 DTO의 범위는 별개다.
- Google/Naver `Client ID/Secret`과 고정 `AUTH_BASE_URL`이 모두 있어야 버튼 활성화. Google은 jose 검증+PKCE+nonce+UserInfo subject 일치, Naver는 서버 token→me ID. 액세스 토큰 보관 없음. 이메일 자동 병합 없음.

## 현재 한계

Google/Naver 실제 Client ID/Secret이 아직 등록되지 않아 제공자 동의·실로그인은 미검증이다. 임시 아이디 로그인은 실제 서버 인증이다. 상세 발급/검수/배포 절차: [소셜 로그인 연결 안내](../docs/social-login-setup.md).

초기 계정은 비밀번호 재설정 메일과 자동 탈퇴를 제공하지 않는다. 정식 운영 전 복구·탈퇴·운영자 전용 문의 창구를 추가한다. 개인정보 안내는 구현된 저장 범위를 설명하는 테스트 안내이며 법률 검토 완료를 뜻하지 않는다.

서버 상태 충돌을 자동 덮어쓰지 않는다. 백업 JSON에는 개인 장소가 포함될 수 있으므로 개인 보관용이다. 사용자 사진/GPS 자동 수집은 없다.

## 검사와 증거

- 89개 단위 검사 통과: 새 whitelist·빈 계획·레거시 기록·scrypt·충돌 사본 출타 ID·가져오기 재시도 포함.
- 계정 API: 기기→계정 권한 이관, 같은 계정 다른 브라우저 복원, 다른 계정 격리, 이전 탭 보호, revision/CSRF/입력 검증, 세션·잘못된 OAuth 거절.
- `web/scripts/accounts-ui-qa.mjs`: 실제 가입→가져오기→기록 더보기/수정→두 번째 브라우저 재로그인→저장 실패 재시도→revision 충돌. 관광 API 목록은 키 없는 응답으로 격리하고 서버 계정/여행 DB는 실제 호출.
- Chrome/Edge의 여러 viewport는 모바일 화면 모의이며 실제 Android/iPhone OS 검사를 의미하지 않는다.
- 테스트 계정은 무작위 자격정보의 합성 데이터이며 원문 비밀번호는 보고서에 남기지 않는다. 운영 API 검사에서 만든 공유/그룹만 정리한다. 운영 DB 전체를 초기화하지 않는다.

최종 검사·CI·배포 상태는 `reports/qa/accounts/`와 `docs/handoff.md`에 기록한다. 제공자 실로그인은 설정 전까지 완료 처리하지 않는다.

## 최종 공개 확인

PR [#22](https://github.com/MySonIsSoldier/gunbeon-yeojido/pull/22) 병합, Sites v14 공개 배포 완료. 타입·89단위·빌드와 기존/신규 전체 브라우저 CI 통과 후 반영했다. 운영 D1의 17개 테이블을 확인했다.

공개 사이트의 실제 계정 API6그룹과 Chrome153/430px 가입→가져오기→메뉴 수정→다른 브라우저 복원→저장 실패 재시도/충돌 검사가 통과했다. `reports/qa/accounts/public-api.json`, `public-ui.json`, `deployment.json`, `ci.json` 참조. Google/Naver 실제 제공자 동의는 키 설정 후 남아 있다.
