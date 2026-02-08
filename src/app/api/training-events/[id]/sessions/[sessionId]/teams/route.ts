import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// 팀 배정 저장 (전체 교체, ADMIN)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { sessionId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 배정할 수 있습니다" }, { status: 403 });
    }

    const { assignments } = await req.json() as {
      assignments: { userId: string; teamLabel: string }[];
    };

    // 기존 배정 삭제 후 새로 생성
    await prisma.$transaction([
      prisma.sessionTeamAssignment.deleteMany({
        where: { trainingSessionId: sessionId },
      }),
      prisma.sessionTeamAssignment.createMany({
        data: assignments.map((a) => ({
          trainingSessionId: sessionId,
          userId: a.userId,
          teamLabel: a.teamLabel,
        })),
      }),
    ]);

    // 저장 결과 반환
    const result = await prisma.sessionTeamAssignment.findMany({
      where: { trainingSessionId: sessionId },
      include: {
        user: { select: { id: true, name: true, image: true } },
        trainingSession: {
          include: {
            trainingEvent: { select: { id: true, title: true } },
          },
        },
      },
    });

    // 푸시 알림: 배정된 모든 사용자에게
    if (result.length > 0) {
      const assignedUserIds = [...new Set(result.map((r) => r.userId))];
      const eventTitle = result[0].trainingSession.trainingEvent.title;
      const eventId = result[0].trainingSession.trainingEvent.id;

      try {
        await sendPushToUsers(assignedUserIds, {
          title: "⚽ 팀 배정 완료",
          body: `${eventTitle} - 내가 어떤 팀에 배정되었는지 확인해볼까요?`,
          url: `/training/${eventId}`,
        });
      } catch {
        // 푸시 실패해도 배정은 성공
      }
    }

    return NextResponse.json({ assignments: result });
  } catch (error) {
    console.error("팀 배정 오류:", error);
    return NextResponse.json({ error: "배정에 실패했습니다" }, { status: 500 });
  }
}
