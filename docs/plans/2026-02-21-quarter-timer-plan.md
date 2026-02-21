# Quarter Timer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** ChallengeLiveMode에 서버 싱크 쿼터 타이머를 추가한다 — canRecord 사용자가 시작/정지/페이즈 전환을 제어하고, 모든 기기에서 같은 타이머가 보이며, 0에 도달하면 진동이 울린다.

**Architecture:** MatchRules 모델에 3개 타이머 상태 필드를 추가한다. `POST /api/challenge/[token]/timer`가 이를 업데이트하고, 기존 live API가 타이머 상태를 포함해 반환한다. 클라이언트는 `timerStartedAt` 타임스탬프를 기반으로 로컬에서 1초 tick을 계산하므로 5초 폴링 사이에도 타이머 숫자는 정확하다.

**Tech Stack:** Next.js App Router API Routes, Prisma (PostgreSQL), SWR, React hooks (useEffect, setInterval), navigator.vibrate Web API

---

### Task 1: DB 스키마 — MatchRules에 타이머 필드 추가

**Files:**
- Modify: `prisma/schema.prisma` (MatchRules model, 428-448번째 줄 부근)

**Step 1: schema.prisma 수정**

`MatchRules` 모델의 `agreedByTeamB` 줄 아래에 다음 3개 필드를 추가한다:

```prisma
  currentPhase    Int       @default(0)   // 0=시작전, 1=1Q, 2=휴식/하프타임, 3=2Q ...
  timerStartedAt  DateTime?               // null이면 정지 상태
  timerElapsedSec Int       @default(0)   // 정지 시점까지 누적 초
```

**Step 2: 마이그레이션 생성 및 적용**

```bash
npx prisma migrate dev --name add_match_timer_fields
```

Expected: `prisma/migrations/..._add_match_timer_fields/migration.sql` 생성 및 DB 적용

**Step 3: Prisma Client 재생성 확인**

```bash
npx prisma generate
```

Expected: `@prisma/client` 타입에 `currentPhase`, `timerStartedAt`, `timerElapsedSec` 포함

**Step 4: 빌드로 타입 체크**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: 빈 출력 (에러 없음)

**Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: MatchRules에 타이머 상태 필드 추가"
```

---

### Task 2: 페이즈 유틸리티 함수 (`src/lib/match-phases.ts`)

**Files:**
- Create: `src/lib/match-phases.ts`

**Step 1: 파일 생성**

```typescript
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
```

**Step 2: 빌드로 타입 체크**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: 에러 없음

**Step 3: Commit**

```bash
git add src/lib/match-phases.ts
git commit -m "feat: 쿼터 페이즈 유틸리티 함수 추가"
```

---

### Task 3: 타이머 API — `POST /api/challenge/[token]/timer`

**Files:**
- Create: `src/app/api/challenge/[token]/timer/route.ts`

참고 파일:
- `src/lib/challenge-auth.ts` — canRecord 권한 확인 패턴
- `src/lib/match-phases.ts` — buildPhases (범위 검증용)

**Step 1: 파일 생성**

```typescript
// src/app/api/challenge/[token]/timer/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPhases } from "@/lib/match-phases";

type TimerAction = "start" | "pause" | "next" | "prev";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { token } = await params;
    const { action } = (await req.json()) as { action: TimerAction };

    if (!["start", "pause", "next", "prev"].includes(action)) {
      return NextResponse.json({ error: "유효하지 않은 action" }, { status: 400 });
    }

    // 호스트 이벤트 + matchRules 조회
    const event = await prisma.trainingEvent.findUnique({
      where: { challengeToken: token },
      select: {
        id: true,
        teamId: true,
        matchStatus: true,
        opponentTeamId: true,
        matchRules: {
          select: {
            id: true,
            quarterCount: true,
            quarterMinutes: true,
            quarterBreak: true,
            halftime: true,
            currentPhase: true,
            timerStartedAt: true,
            timerElapsedSec: true,
          },
        },
        rsvps: { where: { status: "ATTEND" }, select: { userId: true } },
        linkedEvent: {
          select: {
            rsvps: { where: { status: "ATTEND" }, select: { userId: true } },
          },
        },
      },
    });

    if (!event || event.matchStatus !== "IN_PROGRESS") {
      return NextResponse.json({ error: "경기가 진행 중이 아닙니다" }, { status: 400 });
    }

    if (!event.matchRules) {
      return NextResponse.json({ error: "경기 규칙이 없습니다" }, { status: 400 });
    }

    // canRecord 권한 확인
    const userId = session.user.id;
    const userTeamId = session.user.teamId;
    const isAdmin = session.user.role === "ADMIN";
    const isHostTeam = userTeamId === event.teamId;
    const isOpponentTeam = !!event.opponentTeamId && userTeamId === event.opponentTeamId;
    const hostAttending = event.rsvps.some((r) => r.userId === userId);
    const opponentAttending = event.linkedEvent?.rsvps.some((r) => r.userId === userId) ?? false;
    const canRecord =
      (isHostTeam && (hostAttending || isAdmin)) ||
      (isOpponentTeam && (opponentAttending || isAdmin));

    if (!canRecord) {
      return NextResponse.json({ error: "기록 권한이 없습니다" }, { status: 403 });
    }

    const rules = event.matchRules;
    const phases = buildPhases(
      rules.quarterCount,
      rules.quarterMinutes,
      rules.quarterBreak,
      rules.halftime
    );
    const maxPhase = phases.length;
    const now = new Date();

    // 현재 경과 시간 계산 (pause/next/prev에서 누적 필요)
    const currentElapsed = rules.timerStartedAt
      ? rules.timerElapsedSec +
        Math.floor((now.getTime() - rules.timerStartedAt.getTime()) / 1000)
      : rules.timerElapsedSec;

    let updateData: {
      currentPhase?: number;
      timerStartedAt?: Date | null;
      timerElapsedSec?: number;
    } = {};

    switch (action) {
      case "start":
        if (rules.timerStartedAt) {
          // 이미 실행 중 — 무시
          return NextResponse.json({ ok: true });
        }
        updateData = { timerStartedAt: now };
        break;

      case "pause":
        if (!rules.timerStartedAt) {
          // 이미 정지 중 — 무시
          return NextResponse.json({ ok: true });
        }
        updateData = { timerElapsedSec: currentElapsed, timerStartedAt: null };
        break;

      case "next":
        if (rules.currentPhase >= maxPhase) {
          return NextResponse.json({ error: "마지막 페이즈입니다" }, { status: 400 });
        }
        updateData = {
          currentPhase: rules.currentPhase + 1,
          timerElapsedSec: 0,
          timerStartedAt: now, // 자동 시작
        };
        break;

      case "prev":
        if (rules.currentPhase <= 1) {
          return NextResponse.json({ error: "첫 번째 페이즈입니다" }, { status: 400 });
        }
        updateData = {
          currentPhase: rules.currentPhase - 1,
          timerElapsedSec: 0,
          timerStartedAt: now, // 자동 시작
        };
        break;
    }

    const updated = await prisma.matchRules.update({
      where: { id: rules.id },
      data: updateData,
      select: {
        currentPhase: true,
        timerStartedAt: true,
        timerElapsedSec: true,
      },
    });

    return NextResponse.json({ ok: true, timer: updated });
  } catch (error) {
    console.error("Timer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: 빌드로 타입 체크**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: 에러 없음

**Step 3: Commit**

```bash
git add src/app/api/challenge/[token]/timer/route.ts
git commit -m "feat: POST /api/challenge/[token]/timer 타이머 컨트롤 API 추가"
```

---

### Task 4: Live API 확장 — 타이머 상태 + myTeamSessions

**Files:**
- Modify: `src/app/api/challenge/[token]/live/route.ts`

**Step 1: matchRules select에 타이머 필드 추가**

현재 26번째 줄:
```typescript
matchRules: { select: { quarterCount: true } },
```
를 아래로 교체:
```typescript
matchRules: {
  select: {
    quarterCount: true,
    quarterMinutes: true,
    quarterBreak: true,
    halftime: true,
    currentPhase: true,
    timerStartedAt: true,
    timerElapsedSec: true,
  },
},
```

**Step 2: linkedEvent에 sessions 추가**

현재 linkedEvent select:
```typescript
linkedEvent: {
  select: {
    id: true,
    rsvps: {
      where: { status: "ATTEND" },
      select: { user: { select: userSelect } },
    },
  },
},
```
를 아래로 교체:
```typescript
linkedEvent: {
  select: {
    id: true,
    rsvps: {
      where: { status: "ATTEND" },
      select: { user: { select: userSelect } },
    },
    sessions: {
      orderBy: { orderIndex: "asc" },
      select: {
        orderIndex: true,
        title: true,
        teamAssignments: {
          select: { teamLabel: true, user: { select: userSelect } },
        },
      },
    },
  },
},
```

**Step 3: 응답에 타이머 필드 추가 + hostSessions → myTeamSessions 교체**

`canRecord`, `canEnd` 계산 블록 아래, return 직전에:

```typescript
// myTeamSessions: 본인 팀 세션만 반환
const myTeamSessions = session?.user?.id
  ? isHostTeam
    ? event.sessions
    : isOpponentTeam
    ? (event.linkedEvent?.sessions ?? [])
    : []
  : [];
```

그리고 `return NextResponse.json({...})` 안에서:
- `hostSessions: event.sessions` 줄을 제거하고
- 아래 필드들을 추가:

```typescript
quarterMinutes: event.matchRules?.quarterMinutes ?? 12,
quarterBreak: event.matchRules?.quarterBreak ?? 2,
halftime: event.matchRules?.halftime ?? 5,
timerPhase: event.matchRules?.currentPhase ?? 0,
timerRunning: event.matchRules?.timerStartedAt != null,
timerStartedAt: event.matchRules?.timerStartedAt?.toISOString() ?? null,
timerElapsedSec: event.matchRules?.timerElapsedSec ?? 0,
myTeamSessions,
```

**Step 4: 빌드로 타입 체크**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: 에러 없음

**Step 5: Commit**

```bash
git add src/app/api/challenge/[token]/live/route.ts
git commit -m "feat: live API에 타이머 상태 + myTeamSessions 추가"
```

---

### Task 5: ChallengeLiveMode — 타이머 UI 및 컨트롤

**Files:**
- Modify: `src/app/invite/challenge/[token]/ChallengeLiveMode.tsx`

참고: 현재 파일 전체 구조를 읽고 시작할 것. 특히:
- `LiveData` interface (65-80번째 줄)
- 스코어 헤더 섹션 (300-356번째 줄)
- 라인업 섹션 (`currentSession`, 372-400번째 줄)

**Step 1: import 추가**

파일 상단 import에 match-phases 유틸 추가:
```typescript
import { buildPhases, getPhaseInfo, calcElapsed } from "@/lib/match-phases";
```

**Step 2: LiveData 인터페이스 수정**

`hostSessions: HostSession[]` 줄을 제거하고 아래 필드들을 추가:
```typescript
quarterMinutes: number;
quarterBreak: number;
halftime: number;
timerPhase: number;
timerRunning: boolean;
timerStartedAt: string | null;
timerElapsedSec: number;
myTeamSessions: HostSession[];
```

**Step 3: 상태 및 계산 추가**

`showLineup` state 선언 아래에 추가:
```typescript
const [tick, setTick] = useState(0); // 1초 tick — 로컬 타이머 갱신용
```

`useEffect` 블록들 아래에 추가:
```typescript
// 1초마다 tick — 타이머 숫자 갱신
useEffect(() => {
  const id = setInterval(() => setTick((t) => t + 1), 1000);
  return () => clearInterval(id);
}, []);
```

**Step 4: 타이머 계산 로직 추가**

`const { teamA, teamB, ... } = data;` 구조분해 줄 아래에 추가:
```typescript
const { teamA, teamB, teamAAttendees, teamBAttendees, quarterCount,
        canRecord, canEnd, myTeamSessions,
        quarterMinutes, quarterBreak, halftime,
        timerPhase, timerRunning, timerStartedAt, timerElapsedSec } = data;

// 현재 세션 (기록용 쿼터 기준, 기존 로직 유지)
const currentSession = myTeamSessions.find((s) => s.orderIndex === currentQuarter - 1) ?? null;

// 페이즈 계산
const phases = buildPhases(quarterCount, quarterMinutes, quarterBreak, halftime);
const currentPhaseInfo = getPhaseInfo(timerPhase, phases);
const elapsed = calcElapsed(timerElapsedSec, timerRunning ? timerStartedAt : null);
// tick은 참조만 해도 리렌더 트리거
void tick;
const remaining = currentPhaseInfo ? Math.max(0, currentPhaseInfo.durationSec - elapsed) : 0;
const remainingMin = Math.floor(remaining / 60);
const remainingSec = remaining % 60;
const timerDisplay = `${String(remainingMin).padStart(2, "0")}:${String(remainingSec).padStart(2, "0")}`;
const isUrgent = remaining <= 60 && remaining > 0 && timerPhase > 0;
```

**Step 5: 진동 useEffect 추가**

기존 `useEffect` 블록들 아래에 추가:
```typescript
// 시간 종료 진동 알림 (canRecord 사용자만)
useEffect(() => {
  if (remaining === 0 && timerPhase > 0 && canRecord) {
    navigator.vibrate?.([300, 100, 300, 100, 300]);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [remaining === 0, timerPhase]);
```

**Step 6: 타이머 컨트롤 핸들러 추가**

`handleEndMatch` 함수 아래에 추가:
```typescript
const handleTimerAction = async (action: "start" | "pause" | "next" | "prev") => {
  const res = await fetch(`/api/challenge/${token}/timer`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  if (res.ok) {
    mutate(); // 타이머 상태 즉시 동기화
  } else {
    const d = await res.json();
    showToast(d.error || "타이머 오류");
  }
};
```

**Step 7: 스코어 헤더에 타이머 UI 추가**

기존 쿼터 이동 버튼 블록(`canRecord && (...)`) 아래, `</div> </div>` 닫기 직전에 추가:

```tsx
{/* 타이머 — 전체 사용자 표시 */}
{timerPhase > 0 && currentPhaseInfo && (
  <div className="mt-4 flex flex-col items-center gap-1">
    <div className={`text-3xl font-bold tabular-nums tracking-tight ${isUrgent ? "text-red-500" : "text-gray-800"}`}>
      {timerDisplay}
    </div>
    <div className="text-xs text-gray-500 font-medium">{currentPhaseInfo.label}</div>
    <div className="text-xs text-gray-400">
      쿼터 {quarterMinutes}분 · 쉬는시간 {quarterBreak}분
    </div>
  </div>
)}
{timerPhase === 0 && canRecord && (
  <div className="mt-4 flex flex-col items-center gap-1">
    <div className="text-xs text-gray-400">
      쿼터 {quarterMinutes}분 · 쉬는시간 {quarterBreak}분
    </div>
  </div>
)}

{/* 타이머 컨트롤 — canRecord만 */}
{canRecord && (
  <div className="flex items-center justify-center gap-3 mt-3">
    <button
      onClick={() => handleTimerAction("prev")}
      disabled={timerPhase <= 1}
      className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 text-lg disabled:opacity-30 active:scale-90"
    >‹</button>
    {timerPhase === 0 ? (
      <button
        onClick={() => handleTimerAction("next")}
        className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold active:scale-95"
      >
        경기 시작
      </button>
    ) : timerRunning ? (
      <button
        onClick={() => handleTimerAction("pause")}
        className="px-5 py-2 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold active:scale-95"
      >
        ⏸ 정지
      </button>
    ) : (
      <button
        onClick={() => handleTimerAction("start")}
        className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold active:scale-95"
      >
        ▶ 재개
      </button>
    )}
    <button
      onClick={() => handleTimerAction("next")}
      disabled={timerPhase >= phases.length}
      className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 text-lg disabled:opacity-30 active:scale-90"
    >›</button>
  </div>
)}
```

**Step 8: 라인업 섹션 — hostSessions → myTeamSessions**

기존 `{currentSession && currentSession.teamAssignments.length > 0 && (...)}`에서:
- `{teamA.name} {currentQuarter}Q 선발` → `내 팀 {currentQuarter}Q 선발`
- 변수명은 이미 `currentSession`(= `myTeamSessions.find(...)`)으로 올바름

**Step 9: 기존 쿼터 이동 버튼 수정**

기존 `canRecord &&` 블록의 쿼터 이동 버튼(‹/›) 레이블:
- `{currentQuarter}쿼터 기록 중` → `{currentQuarter}Q 기록`

레이아웃이 타이머와 겹치지 않도록 기존 쿼터 이동 블록은 그대로 유지한다.

**Step 10: 빌드로 타입 체크**

```bash
npm run build 2>&1 | grep -E "error|Error" | head -20
```

Expected: 에러 없음

**Step 11: Commit**

```bash
git add src/app/invite/challenge/[token]/ChallengeLiveMode.tsx
git commit -m "feat: 쿼터 타이머 UI + 컨트롤 추가 (server sync, 진동)"
```

---

### Task 6: 수동 확인

로컬 서버 기동 후 다음 시나리오를 직접 확인한다:

```bash
npm run dev
```

1. **타이머 없는 초기 상태**: IN_PROGRESS 경기 진입 시 `timerPhase=0` → "경기 시작" 버튼만 표시
2. **시작**: "경기 시작" 클릭 → 1Q 카운트다운 시작 (`12:00 → 11:59 ...`)
3. **정지/재개**: ⏸ 클릭 → 숫자 멈춤, ▶ 클릭 → 이어서 진행
4. **다음 페이즈**: › 클릭 → 쉬는 시간 표시 (`02:00 → 01:59 ...`)
5. **하프타임**: 2Q 종료 후 › → "하프타임" 표시
6. **진동**: 타이머 0초 도달 시 진동 (브라우저 허용된 모바일에서 확인)
7. **라인업**: 호스트팀 로그인 → 내 팀 선발 보임, 상대팀 로그인 → 상대팀 선발 안 보임

**Step: 최종 Commit (이상 없을 경우)**

```bash
git add -A
git commit -m "feat: 쿼터 타이머 기능 완성 (서버 싱크, 진동, 라인업 팀별 분리)"
```
