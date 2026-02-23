import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const flip = (side: string) => (side === "TEAM_A" ? "TEAM_B" : "TEAM_A");

// POST /api/training-events/[id]/cards - 카드 기록 생성
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

    // 상대팀 이벤트인 경우 host 이벤트로 리다이렉트
    let targetEventId = trainingEventId;
    let isOpponentEvent = false;
    if (event.isFriendlyMatch && !event.linkedEventId && event.opponentTeamId) {
      const hostEvent = await prisma.trainingEvent.findFirst({
        where: { linkedEventId: trainingEventId },
        select: { id: true, matchStatus: true },
      });
      if (hostEvent) {
        if (hostEvent.matchStatus !== "IN_PROGRESS") return NextResponse.json({ error: "경기가 진행 중이 아닙니다" }, { status: 400 });
        targetEventId = hostEvent.id;
        isOpponentEvent = true;
      } else {
        if (event.matchStatus !== "IN_PROGRESS") return NextResponse.json({ error: "경기가 진행 중이 아닙니다" }, { status: 400 });
      }
    } else {
      if (event.matchStatus !== "IN_PROGRESS") return NextResponse.json({ error: "경기가 진행 중이 아닙니다" }, { status: 400 });
    }

    const isAttending = event.rsvps.some((r) => r.userId === session.user.id);
    const isAdmin = session.user.role === "ADMIN";
    if (!isAttending && !isAdmin) {
      return NextResponse.json({ error: "참석 확정 멤버만 기록할 수 있습니다" }, { status: 403 });
    }

    const { quarter, minute, cardType, teamSide: rawTeamSide, playerId } = await req.json();

    if (!quarter || !cardType || !rawTeamSide) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다" }, { status: 400 });
    }

    const teamSide = isOpponentEvent ? flip(rawTeamSide) : rawTeamSide;

    // TEAM_A(우리팀 = host 기준)는 선수 필수, TEAM_B(상대팀)는 선택
    if (teamSide === "TEAM_A" && !playerId) {
      return NextResponse.json({ error: "우리팀 카드는 선수를 선택해야 합니다" }, { status: 400 });
    }

    const card = await prisma.cardRecord.create({
      data: {
        trainingEventId: targetEventId,
        quarter,
        minute: minute ?? null,
        cardType,
        teamSide,
        playerId: playerId || null,
        recordedById: session.user.id,
      },
      include: {
        player: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json({ card });
  } catch (error) {
    console.error("Card record error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
