"use client";

import PolaroidStack from "./PolaroidStack";
import PolaroidCarousel from "./PolaroidCarousel";
import type { TrainingLog } from "@/types/training";

interface Props {
  logs: TrainingLog[];
  displayDate: string;
  isExpanded: boolean;
  isExpanding?: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onLikeToggle: (logId: string) => void;
}

export default function PolaroidDateGroup({
  logs,
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
          displayDate={displayDate}
          onClick={onExpand}
          isExpanding={isExpanding}
        />
      )}
    </div>
  );
}
