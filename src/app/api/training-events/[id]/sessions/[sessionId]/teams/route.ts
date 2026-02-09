import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

    return NextResponse.json({ assignments: result });
  } catch (error) {
    console.error("팀 배정 오류:", error);
    return NextResponse.json({ error: "배정에 실패했습니다" }, { status: 500 });
  }
}
