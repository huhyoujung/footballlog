"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import PolaroidCard from "@/components/PolaroidCard";
import type { TrainingLog } from "@/types/training";

interface Props {
  eventId: string;
  eventTime?: string | null;
  eventDate: string;
}

export default function TrainingLogsSection({ eventId, eventTime, eventDate }: Props) {
  const [likedLogs, setLikedLogs] = useState<Set<string>>(new Set());

  const { data: logs, isLoading } = useSWR<TrainingLog[]>(
    `/api/training-events/${eventId}/logs`,
    fetcher,
    {
      revalidateOnFocus: false,
    }
  );

  // 운동 시간이 지났는지 확인
  const isEventTimePassed = () => {
    if (!eventTime) return true; // 시간이 없으면 항상 표시

    const now = new Date();
    const eventDateTime = new Date(`${eventDate}T${eventTime}`);
    return now >= eventDateTime;
  };

  const handleLikeToggle = (logId: string) => {
    setLikedLogs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // 운동 시간 전이면 아예 표시 안 함
  if (!isEventTimePassed()) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-4">운동일지</h2>
        <p className="text-sm text-gray-500 text-center py-8">불러오는 중...</p>
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl p-6">
      <h2 className="text-base font-semibold text-gray-900 mb-4">
        운동일지 <span className="text-team-600">({logs.length})</span>
      </h2>
      <div className="space-y-4">
        {logs.map((log) => (
          <PolaroidCard
            key={log.id}
            log={log}
            variant="full"
            onLikeToggle={() => handleLikeToggle(log.id)}
          />
        ))}
      </div>
    </div>
  );
}
