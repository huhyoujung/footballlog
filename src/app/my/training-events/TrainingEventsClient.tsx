// 팀 운동 목록 클라이언트 - 예정/지난 운동 타임라인 + 앵커
"use client";

import { useRef, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";

interface TrainingEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  isRegular: boolean;
  isFriendlyMatch: boolean;
  cancelled: boolean;
  opponentTeamName: string | null;
  _count: {
    rsvps: number;
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TrainingEventsClient({
  initialUpcoming,
  initialPast,
  isAdmin,
}: {
  initialUpcoming: TrainingEvent[];
  initialPast: TrainingEvent[];
  isAdmin: boolean;
}) {
  const nextEventRef = useRef<HTMLDivElement>(null);

  const { data: upcomingData, isLoading: upcomingLoading } = useSWR<{ events: TrainingEvent[] }>(
    "/api/training-events?filter=upcoming",
    fetcher,
    { fallbackData: { events: initialUpcoming }, revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 300000 }
  );

  const { data: pastData, isLoading: pastLoading } = useSWR<{ events: TrainingEvent[] }>(
    "/api/training-events?filter=past",
    fetcher,
    { fallbackData: { events: initialPast }, revalidateOnFocus: false, revalidateIfStale: false, dedupingInterval: 300000 }
  );

  const upcomingEvents = upcomingData?.events || [];
  const pastEvents = pastData?.events || [];
  const loading = upcomingLoading && pastLoading;

  // 가장 가까운 예정 운동으로 스크롤
  useEffect(() => {
    if (upcomingEvents.length > 0 && nextEventRef.current) {
      nextEventRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [upcomingEvents.length]);

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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500" />
      </div>
    );
  }

  const hasUpcoming = upcomingEvents.length > 0;
  const hasPast = pastEvents.length > 0;
  const isEmpty = !hasUpcoming && !hasPast && !upcomingLoading && !pastLoading;

  return (
    <div className="min-h-screen bg-white">
      <PageHeader
        title="팀 운동"
        left={<BackButton />}
        right={isAdmin ? (
          <Link href="/training/create" className="min-w-[44px] h-10 flex items-center justify-center text-team-500 active:text-team-700 transition-colors touch-manipulation">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
        ) : undefined}
      />

      <main className="max-w-2xl mx-auto p-4">
        {isEmpty ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-3">⚽</div>
            <p className="text-gray-500">등록된 운동이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* 예정된 운동 */}
            {hasUpcoming && (
              <>
                <p className="text-xs font-medium text-team-500 px-1">예정된 운동</p>
                {upcomingEvents.map((event, index) => (
                  <div key={event.id} ref={index === 0 ? nextEventRef : undefined}>
                    <EventCard event={event} formatDate={formatDate} past={false} isNext={index === 0} />
                  </div>
                ))}
              </>
            )}

            {/* 지난 운동 */}
            {hasPast && (
              <>
                <p className={`text-xs font-medium text-gray-400 px-1 ${hasUpcoming ? "pt-4" : ""}`}>
                  지난 운동
                </p>
                {pastEvents.map((event) => (
                  <EventCard key={event.id} event={event} formatDate={formatDate} past={true} isNext={false} />
                ))}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function EventCard({
  event,
  formatDate,
  past,
  isNext,
}: {
  event: TrainingEvent;
  formatDate: (d: string) => string;
  past: boolean;
  isNext: boolean;
}) {
  return (
    <Link
      href={`/training/${event.id}`}
      className={`block rounded-xl p-4 transition-colors ${
        event.cancelled
          ? "opacity-50 line-through"
          : past
            ? "opacity-60 hover:opacity-80"
            : isNext
              ? "bg-team-50 border border-team-200 hover:bg-team-100"
              : "hover:bg-gray-50"
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className={`text-base font-semibold ${event.cancelled ? "text-gray-400" : "text-gray-900"}`}>
            {event.title}
          </h3>
          {isNext && !event.cancelled && (
            <span className="px-2 py-0.5 bg-team-500 text-white text-[10px] font-bold rounded-full">
              다음
            </span>
          )}
          {event.isRegular && (
            <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full">
              정기
            </span>
          )}
          {event.isFriendlyMatch && (
            <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full">
              친선
            </span>
          )}
          {event.cancelled && (
            <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[10px] font-medium rounded-full">
              취소됨
            </span>
          )}
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-1">
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
        {event.isFriendlyMatch && event.opponentTeamName && (
          <span className="ml-2 text-team-500">vs {event.opponentTeamName}</span>
        )}
      </div>
    </Link>
  );
}
