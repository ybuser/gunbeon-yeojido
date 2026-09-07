# 군번여지도 강원: 휴전선 밖 첫 하루

장병과 가족이 공개 거점에서 출발해 돌아올 여유까지 계획하는 강원 관광 여권. **2026 관광데이터 활용 공모전 ① 웹·앱 개발 부문** 1차 심사를 위한 개발 저장소입니다.

## 현재 구현

- 모바일 하단4메뉴와 데스크톱 반응형, 역할·상황·권역·동행·시간 조건
- 공개 거점/2~3장소 미션, 거리 추정 복귀시계·도보·날씨 시나리오
- 방문 조건 디코더, 현재 법정동 기반 TourAPI 서버 조회, 장소 상세·부모 무장애 상세
- 부모 독립 브리핑, 동일 브라우저 전용 초대·범위 설정·해제
- 비무장 여권 5장·자기 기록 스탬프·정보를 제한한 SVG 공유 카드
- 현충시설 후보/제도 준비 체크, 출처와 API 오류 확인
- PWA manifest와 네트워크 단절 안내(관광 API 응답은 오프라인 캐시하지 않음)

현재 버전은 기초 구현입니다. 2026-09-07 무장애 API의 현재 법정동 기준 접경5군 108개 레코드를 확인했습니다. 국문 API의 구 지역코드 237건은 누락이 있는 부분 집합이므로 현행 법정동 방식으로 전환했습니다. 공통 키가 다시 설정되면 국문 전체 검증을 재실행합니다. 제출 전에는 최종 배포의 API 활용과 사용 흐름까지 검증해야 합니다. 교통/도보는 추정이며, 날씨는 기상청 예보 조회와 사용자 선택 버퍼를 구분합니다(새 예보 어댑터의 실 호출은 아직 미검증). 가족 연결은 다른 기기와 동기화되지 않습니다. 스탬프는 공적 인증이 아닙니다.

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

저장소 루트 `.env.local`의 `DATA_GO_KR_SERVICE_KEY`에 공통 일반 인증키를 한 번 입력한 후 개발 서버를 재시작하세요. [신청할 API와 키 형식](reports/api_setup.md). 키는 서버에만 보관하고 Git/채팅에 올리지 않습니다. Kakao JavaScript 키는 공개 브라우저 키로 사용하며 허용 도메인 등록이 필요합니다.

```sh
cd web
npm run typecheck
npm test
npm run build
```

## 구조

- `web/`: React/TypeScript/Tailwind와 App Router 호환 Vinext/Sites 앱
- `web/lib/domain.ts`: 결정 가능한 복귀시계·미션·공유권한 계산
- `web/lib/tour-api.ts`: 인증키를 노출하지 않는 공사 API 어댑터
- `scripts/normalize_public_data.py`: 공개 원천 정규화 재현
- `scripts/validate_tour_api.mjs`: 실키 설정 후 5군 API 점검
- `data/raw/public/`: 공개 원천/명세와 `data/processed/`: 변환 결과
- `reports/`: 공고·Notion·제출양식·데이터 품질·구현 계획

[개발 계획](reports/implementation_plan.md) · [공식 규정](reports/notion_requirements.md) · [데이터 검증](reports/data_validation_summary.md) · [제출물](reports/submission_assets.md)

## 출처와 범위

통일부 DMZ 관광/카페 CSV, 국가보훈부 현충시설 공개 API를 확인해 접경5군 607개 원천 레코드를 정규화했습니다(좌표 범위 유효606). 원천 간 고유 장소 통합·현장 접근성 검증을 완료했다는 의미는 아닙니다. 공사 API 출처 텍스트는 `출처: ⓒ한국관광공사`를 사용합니다.

고석정 사진: 한국문화관광연구원(2015), [공공누리 제1유형](https://www.kogl.or.kr/recommend/recommendDivView.do?division=img&oc=&recommendIdx=2453). 제공기관의 공공데이터/이미지 이용조건은 각 원천에 따릅니다.

정확한 부대명·군번·복무지·작전·근무정보·복귀 경로 원문·휴가증·군 신분증을 입력하거나 저장하지 않습니다. 초대코드는 로컬 시연 기능이며 인증보안 제품으로 사용하면 안 됩니다.
