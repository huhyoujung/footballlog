import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// 팀 배정 알림 전송 (ADMIN)
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

    // 팀 배정된 모든 사용자 조회 (세션 전체)
    const assignments = await prisma.sessionTeamAssignment.findMany({
      where: {
        trainingSession: {
          trainingEventId,
        },
      },
      select: {
        userId: true,
      },
    });

    if (assignments.length === 0) {
      return NextResponse.json(
        { error: "배정된 팀원이 없습니다" },
        { status: 400 }
      );
    }

    // 중복 제거
    const assignedUserIds = [...new Set(assignments.map((a) => a.userId))];

    // 푸시 알림 전송
    await sendPushToUsers(assignedUserIds, {
      title: "⚽ 팀 배정 완료",
      body: `${event.title} - 내가 어떤 팀에 배정되었는지 확인해볼까요?`,
      url: `/training/${trainingEventId}`,
    });

    return NextResponse.json({
      message: "알림이 전송되었습니다",
      recipientCount: assignedUserIds.length,
    });
  } catch (error) {
    console.error("팀 배정 알림 전송 오류:", error);
    return NextResponse.json({ error: "알림 전송에 실패했습니다" }, { status: 500 });
  }
}
