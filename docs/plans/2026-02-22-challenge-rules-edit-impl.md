# Challenge Rules Edit Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `/invite/[token]` 페이지의 모든 활성 상태(CHALLENGE_SENT, CONFIRMED, IN_PROGRESS)에서 양 팀 운영진이 경기 방식을 수정할 수 있도록 구현한다.

**Architecture:** 토큰 기반 PATCH API로 인증/권한 처리, 공통 바텀시트 컴포넌트로 UI 재사용, ChallengeClient에 상태별 편집 진입점 추가.

**Tech Stack:** Next.js App Router, Prisma + PostgreSQL, Tailwind CSS v4

**Design Doc:** `docs/plans/2026-02-22-challenge-rules-edit-design.md`

---

## Task 1: PATCH /api/challenge/[token]/rules 엔드포인트 생성

**Files:**
- Create: `src/app/api/challenge/[token]/rules/route.ts`

**참고:** `src/app/api/challenge/[token]/match-status/route.ts` 패턴을 그대로 따른다.

**Step 1: 파일 생성**

```typescript
// src/app/api/challenge/[token]/rules/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/challenge/[token]/rules - 경기 방식 수정 (양팀 ADMIN 가능)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 경기 방식을 수정할 수 있습니다" }, { status: 403 });
    }

    const { token } = await params;

    const hostEvent = await prisma.trainingEvent.findUnique({
      where: { challengeToken: token },
      select: {
        id: true,
        teamId: true,
        matchStatus: true,
        opponentTeamId: true,
        minimumPlayers: true,
      },
    });

    if (!hostEvent) {
      return NextResponse.json({ error: "이벤트를 찾을 수 없습니다" }, { status: 404 });
    }

    // 허용 상태 검사
    const allowedStatuses = ["CHALLENGE_SENT", "CONFIRMED", "IN_PROGRESS"];
    if (!allowedStatuses.includes(hostEvent.matchStatus)) {
      return NextResponse.json({ error: "이 상태에서는 경기 방식을 수정할 수 없습니다" }, { status: 400 });
    }

    // 호스트팀 또는 상대팀 어드민인지 확인
    const isHostTeam = hostEvent.teamId === session.user.teamId;
    const isOpponentTeam = !!hostEvent.opponentTeamId && hostEvent.opponentTeamId === session.user.teamId;

    if (!isHostTeam && !isOpponentTeam) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const { quarterCount, quarterMinutes, quarterBreak, kickoffTime, quarterRefereeTeams } = await req.json();

    await prisma.matchRules.upsert({
      where: { trainingEventId: hostEvent.id },
      create: {
        trainingEventId: hostEvent.id,
        kickoffTime: kickoffTime ?? null,
        quarterCount: quarterCount ?? 4,
        quarterMinutes: quarterMinutes ?? 20,
        quarterBreak: quarterBreak ?? 5,
        quarterRefereeTeams: quarterRefereeTeams ?? null,
        playersPerSide: hostEvent.minimumPlayers ?? 0,
      },
      update: {
        ...(kickoffTime !== undefined && { kickoffTime }),
        ...(quarterCount !== undefined && { quarterCount }),
        ...(quarterMinutes !== undefined && { quarterMinutes }),
        ...(quarterBreak !== undefined && { quarterBreak }),
        ...(quarterRefereeTeams !== undefined && { quarterRefereeTeams }),
      },
    });

    return NextResponse.json({ saved: true });
  } catch (error) {
    console.error("Challenge rules update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
```

**Step 2: 타입 체크**

```bash
cd /Users/huhyoujung/dev/football-log && npx tsc --noEmit 2>&1 | grep "rules/route"
```

Expected: 에러 없음

**Step 3: 커밋**

```bash
git add src/app/api/challenge/[token]/rules/route.ts
git commit -m "feat: PATCH /api/challenge/[token]/rules - 경기 방식 수정 API"
```

---

## Task 2: MatchRulesBottomSheet 공통 컴포넌트 생성

**Files:**
- Create: `src/components/training/MatchRulesBottomSheet.tsx`

**참고:** `src/app/training/[id]/TrainingDetailClient.tsx` 538~674줄의 바텀시트 UI 추출. "응답기한" 섹션은 제외.

**Step 1: 파일 생성**

```typescript
// src/components/training/MatchRulesBottomSheet.tsx
"use client";

import { useState, useEffect } from "react";

export interface MatchRulesPayload {
  quarterCount: number;
  quarterMinutes: number;
  quarterBreak: number;
  kickoffTime: string | null;
  quarterRefereeTeams: ("TEAM_A" | "TEAM_B")[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rules: MatchRulesPayload) => Promise<void>;
  initialRules?: {
    quarterCount?: number;
    quarterMinutes?: number;
    quarterBreak?: number;
    kickoffTime?: string | null;
    quarterRefereeTeams?: ("TEAM_A" | "TEAM_B")[] | null;
  };
  hostTeamName: string;
  opponentTeamName: string;
  hostTeamColor: string;
  opponentTeamColor: string;
}

export default function MatchRulesBottomSheet({
  isOpen,
  onClose,
  onSave,
  initialRules,
  hostTeamName,
  opponentTeamName,
  hostTeamColor,
  opponentTeamColor,
}: Props) {
  const [quarterCount, setQuarterCount] = useState(initialRules?.quarterCount ?? 4);
  const [quarterMinutes, setQuarterMinutes] = useState(initialRules?.quarterMinutes ?? 20);
  const [quarterBreak, setQuarterBreak] = useState(initialRules?.quarterBreak ?? 5);
  const [kickoffTime, setKickoffTime] = useState(initialRules?.kickoffTime ?? "");
  const [quarterRefereeTeams, setQuarterRefereeTeams] = useState<("TEAM_A" | "TEAM_B")[]>(
    initialRules?.quarterRefereeTeams ??
      Array.from({ length: initialRules?.quarterCount ?? 4 }, (_, i) =>
        i % 2 === 0 ? "TEAM_A" : "TEAM_B"
      )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 시트가 열릴 때마다 initialRules로 초기화
  useEffect(() => {
    if (isOpen) {
      setQuarterCount(initialRules?.quarterCount ?? 4);
      setQuarterMinutes(initialRules?.quarterMinutes ?? 20);
      setQuarterBreak(initialRules?.quarterBreak ?? 5);
      setKickoffTime(initialRules?.kickoffTime ?? "");
      setQuarterRefereeTeams(
        initialRules?.quarterRefereeTeams ??
          Array.from({ length: initialRules?.quarterCount ?? 4 }, (_, i) =>
            i % 2 === 0 ? "TEAM_A" : "TEAM_B"
          )
      );
      setError("");
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave({
        quarterCount,
        quarterMinutes,
        quarterBreak,
        kickoffTime: kickoffTime || null,
        quarterRefereeTeams,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900">경기 방식 수정</h3>

        {/* 경기 방식 */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">경기 방식</label>
          <div className="space-y-3 bg-gray-50 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">쿼터 수</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(1, quarterCount - 1);
                    setQuarterCount(next);
                    setQuarterRefereeTeams((prev) =>
                      Array.from({ length: next }, (_, i) => prev[i] ?? (i % 2 === 0 ? "TEAM_A" : "TEAM_B"))
                    );
                  }}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-semibold text-gray-900">{quarterCount}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(8, quarterCount + 1);
                    setQuarterCount(next);
                    setQuarterRefereeTeams((prev) =>
                      Array.from({ length: next }, (_, i) => prev[i] ?? (i % 2 === 0 ? "TEAM_A" : "TEAM_B"))
                    );
                  }}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">쿼터별 시간</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuarterMinutes(Math.max(1, quarterMinutes - 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  −
                </button>
                <span className="w-12 text-center text-sm font-semibold text-gray-900">{quarterMinutes}분</span>
                <button
                  type="button"
                  onClick={() => setQuarterMinutes(Math.min(60, quarterMinutes + 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">쿼터 사이 쉬는시간</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuarterBreak(Math.max(0, quarterBreak - 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  −
                </button>
                <span className="w-12 text-center text-sm font-semibold text-gray-900">{quarterBreak}분</span>
                <button
                  type="button"
                  onClick={() => setQuarterBreak(Math.min(30, quarterBreak + 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  +
                </button>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500">총 경기시간</span>
              <span className="text-sm font-semibold text-gray-800">
                {quarterCount * quarterMinutes + quarterBreak * (quarterCount - 1)}분
              </span>
            </div>
          </div>
        </div>

        {/* 쿼터별 심판팀 */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">쿼터별 심판</label>
          <div className="grid gap-2">
            {Array.from({ length: quarterCount }, (_, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{i + 1}쿼터</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                  <button
                    type="button"
                    onClick={() =>
                      setQuarterRefereeTeams((prev) => prev.map((t, j) => (j === i ? "TEAM_A" : t)))
                    }
                    className={`px-3 py-1.5 transition-colors ${
                      quarterRefereeTeams[i] === "TEAM_A" ? "text-white" : "bg-white text-gray-500"
                    }`}
                    style={quarterRefereeTeams[i] === "TEAM_A" ? { backgroundColor: hostTeamColor } : {}}
                  >
                    {hostTeamName}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuarterRefereeTeams((prev) => prev.map((t, j) => (j === i ? "TEAM_B" : t)))
                    }
                    className={`px-3 py-1.5 transition-colors ${
                      quarterRefereeTeams[i] === "TEAM_B" ? "text-white" : "bg-white text-gray-500"
                    }`}
                    style={quarterRefereeTeams[i] === "TEAM_B" ? { backgroundColor: opponentTeamColor } : {}}
                  >
                    {opponentTeamName}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 킥오프 시간 */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">킥오프 시간</label>
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={kickoffTime}
              onChange={(e) => setKickoffTime(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
            {kickoffTime && (
              <div className="text-sm text-gray-500 shrink-0">
                → 종료{" "}
                <span className="font-semibold text-gray-900">
                  {(() => {
                    const [h, m] = kickoffTime.split(":").map(Number);
                    const totalMin = quarterCount * quarterMinutes + quarterBreak * (quarterCount - 1);
                    const endMin = h * 60 + m + totalMin;
                    return `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Step 2: 타입 체크**

```bash
cd /Users/huhyoujung/dev/football-log && npx tsc --noEmit 2>&1 | grep "MatchRulesBottomSheet"
```

Expected: 에러 없음

**Step 3: 커밋**

```bash
git add src/components/training/MatchRulesBottomSheet.tsx
git commit -m "feat: MatchRulesBottomSheet 공통 컴포넌트 추가"
```

---

## Task 3: ChallengeClient에 경기 방식 수정 기능 추가

**Files:**
- Modify: `src/app/invite/[token]/ChallengeClient.tsx`

**주의사항:**
- `opponentName`, `opponentColor`, `teamColor` 변수들이 현재 early return 이후에 정의됨
- 이 변수들을 `event` null 체크 직후, 첫 번째 early return 전으로 이동해야 함
- `MatchRulesBottomSheet` 1개를 컴포넌트 최하단에 배치, 모든 상태에서 공유

**Step 1: ChallengeClient 상단에 import 추가**

파일 상단 import 목록에 추가:
```typescript
import dynamic from "next/dynamic";
import { Pencil } from "lucide-react";
import MatchRulesBottomSheet from "@/components/training/MatchRulesBottomSheet";
```

`Pencil`은 이미 lucide-react에서 가져오는 아이콘 목록에 추가한다.

**Step 2: 상태 변수 추가**

`ChallengeClient` 컴포넌트 함수 내부, 기존 state 선언들 바로 아래에 추가:
```typescript
const [showRulesSheet, setShowRulesSheet] = useState(false);
```

**Step 3: 파생 변수를 early return 위로 이동**

현재 약 421~428줄에 있는 다음 변수들:
```typescript
const teamColor = event.team.primaryColor || "#1D4237";
const registeredOpponent = opponentTeam ?? receiverTeam;
const opponentColor = registeredOpponent?.primaryColor ?? "#374151";
const opponentName = registeredOpponent?.name ?? event.opponentTeamName ?? "상대팀";
```

이를 `if (!event) { ... }` 블록 바로 다음, `const isExpired = ...` 위에 이동한다.

**Step 4: handleSaveRules 핸들러 추가**

파생 변수들 바로 아래에:
```typescript
const handleSaveRules = async (rules: {
  quarterCount: number;
  quarterMinutes: number;
  quarterBreak: number;
  kickoffTime: string | null;
  quarterRefereeTeams: ("TEAM_A" | "TEAM_B")[];
}) => {
  const res = await fetch(`/api/challenge/${token}/rules`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rules),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "저장에 실패했습니다");
  }
  router.refresh();
};
```

**Step 5: IN_PROGRESS early return 수정**

현재:
```typescript
if (event.matchStatus === "IN_PROGRESS") {
  return <ChallengeLiveMode token={token} isLoggedIn={isLoggedIn} />;
}
```

변경 후:
```typescript
if (event.matchStatus === "IN_PROGRESS") {
  return (
    <>
      <ChallengeLiveMode token={token} isLoggedIn={isLoggedIn} />
      {isAdmin && (
        <button
          onClick={() => setShowRulesSheet(true)}
          className="fixed bottom-20 right-4 z-50 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center border border-gray-200 active:scale-95 transition-transform"
          title="경기 방식 수정"
        >
          <Pencil className="w-5 h-5 text-gray-600" />
        </button>
      )}
      {isAdmin && (
        <MatchRulesBottomSheet
          isOpen={showRulesSheet}
          onClose={() => setShowRulesSheet(false)}
          onSave={handleSaveRules}
          initialRules={event.matchRules ?? undefined}
          hostTeamName={event.team.name}
          opponentTeamName={opponentName}
          hostTeamColor={teamColor}
          opponentTeamColor={opponentColor}
        />
      )}
    </>
  );
}
```

**Step 6: ConfirmedView 컴포넌트에 props 추가**

ConfirmedView 함수 정의 변경:
```typescript
function ConfirmedView({
  token,
  event,
  isMatchDay,
  onStarted,
  isAdmin,          // 추가
  onEditRules,      // 추가
}: {
  token: string;
  event: ChallengeEvent;
  isMatchDay: boolean;
  onStarted: () => void;
  isAdmin: boolean;          // 추가
  onEditRules: () => void;   // 추가
}) {
```

ConfirmedView의 return JSX 안, 버튼 아래에 추가:
```typescript
{isAdmin && (
  <button
    onClick={onEditRules}
    className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm flex items-center justify-center gap-2"
  >
    <Pencil className="w-4 h-4" />
    경기 방식 수정
  </button>
)}
```

ConfirmedView 호출부 변경 (CONFIRMED 분기):
```typescript
if (event.matchStatus === "CONFIRMED") {
  const isMatchDay = new Date().toDateString() === new Date(event.date).toDateString();
  return (
    <>
      <ConfirmedView
        token={token}
        event={event}
        isMatchDay={isMatchDay}
        onStarted={() => router.refresh()}
        isAdmin={isAdmin}
        onEditRules={() => setShowRulesSheet(true)}
      />
      {isAdmin && (
        <MatchRulesBottomSheet
          isOpen={showRulesSheet}
          onClose={() => setShowRulesSheet(false)}
          onSave={handleSaveRules}
          initialRules={event.matchRules ?? undefined}
          hostTeamName={event.team.name}
          opponentTeamName={opponentName}
          hostTeamColor={teamColor}
          opponentTeamColor={opponentColor}
        />
      )}
    </>
  );
}
```

**Step 7: CHALLENGE_SENT 카드에 수정 버튼 추가**

CHALLENGE_SENT 상태에서 표시되는 카드 안 "경기 방식" 섹션의 헤딩 부분을 찾는다:
```typescript
<div className="flex items-center gap-1.5 mb-2">
  <Shield className="w-3.5 h-3.5 text-gray-400" />
  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">경기 방식</span>
</div>
```

변경 후 (헤딩을 flex justify-between으로, 수정 버튼 추가):
```typescript
<div className="flex items-center justify-between mb-2">
  <div className="flex items-center gap-1.5">
    <Shield className="w-3.5 h-3.5 text-gray-400" />
    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">경기 방식</span>
  </div>
  {isAdmin && (
    <button
      onClick={() => setShowRulesSheet(true)}
      className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
    >
      <Pencil className="w-3.5 h-3.5" />
    </button>
  )}
</div>
```

CHALLENGE_SENT 상태의 main return JSX 맨 끝, 거절 바텀시트 바로 위에 추가:
```typescript
{isAdmin && (
  <MatchRulesBottomSheet
    isOpen={showRulesSheet}
    onClose={() => setShowRulesSheet(false)}
    onSave={handleSaveRules}
    initialRules={event.matchRules ?? undefined}
    hostTeamName={event.team.name}
    opponentTeamName={opponentName}
    hostTeamColor={teamColor}
    opponentTeamColor={opponentColor}
  />
)}
```

**Step 8: 타입 체크**

```bash
cd /Users/huhyoujung/dev/football-log && npx tsc --noEmit 2>&1 | grep "ChallengeClient\|MatchRules"
```

Expected: 에러 없음

**Step 9: 빌드 확인**

```bash
cd /Users/huhyoujung/dev/football-log && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` 또는 `Route (app)` 목록에 에러 없음

**Step 10: 커밋**

```bash
git add src/app/invite/\[token\]/ChallengeClient.tsx
git commit -m "feat: /invite/[token]에서 경기 방식 수정 기능 추가 (양팀 운영진)"
```

---

## 검증 체크리스트

구현 완료 후 로컬에서 확인:

1. **CHALLENGE_SENT** (도전장 대기 상태)
   - 운영진 로그인 시: "경기 방식" 옆 연필 아이콘 표시
   - 클릭 시 바텀시트 열림, 현재 값으로 초기화
   - 저장 후 카드의 경기 방식 정보 갱신 확인

2. **CONFIRMED** (매칭 성사 상태)
   - 운영진 로그인 시: "경기 방식 수정" 버튼 표시
   - 저장 후 화면 갱신 확인

3. **IN_PROGRESS** (경기 진행 중)
   - 운영진 로그인 시: 우측 하단 연필 FAB 표시
   - 클릭 시 바텀시트 오버레이

4. **비운영진 (일반 멤버)**
   - 모든 상태에서 수정 버튼 미노출 확인

5. **상대팀 운영진**
   - CONFIRMED 이후 상태에서 수정 가능 확인

6. **API 직접 테스트** (선택)
   - COMPLETED 이벤트 토큰으로 PATCH 시 400 에러 확인
