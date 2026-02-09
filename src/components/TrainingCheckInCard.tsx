"use client";

import { useState } from "react";
import { getTimeUntilEvent } from "@/lib/timeUntil";

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
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

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
    if (submitting || isCheckedIn) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${event.id}/check-in`, {
        method: "POST",
      });

      if (res.ok) {
        const now = new Date();
        const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        setCheckInTime(timeStr);
        setIsCheckedIn(true);

        onShowToast?.(timeStr + "에 체크인되었습니다");
        onCheckInSuccess?.();
      } else {
        const data = await res.json();
        onShowToast?.(data.error || "체크인에 실패했습니다");
      }
    } catch (error) {
      onShowToast?.("체크인에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelCheckIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!confirm("체크인을 취소하시겠습니까?")) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${event.id}/check-in`, {
        method: "DELETE",
      });

      if (res.ok) {
        setIsCheckedIn(false);
        setCheckInTime("");
        onShowToast?.("체크인이 취소되었습니다");
        onCheckInSuccess?.();
      } else {
        const data = await res.json();
        onShowToast?.(data.error || "취소에 실패했습니다");
      }
    } catch (error) {
      onShowToast?.("취소에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  // 체크인 완료 상태: 일반 카드
  if (isCheckedIn) {
    return (
      <div className="mx-auto max-w-md px-6 py-4 animate-fade-in">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl shadow-lg p-6 border border-green-200">
          {/* 체크 아이콘 + 타이틀 */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              className="text-green-600"
            >
              <path
                d="M20 6L9 17L4 12"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <h3 className="text-xl font-bold text-green-700">CHECK-IN</h3>
          </div>

          {/* 운동 정보 */}
          <div className="text-center mb-4 space-y-1">
            <p className="text-lg font-semibold text-gray-900">
              {event.title || "정기운동"}
            </p>
            <p className="text-sm text-gray-600">{dateStr}</p>
            {event.venue && (
              <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
                <span>📍</span>
                <span>{event.venue.name}</span>
              </p>
            )}
          </div>

          {/* 체크인 완료 상태 */}
          <div className="text-center mb-4">
            <div className="py-3 px-4 rounded-lg bg-white/70 mb-2">
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="text-lg font-bold text-green-600">
                    체크인 완료!
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {checkInTime} 도착
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* 취소 버튼 */}
          <button
            onClick={handleCancelCheckIn}
            disabled={submitting}
            className="w-full py-2.5 text-sm text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
          >
            체크인 취소
          </button>
        </div>
      </div>
    );
  }

  // 체크인 미완료 상태: 전체가 CTA 버튼
  return (
    <div className="mx-auto max-w-md px-6 py-4 animate-fade-in">
      <button
        onClick={handleCheckIn}
        disabled={submitting}
        className="w-full bg-gradient-to-br from-team-50 to-team-100 rounded-2xl shadow-lg p-6 border-2 border-team-300 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:border-team-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
      >
        {/* 체크 아이콘 + 타이틀 */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            className="text-team-600"
          >
            <path
              d="M20 6L9 17L4 12"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h3 className="text-xl font-bold text-team-700">CHECK-IN</h3>
        </div>

        {/* 운동 정보 */}
        <div className="text-center mb-4 space-y-1">
          <p className="text-lg font-semibold text-gray-900">
            {event.title || "정기운동"}
          </p>
          <p className="text-sm text-gray-600">{dateStr}</p>
          {event.venue && (
            <p className="text-sm text-gray-600 flex items-center justify-center gap-1">
              <span>📍</span>
              <span>{event.venue.name}</span>
            </p>
          )}
        </div>

        {/* 남은 시간 또는 지각 경고 */}
        <div
          className={`text-center py-4 px-4 rounded-xl ${
            isPast
              ? "bg-orange-100 border-2 border-orange-300"
              : "bg-white/70 border-2 border-team-200"
          }`}
        >
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-3xl">{isPast ? "⚠️" : "⏰"}</span>
            <p
              className={`text-xl font-bold ${
                isPast ? "text-orange-600" : "text-team-700"
              }`}
            >
              {message}
            </p>
          </div>
          <p className={`text-sm font-semibold ${isPast ? "text-orange-600" : "text-team-600"}`}>
            {isPast ? "👆 지금 바로 체크인하세요!" : "👆 탭하여 체크인"}
          </p>
        </div>

        {/* 로딩 중 표시 */}
        {submitting && (
          <div className="mt-4 text-center">
            <div className="inline-block animate-spin w-5 h-5 border-2 border-team-500 border-t-transparent rounded-full"></div>
            <p className="text-xs text-team-600 mt-2">체크인 중...</p>
          </div>
        )}
      </button>
    </div>
  );
}
