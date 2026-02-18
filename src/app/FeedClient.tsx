// 피드 클라이언트 래퍼 - 서버에서 프리페치한 데이터를 SWR fallback으로 주입
"use client";

import { SWRConfig } from "swr";
import Feed from "@/components/Feed";

export default function FeedClient({ fallback }: { fallback: Record<string, unknown> }) {
  return (
    <SWRConfig value={{ fallback }}>
      <Feed />
    </SWRConfig>
  );
}
