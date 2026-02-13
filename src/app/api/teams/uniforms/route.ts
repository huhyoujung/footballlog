import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 유니폼 목록 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const uniforms = await prisma.uniform.findMany({
      where: { teamId: session.user.teamId },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ uniforms });
  } catch (error) {
    console.error("유니폼 목록 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// 유니폼 추가
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 추가할 수 있습니다" }, { status: 403 });
    }

    const { name, color } = await req.json();

    if (!name || !color) {
      return NextResponse.json({ error: "이름과 색상을 입력해주세요" }, { status: 400 });
    }

    const uniform = await prisma.uniform.create({
      data: {
        teamId: session.user.teamId,
        name: name.trim(),
        color: color.trim(),
      },
    });

    return NextResponse.json(uniform);
  } catch (error: any) {
    console.error("유니폼 추가 오류:", error);
    if (error.code === "P2002") {
      return NextResponse.json({ error: "이미 같은 이름의 유니폼이 있습니다" }, { status: 400 });
    }
    return NextResponse.json({ error: "추가에 실패했습니다" }, { status: 500 });
  }
}
