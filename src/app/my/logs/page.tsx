"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import useSWR from "swr";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";
import PolaroidCard from "@/components/PolaroidCard";
import type { TrainingLog } from "@/types/training";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MyLogsPage() {
  const { data: session } = useSession();

  // SWR로 데이터 페칭 (자동 캐싱)
  const { data: logsData, isLoading } = useSWR<{ logs: TrainingLog[] }>(
    session?.user?.id ? `/api/training-logs?userId=${session.user.id}&limit=100` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false, // stale 데이터도 재검증하지 않음
      dedupingInterval: 300000, // 5분 캐시
    }
  );

  const logs = logsData?.logs || [];

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href="/my" />
          <h1 className="text-base font-semibold text-gray-900">내 운동 일지</h1>
          <div className="w-5" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto">
        {logs.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="text-6xl mb-4">📝</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              아직 작성한 일지가 없어요
            </h2>
            <p className="text-gray-500 mb-6">
              첫 운동 일지를 작성해보세요!
            </p>
            <Link
              href="/write"
              className="inline-block bg-team-500 text-white px-6 py-3 rounded-full font-medium hover:bg-team-600 transition-colors"
            >
              일지 작성하기
            </Link>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 px-4 py-8">
            {logs.map((log) => (
              <PolaroidCard key={log.id} log={log} variant="full" />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
