"use client";

import PolaroidStack from "./PolaroidStack";
import PolaroidCarousel from "./PolaroidCarousel";
import type { TrainingLog } from "@/types/training";

interface LockerNote {
  id: string;
  content: string;
  color: string;
  rotation: number;
  positionX: number;
  positionY: number;
  tags: string[];
  createdAt: string;
  isAnonymous: boolean;
  recipient: {
    id: string;
    name: string | null;
  };
  author: {
    id: string;
    name: string | null;
  };
  trainingLog?: {
    trainingDate: string;
  } | null;
  trainingEvent?: {
    date: string;
  } | null;
}

interface Props {
  logs: TrainingLog[];
  date: string; // 실제 날짜 (YYYY-MM-DD)
  displayDate: string;
  isExpanded: boolean;
  isExpanding?: boolean;
  onExpand: () => void;
  onCollapse: () => void;
  onLikeToggle: (logId: string) => void;
  notes?: LockerNote[];
  hideCount?: boolean;
  disableNoteOpen?: boolean;
  currentUserId?: string;
  mvpEventId?: string;
  prioritizeFirst?: boolean;
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
  notes = [],
  hideCount = false,
  disableNoteOpen = false,
  currentUserId,
  mvpEventId,
  prioritizeFirst,
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
          notes={notes}
          hideCount={hideCount}
          disableNoteOpen={disableNoteOpen}
          currentUserId={currentUserId}
          mvpEventId={mvpEventId}
          prioritizeFirst={prioritizeFirst}
        />
      )}
    </div>
  );
}
