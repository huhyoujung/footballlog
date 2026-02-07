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
      return NextResponse.json({ error: "공고를 찾을 수 없습니다" }, { status: 404 });
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

    const now = new Date();
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
