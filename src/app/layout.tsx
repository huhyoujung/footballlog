import type { Metadata, Viewport } from "next";
import "./globals.css";
import Script from "next/script";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { teamColorCssVars } from "@/lib/team-color";
import SessionProvider from "@/components/SessionProvider";
import PWAManager from "@/components/PWAManager";
import TeamColorProvider from "@/components/TeamColorProvider";
import { TeamProvider } from "@/contexts/TeamContext";
import SWRProvider from "@/components/SWRProvider";
import PostHogProvider from "@/components/PostHogProvider";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
  ),
  title: "라커룸",
  description: "축구 팀원들을 위한 운동 일지 SNS",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "라커룸",
  },
  openGraph: {
    title: "라커룸",
    description: "축구 팀원들을 위한 운동 일지 SNS",
    type: "website",
    images: [
      {
        url: "/icons/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "라커룸 로고",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "라커룸",
    description: "축구 팀원들을 위한 운동 일지 SNS",
    images: ["/icons/icon-512x512.png"],
  },
};

export const viewport: Viewport = {
  themeColor: "#1D4237",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 서버사이드에서 팀 컬러를 미리 주입해 FOUC(컬러 깜빡임) 방지
  const session = await getServerSession(authOptions);
  const primaryColor = session?.user?.team?.primaryColor || "#1D4237";
  const cssVars = teamColorCssVars(primaryColor);

  return (
    <html lang="ko" style={cssVars as React.CSSProperties}>
      <head>
        {/* Pretendard 폰트: @import(직렬) → <link>(HTML 파싱과 병렬 로딩) */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {/* 훈련 이미지 / 프로필 사진 도메인 preconnect (DNS+TLS 미리 맺기) */}
        <link rel="preconnect" href="https://dssyfyurslaopejnioqx.supabase.co" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
      </head>
      <body
        className="antialiased bg-gray-50 min-h-screen"
      >
        <PostHogProvider>
          <SessionProvider>
            <SWRProvider>
              <TeamProvider>
                <TeamColorProvider />
                <PWAManager />
                {children}
              </TeamProvider>
            </SWRProvider>
          </SessionProvider>
        </PostHogProvider>
        {/* 모달 전용 루트 - 모든 containing block 밖에 위치 */}
        <div id="modal-root"></div>
        {/* Google AdSense */}
        <Script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4077089301782274"
          crossOrigin="anonymous"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
