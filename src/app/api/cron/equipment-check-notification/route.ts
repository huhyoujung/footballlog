import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { isPomVotingClosed } from "@/lib/pom";

// 장비함 체크 알림 (Cron Job - 10분 간격)
// 운동 종료 시점(MVP 투표 마감 또는 시작 +2h)에 팀 장비 담당자에게 푸시 발송
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 배포 기준일: 이 날짜 이전 이벤트는 처리하지 않아 알림 폭탄 방지
    const deployedAt = new Date("2026-02-23T00:00:00Z");

    // 아직 장비 알림 미발송된 이벤트 조회
    const events = await prisma.trainingEvent.findMany({
      where: {
        date: {
          gte: deployedAt,
          lte: now,
        },
        equipmentCheckPushSentAt: null,
      },
      select: {
        id: true,
        title: true,
        date: true,
        teamId: true,
        enablePomVoting: true,
        pomVotingDeadline: true,
      },
    });

    let notified = 0;

    for (const event of events) {
      // 운동 종료 여부 판단
      let isEnded: boolean;
      if (event.enablePomVoting) {
        // MVP 투표 활성화 → 투표 마감 여부 기준
        isEnded = isPomVotingClosed(
          event.date.toISOString(),
          event.pomVotingDeadline?.toISOString() ?? null
        );
      } else {
        // MVP 투표 없음 → 운동 시작 +2시간 기준
        const twoHoursAfter = new Date(event.date.getTime() + 2 * 60 * 60 * 1000);
        isEnded = now >= twoHoursAfter;
      }

      if (!isEnded) continue;

      // 원자적 check-and-set (중복 발송 방지)
      const updated = await prisma.trainingEvent.updateMany({
        where: { id: event.id, equipmentCheckPushSentAt: null },
        data: { equipmentCheckPushSentAt: new Date() },
      });
      if (updated.count === 0) continue; // 이미 처리됨

      // 팀 장비 담당자 조회
      const managers = await prisma.user.findMany({
        where: {
          teamId: event.teamId,
          isEquipmentManager: true,
        },
        select: { id: true },
      });

      if (managers.length === 0) continue; // 담당자 없으면 skip

      const managerIds = managers.map((m) => m.id);

      await sendPushToUsers(managerIds, {
        title: "📦 장비함 체크해주세요",
        body: `${event.title} 운동이 끝났어요! 장비 잘 챙겨주세요 🙏`,
        url: `/training/${event.id}`,
      });

      console.log(
        `[EQUIPMENT CHECK] Sent to ${managers.length} managers for event ${event.id}`
      );
      notified++;
    }

    return NextResponse.json({
      ok: true,
      eventsChecked: events.length,
      notified,
    });
  } catch (error) {
    console.error("[EQUIPMENT CHECK] Cron 오류:", error);
    return NextResponse.json({ error: "실패했습니다" }, { status: 500 });
  }
}
