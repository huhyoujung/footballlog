"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import Toast from "@/components/Toast";
import { useToast } from "@/lib/useToast";

const FEEDBACK_TYPES = [
  { value: "FEATURE_REQUEST", label: "기능 제안", emoji: "💡" },
  { value: "BUG_REPORT", label: "버그 신고", emoji: "🐛" },
  { value: "IMPROVEMENT", label: "개선 제안", emoji: "✨" },
  { value: "OTHER", label: "기타", emoji: "💬" },
];

export default function FeedbackPage() {
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
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <BackButton href="/my" />
          <h1 className="text-base font-semibold text-gray-900">피드백 보내기</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 안내 문구 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900">
              💌 여러분의 의견은 라커룸을 더 좋게 만드는 데 큰 도움이 됩니다.
              불편한 점이나 추가되었으면 하는 기능을 자유롭게 말씀해주세요!
            </p>
          </div>

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

        {/* 추가 안내 */}
        <div className="mt-8 p-4 bg-gray-100 rounded-xl">
          <p className="text-xs text-gray-600 leading-relaxed">
            ℹ️ 보내주신 피드백은 개발팀이 검토하여 서비스 개선에 반영합니다.
            개별 답변은 어려울 수 있지만, 모든 의견은 소중히 읽고 있습니다.
          </p>
        </div>
      </main>

      {/* Toast */}
      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </div>
  );
}
