"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { CONDITION_LEVELS, getConditionColor } from "@/lib/condition";

interface Props {
  value: number;
  onConfirm: (value: number) => void;
  onClose: () => void;
}

export default function ConditionPicker({ value, onConfirm, onClose }: Props) {
  const [selected, setSelected] = useState(value);
  const barRef = useRef<HTMLDivElement>(null);
  const level = CONDITION_LEVELS[selected];
  const color = getConditionColor(selected);

  useEffect(() => {
    // 모달 열릴 때 배경 스크롤 막기
    document.body.style.overflow = 'hidden';

    // 컴포넌트 언마운트 시 배경 스크롤 복구
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const getValueFromPosition = useCallback(
    (clientX: number) => {
      if (!barRef.current) return selected;
      const rect = barRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.max(0, Math.min(10, Math.round(ratio * 10)));
    },
    [selected]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setSelected(getValueFromPosition(e.clientX));
    },
    [getValueFromPosition]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 0) return;
      setSelected(getValueFromPosition(e.clientX));
    },
    [getValueFromPosition]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 h-14">
        <button onClick={onClose} className="p-2 text-gray-700">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={() => onConfirm(selected)}
          className="text-base font-semibold text-team-500 px-2 py-1"
        >
          완료
        </button>
      </div>

      {/* 중앙 컨텐츠 */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <span
          className="text-[96px] font-extrabold leading-none"
          style={{ color }}
        >
          {selected}
        </span>
        <span className="text-[22px] font-semibold text-gray-900">
          {level.label}
        </span>
        <span className="text-sm text-gray-400">{level.description}</span>
      </div>

      {/* 하단 슬라이더 */}
      <div className="px-6 pb-[max(4rem,env(safe-area-inset-bottom,4rem))] pt-8">
        <div
          ref={barRef}
          className="relative h-5 rounded-full bg-gray-200 cursor-pointer touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-[width] duration-100"
            style={{
              width: `${(selected / 10) * 100}%`,
              backgroundColor: color,
            }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white transition-[left] duration-100"
            style={{
              left: `calc(${(selected / 10) * 100}% - 14px)`,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
              border: `3px solid ${color}`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
