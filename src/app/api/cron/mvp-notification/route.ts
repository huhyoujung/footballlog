import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { isPomVotingClosed } from "@/lib/pom";

// MVP 선발 알림 (Cron Job - 10분 간격)
// pomVotingDeadline 시각이 지나면 MVP와 투표 적중자에게 푸시 발송
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 투표가 있고 아직 푸시 미발송된 이벤트 조회
    const events = await prisma.trainingEvent.findMany({
      where: {
        enablePomVoting: true,
        pomPushSentAt: null,
        date: { lte: now },
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
    });

    let notified = 0;

    for (const event of events) {
      // 투표 마감 여부 확인 (pomVotingDeadline 또는 다음날 23:59 기준)
      const isClosed = isPomVotingClosed(
        event.date.toISOString(),
        event.pomVotingDeadline?.toISOString() ?? null
      );
      if (!isClosed) continue;

      // 원자적 check-and-set (중복 발송 방지)
      const updated = await prisma.trainingEvent.updateMany({
        where: { id: event.id, pomPushSentAt: null },
        data: { pomPushSentAt: new Date() },
      });
      if (updated.count === 0) continue; // 이미 처리됨 (lazy trigger 등)

      // MVP 계산 (득표수 집계)
      const voteCount: Record<string, { user: typeof event.pomVotes[0]["nominee"]; count: number }> = {};
      for (const vote of event.pomVotes) {
        if (!voteCount[vote.nomineeId]) {
          voteCount[vote.nomineeId] = { user: vote.nominee, count: 0 };
        }
        voteCount[vote.nomineeId].count++;
      }

      const results = Object.values(voteCount).sort((a, b) => b.count - a.count);
      if (results.length === 0) continue;

      const topCount = results[0].count;
      const mvps = results.filter((r) => r.count === topCount);
      const mvpIds = mvps.map((r) => r.user.id);

      // MVP 당선 알림
      await Promise.allSettled(
        mvps.map((mvp) =>
          sendPushToUsers([mvp.user.id], {
            title: mvpIds.length > 1 ? "🏆 공동 MVP!" : "🏆 오늘의 MVP는 당신!",
            body:
              mvpIds.length > 1
                ? "팀원들이 선택한 오늘의 영웅 중 한 명이에요 😍"
                : `${mvp.count}명의 팀원이 선택했어요. 이미 알고 있었죠? 😏`,
            url: `/training/${event.id}`,
          })
        )
      );

      // 투표 적중 알림 (MVP에게 투표한 사람, MVP 본인 제외)
      const mvpVoterIds = event.pomVotes
        .filter((v) => mvpIds.includes(v.nomineeId) && !mvpIds.includes(v.voterId))
        .map((v) => v.voterId);

      const uniqueVoterIds = [...new Set(mvpVoterIds)];
      if (uniqueVoterIds.length > 0) {
        const mvpNames = mvps.map((m) => m.user.name || "팀원").join(", ");
        await sendPushToUsers(uniqueVoterIds, {
          title: "👀 보는 눈이 있으시네요!",
          body: `${mvpNames}님이 오늘 MVP가 됐어요. 탁월한 안목이에요 🎯`,
          url: `/training/${event.id}`,
        });
      }

      notified++;
    }

    return NextResponse.json({ ok: true, eventsChecked: events.length, notified });
  } catch (error) {
    console.error("MVP 알림 cron 오류:", error);
    return NextResponse.json({ error: "실패했습니다" }, { status: 500 });
  }
}
