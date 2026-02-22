import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 어드민 수동 체크인 추가
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

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId가 필요합니다" }, { status: 400 });
    }

    // 이벤트가 같은 팀인지 확인
    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    // 대상 유저가 같은 팀인지 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, teamId: true, name: true, image: true },
    });

    if (!targetUser || targetUser.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "같은 팀 팀원이 아닙니다" }, { status: 403 });
    }

    // 중복 체크
    const existing = await prisma.checkIn.findUnique({
      where: { trainingEventId_userId: { trainingEventId: id, userId } },
    });

    if (existing) {
      return NextResponse.json({ error: "이미 체크인되어 있습니다" }, { status: 409 });
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        trainingEventId: id,
        userId,
        checkedInAt: new Date(),
        isLate: false,
        manualEntry: true,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(checkIn, { status: 201 });
  } catch (error) {
    console.error("어드민 체크인 오류:", error);
    return NextResponse.json({ error: "체크인에 실패했습니다" }, { status: 500 });
  }
}

// 어드민 수동 체크인 취소
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

    // 이벤트 + 팀 확인
    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    // 체크인 기록 존재 여부 확인
    const existing = await prisma.checkIn.findUnique({
      where: { trainingEventId_userId: { trainingEventId: id, userId } },
    });

    if (!existing) {
      return NextResponse.json({ error: "체크인 기록이 없습니다" }, { status: 404 });
    }

    await prisma.checkIn.delete({
      where: { trainingEventId_userId: { trainingEventId: id, userId } },
    });

    return NextResponse.json({ message: "체크인이 취소되었습니다" });
  } catch (error) {
    console.error("어드민 체크인 취소 오류:", error);
    return NextResponse.json({ error: "취소에 실패했습니다" }, { status: 500 });
  }
}
