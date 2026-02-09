"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { usePWA } from "@/hooks/usePWA";

export default function PWAManager() {
  const { data: session } = useSession();
  const { injectManifest, injectFavicon } = usePWA();

  // Service Worker 등록
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register("/custom-sw.js", { scope: "/" })
        .then((registration) => {
          console.log("[PWA] Service Worker registered:", registration);

          // 업데이트 확인
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            console.log("[PWA] New service worker found");

            newWorker?.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log("[PWA] New version available");
              }
            });
          });
        })
        .catch((error) => {
          console.error("[PWA] Service Worker registration failed:", error);
        });
    }
  }, []);

  useEffect(() => {
    const setupPWA = async () => {
      // 팀 정보 fetch
      let teamName = "네모의 꿈";
      let teamLogo: string | null = null;
      let themeColor = "#967B5D";

      if (session?.user?.teamId) {
        try {
          const res = await fetch("/api/teams");
          if (res.ok) {
            const data = await res.json();
            teamName = `${data.name}의 락커룸`;
            teamLogo = data.logoUrl;
            themeColor = data.primaryColor || "#967B5D";
          }
        } catch {
          // 실패 시 기본값 사용
        }
      }

      const currentUrl = new URL(window.location.href);
      const searchParams = new URLSearchParams(window.location.search);
      const startUrl = `${currentUrl.origin}/?${searchParams.toString()}`;

      await injectManifest({
        name: teamName,
        shortName: teamName,
        logoUrl: teamLogo,
        startUrl,
        description: "축구 팀 훈련 일지 공유 서비스",
        themeColor,
        backgroundColor: "white",
      });

      injectFavicon(teamLogo);
    };

    setupPWA();
  }, [session?.user?.teamId, injectManifest, injectFavicon]);

  return null;
}
