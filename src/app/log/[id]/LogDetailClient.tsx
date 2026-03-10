// 운동 일지 상세 클라이언트 컴포넌트 - 댓글, 좋아요, 수정/삭제 기능
"use client";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import useSWR from "swr";
import ConditionBadge from "@/components/ConditionBadge";
import Toast from "@/components/Toast";
import { useToast } from "@/lib/useToast";
import { useTeam } from "@/contexts/TeamContext";
import MentionTextarea from "@/components/MentionTextarea";
import dynamic from "next/dynamic";
import { useAnalytics } from "@/lib/useAnalytics";

const AIInsightModal = dynamic(() => import("@/components/AIInsightModal"), { ssr: false });

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Comment {
  id: string;
  content: string;
  mentions: string[];
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
}

interface TrainingLog {
  id: string;
  trainingDate: string;
  condition: number;
  conditionReason: string;
  keyPoints: string;
  improvement: string;
  imageUrl: string | null;
  title?: string | null;
  trainingEventId?: string | null;
  trainingEvent?: {
    id: string;
    title: string | null;
    date: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    position: string | null;
    number: number | null;
  };
  comments: Comment[];
  _count: {
    likes: number;
  };
  isLiked: boolean;
}

function isEdited(createdAt: string, updatedAt: string) {
  return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;
}

export default function LogDetailClient({ logId }: { logId: string }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { teamData } = useTeam(); // TeamContext에서 teamMembers 가져오기
  const [comment, setComment] = useState("");
  const [commentMentions, setCommentMentions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [editCommentMentions, setEditCommentMentions] = useState<string[]>([]);
  const [isInsightOpen, setIsInsightOpen] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const { capture } = useAnalytics();

  // SWR로 log 데이터 페칭
  const { data: log, isLoading, mutate } = useSWR<TrainingLog>(
    `/api/training-logs/${logId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 120000, // 2분 캐시 (댓글 등 실시간 변경 가능)
    }
  );

  const teamMembers = teamData?.members || []; // 중복 API 호출 제거
  const isMyPost = log && session?.user?.id === log.user.id;
  const isAdmin = session?.user?.role === "ADMIN";

  const handleLike = async () => {
    if (!log) return;

    const wasLiked = log.isLiked;
    const prevCount = log._count.likes;

    // SWR mutate로 낙관적 업데이트
    mutate(
      {
        ...log,
        isLiked: !wasLiked,
        _count: { ...log._count, likes: wasLiked ? prevCount - 1 : prevCount + 1 },
      },
      false
    );

    try {
      const res = await fetch(`/api/training-logs/${logId}/likes`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        mutate(
          {
            ...log,
            isLiked: data.liked,
            _count: { ...log._count, likes: data.likeCount },
          },
          false
        );
        if (data.liked) {
          capture("log_liked", { log_id: logId, log_owner_id: log.user.id });
        }
        showToast(data.liked ? "좋아요를 눌렀어요" : "좋아요를 취소했어요");
      } else {
        mutate(); // 롤백
      }
    } catch (error) {
      console.error("좋아요 실패:", error);
      mutate(); // 롤백
    }
  };

  const handleDeleteLog = async () => {
    if (!confirm("정말 이 일지를 삭제하시겠어요?")) return;

    try {
      const res = await fetch(`/api/training-logs/${logId}`, { method: "DELETE" });
      if (res.ok) {
        showToast("일지가 삭제되었어요");
        setTimeout(() => router.push("/"), 500);
      } else {
        showToast("삭제에 실패했어요");
      }
    } catch (error) {
      console.error("삭제 실패:", error);
      showToast("삭제에 실패했어요");
    }
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || submitting || !log) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-logs/${logId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment, mentions: commentMentions }),
      });

      if (res.ok) {
        const newComment = await res.json();
        capture("comment_posted", { log_id: logId, log_owner_id: log.user.id });
        mutate({ ...log, comments: [...log.comments, newComment] }, false);
        setComment("");
        setCommentMentions([]);
        showToast("댓글을 남겼어요");
      }
    } catch (error) {
      console.error("댓글 작성 실패:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentContent.trim() || !log) return;

    try {
      const res = await fetch(`/api/training-logs/${logId}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editCommentContent, mentions: editCommentMentions }),
      });

      if (res.ok) {
        const updated = await res.json();
        mutate(
          {
            ...log,
            comments: log.comments.map((c) =>
              c.id === commentId ? { ...c, content: updated.content, mentions: updated.mentions, updatedAt: updated.updatedAt } : c
            ),
          },
          false
        );
        setEditingCommentId(null);
        setEditCommentContent("");
        setEditCommentMentions([]);
        showToast("댓글을 수정했어요");
      }
    } catch (error) {
      console.error("댓글 수정 실패:", error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("댓글을 삭제하시겠어요?") || !log) return;

    try {
      const res = await fetch(`/api/training-logs/${logId}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        mutate({ ...log, comments: log.comments.filter((c) => c.id !== commentId) }, false);
        showToast("댓글이 삭제되었어요");
      }
    } catch (error) {
      console.error("댓글 삭제 실패:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 멘션 하이라이트 렌더링
  const renderMentionedText = (text: string) => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const mentionPattern = /@(\S+)/g;
    let match;
    let key = 0;

    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionName = match[1];
      const member = teamMembers.find((m) => m.name === mentionName);

      if (member) {
        // 멘션 이전 텍스트
        if (match.index > lastIndex) {
          parts.push(
            <span key={`text-${key++}`}>
              {text.substring(lastIndex, match.index)}
            </span>
          );
        }

        // 멘션 (하이라이트)
        parts.push(
          <span
            key={`mention-${key++}`}
            className="bg-team-100 text-team-700 px-1 rounded font-medium"
          >
            @{mentionName}
          </span>
        );

        lastIndex = match.index + match[0].length;
      }
    }

    // 남은 텍스트
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${key++}`}>
          {text.substring(lastIndex)}
        </span>
      );
    }

    return parts.length > 0 ? parts : text;
  };

  // loading.tsx와 동일한 스켈레톤 (이중 전환 방지)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white pb-28">
        <PageHeader title="운동 일지" left={<div className="w-5 h-5 bg-gray-100 rounded animate-pulse" />} sticky={false} />

        <div className="max-w-2xl mx-auto">
          {/* 이미지 영역 (4:3) */}
          <div className="bg-gray-50 w-full aspect-[4/3] animate-pulse" />

          {/* 작성자 정보 */}
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-3.5 w-16 bg-gray-200 rounded animate-pulse" />
                  <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
                </div>
                <div className="h-3.5 w-36 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
            {/* 제목 */}
            <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mt-3" />
          </div>

          {/* 본문 - 컨디션 + 섹션들 */}
          <div className="px-4 pt-2 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-team-50 rounded-full animate-pulse" />
              <div className="h-3.5 bg-gray-100 rounded w-2/3 animate-pulse" />
            </div>
            <div>
              <div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="space-y-2">
                <div className="h-3.5 w-full bg-gray-50 rounded animate-pulse" />
                <div className="h-3.5 w-5/6 bg-gray-50 rounded animate-pulse" />
                <div className="h-3.5 w-2/3 bg-gray-50 rounded animate-pulse" />
              </div>
            </div>
            <div>
              <div className="h-3.5 w-32 bg-gray-200 rounded animate-pulse mb-2" />
              <div className="space-y-2">
                <div className="h-3.5 w-full bg-gray-50 rounded animate-pulse" />
                <div className="h-3.5 w-3/4 bg-gray-50 rounded animate-pulse" />
              </div>
            </div>
          </div>

          {/* 좋아요/댓글 수 */}
          <div className="px-4 py-3 mt-4 flex items-center gap-6">
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-gray-100 rounded animate-pulse" />
              <div className="w-4 h-3 bg-gray-100 rounded animate-pulse" />
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 bg-gray-100 rounded animate-pulse" />
              <div className="w-4 h-3 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>

          {/* 댓글 영역 */}
          <div className="mt-2">
            <div className="px-4 py-3">
              <div className="h-3.5 w-16 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="px-4 py-6 text-center">
              <div className="h-3.5 w-40 bg-gray-50 rounded animate-pulse mx-auto" />
            </div>
          </div>
        </div>

        {/* 하단 고정 댓글 입력 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
          <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2 items-center">
            <div className="flex-1 h-[42px] bg-gray-50 border border-gray-200 rounded-lg animate-pulse" />
            <div className="h-9 w-14 bg-gray-100 rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">운동 일지를 찾을 수 없습니다</p>
        <Link href="/" className="text-team-500">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-28">
      <PageHeader
        title="운동 일지"
        left={<BackButton />}
        right={(isMyPost || isAdmin) ? (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="text-gray-400 hover:text-gray-600 p-1 active:scale-90 transition-transform touch-manipulation"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30 min-w-[120px]">
                  {isMyPost && (
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        router.push(`/write?edit=${logId}`);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      수정하기
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      handleDeleteLog();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-50"
                  >
                    삭제하기
                  </button>
                </div>
              </>
            )}
          </div>
        ) : undefined}
      />

      <main className="max-w-2xl mx-auto">
        {/* 이미지 */}
        {log.imageUrl && (
          <div className="bg-white">
            <img
              src={log.imageUrl}
              alt="운동 사진"
              className="w-full aspect-[4/3] object-cover"
              loading="eager"
            />
          </div>
        )}

        {/* 작성자 정보 */}
        <div className="bg-white p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
              {log.user.image ? (
                <Image
                  src={log.user.image}
                  alt={log.user.name || ""}
                  width={48}
                  height={48}
                  sizes="48px"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-gray-900">
                  {log.user.name || "익명"}
                </p>
                {(log.user.position || log.user.number != null) && (
                  <span className="text-xs text-gray-400">
                    {[log.user.position, log.user.number != null ? `${log.user.number}` : null].filter(Boolean).join(" ")}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <p className="text-sm text-gray-500">
                  {formatDate(log.trainingDate)} 운동
                </p>
                {isEdited(log.createdAt, log.updatedAt) && (
                  <span className="text-xs text-gray-400">(수정됨)</span>
                )}
              </div>
            </div>
          </div>

          {/* 제목 표시 - 팀 운동이면 팀 운동 제목, 개인 운동이면 입력한 제목 */}
          {(log.trainingEvent?.title || log.title) && (
            <h2 className="mt-3 text-lg font-semibold text-gray-900">
              {log.trainingEvent?.title || log.title}
            </h2>
          )}
        </div>

        {/* 운동 일지 본문 */}
        <div className="px-4 pt-2 space-y-5">
          {/* 컨디션 */}
          <div className="flex items-center gap-3">
            <ConditionBadge condition={log.condition} />
            <p className="text-sm text-gray-800 flex-1">{log.conditionReason}</p>
          </div>

          {/* 핵심 포인트 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">운동 핵심 포인트</h2>
            <p className="text-gray-700 text-sm whitespace-pre-wrap leading-7">{renderMentionedText(log.keyPoints)}</p>
          </div>

          {/* 개선점 */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-2">더 잘하기 위해서는?</h2>
            <p className="text-gray-700 text-sm whitespace-pre-wrap leading-7">{renderMentionedText(log.improvement)}</p>
          </div>
        </div>

        {/* 좋아요/댓글 수 */}
        <div className="px-4 py-3 mt-4 flex items-center gap-6">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 py-1 active:scale-90 transition-transform touch-manipulation"
          >
            {log.isLiked ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#D1D5DB" stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
            <span className="text-sm text-gray-400">
              {log._count.likes}
            </span>
          </button>
          <div className="flex items-center gap-1.5 text-gray-400">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm">{log.comments.length}</span>
          </div>
        </div>

        {/* 칭찬하기 배너 (다른 사람 글) / AI 코치 배너 (내 글) */}
        {!isMyPost ? (
          <div className="px-4 py-3">
            <Link
              href={`/locker/${log.user.id}`}
              className="block bg-gradient-to-r from-team-50 to-team-100 rounded-xl p-3.5 hover:from-team-100 hover:to-team-200 active:scale-[0.98] transition-all touch-manipulation"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🗃️</span>
                  <div>
                    <h3 className="text-gray-800 font-semibold text-sm">
                      {log.user.name}님에게 칭찬 쪽지 놓고 오기
                    </h3>
                    <p className="text-gray-600 text-xs">
                      락커에 칭찬 쪽지를 남겨보세요!
                    </p>
                  </div>
                </div>
                <span className="text-gray-600 text-2xl">&rsaquo;</span>
              </div>
            </Link>
          </div>
        ) : (
          <div className="px-4 py-3">
            <button
              onClick={() => setIsInsightOpen(true)}
              className="w-full bg-gradient-to-r from-team-50 to-team-100 rounded-xl p-3.5 hover:from-team-100 hover:to-team-200 active:scale-[0.98] transition-all touch-manipulation text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">✨</span>
                  <div>
                    <h3 className="text-gray-800 font-semibold text-sm">
                      AI 코치 피드백 보기
                    </h3>
                    <p className="text-gray-600 text-xs">
                      내 훈련 데이터를 분석해드려요
                    </p>
                  </div>
                </div>
                <span className="text-gray-600 text-2xl">&rsaquo;</span>
              </div>
            </button>
          </div>
        )}

        {/* 댓글 목록 */}
        <div className="mt-2">
          <h3 className="px-4 py-3 text-sm font-medium text-gray-500">
            댓글 {log.comments.length}개
          </h3>

          {log.comments.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-gray-500">
              첫 번째 댓글을 남겨보세요!
            </p>
          ) : (
            <div className="divide-y divide-gray-100">
              {log.comments.map((c) => {
                const isMyComment = session?.user?.id === c.user.id;
                const canDelete = isMyComment || isAdmin;

                return (
                  <div key={c.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {c.user.image ? (
                          <Image
                            src={c.user.image}
                            alt={c.user.name || ""}
                            width={32}
                            height={32}
                            sizes="32px"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                              <circle cx="12" cy="7" r="4" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 text-sm">
                            {c.user.name || "익명"}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatTime(c.createdAt)}
                          </span>
                          {isEdited(c.createdAt, c.updatedAt) && (
                            <span className="text-xs text-gray-400">(수정됨)</span>
                          )}
                        </div>

                        {editingCommentId === c.id ? (
                          <div className="mt-1.5">
                            <MentionTextarea
                              value={editCommentContent}
                              onChange={(val, mentions) => {
                                setEditCommentContent(val);
                                setEditCommentMentions(mentions);
                              }}
                              teamMembers={teamMembers}
                              placeholder="댓글 수정..."
                              rows={2}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
                            />
                            <div className="flex gap-2 mt-1.5">
                              <button
                                onClick={() => handleEditComment(c.id)}
                                className="text-xs text-team-500 font-medium"
                              >
                                저장
                              </button>
                              <button
                                onClick={() => {
                                  setEditingCommentId(null);
                                  setEditCommentContent("");
                                  setEditCommentMentions([]);
                                }}
                                className="text-xs text-gray-400"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-gray-800 mt-1">
                              {renderMentionedText(c.content)}
                            </p>
                            {(isMyComment || canDelete) && (
                              <div className="flex items-center gap-3 mt-1.5">
                                {isMyComment && (
                                  <button
                                    onClick={() => {
                                      setEditingCommentId(c.id);
                                      setEditCommentContent(c.content);
                                      setEditCommentMentions(c.mentions || []);
                                    }}
                                    className="text-xs text-gray-400 hover:text-gray-600"
                                  >
                                    수정
                                  </button>
                                )}
                                {canDelete && (
                                  <>
                                    {isMyComment && <span className="text-xs text-gray-300">·</span>}
                                    <button
                                      onClick={() => handleDeleteComment(c.id)}
                                      className="text-xs text-gray-400 hover:text-red-500"
                                    >
                                      삭제
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* 댓글 입력 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <form
          onSubmit={handleComment}
          className="max-w-2xl mx-auto px-4 py-3 flex gap-2 items-center"
        >
          <div className="flex-1">
            <MentionTextarea
              value={comment}
              onChange={(val, mentions) => {
                setComment(val);
                setCommentMentions(mentions);
              }}
              teamMembers={teamMembers}
              placeholder="댓글을 입력하세요..."
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
              dropdownPosition="top"
            />
          </div>
          <button
            type="submit"
            disabled={!comment.trim() || submitting}
            className="h-9 px-4 bg-team-500 text-white rounded-full text-xs font-medium disabled:opacity-50 flex-shrink-0 active:scale-95 transition-transform touch-manipulation"
          >
            {submitting ? "..." : "등록"}
          </button>
        </form>
      </div>

      {/* 토스트 */}
      <Toast
        message={toast?.message || ""}
        visible={!!toast}
        onHide={hideToast}
      />

      {/* AI 코치 인사이트 모달 */}
      <AIInsightModal
        isOpen={isInsightOpen}
        onClose={() => setIsInsightOpen(false)}
        type="unified"
        userName={session?.user?.name || undefined}
      />
    </div>
  );
}
