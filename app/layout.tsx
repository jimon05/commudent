import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Commudent",
    template: "%s | Commudent"
  },
  description: "발표 자료, 대본, 녹음을 바탕으로 핵심 내용 전달 여부를 확인하고 발표 경험을 성장 데이터로 전환합니다."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
