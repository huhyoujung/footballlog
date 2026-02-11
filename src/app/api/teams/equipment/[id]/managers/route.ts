import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 장비별 관리자 설정 (ADMIN)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 수정할 수 있습니다" }, { status: 403 });
    }

    const { managerIds } = await req.json();

    if (!Array.isArray(managerIds)) {
      return NextResponse.json({ error: "관리자 ID 배열이 필요합니다" }, { status: 400 });
    }

    // 장비 존재 여부 및 팀 확인
    const equipment = await prisma.equipment.findUnique({
      where: { id },
    });

    if (!equipment) {
      return NextResponse.json({ error: "장비를 찾을 수 없습니다" }, { status: 404 });
    }

    if (equipment.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 모든 관리자가 같은 팀인지 확인
    if (managerIds.length > 0) {
      const managers = await prisma.user.findMany({
        where: {
          id: { in: managerIds },
          teamId: session.user.teamId,
        },
      });

      if (managers.length !== managerIds.length) {
        return NextResponse.json({ error: "유효하지 않은 관리자가 포함되어 있습니다" }, { status: 400 });
      }
    }

    // 관리자 연결 업데이트 (기존 연결 모두 제거 후 새로 연결)
    const updated = await prisma.equipment.update({
      where: { id },
      data: {
        managers: {
          set: managerIds.map((managerId) => ({ id: managerId })),
        },
      },
      include: {
        managers: {
          select: {
            id: true,
            name: true,
            image: true,
            position: true,
            number: true,
          },
        },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("장비 관리자 설정 오류:", error);
    return NextResponse.json({ error: "설정에 실패했습니다" }, { status: 500 });
  }
}
