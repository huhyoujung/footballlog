import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 세션 목록 조회
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const sessions = await prisma.trainingSession.findMany({
      where: { trainingEventId: id },
      include: {
        teamAssignments: {
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
      orderBy: { orderIndex: "asc" },
    });

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error("세션 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// 세션 생성 (ADMIN)
export async function POST(
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
      return NextResponse.json({ error: "운영진만 생성할 수 있습니다" }, { status: 403 });
    }

    const { title, memo, requiresTeams } = await req.json();

    // 다음 orderIndex 계산
    const lastSession = await prisma.trainingSession.findFirst({
      where: { trainingEventId: id },
      orderBy: { orderIndex: "desc" },
    });

    const trainingSession = await prisma.trainingSession.create({
      data: {
        trainingEventId: id,
        title: title || null,
        memo: memo || null,
        requiresTeams: requiresTeams ?? false,
        orderIndex: (lastSession?.orderIndex ?? -1) + 1,
      },
      include: {
        teamAssignments: {
          include: {
            user: { select: { id: true, name: true, image: true } },
          },
        },
      },
    });

    return NextResponse.json(trainingSession, { status: 201 });
  } catch (error) {
    console.error("세션 생성 오류:", error);
    return NextResponse.json({ error: "생성에 실패했습니다" }, { status: 500 });
  }
}
