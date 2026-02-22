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
