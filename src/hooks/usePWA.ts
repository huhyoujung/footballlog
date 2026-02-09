import { useEffect, useState, useCallback } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWA = () => {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  const injectManifest = useCallback(async ({
    name,
    shortName,
    faviconLocation,
    logoUrl,
    startUrl = "/",
    description = "",
    themeColor = "#967B5D",
    backgroundColor = "white",
    orientation = "portrait",
  }: {
    name: string;
    shortName: string;
    faviconLocation?: string;
    logoUrl?: string | null;
    startUrl?: string;
    description?: string;
    themeColor?: string;
    backgroundColor?: string;
    orientation?: "portrait" | "landscape";
  }) => {
    // 팀 로고가 있으면 팀 로고, 없으면 faviconLocation 사용
    const getIconUrl = (size: string) => {
      if (logoUrl) return logoUrl; // 팀 로고는 모든 사이즈에 동일 URL (브라우저가 리사이즈)
      if (faviconLocation) return `${faviconLocation}/${size}.png`;
      return `/icons/${size}.png`; // 기본값
    };

    // 팀 로고나 faviconLocation이 있을 때만 아이콘 포함
    const icons = (logoUrl || faviconLocation) ? [
      {
        src: getIconUrl("48x48"),
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: getIconUrl("180x180"),
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: getIconUrl("192x192"),
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: getIconUrl("512x512"),
        sizes: "512x512",
        type: "image/png",
      },
    ] : [];

    const manifest = {
      name,
      short_name: shortName,
      display: "standalone",
      icons,
      start_url: startUrl,
      description,
      background_color: backgroundColor,
      theme_color: themeColor,
      orientation: orientation,
    };

    // 기존 manifest link 찾기 또는 생성
    let link = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;

    // 기존 blob URL이 있으면 정리
    if (link) {
      const oldHref = link.getAttribute('href');
      if (oldHref?.startsWith('blob:')) {
        URL.revokeObjectURL(oldHref);
      }
    } else {
      // 없으면 새로 생성 (제거하지 않고 계속 재사용)
      link = document.createElement("link") as HTMLLinkElement;
      link.rel = "manifest";
      link.type = "application/json";
      document.head.appendChild(link);
    }

    // href만 업데이트
    const manifestBlob = new Blob([JSON.stringify(manifest)], {
      type: "application/json",
    });
    const manifestURL = URL.createObjectURL(manifestBlob);
    link.href = manifestURL;
  }, []);

  const injectFavicon = useCallback((logoUrl?: string | null, faviconLocation = "/") => {
    // 로고가 없으면 favicon을 주입하지 않음 (브라우저 기본값 사용)
    if (!logoUrl) return;

    // favicon 찾기 또는 생성
    let favicon = document.querySelector('link[rel="icon"]') as HTMLLinkElement | null;
    if (!favicon) {
      favicon = document.createElement("link") as HTMLLinkElement;
      favicon.rel = "icon";
      favicon.type = "image/png";
      favicon.setAttribute("sizes", "48x48");
      document.head.appendChild(favicon);
    }
    favicon.href = logoUrl;

    // MS 타일 이미지 찾기 또는 생성
    let msIcon = document.querySelector('meta[name="msapplication-TileImage"]') as HTMLMetaElement | null;
    if (!msIcon) {
      msIcon = document.createElement("meta") as HTMLMetaElement;
      msIcon.name = "msapplication-TileImage";
      document.head.appendChild(msIcon);
    }
    msIcon.content = logoUrl;

    // Apple 터치 아이콘 찾기 또는 생성
    let appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
    if (!appleIcon) {
      appleIcon = document.createElement("link") as HTMLLinkElement;
      appleIcon.rel = "apple-touch-icon";
      appleIcon.setAttribute("sizes", "180x180");
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = logoUrl;
  }, []);

  function _isInstalled(): boolean {
    // Standalone 모드로 실행 중인지 확인 (iOS Safari, Android Chrome)
    if (window.matchMedia("(display-mode: standalone)").matches) return true;

    // Navigator standalone 확인 (iOS Safari)
    if (
      "standalone" in window.navigator &&
      (window.navigator as any).standalone
    )
      return true;

    // Window.name 확인 (일부 브라우저)
    if (window.name === "standalone") return true;

    return false;
  }

  function canInstall(): boolean {
    return "serviceWorker" in navigator && "BeforeInstallPromptEvent" in window;
  }

  function handleBeforeInstallPrompt(e: BeforeInstallPromptEvent) {
    e.preventDefault();
    setDeferredPrompt(e);
  }

  useEffect(() => {
    setIsInstalled(_isInstalled());

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt as EventListener
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt as EventListener
      );
    };
  }, []);

  async function installApp(): Promise<boolean | null> {
    if (!canInstall()) throw new Error("PWA 설치 불가능한 환경");
    if (!deferredPrompt || isInstalled) return null;

    deferredPrompt.prompt();
    const result = await deferredPrompt.userChoice;
    if (result.outcome === "accepted") setIsInstalled(true);

    return result.outcome === "accepted";
  }

  return {
    isInstalled,
    installApp,
    canInstall,
    injectManifest,
    injectFavicon,
  };
};
