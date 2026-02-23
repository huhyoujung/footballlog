import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE /api/training-events/[id]/cards/[cardId] - 카드 기록 삭제
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cardId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { id: trainingEventId, cardId } = await params;

    const card = await prisma.cardRecord.findUnique({
      where: { id: cardId },
      select: { id: true, trainingEventId: true, recordedById: true },
    });

    if (!card) {
      return NextResponse.json({ error: "카드 기록을 찾을 수 없습니다" }, { status: 404 });
    }

    const isAdmin = session.user.role === "ADMIN";
    const isOwner = card.recordedById === session.user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    await prisma.cardRecord.delete({ where: { id: cardId } });
    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (error) {
    console.error("Card delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
