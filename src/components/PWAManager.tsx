"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { usePWA } from "@/hooks/usePWA";

export default function PWAManager() {
  const { data: session } = useSession();
  const { injectManifest, injectFavicon } = usePWA();
  const pathname = usePathname();
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);
  const previousPathRef = useRef<string | null>(null);

  // Service Worker 등록
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      const registerServiceWorker = async () => {
        try {
          // 새로 등록 (강제 재등록으로 확실하게)
          const registration = await navigator.serviceWorker.register("/custom-sw.js", {
            scope: "/",
            updateViaCache: "none", // 캐시 무시
          });

          console.log("[PWA] Service Worker registered:", registration);

          // 활성화 대기 함수
          const waitForActivation = (reg: ServiceWorkerRegistration) => {
            return new Promise<void>((resolve) => {
              if (reg.active) {
                console.log("[PWA] Service Worker already active");
                resolve();
                return;
              }

              const sw = reg.installing || reg.waiting;
              if (sw) {
                sw.addEventListener("statechange", function handler(e) {
                  const worker = e.target as ServiceWorker;
                  if (worker.state === "activated") {
                    console.log("[PWA] Service Worker activated");
                    resolve();
                    worker.removeEventListener("statechange", handler);
                  }
                });
              } else {
                resolve();
              }
            });
          };

          // 활성화될 때까지 확실히 대기
          await waitForActivation(registration);

          // 업데이트 확인
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            console.log("[PWA] New service worker found");

            newWorker?.addEventListener("statechange", () => {
              if (
                newWorker.state === "installed" &&
                navigator.serviceWorker.controller
              ) {
                console.log("[PWA] New version available - will update on next navigation");
                // 새 버전이 waiting 상태로 대기 중 - 저장
                waitingWorkerRef.current = newWorker;
              }
            });
          });

          // 이미 waiting 중인 워커가 있는지 확인
          if (registration.waiting) {
            console.log("[PWA] Found waiting service worker");
            waitingWorkerRef.current = registration.waiting;
          }
        } catch (error) {
          console.error("[PWA] Service Worker registration failed:", error);
        }
      };

      registerServiceWorker();
    }
  }, []);

  // 페이지 이동 감지 - 자동 업데이트
  useEffect(() => {
    // 첫 렌더링 시 pathname 저장
    if (previousPathRef.current === null) {
      previousPathRef.current = pathname;
      return;
    }

    // 페이지가 변경되었고, waiting worker가 있으면 업데이트
    if (previousPathRef.current !== pathname && waitingWorkerRef.current) {
      console.log("[PWA] Page navigation detected - applying update");

      // skipWaiting 메시지 전송
      waitingWorkerRef.current.postMessage({ type: "SKIP_WAITING" });

      // 새로고침
      window.location.reload();
    }

    previousPathRef.current = pathname;
  }, [pathname]);

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

      // 노드를 삭제하지 않고 재사용하므로 즉시 실행 가능
      injectManifest({
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.teamId]);

  return null;
}
