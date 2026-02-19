// 홈(피드) 페이지 - 서버 인증 및 데이터 프리페치
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import FeedClient from "./FeedClient";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!session.user.teamId) redirect("/onboarding");

  const teamId = session.user.teamId;
  const userId = session.user.id;
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

  const [logsRaw, eventsRaw] = await Promise.all([
    prisma.trainingLog.findMany({
      where: { user: { teamId } },
      include: {
        user: { select: { id: true, name: true, image: true, position: true, number: true } },
        trainingEvent: { select: { id: true, title: true, date: true } },
        _count: { select: { comments: true, likes: true } },
        likes: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.trainingEvent.findMany({
      where: { teamId, date: { gte: fourHoursAgo } },
      include: {
        venue: { select: { name: true } },
        _count: { select: { rsvps: true } },
        rsvps: { where: { userId }, select: { status: true }, take: 1 },
        checkIns: { where: { userId }, select: { checkedInAt: true }, take: 1 },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  // MVP 판별: trainingEventId 직접 연결 + 날짜 기반 자동 매칭
  const directEventIds = [...new Set(logsRaw.map((l) => l.trainingEventId).filter(Boolean))] as string[];

  const logsWithoutEvent = logsRaw.filter((l) => !l.trainingEventId);
  const dateToEventId: Record<string, string> = {};

  if (logsWithoutEvent.length > 0) {
    const uniqueDates = [...new Set(logsWithoutEvent.map((l) => {
      const d = new Date(l.trainingDate);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }))];

    for (const dateStr of uniqueDates) {
      // 이벤트 다음날 기록하는 경우가 흔하므로 전날~당일 범위로 매칭
      const prevDayStart = new Date(new Date(dateStr + "T00:00:00.000Z").getTime() - 86400000);
      const dayEnd = new Date(dateStr + "T23:59:59.999Z");
      const event = await prisma.trainingEvent.findFirst({
        where: { teamId, date: { gte: prevDayStart, lte: dayEnd } },
        select: { id: true },
        orderBy: { date: "desc" },
      });
      if (event) dateToEventId[dateStr] = event.id;
    }
  }

  const allEventIds = [...new Set([...directEventIds, ...Object.values(dateToEventId)])];
  const mvpUserIdByEvent: Record<string, string> = {};

  if (allEventIds.length > 0) {
    const pomVotes = await prisma.pomVote.findMany({
      where: { trainingEventId: { in: allEventIds } },
      select: { trainingEventId: true, nomineeId: true },
    });

    const countMap: Record<string, Record<string, number>> = {};
    for (const v of pomVotes) {
      if (!countMap[v.trainingEventId]) countMap[v.trainingEventId] = {};
      countMap[v.trainingEventId][v.nomineeId] = (countMap[v.trainingEventId][v.nomineeId] || 0) + 1;
    }
    for (const [eventId, nominees] of Object.entries(countMap)) {
      const sorted = Object.entries(nominees).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) mvpUserIdByEvent[eventId] = sorted[0][0];
    }
  }

  const getEventIdForLog = (log: typeof logsRaw[0]) => {
    if (log.trainingEventId) return log.trainingEventId;
    const d = new Date(log.trainingDate);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return dateToEventId[dateStr] || null;
  };

  // JSON 직렬화 (Date → string, Prisma 객체 → plain object)
  const fallback: Record<string, unknown> = {};

  fallback["/api/training-logs?limit=20"] = JSON.parse(
    JSON.stringify({
      logs: logsRaw.map((log) => {
        const matchedEventId = getEventIdForLog(log);
        return {
          ...log,
          isLiked: log.likes.length > 0,
          isMvp: !!(matchedEventId && mvpUserIdByEvent[matchedEventId] === log.userId),
          eventHasMvp: !!(matchedEventId && mvpUserIdByEvent[matchedEventId]),
          matchedEventId: matchedEventId || undefined,
          likes: undefined,
        };
      }),
    })
  );

  fallback["/api/training-events/next"] = JSON.parse(
    JSON.stringify({
      events: eventsRaw.map((event) => ({
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
        myCheckIn: event.checkIns[0]?.checkedInAt || null,
      })),
    })
  );

  return <FeedClient fallback={fallback} />;
}
