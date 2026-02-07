import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 지각비 납부 확인 (ADMIN)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { feeId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 처리할 수 있습니다" }, { status: 403 });
    }

    const updated = await prisma.lateFee.update({
      where: { id: feeId },
      data: { status: "PAID" },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("지각비 처리 오류:", error);
    return NextResponse.json({ error: "처리에 실패했습니다" }, { status: 500 });
  }
}

// 지각비 삭제 (ADMIN)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; feeId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { feeId } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 삭제할 수 있습니다" }, { status: 403 });
    }

    await prisma.lateFee.delete({ where: { id: feeId } });
    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (error) {
    console.error("지각비 삭제 오류:", error);
    return NextResponse.json({ error: "삭제에 실패했습니다" }, { status: 500 });
  }
}
