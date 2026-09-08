# 2026-09-08 둘러보기·UX·사진·가이드 검증

- 단위 검사 60개 통과 (`npm test`). 추천 15개 완전성, 지역·일정 분리, TourAPI 우선 매칭, 직접 장소의 외부 사진 오매칭 방지 포함.
- `browser.json`: Chrome·Edge, 360/430/1440/1920px × 2브라우저 = 8개. 날짜 없는 탐색→편집→저장→새로고침 복원→브리핑/완료/공유.
- `groups.json`: Chrome·Edge, 360/1440px = 4개. 빈 그룹 여행/편집/초대/다른 브라우저 세션 참여/그룹 간 구분. 임시 그룹은 테스트 후 삭제.
- `custom.json`: 같은 4환경. 관광정보 검색 실패, 직접 장소, 순서·시간 편집, 추천 가져오기, 취소/완료/민감정보 제외.
- `outing.json`: 같은 4환경. 30분 후에도 탐색 값 고정, 즐겨찾기, 빈 코스, 현재 출타 카운트다운/날씨/진행 되돌리기/완료 확인.
- `guide.json`: 430px Chrome, 실제 Kakao SDK. 다른 지역에서 빈 코스 생성, 만남 미지정 계획에서 지도 설정, 저장·취소 후 오늘 복귀시각 유지, 다음 장소 길찾기·정보, 완료 취소.
- `guide-page.json`: Chrome·Edge 작은 화면/데스크톱. 가이드 로그인 복귀, 8장 이미지 로딩, 가로 넘침, 인증된 로컬 사진의 페이지 메모리 재사용.

관광공사 목록 호출은 **일일 한도 초과 응답을 격리**했습니다. 실제 TourAPI 목록 성공을 뜻하지 않습니다. Kakao SDK를 사용하는 가이드 조작은 별도로 실제 연결했습니다. 화면 크기와 터치를 모사한 데스크톱 브라우저이며 실제 iOS/Android OS 시험은 아닙니다.

검사 스크립트: `web/scripts/{browser-qa,groups-ui-qa,custom-trip-qa,planning-outing-qa,discovery-guide-qa,guide-page-qa}.mjs`. `QA_BASE_URL`, `QA_BROWSER_CHANNELS`, `QA_CASES`, `QA_EDGE_EXECUTABLE`, `QA_OUT_DIR`로 실행환경을 지정합니다. 브라우저 검사에는 `QA_LIVE=0`으로 공급자 호출을 격리합니다. 가이드 조작은 실제 카카오맵 키가 필요하며 CI의 키 없는 기본 흐름과 구분합니다.

실제 캡처는 [사용 가이드](../../usage_guide.md), 앱 `/guide`, `web/public/guide/`에 보관했습니다. 전체 lint의 기존 규칙 오류는 남아 있으며 새 독립 모듈은 별도 lint를 확인했습니다.
