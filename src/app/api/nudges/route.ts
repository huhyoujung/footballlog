import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import webPush from "web-push";

webPush.setVapidDetails(
  "mailto:noreply@football-log.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

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

    // 24시간 내 중복 확인
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const existing = await prisma.nudge.findFirst({
      where: {
        senderId: session.user.id,
        recipientId,
        createdAt: { gte: oneDayAgo },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "오늘은 이미 닦달했어요!" }, { status: 429 });
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
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId: recipientId },
    });

    const payload = JSON.stringify({
      title: "💪 닦달!",
      body: `${session.user.name || "팀원"}님이 운동하래요! 일지 올려주세요~`,
      url: "/write",
    });

    await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload
          );
        } catch (err) {
          const wpErr = err as { statusCode?: number };
          if (wpErr.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
        }
      })
    );

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

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);

    const nudges = await prisma.nudge.findMany({
      where: {
        teamId: session.user.teamId,
        createdAt: { gte: twoHoursAgo },
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
