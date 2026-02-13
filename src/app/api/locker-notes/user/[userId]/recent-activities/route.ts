import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 특정 사용자의 최근 운동 활동 조회 (팀 운동 + 개인 운동일지)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId } = await params;

    // 받는 사람의 팀 확인
    const recipient = await prisma.user.findUnique({
      where: { id: userId },
      select: { teamId: true },
    });

    if (!recipient?.teamId) {
      return NextResponse.json({ error: "User not found or not in a team" }, { status: 404 });
    }

    // 작성자가 같은 팀인지 확인
    const sender = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { teamId: true },
    });

    if (sender?.teamId !== recipient.teamId) {
      return NextResponse.json({ error: "Not in the same team" }, { status: 403 });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const now = new Date();

    // 최근 30일간의 팀 운동 (받는 사람이 RSVP한 것, 이미 지난 운동만)
    const trainingEvents = await prisma.trainingEvent.findMany({
      where: {
        teamId: recipient.teamId,
        date: {
          gte: thirtyDaysAgo,
          lte: now, // 미래 운동 제외
        },
        rsvps: {
          some: {
            userId,
            status: { in: ["ATTEND", "LATE"] },
          },
        },
      },
      select: {
        id: true,
        title: true,
        date: true,
      },
      orderBy: { date: "desc" },
      take: 10,
    });

    // 최근 30일간의 개인 운동일지 (받는 사람이 작성한 것)
    const trainingLogs = await prisma.trainingLog.findMany({
      where: {
        userId,
        trainingDate: { gte: thirtyDaysAgo },
      },
      select: {
        id: true,
        title: true,
        trainingDate: true,
      },
      orderBy: { trainingDate: "desc" },
      take: 10,
    });

    // 합쳐서 날짜 순으로 정렬
    const activities = [
      ...trainingEvents.map((e) => ({
        id: e.id,
        title: e.title,
        date: e.date,
        type: "event" as const,
      })),
      ...trainingLogs.map((l) => ({
        id: l.id,
        title: l.title || "개인 운동",
        date: l.trainingDate,
        type: "log" as const,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({ activities: activities.slice(0, 15) });
  } catch (error) {
    console.error("Failed to fetch recent activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent activities" },
      { status: 500 }
    );
  }
}
