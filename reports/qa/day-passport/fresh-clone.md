# 별도 fresh clone 재개 검사

2026-09-09, macOS arm64의 별도 폴더에 GitHub 원격 feature/day-passport-experience를 새 clone했다. 기존 node_modules·키·로컬 DB·임시 Sites Git을 복사하지 않았다. 대상 커밋: `4d63e983212584a85d3ca012a0a07e3ed6ec008f`.

- 추적된 lockfile로 `npm ci` 성공.
- 타입 검사와 단위77개 통과.
- `.env.example`에서 데이터/지도 키를 비워 두고 새 로컬 테스트 서명값 생성. 비밀값은 기록하지 않음.
- `wrangler d1 migrations apply DB --local --config wrangler.local.jsonc`: 0000/0001 모두 로컬 적용 성공. 운영 D1 변경 없음.
- 별도 개발 포트3101에서 서버 실행. 기본3000은 원래 개발 서버가 쓰고 있어 검사에서만 변경했다.
- 키 없는 그룹 API11시나리오 통과,94회 앱 API 요청, 만든 그룹2개 정리. 관광/Kakao 외부 요청이 아니다. [구조화 결과](fresh-clone-groups.json).
- 실제 다른 PC/Windows/Linux/iPhone 실행을 의미하지 않는다. 설치 문서는 현재 PC 전용 경로 없이 POSIX/WSL과 설치된 브라우저 선택을 안내한다.

개인 브라우저 기록·참여 쿠키는 Git 전송 대상이 아니며 별도 기기에서 자동 복원되지 않는다. 검사 후 임시 서버는 종료한다.
