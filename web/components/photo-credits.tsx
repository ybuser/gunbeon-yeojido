'use client';
import { photoLibrary } from '@/lib/place-photos';
import MemoryImage from './memory-image';
export default function PhotoCredits() {
  return (
    <section className="photo-credits" id="photo-credits">
      <h2>사진 출처와 이용조건</h2>
      <p>
        관광 정보와 사진은 출처가 다를 수 있습니다. 사진은 촬영 당시의 모습이며
        현재 경관·개방 여부와 다를 수 있어요.
      </p>
      <div className="photo-credit-list">
        {photoLibrary.map((p) => (
          <article key={p.id}>
            <MemoryImage
              src={p.url}
              alt={p.caption}
              loading="lazy"
              style={{ objectFit: 'contain' }}
            />
            <div>
              <h3>{p.titles[0]}</h3>
              <p>{p.caption}</p>
              <p>{p.credit}</p>
              <p className="helper">
                {p.changes} 사진과 잘라 표시한 이미지는 명시된 라이선스를
                따릅니다.
              </p>
              <a href={p.sourceUrl} target="_blank" rel="noreferrer">
                원문·저작자 확인
              </a>
              <a href={p.licenseUrl} target="_blank" rel="noreferrer">
                {p.license}
              </a>
            </div>
          </article>
        ))}
      </div>
      <p className="helper">
        별도 표기가 없는 관광공사 사진: ⓒ한국관광공사. 개별 권리·이용조건은
        원문을 확인해야 합니다. 새로 추가한 사진의 원문·원본 주소·선별 및 제외
        기록은{' '}
        <a
          href="https://github.com/ybuser/gunbeon-yeojido/blob/master/reports/photo_sources.md"
          target="_blank"
          rel="noreferrer"
        >
          전체 사진 검토 목록
        </a>
        에서 확인할 수 있습니다. 확인일 2026. 9. 8.
      </p>
    </section>
  );
}
