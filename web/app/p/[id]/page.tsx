import AdvicePublic from '@/components/advice-public';
import { findShare } from '@/lib/advice-server';
import { adviceQuestions, type AdviceSnapshot } from '@/lib/advice-model';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  try {
    const { id } = await params,
      row = await findShare(id),
      snapshot = JSON.parse(row.payload) as AdviceSnapshot;
    const title =
        snapshot.region.replace(/[군시]$/, '') +
        ' 하루, ' +
        adviceQuestions[snapshot.question],
      description =
        '관광지 한 곳을 바꾸거나 보태주세요. 가입 없이 한 수를 남기고, 이 코스로 나의 강원 여행도 시작해요.';
    return {
      title,
      description,
      robots: { index: false, follow: false },
      openGraph: {
        title,
        description,
        type: 'website',
        siteName: '군번여지도 강원',
      },
      twitter: { card: 'summary', title, description },
    };
  } catch {
    return {
      title: '종료된 여행 공유 · 군번여지도',
      robots: { index: false, follow: false },
    };
  }
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdvicePublic id={id} />;
}
