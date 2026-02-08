import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// 댓글 작성
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

    const { content, mentions = [] } = await req.json();

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "댓글 내용을 입력해주세요" },
        { status: 400 }
      );
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

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        mentions: validMentions,
        userId: session.user.id,
        trainingLogId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // 푸시 알림
    try {
      const notifyUsers: string[] = [];

      // 1. 일지 작성자에게 (본인 제외)
      if (log.userId !== session.user.id && !validMentions.includes(log.userId)) {
        notifyUsers.push(log.userId);
      }

      // 2. 멘션된 사용자들에게
      if (validMentions.length > 0) {
        await sendPushToUsers(validMentions, {
          title: "💬 댓글에서 멘션",
          body: `${session.user.name || "팀원"}님이 댓글에서 회원님을 멘션했어요`,
          url: `/log/${trainingLogId}`,
        });
      }

      // 3. 일지 작성자에게 (멘션되지 않은 경우)
      if (notifyUsers.length > 0) {
        await sendPushToUsers(notifyUsers, {
          title: "새 댓글",
          body: `${session.user.name || "팀원"}님이 회원님의 일지에 댓글을 남겼어요`,
          url: `/log/${trainingLogId}`,
        });
      }
    } catch {
      // 푸시 실패해도 댓글 작성은 성공
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("댓글 작성 오류:", error);
    return NextResponse.json(
      { error: "댓글 작성에 실패했습니다" },
      { status: 500 }
    );
  }
}
