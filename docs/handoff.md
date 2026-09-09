# 개발 인수인계

**2026-09-09 · 기록 더보기·개인 계정·서버 여행 저장 공개 배포 완료.** `AGENTS.md` → 이 문서 → `local-setup.md` → `roadmap.md` 순서로 읽는다. 최신 사용자 지시와 실제 코드가 과거 기획·검토안보다 우선한다.

## 현재 기준선

| 항목 | 확인값 |
|---|---|
| GitHub / 기본 브랜치 | https://github.com/ybuser/gunbeon-yeojido / `master` |
| 제품 PR / 이슈 | [#22](https://github.com/ybuser/gunbeon-yeojido/pull/22) 병합, [#21](https://github.com/ybuser/gunbeon-yeojido/issues/21) 종료 |
| 제품 병합 SHA | `54abdc8b5ec53459f7789bbb2105997119696805` |
| 구현·검증 커밋 | `04fd0e4` → `66d2392` → `c6cea60` → `378e7ba` → `ec7c163` → `96899b1` → `41d6cdd` 모두 push/병합 |
| 문서 후속 | 이 인수인계·운영 검사 JSON은 제품 병합 뒤 문서 커밋. 최종 문서 SHA는 `git log -1`로 확인 |
| Sites | 기존 프로젝트 `appgprj_6a9e5a33eaa08191a72a52abf77522cc`, **v14** |
| Sites 앱 소스 SHA | `f8d54f587b148446df393759df8cfcb4be5a80b7` |
| 앱 소스 tree | `e7cfad8b73bf7f6c8ca50b42b1bf6b1eff2e4f5a` — GitHub `HEAD:web`와 동일 |
| 공개 배포 | `appgdep_6aa0faf77388819195248a9850ec655e`, **succeeded**, 2026-09-09 06:21:55 UTC |
| 주소 | https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/ · `/login` · `/account` · `/guide` |
| 로그인 | 개인 아이디 계정 + 체험 입장1234. Google/Naver Client ID/Secret 미설정, 실동의 미검증 |
| D1 / secret | migration0004 추가 적용, 운영 DB17개 테이블 확인. 기존 binding/Secret 유지, env revision2 |

## 이번 기능과 검사

- 기록 오른쪽 위 ⋮에 관리 메뉴를 정리했다. 공유 카드는 별도 전폭 버튼. 완료 기록 수정·계획 복원·새 여행 복사와 한 수 검토/반영은 유지한다.
- 실제 개인 아이디·비밀번호 인증, 계정별 개인 여행/즐겨찾기/출타/스탬프 D1 저장. 기기 기록·그룹·공개 공유/제안 관리 권한은 사용자가 가져오기를 선택한 뒤 검증한 이전 쿠키 범위만 연결한다.
- 서버 읽기 성공 전 쓰지 않는다. 저장 큐와 revision 충돌, 저장 실패 재시도/JSON 백업, 다른 탭의 계정 변경을 방어한다. 기존 계정 자료를 무조건 덮어쓰지 않는다.
- Google/Naver OAuth 경로는 구현했지만 아직 키·제공자 실로그인이 없다. `docs/social-login-setup.md`의 정확한 주소·변수·콘솔 절차를 따른다. 기존 개인 계정은 내 계정의 로그인 연결로 연결한다.
- 타입·89단위·빌드 통과. 계정 API6그룹 통과. Chrome153/Edge152 각360·430·1440·1920px 실제 가입→기기 가져오기→메뉴 수정→다른 브라우저 복원, 저장 실패/충돌 검증. 실제 휴대폰이 아닌 viewport/touch 모의다.
- 최종 GitHub 품질2개·전체 키 없는 브라우저 CI 통과 후 병합. [최종 브라우저 실행](https://github.com/ybuser/gunbeon-yeojido/actions/runs/34318329541): 계정/그룹/관광 fallback/22장 가이드/직접 코스/현재 출타/하루 여권/공개 한 수까지 포함. `reports/qa/accounts/ci.json` 참조.
- CI에서 게스트 입력이 hydration 이전에 실행되던 검사 문제는 app-ready 대기와 입력 값 assertion으로 수정했다. 게스트 실패 화면·응답 상태도 수집한다.
- 운영 재검사 결과는 `reports/qa/accounts/public-*.json`에 별도 기록한다. UI의 관광 목록 격리는 실제 TourAPI 성공 근거가 아니다. 실제 제공자 소셜 로그인도 이번 통과 항목이 아니다.
- README·22장 `/guide`·`reports/usage_guide.md`에 실제 화면/사용 시나리오. 구현·한계는 `reports/accounts_delivery.md`.

## 다른 PC에서 재개

```sh
git clone https://github.com/ybuser/gunbeon-yeojido.git
cd gunbeon-yeojido
git status --short
git log -5 --oneline
```

기존 폴더는 미커밋 변경을 먼저 보존하고 `git fetch origin --prune` / `git pull --ff-only`로 최신 상태를 확인한다. Node22/npm 설치·환경 파일·D1 migration·키 없는 QA는 `local-setup.md`를 따른다. 이전 PC의 `/tmp` checkout이나 브라우저 바이너리 경로를 복사하지 않는다.

앱 루트는 `web/`다. 새 D1 schema0002/0003/0004는 추가 적용하고 기존 SQL/스냅샷을 수정하지 않는다. `npm run test:advice`는 격리된3개 HTTP쿠키 세션, `npm run test:advice-ui`는 작성자/방문자 브라우저를 나눠 검증한다. 테스트가 만든 공유만 정리하고 운영 DB를 초기화하지 않는다.

Git clone은 개인 localStorage·참여/관리 쿠키·로컬 DB·실제 키·Playwright 바이너리를 옮기지 않는다. 운영에서 같은 계정으로 로그인하면 서버 여행·그룹·연결한 공유를 이어간다. 로컬 DB와 운영 DB는 별도다. 체험 이용의 기기 기록/관리 권한은 내 계정에서 명시적으로 가져와야 한다. 비밀번호 복구/자동 탈퇴는 후속이다.

## GitHub / Sites / D1

- GitHub는 전체 저장소, Sites source Git은 `web/` 앱 루트다. SHA를 혼용하지 않는다. `HEAD:web` tree를 비교해 같은 앱인지 확인한다.
- 이 환경의 Sites building·hosting 지침과 기존 `.openai/hosting.json`을 사용한다. 새 Site/Worker를 만들지 않는다.
- 새 PC는 기존 Sites 프로젝트에서 현재 연결과 단기 credential을 조회해 앱 소스를 새로 준비한다. 토큰은 파일·Git config/URL·로그에 저장하지 않고 명령별 인증으로만 쓴다.
- 검증한 앱 소스 push → 같은 소스의 build/package → 버전 저장 → 기존 공개 접근 배포 → 성공 상태 → 새 세션 검사를 잇는다. 사용자 승인 범위를 중복 질문하지 않는다.
- 로컬 `wrangler.local.jsonc`의 DB ID는 placeholder이며 `--local` 전용이다. 여기에 `--remote`를 붙이지 않는다. 운영 D1은 Sites 배포 migration으로 관리한다.
- `.env.local`과 배포 secret은 독립이다. 키를 Git/문서에 남기지 않는다. 연결 장애 시 로컬 진행과 배포 미반영 상태를 구분해 기록한다.

## 다음 첫 작업

0. Google/Naver Client ID/Secret과 AUTH_BASE_URL을 로컬/운영에 각각 설정한 뒤 신규 로그인·기존 계정 연결·재로그인을 실제 제공자에서 확인한다. 네이버 검수와 Google 게시/도메인 요건을 확인하고, 비밀번호 복구/탈퇴·문의 창구를 정식 운영 전에 보완한다. 키 원문은 채팅에 요청하지 않는다.

1. [#20](https://github.com/ybuser/gunbeon-yeojido/issues/20): 실제 장병·가족·연인·친구5–10쌍이 공개 질문→제안→검토→새 여행을 이해하는지 관찰. Android Chrome / iPhone Safari의 PNG저장·인스타 링크 스티커·X 작성창 확인. 전환율 수치를 꾸미지 않는다.
2. [#15](https://github.com/ybuser/gunbeon-yeojido/issues/15): 정상 TourAPI 기능 유지+승인량/집계 단위 확인·운영계정/공모전 증설. 문의 초안은 `api_capacity_requests.md`. 실제 문의 발송·증설 승인은 아직 없음.
3. Kakao 무료 배지·일/월 사용량을 실제 계정 수치로 확인한다. 결제 설정은 변경하지 않았다.
4. 대표 코스 운영/예약/접근 조건, 실제 사용자, 실기기·PWA, 최종 기능설명서/이미지/심사 접근을 `roadmap.md` 순서로 마무리한다. 기존 확인 마감9/21 16:00 KST는 제출 직전 공식 안내를 재확인한다.
5. TourAPI 원문 서버 저장/동기화는 별도 저장 조건 답변 후 적용한다. 현재 D1 관광 응답 적재 없음.

직전 v12의 하루 여권/여유 조정/16초 안내와 fresh clone 재현 기록은 `reports/day_passport_delivery.md`, `reports/qa/day-passport/`에 있다. 과거 v9 문서·그룹 브라우저 한정 설명·날짜가 있는 둘러보기는 현행 사양이 아니다.
