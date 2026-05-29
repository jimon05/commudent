import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HairPricer",
  description: "헤어스타일별 미용실 가격, 평점, 후기 요약 비교 MVP"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
