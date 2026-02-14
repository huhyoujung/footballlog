"use client";

import Link from "next/link";
import Image from "next/image";
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
      <div className="w-36 h-44 bg-white rounded-sm p-1.5 pb-4 border border-gray-100/50" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)' }}>
        {log.imageUrl ? (
          <div className="w-full h-full relative rounded-sm overflow-hidden">
            <Image
              src={log.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="144px"
              unoptimized
            />
          </div>
        ) : (
          <div className="w-full h-full rounded-sm bg-team-50" />
        )}
      </div>
    );
  }

  // variant === "full" — large polaroid, tap to go to detail
  return (
    <Link href={`/log/${log.id}`} prefetch={true} className="block touch-manipulation active:scale-[0.98] transition-transform">
      <div className="w-64 bg-white rounded-sm p-2 pb-5 border border-gray-100/50" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}>
        {/* 사진 또는 컨디션 컬러 배경 */}
        {log.imageUrl ? (
          <div className="w-full aspect-[3/4] relative rounded-sm overflow-hidden">
            <Image
              src={log.imageUrl}
              alt="운동 사진"
              fill
              className="object-cover"
              sizes="256px"
              unoptimized
            />
          </div>
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
