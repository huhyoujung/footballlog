import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * 최근 MVP 가져오기 (전광판용)
 * - 투표가 마감된 가장 최근 이벤트의 MVP를 반환
 * - pomVotingDeadline이 null이어도 eventDate 기반 fallback으로 마감 판단
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

    // 투표가 존재하는 이벤트를 최신순으로 조회
    const recentEvents = await prisma.trainingEvent.findMany({
      where: {
        teamId: session.user.teamId,
        date: { lte: now },
        enablePomVoting: true,
        pomVotes: { some: {} },
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
        date: "desc",
      },
      take: 5,
    });

    // 투표가 마감된 이벤트 중 가장 최근 것 찾기
    const closedEvent = recentEvents.find((event) => {
      let votingEndDate: Date;
      if (event.pomVotingDeadline) {
        votingEndDate = new Date(event.pomVotingDeadline);
      } else {
        // pomVotingDeadline이 없으면 다음날 23:59 기준 (pom.ts 로직과 동일)
        votingEndDate = new Date(event.date);
        votingEndDate.setDate(votingEndDate.getDate() + 1);
        votingEndDate.setHours(23, 59, 59, 999);
      }
      return now > votingEndDate;
    });

    if (!closedEvent || closedEvent.pomVotes.length === 0) {
      return NextResponse.json({ mvp: null });
    }

    // MVP 계산 (가장 많은 표를 받은 사람)
    const voteCount: Record<string, { user: any; count: number }> = {};

    for (const vote of closedEvent.pomVotes) {
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
    const eventDate = new Date(closedEvent.date);
    // KST (UTC+9) 기준으로 날짜 비교 — 서버(UTC)와 한국 사용자 날짜 불일치 방지
    const toKstDate = (d: Date) => new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
    const isToday = toKstDate(eventDate) === toKstDate(now);
    const isYesterday = toKstDate(eventDate) === toKstDate(new Date(now.getTime() - 86400000));

    return NextResponse.json(
      {
        mvp: {
          eventId: closedEvent.id,
          user: mvp.user,
          voteCount: mvp.count,
          eventDate: closedEvent.date,
          eventTitle: closedEvent.title,
          isToday,
          isYesterday,
        },
      },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("최근 MVP 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}
