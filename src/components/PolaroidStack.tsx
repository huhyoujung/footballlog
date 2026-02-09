"use client";

import { useMemo } from "react";
import PolaroidCard from "./PolaroidCard";
import type { TrainingLog } from "@/types/training";

interface Props {
  logs: TrainingLog[];
  date: string; // 실제 날짜 (YYYY-MM-DD) - seed로 사용
  displayDate: string;
  onClick: () => void;
  isExpanding?: boolean;
}

// 날짜 문자열을 seed로 한 결정론적 난수 (같은 날짜 → 항상 같은 배치)
function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (n: number) => {
    hash = (hash * 16807 + 12345) | 0;
    return ((hash & 0x7fffffff) % 1000) / 1000 * n;
  };
}

function generateStackConfigs(date: string) {
  const rand = seededRandom(date);

  return [
    {
      top: 10 + rand(10),
      left: -12 + rand(8),
      rotation: -12 + rand(10),
      zIndex: 1,
    },
    {
      top: 3 + rand(8),
      left: 4 + rand(14),
      rotation: 2 + rand(10),
      zIndex: 2,
    },
    {
      top: rand(4),
      left: -2 + rand(6),
      rotation: -8 + rand(8),
      zIndex: 3,
    },
  ];
}

export default function PolaroidStack({ logs, date, displayDate, onClick, isExpanding }: Props) {
  const visibleLogs = logs.slice(0, 3);
  const configs = useMemo(() => generateStackConfigs(date), [date]);

  // 펼침 시 카드를 가로로 벌리는 위치 계산 (캐러셀 위치에 가깝게)
  const getExpandedOffset = (i: number, total: number) => {
    const spacing = 76;
    const center = ((total - 1) * spacing) / 2;
    return i * spacing - center;
  };

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center group cursor-pointer"
    >
      <div className="relative w-44 h-56">
        {visibleLogs.map((log, i) => {
          const config = configs[visibleLogs.length - 1 - i] || configs[0];
          const expandOffset = getExpandedOffset(i, visibleLogs.length);

          return (
            <div
              key={log.id}
              className="absolute stack-card"
              style={isExpanding ? {
                top: 10,
                left: '50%',
                marginLeft: -72 + expandOffset,
                transform: 'rotate(0deg) scale(1.2)',
                zIndex: i + 1,
                opacity: 1,
              } : {
                top: config.top,
                left: '50%',
                marginLeft: -72 + config.left,
                transform: `rotate(${config.rotation}deg)`,
                zIndex: config.zIndex,
              }}
            >
              <PolaroidCard log={log} variant="stack" />
            </div>
          );
        })}
      </div>
      <div
        className="mt-1 text-center stack-card"
        style={{ opacity: isExpanding ? 0 : 1 }}
      >
        <p className="text-sm font-semibold text-team-500">{displayDate}</p>
        <p className="text-xs text-gray-400">{logs.length}명의 기록</p>
      </div>
    </button>
  );
}
