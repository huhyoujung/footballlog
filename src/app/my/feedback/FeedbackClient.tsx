// 피드백 보내기 - 클라이언트 컴포넌트 (폼 입력 및 제출)
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";
import Toast from "@/components/Toast";
import { useToast } from "@/lib/useToast";

const FEEDBACK_TYPES = [
  { value: "FEATURE_REQUEST", label: "기능 제안", emoji: "💡" },
  { value: "BUG_REPORT", label: "버그 신고", emoji: "🐛" },
  { value: "IMPROVEMENT", label: "개선 제안", emoji: "✨" },
  { value: "OTHER", label: "기타", emoji: "💬" },
];

export default function FeedbackClient({ userName }: { userName: string }) {
  const router = useRouter();
  const { toast, showToast, hideToast } = useToast();
  const [type, setType] = useState("FEATURE_REQUEST");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      showToast("제목을 입력해주세요");
      return;
    }

    if (!content.trim()) {
      showToast("내용을 입력해주세요");
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title, content }),
      });

      if (res.ok) {
        showToast("피드백이 전송되었습니다! 감사합니다 🙏");
        setTimeout(() => {
          router.push("/my");
        }, 1500);
      } else {
        showToast("피드백 전송에 실패했습니다");
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Failed to submit feedback:", error);
      showToast("피드백 전송에 실패했습니다");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <PageHeader title="피드백 보내기" left={<BackButton href="/my" />} className="!z-20" />

      <main className="max-w-2xl mx-auto p-4">
        {/* 인사 영역 */}
        <div className="mt-2 mb-6 text-center">
          <p className="text-lg font-semibold text-gray-900">
            {userName}님, 안녕하세요!
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {userName}님이 더 성장할 수 있도록 함께하겠습니다.
          </p>
          <p className="text-sm text-gray-500">
            불편한 점이나 원하는 기능을 자유롭게 알려주세요.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 유형 선택 */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-3">
              유형
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FEEDBACK_TYPES.map((feedbackType) => (
                <button
                  key={feedbackType.value}
                  type="button"
                  onClick={() => setType(feedbackType.value)}
                  className={`p-3 rounded-xl border-2 transition-all ${
                    type === feedbackType.value
                      ? "border-team-500 bg-team-50"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{feedbackType.emoji}</span>
                    <span
                      className={`text-sm font-medium ${
                        type === feedbackType.value
                          ? "text-team-700"
                          : "text-gray-700"
                      }`}
                    >
                      {feedbackType.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 제목 */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              제목
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder=""
              maxLength={100}
              className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-team-500 text-sm"
            />
            <p className="text-xs text-gray-500 text-right mt-1">
              {title.length}/100
            </p>
          </div>

          {/* 내용 */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              내용
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder=""
              rows={8}
              maxLength={1000}
              className="w-full p-3 border border-gray-300 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-team-500 text-sm"
            />
            <p className="text-xs text-gray-500 text-right mt-1">
              {content.length}/1000
            </p>
          </div>

          {/* 제출 버튼 */}
          <button
            type="submit"
            disabled={isSubmitting || !title.trim() || !content.trim()}
            className="w-full py-3.5 bg-team-600 text-white rounded-xl font-semibold hover:bg-team-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "전송 중..." : "피드백 보내기"}
          </button>
        </form>

        {/* 하단 안내 */}
        <p className="mt-6 mb-4 text-xs text-gray-400 text-center leading-relaxed">
          보내주신 의견은 모두 소중히 읽고 서비스 개선에 반영합니다.
        </p>
      </main>

      {/* Toast */}
      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </div>
  );
}
