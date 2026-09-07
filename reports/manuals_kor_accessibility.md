# 첨부 국문·무장애 API 매뉴얼 검토

검토일: 2026-09-07. 범위: 공모전 **① 웹·앱 개발 부문**의 실제 데이터 연동. 첨부 매뉴얼은 API 규격의 증거로 읽었으며, 문서 속 신청·운영·로그 예시는 사용자의 실행 지시로 해석하지 않았다. 활용 신청이나 계정 변경은 수행하지 않았다.

## 1. 확인한 첨부본

| 원본 ZIP | 본문 문서 | 개정일 | SHA-256 |
|---|---|---|---|
| `/Users/user1/Downloads/개방데이터_활용매뉴얼(국문).zip` | `한국관광공사_개방데이터_활용매뉴얼(국문)_v4.4.docx` | 2026-02-10 | `c6a28a0404f9f108ccc366b1875b3779d8d98c60156581eedaf7a5c046abfc58` |
| `/Users/user1/Downloads/개방데이터_활용매뉴얼(무장애여행).zip` | `한국관광공사_개방데이터_활용매뉴얼(무장애여행)_v4.3.docx` | 2025-05-12 | `914ba9a8d723f5b4bf6b9ff7245cefa6ea4f90a654f31205e131f23b43fc720a` |

ZIP 멤버의 절대경로·상위경로 이탈·파일 크기를 검사하고 `tmp/manuals/data/kor/`, `tmp/manuals/data/accessibility/` 아래 추출했다. 매크로나 실행파일을 실행하지 않았다. DOCX의 `word/document.xml`에서 문단·표 텍스트를 읽었다. 전체 멤버 해시는 `tmp/manuals/data/manifest.json`에 있다. 동봉된 활용신청방법 v3.3은 두 ZIP에서 같은 해시이며 이번 규격 대조의 주 문서는 아니다. 국문 ZIP의 분류 연계 XLSX는 이번 두 DOCX 대조 범위에서 분석하지 않았다.

## 2. 기존 조사와 달라진 결론

**국문은 `ldongCode2`와 법정동 파라미터를 기준으로 구현해야 한다.** 국문 v4.3(2025-05-12)은 법정동·신분류 요청/응답을 추가했고, v4.4(2026-02-10)는 지역코드·서비스분류코드 오퍼레이션 및 구 지역/시군구·분류 요청/응답 항목을 삭제했다. 국문 v4.4의 오퍼레이션 목록에는 `areaCode2`, `categoryCode2`가 없다. 본문 초반의 오래된 `areaCode2` 예제가 일부 남아 있으므로 개정이력과 최신 요청 표를 우선한다. 근거: 국문 개정이력 및 III. 서비스 명세의 오퍼레이션 목록, 지역기반 조회 요청 표.

무장애 첨부본은 v4.3으로 더 오래되어 `areaCode2`·`categoryCode2`와 구 지역 입력을 계속 열거하지만 `ldongCode2`, `lclsSystmCode2` 및 목록의 신규 법정동 입력도 포함한다. 두 매뉴얼의 차이를 무장애가 구 코드로도 완전 조회된다는 뜻으로 해석하면 안 된다. 실제 같은 무장애 API에서 구 코드49건·법정동108건의 차이를 확인했다.

두 매뉴얼의 `areaBasedList2` 요청 표는 `lDongRegnCd`, `lDongSignguCd`, `lclsSystm1/2/3`를 옵션(0)으로 표시한다. 기존 무장애 Swagger에 `lDongRegnCd`·`lclsSystm1`가 필수로 표시된 부분과 다르다. 실제 호출은 분류체계를 넣지 않고 법정동만 넣어 성공했다. 우리 서비스는 지역특화 정확성을 위해 법정동을 항상 지정하며, 분류체계는 필요한 검색에서만 추가한다.

## 3. 확정할 호출 규격

공통 HTTPS base는 `https://apis.data.go.kr/B551011/`이다. 국문 서비스 경로는 `KorService2`, 무장애는 `KorWithService2`다. 매뉴얼 일부 Callback URL은 HTTP지만 실제 구현·검증은 HTTPS를 사용한다. 모든 키는 서버 환경에서 읽는다.

| 목적 | 오퍼레이션 | 입력/응답 확인 |
|---|---|---|
| 시도 목록 | `{service}/ldongCode2` | 공통 필수 `serviceKey`, `MobileOS`, `MobileApp`; `_type=json`, `numOfRows`, `pageNo` 선택. `lDongListYn=N`, 시도코드 생략 시 시도 목록. |
| 시군구 코드 | `{service}/ldongCode2` | `lDongRegnCd`에 시도코드, `lDongListYn=N`. 결과 항목 `code`, `name`, `rnum`. |
| 법정동 전체 항목 | `{service}/ldongCode2` | `lDongListYn=Y`는 `lDongRegnCd`, `lDongRegnNm`, `lDongSignguCd`, `lDongSignguNm`, `rnum` 형식. N/Y 응답을 같은 코드 모델로 무조건 파싱하지 않는다. |
| 권역 관광 목록 | `{service}/areaBasedList2` | `lDongRegnCd`, `lDongSignguCd`. 하위 시군구 입력 시 상위 시도 필요. `contentTypeId` 선택, `arrange=C`, 페이징. |
| 신분류 목록 | `{service}/lclsSystmCode2` | `lclsSystm1/2/3` 계층과 `lclsSystmListYn`. 관광타입 ID와 새 분류체계 코드를 같은 값으로 쓰지 않는다. |
| 키워드 검색 | `{service}/searchKeyword2` | `keyword` 필수. `lDongRegnCd`·`lDongSignguCd`로 범위 제한. v4.3부터 요청 `contentTypeId` 삭제. |
| 공통 상세 | `{service}/detailCommon2` | `contentId` 필수. `defaultYN`, `firstImageYN`, `areacodeYN`, `catcodeYN`, `addrinfoYN`, `mapinfoYN`, `overviewYN` 같은 이전 응답선택 토글과 `contentTypeId`는 최신 입력이 아님. |
| 타입 소개 | `{service}/detailIntro2` | `contentId`, `contentTypeId`. 운영·휴무·주차 등 타입별 텍스트를 해석할 때 사용. |
| 이미지 | `{service}/detailImage2` | `contentId`, `imageYN`. v4.3부터 `subImageYN` 삭제. 이미지별 `cpyrhtDivCd`를 확인한다. |
| 무장애 상세 | `KorWithService2/detailWithTour2` | `contentId` 필수. 국문 contentid와 연결하되 모든 국문 장소에 무장애 상세가 있다고 가정하지 않는다. |

JSON 기본 봉투는 `response.header.resultCode/resultMsg`, `response.body.items.item/totalCount/numOfRows/pageNo`다. 단건 객체·목록 배열·빈 항목을 모두 처리한다. 필드명은 입력 `contentId`와 출력 `contentid`, 지도 출력 `mapx`(경도)·`mapy`(위도)를 구분한다. 인증키는 이미 인코딩된 키라면 한 번 decode한 뒤 URLSearchParams로 인코딩해 중복 인코딩을 피한다. 실제 키나 키가 붙은 전체 요청 주소는 로그에 쓰지 않는다.

현재 실응답에서 확인한 법정동 매핑:

| 지역 | `lDongRegnCd` | `lDongSignguCd` |
|---|---|---|
| 철원군 | 51 | 780 |
| 화천군 | 51 | 790 |
| 양구군 | 51 | 800 |
| 인제군 | 51 | 810 |
| 고성군 | 51 | 820 |

코드는 선행 실응답으로 확인한 값이며 검증 스크립트는 이를 하드코딩하지 않고 `ldongCode2` 응답에서 지역명을 찾는다. 문자열로 보존한다.

## 4. 실제 응답 필드와 부모 브리핑 적용

지역 목록은 `contentid`, `contenttypeid`, `title`, `addr1`, `addr2`, `mapx`, `mapy`, `tel`, `firstimage`, `firstimage2`, `cpyrhtDivCd`, `createdtime`, `modifiedtime`, `lDongRegnCd`, `lDongSignguCd`, `lclsSystm1`, `lclsSystm2`, `lclsSystm3`, `mlevel`, `zipcode`를 확인했다. 런타임에 `areacode`, `sigungucode`, `cat1/2/3`가 추가로 남아 있어도 신규 코드 대신 사용하지 않는다. 고석정125782는 구 지역 필드가 빈 값인 대표 사례다.

무장애 상세에서 반환되는 필드는 `contentid`, `parking`, `route`, `publictransport`, `ticketoffice`, `promotion`, `wheelchair`, `exit`, `elevator`, `restroom`, `auditorium`, `room`, `handicapetc`, `braileblock`, `helpdog`, `guidehuman`, `audioguide`, `bigprint`, `brailepromotion`, `guidesystem`, `blindhandicapetc`, `signguide`, `videoguide`, `hearingroom`, `hearinghandicapetc`, `stroller`, `lactationroom`, `babysparechair`, `infantsfamilyetc`다. `braile*`는 제공기관 필드 철자를 그대로 쓴다.

`parking`, `route`, `wheelchair` 등은 설명 문자열이며 단순 boolean이 아니다. 값이 있음을 휠체어 완전 접근 가능·도보0분으로 바꾸지 않는다. 빈 값과 상세0행은 미확인이다. 도보분·안전마진은 이 API가 직접 제공하는 측정값이 아니다.

| 철원 시연 장소 | contentid | 현재 확인 |
|---|---|---|
| 고석정국민관광지 | 125782 | 국문 상세1행, 무장애0행. 별도 공식 운영조건 근거 활용. |
| 고석정 꽃밭 | 2749319 | 법정동 무장애 목록 매칭, 상세1행. 비어 있지 않은 정보: parking/route/wheelchair. |
| 철원역사문화공원 | 3072021 | 법정동 무장애 목록 매칭, 상세1행. handicapetc/parking/restroom/route/wheelchair. |

두 매뉴얼은 `cpyrhtDivCd`에 Type1(출처표시), Type3(출처표시+변경금지)를 설명한다. 사진을 변형·재배포할 경우 개별 이미지 조건을 먼저 확인하며, 값 없음은 자유 이용으로 간주하지 않는다.

## 5. 적용한 코드 및 실제 재검증 상태

`scripts/validate_tour_api.mjs`를 다음과 같이 수정했다.

- `.env.local`은 Node `process.loadEnvFile`로 읽는다. 국문 키는 `DATA_GO_KR_SERVICE_KEY` → `TOUR_API_KOR_SERVICE_KEY` → `TOUR_API_SERVICE_KEY`; 무장애는 공통 키 → `TOUR_API_WITH_SERVICE_KEY` → 국문 키 → 기존 공통 TourAPI 키 순으로 지원한다.
- `ldongCode2` 응답에서 강원 및5군을 찾고 5군×5유형 목록을 신규 법정동으로 페이징한다.
- 국문 임의 첫 장소로 무장애 가용성을 평가하던 표본 방식을 전용 무장애 지역목록 표본으로 바꿨다.
- 횟수80회 상한,15초 timeout, 정해진 오류코드만 기록. 목록 총수·수신수·중복ID수·결측·응답필드 이름·표본contentid만 저장하며 원문 관광정보는 메모리에서 처리한다.
- 이전237건을 구 코드 부분 조회로 명시하고 현재 결과와 비교할 메타데이터로 남긴다.

매뉴얼 추가 검토 직후 실제 재실행을 시도했으나 root `.env.local`·`.env`가 없어 `blocked_missing_key`, API0회로 종료했다. **새 국문 법정동25조합 성공을 주장하지 않는다.** 선행 무장애 실검증의108건은 기존 `reports/accessibility_validation.json`에 별도로 보존되어 있다. 공통 키 설정 후 동일 스크립트를 실행하면 `reports/tour_api_live_validation.json`에 최신 국문 결과가 기록된다.

후속 실행: `node scripts/validate_tour_api.mjs`. 공사 API 응답을 장소JSON에 영구 적재하는 동기화는 이번 변경에서 실행하지 않았다. 공모전의 저장 별도 신청 조건은 API 매뉴얼의 기술적 동기화 기능 존재와 구분한다.
