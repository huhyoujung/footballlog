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
      prefetch={true}
      className="block flex-shrink-0 w-[280px]"
    >
      <div className="bg-gradient-to-br from-team-500 to-team-600 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-bold text-white flex-1">{event.title}</h3>
          <span className="px-2.5 py-1 bg-white/20 text-white text-xs font-medium rounded-full flex-shrink-0">
            {event._count.rsvps}명 응답
          </span>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-white/90">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="text-sm">{dateStr}</span>
          </div>
          <div className="flex items-center gap-2 text-white/90">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span className="text-sm">{event.location}</span>
          </div>
        </div>

        <div className="pt-3 border-t border-white/20 flex items-center justify-between">
          <span className="text-white/70 text-xs">마감: {deadlineStr}</span>
          <span className="text-white font-semibold text-sm">참석 여부 응답하기 →</span>
        </div>
      </div>
    </Link>
  );
}
