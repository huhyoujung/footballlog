import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 소셜 미디어 크롤러 User-Agent (OG 미리보기 생성용)
const CRAWLER_UA_REGEX = /facebookexternalhit|Twitterbot|KakaoTalk|LinkedInBot|Slackbot|WhatsApp|TelegramBot|Discordbot|bingbot|Googlebot|YandexBot|Applebot/i;

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const userAgent = req.headers.get("user-agent") || "";

  // 공개 경로는 통과
  if (
    pathname === "/login" ||
    pathname.startsWith("/invite/") ||
    pathname === "/test-modal" ||
    pathname.endsWith("/opengraph-image") || // OG 이미지는 크롤러가 접근해야 함
    CRAWLER_UA_REGEX.test(userAgent) // 소셜 미디어 크롤러는 OG 태그 읽도록 통과
  ) {
    return NextResponse.next();
  }

  // next-auth 세션 토큰 쿠키 확인
  const token =
    req.cookies.get("next-auth.session-token") ||
    req.cookies.get("__Secure-next-auth.session-token");

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|custom-sw.js|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico|mp3|wav|ogg)).*)"],
};
