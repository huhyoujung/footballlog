"use client";

import PolaroidCard from "./PolaroidCard";
import type { TrainingLog } from "@/types/training";

interface Props {
  logs: TrainingLog[];
  displayDate: string;
  onCollapse: () => void;
  onLikeToggle: (logId: string) => void;
}

export default function PolaroidCarousel({
  logs,
  displayDate,
  onCollapse,
  onLikeToggle,
}: Props) {
  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          onClick={onCollapse}
          className="text-gray-400 hover:text-gray-600 p-1"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <span className="text-sm font-semibold text-team-500">
          {displayDate}
        </span>
      </div>

      {/* 가로 스크롤 캐러셀 */}
      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 pb-4 scrollbar-hide">
        {logs.map((log, index) => (
          <div
            key={log.id}
            className="snap-center flex-shrink-0 polaroid-enter"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <PolaroidCard
              log={log}
              variant="full"
              onLikeToggle={onLikeToggle}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
