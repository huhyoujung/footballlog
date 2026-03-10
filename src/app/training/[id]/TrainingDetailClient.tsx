// 팀 운동 상세 클라이언트 - 탭 UI 및 데이터 페칭
"use client";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";
import BasicInfoTab from "@/components/training/BasicInfoTab";
import KebabMenu from "@/components/training/KebabMenu";
import MatchStatusBanner from "@/components/training/MatchStatusBanner";
import Toast from "@/components/Toast";
import TrainingLogsSection from "@/components/training/TrainingLogsSection";
import CommentsSection from "@/components/training/CommentsSection";
import { Share2 } from "lucide-react";
import { addJosa } from "@/utils/korean";

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
  const [showConvertSheet, setShowConvertSheet] = useState(false);
  const [converting, setConverting] = useState(false);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [sendingChallenge, setSendingChallenge] = useState(false);
  // 응답기한: 기본 30일 후
  const defaultDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const [responseDeadlineDate, setResponseDeadlineDate] = useState(defaultDeadline);
  const { toast, showToast, hideToast } = useToast();
  const [quarterCount, setQuarterCount] = useState(4);
  const [quarterMinutes, setQuarterMinutes] = useState(20);
  const [quarterBreak, setQuarterBreak] = useState(5);
  const [kickoffTime, setKickoffTime] = useState("");
  // 쿼터별 심판팀: "TEAM_A"=우리팀, "TEAM_B"=상대팀, 기본값 교대
  const [quarterRefereeTeams, setQuarterRefereeTeams] = useState<("TEAM_A" | "TEAM_B")[]>(
    Array.from({ length: 4 }, (_, i) => (i % 2 === 0 ? "TEAM_A" : "TEAM_B"))
  );

  // URL 쿼리 파라미터에서 탭 설정 + 체크인 토스트
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "info" || tabParam === "latefee" || tabParam === "session" || tabParam === "equipment") {
      setActiveTab(tabParam);
    }
    const checkinTime = searchParams.get("checkin");
    if (checkinTime) {
      showToast(`${checkinTime}에 체크인되었습니다 ✓`);
    }
  }, [searchParams, showToast]);

  // SWR로 event 데이터 페칭 - sessions 항상 포함
  const apiUrl = `/api/training-events/${eventId}?includeSessions=true`;

  const { data: event, isLoading, mutate } = useSWR<TrainingEventDetail>(
    apiUrl,
    fetcher,
    {
      // 앱 포커스 복귀 시 갱신 — 다른 팀원 체크인/RSVP 변경 즉시 반영
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [eventId]);

  // 친선경기 IN_PROGRESS 리다이렉트: 렌더 안에서 window.location 직접 호출하면
  // 히스토리 스택이 replace로 덮어씌워져 뒤로가기가 막히므로 useEffect로 처리
  useEffect(() => {
    if (!event) return;
    if (event.isFriendlyMatch && event.matchStatus === "IN_PROGRESS") {
      const challengeToken = event.challengeToken ?? event.linkedEvent?.challengeToken ?? null;
      if (challengeToken) {
        window.location.replace(`/invite/${challengeToken}`);
      } else {
        window.location.replace("/");
      }
    }
  }, [event]);

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
  const opponentColor = event.opponentTeam?.primaryColor ?? "#374151";

  // 친선경기 IN_PROGRESS: useEffect에서 리다이렉트 처리 (위 useEffect 참고)
  // 렌더 중에는 로딩 UI만 표시
  if (event.isFriendlyMatch && event.matchStatus === "IN_PROGRESS") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">경기 페이지로 이동 중...</p>
      </div>
    );
  }

  const handleShare = async () => {
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

  const handleSendChallenge = async () => {
    if (!event?.isFriendlyMatch) return;

    const myTeamName = session?.user?.team?.name || "우리팀";
    const opponentName = event.opponentTeamName || "상대팀";
    const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
    const refLines = quarterRefereeTeams.length > 0
      ? quarterRefereeTeams.map((t, i) => `  ${i + 1}쿼터: ${t === "TEAM_A" ? myTeamName : opponentName}`)
      : null;
    const buildText = (challengeUrl: string) => [
      `⚽ 도전장`,
      ``,
      `${addJosa(myTeamName, "이/가")} ${opponentName}에 도전합니다!`,
      ``,
      `📅 ${dateStr}`,
      `📍 ${event.location}`,
      kickoffTime ? `⏰ 킥오프: ${kickoffTime}` : null,
      `⏱ ${quarterCount}쿼터 × ${quarterMinutes}분, 쉬는시간 ${quarterBreak}분`,
      refLines ? `🟨 쿼터별 심판\n${refLines.join("\n")}` : null,
      ``,
      `아래 링크에서 확인하고 수락하세요:`,
      challengeUrl,
    ].filter(Boolean).join("\n");

    // CONFIRMED 상태: matchRules만 저장, 링크 복사 없음
    if (event.matchStatus === "CONFIRMED") {
      setSendingChallenge(true);
      setShowSendDialog(false);
      try {
        const res = await fetch("/api/challenge/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trainingEventId: eventId, quarterCount, quarterMinutes, quarterBreak, kickoffTime: kickoffTime || null, quarterRefereeTeams }),
        });
        if (res.ok) {
          showToast("경기 방식이 저장되었습니다.");
          mutate();
        } else {
          const data = await res.json();
          showToast(data.error || "저장에 실패했습니다");
        }
      } catch {
        showToast("저장에 실패했습니다");
      } finally {
        setSendingChallenge(false);
      }
      return;
    }

    // CHALLENGE_SENT 수정: 토큰이 이미 있으므로 즉시 복사+토스트, API는 백그라운드 업데이트
    if (event.matchStatus === "CHALLENGE_SENT" && event.challengeToken) {
      setShowSendDialog(false);
      const challengeUrl = `${window.location.origin}/invite/${event.challengeToken}`;
      showToast("도전장이 복사되었습니다! 상대팀에게 공유하세요.");
      navigator.clipboard.writeText(buildText(challengeUrl)).catch(() => {});
      // 백그라운드에서 matchRules 업데이트
      fetch("/api/challenge/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingEventId: eventId, responseDeadline: new Date(`${responseDeadlineDate}T23:59:59`).toISOString(), quarterCount, quarterMinutes, quarterBreak, kickoffTime: kickoffTime || null, quarterRefereeTeams }),
      }).then(() => mutate()).catch(() => {});
      return;
    }

    // DRAFT: API 호출 후 토큰 받아서 복사
    setSendingChallenge(true);
    setShowSendDialog(false);
    try {
      const responseDeadline = new Date(`${responseDeadlineDate}T23:59:59`).toISOString();
      const res = await fetch("/api/challenge/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trainingEventId: eventId, responseDeadline, quarterCount, quarterMinutes, quarterBreak, kickoffTime: kickoffTime || null, quarterRefereeTeams }),
      });
      const data = await res.json();

      if (res.ok) {
        showToast("도전장이 복사되었습니다! 상대팀에게 공유하세요.");
        navigator.clipboard.writeText(buildText(data.challengeUrl)).catch(() => {});
        mutate(); // 배너 상태 갱신 (DRAFT → CHALLENGE_SENT)
      } else {
        showToast(data.error || "도전장 생성에 실패했습니다");
      }
    } catch {
      showToast("도전장 생성에 실패했습니다");
    } finally {
      setSendingChallenge(false);
    }
  };

  // CHALLENGE_SENT 상태: 기존 토큰으로 즉시 복사 / DRAFT 상태: 다이얼로그 열기
  const handleCopyLink = async () => {
    if (event?.matchStatus === "CHALLENGE_SENT" && event?.challengeToken) {
      const baseUrl = window.location.origin;
      const challengeUrl = `${baseUrl}/invite/${event.challengeToken}`;
      const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
        month: "long",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      const myTeamName = session?.user?.team?.name || "우리팀";
      const opponentName = event.opponentTeamName || "상대팀";
      const mr = event.matchRules;
      const qCount = mr?.quarterCount ?? 4;
      const qMin = mr?.quarterMinutes ?? 20;
      const qBreak = mr?.quarterBreak ?? 5;
      const kickoff = mr?.kickoffTime;
      const refTeams = mr?.quarterRefereeTeams;
      const refereeLines = refTeams && refTeams.length > 0
        ? refTeams.map((t, i) => `  ${i + 1}쿼터: ${t === "TEAM_A" ? myTeamName : "상대팀"}`)
        : null;
      const challengeText = [
        `⚽ 도전장`,
        ``,
        `${addJosa(myTeamName, "이/가")} ${opponentName}에 도전합니다!`,
        ``,
        `📅 ${dateStr}`,
        `📍 ${event.location}`,
        kickoff ? `⏰ 킥오프: ${kickoff}` : null,
        `⏱ ${qCount}쿼터 × ${qMin}분, 쉬는시간 ${qBreak}분`,
        refereeLines ? `🟨 쿼터별 심판\n${refereeLines.join("\n")}` : null,
        ``,
        `아래 링크에서 확인하고 수락하세요:`,
        challengeUrl,
      ].filter(Boolean).join("\n");
      showToast("도전장이 복사되었습니다! 상대팀에게 공유하세요.");
      navigator.clipboard.writeText(challengeText).catch(() => {});
      return;
    }

    // DRAFT 상태: 다이얼로그 열기 (기존 matchRules 값으로 초기화)
    openSendDialog();
  };

  // 다이얼로그 열기 공통 로직 (DRAFT 초기 발송 / CHALLENGE_SENT 수정)
  const openSendDialog = () => {
    const initCount = event?.matchRules?.quarterCount ?? 4;
    if (event?.matchRules) {
      setQuarterCount(initCount);
      setQuarterMinutes(event.matchRules.quarterMinutes ?? 20);
      setQuarterBreak(event.matchRules.quarterBreak ?? 5);
      setKickoffTime(event.matchRules.kickoffTime ?? "");
      const existing = event.matchRules.quarterRefereeTeams;
      if (existing && existing.length > 0) {
        setQuarterRefereeTeams(
          Array.from({ length: initCount }, (_, i) => existing[i] ?? (i % 2 === 0 ? "TEAM_A" : "TEAM_B"))
        );
      } else {
        setQuarterRefereeTeams(Array.from({ length: initCount }, (_, i) => (i % 2 === 0 ? "TEAM_A" : "TEAM_B")));
      }
    } else {
      if (event?.date) setKickoffTime(new Date(event.date).toTimeString().slice(0, 5));
      setQuarterRefereeTeams(Array.from({ length: initCount }, (_, i) => (i % 2 === 0 ? "TEAM_A" : "TEAM_B")));
    }
    setShowSendDialog(true);
  };

  const handleEditChallenge = () => openSendDialog();

  const handleConvertToRegular = async () => {
    setConverting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFriendlyMatch: false }),
      });
      if (res.ok) {
        await mutate();
        setShowConvertSheet(false);
      } else {
        showToast("전환에 실패했습니다");
      }
    } catch {
      showToast("전환에 실패했습니다");
    } finally {
      setConverting(false);
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
        left={<BackButton />}
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
            isFriendlyMatch={event.isFriendlyMatch}
            onEditRules={event.isFriendlyMatch && event.matchStatus === "CONFIRMED" ? openSendDialog : undefined}
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

      {/* 친선경기 매치 상태 배너 (기본 정보 탭에서만 표시) */}
      {(!isAdmin || activeTab === "info") && <MatchStatusBanner
        event={event}
        isAdmin={isAdmin}
        onSendChallenge={() => {
          if (event?.date) setKickoffTime(new Date(event.date).toTimeString().slice(0, 5));
          setShowSendDialog(true);
        }}
        onCopyLink={handleCopyLink}
        onEditChallenge={handleEditChallenge}
        onEditRules={undefined}
        onConvertToRegular={isAdmin ? () => setShowConvertSheet(true) : undefined}
        onStartMatch={() => {
          if (event?.challengeToken) {
            window.location.href = `/invite/${event.challengeToken}`;
          } else {
            mutate();
          }
        }}
        mutate={() => mutate()}
      />}

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
              isFriendlyMatch={event.isFriendlyMatch}
              onSessionDelete={(sessionId) => {
                mutate(
                  (data) => data ? { ...data, sessions: data.sessions.filter((s) => s.id !== sessionId) } : data,
                  { revalidate: false }
                );
              }}
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

      {/* 도전장 발송 다이얼로그 */}
      {showSendDialog && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowSendDialog(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">
              {event.matchStatus === "CONFIRMED" ? "경기 방식 수정" : event.matchStatus === "CHALLENGE_SENT" ? "경기 방식 수정 후 재공유" : "도전장 보내기"}
            </h3>
            {/* 경기 방식 */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">경기 방식</label>
              <div className="space-y-3 bg-gray-50 rounded-xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">쿼터 수</span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => {
                      const next = Math.max(1, quarterCount - 1);
                      setQuarterCount(next);
                      setQuarterRefereeTeams(prev => Array.from({ length: next }, (_, i) => prev[i] ?? (i % 2 === 0 ? "TEAM_A" : "TEAM_B")));
                    }} className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium">−</button>
                    <span className="w-8 text-center text-sm font-semibold text-gray-900">{quarterCount}</span>
                    <button type="button" onClick={() => {
                      const next = Math.min(8, quarterCount + 1);
                      setQuarterCount(next);
                      setQuarterRefereeTeams(prev => Array.from({ length: next }, (_, i) => prev[i] ?? (i % 2 === 0 ? "TEAM_A" : "TEAM_B")));
                    }} className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium">+</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">쿼터별 시간</span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setQuarterMinutes(Math.max(1, quarterMinutes - 1))} className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium">−</button>
                    <span className="w-12 text-center text-sm font-semibold text-gray-900">{quarterMinutes}분</span>
                    <button type="button" onClick={() => setQuarterMinutes(Math.min(60, quarterMinutes + 1))} className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium">+</button>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">쿼터 사이 쉬는시간</span>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setQuarterBreak(Math.max(0, quarterBreak - 1))} className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium">−</button>
                    <span className="w-12 text-center text-sm font-semibold text-gray-900">{quarterBreak}분</span>
                    <button type="button" onClick={() => setQuarterBreak(Math.min(30, quarterBreak + 1))} className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium">+</button>
                  </div>
                </div>
                {/* 총 경기시간 요약 */}
                <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-xs text-gray-500">총 경기시간</span>
                  <span className="text-sm font-semibold text-team-600">
                    {quarterCount * quarterMinutes + quarterBreak * (quarterCount - 1)}분
                  </span>
                </div>
              </div>
            </div>
            {/* 쿼터별 심판팀 */}
            <div>
              <label className="block text-sm text-gray-600 mb-2">쿼터별 심판</label>
              <div className="grid gap-2">
                {Array.from({ length: quarterCount }, (_, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{i + 1}쿼터</span>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setQuarterRefereeTeams(prev => prev.map((t, j) => j === i ? "TEAM_A" : t))}
                        className={`px-3 py-1.5 transition-colors ${quarterRefereeTeams[i] === "TEAM_A" ? "bg-team-500 text-white" : "bg-white text-gray-500"}`}
                      >
                        우리팀
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuarterRefereeTeams(prev => prev.map((t, j) => j === i ? "TEAM_B" : t))}
                        className={`px-3 py-1.5 transition-colors ${quarterRefereeTeams[i] === "TEAM_B" ? "text-white" : "bg-white text-gray-500"}`}
                        style={quarterRefereeTeams[i] === "TEAM_B" ? { backgroundColor: opponentColor } : {}}
                      >
                        상대팀
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* 킥오프 시간 */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">킥오프 시간</label>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={kickoffTime}
                  onChange={(e) => setKickoffTime(e.target.value)}
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
                {kickoffTime && (
                  <div className="text-sm text-gray-500 shrink-0">
                    → 종료{" "}
                    <span className="font-semibold text-gray-900">
                      {(() => {
                        const [h, m] = kickoffTime.split(":").map(Number);
                        const totalMin = quarterCount * quarterMinutes + quarterBreak * (quarterCount - 1);
                        const endMin = h * 60 + m + totalMin;
                        return `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
                      })()}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {/* 응답 기한 — CONFIRMED 상태에서는 불필요 */}
            {event.matchStatus !== "CONFIRMED" && (
              <div>
                <label className="block text-sm text-gray-600 mb-1">응답 기한</label>
                <input
                  type="date"
                  value={responseDeadlineDate}
                  min={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setResponseDeadlineDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">이 날짜까지 상대팀이 응답하지 않으면 도전장이 만료됩니다</p>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowSendDialog(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleSendChallenge}
                disabled={sendingChallenge}
                className="flex-1 py-3 rounded-xl bg-team-500 text-white font-medium disabled:opacity-50"
              >
                {sendingChallenge ? "저장 중..." : event.matchStatus === "CONFIRMED" ? "저장" : event.matchStatus === "CHALLENGE_SENT" ? "수정 후 링크 복사" : "도전장 링크 복사"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 팀 운동 전환 바텀시트 */}
      {showConvertSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConvertSheet(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">팀 운동으로 전환하시겠습니까?</h3>
            <p className="text-sm text-gray-500">친선경기 설정이 해제되고 일반 팀 운동으로 변경됩니다.</p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowConvertSheet(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleConvertToRegular}
                disabled={converting}
                className="flex-1 py-3 rounded-xl bg-team-500 text-white font-medium disabled:opacity-50"
              >
                {converting ? "처리 중..." : "전환하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </div>
  );
}
