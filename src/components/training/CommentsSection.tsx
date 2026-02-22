"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import Image from "next/image";

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface Props {
  eventId: string;
}

export default function CommentsSection({ eventId }: Props) {
  const { data: session } = useSession();
  const [newComment, setNewComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: comments, mutate, isLoading } = useSWR<Comment[]>(
    `/api/training-events/${eventId}/comments`,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/training-events/${eventId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newComment.trim() }),
      });

      if (response.ok) {
        setNewComment("");
        mutate(); // 댓글 목록 새로고침
      } else {
        const error = await response.json();
        alert(error.error || "댓글 작성에 실패했습니다");
      }
    } catch (error) {
      console.error("Failed to post comment:", error);
      alert("댓글 작성에 실패했습니다");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;

    try {
      const response = await fetch(
        `/api/training-events/${eventId}/comments/${commentId}`,
        {
          method: "DELETE",
        }
      );

      if (response.ok) {
        mutate(); // 댓글 목록 새로고침
      } else {
        const error = await response.json();
        alert(error.error || "댓글 삭제에 실패했습니다");
      }
    } catch (error) {
      console.error("Failed to delete comment:", error);
      alert("댓글 삭제에 실패했습니다");
    }
  };

  const getRelativeTime = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMinutes < 1) return "방금 전";
    if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
    if (diffInHours < 24) return `${diffInHours}시간 전`;
    if (diffInDays < 7) return `${diffInDays}일 전`;
    return date.toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">댓글</h2>
        <p className="text-sm text-gray-500 text-center py-8">불러오는 중...</p>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="bg-white rounded-xl p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        댓글 <span className="text-team-600">({comments?.length || 0})</span>
      </h2>

      {/* 댓글 작성 폼 */}
      {session && (
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-3">
            {session.user?.image && (
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                  <Image
                    src={session.user.image}
                    alt={session.user.name || "사용자"}
                    width={32}
                    height={32}
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="댓글을 입력하세요"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
                rows={3}
              />
              <div className="flex justify-end mt-2">
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmitting}
                  className="px-4 py-2 bg-team-500 text-white rounded-lg text-sm font-medium hover:bg-team-600 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "작성 중..." : "댓글 작성"}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* 댓글 목록 */}
      {comments && comments.length > 0 ? (
        <div className="space-y-4">
          {comments.map((comment) => (
            <div key={comment.id} className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                  {comment.author.image ? (
                    <Image
                      src={comment.author.image}
                      alt={comment.author.name || "사용자"}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs font-medium text-gray-500">
                      {(comment.author.name || "?")[0]}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">
                    {comment.author.name || "알 수 없음"}
                  </span>
                  <span className="text-xs text-gray-400">
                    {getRelativeTime(comment.createdAt)}
                  </span>
                  {(session?.user?.id === comment.authorId || isAdmin) && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors ml-auto"
                    >
                      삭제
                    </button>
                  )}
                </div>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
