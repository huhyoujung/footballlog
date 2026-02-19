// 팀 운동 상세 클라이언트 - 탭 UI 및 데이터 페칭
"use client";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";
import BasicInfoTab from "@/components/training/BasicInfoTab";
import KebabMenu from "@/components/training/KebabMenu";
import Toast from "@/components/Toast";
import TrainingLogsSection from "@/components/training/TrainingLogsSection";
import CommentsSection from "@/components/training/CommentsSection";
import { Share2 } from "lucide-react";

import { useState, useEffect, lazy, Suspense } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { fetcher } from "@/lib/fetcher";
import useSWR from "swr";
import type { TrainingEventDetail } from "@/types/training-event";
import { useToast } from "@/lib/useToast";

const LateFeeTab = lazy(() => import("@/components/training/LateFeeTab"));
const SessionTab = lazy(() => import("@/components/training/SessionTab"));
const EquipmentTab = lazy(() => import("@/components/training/EquipmentTab"));

type AdminTab = "info" | "latefee" | "session" | "equipment";

export default function TrainingDetailClient({ eventId }: { eventId: string }) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AdminTab>("info");
  const { toast, showToast, hideToast } = useToast();

  // URL 쿼리 파라미터에서 탭 설정
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "info" || tabParam === "latefee" || tabParam === "session" || tabParam === "equipment") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // SWR로 event 데이터 페칭 - sessions 항상 포함
  const apiUrl = `/api/training-events/${eventId}?includeSessions=true`;

  const { data: event, isLoading, mutate } = useSWR<TrainingEventDetail>(
    apiUrl,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000,
    }
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [eventId]);

  // loading.tsx와 동일한 스켈레톤 (이중 전환 방지)
  if (isLoading && !event) {
    return (
      <div className="min-h-screen bg-white pb-8">
        <PageHeader
          left={<div className="w-5 h-5 bg-gray-100 rounded animate-pulse" />}
          right={<div className="w-5 h-5 bg-gray-100 rounded animate-pulse" />}
          sticky={false}
        />
        <main className="max-w-2xl mx-auto p-4 space-y-3 animate-pulse">
          <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-200 rounded w-40" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-200 rounded w-28" />
            </div>
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-gray-100 rounded" />
              <div className="h-4 bg-gray-200 rounded w-20" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded-lg w-16" />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-12 bg-team-50 rounded-xl" />
            <div className="flex-1 h-12 bg-gray-50 rounded-xl" />
            <div className="flex-1 h-12 bg-gray-50 rounded-xl" />
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-20" />
            <div className="space-y-2">
              <div className="h-3.5 bg-gray-100 rounded w-full" />
              <div className="h-3.5 bg-gray-100 rounded w-2/3" />
            </div>
          </div>
          <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
            <div className="h-4 bg-gray-200 rounded w-16" />
            <div className="h-3.5 bg-gray-50 rounded w-40 mx-auto" />
          </div>
        </main>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">운동을 찾을 수 없습니다</p>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";

  const handleShare = async () => {
    if (!event) {
      showToast("운동 정보를 불러오는 중입니다...");
      return;
    }

    const url = `${window.location.origin}/training/${eventId}`;
    const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const shareText = [
      `[${event.title || "팀 운동"}]`,
      "",
      `📅 ${dateStr}`,
      `📍 ${event.location}`,
      event.uniform ? `👕 ${event.uniform}` : null,
      event.notes ? `📝 ${event.notes}` : null,
      "",
      url,
    ]
      .filter((line) => line !== null)
      .join("\n");

    try {
      await navigator.clipboard.writeText(shareText);
      showToast("운동 정보가 복사되었습니다!");
    } catch {
      showToast("복사에 실패했습니다");
    }
  };

  const tabs: { key: AdminTab; label: string }[] = [
    { key: "info", label: "기본 정보" },
    { key: "session", label: "세션" },
    { key: "latefee", label: "지각비" },
    { key: "equipment", label: "장비" },
  ];

  return (
    <div className="min-h-screen bg-white pb-8">
      <PageHeader
        title={event?.title || "팀 운동"}
        left={<BackButton href="/" />}
        right={isAdmin ? (
          <KebabMenu
            eventId={eventId}
            eventTitle={event.title}
            eventDate={event.date}
            eventLocation={event.location}
            eventUniform={event.uniform}
            eventNotes={event.notes}
            rsvpCount={event.rsvps.length}
            checkInCount={event.checkIns.length}
            lateFeeCount={event.lateFees?.length || 0}
            sessionCount={event.sessions.length}
          />
        ) : (
          <button
            onClick={handleShare}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-all active:scale-90 touch-manipulation"
          >
            <Share2 className="w-5 h-5 text-gray-600" />
          </button>
        )}
        className="!z-20"
      />

      {/* 탭 (관리자만 표시) */}
      {isAdmin && (
        <div className="bg-white border-b border-gray-200 sticky top-[41px] z-10">
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
        {!isAdmin && (
          <>
            <BasicInfoTab event={event} session={session} onRefresh={() => mutate()} />
            <TrainingLogsSection eventId={eventId} eventDate={event.date} />
            <CommentsSection eventId={eventId} />
          </>
        )}

        {isAdmin && activeTab === "info" && (
          <>
            <BasicInfoTab event={event} session={session} onRefresh={() => mutate()} />
            <TrainingLogsSection eventId={eventId} eventDate={event.date} />
            <CommentsSection eventId={eventId} />
          </>
        )}

        {isAdmin && activeTab === "session" && (
          <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500" /></div>}>
            <SessionTab
              eventId={eventId}
              sessions={event.sessions}
              rsvps={event.rsvps}
              onRefresh={() => mutate()}
            />
          </Suspense>
        )}

        {isAdmin && activeTab === "latefee" && (
          <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500" /></div>}>
            <LateFeeTab
              eventId={eventId}
              eventDate={event.date}
              rsvps={event.rsvps}
              checkIns={event.checkIns}
              lateFees={event.lateFees || []}
              onRefresh={() => mutate()}
            />
          </Suspense>
        )}

        {isAdmin && activeTab === "equipment" && (
          <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500" /></div>}>
            <EquipmentTab eventId={eventId} />
          </Suspense>
        )}
      </main>

      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </div>
  );
}
