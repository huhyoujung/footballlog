import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// 닦달 보내기
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const { recipientId } = await req.json();

    if (!recipientId) {
      return NextResponse.json({ error: "대상을 선택해주세요" }, { status: 400 });
    }

    if (recipientId === session.user.id) {
      return NextResponse.json({ error: "자기 자신은 닦달할 수 없어요" }, { status: 400 });
    }

    // 같은 팀인지 확인
    const recipient = await prisma.user.findFirst({
      where: { id: recipientId, teamId: session.user.teamId },
    });

    if (!recipient) {
      return NextResponse.json({ error: "같은 팀원만 닦달할 수 있어요" }, { status: 400 });
    }

    // 1시간 내 중복 확인
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
    const existing = await prisma.nudge.findFirst({
      where: {
        senderId: session.user.id,
        recipientId,
        createdAt: { gte: oneHourAgo },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "1시간 뒤에 다시 닦달할 수 있어요!" }, { status: 429 });
    }

    // 닦달 생성
    const nudge = await prisma.nudge.create({
      data: {
        senderId: session.user.id,
        recipientId,
        teamId: session.user.teamId,
      },
      include: {
        sender: { select: { name: true } },
        recipient: { select: { name: true } },
      },
    });

    // 대상에게 푸시 알림
    try {
      console.log(`[NUDGE] Sending push to user ${recipientId}`);
      const results = await sendPushToUsers([recipientId], {
        title: "💪 닦달!",
        body: `${session.user.name || "팀원"}님이 운동하래요! 일지 올려주세요~`,
        url: "/write",
      });
      console.log(`[NUDGE] Push sent, results:`, results);
    } catch (error) {
      console.error('[NUDGE] Push notification failed:', error);
      // 푸시 실패해도 닦달은 생성됨
    }

    return NextResponse.json(nudge, { status: 201 });
  } catch (error) {
    console.error("닦달 오류:", error);
    return NextResponse.json({ error: "닦달에 실패했습니다" }, { status: 500 });
  }
}

// 최근 닦달 목록 (피드 배너용)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

    const nudges = await prisma.nudge.findMany({
      where: {
        teamId: session.user.teamId,
        createdAt: { gte: oneHourAgo },
      },
      include: {
        sender: { select: { id: true, name: true } },
        recipient: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ nudges });
  } catch (error) {
    console.error("닦달 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}
