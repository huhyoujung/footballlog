import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 세션 수정 (ADMIN)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { sessionId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 수정할 수 있습니다" }, { status: 403 });
    }

    const { title, memo, requiresTeams, positions, sessionType } = await req.json();

    const updated = await prisma.trainingSession.update({
      where: { id: sessionId },
      data: {
        ...(title !== undefined && { title: title || null }),
        ...(memo !== undefined && { memo: memo || null }),
        ...(requiresTeams !== undefined && { requiresTeams }),
        ...(sessionType !== undefined && { sessionType }),
        ...(positions !== undefined && { positions: positions || undefined }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("세션 수정 오류:", error);
    return NextResponse.json({ error: "수정에 실패했습니다" }, { status: 500 });
  }
}

// 세션 삭제 (ADMIN)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { sessionId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 삭제할 수 있습니다" }, { status: 403 });
    }

    await prisma.trainingSession.delete({ where: { id: sessionId } });
    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (error) {
    console.error("세션 삭제 오류:", error);
    return NextResponse.json({ error: "삭제에 실패했습니다" }, { status: 500 });
  }
}
