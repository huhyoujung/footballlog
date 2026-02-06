"use client";

import { useState, useEffect, use } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import ConditionBadge from "@/components/ConditionBadge";
import Toast from "@/components/Toast";
import { useToast } from "@/lib/useToast";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface TrainingLog {
  id: string;
  trainingDate: string;
  condition: number;
  conditionReason: string;
  keyPoints: string;
  improvement: string;
  imageUrl: string | null;
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

export default function LogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { data: session } = useSession();
  const [log, setLog] = useState<TrainingLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const { toast, showToast, hideToast } = useToast();

  const isMyPost = log && session?.user?.id === log.user.id;
  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    fetchLog();
  }, [id]);

  const fetchLog = async () => {
    try {
      const res = await fetch(`/api/training-logs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLog(data);
      }
    } catch (error) {
      console.error("로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!log) return;

    const wasLiked = log.isLiked;
    const prevCount = log._count.likes;
    setLog({
      ...log,
      isLiked: !wasLiked,
      _count: { ...log._count, likes: wasLiked ? prevCount - 1 : prevCount + 1 },
    });

    try {
      const res = await fetch(`/api/training-logs/${id}/likes`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setLog((prev) =>
          prev
            ? {
                ...prev,
                isLiked: data.liked,
                _count: { ...prev._count, likes: data.likeCount },
              }
            : null
        );
        showToast(data.liked ? "좋아요를 눌렀어요" : "좋아요를 취소했어요");
      } else {
        setLog((prev) =>
          prev
            ? { ...prev, isLiked: wasLiked, _count: { ...prev._count, likes: prevCount } }
            : null
        );
      }
    } catch (error) {
      console.error("좋아요 실패:", error);
      setLog((prev) =>
        prev
          ? { ...prev, isLiked: wasLiked, _count: { ...prev._count, likes: prevCount } }
          : null
      );
    }
  };

  const handleDeleteLog = async () => {
    if (!confirm("정말 이 일지를 삭제하시겠어요?")) return;

    try {
      const res = await fetch(`/api/training-logs/${id}`, { method: "DELETE" });
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
    if (!comment.trim() || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-logs/${id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment }),
      });

      if (res.ok) {
        const newComment = await res.json();
        setLog((prev) =>
          prev ? { ...prev, comments: [...prev.comments, newComment] } : null
        );
        setComment("");
        showToast("댓글을 남겼어요");
      }
    } catch (error) {
      console.error("댓글 작성 실패:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentContent.trim()) return;

    try {
      const res = await fetch(`/api/training-logs/${id}/comments/${commentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editCommentContent }),
      });

      if (res.ok) {
        const updated = await res.json();
        setLog((prev) =>
          prev
            ? {
                ...prev,
                comments: prev.comments.map((c) =>
                  c.id === commentId ? { ...c, content: updated.content, updatedAt: updated.updatedAt } : c
                ),
              }
            : null
        );
        setEditingCommentId(null);
        setEditCommentContent("");
        showToast("댓글을 수정했어요");
      }
    } catch (error) {
      console.error("댓글 수정 실패:", error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("댓글을 삭제하시겠어요?")) return;

    try {
      const res = await fetch(`/api/training-logs/${id}/comments/${commentId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setLog((prev) =>
          prev
            ? { ...prev, comments: prev.comments.filter((c) => c.id !== commentId) }
            : null
        );
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500"></div>
      </div>
    );
  }

  if (!log) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
        <p className="text-gray-500 mb-4">운동 일지를 찾을 수 없습니다</p>
        <Link href="/" className="text-team-500">
          홈으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center">
            <Link href="/" className="text-gray-500 hover:text-gray-700 mr-4">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold text-gray-900">운동 일지</h1>
          </div>
          {(isMyPost || isAdmin) && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="text-gray-400 hover:text-gray-600 p-1"
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
                          router.push(`/write?edit=${id}`);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        수정하기
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleDeleteLog();
                      }}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-gray-50"
                    >
                      삭제하기
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto">
        {/* 이미지 */}
        {log.imageUrl && (
          <div className="bg-white">
            <img
              src={log.imageUrl}
              alt="운동 사진"
              className="w-full aspect-[4/3] object-cover"
            />
          </div>
        )}

        {/* 작성자 정보 */}
        <div className="bg-white p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
            {log.user.image ? (
              <Image
                src={log.user.image}
                alt={log.user.name || ""}
                width={48}
                height={48}
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
              <p className="font-medium text-gray-900">
                {log.user.name || "익명"}
              </p>
              {(log.user.position || log.user.number != null) && (
                <span className="text-xs text-gray-400">
                  {[log.user.position, log.user.number != null ? `#${log.user.number}` : null].filter(Boolean).join(" ")}
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

        {/* 컨디션 */}
        <div className="bg-white p-4 border-t border-gray-100">
          <div className="flex items-center gap-4 mb-3">
            <ConditionBadge condition={log.condition} />
            <p className="text-gray-700 flex-1">{log.conditionReason}</p>
          </div>
        </div>

        {/* 핵심 포인트 */}
        <div className="bg-white p-4 border-t border-gray-100">
          <h2 className="text-sm font-medium text-team-600 mb-2 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            운동 핵심 포인트
          </h2>
          <p className="text-gray-800 whitespace-pre-wrap">{log.keyPoints}</p>
        </div>

        {/* 개선점 */}
        <div className="bg-white p-4 border-t border-gray-100">
          <h2 className="text-sm font-medium text-blue-700 mb-2 flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </svg>
            더 잘하기 위해서는?
          </h2>
          <p className="text-gray-800 whitespace-pre-wrap">{log.improvement}</p>
        </div>

        {/* 좋아요/댓글 수 */}
        <div className="bg-white p-4 border-t border-gray-100 flex items-center gap-6">
          <button
            onClick={handleLike}
            className="flex items-center gap-2 py-1"
          >
            {log.isLiked ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#EF4444" stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
            <span className={log.isLiked ? "text-red-500" : "text-gray-500"}>
              {log._count.likes}
            </span>
          </button>
          <div className="flex items-center gap-2 text-gray-500">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span>{log.comments.length}</span>
          </div>
        </div>

        {/* 댓글 목록 */}
        <div className="bg-white border-t border-gray-200">
          <h3 className="px-4 py-3 font-medium text-gray-900 border-b border-gray-100">
            댓글 {log.comments.length}개
          </h3>

          {log.comments.length === 0 ? (
            <p className="px-4 py-6 text-center text-gray-500">
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
                            <input
                              type="text"
                              value={editCommentContent}
                              onChange={(e) => setEditCommentContent(e.target.value)}
                              className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                              autoFocus
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
                                }}
                                className="text-xs text-gray-400"
                              >
                                취소
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-gray-700 text-sm mt-1">
                              {c.content}
                            </p>
                            {(isMyComment || canDelete) && (
                              <div className="flex items-center gap-3 mt-1.5">
                                {isMyComment && (
                                  <button
                                    onClick={() => {
                                      setEditingCommentId(c.id);
                                      setEditCommentContent(c.content);
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
          className="max-w-lg mx-auto px-4 py-3 flex gap-2"
        >
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="댓글을 입력하세요..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!comment.trim() || submitting}
            className="px-4 py-2 bg-team-500 text-white rounded-full font-medium disabled:opacity-50"
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
    </div>
  );
}
