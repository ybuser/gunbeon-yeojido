# 개발 인수인계

**2026-09-09 · 하루 여권 구현·공개 배포 완료.** 먼저 `AGENTS.md`와 이 문서, `local-setup.md`, `roadmap.md`를 읽는다. 과거 제안서는 최신 사용자 지시·이 기록·실제 코드보다 우선하지 않는다.

## 현재 기준선

| 항목 | 확인값 |
|---|---|
| 저장소 / 브랜치 | https://github.com/ybuser/gunbeon-yeojido / `master` |
| 제품 PR | [#18](https://github.com/ybuser/gunbeon-yeojido/pull/18), 2026-09-09 11:40 KST 병합 |
| 제품 병합 SHA | `36a01d34b5b4fe66b777f2b8baaa9f671c7ad828` |
| 구현 커밋 | `3a04e92` → `4d63e983212584a85d3ca012a0a07e3ed6ec008f` 모두 push 완료 |
| 문서 후속 | 이 기록과 검증 JSON은 제품 병합 뒤 문서 커밋으로 `master`에 추가. 현재 최종 SHA는 `git rev-parse HEAD` / `git log -1`로 확인 |
| Sites | 기존 프로젝트 `appgprj_6a9e5a33eaa08191a72a52abf77522cc`, **v12** |
| Sites 앱 소스 SHA | `906b8f4ec7e6eab6d78d652e0c450bf8c82f5ad8` |
| 공개 배포 | `appgdep_6aa0c70a66188191b4dd892925e1dc28`, **succeeded**, 2026-09-09 02:40:40 UTC |
| 접속 | https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/ · `/guide` · 임시 비밀번호1234 |
| 서버 D1 / secret | 기존 `DB` binding 유지. 이번 배포에 스키마·secret 변경 없음. env revision2 유지 |

## 완료한 기능과 검사

- 홈의 하루 여권, 출발 전 여유 조정 비교·적용·되돌리기, 실제 방문 선택 후 ‘하루의 한 장’, 선택형16초·4장면 안내. AI 추상 영상·진행 중 출타 편집은 후속 선택 범위.
- 정상 TourAPI5유형·검색·상세·무장애 유지. JSON/XML22·23·인증 오류 구분, 제공자 Retry-After 우선. SDK 공유와 같은 화면 지도 객체 재사용.
- 타입·77개 단위·빌드 통과. Chrome152/Edge152의360/430/1440/1920px8조건 통과. 실제 Kakao SDK360/430px 통과. 실제 휴대기기 검증은 아님.
- 기존 계획·현재출타·그룹·가이드 회귀 통과. GitHub CI의 품질/키 없는 브라우저 흐름 통과 후 병합.
- TourAPI 9/9 고성5유형 실제 조회149개 성공. 과거9/8 한도 오류와 구분. 실제 승인량이 증가했다는 증거는 아님.
- 공개 사이트 새 세션: 하루 여권 흐름/실제 Kakao430px·가이드360/1440px 통과. 공개 서버 실제 TourAPI149개 성공.
- 상세·스크린샷·공개 검증: `reports/day_passport_delivery.md`, `reports/qa/day-passport/`, `/guide`.

## 다른 PC에서 바로 이어가기

```sh
git clone https://github.com/ybuser/gunbeon-yeojido.git
cd gunbeon-yeojido
git status --short
git log -5 --oneline
```

새 clone은 `master`를 사용한다. 기존 작업 폴더는 변경사항을 먼저 보존한 뒤 `git fetch origin --prune`과 `git pull --ff-only`로 최신 상태를 확인한다. 이전 임시 checkout·브라우저 바이너리 경로를 복사하지 않는다.

`local-setup.md`의 Node22/npm 설치 → 기존 파일을 덮어쓰지 않는 키 없는 환경 생성 → 로컬 D1 migration → 개발 서버 → QA 순서를 따른다. **같은 Mac의 별도 원격 fresh clone에서 npm ci·타입·77개 단위·로컬 D12개 migration·개발 서버·그룹 API11시나리오를 재현했다.** 다른 OS 실제 실행을 검증한 것은 아니다. 검사 증빙은 `fresh-clone-groups.json`과 `fresh-clone.md`다.

Git으로 개인 localStorage·참여 쿠키·로컬 DB·실제 키·Playwright 바이너리·빌드 결과는 옮겨지지 않는다. 그룹은 운영 D1에 남아 있지만 새 브라우저에서는 새 초대가 필요할 수 있다. 복구 가능한 본인 인증은 아직 없다.

## GitHub / Sites / D1을 구분

- GitHub는 전체 저장소, Sites 소스 Git은 `web/` 앱 루트다. SHA가 다르며 둘을 혼용하지 않는다.
- 배포는 이 환경의 Sites building·hosting 지침을 읽고 **기존** `web/.openai/hosting.json` 프로젝트를 사용한다. 새 프로젝트/Worker를 만들지 않는다.
- 새 PC는 기존 Sites 프로젝트에서 최신 연결 정보와 단기 소스 credential을 조회하고 앱 루트 소스를 새로 clone/bootstrap한다. 이전 `/tmp` checkout에 의존하지 않는다. 토큰은 파일·Git config/URL에 넣지 않고 명령별 인증으로만 사용한다.
- GitHub의 `web/` 변경을 정확하게 반영한다. `.git`, `.env*`, `.wrangler`, `node_modules`, `dist`를 무차별 복사하지 않는다. 검증한 앱 소스 push → 해당 소스 빌드/패키지 → 버전 저장 → 기존 공개 접근에 배포 → 성공 상태 확인 순서다.
- 연결을 복구하지 못하면 로컬 개발은 계속하고 배포 미반영 상태를 기록한다.
- `wrangler.local.jsonc`의 placeholder DB ID는 `--local` 전용이다. 여기에 `--remote`를 붙이지 않는다. 운영 DB를 테스트용으로 초기화하지 않는다.

## 다음 첫 작업

1. **정상 기능 유지 + API 트래픽 확대:** 현재 계정 승인량/집계 단위/사용량을 확인해 `reports/api_capacity_requests.md`의 칸을 채운다. 공식 운영 기본 일10만과 운영팀 추가 증설, 공모전 지원 문의를 준비했다. 대표 API1개/팀1회 안내를 지킨다. 문의·신청·증설 승인은 아직 없으며 [#15](https://github.com/ybuser/gunbeon-yeojido/issues/15)는 열린 상태다.
2. Kakao 무료 배지와 일·월 사용량을 확인한다. 계정별 추가 쿼터/결제가 필요한지 실제 수치로 판단한다. 결제 설정은 변경하지 않았다.
3. 대표 코스 운영 조건, 실제 장병/동행자 사용성, 실제 Android/iPhone·Safari/PWA, 최종 제출 PDF/이미지·심사 접근을 `roadmap.md` 순서로 마무리한다.
4. TourAPI 서버 저장·동기화는 별도 양식·범위·시작 조건 답변 후 적용한다. 현재 운영 DB에 관광 응답 적재 없음.

과거 `reports/deployment.md`의 v9, ‘그룹은 같은 브라우저만 가능’, 날짜가 있는 둘러보기는 당시 기록이다. 최신 그룹은 서버 D1, 둘러보기는 날짜 없음. `api/status`의 고정 문자열을 배포 SHA 근거로 쓰지 않는다. 최종 제출 마감은 기존 확인 기준 **9/21 16:00 KST**, 제출 직전 공식 안내를 재확인한다.
