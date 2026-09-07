# 검토용 배포 기록 — 2026-09-07

검토 URL: https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site

## 현재 버전

- 여행 계획 보존 및 다환경 점검 보완 버전4 배포 상태: succeeded.
- Sites 프로젝트: appgprj_6a9e5a33eaa08191a72a52abf77522cc
- 버전: appgprj_6a9e5a33eaa08191a72a52abf77522cc~appgver_8fa0cbddd1bc8191898050906f20b2ac
- 배포: appgdep_6a9e934121888191b85f3477aa1af169
- 배포 소스 SHA: 263976b35775ef7e1a51e40797379b68d61a90dd
- 런타임 환경변수 revision1: DATA_GO_KR_SERVICE_KEY 및 KAKAO_MAP_JAVASCRIPT_KEY를 secret으로 등록·적용. 값은 Git에 포함하지 않음.
- 접근 범위: 소유자 전용 비공개 유지. 심사위원 공개 접근과 구분.

이전 버전3에서는 인증된 HTTP 요청으로 개편 홈200, 철원 관광정보114건200/live, 무장애 상세 후보4건200/live, 기상청8시간200/live를 확인했다. 상태 API는 지도 키 설정을 반환했다. 카카오 SDK는 로컬·배포 origin 모두200으로 인증 응답을 확인했다. 버전4에서 Chrome·Edge 각각 360/1440px의 여행 생성·지도·저장·부모 제안·기록·공유 흐름 4개가 통과했다. [QA 보고서](browser_qa_report.md)와 [배포 실행 결과](qa/2026-09-07-deployed-recheck/results.json)를 참조한다. 실기기와 실제 사용자 사용성은 별도다.

[배포 HTTP 검증 결과](deployed_runtime_verification.json) · [로컬 API·SDK 검증](app_runtime_verification.json)

## 소스 관리

사용자 GitHub: https://github.com/ybuser/gunbeon-yeojido (작업 브랜치 `qa/product-flow-audit`, [PR #4](https://github.com/ybuser/gunbeon-yeojido/pull/4)).

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

실기기 사용 흐름과 대표 미션 운영조건을 검증하고, 심사위원이 접근할 수 있는 범위로 배포 설정을 준비한다. 제출 양식·이미지·시연자료는 공식 ① 웹·앱 개발 부문 안내에 맞춰 완성한다.
