import Brand from "@/components/brand";
export default function About() {
  return (
    <main className="account-page">
      <a href="/login">
        <Brand />
      </a>
      <article className="account-panel legal-copy">
        <p className="account-eyebrow">군번여지도 강원</p>
        <h1>휴전선 밖 첫 하루</h1>
        <p>
          장병과 가족·연인·친구가 강원 여행을 함께 계획하고 다녀온 하루를 기록하는 모바일 여행
          서비스입니다.
        </p>
        <h2>함께 계획하고, 편하게 다녀오기</h2>
        <p>
          강원 접경 5군의 한국관광공사 관광정보로 코스를 만들고, 그룹에 여행을 공유하고, 내 출타
          일정의 여유 시간을 확인합니다. 여행이 끝나면 하루 여권에 나만의 기록을 남깁니다.
        </p>
        <p>2026 관광데이터 활용 공모전 ① 웹·앱 개발 부문 참가 서비스이며 현재 테스트 중입니다.</p>
        <a className="account-primary-link" href="/login">
          여행 시작하기
        </a>
        <a href="/privacy">개인정보 안내</a>
      </article>
    </main>
  );
}
