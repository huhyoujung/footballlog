import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// PATCH /api/training-events/[id]/match-status - 경기 상태 변경 (ADMIN 전용)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 경기 상태를 변경할 수 있습니다" }, { status: 403 });
    }

    const { id } = await params;
    const { status } = await req.json();

    if (!["IN_PROGRESS", "COMPLETED"].includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 상태입니다" }, { status: 400 });
    }

    const event = await prisma.trainingEvent.findUnique({
      where: { id },
      select: { id: true, teamId: true, matchStatus: true, linkedEventId: true },
    });

    if (!event) return NextResponse.json({ error: "이벤트를 찾을 수 없습니다" }, { status: 404 });
    if (event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const updated = await prisma.trainingEvent.update({
      where: { id },
      data: { matchStatus: status },
    });

    // 양방향 동기화: host→opponent 또는 opponent→host
    if (event.linkedEventId) {
      // 현재 이벤트가 host (linkedEventId = opponent)
      await prisma.trainingEvent.update({
        where: { id: event.linkedEventId },
        data: { matchStatus: status },
      });
    } else {
      // 현재 이벤트가 opponent일 수 있음 → host 찾아서 동기화
      const hostEvent = await prisma.trainingEvent.findFirst({
        where: { linkedEventId: id },
        select: { id: true },
      });
      if (hostEvent) {
        await prisma.trainingEvent.update({
          where: { id: hostEvent.id },
          data: { matchStatus: status },
        });
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Match status update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
