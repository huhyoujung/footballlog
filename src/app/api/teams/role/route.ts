import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 역할을 변경할 수 있습니다" }, { status: 403 });
    }

    const { userId, role } = await req.json();

    if (!userId || !["ADMIN", "MEMBER"].includes(role)) {
      return NextResponse.json({ error: "잘못된 요청입니다" }, { status: 400 });
    }

    if (userId === session.user.id) {
      return NextResponse.json({ error: "본인의 역할은 변경할 수 없습니다" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser || targetUser.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "같은 팀의 멤버만 변경할 수 있습니다" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role },
      select: { id: true, name: true, role: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("역할 변경 오류:", error);
    return NextResponse.json({ error: "역할 변경에 실패했습니다" }, { status: 500 });
  }
}
