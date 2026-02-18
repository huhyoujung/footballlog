// iOS 스타일 휠피커 - 분/초 선택용 (CSS scroll-snap 기반)
"use client";

import React, { useRef, useEffect, useCallback } from "react";

interface WheelColumnProps {
  values: number[];
  selected: number;
  onChange: (value: number) => void;
  label: string;
  formatValue?: (v: number) => string;
}

const ITEM_HEIGHT = 40;
const VISIBLE_ITEMS = 5;

function WheelColumn({
  values,
  selected,
  onChange,
  label,
  formatValue = (v) => String(v).padStart(2, "0"),
}: WheelColumnProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const scrollTimeout = useRef<ReturnType<typeof setTimeout>>(null);

  // 선택값 변경 시 스크롤 위치 동기화
  useEffect(() => {
    if (isUserScrolling.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const idx = values.indexOf(selected);
    if (idx < 0) return;
    el.scrollTop = idx * ITEM_HEIGHT;
  }, [selected, values]);

  const handleScroll = useCallback(() => {
    isUserScrolling.current = true;
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);

    scrollTimeout.current = setTimeout(() => {
      const el = scrollRef.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(idx, values.length - 1));
      // snap 보정
      el.scrollTop = clamped * ITEM_HEIGHT;
      if (values[clamped] !== selected) {
        onChange(values[clamped]);
      }
      isUserScrolling.current = false;
    }, 80);
  }, [values, selected, onChange]);

  // padding 아이템 (상하 2개씩 빈 공간)
  const padCount = Math.floor(VISIBLE_ITEMS / 2);

  return (
    <div className="flex flex-col items-center">
      <span className="text-xs text-gray-400 mb-1">{label}</span>
      <div
        className="relative overflow-hidden"
        style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
      >
        {/* 선택 영역 하이라이트 */}
        <div
          className="absolute left-0 right-0 bg-team-50 border-y border-team-200 rounded-lg pointer-events-none z-10"
          style={{
            top: ITEM_HEIGHT * padCount,
            height: ITEM_HEIGHT,
          }}
        />
        {/* 상하 페이드 */}
        <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white to-transparent pointer-events-none z-20" />
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent pointer-events-none z-20" />

        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto scrollbar-hide"
          style={{
            scrollSnapType: "y mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {/* 상단 패딩 */}
          {Array.from({ length: padCount }).map((_, i) => (
            <div key={`pad-top-${i}`} style={{ height: ITEM_HEIGHT }} />
          ))}
          {values.map((v) => (
            <div
              key={v}
              className={`flex items-center justify-center text-lg font-semibold transition-colors ${
                v === selected ? "text-team-700" : "text-gray-300"
              }`}
              style={{
                height: ITEM_HEIGHT,
                scrollSnapAlign: "start",
              }}
            >
              {formatValue(v)}
            </div>
          ))}
          {/* 하단 패딩 */}
          {Array.from({ length: padCount }).map((_, i) => (
            <div key={`pad-bot-${i}`} style={{ height: ITEM_HEIGHT }} />
          ))}
        </div>
      </div>
    </div>
  );
}

interface WheelPickerProps {
  /** 현재 총 시간 (초) */
  value: number;
  /** 변경 콜백 (총 시간 초) */
  onChange: (totalSeconds: number) => void;
  /** 최대 분 (기본 59) */
  maxMinutes?: number;
}

export default function WheelPicker({
  value,
  onChange,
  maxMinutes = 59,
}: WheelPickerProps) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  const minuteValues = Array.from({ length: maxMinutes + 1 }, (_, i) => i);
  const secondValues = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="flex items-center justify-center gap-4 py-2">
      <WheelColumn
        values={minuteValues}
        selected={minutes}
        onChange={(m) => onChange(m * 60 + seconds)}
        label="분"
      />
      <span className="text-2xl font-bold text-gray-400 mt-5">:</span>
      <WheelColumn
        values={secondValues}
        selected={seconds}
        onChange={(s) => onChange(minutes * 60 + s)}
        label="초"
      />
    </div>
  );
}
