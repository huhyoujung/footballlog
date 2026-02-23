"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { teamColorCssVars } from "@/lib/team-color";

export default function TeamColorProvider() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.teamId) return;

    const loadTeamColor = async () => {
      try {
        const res = await fetch("/api/teams");
        if (res.ok) {
          const data = await res.json();
          const primaryColor = data.primaryColor || "#1D4237";

          // CSS 변수 생성
          const cssVars = teamColorCssVars(primaryColor);

          // document.documentElement에 CSS 변수 주입
          Object.entries(cssVars).forEach(([key, value]) => {
            document.documentElement.style.setProperty(key, value);
          });
        }
      } catch (error) {
        console.error("팀 컬러 로드 실패:", error);
      }
    };

    loadTeamColor();
  }, [session?.user?.teamId]);

  return null;
}
