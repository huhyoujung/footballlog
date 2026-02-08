import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import PWAManager from "@/components/PWAManager";
import TeamColorProvider from "@/components/TeamColorProvider";
import { TeamProvider } from "@/contexts/TeamContext";
import { SWRConfig } from "swr";

export const metadata: Metadata = {
  title: "네모의 꿈",
  description: "축구 팀원들을 위한 운동 일지 SNS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "네모의 꿈",
  },
};

export const viewport: Viewport = {
  themeColor: "#967B5D",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className="antialiased bg-gray-50 min-h-screen"
      >
        <SessionProvider>
          <SWRConfig
            value={{
              dedupingInterval: 2000, // 2초 내 중복 요청 방지
              revalidateOnFocus: false, // 탭 전환 시 자동 새로고침 비활성화
              revalidateOnReconnect: true, // 재연결 시에만 새로고침
              errorRetryCount: 3, // 에러 시 3번까지 재시도
              shouldRetryOnError: true,
              fetcher: (url: string) => fetch(url).then((res) => res.json()),
            }}
          >
            <TeamProvider>
              <TeamColorProvider />
              <PWAManager />
              {children}
            </TeamProvider>
          </SWRConfig>
        </SessionProvider>
      </body>
    </html>
  );
}
