# 검토용 배포 기록 — 2026-09-07

검토 URL: https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site

Sites의 소유자 전용 비공개 배포 성공 상태를 확인했다. 이는 심사위원 공개 접근 허용과 다르다. 현재 배포 환경변수는 설정되지 않았으므로 실시간 관광공사·기상청 API와 Kakao SDK는 미연결 상태다. 공개 DMZ/현충시설 원천과 명시적 거리 추정으로 초기 흐름을 검토할 수 있다.

사용자 GitHub: https://github.com/ybuser/gunbeon-yeojido (master). GitHub Actions의 npm ci/타입검사/16개 테스트/프로덕션 빌드 모두 성공했다.

카카오 허용 JavaScript SDK 도메인:
- http://localhost:3000
- https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site

공통키 입력 위치: 저장소 루트 .env.local. 변수명 DATA_GO_KR_SERVICE_KEY, KAKAO_MAP_JAVASCRIPT_KEY. 배포 런타임 키는 로컬 파일과 별개이므로 비밀 환경변수로 등록한 후 적용해야 한다.

다음 배포 전: 공통 키 재설정과 신규 법정동 국문·예보 실측, 지도/모바일 사용성 검증, 대표 미션 운영조건 검증. 제출 전에는 심사위원 접근 범위를 허용하고 지정 제출물을 완성한다. 실제 공개를 완료했다고 표현하지 않는다.
