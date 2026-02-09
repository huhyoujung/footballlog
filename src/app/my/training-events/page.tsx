"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";

interface TrainingEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  isRegular: boolean;
  _count: {
    rsvps: number;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TrainingEventsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");

  const isAdmin = session?.user?.role === "ADMIN";

  // SWR로 데이터 페칭 (자동 캐싱)
  const { data: upcomingData, isLoading: upcomingLoading } = useSWR<{ events: TrainingEvent[] }>(
    session ? "/api/training-events?filter=upcoming" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 300000, // 5분 캐시
    }
  );

  const { data: pastData, isLoading: pastLoading } = useSWR<{ events: TrainingEvent[] }>(
    session ? "/api/training-events?filter=past" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 300000, // 5분 캐시
    }
  );

  const upcomingEvents = upcomingData?.events || [];
  const pastEvents = pastData?.events || [];
  const loading = upcomingLoading || pastLoading;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const events = tab === "upcoming" ? upcomingEvents : pastEvents;

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <BackButton href="/my" />
          <h1 className="text-lg font-semibold text-gray-900">팀 운동</h1>
          {isAdmin ? (
            <Link href="/training/create" className="text-team-500 text-sm font-medium">
              + 생성
            </Link>
          ) : (
            <div className="w-12" />
          )}
        </div>
      </header>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 flex">
          <button
            onClick={() => setTab("upcoming")}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "upcoming"
                ? "border-team-500 text-team-500"
                : "border-transparent text-gray-500"
            }`}
          >
            예정된 운동
          </button>
          <button
            onClick={() => setTab("past")}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === "past"
                ? "border-team-500 text-team-500"
                : "border-transparent text-gray-500"
            }`}
          >
            지난 운동
          </button>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4">
        {events.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">⚽</div>
            <p className="text-gray-500">
              {tab === "upcoming" ? "예정된 운동이 없습니다" : "지난 운동이 없습니다"}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/training/${event.id}`}
                className="block bg-white rounded-xl p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-gray-900">
                      {event.title}
                    </h3>
                    {event.isRegular && (
                      <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full">
                        정기
                      </span>
                    )}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                  <span>📅</span>
                  <span>{formatDate(event.date)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <span>📍</span>
                  <span>{event.location}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <span>응답 {event._count.rsvps}명</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
