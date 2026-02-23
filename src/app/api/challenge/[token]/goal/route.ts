import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkChallengeRecordAuth } from "@/lib/challenge-auth";
import { prisma } from "@/lib/prisma";
import { updateMatchScore } from "@/lib/match-helpers";

// POST /api/challenge/[token]/goal - 도전장 링크로 골 기록 (양팀 모두 가능)
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
    const auth = await checkChallengeRecordAuth(
      token,
      session.user.id,
      session.user.teamId,
      session.user.role === "ADMIN"
    );

    if (!auth) {
      return NextResponse.json({ error: "기록 권한이 없습니다" }, { status: 403 });
    }

    const { quarter, minute, scoringTeam, scorerId, assistId, isOwnGoal } = await req.json();

    if (!quarter || !scoringTeam) {
      return NextResponse.json({ error: "쿼터와 득점팀은 필수입니다" }, { status: 400 });
    }

    const goal = await prisma.goalRecord.create({
      data: {
        trainingEventId: auth.eventId,
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

    await updateMatchScore(auth.eventId, auth.linkedEventId);

    return NextResponse.json({ goal });
  } catch (error) {
    console.error("Challenge goal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
