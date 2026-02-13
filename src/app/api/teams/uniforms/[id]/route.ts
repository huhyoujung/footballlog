import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 유니폼 수정
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 수정할 수 있습니다" }, { status: 403 });
    }

    const { name, color } = await req.json();

    if (!name || !color) {
      return NextResponse.json({ error: "이름과 색상을 입력해주세요" }, { status: 400 });
    }

    // 유니폼 소유권 확인
    const uniform = await prisma.uniform.findUnique({ where: { id } });
    if (!uniform || uniform.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "유니폼을 찾을 수 없습니다" }, { status: 404 });
    }

    const updated = await prisma.uniform.update({
      where: { id },
      data: {
        name: name.trim(),
        color: color.trim(),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    console.error("유니폼 수정 오류:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "이미 같은 이름의 유니폼이 있습니다" }, { status: 400 });
    }
    return NextResponse.json({ error: "수정에 실패했습니다" }, { status: 500 });
  }
}

// 유니폼 삭제
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 삭제할 수 있습니다" }, { status: 403 });
    }

    // 유니폼 소유권 확인
    const uniform = await prisma.uniform.findUnique({ where: { id } });
    if (!uniform || uniform.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "유니폼을 찾을 수 없습니다" }, { status: 404 });
    }

    await prisma.uniform.delete({ where: { id } });

    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (error) {
    console.error("유니폼 삭제 오류:", error);
    return NextResponse.json({ error: "삭제에 실패했습니다" }, { status: 500 });
  }
}
