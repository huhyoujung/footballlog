"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import PolaroidDateGroup from "./PolaroidDateGroup";
import TickerBanner from "./TickerBanner";
import TrainingInviteCard from "./TrainingInviteCard";
import TrainingCheckInCard from "./TrainingCheckInCard";
import Toast from "./Toast";
import LoadingSpinner from "./LoadingSpinner";
import { usePushSubscription } from "@/lib/usePushSubscription";
import { useToast } from "@/lib/useToast";
import { useTeam } from "@/contexts/TeamContext";
import { timeAgo } from "@/lib/timeAgo";
import { isCheckInPeriod } from "@/lib/timeUntil";
import { fetcher } from "@/lib/fetcher";
import type { TrainingLog, TeamMember, GroupedLogs } from "@/types/training";
import type { TrainingEventSummary } from "@/types/training-event";
import { getAirQualityGrade } from "@/lib/weather";

interface Nudge {
  id: string;
  sender: { id: string; name: string | null };
  recipient: { id: string; name: string | null };
  createdAt: string;
}

interface RecentMvp {
  user: {
    id: string;
    name: string | null;
    image: string | null;
    position: string | null;
    number: number | null;
  };
  voteCount: number;
  eventDate: string;
  eventTitle: string | null;
  isToday: boolean;
  isYesterday: boolean;
}

interface LockerNote {
  id: string;
  content: string;
  color: string;
  rotation: number;
  positionX: number;
  positionY: number;
  tags: string[];
  createdAt: string;
  isAnonymous: boolean;
  recipient: {
    id: string;
    name: string | null;
  };
  author: {
    id: string;
    name: string | null;
  };
  trainingLog?: {
    trainingDate: string;
  } | null;
  trainingEvent?: {
    date: string;
  } | null;
}

// SWR 설정 (컴포넌트 밖으로 이동 — 매 렌더마다 재생성 방지)
const swrConfig = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  dedupingInterval: 120000, // 2분 캐시 (피드는 실시간성이 중요)
  keepPreviousData: true,
};

// 로컬 timezone 기준 날짜 문자열 생성 (순수함수, 컴포넌트 밖)
const getLocalDateString = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 쪽지의 날짜 추출 (순수함수, 컴포넌트 밖)
const getNoteDateString = (note: LockerNote): string => {
  if (note.trainingLog?.trainingDate) {
    return getLocalDateString(new Date(note.trainingLog.trainingDate));
  } else if (note.trainingEvent?.date) {
    return getLocalDateString(new Date(note.trainingEvent.date));
  }
  return getLocalDateString(new Date(note.createdAt));
};

export default function Feed() {
  const router = useRouter();
  const { data: session } = useSession();
  const { teamData, loading: teamLoading } = useTeam();
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const { isSupported, isSubscribed, subscribe } = usePushSubscription();
  const { toast, showToast, hideToast } = useToast();

  const isAdmin = session?.user?.role === "ADMIN";
  const teamMembers: TeamMember[] = teamData?.members || [];
  const teamLogoUrl = teamData?.logoUrl || null;

  // SWR로 데이터 페칭 - 최신 20개만 먼저 로드 (속도 개선)
  const { data: logsData, mutate: mutateLogs } = useSWR<{ logs: TrainingLog[] }>(
    "/api/training-logs?limit=20",
    fetcher,
    swrConfig
  );

  const { data: nudgesData } = useSWR<{ nudges: Nudge[] }>(
    "/api/nudges",
    fetcher,
    swrConfig
  );

  const { data: eventsData, mutate: mutateEvents } = useSWR<{ events: TrainingEventSummary[] }>(
    "/api/training-events/next",
    fetcher,
    swrConfig
  );

  const { data: mvpData } = useSWR<{ mvp: RecentMvp | null }>(
    "/api/pom/recent-mvp",
    fetcher,
    swrConfig
  );

  const { data: recentNotesData } = useSWR<LockerNote[]>(
    "/api/locker-notes",
    fetcher,
    swrConfig
  );

  const logs = logsData?.logs || [];
  const nudges = nudgesData?.nudges || [];
  const nextEvents = eventsData?.events || [];
  const recentMvp = mvpData?.mvp || null;
  const recentNotes = recentNotesData || [];

  // 로그인 후 알림 구독 요청
  useEffect(() => {
    if (session && isSupported && !isSubscribed) {
      subscribe();
    }
  }, [session, isSupported, isSubscribed, subscribe]);

  const fetchData = useCallback(async () => {
    await Promise.all([mutateLogs(), mutateEvents()]);
  }, [mutateLogs, mutateEvents]);

  const handleExpand = useCallback((date: string, logs: TrainingLog[]) => {
    if (logs.length === 1) {
      router.push(`/log/${logs[0].id}`);
      return;
    }
    setExpandedDate(date);
  }, [router]);

  const handleCollapse = useCallback(() => {
    setExpandedDate(null);
  }, []);

  const handleLikeToggle = useCallback(async (logId: string) => {
    const target = logs.find((l) => l.id === logId);
    if (!target) return;

    const wasLiked = target.isLiked;
    const prevCount = target._count.likes;

    mutateLogs(
      (current) => {
        if (!current) return current;
        return {
          ...current,
          logs: current.logs.map((log) =>
            log.id === logId
              ? {
                  ...log,
                  isLiked: !wasLiked,
                  _count: { ...log._count, likes: wasLiked ? prevCount - 1 : prevCount + 1 },
                }
              : log
          ),
        };
      },
      false
    );

    try {
      const res = await fetch(`/api/training-logs/${logId}/likes`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        mutateLogs(
          (current) => {
            if (!current) return current;
            return {
              ...current,
              logs: current.logs.map((log) =>
                log.id === logId
                  ? {
                      ...log,
                      isLiked: data.liked,
                      _count: { ...log._count, likes: data.likeCount },
                    }
                  : log
              ),
            };
          },
          false
        );
        showToast(data.liked ? "좋아요를 눌렀어요" : "좋아요를 취소했어요");
      } else {
        mutateLogs();
      }
    } catch (error) {
      console.error("좋아요 실패:", error);
      mutateLogs();
    }
  }, [logs, mutateLogs, showToast]);

  // 쪽지를 날짜별로 미리 그룹핑 (O(n) 1회만)
  const notesByDate = useMemo(() => {
    const map: Record<string, LockerNote[]> = {};
    for (const note of recentNotes) {
      const date = getNoteDateString(note);
      if (!map[date]) map[date] = [];
      map[date].push(note);
    }
    return map;
  }, [recentNotes]);

  // 날짜별 그룹핑 (쪽지만 있는 날짜도 포함)
  const groupedLogs = useMemo((): GroupedLogs[] => {
    const today = getLocalDateString(new Date());
    const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

    const grouped: Record<string, TrainingLog[]> = {};
    for (const log of logs) {
      const date = getLocalDateString(new Date(log.trainingDate));
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(log);
    }

    // 쪽지만 있는 날짜도 그룹에 추가
    for (const date of Object.keys(notesByDate)) {
      if (!grouped[date]) grouped[date] = [];
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dateLogs]) => {
        const sortedLogs = [...dateLogs].sort((a, b) => {
          if (date === today) {
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          } else {
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          }
        });

        return {
          date,
          displayDate:
            date === today
              ? "오늘"
              : date === yesterday
                ? "어제"
                : new Date(date).toLocaleDateString("ko-KR", {
                    month: "long",
                    day: "numeric",
                  }),
          logs: sortedLogs,
        };
      });
  }, [logs, notesByDate]);

  // 전광판 메시지
  const tickerMessages = useMemo(() => {
    const messages: { key: string; text: string; url?: string }[] = [];

    // 팀 운동 (최우선)
    for (const event of nextEvents) {
      const d = new Date(event.date);
      const dateStr = d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
      const timeStr = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

      let weatherIcon = "";
      if (event.weather) {
        if (event.weather === "Clear") weatherIcon = "☀️";
        else if (event.weather === "Clouds") weatherIcon = "☁️";
        else if (event.weather === "Rain") weatherIcon = "🌧️";
        else if (event.weather === "Snow") weatherIcon = "❄️";
      }

      let weatherInfo = "";
      if (event.weather && event.temperature !== null) {
        weatherInfo = ` · ${weatherIcon} ${event.temperature}°C`;
      }

      if (event.airQualityIndex !== null) {
        const aqGrade = getAirQualityGrade(event.airQualityIndex);
        weatherInfo += ` · 대기질 ${aqGrade.emoji}`;
      }

      messages.push({
        key: `event-${event.id}`,
        text: `📢 ${event.title || "팀 운동"} · ${dateStr} ${timeStr} · ${event.location}${weatherInfo}`,
        url: `/training/${event.id}`,
      });
    }

    // MVP 메시지 (24시간 이내)
    if (recentMvp) {
      const mvpName = recentMvp.user.name || "팀원";
      const whenText = recentMvp.isToday ? "오늘" : recentMvp.isYesterday ? "어제" : "최근";
      messages.push({
        key: "mvp",
        text: `🏆 ${mvpName}님이 ${whenText} MVP였습니다!`,
      });
    }

    // 오늘 1등 메시지
    const today = getLocalDateString(new Date());
    const todayLogs = logs.filter(log => getLocalDateString(new Date(log.trainingDate)) === today);
    if (todayLogs.length === 1) {
      const firstLog = todayLogs[0];
      const timeStr = new Date(firstLog.createdAt).toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false
      });
      messages.push({
        key: "first-today",
        text: `🏆 ${firstLog.user.name || "팀원"}님이 오늘 첫 주자! · ${timeStr}`,
        url: `/log/${firstLog.id}`,
      });
    }

    // 닦달 메시지
    for (const nudge of nudges) {
      const sender = nudge.sender.name || "팀원";
      const recipient = nudge.recipient.name || "팀원";
      messages.push({
        key: `nudge-${nudge.id}`,
        text: `👉 ${sender}님이 ${recipient}님을 닦달했습니다 · ${timeAgo(nudge.createdAt)}`,
      });
    }

    // 쪽지 메시지
    for (const note of recentNotes) {
      const recipientName = note.recipient.name || "팀원";
      messages.push({
        key: `note-${note.id}`,
        text: `👀 누군가가 ${recipientName}님의 락커에 쪽지를 꼽아놓고 도망갔습니다`,
        url: `/locker/${note.recipient.id}`,
      });
    }

    // 활동 메시지
    const activeCount = new Set(
      logs
        .filter(log => getLocalDateString(new Date(log.trainingDate)) === today)
        .map(log => log.user.id)
    ).size;
    const total = teamMembers.length;
    if (activeCount === 0) {
      messages.push({ key: "activity", text: "라커룸이 조용하네요 오늘의 첫 기록을 남겨보세요!" });
    } else if (activeCount >= total && total > 0) {
      messages.push({ key: "activity", text: `전원 출석! ${activeCount}명 운동 완료 🎉` });
    } else {
      messages.push({ key: "activity", text: `오늘 ${activeCount}명 운동 완료! 🔥` });
    }

    return messages;
  }, [nextEvents, recentMvp, logs, nudges, recentNotes, teamMembers.length]);

  // 미투표 초대장 목록
  const pendingInvites = useMemo(() =>
    nextEvents.filter(
      (event) => !event.myRsvp && new Date() < new Date(event.rsvpDeadline)
    ),
    [nextEvents]
  );

  // 체크인 대기 목록
  const checkInEvents = useMemo(() =>
    nextEvents.filter(
      (event) =>
        (event.myRsvp === "ATTEND" || event.myRsvp === "LATE") &&
        !event.myCheckIn &&
        isCheckInPeriod(event.date)
    ),
    [nextEvents]
  );

  const isLoading = !logsData || teamLoading;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center justify-between">
          {teamLogoUrl ? (
            <Image src={teamLogoUrl} alt="팀 로고" width={32} height={32} className="w-8 h-8 object-cover rounded-full" priority unoptimized />
          ) : (
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="16" r="15" fill="#967B5D" />
              <circle cx="16" cy="16" r="7" fill="none" stroke="#F5F0EB" strokeWidth="1.5" />
              <path d="M16 9 L16 23 M9 16 L23 16" stroke="#F5F0EB" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="16" cy="16" r="2.5" fill="#F5F0EB" />
            </svg>
          )}
          <Link href="/my" className="text-team-500 hover:text-team-600 transition-colors">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </Link>
        </div>
      </header>

      {/* 전광판 */}
      {!isLoading && (
        <div className="sticky top-[46px] z-10">
          <TickerBanner messages={tickerMessages} />
        </div>
      )}

      {/* 체크인 유도 카드 */}
      {!isLoading && checkInEvents.length > 0 && (
        <div className={`pt-8 pb-3 ${checkInEvents.length === 1 ? 'flex justify-center' : ''}`}>
          <div className={`overflow-x-auto scrollbar-hide px-4 ${checkInEvents.length === 1 ? '' : ''}`}>
            <div className={`flex gap-3 ${checkInEvents.length === 1 ? '' : 'w-max'}`}>
              {checkInEvents.map((event) => (
                <TrainingCheckInCard
                  key={event.id}
                  event={event}
                  onCheckInSuccess={fetchData}
                  onShowToast={showToast}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 미투표 초대장들 */}
      {!isLoading && pendingInvites.length > 0 && (
        <div className={`pt-3 pb-3 ${pendingInvites.length === 1 ? 'flex justify-center' : ''}`}>
          <div className={`overflow-x-auto scrollbar-hide px-4 ${pendingInvites.length === 1 ? '' : ''}`}>
            <div className={`flex gap-3 ${pendingInvites.length === 1 ? '' : 'w-max'}`}>
              {pendingInvites.map((event) => (
                <TrainingInviteCard key={event.id} event={event} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 피드 */}
      <main className={expandedDate ? "" : "max-w-2xl mx-auto"}>
        {isLoading ? (
          <LoadingSpinner />
        ) : logs.length === 0 && recentNotes.length === 0 ? (
          <div className="text-center py-20 px-6">
            <div className="text-6xl mb-4">⚽</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              라커룸이 조용하네요
            </h2>
            <p className="text-gray-500 mb-6">
              팀 동료들과 함께 운동 일지를 공유해보세요!
            </p>
            <Link
              href="/write"
              className="inline-block bg-team-500 text-white px-6 py-3 rounded-full font-medium hover:bg-team-600 transition-colors"
            >
              첫 기록 남기기
            </Link>
          </div>
        ) : (
          <div className={expandedDate ? "" : "flex flex-col items-center gap-12 px-4 py-8"}>
            {groupedLogs.map((group) => {
              const isThisExpanded = expandedDate === group.displayDate;
              if (expandedDate && !isThisExpanded) return null;

              return (
                <div key={group.displayDate}>
                  <PolaroidDateGroup
                    logs={group.logs}
                    date={group.date}
                    displayDate={group.displayDate}
                    isExpanded={isThisExpanded}
                    onExpand={() => handleExpand(group.displayDate, group.logs)}
                    onCollapse={handleCollapse}
                    onLikeToggle={handleLikeToggle}
                    notes={notesByDate[group.date] || []}
                    disableNoteOpen
                  />
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* FAB - 추가 버튼 */}
      {!isLoading && (
        <div className="fixed bottom-6 right-6 z-50">
          {/* 메뉴 (운영진만) */}
          {isAdmin && showFabMenu && (
            <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[200px] mb-2">
              <Link
                href="/compliment"
                onClick={() => setShowFabMenu(false)}
                className="flex items-center gap-3 px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span>칭찬 쪽지 놓고오기</span>
              </Link>
              <Link
                href="/write"
                onClick={() => setShowFabMenu(false)}
                className="flex items-center gap-3 px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                <span>일지 작성</span>
              </Link>
              <Link
                href="/training/create"
                onClick={() => setShowFabMenu(false)}
                className="flex items-center gap-3 px-4 py-3.5 text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 8v8m-4-4h8" />
                </svg>
                <span>팀 운동 생성</span>
              </Link>
            </div>
          )}

          {/* FAB 버튼 */}
          {isAdmin ? (
            <button
              onClick={() => setShowFabMenu(!showFabMenu)}
              className="w-14 h-14 bg-team-500 rounded-full flex items-center justify-center shadow-lg hover:bg-team-600 transition-all"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-transform ${showFabMenu ? "rotate-45" : ""}`}
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          ) : (
            <Link
              href="/compliment"
              className="w-14 h-14 bg-team-500 rounded-full flex items-center justify-center shadow-lg hover:bg-team-600 transition-colors"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </Link>
          )}
        </div>
      )}

      {/* 토스트 */}
      <Toast
        message={toast?.message || ""}
        visible={!!toast}
        onHide={hideToast}
      />
    </div>
  );
}
