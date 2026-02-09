"use client";

import { SWRConfig } from "swr";

export default function SWRProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 2000, // 2초 내 중복 요청 방지
        revalidateOnFocus: false, // 탭 전환 시 자동 새로고침 비활성화
        revalidateOnReconnect: true, // 재연결 시에만 새로고침
        errorRetryCount: 3, // 에러 시 3번까지 재시도
        shouldRetryOnError: true,
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
      }}
    >
      {children}
    </SWRConfig>
  );
}
