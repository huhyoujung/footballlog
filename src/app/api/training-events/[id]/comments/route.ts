import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// 댓글 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const comments = await prisma.trainingEventComment.findMany({
      where: {
        trainingEventId: id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(comments);
  } catch (error) {
    console.error("Failed to fetch comments:", error);
    return NextResponse.json(
      { error: "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

// 댓글 작성
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { content } = await req.json();

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Comment content is required" },
        { status: 400 }
      );
    }

    // 팀 운동 존재 확인
    const trainingEvent = await prisma.trainingEvent.findUnique({
      where: { id },
      select: { teamId: true, title: true, date: true },
    });

    if (!trainingEvent) {
      return NextResponse.json(
        { error: "Training event not found" },
        { status: 404 }
      );
    }

    // 사용자가 해당 팀 소속인지 확인
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

    const comment = await prisma.trainingEventComment.create({
      data: {
        content: content.trim(),
        trainingEventId: id,
        authorId: session.user.id,
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // 푸시 알림 발송 (불참자 제외, 작성자 본인 제외)
    try {
      // 팀 멤버 조회
      const teamMembers = await prisma.user.findMany({
        where: { teamId: trainingEvent.teamId },
        select: { id: true },
      });

      // RSVP 조회 (불참자 찾기)
      const rsvps = await prisma.trainingEventRSVP.findMany({
        where: {
          trainingEventId: id,
          status: "ABSENT",
        },
        select: { userId: true },
      });

      const absentUserIds = new Set(rsvps.map((r) => r.userId));

      // 알림 대상: 팀 멤버 중 불참자와 작성자 본인 제외
      const notifyUserIds = teamMembers
        .map((m) => m.id)
        .filter((userId) => userId !== session.user.id && !absentUserIds.has(userId));

      if (notifyUserIds.length > 0) {
        // 운동 정보 포맷팅
        const eventDate = new Date(trainingEvent.date);
        const dateStr = eventDate.toLocaleDateString("ko-KR", {
          month: "numeric",
          day: "numeric",
          weekday: "short",
        });

        await sendPushToUsers(notifyUserIds, {
          title: `💬 ${trainingEvent.title || "팀 운동"} 댓글`,
          body: `${comment.author.name}: ${content.trim().substring(0, 50)}${content.trim().length > 50 ? "..." : ""} (${dateStr})`,
          url: `/training/${id}`,
        });
      }
    } catch (pushError) {
      console.error("Failed to send push notification:", pushError);
      // 푸시 알림 실패해도 댓글 작성은 성공으로 처리
    }

    return NextResponse.json(comment, { status: 201 });
  } catch (error) {
    console.error("Failed to create comment:", error);
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }
}
