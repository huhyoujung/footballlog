import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 장비 배정 조회
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: trainingEventId } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // 팀 장비 목록 + 현재 운동의 배정 정보 (한 번에 조회)
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
        assignments: {
          where: { trainingEventId },
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
                position: true,
                number: true,
              },
            },
          },
        },
      },
    });

    // 응답 형식 변환
    const result = equipments.map((eq) => ({
      id: eq.id,
      name: eq.name,
      description: eq.description,
      managers: eq.managers,
      assignment: eq.assignments[0] || null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("장비 API 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// 장비 배정 저장 (ADMIN)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id: trainingEventId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 배정할 수 있습니다" }, { status: 403 });
    }

    // 운동 존재 여부 확인
    const event = await prisma.trainingEvent.findUnique({
      where: { id: trainingEventId },
      select: { teamId: true },
    });

    if (!event) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    if (event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const { assignments } = await req.json();

    if (!Array.isArray(assignments)) {
      return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
    }

    // 트랜잭션: 기존 배정 삭제 + 새 배정 생성
    await prisma.$transaction(async (tx) => {
      // 기존 배정 전부 삭제
      await tx.equipmentAssignment.deleteMany({
        where: { trainingEventId },
      });

      // 새 배정 생성 (빈 배정은 제외)
      const validAssignments = assignments.filter(
        (a: { equipmentId: string; userId: string | null; memo?: string }) =>
          a.equipmentId
      );

      if (validAssignments.length > 0) {
        await tx.equipmentAssignment.createMany({
          data: validAssignments.map(
            (a: { equipmentId: string; userId: string | null; memo?: string }) => ({
              trainingEventId,
              equipmentId: a.equipmentId,
              userId: a.userId || null,
              memo: a.memo?.trim() || null,
            })
          ),
        });
      }
    });

    return NextResponse.json({ message: "저장되었습니다" });
  } catch (error) {
    console.error("장비 배정 저장 오류:", error);
    return NextResponse.json({ error: "저장에 실패했습니다" }, { status: 500 });
  }
}
