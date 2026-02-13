import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 공개 경로는 통과
  if (
    pathname === "/login" ||
    pathname.startsWith("/invite/") ||
    pathname === "/test-modal"
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
