"use client";

import PolaroidStack from "./PolaroidStack";
import PolaroidCarousel from "./PolaroidCarousel";
import type { TrainingLog } from "@/types/training";

interface Props {
  logs: TrainingLog[];
  displayDate: string;
  isExpanded: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onLikeToggle: (logId: string) => void;
}

export default function PolaroidDateGroup({
  logs,
  displayDate,
  isExpanded,
  onExpand,
  onCollapse,
  onLikeToggle,
}: Props) {
  if (isExpanded) {
    return (
      <PolaroidCarousel
        logs={logs}
        displayDate={displayDate}
        onCollapse={onCollapse}
        onLikeToggle={onLikeToggle}
      />
    );
  }

  return (
    <PolaroidStack
      logs={logs}
      displayDate={displayDate}
      onClick={onExpand}
    />
  );
}
