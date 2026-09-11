# 조직 저장소 이전 점검

2026-09-11. 개인 계정 ybuser에서 조직 MySonIsSoldier로 이전한 뒤 로컬 연결·문서·앱 링크·자동화·배포 연결을 점검했다.

## 확인한 저장소

- 정식 주소: https://github.com/MySonIsSoldier/gunbeon-yeojido
- 기본 브랜치 `master`, public, 현재 작업 계정의 권한 ADMIN, Issues 활성화.
- 이전 주소의 GitHub API도 새 `full_name`을 반환한다. 이전 전 최종 `d004f6ac77d6ab03d26a51cad5a85db92c57478a`가 새 저장소의 master에 존재함을 확인했다.
- 로컬 `origin`의 fetch/push와 `gh` 기본 저장소를 조직 주소로 변경하고 fetch/pull을 완료했다. 작업 파일·브랜치 이력을 재작성하지 않았다.

## 변경

- 앱의 사진 출처 목록, 사용 가이드 문서, 개인정보 문의 링크를 조직 저장소로 변경했다.
- README에 정식 저장소 링크, AGENTS에 현재 소유자/기본 브랜치를 명시했다.
- 개발 문서·보고서의 clone/PR/이슈/Actions 링크를 새 주소로 변경했다. 과거 검사 JSON도 URL의 소유자 경로만 변경했으며 실행 ID·SHA·검사 결과·시간은 보존했다.
- [다른 PC의 기존 clone 연결 안내](../docs/local-setup.md#기존-clone의-조직-저장소-연결)에 HTTPS/SSH, 별도 push URL, GitHub CLI 기본 저장소 설정을 정리했다.

## 자동화와 외부 연결

| 항목 | 확인 및 조치 |
|---|---|
| GitHub Actions | enabled, 허용 정책 all. Quality checks / Browser flow checks active. 기존 실행을 새 주소에서 조회 가능 |
| workflow 설정 | 현재 저장소 checkout·contents: read. 특정 소유자 조건이나 고정 저장소 참조 없음 |
| 저장소 Actions secrets / variables / environments / webhooks | 각 0개. 키 없는 CI이므로 옮겨야 할 CI 비밀값 없음. 운영 API 키는 Sites에 별도 보관 |
| 패키지·기타 Git 설정 | GitHub Packages/GHCR·서브모듈·CODEOWNERS·사설 npm 설정 없음. private npm 패키지 설정 유지 |
| 보호 규칙 | master 보호/ruleset 없음. 이전 전 비교 자료가 없어 이전으로 해제되었다고 판단하지 않음. 이번 주소 이전 작업에서 임의로 보안 정책을 바꾸지 않음 |
| Sites | 기존 `appgprj_6a9e5a33eaa08191a72a52abf77522cc`, public, owner 확인. GitHub와 별도 앱 소스 Git이므로 그 원격을 GitHub URL로 바꾸지 않음 |
| 공개 URL·API·로그인 | 사이트 도메인 유지. TourAPI/Kakao 키·Kakao SDK 도메인·Google/Naver 콜백·AUTH_BASE_URL 변경 불필요. 기존 소셜 로그인 연결 절차 유지 |
| 사용자 데이터 | 기존 D1 DB·세션·저장된 여행과 그룹 유지. DB migration 없음 |

GitHub Pages는 `has_pages=false`다. [GitHub 공식 이전 안내](https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository)에 따라 이전 주소의 리디렉션을 보존하려면 옛 개인 저장소 이름을 새 저장소에 재사용하지 않는다. 열린 이슈의 담당자는 현재 없으며 이전 때문에 해제되었다는 근거는 확인하지 못했다.

## 검증·배포 기록

이전 이후 새 commit/push·PR·자동 검사·공개 링크 반영 결과는 `docs/handoff.md` 및 `reports/qa/repository-transfer/`에 기록한다. 과거 성공 실행을 새 조직에서 발생한 실행으로 취급하지 않는다.
