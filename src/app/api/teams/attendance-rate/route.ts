import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 팀 출석률 조회 — 정기운동 대상, 실제 체크인 기록 기준
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const now = new Date();

    // 과거 정기운동 총 개수
    const totalEvents = await prisma.trainingEvent.count({
      where: { teamId: session.user.teamId, isRegular: true, date: { lt: now } },
    });

    // 과거 정기운동 체크인 데이터 한 번에 조회
    const checkIns = await prisma.checkIn.findMany({
      where: {
        trainingEvent: {
          teamId: session.user.teamId,
          isRegular: true,
          date: { lt: now },
        },
      },
      select: { userId: true },
    });

    // userId별 체크인 횟수 집계
    const checkInsByUser = checkIns.reduce((acc, ci) => {
      acc[ci.userId] = (acc[ci.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

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

    // 각 멤버별 출석률 계산 (체크인 기준)
    const attendanceRates = members.map((member) => {
      const attendedCount = checkInsByUser[member.id] || 0;
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
