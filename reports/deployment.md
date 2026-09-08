# 배포 기록 — 2026-09-08

검토 URL: https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site

## 현재 버전 — 2026-09-08

- 즐겨찾기·계획/현재 출타·완료 확인·지도 지연 보완 버전9 공개 배포 상태: succeeded.
- Sites 프로젝트: appgprj_6a9e5a33eaa08191a72a52abf77522cc
- 버전: appgprj_6a9e5a33eaa08191a72a52abf77522cc~appgver_ec0868a8e5f48191b3c52079d965d6a8
- 배포: appgdep_6a9f60b48c3481919b0ce39044941b41
- 배포 소스 SHA: e6c6fcf094c21ea443dce7b4d736522f43ef2764
- 런타임 환경변수 revision2: DATA_GO_KR_SERVICE_KEY, KAKAO_MAP_JAVASCRIPT_KEY, TEST_ACCESS_PASSWORD, TEST_SESSION_SECRET를 secret으로 적용. 값은 Git에 포함하지 않음.
- 접근 범위: public. ChatGPT 인증 없이 진입하고 서비스의 임시 비밀번호 화면을 사용한다. API에도 세션 검사를 적용한다.
- 비밀번호 세션: 서버 서명, 12시간, HttpOnly/SameSite=Lax, HTTPS Secure. 누락된 설정은 입장 불가로 처리한다. 임시 공동 비밀번호는 개인 계정·사용자 식별·기기 동기화를 제공하지 않는다.

버전5에서 외부 공개 전환·비밀번호 입장을 먼저 배포했고, 익명 Chrome에서 실제 서비스 흐름을 확인했다. 버전6은 같은 주소와 접근 정책에 직접 코스 편집을 추가했다. 공개 브라우저 검사에서 Chrome·Edge 각각360/1440px 직접 코스 4개 환경과 Chrome360px 기존 가족·기록 흐름이 통과했다. 이 버전6 기록은 [직접 코스 구현·검증](custom_trip_delivery.md)을 참조한다.

버전7은 2026-09-08 09:55(KST) 배포 성공. 새 출타 흐름은 공개 URL에서 Chrome·Edge 각각360/1440px의 4개 환경이 통과했고, Chrome360px의 기존 관광 API·지도·가족·공유·장애 대응 흐름도 통과했다. [최신 구현·검증](planning_outing_delivery.md)을 참조한다.

이전 버전3의 인증된 HTTP 검사에서는 홈200, 철원 관광정보114건200/live, 무장애 후보4건200/live, 기상청8시간200/live를 확인했다. 이전 버전4는 소유자 비공개였으며, Chrome·Edge 각각360/1440px의 기존 흐름을 검증했다. 이 과거 결과와 현재 공개 접근을 구분한다.

버전8은 2026-09-08 10:05(KST) 배포 성공. 저장 코스를 빠르게 열었을 때 목록 수신 중의 일시적인 실패 표시를 로딩 안내로 보완했다.

버전8의 공개 Edge360px 검사에서 지도 키보다 기준 좌표가 늦게 도착하면 초기화되지 않는 문제를 발견했다. 버전9은 해당 의존성을 보완해 2026-09-08 10:11(KST) 배포 성공했다. 공개 Chrome·Edge 각각360/1440px의 4개 환경이 모두 통과했다. 실패와 재검사 결과를 최신 보고서에 함께 남긴다.

## 소스 관리

사용자 GitHub: https://github.com/ybuser/gunbeon-yeojido ([PR #4](https://github.com/ybuser/gunbeon-yeojido/pull/4) 점검, [PR #6](https://github.com/ybuser/gunbeon-yeojido/pull/6) 공개 입장, [PR #8](https://github.com/ybuser/gunbeon-yeojido/pull/8) 직접 코스 편집, [PR #10](https://github.com/ybuser/gunbeon-yeojido/pull/10) 계획·현재 출타와 개인 장소).

- b04b020: 접경5군 관광정보 및 추가3 API 실 호출 검증.
- 8acbf7a: 모바일 여행 UI 전면 개편, 지도·상세·가족 조건 상태 처리 수정.
- cc8405d: 개발 시 편집창 의존성의 뒤늦은 최적화를 막는 사전 번들 설정. 새 개발 서버에서 홈200 및 dialog 사전 번들 생성 확인.
- 위 개편·환경 보완 커밋의 GitHub Actions npm ci·타입 검사·16개 테스트·프로덕션 빌드 성공.

- `60401f9`: 제품 계획 진단.
- `1713b36`: 저장·제안 장소 보존, 방문 조건·예보 범위 및 스탬프 수정.
- `56efad6`: 브라우저 이동·다환경 자동 검사·키 없는 CI. 품질 및 브라우저 CI 성공.

- `0af5121`: 즐겨찾기·빈 코스·완료 확인·계획과 현재 출타 분리.
- `78ab63d`: 저장 계획 재편집·진행 중 편집 보호·현재 날씨 보정 및 회귀 검사.
- `ede91d3`: 저장 장소 목록 지연 시 로딩 안내와 회귀 검사.
- `c075e13`: 지도 기준 좌표 지연 시 초기화와 실제 API 지연 회귀 검사.

GitHub는 전체 프로젝트를, Sites 소스 저장소는 web 배포 소스를 관리한다. 검증 보고서와 공개 원천은 GitHub에 있고, 비밀값·API 원문 응답은 올리지 않는다. QA가 생성한 임시 여행 화면과 키 없는 검사 결과를 검증 증빙으로 보관한다.

## 카카오와 로컬 설정

JavaScript SDK 허용 도메인:

- http://localhost:3000
- https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site

Kakao Developers의 카카오맵 제품 사용 설정도 활성화됐다. 공통키 입력 위치는 저장소 루트 .env.local이며 web/.env.local이 연결한다. 로컬 파일과 배포 환경변수는 별개이므로 키 변경 시 배포 secret도 갱신해야 한다.

## 제출 전

실기기 사용 흐름과 대표 미션 운영조건을 검증하고, 공개 테스트 결과와 제출용 인증 조건을 확인한다. 제출 양식·이미지·시연자료는 공식 ① 웹·앱 개발 부문 안내에 맞춰 완성한다.
