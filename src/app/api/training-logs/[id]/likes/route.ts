import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 좋아요 토글
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: trainingLogId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // 운동 일지 확인 및 같은 팀인지 확인
    const log = await prisma.trainingLog.findUnique({
      where: { id: trainingLogId },
      include: {
        user: {
          select: {
            teamId: true,
          },
        },
      },
    });

    if (!log) {
      return NextResponse.json(
        { error: "운동 일지를 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    if (log.user.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 이미 좋아요 했는지 확인
    const existingLike = await prisma.like.findUnique({
      where: {
        userId_trainingLogId: {
          userId: session.user.id,
          trainingLogId,
        },
      },
    });

    if (existingLike) {
      // 좋아요 취소
      await prisma.like.delete({
        where: { id: existingLike.id },
      });

      const likeCount = await prisma.like.count({
        where: { trainingLogId },
      });

      return NextResponse.json({ liked: false, likeCount });
    } else {
      // 좋아요 추가
      await prisma.like.create({
        data: {
          userId: session.user.id,
          trainingLogId,
        },
      });

      const likeCount = await prisma.like.count({
        where: { trainingLogId },
      });

      return NextResponse.json({ liked: true, likeCount });
    }
  } catch (error) {
    console.error("좋아요 오류:", error);
    return NextResponse.json(
      { error: "좋아요 처리에 실패했습니다" },
      { status: 500 }
    );
  }
}
