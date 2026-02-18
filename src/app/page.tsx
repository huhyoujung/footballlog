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

  // JSON 직렬화 (Date → string, Prisma 객체 → plain object)
  const fallback: Record<string, unknown> = {};

  fallback["/api/training-logs?limit=20"] = JSON.parse(
    JSON.stringify({
      logs: logsRaw.map((log) => ({
        ...log,
        isLiked: log.likes.length > 0,
        likes: undefined,
      })),
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
