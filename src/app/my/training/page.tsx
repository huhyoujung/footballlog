"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TrainingEventItem {
  id: string;
  title: string;
  isRegular: boolean;
  date: string;
  location: string;
  _count: { rsvps: number };
}

export default function MyTrainingPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [trainingEvents, setTrainingEvents] = useState<TrainingEventItem[]>([]);

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") {
      router.push("/my");
      return;
    }
    fetchTrainingEvents();
  }, [session]);

  const fetchTrainingEvents = async () => {
    try {
      const res = await fetch("/api/training-events");
      if (res.ok) {
        const data = await res.json();
        setTrainingEvents(data.events || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500" />
      </div>
    );
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
          <h1 className="text-lg font-semibold text-gray-900">팀 운동 관리</h1>
          <Link
            href="/training/create"
            className="text-team-500 font-medium"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4">
        {trainingEvents.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-gray-400 mb-4">예정된 운동이 없습니다</p>
            <Link
              href="/training/create"
              className="inline-flex items-center gap-2 px-4 py-2 bg-team-500 text-white rounded-lg hover:bg-team-600 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14" />
                <path d="M5 12h14" />
              </svg>
              새 운동 만들기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {trainingEvents.map((ev) => {
              const d = new Date(ev.date);
              const dateStr = d.toLocaleDateString("ko-KR", {
                month: "numeric",
                day: "numeric",
                weekday: "short",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <Link
                  key={ev.id}
                  href={`/training/${ev.id}/manage`}
                  className="block bg-white rounded-xl p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base font-semibold text-gray-900 truncate">
                          {ev.title}
                        </span>
                        {ev.isRegular && (
                          <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full flex-shrink-0">
                            정기
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{dateStr}</span>
                        <span>·</span>
                        <span className="truncate">{ev.location}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-400">
                        {ev._count.rsvps}명 응답
                      </div>
                    </div>
                    <span className="text-gray-300 ml-3">&rsaquo;</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
