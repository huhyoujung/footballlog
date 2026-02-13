"use client";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";
import BasicInfoTab from "@/components/training/BasicInfoTab";
import LateFeeTab from "@/components/training/LateFeeTab";
import SessionTab from "@/components/training/SessionTab";
import EquipmentTab from "@/components/training/EquipmentTab";
import KebabMenu from "@/components/training/KebabMenu";
import Toast from "@/components/Toast";
import TrainingLogsSection from "@/components/training/TrainingLogsSection";
import CommentsSection from "@/components/training/CommentsSection";
import { Share2 } from "lucide-react";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { fetcher } from "@/lib/fetcher";
import useSWR from "swr";
import type { TrainingEventDetail } from "@/types/training-event";
import { useToast } from "@/lib/useToast";

type AdminTab = "info" | "latefee" | "session" | "equipment";

export default function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const [eventId, setEventId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<AdminTab>("info");
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    params.then((p) => setEventId(p.id));
  }, [params]);

  // URL 쿼리 파라미터에서 탭 설정
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "info" || tabParam === "latefee" || tabParam === "session" || tabParam === "equipment") {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // SWR로 event 데이터 페칭 - session 탭일 때만 sessions 포함
  const shouldIncludeSessions = activeTab === "session";
  const apiUrl = eventId
    ? `/api/training-events/${eventId}${shouldIncludeSessions ? "?includeSessions=true" : ""}`
    : null;

  const { data: event, isLoading, mutate } = useSWR<TrainingEventDetail>(
    apiUrl,
    fetcher,
    {
      revalidateOnFocus: false, // 캐시 사용 (속도 개선)
      revalidateIfStale: false,
      dedupingInterval: 60000, // 1분 캐시
      keepPreviousData: true,
    }
  );

  // 세션 탭으로 전환 시 데이터 갱신
  useEffect(() => {
    if (activeTab === "session" && eventId) {
      mutate();
    }
  }, [activeTab, eventId, mutate]);

  useEffect(() => {
    if (eventId) {
      window.scrollTo(0, 0);
    }
  }, [eventId]);

  // eventId가 없거나 초기 로딩일 때 스피너 표시
  if (!eventId || (isLoading && !event)) {
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

  const handleShare = async () => {
    if (!event) {
      showToast("운동 정보를 불러오는 중입니다...");
      return;
    }

    const url = `${window.location.origin}/training/${eventId}`;

    // 운동 정보 포맷팅
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

    console.log("=== 공유 디버그 ===");
    console.log("event 객체:", event);
    console.log("복사할 텍스트:");
    console.log(shareText);
    console.log("텍스트 길이:", shareText.length);
    console.log("=================");

    // 클립보드에 복사
    try {
      await navigator.clipboard.writeText(shareText);
      showToast("운동 정보가 복사되었습니다!");
      console.log("✅ 복사 성공!");
    } catch (error) {
      console.error("❌ 복사 실패:", error);
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
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="text-base font-semibold text-gray-900">{event?.title || "팀 운동"}</h1>
          {isAdmin ? (
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
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
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
        <div className="bg-white border-b border-gray-200 sticky top-[49px] z-10">
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
          <>
            <BasicInfoTab event={event} session={session} onRefresh={() => mutate()} />

            {/* 운동일지 섹션 */}
            <TrainingLogsSection eventId={eventId} eventTime={event.time} eventDate={event.date} />

            {/* 댓글 섹션 */}
            <CommentsSection eventId={eventId} />
          </>
        )}

        {/* Admin tabs */}
        {isAdmin && activeTab === "info" && (
          <>
            <BasicInfoTab event={event} session={session} onRefresh={() => mutate()} />

            {/* 운동일지 섹션 */}
            <TrainingLogsSection eventId={eventId} eventTime={event.time} eventDate={event.date} />

            {/* 댓글 섹션 */}
            <CommentsSection eventId={eventId} />
          </>
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

      {/* Toast */}
      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </div>
  );
}
