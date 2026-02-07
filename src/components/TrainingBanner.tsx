"use client";

import Link from "next/link";
import type { TrainingEventSummary } from "@/types/training-event";

interface Props {
  event: TrainingEventSummary | null;
}

export default function TrainingBanner({ event }: Props) {
  if (!event) return null;

  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const rsvpLabel = event.myRsvp
    ? { ATTEND: "참석", ABSENT: "불참", LATE: "늦참" }[event.myRsvp]
    : "미응답";
  const rsvpColor = event.myRsvp
    ? { ATTEND: "bg-green-100 text-green-700", ABSENT: "bg-red-100 text-red-700", LATE: "bg-yellow-100 text-yellow-700" }[event.myRsvp]
    : "bg-gray-100 text-gray-500";

  return (
    <Link
      href={`/training/${event.id}`}
      className="block mx-4 my-3 bg-team-50 border border-team-100 rounded-xl p-3.5 hover:bg-team-100/50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            <span>⚽</span>
            <span className="truncate">{event.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
            <span>{dateStr}</span>
            <span>·</span>
            <span className="truncate">{event.location}</span>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${rsvpColor}`}>
          {rsvpLabel}
        </span>
      </div>
    </Link>
  );
}
