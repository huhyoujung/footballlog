"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getTimeUntilEvent } from "@/lib/timeUntil";
import { useSound } from "@/lib/useSound";

interface TrainingEvent {
  id: string;
  title: string | null;
  date: string;
  venue: { name: string } | null;
}

interface TrainingCheckInCardProps {
  event: TrainingEvent;
  onCheckInSuccess?: () => void;
  onShowToast?: (message: string) => void;
}

export default function TrainingCheckInCard({
  event,
  onCheckInSuccess,
  onShowToast,
}: TrainingCheckInCardProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { playSound } = useSound();

  const { message } = getTimeUntilEvent(event.date);

  // Prefetch training detail page for faster navigation
  useEffect(() => {
    router.prefetch(`/training/${event.id}`);
  }, [router, event.id]);

  const handleCheckIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

    try {
      const res = await fetch(`/api/training-events/${event.id}/check-in`, {
        method: "POST",
      });

      if (res.ok) {
        playSound("whistle"); // 🎵 체크인 성공 - 휘슬 소리!
        onCheckInSuccess?.();
        // 체크인 완료 후 training 상세 페이지로 이동 (query param으로 토스트 전달)
        router.push(`/training/${event.id}?checkin=${encodeURIComponent(timeStr)}`);
      } else {
        const data = await res.json();
        onShowToast?.(data.error || "체크인에 실패했습니다");
        setSubmitting(false);
      }
    } catch (error) {
      onShowToast?.("체크인에 실패했습니다");
      setSubmitting(false);
    }
  };

  // 명확한 버튼이 있는 체크인 카드
  return (
    <div className="flex-shrink-0 w-[280px] bg-team-500 rounded-2xl p-4 pt-6 shadow-xl">
      {/* 상단: 운동 제목 */}
      <div className="text-center mb-3">
        <h3 className="text-base font-bold text-white">
          {event.title || "정기운동"}
        </h3>
      </div>

      {/* 시간 메시지 */}
      <div className="mb-6 text-center">
        <p className="text-sm text-white">
          {message}
        </p>
      </div>

      {/* 체크인 버튼 - 명확하고 큰 버튼 */}
      <button
        onClick={handleCheckIn}
        disabled={submitting}
        className="w-full bg-white text-team-600 font-bold py-3.5 px-4 rounded-xl hover:bg-white/95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm touch-manipulation"
      >
        {submitting ? (
          <div className="flex items-center justify-center gap-2">
            <div className="inline-block animate-spin w-4 h-4 border-2 border-team-600 border-t-transparent rounded-full"></div>
            <span>체크인 중...</span>
          </div>
        ) : (
          <span className="flex items-center justify-center gap-1">
            여기를 눌러 체크인
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </span>
        )}
      </button>
    </div>
  );
}
