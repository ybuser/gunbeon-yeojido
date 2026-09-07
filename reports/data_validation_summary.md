# 데이터 가용성 및 1차 실측 보고서

검증일: 2026-09-07 (Asia/Seoul). 공모전 범위: **① 웹·앱 개발 부문**.

이 문서는 공식 카탈로그의 존재 확인과 실제 응답 검증을 구분한다. `confirmed`는 아래에 명시한 범위에서 직접 확인한 사실, `blocked`는 인증키 등 선행조건이 없어 수행하지 못한 검증, `unverified`는 후속 현장·운영 검증이 필요한 항목이다. 공식 페이지 존재만으로 실 API 호출 성공이라고 표현하지 않는다.

## 2026-09-07 검증 정정 및 현재 상태

이전 `areaCode2`의 강원32·철원12/화천17/양구6/인제10/고성2로 실행한 25개 조합은 성공했지만, **237건은 폐기되는 구 지역코드에 값이 남아 있는 부분 집합**이다. 이를 접경5군의 전체 관광정보로 해석한 설명을 정정한다. 구 필터의 축제 0건도 실제 지역의 축제 부재를 의미하지 않는다. 최신 국문 매뉴얼 v4.4(2026-02-10)는 지역코드 오퍼레이션과 구 지역·시군구 요청/응답 항목 삭제를 명시한다.

현행 `ldongCode2` 실제 응답에서 **강원51·철원780/화천790/양구800/인제810/고성820**을 확인했다. 무장애 `KorWithService2/areaBasedList2`를 법정동 기준으로 완전히 조회한 결과는 **108건(철원18/화천17/양구16/인제22/고성35)**이며 좌표 결측 0이다. 같은 API를 구 코드로 조회하면49건으로 줄어든다. 고석정 꽃밭2749319·철원역사문화공원3072021는 현행 목록 매칭과 무장애 상세1행을 확인했다. 고석정국민관광지125782는 국문 상세가 있으나 무장애 상세0행이다. 값 없음은 접근 불가를 의미하지 않는다. 목록 전화번호 결측도 연락처 자체의 부재를 의미하지 않으므로 상세 문의처를 확인해야 한다.

무장애 실측은 `accessibility_validation.json`의 `legal_dong_validation` 및 `summary`가 최종 근거다. 국문 검증 스크립트는 현행 법정동 코드와 공통 `DATA_GO_KR_SERVICE_KEY` 우선 설정으로 수정했다. 매뉴얼 추가 검토 직후 재실행 시 root `.env.local`과 `.env`가 없어 새 국문 실검증은 **blocked_missing_key, 호출0회**로 종료했다. `tour_api_live_validation.json`은 이 최신 시도 상태와 이전237건 비교 메타데이터를 기록한다. 키·키 포함 URL·관광API 원문은 저장하지 않았다. 아래 초기 미인증 기록은 조사 당시 이력이며, 후속 실제 검증 결과와 구분한다.

## 1. 실제 확보 결과 — confirmed

| 원천 | 원본 전체 | 강원 전체 | 접경 5군 | 전체 중 접경 5군 비율 | 접경 5군 좌표 결측/범위 오류 | 접경 5군 전화번호 결측 |
|---|---:|---:|---:|---:|---:|---:|
| 통일부 DMZ 관광 CSV, 20260820 | 614 | 309 | 309 | 50.33% | 0 | 2 (0.65%) |
| 통일부 DMZ 카페 CSV, 20251031 | 1,785 | 218 | 218 | 12.21% | 0 | 133 (61.01%) |
| 국가보훈부 현충시설 JSON, 20260907 실응답 | 2,381 | 233 | 80 | 3.36% | 1 (1.25%) | 필드 자체 미제공 |

통일부 CSV 두 파일은 공식 페이지가 공개한 다운로드 링크로 로그인 없이 내려받았다. 국가보훈부 JSON은 공식 API 문서의 `allSearch.do`를 HTTPS로 호출해 HTTP 200 JSON 응답을 받았다. 원본 파일과 SHA-256은 `data/raw/public/`, `reports/data_validation_metrics.json`에 보관했다. [DMZ 관광 원천](https://www.data.go.kr/data/15119699/fileData.do), [DMZ 카페 원천](https://www.data.go.kr/data/15119706/fileData.do), [현충시설 공식 API 문서](https://www.mpva.go.kr/mpva/contents.do?key=17)

| 권역 | DMZ 관광 | DMZ 카페 | 현충시설 |
|---|---:|---:|---:|
| 철원군 | 62 | 77 | 16 |
| 화천군 | 62 | 28 | 13 |
| 양구군 | 46 | 28 | 17 |
| 인제군 | 56 | 35 | 20 |
| 고성군 | 83 | 50 | 14 |

현재 정규화는 **607개 원천 레코드**, 유효한 좌표를 가진 지도 표시 후보는 **606개**다. 서로 다른 출처의 동일 장소는 아직 통합하지 않아 고유 장소 수로 홍보하면 안 된다. 좌표 유효는 숫자·대한민국 근방 범위(위도 33–39.5, 경도 124–132) 검사이며, 실제 입구 위치의 정확성까지 보증하지 않는다.

### CSV/JSON 컬럼과 중요한 결함

- DMZ 관광 실제 컬럼: `이름, 주소, 전화번호, 번호구분, 위도, 경도, 이미지URL, 비고`. 카탈로그 설명보다 실제 CSV에 `번호구분`, `이미지URL`이 추가되어 있다. 일부 전화는 시설 직통번호가 아니라 지자체 대표번호다.
- DMZ 카페 실제 컬럼: `이름, 주소, 전화번호, 위도, 경도`. 전체 전화번호 결측은 1,276/1,785(71.48%)다. 영업시간·주차·무장애·운영 여부는 제공하지 않는다.
- 현충시설 실제 컬럼: `facilnm, mgmtno, addr, mpvabranch, xindex, yindex, gubun, desdate, facilmgr, facilgubun, topic, indicate, volume, estimate, facilexplain`. **이 원천의 xindex는 위도, yindex는 경도**다. 일반적인 x=경도 가정을 적용하지 않았다. 5군 80건 중 `topic=6·25전쟁`은 59건이다. 소재지는 시군구까지만 있는 경우가 있어 정확한 입구 접근성 검증이 별도로 필요하다.
- 원천의 예약, 민통선 신분확인, 실내/야외, 도보량, 주차, 운영상태, 보상인정 여부는 확인되지 않았다. 이 값은 `null`, `unknown`, 빈 태그로 보관한다. 수집일은 운영 검증일이 아니므로 `last_verified_at=null`이다.
- 원천별 동일 제목+주소 완전 중복은 0건이다. 다만 고석정/고석정국민관광지처럼 이름이 다르고 주소·좌표가 같은 사례가 있어 실제 중복률은 추가 검토가 필요하다. 동일 군+정규화 제목 중복 후보는 CSV에 플래그로 기록했다.
- 원천 CSV의 이미지 URL은 별도 이미지 저작권 유형이 미확인되어 `image_license_not_verified`로 표시한다. CSV 이용허락범위와 개별 사진의 이용조건을 동일하다고 추정하지 않는다.

## 2. 한국관광공사 OpenAPI — 최초 명세 조사 및 후속 규격 정정

최초 명세 조사 시점에는 키가 없어 실제 호출을 수행하지 못했다. 이후 실제 호출 범위와 현재 키 재설정 상태는 문서 상단의 최신 검증 결과를 따른다. 생성한 장소 JSON에는 한국관광공사 실 API 응답을 넣지 않았다. 파일 데이터만으로 공사 API 필수활용 조건을 충족한다고 주장하지 않는다.

| 서비스 | 공식 카탈로그 | 현행 base path / 핵심 기능 | 확인한 조건 및 활용 방식 |
|---|---|---|---|
| 국문 관광정보 | [15101578](https://www.data.go.kr/tcs/dss/selectApiDataDetailView.do?publicDataPk=15101578) | `B551011/KorService2`; `ldongCode2`, `lclsSystmCode2`, `areaBasedList2`, `locationBasedList2`, `searchKeyword2`, `searchFestival2`, `searchStay2`, `detailCommon2`, `detailIntro2`, `detailImage2` | 개발 자동승인·운영 심의승인. 개발 1,000회/일 표기. v4.4는 구 `areaCode2`를 제거했으며, 현행 법정동 코드로 조회한다. |
| 무장애 여행 | [15101897](https://www.data.go.kr/data/15101897/openapi.do) | `B551011/KorWithService2`; `areaBasedList2`, `detailWithTour2` | `contentId` 기준 상세 조회. `parking, route, publictransport, wheelchair, exit, elevator, restroom, stroller, lactationroom` 등을 가족 브리핑 근거에 쓸 수 있다. 값 없음은 이용 불가가 아닌 미확인이다. |
| 관광지 집중률 예측 | [15128555](https://www.data.go.kr/data/15128555/openapi.do) | `B551011/TatsCnctrRateService/tatsCnctrRatedList` | 필수 `areaCd`, `signguCd`; 선택 `tAtsNm`. 응답에 `contentid`가 없고 관광지명·시군구가 있어 이름/권역 매칭 필요. 향후 30일 상대 예측지수이며 실시간 혼잡·교통시간이 아니다. |
| 기초지자체 중심 관광지 | [15128559](https://www.data.go.kr/data/15128559/openapi.do) | `B551011/LocgoHubTarService1/areaBasedList1` | 필수 `baseYm, areaCd, signguCd`. 내비게이션 연계빈도 기반 중심 관광지 최대 100위. 부모님 도보 적합도와 동일시하지 않는다. |
| 관광지별 연관 관광지 | [15128560](https://www.data.go.kr/data/15128560/openapi.do) | `B551011/TarRlteTarService1/areaBasedList1`, `searchKeyword1` | 필수 `baseYm, areaCd, signguCd`; 검색은 `keyword` 추가. 관광지/음식/숙박 미션 후보 연결에 사용하되 거리·영업·접근조건 재검사 필요. |

각 상세페이지에 내장된 공식 Swagger JSON을 `data/raw/public/openapi-*-spec.json`으로 추출했다. HTTP key 파라미터는 `serviceKey`, 공사 공통 입력은 `MobileOS`, `MobileApp`, `_type=json`, 페이지 입력은 `numOfRows`, `pageNo`다. 엔드포인트마다 필수 여부가 다르므로 보관된 명세를 기준으로 한다. `MobileOS=WEB` 지원이 명세마다 달라 공통값으로는 `ETC`가 보수적이다. `MobileApp`은 서비스 고유 식별값을 계속 사용한다.

공사 콘텐츠랩의 OpenAPI 가이드는 기획·디버깅 목적이며 무단 캐싱·크롤링을 금한다고 안내한다. 개발 이력과 서비스 고유 AppName, 서비스 URL은 운영계정 심사에도 확인한다. **공식 가이드 웹페이지를 크롤링해 API 키를 대체하는 수집은 하지 않았다.** [한국관광콘텐츠랩 안내](https://api.visitkorea.or.kr/)

## 3. 보조 데이터 — verified catalog / unverified runtime

| 데이터 | 공식 출처 | 검증 상태·첫 구현 선택 |
|---|---|---|
| 국가보훈부 현충시설 | [API](https://www.mpva.go.kr/mpva/contents.do?key=17), [카탈로그](https://www.data.go.kr/data/15056800/openapi.do) | **confirmed** 무키 JSON 200. 현충시설 분류가 휴가 보상 대상 증거는 아니므로 레이더 후보만 사용. |
| 병무청 나라사랑가게 | [15130342](https://www.data.go.kr/data/15130342/openapi.do) | **blocked** 키 미설정. 공식 명세 `1300000/JwctMmaUdhygigwan/getjwctMmaUdhygigwan`, 필수 `serviceKey,numOfRows,pageNo` 확인. 대상별 할인 자격을 일괄 장병혜택으로 표시하지 않는다. |
| TAGO 고속버스 | [15098522](https://www.data.go.kr/data/15098522/openapi.do) | **blocked** 키 미설정. `1613000/ExpBusInfo`; 터미널 ID 조회 후 출도착 운행정보 조회. 거리 추정 엔진과 구분한다. |
| TAGO 시외버스 | [15098541](https://www.data.go.kr/data/15098541/openapi.do) | **blocked** 키 미설정. 공식 안내는 당일 배차정보만 제공. 다음 주 가족 면회일 막차를 확정하는 기능에 사용 불가. |
| TAGO 열차 | [15098552](https://www.data.go.kr/data/15098552/openapi.do) | **blocked** 키 미설정. 출도착역 기반 시간표 조회 가능, 실제 접경 거점 경로 커버리지는 미검증. |
| 기상청 단기예보 | [15084084](https://www.data.go.kr/data/15084084/openapi.do) | **blocked** 키 미설정. 5km 격자 기반 예보/실황. 격자 변환·발표시각·예보 갱신 지연을 처리해야 하며 현재 날씨로 가짜값을 표시하지 않는다. |
| 공개 식단 | 소속/공개본 미지정 | **unverified** 제공기관·버전 불명. 실제 식단 연결을 보류하고 자녀가 직접 공개한 식사 선호만 가족 기능에 사용. |

## 4. 다음 실 API 검증 순서

1. 서버 환경의 `DATA_GO_KR_SERVICE_KEY`를 우선 사용한다. 없으면 기존 `TOUR_API_KOR_SERVICE_KEY`, `TOUR_API_SERVICE_KEY` 순으로 지원한다. 키나 키를 포함한 요청 URL은 로그·클라이언트·보고서에 쓰지 않는다. 사용자의 별도 서비스 신청은 실행하지 않았다.
2. `ldongCode2(lDongListYn=N)` 응답에서 강원특별자치도를 찾고 `lDongRegnCd`를 넣은 하위 응답에서5군을 찾는다. 현재 확인값은51/780/790/800/810/820이며, 목록은 `lDongRegnCd`, `lDongSignguCd`로 조회한다.
3. 5군×관광지/음식점/숙박/문화시설/축제의 조회 성공·총건수·좌표결측·상세 조회 성공률을 기록한다. 공사 데이터의 영구 저장은 공모전 안내의 별도 신청 조건을 준수한다.
4. `KorWithService2/detailWithTour2`로 시연 장소 10곳의 부모동행 근거를 확보한다. 확인된 필드만 설명하고 빈값은 미확인으로 노출한다.
5. 집중률은 별도 지역코드 표와 관광지명으로 소수 후보부터 매칭한다. `contentid` 직접 조인으로 구현하지 않는다. 매칭 성공률이 낮으면 P2로 유지한다.
6. 당일 실황/교통 호출은 각 1개부터 검증한다. 교통 미연결이면 거리 기반 보수적 추정+외부 길찾기 링크, 날씨 미연결이면 사용자가 고른 시나리오임을 표시한다.
7. 시연 미션은 공개 관광지 중 운영·예약·신분확인·주차·보행·이미지권리 검증을 완료한 노드만 선별한다. 현재 raw 노드 **606개가 곧 미션 생성 가능 606개라는 뜻은 아니다.** 현 단계 검증 완료 미션 건수는 0이다.

## 5. 산출물 및 재현

- `data/raw/public/dmz-15119699-0.csv`, `dmz-15119706-0.csv`: CP949 원본, 파일 버전 유지
- `data/raw/public/mpva-api-response.json`: 현충시설 실 API 응답, 2026-09-07 수집
- `data/raw/public/openapi-*-spec.json`: 제공기관 카탈로그 내 공식 API 명세
- `data/processed/place_nodes_gangwon.json`: 607개 원천 단위 정규화, 미확인 값 명시
- `reports/data_quality_flags.csv`: 노드 단위 결측·운영 미확인·중복 후보 목록
- `reports/data_validation_metrics.json`: 원본 해시, 측정 기준·전체/5군 지표
- 재현 명령: `python3 scripts/normalize_public_data.py`

`sample_missions.json`은 앱의 편집 미션 생성 단계에서 추가하며, 체류시간·가족도보·예약조건을 원천에 없는 실제값처럼 생성하지 않아야 한다.
