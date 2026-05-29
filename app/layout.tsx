import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "AI 말습관 코치 MVP",
    template: "%s | AI 말습관 코치 MVP"
  },
  description: "말습관 원인 후보를 추정하고 맞춤 훈련을 생성하는 발표 코칭 MVP."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
