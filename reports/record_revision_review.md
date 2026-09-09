# 여행 기록 수정·계획 복원·새 계획 복사: 구현 전 검토

검토일: 2026-09-09 KST. 읽기 시점 Git HEAD `a26fdf2`, 작업 트리 clean. 대상 코드와 관련 그룹·출타·테스트 코드를 읽었으며 checkout 수정, Sites 작업, 실제 테스트 실행은 하지 않았다. root 구현과 병행하므로 아래 줄 번호는 검토 스냅샷 기준이다.

## 권장 결론

**세 동작을 분리하면 기존 Entry 스키마를 유지하면서 구현할 수 있다.** 기록 수정은 실제 방문 장소 선택과 방문 스탬프 교체만 담당하고 원래 계획을 보존한다. 잘못 완료한 기록은 동일 Entry의 완료 상태를 제거해 계획으로 돌린다. 새 계획 복사는 기존 TripBuilder `copy` 경로를 사용해 새 ID를 생성하고 원래 기록을 그대로 둔다.

| 사용자 동작 | 바뀌는 값 | 반드시 보존할 값 | 화면 결과 |
|---|---|---|---|
| 기록 수정 | `visitedPlaceIds`, 방문 스탬프 4종 | Entry ID·`missionId`·`plan`·계획 제목/지역·기존 완료 시각·준비 스탬프 | 같은 여행 기록 갱신 |
| 계획으로 되돌리기 | 완료 시각·방문 장소 선택·방문 스탬프 제거 | 같은 ID·원래 계획 전체·`휴가 씨앗` | 기록 1개 감소, 계획 1개 증가 |
| 새 계획으로 가져오기 | 새 `recordId`·`missionId`, 완료 없는 계획 사본 | 원래 기록의 모든 값 | 새 계획 1개 증가, 기존 기록 유지 |

세 동작 모두 현재 출타를 자동 시작/종료/되감기하지 않는다. 그룹 초대와 이미 서버에 공유한 일정은 자동 변경하지 않는다.

## 현재 구조와 재사용 지점

- `web/lib/domain.ts:601`: Entry는 계획 `plan`과 완료 메타데이터 `completedAt`, `visitedPlaceIds`, 혼합 스탬프 배열을 함께 저장한다. 기록용 별도 계획 스냅샷은 없다.
- `domain.ts:677`: `createEntry`는 관광 API 본문 대신 장소 참조와 계획 값을 저장하고 빈 스탬프로 시작한다.
- `domain.ts:710`: `entryKey`는 `recordId || missionId`; `hasVisitRecord`는 완료 시각 **또는** 방문 스탬프 존재를 본다. `휴가 씨앗`만 있으면 계획이다.
- `domain.ts:996`: `completeTrip`는 최초 완료용이다. 기존 Entry를 펼치고 완료 시각을 현재로 설정하며 스탬프는 기존 값과 합친다.
- `web/lib/day-passport.ts:90`: `dayRecord`가 화면·복사 텍스트·SVG의 공통 공개 투영이다. 선택 ID와 계획 ID의 교집합만 반영하고 직접 지정/민감 장소를 제외한다. 미조회 방문 장소가 있으면 텍스트·SVG 내보내기를 막는다.
- `web/components/trip-completion.tsx:26`: 방문 장소·스탬프 선택 UI는 재사용 가능하지만 현재는 신규 완료 초기값과 문구만 있다.
- `web/components/trip-builder.tsx:457`: `canUpdate = edit && initial && !hasVisitRecord(initial)`. 완료 기록은 갱신하지 않으며 copy는 새 ID, 빈 스탬프, 완료 정보 없는 Entry를 만든다.
- `web/components/passport-app.tsx:2510`: 개인 계획 저장 시 원래 계획 Entry만 교체하고 기록 copy는 새 Entry를 추가한다. 별도 기록 수정 경로가 알맞다.

## 구현에서 놓치기 쉬운 위험

### 1. completeTrip를 기록 편집에 그대로 사용하지 않기

현재 함수는 `stamps: [...new Set([...entry.stamps, ...chosen])]`라 체크를 해제한 방문 스탬프가 남는다. `completedAt: now`도 원래 기록의 완료 시각을 바꾼다. 기록 수정용 순수 함수를 따로 두어 방문 스탬프를 **교체**하고 준비 스탬프를 보존한다. 기존 `completeTrip`의 최초 완료 동작과 activeOuting 종료 로직은 그대로 유지한다.

기록 수정에는 계획 제목·날짜·체류/도보 시간·순서를 편집하는 TripBuilder를 사용하지 않는다. 현재 `Entry.title`은 계획 제목이고 그룹 `sharePlan`에도 사용되므로 개인 기록 제목/메모처럼 덮어쓰면 계획·공유의 의미가 바뀐다.

### 2. 복원은 완료 시각만 제거해서는 부족함

`hasVisitRecord`는 `입경/전환/복귀/동행`도 검사한다. `completedAt`만 지우면 계속 기록 탭에 남는다. `completedAt`, `visitedPlaceIds`를 삭제하고 방문 4종을 제거하되 `휴가 씨앗`은 보존해야 한다. `plan`과 ID는 그대로 둔다. JSON round trip 뒤에도 `hasVisitRecord(restored) === false`여야 한다.

복원 확인 문구는 “완료 표시와 방문 기록을 지우고 원래 여행 계획으로 되돌립니다”처럼 영향이 드러나야 한다. 취소 버튼은 상태를 바꾸지 않는다. 실제 출타를 다시 시작하려면 이후 사용자가 별도로 `출타 시작`을 선택한다.

### 3. 기록 편집 초기값과 미조회 장소 유실

TripCompletion은 현재 `stamps=['입경','복귀']`, `visited=[]`, `withoutPlaces=false`로 시작한다. edit 모드는 기존 방문 스탬프·방문 ID를 초기화에 사용하고, 명시적 빈 배열에만 “장소 목록 없이”를 선택한다. `visitedPlaceIds === undefined`인 이전 기록을 빈 배열과 혼동하지 않는다.

현재 후보는 `places`에서 찾지 못한 장소를 생략한다. 미조회 장소가 있는 기록을 열어 저장하는 것만으로 기존 방문 ID를 삭제하면 안 된다. 기존 선택을 보존하고 미조회 표시/재조회 또는 명시적 제거를 제공한다. 저장 차단 방식을 택한다면 이유를 보여주고 기존 기록을 유지한다. 외부 데이터 미조회는 “방문하지 않음”이 아니다.

`dayRecord`의 공개 장소 필터와 미조회 내보내기 차단을 계속 사용한다. 후보 ID는 중복 제거하며 직접 지정 장소·민감 제목·계획 밖 ID가 공개 기록에 새로 들어가지 않도록 한다.

### 4. activeOuting은 독립 스냅샷

`domain.ts:932`의 ActiveOuting은 Entry와 `startedAt/timeBudgetMinutes/completedStops/settings`를 가진다. `outing-panel.tsx:349`는 출발 때 Entry를 structuredClone한다. 배열 `entries`를 바꾼다고 현재 출타 스냅샷을 재작성하면 안 된다.

- 기록 수정·복원·사본 생성 후 다른 여행의 현재 출타 객체가 깊은 비교로 같아야 한다.
- 현재 출타와 동일 ID의 기록 편집/복원은 충돌 상태로 막고 현재 출타 화면으로 안내하는 편이 최소 변경이다. 서버나 저장 데이터의 비정상 조합을 자동으로 해석해 덮어쓰지 않는다.
- 최초 완료에서만 동일 ID의 activeOuting을 비우는 기존 `passport-app.tsx:2568` 로직을 사용한다. “기록 수정” 분기에 이 종료 처리를 재사용하지 않는다.
- 복원은 과거 출타 타이머를 재생성할 정보/의도가 없다. 완료 전 시간을 역산해 현재 출타를 복구하지 않는다.
- `outing-panel.tsx:94`는 현재 `!completedAt`만 검사한다. 방문 스탬프만 있는 이전 기록도 출타 목록에서 제외하려면 `!hasVisitRecord(e)`로 판정을 통일하는 것이 좋다.

### 5. 그룹 공유·초대는 Entry와 별개

`web/lib/group-model.ts:90`의 `sharePlan`은 계획만 화이트리스트 투영한다. 방문 ID·스탬프·완료 시각·현재 출타·개인 복귀 기준은 서버로 보내지 않는다. `groupEntry`는 그룹 일정을 새 개인 Entry로 가져온다.

초대 코드는 Entry 필드가 아니다. `travel-groups.tsx:369`의 invite UI 상태와 서버 D1이 관리하며, 기존 legacy `family`에는 code/scopes/expiry가 있다. 세 개인 작업에서 `groupStore.action`, `setGroupReload`, `setFamily` 또는 그룹 구성원을 갱신할 이유가 없다. 기존 `?join=`·참여 쿠키·초대 코드도 보존한다.

완료 기록의 “그룹에 공유”는 계속 **원래 계획**을 공유한다. 방문 기록 수정이 그룹 일정 수정으로 이해되지 않도록 버튼/설명에 계획 공유임을 드러낸다. 자동 동기화는 추가하지 않는다. `sharePlan(before)`와 `sharePlan(afterRecordEdit)`의 결과는 같아야 한다.

### 6. 스냅샷·식별자·복사 시각

- `completion`, `shared`, `reviewEntry`, `composer.entry`는 Entry 객체 스냅샷이다. 기록 수정 후 열려 있는 공유 카드가 오래된 값을 보여주지 않도록 닫거나 현재 ID로 다시 조회한다.
- 저장 handler는 dialog가 열릴 때의 Entry로 통째로 덮어쓰기보다 `setEntries(current => current.map(...))`의 최신 Entry에 기록 patch만 적용한다. 대상이 사라졌으면 새 Entry를 만들지 않는다.
- copy는 원래 plan.stops/manualPlaces의 가변 배열을 직접 변경하지 않아야 한다. 복사 후 편집해도 원래 기록이 JSON 수준으로 동일한지 검증한다.
- 기존 TripBuilder copy는 과거 출발 시각/시간 예산을 가져온다. 새 계획에서 날짜·복귀 기준을 확인하도록 표시하고 원본의 과거 일정을 자동 변경하지 않는다.
- 이전 Entry에 recordId가 없으면 missionId fallback을 쓴다. 동일 fallback ID가 여러 개 있는 fixture로 map 갱신 범위를 확인한다. 식별자 보강을 한다면 저장된 ID와 activeOuting 대응 관계를 함께 검토한다.

## 최소 상태/함수 제안

기존 JSON version 3과 Entry 필드를 그대로 쓸 수 있다. D1 스키마·마이그레이션·관광 API 응답 저장을 추가할 필요가 없다.

```ts
type RecordDialog =
  | { mode: 'complete'; entryId: string; key: string }
  | { mode: 'edit'; entryId: string; key: string }
  | null;

type VisitPatch = {
  stamps: string[];
  visitedPlaceIds?: string[]; // undefined = 이전 기록의 미확인 상태 유지
};

// 정확한 함수명은 구현자가 결정한다.
reviseVisitRecord(entry, patch, confirmationTime): Entry;
restoreTripPlan(entry): Entry;
// copy는 기존 TripBuilder(mode='copy') + createEntry를 재사용한다.
```

`reviseVisitRecord`는 완료 기록만 수정한다. 허용된 방문 스탬프를 중복 제거하여 교체하고 준비 스탬프를 유지한다. visited IDs도 배열/문자열 여부와 계획 참조·개인 장소 여부를 검증한다. 기존 유효한 completedAt은 보존한다. 방문 스탬프만 있던 이전 기록에서 모든 스탬프를 해제하면 기록 분류가 사라질 수 있으므로, 편집을 확정한 시각으로 `completedAt`을 보강하는 방식을 명시적으로 택할 수 있다. 그 시각을 실제 방문 날짜라고 표시하면 안 된다.

`restoreTripPlan`은 계획이 있는 기록만 대상으로 한다. 장소 순서가 없는 이전 기록은 원래 계획을 복구할 수 없으므로 복원/계획 사본 버튼을 비활성화하고 이유를 설명한다. 기존 기록 삭제나 임의 코스 생성으로 대체하지 않는다. 이런 기록의 방문 스탬프 편집 지원 여부는 분리하여 정한다.

TripCompletion에는 `mode`를 추가하거나 별도 얇은 기록 편집 UI를 만들 수 있다. React key에 `mode + entryKey + 열기 nonce`를 넣으면 동일 여행에서 신규 완료/편집을 전환하거나 재개할 때 초기값이 섞이지 않는다. “기록 수정 / 수정 저장 / 취소”와 “여행 완료 / 여행 완료로 기록” 문구도 구분한다.

현재 스키마의 방문 장소는 원래 계획의 부분집합이다. 이번 최소 구현은 이 범위의 방문 선택·스탬프 수정이다. 원래 계획에 없던 실제 방문 장소, 실제 여행 날짜, 개인 메모까지 지원하려면 `record` 전용 참조/메타데이터를 별도로 추가하고 dayRecord·resolve·공개 투영을 함께 바꿔야 한다. `plan`을 실제 기록처럼 덮어쓰지 않는다.

## 테스트 조건

| 계층 | 최소 검증 |
|---|---|
| 도메인: 기록 수정 | 방문 ID 추가/해제·스탬프 해제 가능; ID/plan/title/region/기존 completedAt/휴가 씨앗 불변; 원본 객체 미변경 |
| 도메인: 기록 필터 | 중복·다른 계획 ID·manual ID·manualPlaces 참조 제외, 비정상 입력으로 throw/오염 없음; 민감 제목은 공개 투영에서 제외 |
| 도메인: 복원 | completedAt/visited IDs/방문 4종 제거, 휴가 씨앗 보존, hasVisitRecord false, planSignature 불변, JSON round trip 유지 |
| 도메인: 복사 | 새 ID, 빈 stamps, completedAt/visitedPlaceIds 없음, 원래 기록 불변; 복사본 장소·시각·제목 수정도 원본 불변 |
| 이전 기록 | visited undefined와 [] 구분; completedAt 없는 stamp-only 기록; plan 없는 기록의 비활성/안내; 중복 legacy ID의 갱신 범위 |
| 미조회 데이터 | 기존 미조회 visited ID가 편집 열기/저장으로 사라지지 않음; resolve 뒤 기존 선택 유지; 해결 전 내보내기 차단 |
| React 상태 | 편집 열기→취소 완전 불변, 편집→저장 즉시 기록 카드 반영, 재열기 초기값 유지, 다른 Entry로 전환 때 선택 누출 없음 |
| 목록·새로고침 | 복원 시 기록/계획 수 이동, 복사 시 기록 수 유지+계획 1 증가, 새로고침 후 같은 상태, 기존 계획 날짜 보존 |
| 출타 | 다른 activeOuting의 전체 snapshot/진행/복귀 기준 불변; 동일 ID 충돌 작업 차단; 복원 후 자동 출타 시작 없음; 최초 완료만 동일 active 해제 |
| 공유·초대 | 세 동작에서 `/api/groups` 변경 POST 0건; group plan/version/invite/family scope 그대로; join 진입/기존 초대 기능 유지 |
| 공개 내보내기 | 수정 후 화면/텍스트/SVG 동일 visited/stamps, 해제한 값 잔존 없음, 계획 시간·개인 장소·좌표·내부 ID·기록 시각 비노출 |
| API 회귀 | 기록 편집/복원만으로 권역 목록·지도 SDK 신규 호출 없음; 필요한 미조회 참조 재조회는 기존 resolve 경로 사용; 정상 TourAPI 검색/상세/복사 편집 유지 |

기존 단위 검사는 `web/tests/day-passport.test.mjs`, `planning-outing.test.mjs`, `travel-flow.test.mjs`, `group-model.test.mjs`에 확장하는 것이 자연스럽다. 기존 브라우저 흐름은 `web/scripts/day-passport-qa.mjs`, `planning-outing-qa.mjs`를 재사용한다. 360/430px와 desktop에서 편집 dialog의 스크롤·버튼 접근·키보드 focus/취소를 확인한다.

root 실행 검사는 `web/`의 `npm test`, `npm run typecheck`, `npm run build`와 변경 흐름의 키 없는 브라우저 QA를 기본으로 하고 실제 TourAPI·Kakao 회귀는 별도 결과로 기록한다. 이 검토에서는 테스트를 실행하지 않았다.
