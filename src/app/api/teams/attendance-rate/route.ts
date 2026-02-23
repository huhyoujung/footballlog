import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 팀 출석률 조회 — 정참·늦참은 참여, 불참·노쇼는 미참여로 계산
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // 팀의 정기운동 이벤트만 — 정참·늦참 RSVP만 포함
    const events = await prisma.trainingEvent.findMany({
      where: { teamId: session.user.teamId, isRegular: true },
      include: {
        rsvps: {
          where: { status: { in: ["ATTEND", "LATE"] } },
          select: { userId: true },
        },
      },
    });

    // 팀원 목록 조회
    const members = await prisma.user.findMany({
      where: { teamId: session.user.teamId },
      select: {
        id: true,
        name: true,
        image: true,
        position: true,
        number: true,
      },
    });

    const totalEvents = events.length;

    // 각 멤버별 출석률 계산 (정참+늦참 기준)
    const attendanceRates = members.map((member) => {
      const attendedCount = events.filter((event) =>
        event.rsvps.some((r) => r.userId === member.id)
      ).length;

      const rate = totalEvents > 0 ? Math.round((attendedCount / totalEvents) * 100) : 0;

      return {
        userId: member.id,
        name: member.name,
        image: member.image,
        position: member.position,
        number: member.number,
        attendedCount,
        totalEvents,
        rate,
      };
    });

    // 출석률 높은 순으로 정렬
    attendanceRates.sort((a, b) => b.rate - a.rate);

    return NextResponse.json({ attendanceRates, totalEvents });
  } catch (error) {
    console.error("출석률 조회 오류:", error);
    return NextResponse.json(
      { error: "조회에 실패했습니다" },
      { status: 500 }
    );
  }
}
