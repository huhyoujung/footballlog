import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 운동 일지 상세 조회
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const log = await prisma.trainingLog.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
            teamId: true,
            position: true,
            number: true,
          },
        },
        comments: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: {
            createdAt: "asc",
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
        likes: {
          where: {
            userId: session.user.id,
          },
          select: {
            id: true,
          },
        },
      },
    });

    if (!log) {
      return NextResponse.json({ error: "운동 일지를 찾을 수 없습니다" }, { status: 404 });
    }

    // 같은 팀인지 확인
    if (log.user.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    return NextResponse.json({
      ...log,
      isLiked: log.likes.length > 0,
      likes: undefined,
    });
  } catch (error) {
    console.error("운동 일지 상세 조회 오류:", error);
    return NextResponse.json(
      { error: "운동 일지 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}

// 운동 일지 수정
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const log = await prisma.trainingLog.findUnique({
      where: { id },
    });

    if (!log) {
      return NextResponse.json({ error: "운동 일지를 찾을 수 없습니다" }, { status: 404 });
    }

    // 본인 글인지 확인
    if (log.userId !== session.user.id) {
      return NextResponse.json({ error: "수정 권한이 없습니다" }, { status: 403 });
    }

    const { trainingDate, condition, conditionReason, keyPoints, improvement } =
      await req.json();

    const updatedLog = await prisma.trainingLog.update({
      where: { id },
      data: {
        ...(trainingDate && { trainingDate: new Date(trainingDate) }),
        ...(condition !== undefined && { condition }),
        ...(conditionReason && { conditionReason: conditionReason.trim() }),
        ...(keyPoints && { keyPoints: keyPoints.trim() }),
        ...(improvement && { improvement: improvement.trim() }),
      },
    });

    return NextResponse.json(updatedLog);
  } catch (error) {
    console.error("운동 일지 수정 오류:", error);
    return NextResponse.json(
      { error: "운동 일지 수정에 실패했습니다" },
      { status: 500 }
    );
  }
}

// 운동 일지 삭제
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const log = await prisma.trainingLog.findUnique({
      where: { id },
    });

    if (!log) {
      return NextResponse.json({ error: "운동 일지를 찾을 수 없습니다" }, { status: 404 });
    }

    // 본인 또는 ADMIN만 삭제 가능
    if (log.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
    }

    await prisma.trainingLog.delete({
      where: { id },
    });

    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (error) {
    console.error("운동 일지 삭제 오류:", error);
    return NextResponse.json(
      { error: "운동 일지 삭제에 실패했습니다" },
      { status: 500 }
    );
  }
}
