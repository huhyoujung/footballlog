import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 장비 수정 (ADMIN)
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

    const { name, description } = await req.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "장비 이름을 입력해주세요" }, { status: 400 });
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

    // 이름 변경 시 중복 체크
    if (name.trim() !== equipment.name) {
      const existing = await prisma.equipment.findUnique({
        where: {
          teamId_name: {
            teamId: equipment.teamId,
            name: name.trim(),
          },
        },
      });

      if (existing) {
        return NextResponse.json({ error: "이미 존재하는 장비 이름입니다" }, { status: 400 });
      }
    }

    const updated = await prisma.equipment.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("장비 수정 오류:", error);
    return NextResponse.json({ error: "수정에 실패했습니다" }, { status: 500 });
  }
}

// 장비 삭제 (ADMIN)
export async function DELETE(
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
      return NextResponse.json({ error: "운영진만 삭제할 수 있습니다" }, { status: 403 });
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

    // 삭제 (EquipmentAssignment는 onDelete: Cascade로 자동 삭제)
    await prisma.equipment.delete({
      where: { id },
    });

    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (error) {
    console.error("장비 삭제 오류:", error);
    return NextResponse.json({ error: "삭제에 실패했습니다" }, { status: 500 });
  }
}
