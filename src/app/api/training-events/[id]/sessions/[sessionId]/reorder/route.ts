import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증되지 않았습니다" }, { status: 401 });
    }

    const { id, sessionId } = await params;
    const { direction } = await req.json();

    // 이벤트 조회 (권한 확인용)
    const event = await prisma.trainingEvent.findUnique({
      where: { id },
      include: { sessions: { orderBy: { orderIndex: "asc" } } },
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

    // 현재 세션 찾기
    const currentIndex = event.sessions.findIndex((s) => s.id === sessionId);
    if (currentIndex === -1) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다" }, { status: 404 });
    }

    // 이동 가능 여부 확인
    if (direction === "up" && currentIndex === 0) {
      return NextResponse.json({ error: "첫 번째 세션은 위로 이동할 수 없습니다" }, { status: 400 });
    }
    if (direction === "down" && currentIndex === event.sessions.length - 1) {
      return NextResponse.json({ error: "마지막 세션은 아래로 이동할 수 없습니다" }, { status: 400 });
    }

    const currentSession = event.sessions[currentIndex];
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    const targetSession = event.sessions[targetIndex];

    // orderIndex 교환
    await prisma.$transaction([
      prisma.trainingSession.update({
        where: { id: currentSession.id },
        data: { orderIndex: targetSession.orderIndex },
      }),
      prisma.trainingSession.update({
        where: { id: targetSession.id },
        data: { orderIndex: currentSession.orderIndex },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("세션 순서 변경 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
