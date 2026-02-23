import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 어드민 RSVP 수동 설정 (마감 무관, 사유 불필요)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 사용할 수 있습니다" }, { status: 403 });
    }

    const { userId, status } = await req.json();

    if (!userId || !["ATTEND", "ABSENT", "LATE", "NO_SHOW"].includes(status)) {
      return NextResponse.json({ error: "올바른 요청이 아닙니다" }, { status: 400 });
    }

    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, teamId: true },
    });

    if (!targetUser || targetUser.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "같은 팀 팀원이 아닙니다" }, { status: 403 });
    }

    const rsvp = await prisma.rsvp.upsert({
      where: {
        trainingEventId_userId: { trainingEventId: id, userId },
      },
      update: { status, reason: null },
      create: {
        trainingEventId: id,
        userId,
        status,
        reason: null,
      },
    });

    return NextResponse.json(rsvp);
  } catch (error) {
    console.error("어드민 RSVP 설정 오류:", error);
    return NextResponse.json({ error: "설정에 실패했습니다" }, { status: 500 });
  }
}

// 어드민 RSVP 삭제 (미응답으로 되돌리기)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 사용할 수 있습니다" }, { status: 403 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId가 필요합니다" }, { status: 400 });
    }

    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    const existing = await prisma.rsvp.findUnique({
      where: { trainingEventId_userId: { trainingEventId: id, userId } },
    });

    if (!existing) {
      return NextResponse.json({ error: "RSVP 기록이 없습니다" }, { status: 404 });
    }

    await prisma.rsvp.delete({
      where: { trainingEventId_userId: { trainingEventId: id, userId } },
    });

    return NextResponse.json({ message: "RSVP가 삭제되었습니다" });
  } catch (error) {
    console.error("어드민 RSVP 삭제 오류:", error);
    return NextResponse.json({ error: "삭제에 실패했습니다" }, { status: 500 });
  }
}
