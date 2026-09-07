# API 설정 안내

설정 위치: 저장소 최상위 `.env.local`. `.env.example`을 복사하고 공통 `DATA_GO_KR_SERVICE_KEY`에 일반 인증키(디코딩 권장)를 한 번 입력한다. 여섯 서비스 각각의 활용 신청·승인은 별도로 필요하다. `web/.env.local`은 로컬에서 상위 파일을 연결하며 Git에 포함하지 않는다. 웹 작업 폴더에서 직접 실행한다면 `web/.env.local`에 직접 설정해도 된다. 키를 설정한 뒤 개발 서버를 재시작한다. 배포 환경은 Sites의 secret으로 별도 등록한다.

| 우선 | 신청 서비스 | 공식 신청 URL | 환경변수 |
|---|---|---|---|
| P0 | 한국관광공사 국문 관광정보 서비스_GW | https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578 | TOUR_API_KOR_SERVICE_KEY |
| P0 | 한국관광공사 무장애 여행 정보 | https://www.data.go.kr/data/15101897/openapi.do | TOUR_API_WITH_SERVICE_KEY |
| P2 | 한국관광공사 관광지 집중률 방문자 추이 예측 정보 | https://www.data.go.kr/data/15128555/openapi.do | TOUR_API_CONCENTRATION_KEY |
| P2 | 한국관광공사 기초지자체 중심 관광지 정보 | https://www.data.go.kr/data/15128559/openapi.do | TOUR_API_HUB_KEY |
| P2 | 한국관광공사 관광지별 연관 관광지 정보 | https://www.data.go.kr/data/15128560/openapi.do | TOUR_API_RELATED_KEY |
| P1 | 기상청 단기예보 조회서비스 | https://www.data.go.kr/data/15084084/openapi.do | KMA_SERVICE_KEY |

위 표의 서비스별 변수는 계정이나 키가 다를 때만 사용하는 선택적 재정의다. 동일 계정의 일반 인증키라면 아래 두 변수만 설정한다.

```dotenv
DATA_GO_KR_SERVICE_KEY=발급받은_일반_인증키
KAKAO_MAP_JAVASCRIPT_KEY=카카오_JavaScript_키
```

한 계정에서 같은 인증키를 발급받는 경우에도 각 서비스의 활용 신청/승인 여부를 확인한다. 국문 서비스는 기존 `TOUR_API_SERVICE_KEY`도 호환하며, 무장애 키가 없으면 국문 키를 사용해 호출한다. 해당 서비스가 승인되지 않았으면 무장애 정보 실패를 별도로 표시한다.

서비스 식별 MobileApp: `GunbeonGangwon`, MobileOS: `ETC`. 개발계정 일일 트래픽 제한을 확인하며 실제 활용 호출만 실행한다. 실시간 연결·오류를 기록하되 인증키나 키가 든 전체 URL은 보고서/로그/클라이언트에 노출하지 않는다.

지도: Kakao Developers JavaScript 키를 `KAKAO_MAP_JAVASCRIPT_KEY`에 설정한다. 이것은 도메인 제한을 사용하는 공개 브라우저 키다. 허용 웹 도메인에 로컬 개발 주소와 최종 배포 주소를 등록해야 한다. REST API secret과 혼동하지 않는다. 지도 미설정 시 명시적 지리 개략도와 외부 길찾기를 제공한다.

통일부 CSV와 국가보훈부 현충시설 API 원천은 이미 확보했다. 별도 신청 없이 검증 가능한 공개 범위만 수집했다.

## 카카오 JavaScript SDK 도메인

현재 로컬 서버는 `http://localhost:3000`으로 고정했다. Kakao Developers → 앱 → 앱 설정 → 앱 → 플랫폼 키 → 사용할 JavaScript 키에서 JavaScript SDK 도메인으로 이 주소를 등록한다. `127.0.0.1` 또는 휴대전화의 같은 와이파이 내부 IP로 접속한다면 실제 접속 origin을 별도 등록해야 한다. 경로(/planner 등)나 GitHub 저장소 URL을 넣지 않는다.

Sites 등록 시 반환된 배포 예정 주소는 `https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site`이며 성공적으로 배포된 뒤 확정 주소를 등록한다. JavaScript 키는 브라우저에서 사용하는 공개 키이고, 공공데이터포털 키는 서버 비밀값이다.

근거: [Kakao 지도 Web API 가이드](https://apis.map.kakao.com/web/guide/).
