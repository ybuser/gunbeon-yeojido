# 검토용 배포 기록 — 2026-09-07

검토 URL: https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site

## 현재 버전

- 디자인 개편 버전2 배포 상태: succeeded.
- Sites 프로젝트: appgprj_6a9e5a33eaa08191a72a52abf77522cc
- 버전: appgprj_6a9e5a33eaa08191a72a52abf77522cc~appgver_d2f0cdb7cf5c8191a17a8b05e2a072c6
- 배포: appgdep_6a9e70aa3eb88191bab28f9de91dfd9c
- 배포 소스 SHA: 24127c7e5155be01bc23796731fb35e7676b6d58
- 런타임 환경변수 revision1: DATA_GO_KR_SERVICE_KEY 및 KAKAO_MAP_JAVASCRIPT_KEY를 secret으로 등록·적용. 값은 Git에 포함하지 않음.
- 접근 범위: 소유자 전용 비공개 유지. 심사위원 공개 접근과 구분.

인증된 HTTP 요청으로 개편 홈200, 철원 관광정보114건200/live, 무장애 상세 후보4건200/live, 기상청8시간200/live를 확인했다. 상태 API는 지도 키 설정을 반환했다. 카카오 SDK는 로컬·배포 origin 모두200으로 인증 응답을 확인했다. 실제 브라우저 지도 타일·페이지 클릭·모바일 사용성 검증은 별도다.

[배포 HTTP 검증 결과](deployed_runtime_verification.json) · [로컬 API·SDK 검증](app_runtime_verification.json)

## 소스 관리

사용자 GitHub: https://github.com/ybuser/gunbeon-yeojido (master).

- b04b020: 접경5군 관광정보 및 추가3 API 실 호출 검증.
- 8acbf7a: 모바일 여행 UI 전면 개편, 지도·상세·가족 조건 상태 처리 수정.
- 위 개편 커밋의 GitHub Actions npm ci·타입 검사·16개 테스트·프로덕션 빌드 성공.

GitHub는 전체 프로젝트를, Sites 소스 저장소는 web 배포 소스를 관리한다. 검증 보고서와 공개 원천은 GitHub에 있고, 비밀값·검토용 원본 스크린샷·API 원문 응답은 올리지 않는다.

## 카카오와 로컬 설정

JavaScript SDK 허용 도메인:

- http://localhost:3000
- https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site

Kakao Developers의 카카오맵 제품 사용 설정도 활성화됐다. 공통키 입력 위치는 저장소 루트 .env.local이며 web/.env.local이 연결한다. 로컬 파일과 배포 환경변수는 별개이므로 키 변경 시 배포 secret도 갱신해야 한다.

## 제출 전

실기기 사용 흐름과 대표 미션 운영조건을 검증하고, 심사위원이 접근할 수 있는 범위로 배포 설정을 준비한다. 제출 양식·이미지·시연자료는 공식 ① 웹·앱 개발 부문 안내에 맞춰 완성한다.
