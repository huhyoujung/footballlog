import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증되지 않았습니다" }, { status: 401 });
    }

    const { id } = await params;
    const { sessionIds } = await req.json();

    if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
      return NextResponse.json({ error: "유효하지 않은 요청입니다" }, { status: 400 });
    }

    // 이벤트 조회 (권한 확인용)
    const event = await prisma.trainingEvent.findUnique({
      where: { id },
      include: { sessions: true },
    });

    if (!event) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    // ADMIN 권한 확인
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, teamId: true },
    });

    if (user?.role !== "ADMIN" || user.teamId !== event.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 모든 세션 ID가 이벤트에 속하는지 확인
    const eventSessionIds = event.sessions.map((s) => s.id);
    const allIdsValid = sessionIds.every((id) => eventSessionIds.includes(id));
    if (!allIdsValid) {
      return NextResponse.json({ error: "유효하지 않은 세션 ID가 포함되어 있습니다" }, { status: 400 });
    }

    // 트랜잭션으로 모든 orderIndex 업데이트
    await prisma.$transaction(
      sessionIds.map((sessionId, index) =>
        prisma.trainingSession.update({
          where: { id: sessionId },
          data: { orderIndex: index },
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("세션 순서 변경 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
