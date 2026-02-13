import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 앞으로 예정된 모든 이벤트 (피드 배너용)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ events: [] });
    }

    // ?includeToday=true 면 과거 운동만 (오늘 포함, 최신순), 아니면 미래 운동 (오래된 순)
    const { searchParams } = new URL(req.url);
    const includeToday = searchParams.get("includeToday") === "true";

    const now = new Date();
    let whereCondition: any;
    let orderBy: any;

    if (includeToday) {
      // 일지 작성용: 오늘 0시 ~ 현재 시간 (과거 운동만)
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      whereCondition = {
        teamId: session.user.teamId,
        date: { gte: todayStart, lte: now },
      };
      orderBy = { date: "desc" }; // 최신순
    } else {
      // 피드 배너용: 현재 시간 이후 (미래 운동)
      whereCondition = {
        teamId: session.user.teamId,
        date: { gte: now },
      };
      orderBy = { date: "asc" }; // 오래된 순
    }

    const events = await prisma.trainingEvent.findMany({
      where: whereCondition,
      include: {
        venue: { select: { name: true } },
        _count: { select: { rsvps: true } },
        rsvps: {
          where: { userId: session.user.id },
          select: { status: true },
          take: 1,
        },
        checkIns: {
          where: { userId: session.user.id },
          select: { checkedInAt: true },
          take: 1,
        },
      },
      orderBy,
    });

    return NextResponse.json({
      events: events.map((event) => ({
        id: event.id,
        title: event.title,
        isRegular: event.isRegular,
        date: event.date,
        location: event.location,
        venue: event.venue,
        weather: event.weather,
        weatherDescription: event.weatherDescription,
        temperature: event.temperature,
        airQualityIndex: event.airQualityIndex,
        pm25: event.pm25,
        pm10: event.pm10,
        rsvpDeadline: event.rsvpDeadline,
        _count: event._count,
        myRsvp: event.rsvps[0]?.status || null,
        myCheckIn: event.checkIns[0]?.checkedInAt.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error("다음 이벤트 조회 오류:", error);
    return NextResponse.json({ events: [] });
  }
}
