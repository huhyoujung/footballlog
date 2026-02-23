// 팀 운동 목록 - 서버 인증 및 데이터 프리페치
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import TrainingEventsClient from "./TrainingEventsClient";

const eventSelect = {
  id: true,
  title: true,
  date: true,
  location: true,
  isRegular: true,
  isFriendlyMatch: true,
  cancelled: true,
  opponentTeamName: true,
  _count: { select: { rsvps: true } },
} as const;

// 팀 단위 60s 캐시 — 같은 팀원 여러 명이 동시 접속해도 DB 쿼리 1회
const getTeamEvents = unstable_cache(
  async (teamId: string) => {
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
    const [upcoming, past] = await Promise.all([
      prisma.trainingEvent.findMany({
        where: { teamId, date: { gte: fourHoursAgo } },
        select: eventSelect,
        orderBy: { date: "asc" },
        take: 20,
      }),
      prisma.trainingEvent.findMany({
        where: { teamId, date: { lt: fourHoursAgo } },
        select: eventSelect,
        orderBy: { date: "desc" },
        take: 20,
      }),
    ]);
    const serialize = (events: typeof upcoming) =>
      events.map((e) => ({ ...e, date: e.date.toISOString() }));
    return { upcoming: serialize(upcoming), past: serialize(past) };
  },
  ["team-events-list"],
  { revalidate: 60 }
);

export default async function TrainingEventsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!session.user.teamId) redirect("/login");

  const { upcoming, past } = await getTeamEvents(session.user.teamId);

  return (
    <TrainingEventsClient
      initialUpcoming={upcoming}
      initialPast={past}
      isAdmin={session.user.role === "ADMIN"}
    />
  );
}
