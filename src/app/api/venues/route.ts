import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 구장 검색 (자동완성)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search") || "";

    const venues = await prisma.venue.findMany({
      where: {
        teamId: session.user.teamId,
        name: { contains: search, mode: "insensitive" },
      },
      select: {
        id: true,
        name: true,
        address: true,
        surface: true,
        recommendedShoes: true,
        usageCount: true,
      },
      orderBy: [{ usageCount: "desc" }, { updatedAt: "desc" }],
      take: 10,
    });

    return NextResponse.json({ venues });
  } catch (error) {
    console.error("구장 검색 오류:", error);
    return NextResponse.json({ error: "검색에 실패했습니다" }, { status: 500 });
  }
}
