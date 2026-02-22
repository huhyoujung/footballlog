// 개인 락커 클라이언트 컴포넌트 - 타임라인, 쪽지, 프로필 관리
"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import BackButton from "@/components/BackButton";
import Toast from "@/components/Toast";
import PolaroidDateGroup from "@/components/PolaroidDateGroup";
import { useToast } from "@/lib/useToast";
import { fetcher } from "@/lib/fetcher";
import useSWR, { useSWRConfig } from "swr";
import PolaroidCard from "@/components/PolaroidCard";
import type { TrainingLog, GroupedLogs } from "@/types/training";
import { usePushSubscription } from "@/lib/usePushSubscription";
import { withEulReul } from "@/lib/korean";
import { useTeam } from "@/contexts/TeamContext";

interface LockerNote {
  id: string;
  content: string;
  color: string;
  rotation: number;
  positionX: number;
  positionY: number;
  isAnonymous: boolean;
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

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
}

type LockerTab = "timeline" | "profile";

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

const POSITIONS = [
  "감독",
  "GK",
  "CB",
  "LB",
  "RB",
  "CDM",
  "CM",
  "CAM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST",
  "CF",
];

export default function LockerClient({ userId }: { userId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, update } = useSession();
  const { mutate: globalMutate } = useSWRConfig();
  const { teamData } = useTeam(); // TeamContext 사용
  const { toast, showToast, hideToast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<LockerTab>("timeline");
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState(STICKY_COLORS[0].value);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string>("");
  const [selectedActivityType, setSelectedActivityType] = useState<"event" | "log" | "">("");
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [showAuthor, setShowAuthor] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());
  const [showNudgeConfirm, setShowNudgeConfirm] = useState(false);
  const [noteSentToday, setNoteSentToday] = useState(false);

  // Profile editing state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [position, setPosition] = useState("");
  const [number, setNumber] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Push notification state
  const { isSupported, isSubscribed, isReady, subscribe, unsubscribe } = usePushSubscription();
  const [subscribing, setSubscribing] = useState(false);

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
  const { data: profileData } = useSWR<Profile>(
    isMyLocker ? "/api/profile" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 300000,
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

  // Sync profile data with state
  useEffect(() => {
    if (profileData && isMyLocker) {
      setProfile(profileData);
      setName(profileData.name || "");
      setPosition(profileData.position || "");
      setNumber(profileData.number !== null ? String(profileData.number) : "");
      setImagePreview(profileData.image);
    }
  }, [profileData, isMyLocker]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showToast("이미지는 5MB 이하만 가능합니다");
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast("이미지 파일만 업로드 가능합니다");
      return;
    }

    setUploading(true);

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "이미지 업로드에 실패했습니다");
      }

      const { url } = await uploadRes.json();
      setImagePreview(url);

      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: url }),
      });

      await update();
      showToast("프로필 사진이 변경되었습니다");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      showToast("이름을 입력해주세요");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          position: position || null,
          number: number ? parseInt(number) : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장에 실패했습니다");
      }

      await update();
      showToast("저장되었습니다");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handlePushToggle = async () => {
    if (subscribing || !isReady) return;

    setSubscribing(true);

    try {
      if (isSubscribed) {
        const result = await unsubscribe();
        if (result) {
          showToast("알림이 비활성화되었습니다");
        } else {
          showToast("알림 해제에 실패했습니다");
        }
      } else {
        const result = await subscribe();
        if (result.success) {
          showToast("알림이 활성화되었습니다");
        } else {
          const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
          const isPWA = window.matchMedia('(display-mode: standalone)').matches;

          const errorMessages: Record<string, string> = {
            NOT_SUPPORTED: isIOS && !isPWA
              ? "iOS에서는 홈 화면에 추가한 후에만 푸시 알림을 사용할 수 있습니다"
              : "이 브라우저는 푸시 알림을 지원하지 않습니다",
            PERMISSION_DENIED: "알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요",
            VAPID_KEY_MISSING: "서버 설정 오류입니다. 관리자에게 문의하세요",
            SERVER_ERROR: "서버 구독 실패. 잠시 후 다시 시도해주세요",
            "Service worker timeout": "서비스 워커 준비 시간 초과. 페이지를 새로고침해주세요",
          };
          showToast(errorMessages[result.error] || `오류: ${result.error}`);
        }
      }
    } catch (err) {
      console.error("Push toggle error:", err);
      showToast("알림 설정에 실패했습니다");
    } finally {
      setSubscribing(false);
    }
  };

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
          isAnonymous,
          trainingEventId: selectedActivityType === "event" ? selectedActivityId : null,
          trainingLogId: selectedActivityType === "log" ? selectedActivityId : null,
          tags: selectedTags,
        }),
      });

      if (res.ok) {
        showToast("쪽지를 남겼습니다!");
        setNoteContent("");
        setNoteColor(STICKY_COLORS[0].value);
        setIsAnonymous(false);
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

  // 스탯 집계 (태그별 카운트)
  const { stats, statEntries, maxStatValue, hasEnoughNotes } = useMemo(() => {
    const s: Record<string, number> = {};
    for (const note of notes) {
      for (const tag of note.tags) {
        s[tag] = (s[tag] || 0) + 1;
      }
    }
    const entries = Object.entries(s).sort((a, b) => b[1] - a[1]);
    const maxVal = Math.max(...Object.values(s), 0);
    return { stats: s, statEntries: entries, maxStatValue: maxVal, hasEnoughNotes: notes.length >= 5 };
  }, [notes]);

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

      {/* 설정 버튼 (본인 락커이고 타임라인 탭일 때만) */}
      {isMyLocker && activeTab === "timeline" && (
        <button
          onClick={() => setActiveTab("profile")}
          className="fixed top-4 right-4 z-30 p-2 bg-white/80 rounded-full hover:bg-gray-50 transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      )}

      {/* 이름표 */}
      {activeTab === "timeline" && (
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
            /* 본인 락커 - 이름표만 */
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
          )}
        </div>
      )}

      <main className="max-w-2xl mx-auto">
        {/* 타임라인 탭 */}
        {(activeTab === "timeline" || !isMyLocker) && (
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
        )}

        {/* 프로필 탭 */}
        {activeTab === "profile" && isMyLocker && (
          <div className="space-y-6 p-4 bg-white min-h-screen">
            {/* 프로필 사진 */}
            <div className="bg-white rounded-xl p-6 flex flex-col items-center">
              <div className="relative mb-4">
                <div className="w-24 h-24 rounded-full bg-gray-200 overflow-hidden">
                  {imagePreview ? (
                    <Image
                      src={imagePreview}
                      alt="프로필"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 text-4xl">
                      👤
                    </div>
                  )}
                </div>
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-full">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                  </div>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="text-team-500 text-sm font-medium"
              >
                {uploading ? "업로드 중..." : "사진 변경"}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            {/* 팀이 생각하는 나의 강점 */}
            <div className="bg-white rounded-xl p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">
                팀이 생각하는 나의 강점
              </h3>

              {!hasEnoughNotes ? (
                <div className="flex flex-col items-center justify-center py-8 px-4 bg-gradient-to-br from-team-50 to-team-100 rounded-lg">
                  <div className="text-5xl mb-3">🔒</div>
                  <p className="text-sm text-center text-gray-600 font-medium mb-1">
                    아직 스탯을 볼 수 없어요
                  </p>
                  <p className="text-xs text-center text-gray-500">
                    쪽지를 <span className="font-semibold text-team-600">{notes.length}/5</span>개 받았어요
                  </p>
                  <p className="text-xs text-center text-gray-500 mt-3 leading-relaxed">
                    팀 운동에 열심히 참여하고<br />쪽지를 더 받아보세요!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {statEntries.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-sm">
                      아직 태그가 없습니다
                    </div>
                  ) : (
                    <>
                      <p className="text-xs text-gray-500 text-center">
                        총 <span className="font-semibold text-team-600">{notes.length}개</span>의 쪽지 분석 결과
                      </p>

                      {/* 레이더 차트 */}
                      <div className="flex justify-center py-4">
                        <svg
                          viewBox="0 0 400 400"
                          className="w-full max-w-sm"
                          style={{ maxHeight: '320px' }}
                        >
                          {/* 배경 원들 (가이드 라인) */}
                          {[0.2, 0.4, 0.6, 0.8, 1.0].map((scale) => (
                            <circle
                              key={scale}
                              cx="200"
                              cy="200"
                              r={150 * scale}
                              fill="none"
                              stroke="#F3F4F6"
                              strokeWidth="1"
                            />
                          ))}

                          {/* 축 라인 및 라벨 */}
                          {STAT_TAGS.map((tag, i) => {
                            const angle = (i * 2 * Math.PI) / STAT_TAGS.length - Math.PI / 2;
                            const x = 200 + 150 * Math.cos(angle);
                            const y = 200 + 150 * Math.sin(angle);
                            const labelX = 200 + 180 * Math.cos(angle);
                            const labelY = 200 + 180 * Math.sin(angle);

                            return (
                              <g key={tag}>
                                {/* 축 라인 */}
                                <line
                                  x1="200"
                                  y1="200"
                                  x2={x}
                                  y2={y}
                                  stroke="#E5E7EB"
                                  strokeWidth="1"
                                />
                                {/* 라벨 */}
                                <text
                                  x={labelX}
                                  y={labelY}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  className="text-xs font-medium fill-gray-700"
                                  style={{ fontSize: '12px' }}
                                >
                                  {tag}
                                </text>
                              </g>
                            );
                          })}

                          {/* 데이터 다각형 */}
                          <polygon
                            points={STAT_TAGS.map((tag, i) => {
                              const count = stats[tag] || 0;
                              const ratio = Math.min(count / maxStatValue, 1);
                              const angle = (i * 2 * Math.PI) / STAT_TAGS.length - Math.PI / 2;
                              const x = 200 + 150 * ratio * Math.cos(angle);
                              const y = 200 + 150 * ratio * Math.sin(angle);
                              return `${x},${y}`;
                            }).join(' ')}
                            className="fill-team-500/20 stroke-team-500"
                            strokeWidth="2"
                            strokeLinejoin="round"
                          />

                          {/* 데이터 포인트 */}
                          {STAT_TAGS.map((tag, i) => {
                            const count = stats[tag] || 0;
                            if (count === 0) return null;

                            const ratio = Math.min(count / maxStatValue, 1);
                            const angle = (i * 2 * Math.PI) / STAT_TAGS.length - Math.PI / 2;
                            const x = 200 + 150 * ratio * Math.cos(angle);
                            const y = 200 + 150 * ratio * Math.sin(angle);

                            return (
                              <g key={`point-${tag}`}>
                                <circle
                                  cx={x}
                                  cy={y}
                                  r="4"
                                  className="fill-team-500"
                                  stroke="white"
                                  strokeWidth="2"
                                />
                                {/* 카운트 표시 */}
                                <text
                                  x={x}
                                  y={y - 12}
                                  textAnchor="middle"
                                  className="text-xs font-semibold fill-team-600"
                                  style={{ fontSize: '11px' }}
                                >
                                  {count}
                                </text>
                              </g>
                            );
                          })}
                        </svg>
                      </div>

                      {/* 범례 */}
                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                        {statEntries.map(([tag, count]) => (
                          <div key={tag} className="flex items-center justify-between text-xs">
                            <span className="text-gray-600">{tag}</span>
                            <span className="font-semibold text-team-600">{count}회</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* 이름 */}
            <div className="bg-white rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
              />
            </div>

            {/* 포지션 */}
            <div className="bg-white rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                포지션
              </label>
              <div className="grid grid-cols-5 gap-2">
                {POSITIONS.map((pos) => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setPosition(position === pos ? "" : pos)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      position === pos
                        ? "bg-team-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            </div>

            {/* 등번호 */}
            <div className="bg-white rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                등번호
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={2}
                value={number}
                onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="등번호를 입력하세요 (0~99)"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
              />
            </div>

            {/* 이메일 (읽기 전용) */}
            <div className="bg-white rounded-xl p-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                이메일
              </label>
              <p className="px-4 py-3 bg-gray-50 rounded-lg text-gray-500">
                {profile?.email}
              </p>
            </div>

            {/* 푸시 알림 설정 */}
            {isSupported && (
              <div className="bg-white rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">
                    푸시 알림
                  </label>
                  <button
                    type="button"
                    onClick={handlePushToggle}
                    disabled={subscribing || !isReady}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      isSubscribed ? "bg-team-500" : "bg-gray-300"
                    } disabled:opacity-50`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        isSubscribed ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {isSubscribed
                    ? "닦달, 댓글, 좋아요 등의 알림을 받고 있습니다"
                    : "알림을 켜면 중요한 소식을 놓치지 않아요"}
                </p>
              </div>
            )}

            {/* 저장 버튼 */}
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full py-3.5 bg-team-600 text-white rounded-xl font-semibold hover:bg-team-700 transition-colors disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        )}
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
            setIsAnonymous(false);
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

            {/* 익명 옵션 - 토글 */}
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">보내는 사람</span>
                <div className="inline-flex bg-gray-200 rounded-full p-0.5">
                  <button
                    type="button"
                    onClick={() => setIsAnonymous(false)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      !isAnonymous
                        ? "bg-team-500 text-white shadow-sm"
                        : "text-gray-600"
                    }`}
                  >
                    드러냄
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAnonymous(true)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isAnonymous
                        ? "bg-gray-400 text-white shadow-sm"
                        : "text-gray-600"
                    }`}
                  >
                    숨김
                  </button>
                </div>
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
                  setIsAnonymous(false);
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
              setShowAuthor(false);
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
                    {note?.isAnonymous
                      ? showAuthor
                        ? note.author.name
                        : "익명의 팀원"
                      : note?.author.name}
                  </p>
                  {isMyLocker && note?.isAnonymous && (
                    <button
                      onClick={() => setShowAuthor(!showAuthor)}
                      className="text-xs text-gray-500 hover:text-gray-700 underline"
                    >
                      {showAuthor ? "숨기기" : "보기"}
                    </button>
                  )}
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
