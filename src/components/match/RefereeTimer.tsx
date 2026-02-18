// 심판 타이머 UI - 대형 타이머 디스플레이 + 컨트롤 + 시간 조절 바텀시트
"use client";

import React, { useState } from "react";
import { Play, Pause, Square, Timer } from "lucide-react";
import { useRefereeTimer } from "@/lib/useRefereeTimer";
import WheelPicker from "@/components/ui/WheelPicker";

interface Props {
  assignmentId: string;
  quarter: number;
  /** 쿼터 시간(초) - 프로그레스 바 표시용 */
  quarterDuration?: number;
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function RefereeTimer({
  assignmentId,
  quarter,
  quarterDuration,
}: Props) {
  const {
    displayTime,
    timerStatus,
    isReferee,
    referee,
    isLoading,
    start,
    pause,
    resume,
    end,
    adjust,
  } = useRefereeTimer(assignmentId, quarter);

  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustValue, setAdjustValue] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const handleAction = async (fn: () => Promise<void>) => {
    setActionLoading(true);
    try {
      await fn();
    } catch {
      // 에러는 사용자에게 간단히 표시
    } finally {
      setActionLoading(false);
    }
  };

  const handleAdjustOpen = () => {
    setAdjustValue(displayTime);
    setShowAdjust(true);
  };

  const handleAdjustConfirm = async () => {
    setActionLoading(true);
    try {
      await adjust(adjustValue);
      setShowAdjust(false);
    } catch {
      // pass
    } finally {
      setActionLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 rounded-2xl p-6 animate-pulse">
        <div className="h-12 bg-gray-200 rounded w-32 mx-auto" />
      </div>
    );
  }

  const progress =
    quarterDuration && quarterDuration > 0
      ? Math.min(1, displayTime / quarterDuration)
      : null;

  // 상태별 스타일
  const statusStyles = {
    IDLE: "bg-gray-50 border-gray-200",
    RUNNING: "bg-green-50 border-green-200",
    PAUSED: "bg-yellow-50 border-yellow-200",
    ENDED: "bg-gray-100 border-gray-300",
  };

  const timerTextStyles = {
    IDLE: "text-gray-400",
    RUNNING: "text-green-700",
    PAUSED: "text-yellow-700",
    ENDED: "text-gray-500",
  };

  const statusLabels = {
    IDLE: "대기 중",
    RUNNING: "진행 중",
    PAUSED: "일시정지",
    ENDED: "종료됨",
  };

  return (
    <>
      <div
        className={`rounded-2xl border p-5 transition-colors ${statusStyles[timerStatus]}`}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-gray-600">
            {quarter}쿼터
          </span>
          <div className="flex items-center gap-2">
            {/* 상태 배지 */}
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                timerStatus === "RUNNING"
                  ? "bg-green-100 text-green-700"
                  : timerStatus === "PAUSED"
                  ? "bg-yellow-100 text-yellow-700 animate-pulse"
                  : timerStatus === "ENDED"
                  ? "bg-gray-200 text-gray-600"
                  : "bg-gray-100 text-gray-500"
              }`}
            >
              {statusLabels[timerStatus]}
            </span>
            {referee && (
              <span className="text-xs text-gray-400">
                심판: {referee.name || "미정"}
              </span>
            )}
          </div>
        </div>

        {/* 타이머 디스플레이 */}
        <div className="text-center mb-4">
          <div
            className={`text-5xl font-bold tracking-wider ${timerTextStyles[timerStatus]}`}
            style={{ fontFamily: "var(--font-ticker)" }}
          >
            {formatTime(displayTime)}
          </div>
          {quarterDuration && (
            <span className="text-sm text-gray-400">
              / {formatTime(quarterDuration)}
            </span>
          )}
        </div>

        {/* 프로그레스 바 */}
        {progress !== null && (
          <div className="w-full h-1.5 bg-gray-200 rounded-full mb-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                timerStatus === "RUNNING"
                  ? "bg-green-500"
                  : timerStatus === "PAUSED"
                  ? "bg-yellow-500"
                  : "bg-gray-400"
              }`}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        {/* 심판 컨트롤 버튼 */}
        {isReferee && timerStatus !== "ENDED" && (
          <div className="flex items-center justify-center gap-3">
            {timerStatus === "IDLE" && (
              <button
                type="button"
                onClick={() => handleAction(start)}
                disabled={actionLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
              >
                <Play size={16} fill="white" />
                시작
              </button>
            )}

            {timerStatus === "RUNNING" && (
              <>
                <button
                  type="button"
                  onClick={() => handleAction(pause)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 text-white rounded-xl font-medium text-sm hover:bg-yellow-600 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Pause size={16} fill="white" />
                  일시정지
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(end)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl font-medium text-sm hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Square size={14} fill="white" />
                  종료
                </button>
              </>
            )}

            {timerStatus === "PAUSED" && (
              <>
                <button
                  type="button"
                  onClick={() => handleAction(resume)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium text-sm hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Play size={16} fill="white" />
                  재개
                </button>
                <button
                  type="button"
                  onClick={() => handleAction(end)}
                  disabled={actionLoading}
                  className="flex items-center gap-2 px-5 py-2.5 bg-red-500 text-white rounded-xl font-medium text-sm hover:bg-red-600 active:scale-95 transition-all disabled:opacity-50"
                >
                  <Square size={14} fill="white" />
                  종료
                </button>
              </>
            )}

            {/* 시간 조절 버튼 (RUNNING / PAUSED) */}
            {(timerStatus === "RUNNING" || timerStatus === "PAUSED") && (
              <button
                type="button"
                onClick={handleAdjustOpen}
                disabled={actionLoading}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl text-sm hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50"
              >
                <Timer size={14} />
                조절
              </button>
            )}
          </div>
        )}
      </div>

      {/* 시간 조절 바텀시트 */}
      {showAdjust && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={() => setShowAdjust(false)}
        >
          {/* 딤 배경 */}
          <div className="absolute inset-0 bg-black/40" />

          {/* 시트 */}
          <div
            className="relative w-full max-w-lg bg-white rounded-t-2xl px-6 pt-6 pb-8 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 핸들 */}
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />

            <h3 className="text-base font-semibold text-gray-800 text-center mb-4">
              시간 조절
            </h3>

            <WheelPicker value={adjustValue} onChange={setAdjustValue} />

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setShowAdjust(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl font-medium text-sm"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAdjustConfirm}
                disabled={actionLoading}
                className="flex-1 py-3 bg-team-500 text-white rounded-xl font-medium text-sm hover:bg-team-600 active:scale-95 transition-all disabled:opacity-50"
              >
                적용
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
