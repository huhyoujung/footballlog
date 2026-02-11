import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 장비 관리자 목록 조회 (ADMIN)
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

    const managers = await prisma.user.findMany({
      where: {
        teamId: session.user.teamId,
        isEquipmentManager: true,
      },
      select: {
        id: true,
        name: true,
        image: true,
        position: true,
        number: true,
      },
    });

    return NextResponse.json(managers);
  } catch (error) {
    console.error("장비 관리자 목록 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// 장비 관리자 추가/제거 (ADMIN)
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 수정할 수 있습니다" }, { status: 403 });
    }
    if (!session.user.teamId) {
      return NextResponse.json({ error: "팀에 가입되어 있지 않습니다" }, { status: 400 });
    }

    const { userId, isManager } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "사용자 ID가 필요합니다" }, { status: 400 });
    }

    // 같은 팀 멤버인지 확인
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        teamId: session.user.teamId,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "해당 사용자를 찾을 수 없습니다" }, { status: 404 });
    }

    // 모든 팀 장비 조회
    const equipments = await prisma.equipment.findMany({
      where: { teamId: session.user.teamId },
      select: { id: true },
    });

    // 모든 장비에 대해 관리자 추가/제거 (다대다 관계 업데이트)
    if (isManager) {
      // 관리자 추가 - 모든 장비의 managers에 연결
      await Promise.all(
        equipments.map((eq) =>
          prisma.equipment.update({
            where: { id: eq.id },
            data: {
              managers: {
                connect: { id: userId },
              },
            },
          })
        )
      );
    } else {
      // 관리자 제거 - 모든 장비의 managers에서 연결 해제
      await Promise.all(
        equipments.map((eq) =>
          prisma.equipment.update({
            where: { id: eq.id },
            data: {
              managers: {
                disconnect: { id: userId },
              },
            },
          })
        )
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("장비 관리자 설정 오류:", error);
    return NextResponse.json({ error: "설정에 실패했습니다" }, { status: 500 });
  }
}
