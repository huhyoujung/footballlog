import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 특정 팀 운동의 운동일지 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 팀 운동 존재 확인 및 팀 멤버십 확인
    const trainingEvent = await prisma.trainingEvent.findUnique({
      where: { id },
      select: { teamId: true },
    });

    if (!trainingEvent) {
      return NextResponse.json(
        { error: "Training event not found" },
        { status: 404 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { teamId: true },
    });

    if (user?.teamId !== trainingEvent.teamId) {
      return NextResponse.json(
        { error: "You are not a member of this team" },
        { status: 403 }
      );
    }

    // 운동일지 조회
    const logs = await prisma.trainingLog.findMany({
      where: {
        trainingEventId: id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            position: true,
            number: true,
          },
        },
        _count: {
          select: {
            likes: true,
            comments: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // 응답 포맷 변환
    const formattedLogs = logs.map((log) => ({
      ...log,
      likeCount: log._count.likes,
    }));

    return NextResponse.json(formattedLogs);
  } catch (error) {
    console.error("Failed to fetch training logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch training logs" },
      { status: 500 }
    );
  }
}
