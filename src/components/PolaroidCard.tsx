"use client";

import Link from "next/link";
import ConditionBadge from "./ConditionBadge";
import { getConditionBgColor, getConditionTextColor } from "@/lib/condition";
import type { TrainingLog } from "@/types/training";

interface Props {
  log: TrainingLog;
  variant: "stack" | "full";
  onLikeToggle?: (logId: string) => void;
}

export default function PolaroidCard({ log, variant, onLikeToggle }: Props) {
  if (variant === "stack") {
    return (
      <div className="w-36 h-44 bg-white rounded-sm p-1.5 pb-4" style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }}>
        {log.imageUrl ? (
          <img
            src={log.imageUrl}
            alt=""
            className="w-full h-full object-cover rounded-sm"
          />
        ) : (
          <div className="w-full h-full rounded-sm bg-team-50" />
        )}
      </div>
    );
  }

  // variant === "full" — large polaroid, tap to go to detail
  return (
    <Link href={`/log/${log.id}`} className="block">
      <div className="w-64 bg-white rounded-sm p-2 pb-5" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.13)' }}>
        {/* 사진 또는 컨디션 컬러 배경 */}
        {log.imageUrl ? (
          <img
            src={log.imageUrl}
            alt="운동 사진"
            className="w-full aspect-[3/4] object-cover rounded-sm"
          />
        ) : (
          <div
            className={`w-full aspect-[3/4] rounded-sm flex flex-col items-center justify-center ${getConditionBgColor(log.condition)}`}
          >
            <svg
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="currentColor"
              stroke="none"
              className={getConditionTextColor(log.condition)}
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span
              className={`text-3xl font-bold mt-1 ${getConditionTextColor(log.condition)}`}
            >
              {log.condition}
            </span>
          </div>
        )}

        {/* 하단: 작성자 + 에너지 레벨 */}
        <div className="mt-2 flex items-center justify-between px-0.5">
          <span className="font-medium text-sm text-gray-900 truncate">
            {log.user.name || "익명"}
          </span>
          <ConditionBadge condition={log.condition} />
        </div>
      </div>
    </Link>
  );
}
