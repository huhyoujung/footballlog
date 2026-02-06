import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const token = req.nextauth.token;

    // 로그인한 사용자가 로그인 페이지 접근 시 홈으로 리다이렉트
    if (pathname === "/login" && token) {
      return NextResponse.redirect(new URL("/", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // 로그인 페이지는 항상 접근 가능
        if (pathname === "/login") return true;

        // 초대 링크 페이지는 항상 접근 가능
        if (pathname.startsWith("/invite/")) return true;

        // 그 외 페이지는 로그인 필요
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json).*)"],
};
