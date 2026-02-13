import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 쪽지 삭제 (받은 사람만 가능)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 쪽지 확인 (받은 사람인지 체크)
    const note = await prisma.lockerNote.findUnique({
      where: { id },
    });

    if (!note) {
      return NextResponse.json({ error: "Note not found" }, { status: 404 });
    }

    if (note.recipientId !== session.user.id) {
      return NextResponse.json(
        { error: "Only the recipient can delete this note" },
        { status: 403 }
      );
    }

    await prisma.lockerNote.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete locker note:", error);
    return NextResponse.json(
      { error: "Failed to delete locker note" },
      { status: 500 }
    );
  }
}
