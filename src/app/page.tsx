// 홈(피드) 페이지 - 체크인 배너를 위한 이벤트 데이터만 서버 프리페치
// 팀 이벤트: unstable_cache 60s 팀 공유 캐시 (훈련 당일 팀원 모두에게 캐시 히트)
// 유저별 RSVP/CheckIn: 소량 행 병렬 조회 (캐시 없음)
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import FeedClient from "./FeedClient";

// 팀 이벤트 목록 — 유저 무관, 팀 단위 60s 캐시
// 같은 팀의 여러 멤버가 동시에 앱을 열어도 DB 쿼리 1회만 실행
const getTeamUpcomingEvents = unstable_cache(
  async (teamId: string) => {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    return prisma.trainingEvent.findMany({
      where: { teamId, date: { gte: fourHoursAgo } },
      select: {
        id: true,
        title: true,
        isRegular: true,
        date: true,
        location: true,
        venue: { select: { name: true } },
        weather: true,
        weatherDescription: true,
        temperature: true,
        airQualityIndex: true,
        pm25: true,
        pm10: true,
        rsvpDeadline: true,
        _count: { select: { rsvps: true } },
      },
      orderBy: { date: "asc" },
    });
  },
  ["team-upcoming-events"],
  { revalidate: 60, tags: ["training-events"] }
);

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!session.user.teamId) redirect("/onboarding");

  const teamId = session.user.teamId;
  const userId = session.user.id;

  // 훈련 로그 서버 프리페치 — 이벤트 조회와 병렬 실행 (독립적)
  const [teamEvents, prefetchedLogs] = await Promise.all([
    getTeamUpcomingEvents(teamId),
    prisma.trainingLog.findMany({
      where: { user: { teamId } },
      include: {
        user: {
          select: { id: true, name: true, image: true, position: true, number: true },
        },
        trainingEvent: {
          select: { id: true, title: true, date: true },
        },
        _count: { select: { comments: true, likes: true } },
        likes: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const eventIds = teamEvents.map((e) => e.id);

  // 유저별 RSVP + CheckIn: 행 수가 적어 병렬 조회해도 ~20-50ms
  const [rsvpRows, checkInRows] =
    eventIds.length > 0
      ? await Promise.all([
          prisma.rsvp.findMany({
            where: { trainingEventId: { in: eventIds }, userId },
            select: { trainingEventId: true, status: true },
          }),
          prisma.checkIn.findMany({
            where: { trainingEventId: { in: eventIds }, userId },
            select: { trainingEventId: true, checkedInAt: true },
          }),
        ])
      : [[], []];

  const rsvpMap = new Map(rsvpRows.map((r) => [r.trainingEventId, r.status]));
  const checkInMap = new Map(checkInRows.map((c) => [c.trainingEventId, c.checkedInAt]));

  const fallback: Record<string, unknown> = {};

  fallback["/api/training-events/next"] = JSON.parse(
    JSON.stringify({
      events: teamEvents.map((event) => ({
        ...event,
        myRsvp: rsvpMap.get(event.id) ?? null,
        myCheckIn: checkInMap.get(event.id) ?? null,
      })),
    })
  );

  // 훈련 로그 SWR fallback — 클라이언트 데이터 페치 없이 즉시 이미지 로딩 가능
  fallback["/api/training-logs?limit=20"] = JSON.parse(
    JSON.stringify({
      logs: prefetchedLogs.map((log) => ({
        ...log,
        isLiked: log.likes.length > 0,
        likes: undefined, // 클라이언트에 원시 likes 배열 노출 불필요
      })),
    })
  );

  return <FeedClient fallback={fallback} />;
}
