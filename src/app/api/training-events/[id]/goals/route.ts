import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateMatchScore } from "@/lib/match-helpers";

const flip = (side: string) => (side === "TEAM_A" ? "TEAM_B" : "TEAM_A");

// POST /api/training-events/[id]/goals - 골 기록 생성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { id: trainingEventId } = await params;

    const event = await prisma.trainingEvent.findUnique({
      where: { id: trainingEventId },
      select: {
        id: true, teamId: true, matchStatus: true, linkedEventId: true,
        isFriendlyMatch: true, opponentTeamId: true,
        rsvps: { where: { status: "ATTEND" }, select: { userId: true } },
      },
    });

    if (!event) return NextResponse.json({ error: "이벤트를 찾을 수 없습니다" }, { status: 404 });
    if (event.teamId !== session.user.teamId) return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });

    // 상대팀 이벤트인 경우 host 이벤트로 리다이렉트 (records는 항상 host에 저장)
    let targetEventId = trainingEventId;
    let targetLinkedEventId = event.linkedEventId;
    let isOpponentEvent = false;
    if (event.isFriendlyMatch && !event.linkedEventId && event.opponentTeamId) {
      const hostEvent = await prisma.trainingEvent.findFirst({
        where: { linkedEventId: trainingEventId },
        select: { id: true, matchStatus: true },
      });
      if (hostEvent) {
        if (hostEvent.matchStatus !== "IN_PROGRESS") return NextResponse.json({ error: "경기가 진행 중이 아닙니다" }, { status: 400 });
        targetEventId = hostEvent.id;
        targetLinkedEventId = trainingEventId;
        isOpponentEvent = true;
      } else {
        if (event.matchStatus !== "IN_PROGRESS") return NextResponse.json({ error: "경기가 진행 중이 아닙니다" }, { status: 400 });
      }
    } else {
      if (event.matchStatus !== "IN_PROGRESS") return NextResponse.json({ error: "경기가 진행 중이 아닙니다" }, { status: 400 });
    }

    // 참석 확정 멤버만 기록 가능
    const isAttending = event.rsvps.some((r) => r.userId === session.user.id);
    const isAdmin = session.user.role === "ADMIN";
    if (!isAttending && !isAdmin) {
      return NextResponse.json({ error: "참석 확정 멤버만 기록할 수 있습니다" }, { status: 403 });
    }

    const { quarter, minute, scoringTeam: rawScoringTeam, scorerId, assistId, isOwnGoal } = await req.json();

    if (!quarter || !rawScoringTeam) {
      return NextResponse.json({ error: "쿼터와 득점팀은 필수입니다" }, { status: 400 });
    }

    // 상대팀 이벤트 기록 시 TEAM_A↔B 플립 (host 기준: TEAM_A=host팀, TEAM_B=상대팀)
    const scoringTeam = isOpponentEvent ? flip(rawScoringTeam) : rawScoringTeam;

    const goal = await prisma.goalRecord.create({
      data: {
        trainingEventId: targetEventId,
        quarter,
        minute: minute ?? null,
        scoringTeam,
        scorerId: scorerId || null,
        assistId: assistId || null,
        isOwnGoal: isOwnGoal ?? false,
        recordedById: session.user.id,
      },
      include: {
        scorer: { select: { id: true, name: true, image: true } },
        assistant: { select: { id: true, name: true, image: true } },
      },
    });

    await updateMatchScore(targetEventId, targetLinkedEventId);

    return NextResponse.json({ goal });
  } catch (error) {
    console.error("Goal record error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
