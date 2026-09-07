# 배포 기록 — 2026-09-08

검토 URL: https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site

## 현재 버전 — 2026-09-08

- 직접 코스 편집·사진 표지 버전6 공개 배포 상태: succeeded.
- Sites 프로젝트: appgprj_6a9e5a33eaa08191a72a52abf77522cc
- 버전: appgprj_6a9e5a33eaa08191a72a52abf77522cc~appgver_a55fd71dd4408191a39009883c545427
- 배포: appgdep_6a9f4dc40af88191bb1eeac6b96ceb47
- 배포 소스 SHA: 82c5638aac505e16bae39807fbc872b2bc307acf
- 런타임 환경변수 revision2: DATA_GO_KR_SERVICE_KEY, KAKAO_MAP_JAVASCRIPT_KEY, TEST_ACCESS_PASSWORD, TEST_SESSION_SECRET를 secret으로 적용. 값은 Git에 포함하지 않음.
- 접근 범위: public. ChatGPT 인증 없이 진입하고 서비스의 임시 비밀번호 화면을 사용한다. API에도 세션 검사를 적용한다.
- 비밀번호 세션: 서버 서명, 12시간, HttpOnly/SameSite=Lax, HTTPS Secure. 누락된 설정은 입장 불가로 처리한다. 임시 공동 비밀번호는 개인 계정·사용자 식별·기기 동기화를 제공하지 않는다.

버전5에서 외부 공개 전환·비밀번호 입장을 먼저 배포했고, 익명 Chrome에서 실제 서비스 흐름을 확인했다. 버전6은 같은 주소와 접근 정책에 직접 코스 편집을 추가했다. 공개 브라우저 검사에서 Chrome·Edge 각각360/1440px 직접 코스 4개 환경과 Chrome360px 기존 가족·기록 흐름이 통과했다. [최신 구현·검증](custom_trip_delivery.md)을 참조한다.

이전 버전3의 인증된 HTTP 검사에서는 홈200, 철원 관광정보114건200/live, 무장애 후보4건200/live, 기상청8시간200/live를 확인했다. 이전 버전4는 소유자 비공개였으며, Chrome·Edge 각각360/1440px의 기존 흐름을 검증했다. 이 과거 결과와 현재 공개 접근을 구분한다.

## 소스 관리

사용자 GitHub: https://github.com/ybuser/gunbeon-yeojido ([PR #4](https://github.com/ybuser/gunbeon-yeojido/pull/4) 점검, [PR #6](https://github.com/ybuser/gunbeon-yeojido/pull/6) 공개 입장, [PR #8](https://github.com/ybuser/gunbeon-yeojido/pull/8) 직접 코스 편집).

- b04b020: 접경5군 관광정보 및 추가3 API 실 호출 검증.
- 8acbf7a: 모바일 여행 UI 전면 개편, 지도·상세·가족 조건 상태 처리 수정.
- cc8405d: 개발 시 편집창 의존성의 뒤늦은 최적화를 막는 사전 번들 설정. 새 개발 서버에서 홈200 및 dialog 사전 번들 생성 확인.
- 위 개편·환경 보완 커밋의 GitHub Actions npm ci·타입 검사·16개 테스트·프로덕션 빌드 성공.

- `60401f9`: 제품 계획 진단.
- `1713b36`: 저장·제안 장소 보존, 방문 조건·예보 범위 및 스탬프 수정.
- `56efad6`: 브라우저 이동·다환경 자동 검사·키 없는 CI. 품질 및 브라우저 CI 성공.

GitHub는 전체 프로젝트를, Sites 소스 저장소는 web 배포 소스를 관리한다. 검증 보고서와 공개 원천은 GitHub에 있고, 비밀값·API 원문 응답은 올리지 않는다. QA가 생성한 임시 여행 화면과 키 없는 검사 결과를 검증 증빙으로 보관한다.

## 카카오와 로컬 설정

JavaScript SDK 허용 도메인:

- http://localhost:3000
- https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site

Kakao Developers의 카카오맵 제품 사용 설정도 활성화됐다. 공통키 입력 위치는 저장소 루트 .env.local이며 web/.env.local이 연결한다. 로컬 파일과 배포 환경변수는 별개이므로 키 변경 시 배포 secret도 갱신해야 한다.

## 제출 전

실기기 사용 흐름과 대표 미션 운영조건을 검증하고, 공개 테스트 결과와 제출용 인증 조건을 확인한다. 제출 양식·이미지·시연자료는 공식 ① 웹·앱 개발 부문 안내에 맞춰 완성한다.
