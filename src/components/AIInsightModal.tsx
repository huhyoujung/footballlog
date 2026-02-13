"use client";

import { useEffect, useState } from "react";
import { X, Sparkles, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface AIInsightModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "personal" | "team" | "unified";
}

export default function AIInsightModal({
  isOpen,
  onClose,
  type,
}: AIInsightModalProps) {
  const [loading, setLoading] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // 모달 닫힐 때 상태 초기화
      setInsight(null);
      setError(null);
      setCached(false);
      return;
    }

    // 모달이 열릴 때 인사이트 생성/조회
    const fetchInsight = async () => {
      setLoading(true);
      setError(null);

      try {
        const endpoint = type === "unified"
          ? "/api/insights/unified"
          : type === "personal"
            ? "/api/insights/personal"
            : "/api/insights/team";

        const res = await fetch(endpoint, {
          method: "POST",
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "인사이트를 불러올 수 없습니다");
        }

        const data = await res.json();
        setInsight(data.insight.content);
        setCached(data.cached);
      } catch (err) {
        setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      } finally {
        setLoading(false);
      }
    };

    fetchInsight();
  }, [isOpen, type]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl max-w-2xl w-full max-h-[85vh] overflow-hidden shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-team-500 to-team-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-full">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-lg">
                {type === "unified"
                  ? "AI 코치 인사이트"
                  : type === "personal"
                    ? "나의 성장 인사이트"
                    : "팀 인사이트"}
              </h2>
              {cached && (
                <p className="text-white/80 text-xs">오늘 이미 생성된 인사이트</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(85vh-80px)]">
          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-team-500 animate-spin mb-4" />
              <p className="text-gray-600 text-sm">
                AI 코치가 분석 중입니다...
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {insight && !loading && (
            <div className="prose prose-sm max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg font-bold text-gray-800 mt-3 mb-2">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-semibold text-gray-700 mt-2 mb-1">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="text-gray-700 leading-relaxed mb-3">
                      {children}
                    </p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc list-inside space-y-1 mb-3">
                      {children}
                    </ul>
                  ),
                  li: ({ children }) => (
                    <li className="text-gray-700">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-team-600">
                      {children}
                    </strong>
                  ),
                }}
              >
                {insight}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
