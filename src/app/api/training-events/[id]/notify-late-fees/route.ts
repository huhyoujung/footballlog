import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// 지각비 알림 전송 (ADMIN)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: trainingEventId } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 알림을 보낼 수 있습니다" }, { status: 403 });
    }

    // 운동 정보 조회
    const event = await prisma.trainingEvent.findUnique({
      where: { id: trainingEventId },
      select: {
        id: true,
        title: true,
        teamId: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    if (event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 미납 지각비만 조회 (PAID 상태 제외)
    const lateFees = await prisma.lateFee.findMany({
      where: {
        trainingEventId,
        status: "PENDING", // 미납만
      },
      select: {
        userId: true,
        amount: true,
      },
    });

    if (lateFees.length === 0) {
      return NextResponse.json(
        { error: "미납 지각비가 없습니다" },
        { status: 400 }
      );
    }

    // 사용자별로 알림 전송 (금액이 다를 수 있으므로)
    const notifications = lateFees.map(async (fee) => {
      await sendPushToUsers([fee.userId], {
        title: "💰 지각비 알림",
        body: `지각비 ${fee.amount.toLocaleString()}원이 부과되었습니다`,
        url: `/training/${trainingEventId}`,
      });
    });

    await Promise.allSettled(notifications);

    // 중복 제거 (한 사람에게 여러 지각비 부과 가능)
    const uniqueUserIds = [...new Set(lateFees.map((f) => f.userId))];

    return NextResponse.json({
      message: "알림이 전송되었습니다",
      recipientCount: uniqueUserIds.length,
      totalFees: lateFees.length,
    });
  } catch (error) {
    console.error("지각비 알림 전송 오류:", error);
    return NextResponse.json({ error: "알림 전송에 실패했습니다" }, { status: 500 });
  }
}
