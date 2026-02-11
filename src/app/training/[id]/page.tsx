"use client";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";
import BasicInfoTab from "@/components/training/BasicInfoTab";
import LateFeeTab from "@/components/training/LateFeeTab";
import SessionTab from "@/components/training/SessionTab";
import EquipmentTab from "@/components/training/EquipmentTab";
import KebabMenu from "@/components/training/KebabMenu";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { fetcher } from "@/lib/fetcher";
import useSWR from "swr";
import type { TrainingEventDetail } from "@/types/training-event";

type AdminTab = "info" | "latefee" | "session" | "equipment";

export default function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession();
  const [eventId, setEventId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<AdminTab>("info");

  useEffect(() => {
    params.then((p) => setEventId(p.id));
  }, [params]);

  useEffect(() => {
    if (eventId) {
      window.scrollTo(0, 0);
    }
  }, [eventId]);

  // SWR로 event 데이터 페칭
  const { data: event, isLoading, mutate } = useSWR<TrainingEventDetail>(
    eventId ? `/api/training-events/${eventId}` : null,
    fetcher,
    {
      revalidateOnFocus: false, // 캐시 사용 (속도 개선)
      revalidateIfStale: false,
      dedupingInterval: 60000, // 1분 캐시
      keepPreviousData: true,
    }
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">운동을 찾을 수 없습니다</p>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "info", label: "기본 정보" },
    { key: "session", label: "세션" },
    { key: "latefee", label: "지각비" },
    { key: "equipment", label: "장비" },
  ];

  return (
    <div className="min-h-screen bg-white pb-8">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="text-base font-semibold text-gray-900">{event?.title || "팀 운동"}</h1>
          {isAdmin ? (
            <KebabMenu
              eventId={eventId}
              eventDate={event.date}
              eventLocation={event.location}
              rsvpCount={event.rsvps.length}
              checkInCount={event.checkIns.length}
              lateFeeCount={event.lateFees?.length || 0}
              sessionCount={event.sessions.length}
            />
          ) : (
            <div className="w-6" />
          )}
        </div>
      </header>

      {/* 체크인 완료 배너 */}
      {event.myCheckIn && (
        <div className="bg-emerald-50 border-b border-emerald-200">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="text-emerald-600"
                >
                  <path
                    d="M20 6L9 17L4 12"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-900">체크인 완료</p>
                <p className="text-xs text-emerald-700">
                  {new Date(event.myCheckIn).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  도착
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 탭 (관리자만 표시) */}
      {isAdmin && (
        <div className="bg-white border-b border-gray-200 sticky top-[46px] z-10">
          <div className="max-w-2xl mx-auto flex">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
                  activeTab === tab.key
                    ? "text-team-600 border-b-2 border-team-500"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto p-4 space-y-3">
        {/* Regular users see only basic info */}
        {!isAdmin && (
          <BasicInfoTab event={event} session={session} onRefresh={() => mutate()} />
        )}

        {/* Admin tabs */}
        {isAdmin && activeTab === "info" && (
          <BasicInfoTab event={event} session={session} onRefresh={() => mutate()} />
        )}

        {isAdmin && activeTab === "session" && (
          <SessionTab
            eventId={eventId}
            sessions={event.sessions}
            rsvps={event.rsvps}
            onRefresh={() => mutate()}
          />
        )}

        {isAdmin && activeTab === "latefee" && (
          <LateFeeTab
            eventId={eventId}
            eventDate={event.date}
            rsvps={event.rsvps}
            checkIns={event.checkIns}
            lateFees={event.lateFees || []}
            onRefresh={() => mutate()}
          />
        )}

        {isAdmin && activeTab === "equipment" && (
          <EquipmentTab eventId={eventId} />
        )}
      </main>
    </div>
  );
}
