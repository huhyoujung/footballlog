import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 팀 장비 목록 조회 (ADMIN)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 조회할 수 있습니다" }, { status: 403 });
    }
    if (!session.user.teamId) {
      return NextResponse.json({ error: "팀에 가입되어 있지 않습니다" }, { status: 400 });
    }

    const equipments = await prisma.equipment.findMany({
      where: { teamId: session.user.teamId },
      orderBy: { orderIndex: "asc" },
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

    return NextResponse.json(equipments);
  } catch (error) {
    console.error("장비 목록 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// 장비 추가 (ADMIN)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 추가할 수 있습니다" }, { status: 403 });
    }
    if (!session.user.teamId) {
      return NextResponse.json({ error: "팀에 가입되어 있지 않습니다" }, { status: 400 });
    }

    const { name, description } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "장비 이름을 입력해주세요" }, { status: 400 });
    }

    // 중복 체크
    const existing = await prisma.equipment.findUnique({
      where: {
        teamId_name: {
          teamId: session.user.teamId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json({ error: "이미 존재하는 장비 이름입니다" }, { status: 400 });
    }

    // 현재 최대 orderIndex 조회
    const maxOrder = await prisma.equipment.findFirst({
      where: { teamId: session.user.teamId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });

    const equipment = await prisma.equipment.create({
      data: {
        teamId: session.user.teamId,
        name: name.trim(),
        description: description?.trim() || null,
        orderIndex: (maxOrder?.orderIndex ?? -1) + 1,
      },
    });

    return NextResponse.json(equipment, { status: 201 });
  } catch (error) {
    console.error("장비 추가 오류:", error);
    return NextResponse.json({ error: "추가에 실패했습니다" }, { status: 500 });
  }
}
