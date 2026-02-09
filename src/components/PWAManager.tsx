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
      const registerServiceWorker = async () => {
        try {
          // 기존 등록 확인
          const existingRegistration = await navigator.serviceWorker.getRegistration();

          // 이미 등록된 SW가 있고 활성화되어 있으면 스킵
          if (existingRegistration?.active) {
            console.log("[PWA] Service Worker already registered and active");
            return;
          }

          // 새로 등록
          const registration = await navigator.serviceWorker.register("/custom-sw.js", {
            scope: "/",
            updateViaCache: "none", // 캐시 무시
          });

          console.log("[PWA] Service Worker registered:", registration);

          // 활성화될 때까지 대기
          if (registration.installing) {
            await new Promise<void>((resolve) => {
              registration.installing!.addEventListener("statechange", function handler(e) {
                const sw = e.target as ServiceWorker;
                if (sw.state === "activated") {
                  console.log("[PWA] Service Worker activated");
                  resolve();
                  sw.removeEventListener("statechange", handler);
                }
              });
            });
          }

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
        } catch (error) {
          console.error("[PWA] Service Worker registration failed:", error);
        }
      };

      registerServiceWorker();
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
