"use client";

import { useMemo } from "react";
import PolaroidCard from "./PolaroidCard";
import type { TrainingLog } from "@/types/training";

interface Props {
  logs: TrainingLog[];
  displayDate: string;
  onClick: () => void;
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

function generateStackConfigs(displayDate: string) {
  const rand = seededRandom(displayDate);

  return [
    {
      top: 10 + rand(10),           // 10~20
      left: -12 + rand(8),          // -12~-4
      rotation: -7 + rand(4),       // -7~-3
      zIndex: 1,
    },
    {
      top: 3 + rand(8),             // 3~11
      left: 4 + rand(14),           // 4~18
      rotation: 1 + rand(5),        // 1~6
      zIndex: 2,
    },
    {
      top: rand(4),                  // 0~4
      left: -2 + rand(6),           // -2~4
      rotation: -2 + rand(3),       // -2~1
      zIndex: 3,
    },
  ];
}

export default function PolaroidStack({ logs, displayDate, onClick }: Props) {
  const visibleLogs = logs.slice(0, 3);
  const configs = useMemo(() => generateStackConfigs(displayDate), [displayDate]);

  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center group cursor-pointer"
    >
      <div className="relative w-44 h-56">
        {visibleLogs.map((log, i) => {
          const config = configs[visibleLogs.length - 1 - i] || configs[0];
          return (
            <div
              key={log.id}
              className="absolute transition-transform duration-200 group-hover:scale-105"
              style={{
                top: config.top,
                left: `50%`,
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
      <div className="mt-2 text-center">
        <p className="text-sm font-semibold text-team-500">{displayDate}</p>
        <p className="text-xs text-gray-400">{logs.length}명의 기록</p>
      </div>
    </button>
  );
}
