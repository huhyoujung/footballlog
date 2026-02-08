"use client";

import Link from "next/link";
import { getTimeUntilEvent } from "@/lib/timeUntil";

interface TrainingEvent {
  id: string;
  title: string | null;
  date: string;
  venue: { name: string } | null;
}

interface TrainingCheckInCardProps {
  event: TrainingEvent;
}

export default function TrainingCheckInCard({
  event,
}: TrainingCheckInCardProps) {
  const { message, isPast } = getTimeUntilEvent(event.date);
  const eventDate = new Date(event.date);
  const dateStr = `${eventDate.getMonth() + 1}/${eventDate.getDate()}(${
    ["일", "월", "화", "수", "목", "금", "토"][eventDate.getDay()]
  }) ${eventDate.getHours().toString().padStart(2, "0")}:${eventDate
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;

  return (
    <Link href={`/training/${event.id}`}>
      <div className="mx-auto max-w-md px-6 py-4 animate-fade-in">
        <div className="bg-gradient-to-br from-team-50 to-team-100 rounded-2xl shadow-lg p-6 border border-team-200 hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
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

          {/* 남은 시간 */}
          <div
            className={`text-center mb-6 py-3 px-4 rounded-lg ${
              isPast ? "bg-orange-50" : "bg-team-50"
            }`}
          >
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl">{isPast ? "⚠️" : "⏰"}</span>
              <div>
                <p
                  className={`text-lg font-bold ${
                    isPast ? "text-orange-600" : "text-team-700"
                  }`}
                >
                  {message}
                </p>
                {isPast && (
                  <p className="text-xs text-orange-600 mt-1">
                    지금 체크인하세요
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* CTA 버튼 */}
          <button className="w-full bg-team-500 hover:bg-team-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2">
            <span>📍</span>
            <span>체크인 하기</span>
          </button>
        </div>
      </div>
    </Link>
  );
}
