import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 팀 출석률 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // 팀의 모든 운동 이벤트 조회
    const events = await prisma.trainingEvent.findMany({
      where: { teamId: session.user.teamId },
      include: {
        checkIns: {
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

    // 각 멤버별 출석률 계산
    const attendanceRates = members.map((member) => {
      const checkInCount = events.filter((event) =>
        event.checkIns.some((checkIn) => checkIn.userId === member.id)
      ).length;

      const rate = totalEvents > 0 ? Math.round((checkInCount / totalEvents) * 100) : 0;

      return {
        userId: member.id,
        name: member.name,
        image: member.image,
        position: member.position,
        number: member.number,
        checkInCount,
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
