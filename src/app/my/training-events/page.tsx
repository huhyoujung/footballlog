// 팀 운동 목록 - 서버 인증 및 데이터 프리페치
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import TrainingEventsClient from "./TrainingEventsClient";

export default async function TrainingEventsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (!session.user.teamId) redirect("/login");

  const teamId = session.user.teamId;
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);

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

  // Date → string 직렬화
  const serialize = (events: typeof upcoming) =>
    events.map((e) => ({ ...e, date: e.date.toISOString() }));

  return (
    <TrainingEventsClient
      initialUpcoming={serialize(upcoming)}
      initialPast={serialize(past)}
      isAdmin={session.user.role === "ADMIN"}
    />
  );
}
