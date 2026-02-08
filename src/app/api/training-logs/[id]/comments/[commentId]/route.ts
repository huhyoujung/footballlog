import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 댓글 수정
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { commentId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json({ error: "댓글을 찾을 수 없습니다" }, { status: 404 });
    }

    // 본인 댓글만 수정 가능
    if (comment.userId !== session.user.id) {
      return NextResponse.json({ error: "수정 권한이 없습니다" }, { status: 403 });
    }

    const { content, mentions = [] } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json({ error: "댓글 내용을 입력해주세요" }, { status: 400 });
    }

    // 멘션 유효성 검사 (최대 5명, 같은 팀, 자기 자신 제외)
    const validMentions: string[] = [];
    if (mentions.length > 0) {
      const mentionedUsers = await prisma.user.findMany({
        where: {
          id: { in: mentions },
          teamId: session.user.teamId,
          NOT: { id: session.user.id },
        },
        select: { id: true },
      });
      validMentions.push(...mentionedUsers.map((u) => u.id).slice(0, 5));
    }

    const updated = await prisma.comment.update({
      where: { id: commentId },
      data: {
        content: content.trim(),
        mentions: validMentions,
      },
      include: {
        user: {
          select: { id: true, name: true, image: true },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("댓글 수정 오류:", error);
    return NextResponse.json({ error: "댓글 수정에 실패했습니다" }, { status: 500 });
  }
}

// 댓글 삭제
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { commentId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!comment) {
      return NextResponse.json({ error: "댓글을 찾을 수 없습니다" }, { status: 404 });
    }

    // 본인 또는 ADMIN만 삭제 가능
    if (comment.userId !== session.user.id && session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
    }

    await prisma.comment.delete({
      where: { id: commentId },
    });

    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (error) {
    console.error("댓글 삭제 오류:", error);
    return NextResponse.json({ error: "댓글 삭제에 실패했습니다" }, { status: 500 });
  }
}
