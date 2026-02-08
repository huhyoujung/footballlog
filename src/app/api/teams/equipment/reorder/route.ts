import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 장비 순서 변경 (ADMIN)
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 순서를 변경할 수 있습니다" }, { status: 403 });
    }
    if (!session.user.teamId) {
      return NextResponse.json({ error: "팀에 가입되어 있지 않습니다" }, { status: 400 });
    }

    const { equipmentIds } = await req.json();

    if (!Array.isArray(equipmentIds)) {
      return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
    }

    // 모든 장비가 현재 팀의 것인지 확인
    const equipments = await prisma.equipment.findMany({
      where: {
        id: { in: equipmentIds },
        teamId: session.user.teamId,
      },
    });

    if (equipments.length !== equipmentIds.length) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 순서 업데이트 (트랜잭션)
    await prisma.$transaction(
      equipmentIds.map((id, index) =>
        prisma.equipment.update({
          where: { id },
          data: { orderIndex: index },
        })
      )
    );

    return NextResponse.json({ message: "순서가 변경되었습니다" });
  } catch (error) {
    console.error("장비 순서 변경 오류:", error);
    return NextResponse.json({ error: "순서 변경에 실패했습니다" }, { status: 500 });
  }
}
