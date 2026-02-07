import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 조끼 당번 자동 추천
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 조회할 수 있습니다" }, { status: 403 });
    }

    // 팀원 명단 (이름순)
    const members = await prisma.user.findMany({
      where: { teamId: session.user.teamId },
      select: { id: true, name: true, image: true },
      orderBy: { name: "asc" },
    });

    if (members.length === 0) {
      return NextResponse.json({ bringer: null, receiver: null, members });
    }

    // 최근 이벤트에서 조끼 받은 사람 찾기
    const lastEvent = await prisma.trainingEvent.findFirst({
      where: {
        teamId: session.user.teamId,
        vestReceiverId: { not: null },
      },
      orderBy: { date: "desc" },
      select: { vestReceiverId: true },
    });

    let bringerId: string | null = null;
    let receiverId: string | null = null;

    if (lastEvent?.vestReceiverId) {
      // 이전에 받은 사람 = 이번에 가져올 사람
      bringerId = lastEvent.vestReceiverId;

      // 다음 로테이션 (가져올 사람 다음 사람이 받을 사람)
      const bringerIdx = members.findIndex((m) => m.id === bringerId);
      if (bringerIdx !== -1) {
        const nextIdx = (bringerIdx + 1) % members.length;
        receiverId = members[nextIdx].id;
      }
    } else {
      // 첫 이벤트: 첫 번째/두 번째 사람
      bringerId = members[0]?.id || null;
      receiverId = members.length > 1 ? members[1].id : null;
    }

    return NextResponse.json({
      bringer: members.find((m) => m.id === bringerId) || null,
      receiver: members.find((m) => m.id === receiverId) || null,
      members,
    });
  } catch (error) {
    console.error("조끼 당번 추천 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}
