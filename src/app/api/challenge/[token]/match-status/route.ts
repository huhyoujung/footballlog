import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST /api/challenge/[token]/match-status - 도전장 링크에서 경기 상태 변경 (양팀 ADMIN 가능)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 경기 상태를 변경할 수 있습니다" }, { status: 403 });
    }

    const { token } = await params;
    const { status } = await req.json();

    if (!["IN_PROGRESS", "COMPLETED"].includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태입니다" }, { status: 400 });
    }

    const hostEvent = await prisma.trainingEvent.findUnique({
      where: { challengeToken: token },
      select: { id: true, teamId: true, matchStatus: true, linkedEventId: true },
    });

    if (!hostEvent) {
      return NextResponse.json({ error: "이벤트를 찾을 수 없습니다" }, { status: 404 });
    }

    // 호스트팀 또는 상대팀 어드민인지 확인
    const isHostTeam = hostEvent.teamId === session.user.teamId;
    const isOpponentTeam = hostEvent.linkedEventId
      ? await prisma.trainingEvent.findFirst({
          where: { id: hostEvent.linkedEventId, teamId: session.user.teamId },
          select: { id: true },
        }).then(Boolean)
      : false;

    if (!isHostTeam && !isOpponentTeam) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 호스트 이벤트 업데이트
    await prisma.trainingEvent.update({
      where: { id: hostEvent.id },
      data: { matchStatus: status },
    });

    // 상대팀 이벤트도 업데이트
    if (hostEvent.linkedEventId) {
      await prisma.trainingEvent.update({
        where: { id: hostEvent.linkedEventId },
        data: { matchStatus: status },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Challenge match-status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
