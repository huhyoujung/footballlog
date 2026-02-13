import type { Metadata, Viewport } from "next";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import PWAManager from "@/components/PWAManager";
import TeamColorProvider from "@/components/TeamColorProvider";
import { TeamProvider } from "@/contexts/TeamContext";
import SWRProvider from "@/components/SWRProvider";

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
          <SWRProvider>
            <TeamProvider>
              <TeamColorProvider />
              <PWAManager />
              {children}
            </TeamProvider>
          </SWRProvider>
        </SessionProvider>
        {/* 모달 전용 루트 - 모든 containing block 밖에 위치 */}
        <div id="modal-root"></div>
      </body>
    </html>
  );
}
