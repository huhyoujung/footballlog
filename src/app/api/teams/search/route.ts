import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 팀 검색
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    if (!query.trim()) {
      return NextResponse.json({ teams: [] });
    }

    // 팀 이름으로 검색 (대소문자 무시)
    const teams = await prisma.team.findMany({
      where: {
        name: {
          contains: query.trim(),
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        name: true,
        inviteCode: false, // 초대 코드는 숨김
        logoUrl: true,
        _count: {
          select: {
            members: true,
          },
        },
      },
      take: 20,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error("팀 검색 오류:", error);
    return NextResponse.json({ error: "검색에 실패했습니다" }, { status: 500 });
  }
}
