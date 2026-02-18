// 심판 타이머 상태 관리 훅 (SWR + requestAnimationFrame 실시간 카운트)
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

type TimerStatus = "IDLE" | "RUNNING" | "PAUSED" | "ENDED";

interface TimerState {
  timerStatus: TimerStatus;
  elapsedSeconds: number;
  lastResumedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  referee: { id: string; name: string | null; image: string | null };
  isReferee: boolean;
}

interface UseRefereeTimerReturn {
  /** 화면에 표시할 경과 시간(초) - RUNNING일 때 실시간 갱신 */
  displayTime: number;
  timerStatus: TimerStatus;
  isReferee: boolean;
  referee: { id: string; name: string | null; image: string | null } | null;
  isLoading: boolean;
  start: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  end: () => Promise<void>;
  adjust: (totalSeconds: number) => Promise<void>;
}

async function postTimerAction(
  assignmentId: string,
  quarter: number,
  action: string,
  adjustSeconds?: number
) {
  const res = await fetch(`/api/referee-assignment/${assignmentId}/timer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, quarter, adjustSeconds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Timer action failed: ${res.status}`);
  }
  return res.json();
}

export function useRefereeTimer(
  assignmentId: string | null,
  quarter: number
): UseRefereeTimerReturn {
  const swrKey =
    assignmentId && quarter > 0
      ? `/api/referee-assignment/${assignmentId}/timer?quarter=${quarter}`
      : null;

  const { data, isLoading, mutate } = useSWR<TimerState>(swrKey, fetcher, {
    refreshInterval: 10_000, // 10초마다 서버와 동기화
    revalidateOnFocus: true,
  });

  const [displayTime, setDisplayTime] = useState(0);
  const rafRef = useRef<number>(0);

  // RUNNING 상태일 때 requestAnimationFrame으로 실시간 갱신
  useEffect(() => {
    if (!data) return;

    if (data.timerStatus === "RUNNING" && data.lastResumedAt) {
      const serverResumedAt = new Date(data.lastResumedAt).getTime();
      const baseElapsed = data.elapsedSeconds;

      const tick = () => {
        const now = Date.now();
        const currentSegment = (now - serverResumedAt) / 1000;
        setDisplayTime(Math.floor(baseElapsed + currentSegment));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);

      return () => cancelAnimationFrame(rafRef.current);
    }

    // RUNNING이 아니면 서버 값 그대로 표시
    setDisplayTime(data.elapsedSeconds);
  }, [data]);

  const callAction = useCallback(
    async (action: string, adjustSeconds?: number) => {
      if (!assignmentId) return;
      await postTimerAction(assignmentId, quarter, action, adjustSeconds);
      await mutate();
    },
    [assignmentId, quarter, mutate]
  );

  const start = useCallback(() => callAction("START"), [callAction]);
  const pause = useCallback(() => callAction("PAUSE"), [callAction]);
  const resume = useCallback(() => callAction("RESUME"), [callAction]);
  const end = useCallback(() => callAction("END"), [callAction]);

  /** 휠피커에서 선택한 총 시간(초)으로 조절 - 현재 displayTime과의 차이를 adjustSeconds로 전달 */
  const adjust = useCallback(
    async (totalSeconds: number) => {
      const diff = totalSeconds - displayTime;
      await callAction("ADJUST", diff);
    },
    [callAction, displayTime]
  );

  return {
    displayTime,
    timerStatus: data?.timerStatus ?? "IDLE",
    isReferee: data?.isReferee ?? false,
    referee: data?.referee ?? null,
    isLoading,
    start,
    pause,
    resume,
    end,
    adjust,
  };
}
