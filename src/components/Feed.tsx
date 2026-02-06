"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import PolaroidDateGroup from "./PolaroidDateGroup";
import TickerBanner from "./TickerBanner";
import Toast from "./Toast";
import { usePushSubscription } from "@/lib/usePushSubscription";
import { useToast } from "@/lib/useToast";
import { timeAgo } from "@/lib/timeAgo";
import type { TrainingLog, TeamMember, GroupedLogs } from "@/types/training";

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
  const [loading, setLoading] = useState(true);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const { isSupported, isSubscribed, subscribe } = usePushSubscription();
  const { toast, showToast, hideToast } = useToast();

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
      const [logsRes, teamRes, nudgesRes] = await Promise.all([
        fetch("/api/training-logs"),
        fetch("/api/teams"),
        fetch("/api/nudges"),
      ]);

      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs);
      }

      if (teamRes.ok) {
        const data = await teamRes.json();
        setTeamMembers(data.members || []);
      }

      if (nudgesRes.ok) {
        const data = await nudgesRes.json();
        setNudges(data.nudges || []);
      }
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500"></div>
      </div>
    );
  }

  const groupedLogs = groupLogsByDate();
  const activeUserIds = todayActiveUserIds();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="#F5F0EB" stroke="#967B5D" strokeWidth="1.5" />
            <path d="M12 7 L16 10.2 L14.5 14.8 L9.5 14.8 L8 10.2 Z" fill="#967B5D" />
            <line x1="12" y1="7" x2="12" y2="1.5" stroke="#967B5D" strokeWidth="1.2" />
            <line x1="16" y1="10.2" x2="22.5" y2="6.7" stroke="#967B5D" strokeWidth="1.2" />
            <line x1="14.5" y1="14.8" x2="18.5" y2="20.8" stroke="#967B5D" strokeWidth="1.2" />
            <line x1="9.5" y1="14.8" x2="5.5" y2="20.8" stroke="#967B5D" strokeWidth="1.2" />
            <line x1="8" y1="10.2" x2="1.5" y2="6.7" stroke="#967B5D" strokeWidth="1.2" />
          </svg>
          <div className="flex items-center gap-3">
            <Link
              href="/write"
              className="w-8 h-8 bg-team-500 rounded-full flex items-center justify-center hover:bg-team-600 transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </Link>
            <Link href="/my" className="text-team-500 hover:text-team-600 transition-colors">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </Link>
          </div>
        </div>
      </header>

      {/* 전광판 */}
      <TickerBanner messages={getTickerMessages()} />

      {/* 피드 */}
      <main className="max-w-lg mx-auto">
        {logs.length === 0 ? (
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
        ) : expandedDate ? (
          // 펼친 상태: 해당 날짜 캐러셀만 표시
          <div className="py-4">
            {groupedLogs.map((group) =>
              group.displayDate === expandedDate ? (
                <PolaroidDateGroup
                  key={group.displayDate}
                  logs={group.logs}
                  displayDate={group.displayDate}
                  isExpanded={true}
                  onExpand={() => setExpandedDate(group.displayDate)}
                  onCollapse={() => setExpandedDate(null)}
                  onLikeToggle={handleLikeToggle}
                />
              ) : null
            )}
          </div>
        ) : (
          // 접힌 상태: 폴라로이드 스택들
          <div className="flex flex-col items-center gap-10 px-4 py-8">
            {groupedLogs.map((group) => (
              <PolaroidDateGroup
                key={group.displayDate}
                logs={group.logs}
                displayDate={group.displayDate}
                isExpanded={false}
                onExpand={() => setExpandedDate(group.displayDate)}
                onCollapse={() => setExpandedDate(null)}
                onLikeToggle={handleLikeToggle}
              />
            ))}
          </div>
        )}
      </main>

      {/* 토스트 */}
      <Toast
        message={toast?.message || ""}
        visible={!!toast}
        onHide={hideToast}
      />
    </div>
  );
}
