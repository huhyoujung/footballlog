// 유저별 POM 투표 수신 현황 — 스탯 차트용
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (!session.user.teamId) {
      return NextResponse.json({ error: "팀에 가입되어 있지 않습니다" }, { status: 400 });
    }

    const { userId } = await params;
    const teamId = session.user.teamId;

    // 대상 유저가 같은 팀인지 확인
    const targetUser = await prisma.user.findFirst({
      where: { id: userId, teamId },
      select: { id: true },
    });
    if (!targetUser) {
      return NextResponse.json({ error: "같은 팀원만 조회할 수 있습니다" }, { status: 403 });
    }

    // 이 유저가 받은 모든 POM 표 (태그 집계용)
    const pomVotes = await prisma.pomVote.findMany({
      where: {
        nomineeId: userId,
        trainingEvent: { teamId },
      },
      select: { tags: true },
    });

    // MVP 횟수 계산: 투표가 마감된 이벤트에서 이 유저가 최다 득표인 경우
    const nominatedEvents = await prisma.trainingEvent.findMany({
      where: {
        teamId,
        pomVotes: { some: { nomineeId: userId } },
      },
      select: {
        date: true,
        pomVotingDeadline: true,
        pomVotes: { select: { nomineeId: true } },
      },
    });

    const now = new Date();
    let mvpCount = 0;

    for (const event of nominatedEvents) {
      // recent-mvp/route.ts 와 동일한 마감 판정 로직
      const votingEnd = event.pomVotingDeadline
        ? new Date(event.pomVotingDeadline)
        : (() => {
            const d = new Date(event.date);
            d.setDate(d.getDate() + 1);
            d.setHours(23, 59, 59, 999);
            return d;
          })();

      if (now <= votingEnd) continue; // 아직 투표 중

      const countByUser: Record<string, number> = {};
      for (const v of event.pomVotes) {
        countByUser[v.nomineeId] = (countByUser[v.nomineeId] || 0) + 1;
      }
      const maxVotes = Math.max(...Object.values(countByUser));
      if ((countByUser[userId] ?? 0) === maxVotes) mvpCount++;
    }

    const logCount = await prisma.trainingLog.count({ where: { userId } });

    return NextResponse.json(
      { pomVotes, mvpCount, logCount },
      { headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("POM 스탯 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}
