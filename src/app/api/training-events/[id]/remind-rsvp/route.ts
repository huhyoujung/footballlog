import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// RSVP 미응답자에게 알림 전송
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: trainingEventId } = await params;

    if (!session?.user?.id) {
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
        date: true,
        rsvpDeadline: true,
        teamId: true,
        team: {
          select: {
            members: {
              select: { id: true },
            },
          },
        },
        rsvps: {
          select: { userId: true },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    if (event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 응답 마감 확인
    const isDeadlinePassed = new Date() > new Date(event.rsvpDeadline);
    if (isDeadlinePassed) {
      return NextResponse.json({ error: "응답 마감이 지났습니다" }, { status: 400 });
    }

    // 미응답자 찾기 (팀원 - 응답자)
    const allMemberIds = event.team.members.map((m) => m.id);
    const respondedUserIds = event.rsvps.map((r) => r.userId);
    const noResponseUserIds = allMemberIds.filter((id) => !respondedUserIds.includes(id));

    if (noResponseUserIds.length === 0) {
      return NextResponse.json({ message: "미응답자가 없습니다" });
    }

    // 푸시 알림 전송
    const deadlineStr = new Date(event.rsvpDeadline).toLocaleDateString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    await sendPushToUsers(noResponseUserIds, {
      title: "⚽️ 참석 여부 응답 필요",
      body: `${event.title} (마감: ${deadlineStr})`,
      url: `/training/${event.id}`,
    });

    return NextResponse.json({
      message: "알림을 전송했습니다",
      sentTo: noResponseUserIds.length,
    });
  } catch (error) {
    console.error("RSVP 알림 전송 오류:", error);
    return NextResponse.json({ error: "알림 전송에 실패했습니다" }, { status: 500 });
  }
}
