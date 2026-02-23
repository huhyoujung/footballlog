"use client";

import { SWRConfig } from "swr";

const CACHE_KEY = "라커룸-swr";

// localStorage에서 SWR 캐시를 복원하고, 앱 종료/전환 시 저장
// → PWA 재실행해도 이전 캐시 즉시 사용 가능 (로딩 스켈레톤 제거)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function localStorageProvider(): Map<string, any> {
  if (typeof window === "undefined") return new Map();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = new Map<string, any>();
  try {
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (JSON.parse(saved) as [string, any][]).forEach(([k, v]) => map.set(k, v));
    }
  } catch {
    // 파싱 실패 시 빈 캐시로 시작
  }

  const save = () => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify([...map.entries()]));
    } catch {
      // localStorage 용량 초과 시 오래된 캐시 제거
      try { localStorage.removeItem(CACHE_KEY); } catch {}
    }
  };

  // 앱 종료 또는 백그라운드 전환 시 캐시 저장
  window.addEventListener("beforeunload", save);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") save();
  });

  return map;
}

export default function SWRProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRConfig
      value={{
        provider: localStorageProvider,
        dedupingInterval: 300000,      // 5분 — 같은 요청 중복 방지
        focusThrottleInterval: 300000, // 5분 — 포커스 시 재검증 제한
        revalidateOnFocus: false,      // 탭 전환 시 자동 새로고침 비활성화
        revalidateOnReconnect: false,  // 재연결 시 새로고침 비활성화
        // revalidateIfStale: true (기본값) — stale 캐시면 백그라운드에서 갱신
        errorRetryCount: 2,
        errorRetryInterval: 1000,
        shouldRetryOnError: true,
        keepPreviousData: true,
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
      }}
    >
      {children}
    </SWRConfig>
  );
}
