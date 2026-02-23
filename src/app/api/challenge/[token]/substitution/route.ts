import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkChallengeRecordAuth } from "@/lib/challenge-auth";
import { prisma } from "@/lib/prisma";

// POST /api/challenge/[token]/substitution - 도전장 링크로 교체 기록 (양팀 모두 가능)
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

    const { quarter, minute, teamSide, playerOutId, playerInId } = await req.json();

    if (!quarter || !teamSide) {
      return NextResponse.json({ error: "필수 항목이 누락되었습니다" }, { status: 400 });
    }

    const substitution = await prisma.playerSubstitution.create({
      data: {
        trainingEventId: auth.eventId,
        quarter,
        minute: minute ?? null,
        teamSide,
        playerOutId: playerOutId || null,
        playerInId: playerInId || null,
        recordedById: session.user.id,
      },
      include: {
        playerOut: { select: { id: true, name: true, image: true } },
        playerIn: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json({ substitution });
  } catch (error) {
    console.error("Challenge substitution error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
