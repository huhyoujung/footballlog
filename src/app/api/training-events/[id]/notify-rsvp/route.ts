import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// 미응답자에게 응답 독려 알림 전송 (ADMIN)
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
        rsvpDeadline: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    if (event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 팀원 목록 조회
    const teamMembers = await prisma.user.findMany({
      where: { teamId: event.teamId },
      select: { id: true },
    });

    // RSVP한 사람들 조회
    const rsvps = await prisma.rSVP.findMany({
      where: { trainingEventId },
      select: { userId: true },
    });

    const rsvpUserIds = new Set(rsvps.map((r) => r.userId));

    // 미응답자 찾기
    const noResponseUserIds = teamMembers
      .filter((m) => !rsvpUserIds.has(m.id))
      .map((m) => m.id);

    if (noResponseUserIds.length === 0) {
      return NextResponse.json(
        { error: "미응답자가 없습니다" },
        { status: 400 }
      );
    }

    // 푸시 알림 전송
    await sendPushToUsers(noResponseUserIds, {
      title: "📢 참석 여부 응답 요청",
      body: `${event.title} 참석 여부를 알려주세요`,
      url: `/training/${trainingEventId}`,
    });

    return NextResponse.json({
      message: "알림이 전송되었습니다",
      recipientCount: noResponseUserIds.length,
    });
  } catch (error) {
    console.error("응답 독려 알림 전송 오류:", error);
    return NextResponse.json({ error: "알림 전송에 실패했습니다" }, { status: 500 });
  }
}
