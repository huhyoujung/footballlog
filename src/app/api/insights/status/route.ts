// AI 인사이트 상태 조회 — 새 데이터 여부 확인
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const userId = session.user.id;

    const [latestLog, latestInsight] = await Promise.all([
      prisma.trainingLog.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.aIInsight.findFirst({
        where: { userId, type: "PERSONAL" },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    if (!latestLog) {
      return NextResponse.json({
        hasNewData: false,
        hasLogs: false,
        lastInsight: null,
      });
    }

    const hasNewData = !latestInsight || latestLog.createdAt > latestInsight.createdAt;

    return NextResponse.json({
      hasNewData,
      hasLogs: true,
      lastInsight: latestInsight?.createdAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("인사이트 상태 조회 실패:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
