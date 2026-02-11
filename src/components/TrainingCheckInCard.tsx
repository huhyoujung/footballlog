"use client";

import { useState } from "react";
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

  const { message, isPast } = getTimeUntilEvent(event.date);
  const eventDate = new Date(event.date);
  const dateStr = `${eventDate.getMonth() + 1}/${eventDate.getDate()}(${
    ["일", "월", "화", "수", "목", "금", "토"][eventDate.getDay()]
  }) ${eventDate.getHours().toString().padStart(2, "0")}:${eventDate
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  const handleCheckIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);

    // Optimistic UI: 즉시 페이지 이동
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    router.push(`/training/${event.id}`);

    // 백그라운드에서 API 호출
    try {
      const res = await fetch(`/api/training-events/${event.id}/check-in`, {
        method: "POST",
      });

      if (res.ok) {
        playSound("whistle"); // 🎵 체크인 성공 - 휘슬 소리!
        onShowToast?.(timeStr + "에 체크인되었습니다");
        onCheckInSuccess?.();
      } else {
        const data = await res.json();
        onShowToast?.(data.error || "체크인에 실패했습니다");
      }
    } catch (error) {
      onShowToast?.("체크인에 실패했습니다");
    }
  };

  // 명확한 버튼이 있는 체크인 카드
  return (
    <div className="flex-shrink-0 w-[280px] bg-team-500 rounded-2xl p-4 pt-6 shadow-md">
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
        className="w-full bg-white text-team-600 font-bold py-3.5 px-4 rounded-xl hover:bg-white/95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
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
