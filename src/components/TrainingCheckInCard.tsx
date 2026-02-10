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
      <div className="mx-auto max-w-md px-6 py-3 animate-fade-in">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          {/* 상단: 체크인 완료 상태 */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-green-50 rounded-full flex items-center justify-center">
                <svg
                  width="16"
                  height="16"
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
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">체크인 완료</p>
                <p className="text-xs text-gray-500">{checkInTime} 도착</p>
              </div>
            </div>
            <button
              onClick={handleCancelCheckIn}
              disabled={submitting}
              className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              취소
            </button>
          </div>

          {/* 하단: 운동 정보 */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-900">
              {event.title || "정기운동"}
            </p>
            <div className="flex items-center gap-3 text-xs text-gray-500">
              <span>{dateStr}</span>
              {event.venue && (
                <>
                  <span>·</span>
                  <span>{event.venue.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 체크인 미완료 상태: 전체가 CTA 버튼
  return (
    <div className="mx-auto max-w-md px-6 py-3 animate-fade-in">
      <button
        onClick={handleCheckIn}
        disabled={submitting}
        className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 transition-all duration-200 hover:shadow-md hover:border-team-300 active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* 상단: 운동 정보 */}
        <div className="space-y-1 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-team-50 rounded-full flex items-center justify-center flex-shrink-0">
              <svg
                width="12"
                height="12"
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
            </div>
            <p className="text-sm font-semibold text-gray-900">
              {event.title || "정기운동"}
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500 ml-8">
            <span>{dateStr}</span>
            {event.venue && (
              <>
                <span>·</span>
                <span>{event.venue.name}</span>
              </>
            )}
          </div>
        </div>

        {/* 하단: 남은 시간 또는 지각 경고 */}
        <div
          className={`flex items-center justify-between py-2.5 px-3 rounded-lg ${
            isPast
              ? "bg-orange-50 border border-orange-200"
              : "bg-team-50 border border-team-200"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-lg">{isPast ? "⚠️" : "⏰"}</span>
            <div className="text-left">
              <p
                className={`text-sm font-semibold ${
                  isPast ? "text-orange-700" : "text-team-700"
                }`}
              >
                {message}
              </p>
              <p className={`text-xs ${isPast ? "text-orange-600" : "text-team-600"}`}>
                {isPast ? "지금 바로 체크인하세요" : "탭하여 체크인"}
              </p>
            </div>
          </div>
          {submitting && (
            <div className="inline-block animate-spin w-4 h-4 border-2 border-team-500 border-t-transparent rounded-full"></div>
          )}
        </div>
      </button>
    </div>
  );
}
