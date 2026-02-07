"use client";

import Link from "next/link";
import type { TrainingEventSummary } from "@/types/training-event";

interface Props {
  event: TrainingEventSummary;
}

export default function TrainingInviteCard({ event }: Props) {
  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const deadlineStr = new Date(event.rsvpDeadline).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/training/${event.id}`}
      className="block mx-4 my-3 invite-float"
    >
      <div className="relative bg-white rounded-2xl overflow-hidden border-2 border-team-200" style={{ boxShadow: '0 4px 20px rgba(150, 123, 93, 0.15)' }}>
        {/* 상단 장식 바 */}
        <div className="bg-team-500 px-5 py-2.5 flex items-center justify-between">
          <span className="text-white text-xs font-medium tracking-wider uppercase">INVITATION</span>
          <span className="text-white/70 text-[10px]">응답 대기중</span>
        </div>

        {/* 본문 */}
        <div className="px-5 py-4">
          <h3 className="text-base font-bold text-gray-900">{event.title}</h3>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="w-4 text-center">&#9917;</span>
              <span>{dateStr}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-700">
              <span className="w-4 text-center text-xs">&#128205;</span>
              <span>{event.location}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-4 text-center">&#9200;</span>
              <span>마감: {deadlineStr}</span>
            </div>
          </div>

          {/* 응답 현황 */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-xs text-gray-400">{event._count.rsvps}명 응답 완료</span>
          </div>

          {/* CTA */}
          <div className="mt-3 bg-team-50 rounded-xl py-2.5 text-center">
            <span className="text-sm font-semibold text-team-600">참석 여부를 알려주세요</span>
          </div>
        </div>

        {/* 우표 장식 */}
        <div className="absolute top-3 right-4 w-8 h-10 border border-dashed border-white/50 rounded-sm flex items-center justify-center">
          <span className="text-lg">&#9917;</span>
        </div>
      </div>
    </Link>
  );
}
