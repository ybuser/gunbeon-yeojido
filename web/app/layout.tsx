import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: '군번여지도 강원 · 휴전선 밖 첫 하루',
  description:
    '복무 경험을 관광 경험으로 바꾸는, 장병과 가족·연인·친구가 함께 계획하는 강원 관광 여권',
  manifest: '/manifest.webmanifest',
  icons: { icon: '/icon.svg' },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
