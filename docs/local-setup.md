# 다른 PC에서 로컬 개발 시작

Git, **Node 22(최소 22.13.0, 기존 CI 22.18)**, npm이 필요하다. 아래는 macOS/Linux/Windows WSL의 POSIX 셸 기준이다. PowerShell은 환경변수 문법을 해당 셸에 맞춘다. 사용자 홈·임시 브라우저·이전 배포 checkout 경로는 필요 없다.

## 1. 새 clone과 작업 브랜치

```sh
git clone https://github.com/ybuser/gunbeon-yeojido.git
cd gunbeon-yeojido
git fetch origin --prune
git branch -r
git status --short
git log -5 --oneline
```

PR18이 master에 병합되었다. 새 clone은 기본 master로 시작하고, 후속 진행 브랜치가 있을 때만 docs/handoff.md와 원격 목록을 확인해 전환한다. 미커밋 파일·push되지 않은 브랜치는 clone에 포함되지 않는다. 비공개 저장소 인증은 해당 PC의 GitHub 로그인/credential manager를 사용한다.

## 2. API 키 없는 로컬 환경

```sh
cd web
npm ci
node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
const content = readFileSync('../.env.example', 'utf8')
  .replace(/^TEST_ACCESS_PASSWORD=$/m, 'TEST_ACCESS_PASSWORD=1234')
  .replace(/^TEST_SESSION_SECRET=$/m, 'TEST_SESSION_SECRET=' + randomBytes(32).toString('hex'));
writeFileSync('.env.local', content, { flag: 'wx' });
NODE
npx wrangler d1 migrations apply DB --local --config wrangler.local.jsonc
npm run dev
```

생성 명령은 기존 `.env.local`을 덮어쓰지 않는다. 이미 파일이 있으면 기존 환경을 유지하고 값 출력 없이 설정 유무를 확인한다. `http://localhost:3000`에서 로컬 테스트 비밀번호 `1234`로 진입한다. 포트 3000은 strictPort다.

키 없는 상태에서 기본 장소·일정·로컬 그룹과 오류 안내를 개발할 수 있다. TourAPI·날씨·Kakao 실연동 성공을 의미하지 않는다. 환경 파일은 Git에 넣지 않는다. `web/.env.local` 직접 생성 방식이므로 symlink가 필요 없다.

## 3. 검사 — 모두 web/에서

```sh
npm run typecheck
npm test
npm run build
```

dev 서버를 켜 둔 채 다른 터미널의 `web/`에서 키 없는 회귀 검사를 실행한다.

```sh
npx playwright install chromium
mkdir -p test-results/local
export QA_BASE_URL=http://localhost:3000
export QA_BROWSER_CHANNELS=chromium
export QA_CASES=small,desktop
export QA_LIVE=0
QA_OUT_FILE=test-results/local/groups-api.json npm run test:groups
QA_OUT_DIR=test-results/local/groups npm run test:groups-ui
QA_OUT_DIR=test-results/local/browser npm run test:browser
QA_OUT_DIR=test-results/local/guide npm run test:guide
QA_OUT_DIR=test-results/local/custom npm run test:custom
QA_OUT_DIR=test-results/local/outing npm run test:outing
QA_OUT_DIR=test-results/local/day npm run test:day
```

Linux의 브라우저 OS 의존성이 부족하면 `npx playwright install --with-deps chromium`을 사용한다. Chrome/Edge 추가 검사는 설치된 PC에서 `QA_BROWSER_CHANNELS=chrome,msedge`로 실행한다. 별도 Edge 경로가 필요하면 그 PC에서 확인한 `QA_EDGE_EXECUTABLE`만 지정한다. `discovery-guide-qa.mjs`는 실제 Kakao/Chrome을 쓰는 별도 검사다.

위 QA는 실제 관광정보의 양이나 실연동 회복을 검증하지 않는다. 해당 검사는 운영 한도와 인증 상태를 확인한 뒤 별도로 실행·기록한다. QA가 만든 그룹만 삭제되며 테스트 프로필은 남을 수 있다. `npm start`는 빌드된 Worker의 로컬 실행이고 배포 명령은 아니다.

## 4. 선택: 실제 TourAPI·Kakao 연결

안전한 기존 전달 경로로 받은 값을 로컬 환경에 설정하고 서버를 재시작한다. `.env.example`과 `reports/api_setup.md`의 변수명을 따른다.

| 변수 | 용도 |
|---|---|
| `DATA_GO_KR_SERVICE_KEY` | 공공데이터 서버키; 서비스별 활용 승인은 별도 |
| `KAKAO_MAP_JAVASCRIPT_KEY` | 지도키; 해당 origin의 제품 사용/도메인 등록 필요 |
| `TEST_ACCESS_PASSWORD` | 로컬 입장; QA 기본값 1234 |
| `TEST_SESSION_SECRET` | 서버 서명용 무작위 32자 이상 |

`localhost`, `127.0.0.1`, LAN IP는 서로 다른 origin이다. 실제 키를 Git·문서·채팅에 넣지 않는다. 정상 TourAPI 기능을 유지하면서 실제 제공량·이용 규모를 확대하는 것이 최우선이며, mock/fallback 성공은 별도 증빙이다.

## 5. 로컬과 배포 환경은 별개

- **로컬 D1:** `web/wrangler.local.jsonc`의 placeholder ID와 `.wrangler` 상태. migration 명령은 `--local`이다. 새 clone에 기존 로컬 DB는 없다.
- **서버 D1:** 기존 Sites 프로젝트의 `DB` binding. 로그인 계정·개인 여행과 공유 그룹·초대·일정이 저장된다. 서버 migration/secret은 Sites 절차로 별도 확인한다. 로컬 DB ID에 `--remote`를 붙이지 않는다.
- `web/.openai/hosting.json`은 추적된 기존 프로젝트 연결이다. 새 PC의 배포 인증/소스 Git 연결은 `handoff.md`에 따라 다시 확보한다.
- 개인 localStorage·브라우저 쿠키·로컬 DB·실제 키·Playwright 바이너리·빌드 결과·이전 임시 clone은 Git으로 옮겨지지 않는다. 게스트 기록은 자동 이동하지 않는다. 운영에서 같은 개인 계정으로 로그인하면 서버에 저장한 여행은 이어서 사용할 수 있다.
- **별도 fresh clone 재현을 완료했다.** 같은 Mac에서 설치·타입·77개 단위·로컬D1·개발서버·그룹API11시나리오를 확인했다. 다른 OS/실제 다른 PC 실행은 미검증이며 [재현 기록](../reports/qa/day-passport/fresh-clone.md)을 참고한다.


## 공개 여행 제안 추가 검사

앱 루트 `web/`에서 실행한다. 이 기능은 D1 migration 0002/0003이 추가됐으므로 먼저 위의 로컬 migration 명령을 실행한다. 테스트가 만든 공유 링크만 종료/삭제하며 기존 그룹이나 운영 DB를 초기화하지 않는다.

```sh
node scripts/advice-api-qa.mjs
QA_BROWSER_CHANNELS=chromium QA_CASES=small,desktop node scripts/advice-ui-qa.mjs
```

API 검사는 쿠키가 분리된 작성자/방문자/외부인 3개 HTTP 세션, UI 검사는 작성자/방문자 2개 브라우저 컨텍스트를 사용한다. UI 회귀는 정상 TourAPI를 실제로 소진하지 않도록 지역 목록을 오류 응답으로 격리하고, 기본 공개 관광지와 실제 D1을 이용한다. 실제 관광 API 검색 검증은 별도로 기록한다. 명령을 빠르게 반복하면 익명 공개 기능의 속도 제한에 걸릴 수 있으므로 실패 원인을 확인하고 해당 시간 창 뒤에 재실행한다.

공개 ID는 관리 자격증명이 아니다. 공유 작성·수정 권한 쿠키는 Git/로그/보고서에 저장하지 않는다. 다른 PC에서 기존 공개 링크는 열리지만 관리 권한은 자동 이동하지 않는다.

## 개인 계정과 소셜 로그인

- migration0004를 추가 적용한다. 일반 아이디 로그인에는 기존 TEST_SESSION_SECRET/TEST_ACCESS_PASSWORD와 D1이면 충분하다.
- Google/Naver를 연결할 때는 [단계별 안내](social-login-setup.md)를 따른다. 로컬과 운영 각각 AUTH_BASE_URL, GOOGLE_CLIENT_ID/SECRET, NAVER_CLIENT_ID/SECRET을 설정한다. 소셜 키 없이도 개인 계정 QA는 실행된다.
- `cd web` 후 `npm run test:accounts`, `QA_BROWSER_CHANNELS=chromium QA_CASES=small,desktop npm run test:accounts-ui`를 실행한다.
- 운영에서 같은 계정으로 로그인하면 개인 여행·그룹을 이어갈 수 있다. 로컬 D1과 운영 D1은 별도이므로 운영 계정이 로컬에도 자동 존재하는 것은 아니다.
- 게스트의 기기 기록은 내 계정의 가져오기로 명시적으로 연결한다. Git clone이 localStorage/쿠키를 옮겨주지는 않는다.
