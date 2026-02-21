import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const userSelect = { id: true, name: true, image: true };

// GET /api/challenge/[token]/live - 라이브 경기 데이터 (인증 불필요, token = 접근 권한)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const event = await prisma.trainingEvent.findUnique({
      where: { challengeToken: token },
      select: {
        id: true,
        matchStatus: true,
        teamAScore: true,
        teamBScore: true,
        team: { select: { id: true, name: true, primaryColor: true, logoUrl: true } },
        opponentTeam: { select: { id: true, name: true, primaryColor: true, logoUrl: true } },
        opponentTeamName: true,
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
        rsvps: {
          where: { status: "ATTEND" },
          select: { user: { select: userSelect } },
        },
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
                  select: {
                    teamLabel: true,
                    user: { select: userSelect },
                  },
                },
              },
            },
          },
        },
        sessions: {
          orderBy: { orderIndex: "asc" },
          select: {
            orderIndex: true,
            title: true,
            teamAssignments: {
              select: {
                teamLabel: true,
                user: { select: userSelect },
              },
            },
          },
        },
        goalRecords: {
          orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            quarter: true,
            minute: true,
            scoringTeam: true,
            isOwnGoal: true,
            createdAt: true,
            scorer: { select: userSelect },
            assistant: { select: userSelect },
          },
        },
        cardRecords: {
          orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            quarter: true,
            minute: true,
            cardType: true,
            teamSide: true,
            createdAt: true,
            player: { select: userSelect },
          },
        },
        playerSubstitutions: {
          orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
          select: {
            id: true,
            quarter: true,
            minute: true,
            teamSide: true,
            createdAt: true,
            playerOut: { select: userSelect },
            playerIn: { select: userSelect },
          },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "유효하지 않은 도전장" }, { status: 404 });
    }

    if (event.matchStatus !== "IN_PROGRESS") {
      return NextResponse.json({ error: "경기가 진행 중이 아닙니다", matchStatus: event.matchStatus }, { status: 400 });
    }

    // 로그인 사용자라면 기록 권한 확인
    const session = await getServerSession(authOptions);
    let canRecord = false;
    if (session?.user?.id) {
      const userId = session.user.id;
      const userTeamId = session.user.teamId;
      const isAdmin = session.user.role === "ADMIN";
      const isHostTeam = userTeamId === event.team.id;
      const isOpponentTeam = !!event.opponentTeam && userTeamId === event.opponentTeam.id;

      const hostAttending = event.rsvps.some((r) => r.user.id === userId);
      const opponentAttending = event.linkedEvent?.rsvps.some((r) => r.user.id === userId) ?? false;

      canRecord =
        (isHostTeam && (hostAttending || isAdmin)) ||
        (isOpponentTeam && (opponentAttending || isAdmin));
    }

    const canEnd =
      session?.user?.role === "ADMIN" &&
      session?.user?.teamId
        ? [event.team.id, event.opponentTeam?.id].includes(session.user.teamId)
        : false;

    return NextResponse.json({
      matchStatus: event.matchStatus,
      teamAScore: event.teamAScore,
      teamBScore: event.teamBScore,
      teamA: event.team,
      teamB: event.opponentTeam ?? { id: null, name: event.opponentTeamName ?? "상대팀", primaryColor: "#374151", logoUrl: null },
      teamAAttendees: event.rsvps.map((r) => r.user),
      teamBAttendees: event.linkedEvent?.rsvps.map((r) => r.user) ?? [],
      quarterCount: event.matchRules?.quarterCount ?? 4,
      quarterMinutes: event.matchRules?.quarterMinutes ?? 12,
      quarterBreak: event.matchRules?.quarterBreak ?? 2,
      halftime: event.matchRules?.halftime ?? 5,
      timerPhase: event.matchRules?.currentPhase ?? 0,
      timerRunning: !!event.matchRules?.timerStartedAt,
      timerStartedAt: event.matchRules?.timerStartedAt?.toISOString() ?? null,
      timerElapsedSec: event.matchRules?.timerElapsedSec ?? 0,
      goalRecords: event.goalRecords,
      cardRecords: event.cardRecords,
      playerSubstitutions: event.playerSubstitutions,
      canRecord,
      canEnd,
      myTeamSessions: (() => {
        if (!session?.user?.teamId) return [];
        const userTeamId = session.user.teamId;
        const isHostTeam = userTeamId === event.team.id;
        const isOpponentTeam = !!event.opponentTeam && userTeamId === event.opponentTeam.id;
        if (isHostTeam) return event.sessions;
        if (isOpponentTeam) return event.linkedEvent?.sessions ?? [];
        return [];
      })(),
    });
  } catch (error) {
    console.error("Challenge live error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
