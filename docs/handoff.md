# 개발 인수인계

**작성 기준: 2026-09-09 KST. 현재 제품 작업은 진행 중이다.** 다른 PC에서는 `AGENTS.md` → 이 문서 → `local-setup.md` → `roadmap.md` 순서로 읽는다.

## 현재 Git·제품 상태

| 항목 | 확인된 상태 |
|---|---|
| 전체 저장소 | https://github.com/ybuser/gunbeon-yeojido |
| 작업 브랜치 | `feature/day-passport-experience` |
| 진행 중 첫 커밋 | `3a04e92` — 최초 기능 커밋, 원격 push 완료; 최종 SHA 아님 |
| push/PR/최종 병합 | 첫 기능 커밋 push 완료, 후속 PR/배포 준비 중 |
| 최종 검사 | 타입·77개 단위·빌드 통과, 새 경험 Chrome/Edge 8조건 통과. reports/day_passport_delivery.md 참조 |
| 다음 배포 | **미확정. 실제 Sites source SHA·버전·상태를 조회 후 기입** |
| 새 PC bootstrap | 문서 준비; fresh clone 실행 검증 미완료 |

현재 검증한 구현 범위는 출발 전 여유 조정, 하루 여권 표지, 다녀온 장소 선택 후 완료 기록, 선택형 16초·4장면 사용 안내다. TourAPI 요청 효율·실제 제공량 확대와 Kakao 정상 동작 유지도 함께 확인한다. 첫 커밋만으로 기능 완료·전체 검사 통과·배포 완료를 선언하지 않는다.

기존 완료 기능은 날짜 없는 5개 군/15개 추천 일정, 직접 일정·즐겨찾기, 계획/현재 출타 분리, D1 그룹 초대·공동 편집, 추가 외부 장소 사진 6장, 사용 가이드다. 진행 중 변경의 최종 상태는 아래 종료 기록으로 갱신한다.

## 다음 첫 행동

```sh
git status --short
git branch --show-current
git log -5 --oneline
git fetch origin --prune
git branch -r
```

1. 이 기록과 실제 Git을 대조한다. 원격에 없는 작업은 다른 PC에 전달되지 않았다.
2. 새 PC는 `local-setup.md`로 로컬 환경·D1·키 없는 QA를 재현한다.
3. 진행 중 코드와 관련 단위/브라우저 검사를 읽어 남은 부분만 이어간다.
4. 정상 TourAPI 검색·목록·상세·사진·일정 연결과 Kakao 동작을 보존하며 제공량과 지원 규모 확대를 최우선으로 진행한다.

## GitHub·Sites·D1 구분

- GitHub는 앱 `web/`, 자료·보고서·CI·문서를 담은 전체 저장소다. Sites 앱 소스 Git과 SHA는 별개다.
- 기존 설정: `web/.openai/hosting.json`; 프로젝트 `appgprj_6a9e5a33eaa08191a72a52abf77522cc`; D1 binding `DB`, R2 없음.
- 공개 URL: https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/ (`/guide` 포함).
- 마지막 **문서로 확인한** 배포는 v11, source `005ea16550fd57d9fa15478d3e4b50b92765c62f`, 2026-09-08 05:12:08 UTC 성공이다. 근거는 `reports/discovery_delivery.md`. 현재 원격 최신 상태를 다시 조회한 결과가 아니다.
- 새 PC에서 배포할 때는 해당 환경의 Sites 지침을 읽고 **기존 프로젝트**의 현재 소스 연결·인증 정보를 조회한다. 제공된 방법으로 앱 소스를 새 작업 폴더에 clone/bootstrap한다. 이전 PC의 임시 checkout이나 인증 URL을 재구성하지 않는다.
- GitHub `web/` 변경을 앱 소스 구조와 대조한다. `.git`, `.env*`, `.wrangler`, `node_modules`, `dist`를 무차별 복사하지 않는다. 검증된 앱 소스 commit을 기존 프로젝트에 배포하고 GitHub SHA ↔ Sites SHA ↔ 버전을 기록한다.
- 배포 연결이 없으면 로컬 개발을 계속하고 “배포 연결 미복구”로 남긴다. 연결 복구를 위해 새 프로젝트나 다른 Worker를 만들지 않는다.
- 로컬 D1 placeholder는 `--local`로만 사용한다. 서버 D1은 Sites에서 migration 상태를 확인한다. 로컬 secret 생성은 서버 secret 변경이 아니다.
- 그룹은 서버 D1에 있지만 개인 여행·즐겨찾기·출타·스탬프는 localStorage다. 개인 데이터·참여 쿠키·로컬 D1은 Git clone으로 다른 PC에 이동하지 않는다.

## 근거와 남은 불확실성

- 최신 완료 기능/QA 기준선: `reports/discovery_delivery.md`; D1 도입: `reports/travel_groups_delivery.md`.
- 요청 효율/용량: `reports/api_capacity_strategy.md`, `reports/api_capacity_requests.md`; 운영/저장 조건: `reports/tourapi_operations_policy.md`; 새 경험 기획: `reports/memorable_experience_proposal.md`.
- 사진: `reports/photo_sources.md`; 제출: `reports/submission_assets.md`, `reports/notion_requirements.md`.
- `reports/deployment.md`의 v9나 과거 “그룹은 같은 브라우저만 가능” 설명은 당시 기록이다. v10 이후 서버 그룹 공유와 구분한다.
- 9/8 `areaBasedList2` HTTP429/제공자22 기록은 과거 관측이다. 현재 전체 API 장애나 잘못된 키로 단정하지 않는다. 정상 기능 유지·실제 계정 한도 확인·용량 확대가 우선이다.
- mock·fallback 검사와 실제 API 성공은 별개다. `api/status`의 고정 버전/저장 표시는 배포 commit·서버 D1 상태의 근거로 쓰지 않는다.
- 전체 lint의 기존 오류, 실제 Android/iPhone/Safari·현장 사용자 검사, 사진 최종 권리 검토, 최종 제출 준비는 완료 여부를 추가 확인해야 한다.

## root가 이번 작업 종료 후 채울 기록

```text
기록 시각(KST):
완료한 기능 / 아직 진행 중인 기능:
최종 GitHub branch / SHA / PR / push·병합 여부:
타입·단위·빌드·브라우저 검사 명령 / 환경 / 결과 / 증빙:
기존 TourAPI·Kakao 회귀 결과 / 실제 API 성공·quota·mock 구분:
Sites source SHA / 실제 버전(예: v12) / 배포 상태·확인 시각:
서버 D1 migration 변경·적용 상태 / secret 변경(변수명만):
공개 URL 새 세션 검증:
fresh clone 실행 검증 환경 / 미검증 항목:
남은 일 / 다음 첫 행동:
```

이 기록과 필요한 파일을 commit/push해야 다른 PC에서 이어받을 수 있다. 새 배포 버전은 실제 확인한 값으로만 기입한다.
