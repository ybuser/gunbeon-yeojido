# 둘러보기·사진·사용 가이드 전달 기록

2026-09-08 · [이슈 #13](https://github.com/MySonIsSoldier/gunbeon-yeojido/issues/13) · [PR #14](https://github.com/MySonIsSoldier/gunbeon-yeojido/pull/14)

## 공개 적용

- [서비스](https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/) / [실제 화면 사용 가이드](https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/guide)
- 테스트 비밀번호 1234. 기존 공개 접근과 서버 환경설정 유지.
- Sites 버전 11, 2026-09-08 05:12:08 UTC 배포 성공.
- 배포 소스: `005ea16550fd57d9fa15478d3e4b50b92765c62f`. 이후 변경은 이미지 준비 완료를 기다리는 QA 스크립트와 전달 문서이며 앱 동작은 동일.
- [UX 검토·다음 단계](discovery_ux_review.md), [사진 출처 17건](photo_sources.md), [가이드](usage_guide.md).

## 결과

- 둘러보기에서 개인 출발 날짜·시간·복귀 계산 제거. 지역별 세 가지, 총 15개 추천을 먼저 살펴보고 일정표에서 날짜·시간 편집.
- 첫 만남 지도, 다른 지역에서 직접 만들기, 출타 시작 확인을 다녀올 때 복귀시각 보존, 그룹 저장 안내, 지난 계획 구분 개선.
- 외부 사진 6장 실제 적용. 촬영 시점·원문·저작자·라이선스·화면 크롭 여부 별도 표기. 원본 사진 내용은 변경하지 않음.
- 실제 화면 8장의 웹·README 가이드. 가이드 링크로 입장하면 테스트 로그인 후 가이드로 복귀.
- 인증된 자체 이미지도 페이지 메모리로 재사용. 공개 환경에서 반복 열기에도 사진당 1회 요청 확인.

## 검증

- 단위 60개, TypeScript, 빌드 통과.
- 탐색·편집 8환경(Chrome/Edge × 360/430/1440/1920px), 그룹·맞춤 코스·현재 출타 각 4환경, 총 20개 흐름 통과.
- 가이드 페이지 4환경, 실제 Kakao SDK로 만남 지도·출타 설정·완료 취소 시나리오 통과.
- 공개 주소에서도 실제 Kakao SDK 시나리오 및 Chrome/Edge 작은 화면·데스크톱의 가이드·사진 재사용 통과. [공개 시나리오](qa/discovery/public-flow.json), [공개 가이드](qa/discovery/public-guide.json).
- 공개 검사에서 메모리 이미지가 준비되기 전 `decode()`를 호출해 발생한 검사 실패를 확인. `currentSrc`·완료·실제 너비를 기다리도록 검사 수정 후 전 환경 통과. 앱의 사진 표시 실패로 기록하지 않음.

관광공사 목록은 일일 한도 초과 응답으로 격리했습니다. 실시간 목록 성공을 뜻하지 않습니다. 실제 모바일 OS/Safari·현장 교통/운영 조건은 별도 확인 대상입니다. 기존 전체 lint 규칙 오류는 남아 있고 새 독립 모듈 lint는 통과했습니다.

GitHub 자동 검사도 모두 통과했습니다. [브라우저 CI](https://github.com/MySonIsSoldier/gunbeon-yeojido/actions/runs/34189862533)는 키 없는 환경에서 그룹 API·그룹 UI·탐색·가이드·맞춤 코스·현재 출타를 재현했습니다. [품질 검사](https://github.com/MySonIsSoldier/gunbeon-yeojido/actions/runs/34189862536)는 TypeScript·단위 검사·빌드를 확인했습니다.

PR #14는 2026-09-08 05:18:23 UTC에 머지됐고 이슈 #13은 종료됐습니다. 머지 커밋: `b16265f7cdc5efe5651d61472ccbd2865e55583c`.
