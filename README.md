# 군번여지도 강원: 휴전선 밖 첫 하루

장병과 가족이 만남 장소에서 출발해 돌아올 여유까지 계획하는 강원 관광 여권. **2026 관광데이터 활용 공모전 ① 웹·앱 개발 부문** 1차 심사를 위한 개발 저장소입니다.

[외부 테스트 사이트](https://gunbeon-yeojido-gangwon.ybuser.chatgpt.site/)에서 안내받은 임시 비밀번호로 입장할 수 있습니다. ChatGPT 로그인은 필요하지 않습니다. 개인 코스는 사용한 브라우저에 저장됩니다.

## 현재 구현

- 코스별 1~4칸 대표 사진, 빈 코스 저장·추천 가져오기·최대 12곳의 순서/시간 편집
- TourAPI 키워드 검색·가까운 장소·직접 입력·지도 위치 선택, 즐겨찾기 우선 표시와 저장한 장소 ID 재조회
- 모바일 하단 5메뉴와 데스크톱 반응형, 역할·상황·권역·동행·시간 조건
- 만남 장소는 즐겨찾기·지도 직접 설정, 개인 장소를 사용한 브라우저에 저장
- 출발 예정 시각에 고정된 계획과 실제 시작·진행·종료를 기록하는 현재 출타 시계
- 여행 완료 확인 뒤 선택한 스탬프 기록, 거리 추정 복귀 여유·도보·날씨 시나리오
- 방문 조건 디코더, 현재 법정동 기반 TourAPI 서버 조회, 장소 상세·부모 무장애 상세
- 부모 독립 브리핑, 동일 브라우저 전용 초대·범위 설정·해제
- 장소 참조·개인 장소 스냅샷과 순서를 보존하는 내 여행, 비무장 여권 5장·준비/방문 자기 기록·정보를 제한한 SVG 공유 카드
- 현충시설 후보/제도 준비 체크, 출처와 API 오류 확인
- PWA manifest와 네트워크 단절 안내(관광 API 응답은 오프라인 캐시하지 않음)

2026-09-07 기준 공통 일반 인증키로 공공 API 6종의 실제 응답을 확인했습니다. 국문 관광정보는 현재 법정동 기준 접경 5군·5개 관광타입 **520건**, 무장애 대표 상세 5군 모두 응답 성공입니다. 앱 서버의 관광정보·무장애·기상청 예보 연결과 카카오 SDK 인증도 확인했습니다. 집중률·중심·연관 관광지는 표본 호출 검증 단계이며 추천 엔진에 통합됐다는 뜻은 아닙니다.

여행 서비스 6종을 조사해 사진과 조건 비교 중심으로 화면을 전면 개편했습니다. 다섯 메뉴는 **둘러보기 / 지도·미션 / 현재 출타 / 가족 / 내 여행**입니다. 조건은 3단계 편집창에서 바꾸고, 지도 번호와 장소 목록·상세가 연결됩니다. 부모는 초대코드 없이도 여행안을 만들 수 있습니다. [디자인 컨셉과 화면 설계](reports/design_concept_v2.md).

교통·도보는 거리 기반 추정이며, 날씨는 기상청 예보와 사용자가 적용하는 시간 버퍼를 구분합니다. 가족 초대는 같은 브라우저의 시연 기능이고 다른 기기와 동기화되지 않습니다. 스탬프는 개인 기록입니다. Chrome·Edge의 4가지 화면 크기로 계획·지도·저장 흐름을 점검했습니다. 실제 휴대폰·부모 사용성과 현장 운영조건은 별도 확인이 필요합니다. 외부 비밀번호 체험은 공개 배포했습니다. [제품 및 브라우저 검증 보고서](reports/browser_qa_report.md) · [계획·현재 출타 및 최신 검증](reports/planning_outing_delivery.md).

## 시작

Node.js 22.13 이상.

```sh
cp .env.example .env.local
cd web
npm ci
# web/.env.local이 없다면 상위 설정 연결
ln -s ../.env.local .env.local
npm run dev
```

저장소 루트 `.env.local`의 `DATA_GO_KR_SERVICE_KEY`에 공통 일반 인증키를 한 번 입력한 후 개발 서버를 재시작하세요. [신청할 API와 키 형식](reports/api_setup.md). 키는 서버에만 보관하고 Git/채팅에 올리지 않습니다. `TEST_ACCESS_PASSWORD`와 32바이트 이상의 무작위 `TEST_SESSION_SECRET`도 설정해야 합니다. 로컬 설정과 배포 secret은 별개입니다. Kakao JavaScript 키는 공개 브라우저 키로 사용하며 허용 도메인 등록이 필요합니다.

```sh
cd web
npm run typecheck
npm test
npm run build
# 설치된 Chrome·Edge에서 실제 API 사용 (별도 브라우저 프로필)
npm run test:browser
npm run test:custom
npm run test:outing
```

브라우저 재현 방법과 API 실패 검사 설정은 [QA 보고서](reports/browser_qa_report.md)에 있습니다. CI는 키 없이 Chromium에서 장애 대응 흐름을 실행합니다.

## 구조

- `web/`: React/TypeScript/Tailwind와 App Router 호환 Vinext/Sites 앱
- `web/lib/domain.ts`: 결정 가능한 복귀시계·미션·공유권한 계산
- `web/lib/tour-api.ts`: 인증키를 노출하지 않는 공사 API 어댑터
- `scripts/normalize_public_data.py`: 공개 원천 정규화 재현
- `scripts/validate_tour_api.mjs`: 실키 설정 후 5군 API 점검
- `data/raw/public/`: 공개 원천/명세와 `data/processed/`: 변환 결과
- `reports/`: 공고·Notion·제출양식·데이터 품질·구현 계획

[다음 작업](reports/next_steps_after_review.md) · [개발 계획](reports/implementation_plan.md) · [공식 규정](reports/notion_requirements.md) · [데이터 검증](reports/data_validation_summary.md) · [제출물](reports/submission_assets.md)

## 출처와 범위

통일부 DMZ 관광/카페 CSV, 국가보훈부 현충시설 공개 API를 확인해 접경5군 607개 원천 레코드를 정규화했습니다(좌표 범위 유효606). 원천 간 고유 장소 통합·현장 접근성 검증을 완료했다는 의미는 아닙니다. 공사 API 출처 텍스트는 `출처: ⓒ한국관광공사`를 사용합니다.

고석정 사진: 한국문화관광연구원(2015), [공공누리 제1유형](https://www.kogl.or.kr/recommend/recommendDivView.do?division=img&oc=&recommendIdx=2453). 제공기관의 공공데이터/이미지 이용조건은 각 원천에 따릅니다.

정문 앞이나 늘 만나는 곳 등 개인 장소의 이름·설명·선택 좌표를 즐겨찾기와 여행에 저장할 수 있습니다. 개인 장소, 출발 계획, 출타 시작·복귀 시간창은 해당 브라우저의 localStorage에 보관하며 가족·공개 공유에서 제외합니다. 즐겨찾기를 바꾸거나 지워도 기존 여행의 장소는 유지됩니다. 지도 SDK와 외부 길찾기는 각 제공자의 통신을 사용하므로 모든 좌표가 기기를 벗어나지 않는다는 뜻은 아닙니다.

GPS 자동 수집, 군번·작전·근무정보·휴가증·군 신분증 이미지 입력 기능은 없습니다. 초대코드는 같은 브라우저의 시연 기능이며 개인 계정이나 기기 간 동기화를 제공하지 않습니다.
