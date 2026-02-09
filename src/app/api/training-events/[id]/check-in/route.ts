import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 체크인 목록 조회
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const checkIns = await prisma.checkIn.findMany({
      where: { trainingEventId: id },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
      orderBy: { checkedInAt: "asc" },
    });

    return NextResponse.json({ checkIns });
  } catch (error) {
    console.error("체크인 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// 체크인 기록
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

    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    // 시간 검증: 운동 시작 2시간 전 ~ 2시간 후까지 체크인 가능
    const now = new Date();
    const twoHoursBefore = new Date(event.date.getTime() - 2 * 60 * 60 * 1000);
    const twoHoursAfter = new Date(event.date.getTime() + 2 * 60 * 60 * 1000);

    if (now < twoHoursBefore) {
      return NextResponse.json({ error: "운동 2시간 전부터 체크인할 수 있습니다" }, { status: 400 });
    }

    if (now > twoHoursAfter) {
      return NextResponse.json({ error: "체크인 시간이 종료되었습니다" }, { status: 400 });
    }

    // RSVP 확인 (ATTEND 또는 LATE만 체크인 가능)
    const rsvp = await prisma.rsvp.findUnique({
      where: {
        trainingEventId_userId: {
          trainingEventId: id,
          userId: session.user.id,
        },
      },
    });

    if (!rsvp || (rsvp.status !== "ATTEND" && rsvp.status !== "LATE")) {
      return NextResponse.json({ error: "참석 응답한 사람만 체크인할 수 있습니다" }, { status: 400 });
    }

    // 중복 체크
    const existing = await prisma.checkIn.findUnique({
      where: {
        trainingEventId_userId: {
          trainingEventId: id,
          userId: session.user.id,
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "이미 체크인했습니다" }, { status: 409 });
    }

    const isLate = now > event.date;

    const checkIn = await prisma.checkIn.create({
      data: {
        trainingEventId: id,
        userId: session.user.id,
        checkedInAt: now,
        isLate,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(checkIn, { status: 201 });
  } catch (error) {
    console.error("체크인 오류:", error);
    return NextResponse.json({ error: "체크인에 실패했습니다" }, { status: 500 });
  }
}

// 체크인 취소
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

    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    // 체크인 기록 확인
    const existing = await prisma.checkIn.findUnique({
      where: {
        trainingEventId_userId: {
          trainingEventId: id,
          userId: session.user.id,
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "체크인 기록이 없습니다" }, { status: 404 });
    }

    // 체크인 삭제
    await prisma.checkIn.delete({
      where: {
        trainingEventId_userId: {
          trainingEventId: id,
          userId: session.user.id,
        },
      },
    });

    return NextResponse.json({ message: "체크인이 취소되었습니다" });
  } catch (error) {
    console.error("체크인 취소 오류:", error);
    return NextResponse.json({ error: "취소에 실패했습니다" }, { status: 500 });
  }
}
