import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// RSVP 마감 리마인더 (Cron Job - 30분 간격)
export async function GET(req: Request) {
  // Vercel Cron 인증
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    // 마감 2시간 이내 이벤트 찾기
    const events = await prisma.trainingEvent.findMany({
      where: {
        rsvpDeadline: {
          gte: now,
          lte: twoHoursLater,
        },
      },
      include: {
        rsvps: { select: { userId: true } },
        team: {
          include: {
            members: { select: { id: true } },
          },
        },
      },
    });

    let totalNotified = 0;

    for (const event of events) {
      const respondedIds = new Set(event.rsvps.map((r) => r.userId));
      const nonRespondedIds = event.team.members
        .filter((m) => !respondedIds.has(m.id))
        .map((m) => m.id);

      if (nonRespondedIds.length > 0) {
        const deadlineStr = new Date(event.rsvpDeadline).toLocaleTimeString("ko-KR", {
          hour: "2-digit",
          minute: "2-digit",
        });

        try {
          await sendPushToUsers(nonRespondedIds, {
            title: "응답 마감 임박",
            body: `참석 여부를 알려주세요! 마감: ${deadlineStr}`,
            url: `/training/${event.id}`,
          });
          totalNotified += nonRespondedIds.length;
        } catch {
          // 개별 실패 무시
        }
      }
    }

    return NextResponse.json({ ok: true, eventsChecked: events.length, totalNotified });
  } catch (error) {
    console.error("RSVP 리마인더 오류:", error);
    return NextResponse.json({ error: "실패했습니다" }, { status: 500 });
  }
}
