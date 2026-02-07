"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import PolaroidCard from "@/components/PolaroidCard";
import type { TrainingLog } from "@/types/training";

export default function MyLogsPage() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.id) {
      fetchLogs();
    }
  }, [session]);

  const fetchLogs = async () => {
    try {
      const res = await fetch(`/api/training-logs?userId=${session?.user?.id}&limit=100`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs);
      }
    } catch (error) {
      console.error("일지 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/my" className="text-gray-500 hover:text-gray-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">내 운동 일지</h1>
          <div className="w-5" />
        </div>
      </header>

      <main className="max-w-lg mx-auto">
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
