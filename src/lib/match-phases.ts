// src/lib/match-phases.ts

export interface PhaseInfo {
  type: "QUARTER" | "BREAK" | "HALFTIME";
  quarterNumber: number | null; // QUARTER 타입일 때만 있음
  durationSec: number;
  label: string; // "1Q", "쉬는 시간", "하프타임"
}

/**
 * matchRules 값으로 전체 페이즈 배열을 생성한다.
 * 인덱스 0 = 1Q, 인덱스 1 = 첫 번째 휴식/하프타임, ...
 *
 * 예) quarterCount=4, halftime=5:
 * [1Q(12분), 쉬는시간(2분), 2Q(12분), 하프타임(5분), 3Q(12분), 쉬는시간(2분), 4Q(12분)]
 */
export function buildPhases(
  quarterCount: number,
  quarterMinutes: number,
  quarterBreak: number,
  halftime: number
): PhaseInfo[] {
  const phases: PhaseInfo[] = [];
  // halftime은 짝수 quarterCount의 정중앙 휴식에만 적용
  const halftimeAfterQuarter =
    quarterCount % 2 === 0 ? quarterCount / 2 : -1;

  for (let i = 0; i < quarterCount; i++) {
    const qNum = i + 1;
    phases.push({
      type: "QUARTER",
      quarterNumber: qNum,
      durationSec: quarterMinutes * 60,
      label: `${qNum}Q`,
    });
    if (i < quarterCount - 1) {
      const isHalftime = i + 1 === halftimeAfterQuarter;
      phases.push({
        type: isHalftime ? "HALFTIME" : "BREAK",
        quarterNumber: null,
        durationSec: (isHalftime ? halftime : quarterBreak) * 60,
        label: isHalftime ? "하프타임" : "쉬는 시간",
      });
    }
  }
  return phases;
}

/**
 * currentPhase (1-based, 0=시작전)를 PhaseInfo로 변환.
 * currentPhase=0이거나 범위 밖이면 null 반환.
 */
export function getPhaseInfo(
  currentPhase: number,
  phases: PhaseInfo[]
): PhaseInfo | null {
  if (currentPhase <= 0 || currentPhase > phases.length) return null;
  return phases[currentPhase - 1];
}

/**
 * 타이머 경과 시간(초) 계산.
 * timerStartedAt이 있으면 실행 중, 없으면 정지 중.
 */
export function calcElapsed(
  timerElapsedSec: number,
  timerStartedAt: string | null
): number {
  if (!timerStartedAt) return timerElapsedSec;
  const diffSec = Math.floor(
    (Date.now() - new Date(timerStartedAt).getTime()) / 1000
  );
  return timerElapsedSec + Math.max(0, diffSec);
}
