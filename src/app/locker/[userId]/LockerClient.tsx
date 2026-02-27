// 개인 락커 클라이언트 컴포넌트 - 타임라인, 쪽지, 스탯
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import BackButton from "@/components/BackButton";
import Toast from "@/components/Toast";
import PolaroidDateGroup from "@/components/PolaroidDateGroup";
import { useToast } from "@/lib/useToast";
import { fetcher } from "@/lib/fetcher";
import useSWR, { useSWRConfig } from "swr";
import PolaroidCard from "@/components/PolaroidCard";
import type { TrainingLog, GroupedLogs } from "@/types/training";
import { withEulReul } from "@/lib/korean";
import { useTeam } from "@/contexts/TeamContext";

interface LockerNote {
  id: string;
  content: string;
  color: string;
  rotation: number;
  positionX: number;
  positionY: number;
  tags: string[];
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
  recipient: {
    id: string;
    name: string | null;
  };
  trainingEvent: {
    id: string;
    title: string;
    date: string;
  } | null;
  createdAt: string;
}

interface User {
  id: string;
  name: string | null;
  position: string | null;
  number: number | null;
}

// 로컬 날짜 문자열로 변환 (YYYY-MM-DD)
const getLocalDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const STICKY_COLORS = [
  { value: "#FFF59D", label: "노랑" },
  { value: "#F8BBD0", label: "핑크" },
  { value: "#B2DFDB", label: "민트" },
  { value: "#D1C4E9", label: "라벤더" },
  { value: "#FFCCBC", label: "피치" },
];

import { STAT_TAGS } from "@/lib/stat-tags";

export default function LockerClient({ userId }: { userId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { mutate: globalMutate } = useSWRConfig();
  const { teamData } = useTeam(); // TeamContext 사용
  const { toast, showToast, hideToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState(STICKY_COLORS[0].value);
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [selectedActivityType, setSelectedActivityType] = useState<"event" | "log" | "">("");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());
  const [showNudgeConfirm, setShowNudgeConfirm] = useState(false);
  const [noteSentToday, setNoteSentToday] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);


  // URL 쿼리 파라미터로 쪽지 모달 자동 열기
  useEffect(() => {
    const openNote = searchParams.get("openNote");
    if (openNote === "true" && userId && userId !== session?.user?.id) {
      setShowAddModal(true);
      // URL에서 쿼리 파라미터 제거
      const url = new URL(window.location.href);
      url.searchParams.delete("openNote");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, userId, session?.user?.id]);

  // 사용자 정보 가져오기 (TeamContext에서)
  useEffect(() => {
    if (!userId || !teamData?.members) return;

    const targetUser = teamData.members.find((m) => m.id === userId);
    if (targetUser) {
      setUser(targetUser);
    }
  }, [userId, teamData]);

  const { data: allNotes, mutate } = useSWR<LockerNote[]>(
    userId ? `/api/locker-notes/user/${userId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1분 캐시
      keepPreviousData: true,
    }
  );

  const { data: logsData, isLoading: logsLoading } = useSWR<{ logs: TrainingLog[] }>(
    userId ? `/api/training-logs?userId=${userId}&limit=20` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 120000, // 2분 캐시
      keepPreviousData: true,
    }
  );

  const logs = logsData?.logs || [];

  // Fetch recent activities (training events + training logs) for tagging
  const { data: activitiesData } = useSWR<{
    activities: Array<{ id: string; title: string; date: string; type: "event" | "log" }>;
  }>(
    userId && session?.user?.teamId ? `/api/locker-notes/user/${userId}/recent-activities` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 120000, // 2분 캐시
      keepPreviousData: true,
    }
  );

  const recentActivities = activitiesData?.activities || [];

  // Profile data fetching (only for own locker)
  const isMyLocker = session?.user?.id === userId;

  // 모든 쪽지 표시 (내 락커 / 남의 락커 모두)
  const notes = allNotes || [];

  // POM 투표 수신 데이터 (스탯 차트용) — 내 락커룸일 때만 페치
  const { data: pomData } = useSWR<{ pomVotes: { tags: string[] }[]; mvpCount: number; logCount: number }>(
    isMyLocker ? `/api/pom/user/${userId}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000, // 5분 캐시
    }
  );

  // 오늘 이 사람에게 쪽지를 보냈는지 확인
  useEffect(() => {
    if (allNotes && session?.user?.id) {
      const today = getLocalDateString(new Date());
      const sentToday = allNotes.some(
        (note) =>
          note.author.id === session.user.id &&
          getLocalDateString(new Date(note.createdAt)) === today
      );
      setNoteSentToday(sentToday);
    }
  }, [allNotes, session?.user?.id]);


  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag)
        ? prev.filter((t) => t !== tag)
        : [...prev, tag]
    );
  };

  const handleNudge = async () => {
    if (!userId || !user) return;

    if (nudgedToday.has(userId)) {
      showToast(`${user.name}님은 오늘 이미 닦달했어요!`);
      return;
    }

    try {
      const res = await fetch("/api/nudges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: userId,
        }),
      });

      if (res.ok) {
        showToast(`${withEulReul(user.name || "팀원")} 닦달했어요! 🔥`);
        setNudgedToday((prev) => new Set(prev).add(userId));
      } else {
        showToast("닦달에 실패했습니다");
      }
    } catch (error) {
      console.error("Nudge error:", error);
      showToast("닦달에 실패했습니다");
    }
  };

  const handleAddNote = async () => {
    if (!noteContent.trim()) {
      showToast("내용을 입력해주세요");
      return;
    }

    if (noteContent.length > 500) {
      showToast("쪽지는 500자 이내로 작성해주세요");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/locker-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: userId,
          content: noteContent,
          color: noteColor,
          rotation: Math.random() * 6 - 3, // -3 ~ +3도 랜덤 회전
          positionX: 0,
          positionY: 0,
          trainingEventId: selectedActivityType === "event" ? selectedActivityId : null,
          trainingLogId: selectedActivityType === "log" ? selectedActivityId : null,
          tags: selectedTags,
        }),
      });

      if (res.ok) {
        showToast("쪽지를 남겼습니다!");
        setNoteContent("");
        setNoteColor(STICKY_COLORS[0].value);
        setSelectedActivityId("");
        setSelectedActivityType("");
        setSelectedTags([]);
        setShowAddModal(false);
        setNoteSentToday(true);
        mutate();
        globalMutate("/api/locker-notes"); // 피드 캐시도 갱신
      } else {
        showToast("쪽지 작성에 실패했습니다");
      }
    } catch (error) {
      console.error("Failed to add note:", error);
      showToast("쪽지 작성에 실패했습니다");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("이 쪽지를 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/locker-notes/${noteId}/delete`, {
        method: "DELETE",
      });

      if (res.ok) {
        showToast("쪽지를 삭제했습니다");
        mutate();
        globalMutate("/api/locker-notes"); // 피드 캐시도 갱신
      } else {
        showToast("쪽지 삭제에 실패했습니다");
      }
    } catch (error) {
      console.error("Failed to delete note:", error);
      showToast("쪽지 삭제에 실패했습니다");
    }
  };

  // 쪽지를 날짜별로 미리 그룹핑 (O(n) 1회)
  const notesByDate = useMemo(() => {
    const map: Record<string, LockerNote[]> = {};
    for (const note of notes) {
      const date = getLocalDateString(new Date(note.createdAt));
      if (!map[date]) map[date] = [];
      map[date].push(note);
    }
    return map;
  }, [notes]);

  // 날짜별 그룹핑 (로그 + 쪽지 날짜 병합)
  const groupedLogs = useMemo((): GroupedLogs[] => {
    const today = getLocalDateString(new Date());
    const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

    const grouped: Record<string, TrainingLog[]> = {};

    for (const log of logs) {
      const date = getLocalDateString(new Date(log.trainingDate));
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(log);
    }

    // 쪽지만 있는 날짜도 추가
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
    // 좋아요 기능은 나중에 구현
  }, []);

  // 스탯 집계 (쪽지 태그 + POM 투표 태그 합산)
  const { stats, statEntries, maxStatValue, hasEnoughNotes } = useMemo(() => {
    const s: Record<string, number> = {};
    for (const note of notes) {
      for (const tag of note.tags) {
        s[tag] = (s[tag] || 0) + 1;
      }
    }
    for (const vote of (pomData?.pomVotes ?? [])) {
      for (const tag of vote.tags) {
        s[tag] = (s[tag] || 0) + 1;
      }
    }
    const entries = Object.entries(s).sort((a, b) => b[1] - a[1]);
    const maxVal = Math.max(...Object.values(s), 0);
    const totalDataPoints = notes.length + (pomData?.pomVotes?.length ?? 0);
    return { stats: s, statEntries: entries, maxStatValue: maxVal, hasEnoughNotes: totalDataPoints >= 5 };
  }, [notes, pomData]);

  // loading.tsx와 동일한 스켈레톤 (이중 전환 방지)
  if (!notes || !user) {
    return (
      <div className="min-h-screen bg-white">
        {/* 뒤로가기 버튼 (fixed) */}
        <div className="fixed top-4 left-4 z-30">
          <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse" />
        </div>

        {/* 이름표 영역 */}
        <div className="pt-16 pb-2 flex flex-col items-center">
          <div
            className="relative p-2 rounded"
            style={{ background: "linear-gradient(135deg, #9CA3AF 0%, #6B7280 50%, #9CA3AF 100%)" }}
          >
            <div className="bg-white px-6 py-3">
              <div className="flex items-center justify-center gap-2">
                <div className="animate-pulse h-3 w-8 bg-gray-200 rounded" />
                <div className="animate-pulse h-4 w-14 bg-gray-200 rounded" />
              </div>
            </div>
          </div>

          {/* 액션 버튼 2개 */}
          <div className="flex gap-2.5 mt-4 w-64">
            <div className="flex-1 py-2.5 bg-team-50 rounded-xl animate-pulse h-[38px]" />
            <div className="flex-1 py-2.5 bg-team-50 rounded-xl animate-pulse h-[38px]" />
          </div>
        </div>

        {/* 폴라로이드 타임라인 스켈레톤 */}
        <div className="max-w-2xl mx-auto">
          <div className="flex flex-col items-center gap-12 py-6 px-4 animate-pulse">
            {[
              [{ top: 18, left: -8, rotation: -10 }, { top: 8, left: 10, rotation: 6 }, { top: 2, left: 0, rotation: -2 }],
              [{ top: 14, left: -6, rotation: -6 }, { top: 6, left: 12, rotation: 8 }, { top: 0, left: 2, rotation: -4 }],
            ].map((group, gi) => (
              <div key={gi} className="flex flex-col items-center">
                <div className="relative w-44 h-56">
                  {group.map((config, i) => (
                    <div
                      key={i}
                      className="absolute"
                      style={{
                        top: config.top,
                        left: "50%",
                        marginLeft: -72 + config.left,
                        transform: `rotate(${config.rotation}deg)`,
                        zIndex: i + 1,
                      }}
                    >
                      <div className="w-36 bg-white rounded-sm p-1.5 pb-6 shadow-md">
                        <div className="bg-team-50 rounded-sm w-full aspect-[4/3]" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="-mt-1 text-center">
                  <div className="h-4 bg-gray-200 rounded w-10 mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 뒤로가기 버튼 */}
      <div className="fixed top-4 left-4 z-30">
        <BackButton href="/my" />
      </div>

      {/* 설정 버튼 (본인 락커만) → /my/settings 이동 */}
      {isMyLocker && (
        <Link
          href="/my/settings"
          className="fixed top-4 right-4 z-30 p-2 bg-white/80 rounded-full hover:bg-gray-50 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
      )}

      {/* 이름표 */}
      <div className="pt-16 pb-2 flex flex-col items-center">
        {/* 이름표와 버튼 */}
        {!isMyLocker ? (
          <div className="flex flex-col items-center">
            {/* 금속 틀 */}
            <div
              className="relative p-2 rounded"
              style={{
                background: "linear-gradient(135deg, #9CA3AF 0%, #6B7280 50%, #9CA3AF 100%)",
              }}
            >
              {/* 이름표 카드 */}
              <div className="bg-white px-6 py-3">
                <div className="flex items-center justify-center gap-2">
                  {user.number !== null && user.number !== undefined && (
                    <div className="text-xs text-gray-500 font-medium">
                      No. {user.number}
                    </div>
                  )}
                  <div className="text-base font-semibold text-gray-900">
                    {user.name || "선수"}
                  </div>
                </div>
              </div>
            </div>

            {/* 칭찬 쪽지 놓고 오기 / 닦달하기 버튼 */}
            <div className="flex gap-2.5 mt-4 w-64">
              <button
                onClick={() => setShowAddModal(true)}
                disabled={noteSentToday}
                className="flex-1 min-w-0 py-2.5 bg-team-50 text-team-600 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
                <span className="truncate">쪽지 놓고 오기</span>
              </button>
              <button
                onClick={() => setShowNudgeConfirm(true)}
                disabled={nudgedToday.has(userId)}
                className="flex-1 min-w-0 py-2.5 bg-team-50 text-team-600 rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <span className="truncate">닦달하기</span>
              </button>
            </div>
          </div>
        ) : (
          /* 본인 락커 - 이름표 + 나의 스탯 콜랩스 */
          <div className="flex flex-col items-center w-full px-4">
            <div
              className="relative p-2 rounded"
              style={{
                background: "linear-gradient(135deg, #9CA3AF 0%, #6B7280 50%, #9CA3AF 100%)",
              }}
            >
              <div className="bg-white px-6 py-3">
                <div className="flex items-center justify-center gap-2">
                  {user.number !== null && user.number !== undefined && (
                    <div className="text-xs text-gray-500 font-medium">
                      No. {user.number}
                    </div>
                  )}
                  <div className="text-base font-semibold text-gray-900">
                    {user.name || "선수"}
                  </div>
                </div>
              </div>
            </div>

            {/* MVP 배지 — 버튼과 분리, 이름표 아래 독립 노출 */}
            {(pomData?.mvpCount ?? 0) > 0 && (
              <div className="mt-3">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-50 text-yellow-700 text-xs font-semibold rounded-full border border-yellow-200">
                  🏆 MVP 수상 {pomData!.mvpCount}회
                </span>
              </div>
            )}

            {/* 나의 스탯 콜랩스 섹션 */}
            <div className="w-full max-w-xs mt-3">
              {!hasEnoughNotes ? (
                /* 잠금 상태 — 버튼 비활성 + 진행 프로그레스바 */
                <div>
                  <div className="flex items-center justify-between w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm">
                    <span className="font-medium text-gray-400">나의 스탯</span>
                    <span className="text-xs text-gray-400">
                      {notes.length + (pomData?.pomVotes?.length ?? 0)}/5
                    </span>
                  </div>
                  <div className="mt-1.5 w-full bg-gray-200 rounded-full h-1">
                    <div
                      className="bg-team-400 h-1 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(((notes.length + (pomData?.pomVotes?.length ?? 0)) / 5) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-1.5">
                    쪽지·투표 {Math.max(5 - notes.length - (pomData?.pomVotes?.length ?? 0), 0)}개 더 받으면 열려요
                  </p>
                </div>
              ) : (
                /* 잠금 해제 상태 */
                <>
                  <button
                    onClick={() => setStatsOpen((v) => !v)}
                    className="flex items-center justify-between w-full px-4 py-2.5 bg-team-50 rounded-xl text-sm active:scale-[0.98] transition-transform"
                  >
                    <span className="font-medium text-team-700">나의 스탯</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-team-500">
                        {notes.length + (pomData?.pomVotes?.length ?? 0)}개 분석
                      </span>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={`text-team-400 transition-transform duration-200 ${statsOpen ? "rotate-180" : ""}`}
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </div>
                  </button>

                  {statsOpen && (
                    <div className="mt-2 bg-white rounded-xl p-4 border border-gray-100">
                      {statEntries.length === 0 ? (
                        <div className="text-center py-4 text-gray-500 text-sm">
                          아직 태그가 없습니다
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-xs text-gray-400 text-center">
                            {(pomData?.logCount ?? 0) > 0 && <>일지 {pomData!.logCount}회 · </>}
                            쪽지 {notes.length}장
                            {(pomData?.pomVotes?.length ?? 0) > 0 && (
                              <> · POM {pomData!.pomVotes.length}회</>
                            )}{" "}
                            기반 분석
                          </p>
                          <div className="space-y-2">
                            {statEntries.slice(0, 5).map(([tag, count]) => (
                              <div key={tag} className="flex items-center gap-2">
                                <span className="text-xs text-gray-700 w-10 shrink-0">{tag}</span>
                                <div className="flex-1 bg-gray-100 rounded-full h-2">
                                  <div
                                    className="bg-team-400 h-2 rounded-full"
                                    style={{ width: `${(count / maxStatValue) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs font-medium text-team-600 w-4 text-right shrink-0">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <main className="max-w-2xl mx-auto">
        {/* 타임라인 */}
        <div className="bg-white min-h-screen">
            {/* 폴라로이드 스택 (날짜별) */}
            <div className="flex flex-col items-center gap-12 py-6 px-4">
              {logsLoading && groupedLogs.length === 0 ? (
                <div className="py-20 flex justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-team-400" />
                </div>
              ) : groupedLogs.length === 0 && notes.length === 0 ? (
                <div className="text-center py-20 px-6">
                  <div className="text-3xl mb-3">📝</div>
                  <h2 className="text-base font-semibold text-gray-800 mb-1">
                    아직 기록이 없어요
                  </h2>
                  <p className="text-sm text-gray-500">
                    {isMyLocker ? "첫 운동 일지를 작성해보세요!" : "아직 기록이 없습니다"}
                  </p>
                </div>
              ) : (
                groupedLogs.map((group) => {
                  const isThisExpanded = expandedDate === group.displayDate;
                  if (expandedDate && !isThisExpanded) return null;

                  const notesForDate = notesByDate[group.date] || [];

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
                        notes={notesForDate}
                        hideCount={true}
                        currentUserId={session?.user?.id}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
      </main>

      {/* 닦달 확인 모달 */}
      {showNudgeConfirm && user && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowNudgeConfirm(false)}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-xs shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-5">
              <div className="text-4xl mb-3">⚡</div>
              <p className="text-base font-semibold text-gray-900">
                {withEulReul(user.name || "팀원")} 닦달할까요?
              </p>
              <p className="text-sm text-gray-500 mt-1">
                하루에 한 번만 보낼 수 있어요
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNudgeConfirm(false)}
                className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={async () => {
                  setShowNudgeConfirm(false);
                  await handleNudge();
                }}
                className="flex-1 py-3 text-sm font-medium text-white bg-gray-700 rounded-xl hover:bg-gray-800 transition-colors"
              >
                닦달하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 쪽지 작성 모달 */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => {
            setShowAddModal(false);
            setNoteContent("");
            setNoteColor(STICKY_COLORS[0].value);
            setSelectedActivityId("");
            setSelectedActivityType("");
            setSelectedTags([]);
          }}
        >
          <div
            className="bg-white rounded-2xl p-6 w-full max-w-sm max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              쪽지 남기기
            </h2>

            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="칭찬 메시지를 남겨주세요 (500자 이내)"
              maxLength={500}
              className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-team-500 text-sm"
            />
            <p className="text-xs text-gray-500 text-right mt-1">
              {noteContent.length}/500
            </p>

            {/* 운동 태그 선택 */}
            {recentActivities.length > 0 && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">운동 태그 (선택)</p>
                <select
                  value={selectedActivityId}
                  onChange={(e) => {
                    const activityId = e.target.value;
                    setSelectedActivityId(activityId);
                    if (activityId) {
                      const activity = recentActivities.find((a) => a.id === activityId);
                      setSelectedActivityType(activity?.type || "");
                    } else {
                      setSelectedActivityType("");
                    }
                  }}
                  className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-team-500"
                >
                  <option value="">선택 안 함</option>
                  {recentActivities.map((activity) => (
                    <option key={activity.id} value={activity.id}>
                      {new Date(activity.date).toLocaleDateString("ko-KR", {
                        month: "numeric",
                        day: "numeric",
                      })}{" "}
                      {activity.title} {activity.type === "log" && "📝"}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* 색상 선택 */}
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">색상</p>
              <div className="flex gap-2">
                {STICKY_COLORS.map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setNoteColor(color.value)}
                    className={`w-10 h-10 rounded-full border-2 transition-all ${
                      noteColor === color.value
                        ? "border-team-600 scale-110"
                        : "border-gray-300"
                    }`}
                    style={{ backgroundColor: color.value }}
                    title={color.label}
                  />
                ))}
              </div>
            </div>

            {/* 스탯 태그 선택 */}
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                어떤 부분에 대한 칭찬인가요? (선택)
              </p>
              <div className="flex flex-wrap gap-2">
                {STAT_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      selectedTags.includes(tag)
                        ? "bg-team-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 경고 문구 */}
            <p className="text-xs text-gray-500 text-center mt-5">
              ⚠️ 작성 후에는 수정할 수 없어요
            </p>

            {/* 버튼 */}
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => {
                  setShowAddModal(false);
                  setNoteContent("");
                  setNoteColor(STICKY_COLORS[0].value);
                  setSelectedActivityId("");
                  setSelectedActivityType("");
                  setSelectedTags([]);
                }}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleAddNote}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-team-600 text-white rounded-lg font-medium hover:bg-team-700 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? "작성 중..." : "붙이기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 쪽지 확대 모달 */}
      {expandedNoteId && (() => {
        const note = notes.find((n) => n.id === expandedNoteId);
        return (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => {
              setExpandedNoteId(null);
            }}
          >
            <div
              className="rounded-2xl p-6 w-full max-w-sm shadow-xl"
              style={{
                backgroundColor: note?.color || "#FFF59D",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-gray-800 whitespace-pre-wrap break-words text-base mb-4">
                {note?.content}
              </p>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm text-gray-600">
                    {note?.author.name}
                  </p>
                </div>
                {isMyLocker && (
                  <button
                    onClick={() => handleDeleteNote(expandedNoteId)}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    삭제
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500">
                {new Date(note?.createdAt || "").toLocaleDateString("ko-KR")}
              </p>
            </div>
          </div>
        );
      })()}

      {/* Toast */}
      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </div>
  );
}
