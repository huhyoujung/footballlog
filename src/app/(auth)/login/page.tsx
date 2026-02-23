// 로그인 페이지 - 서버 인증 확인 및 역방향 리다이렉트 (로그인 상태면 홈으로)
import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LoginClient from "./LoginClient";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    redirect(session.user.teamId ? "/" : "/onboarding");
  }

  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  );
}
