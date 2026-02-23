import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { buildPhases } from "@/lib/match-phases";

type TimerAction = "start" | "pause" | "next" | "prev" | "setPhase";

// POST /api/challenge/[token]/timer - 쿼터 타이머 제어 (start/pause/next/prev)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { token } = await params;

    const event = await prisma.trainingEvent.findUnique({
      where: { challengeToken: token },
      select: {
        id: true,
        matchStatus: true,
        team: { select: { id: true } },
        opponentTeam: { select: { id: true } },
        matchRules: {
          select: {
            id: true,
            currentPhase: true,
            timerStartedAt: true,
            timerElapsedSec: true,
            quarterCount: true,
            quarterMinutes: true,
            quarterBreak: true,
            halftime: true,
          },
        },
        rsvps: {
          where: { status: "ATTEND" },
          select: { user: { select: { id: true } } },
        },
        linkedEvent: {
          select: {
            id: true,
            rsvps: {
              where: { status: "ATTEND" },
              select: { user: { select: { id: true } } },
            },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "유효하지 않은 도전장" }, { status: 404 });
    }

    if (event.matchStatus !== "IN_PROGRESS") {
      return NextResponse.json({ error: "경기가 진행 중이 아닙니다" }, { status: 400 });
    }

    if (!event.matchRules) {
      return NextResponse.json({ error: "경기 규칙이 설정되지 않았습니다" }, { status: 400 });
    }

    // 권한 확인 (canRecord)
    const userId = session.user.id;
    const userTeamId = session.user.teamId;
    const isAdmin = session.user.role === "ADMIN";
    const isHostTeam = userTeamId === event.team.id;
    const isOpponentTeam = !!event.opponentTeam && userTeamId === event.opponentTeam.id;

    const hostAttending = event.rsvps.some((r) => r.user.id === userId);
    const opponentAttending = event.linkedEvent?.rsvps.some((r) => r.user.id === userId) ?? false;

    const canRecord =
      (isHostTeam && (hostAttending || isAdmin)) ||
      (isOpponentTeam && (opponentAttending || isAdmin));

    if (!canRecord) {
      return NextResponse.json({ error: "기록 권한이 없습니다" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { action, phase: targetPhase } = body as { action: unknown; phase?: number };
    const validActions = ["start", "pause", "next", "prev", "setPhase"];
    if (!action || !validActions.includes(action as string)) {
      return NextResponse.json({ error: "유효하지 않은 action" }, { status: 400 });
    }
    const rules = event.matchRules;
    const now = new Date();
    const isRunning = rules.timerStartedAt !== null;

    // pause 시 elapsed 누적 계산
    const calcPausedElapsed = (): number => {
      if (!isRunning || !rules.timerStartedAt) return rules.timerElapsedSec;
      const diffSec = Math.floor(
        (now.getTime() - rules.timerStartedAt.getTime()) / 1000
      );
      return rules.timerElapsedSec + Math.max(0, diffSec);
    };

    let updateData: {
      currentPhase?: number;
      timerStartedAt?: Date | null;
      timerElapsedSec?: number;
    } = {};

    switch (action) {
      case "start": {
        if (isRunning) {
          // 이미 실행 중이면 no-op: 현재 상태 그대로 반환
          break;
        }
        updateData = {
          timerStartedAt: now,
        };
        break;
      }

      case "pause": {
        if (!isRunning) {
          // 이미 정지 중이면 no-op: 현재 상태 그대로 반환
          break;
        }
        updateData = {
          timerElapsedSec: calcPausedElapsed(),
          timerStartedAt: null,
        };
        break;
      }

      case "next": {
        const phases = buildPhases(
          rules.quarterCount,
          rules.quarterMinutes,
          rules.quarterBreak,
          rules.halftime
        );
        if (rules.currentPhase >= phases.length) {
          return NextResponse.json({ error: "이미 마지막 페이즈입니다" }, { status: 400 });
        }
        const newPhase = rules.currentPhase + 1;
        updateData = {
          timerElapsedSec: 0,
          timerStartedAt: now,
          currentPhase: newPhase,
        };
        break;
      }

      case "prev": {
        if (rules.currentPhase <= 0) {
          return NextResponse.json({ error: "이미 첫 번째 페이즈입니다" }, { status: 400 });
        }
        const prevPhase = Math.max(0, rules.currentPhase - 1);
        updateData = {
          timerElapsedSec: 0,
          timerStartedAt: now,
          currentPhase: prevPhase,
        };
        break;
      }

      case "setPhase": {
        const phases = buildPhases(
          rules.quarterCount,
          rules.quarterMinutes,
          rules.quarterBreak,
          rules.halftime
        );
        if (typeof targetPhase !== "number" || targetPhase < 1 || targetPhase > phases.length) {
          return NextResponse.json({ error: "유효하지 않은 페이즈 번호" }, { status: 400 });
        }
        updateData = {
          timerElapsedSec: 0,
          timerStartedAt: now,
          currentPhase: targetPhase,
        };
        break;
      }

      default:
        return NextResponse.json({ error: "유효하지 않은 action입니다" }, { status: 400 });
    }

    // DB 업데이트 (no-op이면 updateData가 비어있음)
    const updated =
      Object.keys(updateData).length > 0
        ? await prisma.matchRules.update({
            where: { id: rules.id },
            data: updateData,
            select: {
              currentPhase: true,
              timerStartedAt: true,
              timerElapsedSec: true,
              quarterCount: true,
              quarterMinutes: true,
              quarterBreak: true,
              halftime: true,
            },
          })
        : rules;

    return NextResponse.json({
      currentPhase: updated.currentPhase,
      timerRunning: updated.timerStartedAt !== null,
      timerStartedAt: updated.timerStartedAt?.toISOString() ?? null,
      timerElapsedSec: updated.timerElapsedSec,
      quarterCount: updated.quarterCount,
      quarterMinutes: updated.quarterMinutes,
      quarterBreak: updated.quarterBreak,
      halftime: updated.halftime,
    });
  } catch (error) {
    console.error("Challenge timer error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
