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

  // variant === "full"
  return (
    <div className="w-72 bg-white rounded-sm shadow-xl p-3 pb-6">
      {/* 사진 또는 컨디션 컬러 배경 */}
      {log.imageUrl ? (
        <img
          src={log.imageUrl}
          alt="운동 사진"
          className="w-full aspect-[4/3] object-cover rounded-sm"
        />
      ) : (
        <div
          className={`w-full aspect-[4/3] rounded-sm flex flex-col items-center justify-center ${getConditionBgColor(log.condition)}`}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="none"
            className={getConditionTextColor(log.condition)}
          >
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <span
            className={`text-2xl font-bold mt-1 ${getConditionTextColor(log.condition)}`}
          >
            {log.condition}
          </span>
        </div>
      )}

      {/* 내용 */}
      <div className="mt-3 space-y-2.5">
        {/* 사용자 정보 */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-900">
            {log.user.name || "익명"}
          </span>
          {(log.user.position || log.user.number != null) && (
            <span className="text-xs text-gray-400">
              {[
                log.user.position,
                log.user.number != null ? `#${log.user.number}` : null,
              ]
                .filter(Boolean)
                .join(" ")}
            </span>
          )}
        </div>

        {/* 컨디션 */}
        <div className="flex items-center gap-2">
          <ConditionBadge condition={log.condition} />
          <span className="text-xs text-gray-500 line-clamp-1">
            {log.conditionReason}
          </span>
        </div>

        {/* 핵심 포인트 */}
        <div>
          <h4 className="text-xs font-medium text-team-600 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            핵심 포인트
          </h4>
          <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">
            {log.keyPoints}
          </p>
        </div>

        {/* 개선점 */}
        <div>
          <h4 className="text-xs font-medium text-blue-700 flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5" />
              <path d="m5 12 7-7 7 7" />
            </svg>
            개선점
          </h4>
          <p className="text-sm text-gray-800 mt-0.5 whitespace-pre-wrap">
            {log.improvement}
          </p>
        </div>

        {/* 액션 바 */}
        <div className="flex items-center gap-4 pt-2 border-t border-gray-100">
          <button
            onClick={() => onLikeToggle?.(log.id)}
            className="flex items-center gap-1.5 py-1 px-1"
          >
            {log.isLiked ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#EF4444" stroke="none">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            )}
            <span className={`text-sm ${log.isLiked ? "text-red-500" : "text-gray-400"}`}>
              {log._count.likes}
            </span>
          </button>
          <Link
            href={`/log/${log.id}`}
            className="flex items-center gap-1.5 py-1 px-1"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span className="text-sm text-gray-400">{log._count.comments}</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
