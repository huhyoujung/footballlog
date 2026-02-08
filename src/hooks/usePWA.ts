import { useEffect, useState } from "react";

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

  async function injectManifest({
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
  }) {
    // 팀 로고가 있으면 팀 로고, 없으면 faviconLocation 사용
    const getIconUrl = (size: string) => {
      if (logoUrl) return logoUrl; // 팀 로고는 모든 사이즈에 동일 URL (브라우저가 리사이즈)
      if (faviconLocation) return `${faviconLocation}/${size}.png`;
      return `/icons/${size}.png`; // 기본값
    };

    const manifest = {
      name,
      short_name: shortName,
      display: "standalone",
      icons: [
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
      ],
      start_url: startUrl,
      description,
      background_color: backgroundColor,
      theme_color: themeColor,
      orientation: orientation,
    };

    const oldLink = document.querySelector('link[rel="manifest"]');
    if (oldLink) oldLink.remove();
    const manifestBlob = new Blob([JSON.stringify(manifest)], {
      type: "application/json",
    });
    const manifestURL = URL.createObjectURL(manifestBlob);
    const link = document.createElement("link");
    link.rel = "manifest";
    link.type = "application/json";
    link.href = manifestURL;
    document.head.appendChild(link);
  }

  function injectFavicon(logoUrl?: string | null, faviconLocation = "/") {
    const getFaviconUrl = (size: string) => {
      if (logoUrl) return logoUrl;
      if (faviconLocation) return `${faviconLocation}/${size}.png`;
      return `/icons/${size}.png`;
    };

    const oldFavicon = document.querySelector('link[rel="icon"]');
    if (oldFavicon) oldFavicon.remove();
    const favicon = document.createElement("link");
    favicon.rel = "icon";
    favicon.type = "image/png";
    favicon.setAttribute("sizes", "48x48");
    favicon.href = getFaviconUrl("48x48");

    const oldMsIcon = document.querySelector('meta[name="msapplication-TileImage"]');
    if (oldMsIcon) oldMsIcon.remove();
    const msIcon = document.createElement("meta");
    msIcon.name = "msapplication-TileImage";
    msIcon.content = getFaviconUrl("192x192");

    const oldAppleIcon = document.querySelector('link[rel="apple-touch-icon"]');
    if (oldAppleIcon) oldAppleIcon.remove();
    const appleIcon = document.createElement("link");
    appleIcon.rel = "apple-touch-icon";
    appleIcon.setAttribute("sizes", "180x180");
    appleIcon.href = getFaviconUrl("180x180");

    document.head.appendChild(favicon);
    document.head.appendChild(msIcon);
    document.head.appendChild(appleIcon);
  }

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
