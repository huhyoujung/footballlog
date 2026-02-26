import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { unstable_cache } from "next/cache";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 팀별 MVP 결과 — 팀원 전원 공통 데이터이므로 팀 ID 단위로 서버 캐시
// 캐시 전략: unstable_cache(revalidate=300s) + HTTP Cache-Control(private, max-age=300)
const getCachedRecentMvp = unstable_cache(
  async (teamId: string) => {
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    const recentEvents = await prisma.trainingEvent.findMany({
      where: {
        teamId,
        date: { gte: threeDaysAgo, lte: now },
        enablePomVoting: true,
        pomVotes: { some: {} },
      },
      include: {
        pomVotes: {
          include: {
            nominee: {
              select: { id: true, name: true, image: true, position: true, number: true },
            },
          },
        },
      },
      orderBy: { date: "desc" },
      take: 5,
    });

    const closedEvent = recentEvents.find((event) => {
      const votingEndDate = event.pomVotingDeadline
        ? new Date(event.pomVotingDeadline)
        : (() => {
            const d = new Date(event.date);
            d.setDate(d.getDate() + 1);
            d.setHours(23, 59, 59, 999);
            return d;
          })();
      return now > votingEndDate;
    });

    if (!closedEvent || closedEvent.pomVotes.length === 0) return { mvp: null };

    const voteCount: Record<string, { user: any; count: number }> = {};
    for (const vote of closedEvent.pomVotes) {
      if (!voteCount[vote.nomineeId]) {
        voteCount[vote.nomineeId] = { user: vote.nominee, count: 0 };
      }
      voteCount[vote.nomineeId].count += 1;
    }

    const mvpEntries = Object.values(voteCount).sort((a, b) => b.count - a.count);
    if (mvpEntries.length === 0) return { mvp: null };

    const mvp = mvpEntries[0];
    const eventDate = new Date(closedEvent.date);
    const toKstDate = (d: Date) =>
      new Date(d.getTime() + 9 * 60 * 60 * 1000).toISOString().split("T")[0];
    const isToday = toKstDate(eventDate) === toKstDate(now);
    const isYesterday = toKstDate(eventDate) === toKstDate(new Date(now.getTime() - 86400000));

    return {
      mvp: {
        eventId: closedEvent.id,
        user: mvp.user,
        voteCount: mvp.count,
        eventDate: closedEvent.date,
        eventTitle: closedEvent.title,
        isToday,
        isYesterday,
      },
    };
  },
  ["recent-mvp"],
  { revalidate: 300, tags: ["recent-mvp"] },
);

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

    const data = await getCachedRecentMvp(session.user.teamId);

    return NextResponse.json(data, {
      headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("최근 MVP 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}
