"use client";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";
import BasicInfoTab from "@/components/training/BasicInfoTab";
import AttendanceTab from "@/components/training/AttendanceTab";
import LateFeeTab from "@/components/training/LateFeeTab";
import SessionTab from "@/components/training/SessionTab";
import EquipmentTab from "@/components/training/EquipmentTab";
import KebabMenu from "@/components/training/KebabMenu";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import type { TrainingEventDetail } from "@/types/training-event";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type AdminTab = "info" | "attendance" | "latefee" | "session" | "equipment";

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
    eventId ? `/api/training-events/${eventId}${session?.user?.role === "ADMIN" ? "?includeManagement=true" : ""}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 120000, // 2분 캐시
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
    { key: "attendance", label: "출석" },
    { key: "latefee", label: "지각비" },
    { key: "session", label: "세션" },
    { key: "equipment", label: "장비" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="text-lg font-semibold text-gray-900">{event?.title || "팀 운동"}</h1>
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

      {/* 탭 (관리자만 표시) */}
      {isAdmin && (
        <div className="bg-white border-b border-gray-200 sticky top-[57px] z-10">
          <div className="max-w-lg mx-auto flex">
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

      <main className="max-w-lg mx-auto p-4 space-y-3">
        {/* Regular users see only basic info */}
        {!isAdmin && (
          <BasicInfoTab event={event} session={session} onRefresh={() => mutate()} />
        )}

        {/* Admin tabs */}
        {isAdmin && activeTab === "info" && (
          <BasicInfoTab event={event} session={session} onRefresh={() => mutate()} />
        )}

        {isAdmin && activeTab === "attendance" && (
          <AttendanceTab rsvps={event.rsvps} checkIns={event.checkIns} />
        )}

        {isAdmin && activeTab === "latefee" && (
          <LateFeeTab
            eventId={eventId}
            rsvps={event.rsvps}
            checkIns={event.checkIns}
            lateFees={event.lateFees || []}
            onRefresh={() => mutate()}
          />
        )}

        {isAdmin && activeTab === "session" && (
          <SessionTab
            eventId={eventId}
            sessions={event.sessions}
            rsvps={event.rsvps}
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
