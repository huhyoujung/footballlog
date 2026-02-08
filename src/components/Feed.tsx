"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PolaroidDateGroup from "./PolaroidDateGroup";
import TickerBanner from "./TickerBanner";
import TrainingInviteCard from "./TrainingInviteCard";
import Toast from "./Toast";
import FeedSkeleton from "./FeedSkeleton";
import { usePushSubscription } from "@/lib/usePushSubscription";
import { useToast } from "@/lib/useToast";
import { timeAgo } from "@/lib/timeAgo";
import type { TrainingLog, TeamMember, GroupedLogs } from "@/types/training";
import type { TrainingEventSummary } from "@/types/training-event";

interface Nudge {
  id: string;
  sender: { id: string; name: string | null };
  recipient: { id: string; name: string | null };
  createdAt: string;
}

export default function Feed() {
  const { data: session } = useSession();
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamLogoUrl, setTeamLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [nextEvent, setNextEvent] = useState<TrainingEventSummary | null>(null);
  const [showFabMenu, setShowFabMenu] = useState(false);
  const { isSupported, isSubscribed, subscribe } = usePushSubscription();
  const { toast, showToast, hideToast } = useToast();

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    fetchData();
  }, []);

  // 로그인 후 알림 구독 요청
  useEffect(() => {
    if (session && isSupported && !isSubscribed) {
      subscribe();
    }
  }, [session, isSupported, isSubscribed]);

  const fetchData = async () => {
    try {
      const [logsRes, teamRes, nudgesRes, eventRes] = await Promise.all([
        fetch("/api/training-logs"),
        fetch("/api/teams"),
        fetch("/api/nudges"),
        fetch("/api/training-events/next"),
      ]);

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs);
      }

      if (teamRes.ok) {
        const data = await teamRes.json();
        setTeamMembers(data.members || []);
        setTeamLogoUrl(data.logoUrl || null);
      }

      if (nudgesRes.ok) {
        const data = await nudgesRes.json();
        setNudges(data.nudges || []);
      }

      if (eventRes.ok) {
        const data = await eventRes.json();
        setNextEvent(data.event || null);
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExpand = useCallback((date: string) => {
    setExpandedDate(date);
  }, []);

  const handleCollapse = useCallback(() => {
    setExpandedDate(null);
  }, []);

  const handleLikeToggle = async (logId: string) => {
    // 낙관적 업데이트
    const target = logs.find((l) => l.id === logId);
    if (!target) return;

    const wasLiked = target.isLiked;
    const prevCount = target._count.likes;

    setLogs((prev) =>
      prev.map((log) =>
        log.id === logId
          ? {
              ...log,
              isLiked: !wasLiked,
              _count: { ...log._count, likes: wasLiked ? prevCount - 1 : prevCount + 1 },
            }
          : log
      )
    );

    try {
      const res = await fetch(`/api/training-logs/${logId}/likes`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setLogs((prev) =>
          prev.map((log) =>
            log.id === logId
              ? {
                  ...log,
                  isLiked: data.liked,
                  _count: { ...log._count, likes: data.likeCount },
                }
              : log
          )
        );
        showToast(data.liked ? "좋아요를 눌렀어요" : "좋아요를 취소했어요");
      } else {
        // 실패 시 롤백
        setLogs((prev) =>
          prev.map((log) =>
            log.id === logId
              ? {
                  ...log,
                  isLiked: wasLiked,
                  _count: { ...log._count, likes: prevCount },
                }
              : log
          )
        );
      }
    } catch (error) {
      console.error("좋아요 실패:", error);
      // 실패 시 롤백
      setLogs((prev) =>
        prev.map((log) =>
          log.id === logId
            ? {
                ...log,
                isLiked: wasLiked,
                _count: { ...log._count, likes: prevCount },
              }
            : log
        )
      );
    }
  };

  // 날짜별 그룹핑
  const groupLogsByDate = (): GroupedLogs[] => {
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000)
      .toISOString()
      .split("T")[0];

    const grouped: Record<string, TrainingLog[]> = {};
    for (const log of logs) {
      const date = new Date(log.trainingDate).toISOString().split("T")[0];
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(log);
    }

    return Object.entries(grouped)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, dateLogs]) => ({
        displayDate:
          date === today
            ? "오늘"
            : date === yesterday
              ? "어제"
              : new Date(date).toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                }),
        logs: dateLogs,
      }));
  };

  // 오늘 운동한 사용자 ID 목록
  const todayActiveUserIds = (): string[] => {
    const today = new Date().toISOString().split("T")[0];
    return [
      ...new Set(
        logs
          .filter(
            (log) =>
              new Date(log.trainingDate).toISOString().split("T")[0] === today
          )
          .map((log) => log.user.id)
      ),
    ];
  };

  const getTickerMessages = () => {
    const messages: { key: string; text: string }[] = [];

    // 팀 운동 (최우선)
    if (nextEvent) {
      const d = new Date(nextEvent.date);
      const dateStr = d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
      const timeStr = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
      messages.push({
        key: `event-${nextEvent.id}`,
        text: `📢 ${nextEvent.title || "팀 운동"} · ${dateStr} ${timeStr} · ${nextEvent.location}`,
      });
    }

    // 닦달 메시지 (최신순, API에서 이미 2시간 필터링)
    for (const nudge of nudges) {
      const sender = nudge.sender.name || "팀원";
      const recipient = nudge.recipient.name || "팀원";
      messages.push({
        key: `nudge-${nudge.id}`,
        text: `💪 ${sender}님이 ${recipient}님을 닦달했습니다 · ${timeAgo(nudge.createdAt)}`,
      });
    }

    // 활동 메시지 (상시)
    const count = todayActiveUserIds().length;
    const total = teamMembers.length;
    if (count === 0) {
      messages.push({ key: "activity", text: "라커룸이 조용하네요 오늘의 첫 기록을 남겨보세요!" });
    } else if (count >= total && total > 0) {
      messages.push({ key: "activity", text: `전원 출석! ${count}명 운동 완료 🎉` });
    } else {
      messages.push({ key: "activity", text: `오늘 ${count}명 운동 완료! 🔥` });
    }

    return messages;
  };

  const groupedLogs = groupLogsByDate();

  // 미투표 초대장 표시 여부 (마감 시간 전까지만)
  const showInvite = nextEvent && !nextEvent.myRsvp && new Date() < new Date(nextEvent.rsvpDeadline);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">
          {teamLogoUrl ? (
            <img src={teamLogoUrl} alt="팀 로고" className="w-8 h-8 object-cover rounded-full" />
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="1" width="18" height="22" rx="1" fill="#E8E0D8" stroke="#967B5D" strokeWidth="1" />
              <circle cx="12" cy="11" r="4" fill="none" stroke="#967B5D" strokeWidth="1" />
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
      {!loading && <TickerBanner messages={getTickerMessages()} />}

      {/* 미투표 초대장 */}
      {!loading && showInvite && <TrainingInviteCard event={nextEvent!} />}

      {/* 피드 */}
      <main className="max-w-lg mx-auto">
        {loading ? (
          <FeedSkeleton />
        ) : logs.length === 0 ? (
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
          <div className="flex flex-col items-center gap-10 px-4 py-8">
            {groupedLogs.map((group) => (
              <PolaroidDateGroup
                key={group.displayDate}
                logs={group.logs}
                displayDate={group.displayDate}
                isExpanded={expandedDate === group.displayDate}
                onExpand={() => handleExpand(group.displayDate)}
                onCollapse={handleCollapse}
                onLikeToggle={handleLikeToggle}
              />
            ))}
          </div>
        )}
      </main>

      {/* FAB - 추가 버튼 */}
      <div className="fixed bottom-6 right-6 z-50">
        {/* 메뉴 (운영진만) */}
        {isAdmin && showFabMenu && (
          <div className="absolute bottom-16 right-0 bg-white rounded-xl shadow-xl border border-gray-200 py-2 min-w-[160px] mb-2">
            <Link
              href="/write"
              onClick={() => setShowFabMenu(false)}
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
              className="flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
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
            href="/write"
            className="w-14 h-14 bg-team-500 rounded-full flex items-center justify-center shadow-lg hover:bg-team-600 transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </Link>
        )}
      </div>

      {/* 토스트 */}
      <Toast
        message={toast?.message || ""}
        visible={!!toast}
        onHide={hideToast}
      />
    </div>
  );
}
