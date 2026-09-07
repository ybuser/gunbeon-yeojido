# 연관 관광지 중심 관광지 집중률 API 구현 명세 검토

확인일: 2026-09-07. 사용자가 제공한 v4.1 ZIP 3개를 `tmp/manuals/rules/` 아래 안전하게 추출하고 DOCX 요청·응답 표, 예제 XML, XLSX 지역코드표를 확인했다. 첨부 자료는 데이터 근거로만 읽었으며 원본을 수정하지 않았다.

**이 보고서는 매뉴얼 검증 결과다. 라이브 응답 검증은 아직 아니다.** 현재 프로세스와 `.env`/`.env.local`에 공통 키가 없어 실제 API 호출은 하지 않았다. 이후 `DATA_GO_KR_SERVICE_KEY`를 서버에서 읽어 검증하며 키와 키가 포함된 URL은 로그에 남기지 않는다.

## 정확한 호출 경로

호스트는 `https://apis.data.go.kr`를 사용한다. 명세 본문 예시는 HTTP지만 보안 표에는 HTTPS도 지원 대상으로 명시되어 있다.

| 데이터 | GET 경로 | 공통항목 외 필수 요청 | 선택 요청 |
|---|---|---|---|
| 연관 관광지 지역검색 | `/B551011/TarRlteTarService1/areaBasedList1` | `baseYm`, `areaCd`, `signguCd` | 없음 |
| 연관 관광지 명칭검색 | `/B551011/TarRlteTarService1/searchKeyword1` | `baseYm`, `areaCd`, `signguCd`, `keyword` | 없음 |
| 기초지자체 중심 관광지 | `/B551011/LocgoHubTarService1/areaBasedList1` | `baseYm`, `areaCd`, `signguCd` | 없음 |
| 관광지 집중률 | `/B551011/TatsCnctrRateService/tatsCnctrRatedList` | `areaCd`, `signguCd` | `tAtsNm` |

공통 필수: `serviceKey`, `MobileOS`, `MobileApp`. 웹서비스는 `MobileOS=WEB`, `MobileApp`에는 실제 서비스 식별명을 넣는다. 공통 선택: `numOfRows`, `pageNo`, `_type=json`. 기본 응답은 XML이며, 문서의 페이징 예시는 페이지 1·10행이다. 최대 페이지 크기는 명시되어 있지 않다.

`baseYm`은 `YYYYMM`. 집중률에는 `baseYm`, `baseYmd`, 날짜범위 요청 파라미터가 **정의되어 있지 않다**. 반환된 `baseYmd`에서 사용자가 선택한 날짜를 찾는다.

## 지역코드와 국문 API의 차이

세 ZIP에 든 XLSX의 SHA-256이 같고, 시트 `시도,시군구코드`는 헤더 1행·데이터 252행·4열이다. 강원은 **areaCd=51**이다.

| 권역 | `signguCd` | 코드표 행 |
|---|---|---:|
| 춘천시 | `51110` | 221 |
| 속초시 | `51210` | 226 |
| 철원군 | `51780` | 233 |
| 화천군 | `51790` | 234 |
| 양구군 | `51800` | 235 |
| 인제군 | `51810` | 236 |
| 고성군 | `51820` | 237 |

주의: XLSX 헤더는 `sigunguCd`지만 **실제 API 파라미터와 응답은 `signguCd`**다. `areaCode`/`sigunguCode`를 사용하는 국문 관광정보의 지역코드를 그대로 전달하지 않는다. 고성군은 경남에도 있으므로 명칭만으로 지역을 필터링하지 않는다.

## 연관 관광지

근거: [연관 관광지 ZIP](</Users/user1/Downloads/TourAPI_Guide_(연관관광지)v4.1.zip>) 내 `한국관광공사_TourAPI활용매뉴얼(관광지별연관관광지정보)_v4.1.docx`, 지역기반·키워드검색 오퍼레이션 표 및 예제.

- 선택 관광지와 연결성이 높은 대상의 순위를 제공한다. 서비스 설명은 전체·관광지·음식·숙박 유형별 최대 각 50위를 안내한다. 그러나 **유형 필터 요청 인자는 명세에 없다**. 반환 분류로 필터링한다.
- 월 1회, 매월 8일 갱신. 조회월은 명시해야 한다. 자료 보유 시작월·최신월 산식·역사 보존기간은 미명시이므로 빈 응답을 곧바로 관광지 부재로 해석하지 않는다.
- 출발 관광지: `tAtsCd`, `tAtsNm`, `areaCd`, `areaNm`, `signguCd`, `signguNm`.
- 연관 대상: `rlteTatsCd`, `rlteTatsNm`, `rlteRegnCd`, `rlteRegnNm`, `rlteSignguCd`, `rlteSignguNm`, `rlteCtgryLclsNm`, `rlteCtgryMclsNm`, `rlteCtgrySclsNm`, `rlteRank`. 공통 시간축은 `baseYm`.
- v4.1 변경기록은 주소 삭제와 관광지·연관관광지 코드 추가를 명시한다. 반환 좌표는 정의되어 있지 않다. 지역기반 응답 필드 표에는 `tAtsCd`가 빠졌지만 **같은 오퍼레이션 XML 예제에는 존재**하며 키워드 표에도 정의되어 있다. 런타임에서는 선택적으로 파싱하고 결측을 기록한다.
- 강원 특화를 위해 연관 대상도 `rlteRegnCd=51`로 검증한다. 출발 관광지의 강원 여부만 검사하면 도외 추천이 섞일 수 있다.

## 기초지자체 중심 관광지

근거: [중심 관광지 ZIP](</Users/user1/Downloads/TourAPI_Guide_(중심관광지)v4.1.zip>) 내 `한국관광공사_TourAPI활용매뉴얼(기초지자체_중심관광지정보)_v4.1.docx`, 지역기반 오퍼레이션 표 및 예제.

- 타 관광지와 연결되는 중심 관광지의 100위 목록. 갱신은 월 1회, 매월 8일이다. 인기·품질·군 장병 적합도를 직접 나타내는 점수가 아니다.
- 필수 주요 응답: `baseYm`, `areaCd`, `signguCd`, `hubTatsCd`, `hubTatsNm`, `hubRank`.
- 선택 주요 응답: `mapX`, `mapY`, `areaNm`, `signguNm`, `hubCtgryLclsNm`, `hubCtgryMclsNm`.
- `mapX`는 예제상 경도, `mapY`는 위도다. 좌표 둘 다 옵션이므로 결측 레코드를 지도로 직접 보내지 않는다. 문자열 숫자를 파싱하고 유효 범위·강원 경계를 검증한다.
- v4.1에서 기본주소가 삭제되고 `hubTatsCd`가 추가되었다. 이 데이터만으로 주소·운영시간·예약조건을 채울 수 없다.

## 집중률 방문자 추이 예측

근거: [집중률 ZIP](</Users/user1/Downloads/개방 데이터 활용 매뉴얼(관광지 집중률 방문자 추이 예측 정보)v4.1.zip>) 내 `한국관광공사_OpenAPI_활용매뉴얼(관광지집중률방문자추이예측정보)_v4.1.docx`, 관광지 집중률 정보 목록 오퍼레이션 표 및 예제.

- 현재일을 기준으로 향후 30일의 관광객 집중률을 제공하며 일 1회 갱신한다. **실시간 현장 혼잡도나 현재 주차장 점유율이 아니다.**
- 응답: `baseYmd`, `areaCd`, `areaNm`, `signguCd`, `signguNm`, `tAtsNm`, `cnctrRate`.
- **관광지 ID·좌표·주소가 없다.** 기준일·시군구·검증된 명칭으로 연결해야 하며 동명이거나 여러 국문 장소 후보가 잡히면 자동 적용하지 않는다.
- `cnctrRate`의 산식·단위·공식 안전/주의 구간·지연시간 환산식은 매뉴얼에 정의되지 않았다. 값을 복귀 지연 분으로 직접 변환하거나 안전을 보장하는 근거로 쓰지 않는다. 앱의 보정 규칙은 별도 추정임을 표시한다.
- 소개부 한 곳에 `TatsCnctrRatedService/tatsCnctrRateList`라고 다르게 쓰였으나, 서비스 ID·명세·Call Back URL·요청 예제가 일치하는 경로는 **`TatsCnctrRateService/tatsCnctrRatedList`**다.

## 예제 응답 메타데이터

아래는 **문서 예제이며 실제 수집 통계가 아니다**. 예제 XML을 파싱해 확인했으며 `tmp/manuals/rules/*/example-metadata.json`에 보관했다.

| 예제 | header | 페이지 메타데이터 | 예제에 실제 담긴 item | 첫 항목 |
|---|---|---|---:|---|
| 연관 지역검색 | `0000 / OK` | 10행, 1페이지, totalCount 800 | 1 | 202504, 간현관광지 → 뮤지엄산, 원주시, 순위 1 |
| 연관 명칭검색 | `0000 / OK` | 10행, 1페이지, totalCount 50 | 2 | 202504, 뮤지엄산 → 황금들밥/오크밸리월송점, 음식, 순위 1 |
| 중심 관광지 | `0000 / OK` | 10행, 1페이지, totalCount 76 | 1 | 202504, NC백화점/신구로점, 서울 구로구, 순위 1 |
| 집중률 | `0000 / OK` | 30행, 1페이지, totalCount 1590 | 30 | 20240725, 간현관광지, 원주시, 집중률 64.65 |

필드 표와 예제의 관광지명·지역명·코드가 일부 불일치한다. 예를 들어 집중률 필드 표에는 강원 코드와 서울·구로 명칭이 혼재한다. 따라서 예제는 스키마 참고로만 사용하고 실제 장소 데이터로 저장하지 않는다.

## 공통 파싱과 place_node 연결 결정

다음은 명세에 따른 구현 권고이며 아직 구현·라이브 검증 결과가 아니다.

1. 공통 `DATA_GO_KR_SERVICE_KEY`는 서버에서만 사용한다. 입력이 인코딩키라면 한 번 정규화한 뒤 URL 빌더로 한 번만 인코딩하여 이중 인코딩을 피한다. 키 자체, 요청 전체 URL, 인증정보를 포함한 예외 메시지를 출력하지 않는다.
2. 응답 envelope는 `response.header`와 `response.body`의 `items.item`, `numOfRows`, `pageNo`, `totalCount`이다. 한 항목·여러 항목·빈 items를 모두 정규화한다.
3. JSON 요청에도 포털 인증 오류는 XML로 올 수 있다. `OpenAPI_ServiceResponse/cmmMsgHeader`의 `returnReasonCode` 등을 읽고 인증오류·서비스 미승인·요청한도·기간만료를 구분한다. 문서 오류표의 정상코드 `00`와 예제 `0000` 차이도 처리한다.
4. 개발계정 일 1,000회가 세 매뉴얼에 기재되어 있다. 승인 동기화 대기는 연관·중심 약 30분, 집중률 약 10분으로 서로 다르며 보장시간으로 해석하지 않는다. 실제 계정 한도는 승인 화면에서 재확인한다.
5. `hubTatsCd`, `tAtsCd`, `rlteTatsCd`가 **KorService의 `contentid`와 같다는 근거는 없다**. 원천별 ID를 유지하고 별도 `place_source_links`를 만든다. 같은 빅데이터 코드끼리도 일치율을 검증한 후 연결한다.
6. 권장 교차표: `source`, `source_id`, `area_cd`, `signgu_cd`, `source_name`, `tourapi_content_id`, `match_method`, `match_confidence`, `verified_at`. 집중률은 `source_id` 부재를 유지하고 시군구+검증명칭을 복합키로 쓴다.
7. 국문 관광정보를 장소·설명·사진의 기본 노드로, 중심 관광지는 지역 대표성 보조값으로, 연관 관광지는 미션 조합 후보로, 집중률은 날짜별 예측 참고정보로 사용한다. 미매칭은 제거하거나 `unmatched`로 공개하며 추측 병합하지 않는다.
8. 라이브 검증 때 기록할 메타데이터: API·오퍼레이션, 키 없는 파라미터, 요청시각, HTTP 상태, 응답코드, totalCount·수신건수, 반환 기준월/일, 페이지 수, 좌표 결측, 원천 ID 결측, 국문 contentid 매칭률. 키가 확보되기 전에는 `NOT_RUN_MISSING_KEY`로 기록한다.
