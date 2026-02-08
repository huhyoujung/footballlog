import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 조끼 순서 저장
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 수정할 수 있습니다" }, { status: 403 });
    }

    const { vestOrder } = await req.json();

    if (!Array.isArray(vestOrder)) {
      return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
    }

    // 중복 체크
    const uniqueIds = new Set(vestOrder);
    if (uniqueIds.size !== vestOrder.length) {
      return NextResponse.json({ error: "중복된 사용자가 있습니다" }, { status: 400 });
    }

    // 모든 userId가 같은 팀 멤버인지 확인
    if (vestOrder.length > 0) {
      const members = await prisma.user.findMany({
        where: {
          id: { in: vestOrder },
          teamId: session.user.teamId,
        },
        select: { id: true },
      });

      if (members.length !== vestOrder.length) {
        return NextResponse.json({ error: "팀원이 아닌 사용자가 포함되어 있습니다" }, { status: 400 });
      }
    }

    // 순서 저장
    const team = await prisma.team.update({
      where: { id: session.user.teamId },
      data: { vestOrder },
      select: {
        id: true,
        vestOrder: true,
      },
    });

    return NextResponse.json(team);
  } catch (error) {
    console.error("조끼 순서 저장 오류:", error);
    return NextResponse.json({ error: "저장에 실패했습니다" }, { status: 500 });
  }
}
