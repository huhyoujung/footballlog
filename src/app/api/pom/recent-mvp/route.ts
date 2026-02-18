import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * 최근 24시간 내 MVP 가져오기 (전광판용)
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (!session.user.teamId) {
      return NextResponse.json({ error: "팀에 가입되어 있지 않습니다" }, { status: 400 });
    }

    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    // 최근 48시간 내 마감된 운동 중 POM 투표가 있는 이벤트 찾기
    const recentEvents = await prisma.trainingEvent.findMany({
      where: {
        teamId: session.user.teamId,
        pomVotingDeadline: {
          gte: twoDaysAgo,
          lte: now,
        },
      },
      include: {
        pomVotes: {
          include: {
            nominee: {
              select: {
                id: true,
                name: true,
                image: true,
                position: true,
                number: true,
              },
            },
          },
        },
      },
      orderBy: {
        pomVotingDeadline: "desc",
      },
      take: 1,
    });

    if (recentEvents.length === 0 || recentEvents[0].pomVotes.length === 0) {
      return NextResponse.json({ mvp: null });
    }

    const event = recentEvents[0];

    // MVP 계산 (가장 많은 표를 받은 사람)
    const voteCount: Record<string, { user: any; count: number }> = {};

    for (const vote of event.pomVotes) {
      if (!voteCount[vote.nomineeId]) {
        voteCount[vote.nomineeId] = {
          user: vote.nominee,
          count: 0,
        };
      }
      voteCount[vote.nomineeId].count += 1;
    }

    const mvpEntries = Object.values(voteCount).sort((a, b) => b.count - a.count);

    if (mvpEntries.length === 0) {
      return NextResponse.json({ mvp: null });
    }

    const mvp = mvpEntries[0];
    const eventDate = new Date(event.date);
    const isToday = eventDate.toDateString() === now.toDateString();
    const isYesterday = eventDate.toDateString() === new Date(now.getTime() - 86400000).toDateString();

    return NextResponse.json({
      mvp: {
        user: mvp.user,
        voteCount: mvp.count,
        eventDate: event.date,
        eventTitle: event.title,
        isToday,
        isYesterday,
      },
    });
  } catch (error) {
    console.error("최근 MVP 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}
