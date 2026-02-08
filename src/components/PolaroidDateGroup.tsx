"use client";

import PolaroidStack from "./PolaroidStack";
import PolaroidCarousel from "./PolaroidCarousel";
import type { TrainingLog } from "@/types/training";

interface Props {
  logs: TrainingLog[];
  date: string; // 실제 날짜 (YYYY-MM-DD)
  displayDate: string;
  isExpanded: boolean;
  isExpanding?: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onLikeToggle: (logId: string) => void;
}

export default function PolaroidDateGroup({
  logs,
  date,
  displayDate,
  isExpanded,
  isExpanding,
  onExpand,
  onCollapse,
  onLikeToggle,
}: Props) {
  return (
    <div className="transition-all duration-300 ease-out">
      {isExpanded ? (
        <PolaroidCarousel
          logs={logs}
          displayDate={displayDate}
          onCollapse={onCollapse}
          onLikeToggle={onLikeToggle}
        />
      ) : (
        <PolaroidStack
          logs={logs}
          date={date}
          displayDate={displayDate}
          onClick={onExpand}
          isExpanding={isExpanding}
        />
      )}
    </div>
  );
}
