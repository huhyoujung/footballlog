"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Feed from "@/components/Feed";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && !session?.user?.teamId) {
      router.replace("/onboarding");
    }
  }, [session, status, router]);

  // 세션 로딩 중이거나 미인증이면 빈 화면 (미들웨어가 리다이렉트 처리)
  if (status !== "authenticated") return null;

  return <Feed />;
}
