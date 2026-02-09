"use client";

import { SWRConfig } from "swr";
import { useState } from "react";

export default function SWRProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // SWR 캐시를 컴포넌트 상태로 관리하여 페이지 전환 시에도 유지
  const [cache] = useState(() => new Map());

  return (
    <SWRConfig
      value={{
        provider: () => cache, // 전역 캐시 공유
        dedupingInterval: 300000, // 5분 - 같은 요청 중복 방지
        focusThrottleInterval: 300000, // 5분 - 포커스 시 재검증 제한
        revalidateOnFocus: false, // 탭 전환 시 자동 새로고침 비활성화
        revalidateOnReconnect: false, // 재연결 시 새로고침 비활성화 (캐시 우선)
        revalidateIfStale: false, // stale 데이터도 그대로 사용
        errorRetryCount: 2, // 에러 시 2번까지 재시도
        errorRetryInterval: 1000, // 1초 간격으로 재시도
        shouldRetryOnError: true,
        keepPreviousData: true, // 새 데이터 로드 중에도 이전 데이터 유지
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
      }}
    >
      {children}
    </SWRConfig>
  );
}
