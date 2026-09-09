# 개발 인수인계

**2026-09-09 · 여행 기록 수정과 한 수 보태기 공개 배포 완료.** `AGENTS.md` → 이 문서 → `local-setup.md` → `roadmap.md` 순서로 읽는다. 최신 사용자 지시와 실제 코드가 과거 기획·검토안보다 우선한다.

## 현재 기준선

| 항목 | 확인값 |
|---|---|
| GitHub / 기본 브랜치 | https://github.com/ybuser/gunbeon-yeojido / `master` |
| 제품 PR | [#19](https://github.com/ybuser/gunbeon-yeojido/pull/19), 2026-09-09 05:05:19 UTC 병합 |
| 제품 병합 SHA | `a2fa7f79501aad2af8dee659813bce36e162ecd5` |
| 구현 커밋 | `6d4b9f8` → `906d9a4` → `04f68d96dcf2a8ab381344d4d9b923198c5b3b67` 모두 push/병합 |
| 문서 후속 | 이 인수인계·최종 검사 JSON은 제품 병합 뒤 문서 커밋. 최종 문서 SHA는 `git log -1`로 확인 |
| Sites | 기존 프로젝트 `appgprj_6a9e5a33eaa08191a72a52abf77522cc`, **v13** |
| Sites 앱 소스 SHA | `4c2c98f178e1130c626c25d067f28b4fb8fbb83e` |
| 앱 소스 tree | `0349cee1f1a77402cdda29c0f6dcaa06847033fe` — GitHub `HEAD:web`와 동일 |
| 공개 배포 | `appgdep_6aa0e91e08c88191b465b15d4ddd304d`, **succeeded**, 2026-09-09 05:06:04 UTC |
| 주소 | https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/ · `/guide` · 임시 비밀번호1234 |
| 익명 공개 | 사용자가 발행한 `/p/{32자리 공개 ID}`와 전용 공개 API만 비밀번호 예외 |
| D1 / secret | DB binding 유지, migration0002/0003 추가 적용. secret 변경 없음, env revision2 |

## 이번 기능과 검사

- 기록 이름·실제 방문 장소·스탬프 수정, 원래 완료 날짜 보존. 확인 후 같은 계획으로 복원하거나 기록을 유지한 새 여행 복사. 현재 출타 자동 시작 없음.
- 질문+관광지 단위 공개 제안, 작성자 개인 일정 검토·저장 후 반영 표시, 중단 시 `adviceReceipt` 복구, 공개안으로 새 여행 만들기.
- PNG/링크·X 작성창 공유, 제안 마감·신고·숨김·삭제, 만료 후 본인 제안 삭제. 관리 쿠키를 잃었을 때의 정식 계정 복구는 아직 없다.
- D1에는 공개 장소 참조·질문·선택형 제안·상태만 저장한다. TourAPI 원문/이미지 적재, 개인 날짜/만남/복귀 정보 자동 공개는 없음.
- 타입·85단위·빌드 통과. 실제 D1 API10시나리오 통과. Chrome153/Edge152 각360·430·1440·1920px 통과. 최종 만료화면 회귀와19장 가이드도 통과. 실제 휴대폰이 아닌 데스크톱 viewport/touch 모의다.
- GitHub 품질/기존+신규 전체 키 없는 브라우저 CI 통과 후 병합. `reports/qa/advice/ci.json` 참조.
- 실제 서버 TourAPI 고성 카페3개 검색, 선택 장소 상세 검증201, 공개 제안 재조회 결측0. 로컬·운영 결과 분리. 자동 UI의 목록 오류 격리를 실제 API 성공으로 쓰지 않는다.
- 공개 v13에서 별도 쿠키 API10시나리오, Chrome430px 전체 흐름, 실제 TourAPI, 가이드 검사. `reports/qa/advice/public-*.json` 참조.
- 설계·제한·화면: `reports/advice_implementation.md`, `reports/advice_benchmark.md`, `reports/usage_guide.md`, `/guide`. 초안 리뷰 문서는 발견 당시 기록이며 최종 미해결 목록이 아니다.

## 다른 PC에서 재개

```sh
git clone https://github.com/ybuser/gunbeon-yeojido.git
cd gunbeon-yeojido
git status --short
git log -5 --oneline
```

기존 폴더는 미커밋 변경을 먼저 보존하고 `git fetch origin --prune` / `git pull --ff-only`로 최신 상태를 확인한다. Node22/npm 설치·환경 파일·D1 migration·키 없는 QA는 `local-setup.md`를 따른다. 이전 PC의 `/tmp` checkout이나 브라우저 바이너리 경로를 복사하지 않는다.

앱 루트는 `web/`다. 새 D1 schema0002/0003은 추가 적용하고 기존 SQL/스냅샷을 수정하지 않는다. `npm run test:advice`는 격리된3개 HTTP쿠키 세션, `npm run test:advice-ui`는 작성자/방문자 브라우저를 나눠 검증한다. 테스트가 만든 공유만 정리하고 운영 DB를 초기화하지 않는다.

Git clone은 개인 localStorage·참여/관리 쿠키·로컬 DB·실제 키·Playwright 바이너리를 옮기지 않는다. 그룹은 운영 D1, 개인 계획은 해당 브라우저에 남아 있다. 공개 링크는 새 기기에서도 열리지만 관리 권한은 자동 이동하지 않는다. 정식 계정·복구 정책은 후속 결정이다.

## GitHub / Sites / D1

- GitHub는 전체 저장소, Sites source Git은 `web/` 앱 루트다. SHA를 혼용하지 않는다. `HEAD:web` tree를 비교해 같은 앱인지 확인한다.
- 이 환경의 Sites building·hosting 지침과 기존 `.openai/hosting.json`을 사용한다. 새 Site/Worker를 만들지 않는다.
- 새 PC는 기존 Sites 프로젝트에서 현재 연결과 단기 credential을 조회해 앱 소스를 새로 준비한다. 토큰은 파일·Git config/URL·로그에 저장하지 않고 명령별 인증으로만 쓴다.
- 검증한 앱 소스 push → 같은 소스의 build/package → 버전 저장 → 기존 공개 접근 배포 → 성공 상태 → 새 세션 검사를 잇는다. 사용자 승인 범위를 중복 질문하지 않는다.
- 로컬 `wrangler.local.jsonc`의 DB ID는 placeholder이며 `--local` 전용이다. 여기에 `--remote`를 붙이지 않는다. 운영 D1은 Sites 배포 migration으로 관리한다.
- `.env.local`과 배포 secret은 독립이다. 키를 Git/문서에 남기지 않는다. 연결 장애 시 로컬 진행과 배포 미반영 상태를 구분해 기록한다.

## 다음 첫 작업

1. [#20](https://github.com/ybuser/gunbeon-yeojido/issues/20): 실제 장병·가족·연인·친구5–10쌍이 공개 질문→제안→검토→새 여행을 이해하는지 관찰. Android Chrome / iPhone Safari의 PNG저장·인스타 링크 스티커·X 작성창 확인. 전환율 수치를 꾸미지 않는다.
2. [#15](https://github.com/ybuser/gunbeon-yeojido/issues/15): 정상 TourAPI 기능 유지+승인량/집계 단위 확인·운영계정/공모전 증설. 문의 초안은 `api_capacity_requests.md`. 실제 문의 발송·증설 승인은 아직 없음.
3. Kakao 무료 배지·일/월 사용량을 실제 계정 수치로 확인한다. 결제 설정은 변경하지 않았다.
4. 대표 코스 운영/예약/접근 조건, 실제 사용자, 실기기·PWA, 최종 기능설명서/이미지/심사 접근을 `roadmap.md` 순서로 마무리한다. 기존 확인 마감9/21 16:00 KST는 제출 직전 공식 안내를 재확인한다.
5. TourAPI 원문 서버 저장/동기화는 별도 저장 조건 답변 후 적용한다. 현재 D1 관광 응답 적재 없음.

직전 v12의 하루 여권/여유 조정/16초 안내와 fresh clone 재현 기록은 `reports/day_passport_delivery.md`, `reports/qa/day-passport/`에 있다. 과거 v9 문서·그룹 브라우저 한정 설명·날짜가 있는 둘러보기는 현행 사양이 아니다.
