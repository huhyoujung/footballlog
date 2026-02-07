import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// 지각비 목록 조회
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

    const lateFees = await prisma.lateFee.findMany({
      where: { trainingEventId: id },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ lateFees });
  } catch (error) {
    console.error("지각비 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// 지각비 부과 (ADMIN)
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
      return NextResponse.json({ error: "운영진만 부과할 수 있습니다" }, { status: 403 });
    }

    const { userId, amount } = await req.json();

    if (!userId || !amount || amount <= 0) {
      return NextResponse.json({ error: "대상과 금액을 입력해주세요" }, { status: 400 });
    }

    const lateFee = await prisma.lateFee.create({
      data: {
        trainingEventId: id,
        userId,
        amount,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    // 푸시 알림
    try {
      await sendPushToUsers([userId], {
        title: "지각비 알림",
        body: `지각비 ${amount.toLocaleString()}원이 부과되었습니다`,
        url: `/training/${id}`,
      });
    } catch {
      // 푸시 실패해도 계속
    }

    return NextResponse.json(lateFee, { status: 201 });
  } catch (error) {
    console.error("지각비 부과 오류:", error);
    return NextResponse.json({ error: "부과에 실패했습니다" }, { status: 500 });
  }
}
