import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Metadata } from "next";
import ChallengeClient from "./ChallengeClient";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;

  const event = await prisma.trainingEvent.findUnique({
    where: { challengeToken: token },
    select: {
      date: true,
      location: true,
      opponentTeamName: true,
      team: { select: { name: true } },
      opponentTeam: { select: { name: true } },
    },
  });

  if (!event) return {};

  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const opponentName = event.opponentTeam?.name ?? event.opponentTeamName ?? "상대팀";

  return {
    title: `⚽ ${event.team.name} vs ${opponentName}`,
    description: `${dateStr} · ${event.location}`,
    openGraph: {
      title: `⚽ ${event.team.name} vs ${opponentName}`,
      description: `${dateStr} · ${event.location}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function ChallengePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getServerSession(authOptions);

  const event = await prisma.trainingEvent.findUnique({
    where: { challengeToken: token },
    select: {
      id: true,
      title: true,
      date: true,
      location: true,
      matchStatus: true,
      challengeTokenExpiresAt: true,
      minimumPlayers: true,
      notes: true,
      shoes: true,
      uniform: true,
      teamAScore: true,
      teamBScore: true,
      weather: true,
      weatherDescription: true,
      temperature: true,
      matchRules: {
        select: {
          template: true,
          kickoffTime: true,
          quarterCount: true,
          quarterMinutes: true,
          quarterBreak: true,
          halftime: true,
          playersPerSide: true,
          allowBackpass: true,
          allowOffside: true,
          quarterRefereeTeams: true,
        },
      },
      goalRecords: {
        select: {
          id: true,
          quarter: true,
          minute: true,
          scoringTeam: true,
          isOwnGoal: true,
          scorer: { select: { id: true, name: true } },
          assistant: { select: { id: true, name: true } },
        },
        orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
      },
      cardRecords: {
        select: {
          id: true,
          quarter: true,
          minute: true,
          cardType: true,
          teamSide: true,
          player: { select: { id: true, name: true } },
        },
        orderBy: [{ quarter: "asc" }, { createdAt: "asc" }],
      },
      _count: {
        select: { rsvps: { where: { status: "ATTEND" } } },
      },
      opponentTeamName: true,
      team: {
        select: { id: true, name: true, logoUrl: true, primaryColor: true },
      },
      opponentTeam: {
        select: { id: true, name: true, logoUrl: true, primaryColor: true },
      },
    },
  });

  const isLoggedIn = !!session?.user?.id;
  const hasTeam = !!session?.user?.teamId;
  const isSameTeam = event ? session?.user?.teamId === event.team.id : false;
  const isAdmin = session?.user?.role === "ADMIN";

  // 호스트 유니폼 색상 조회 (팀 DB에 등록된 uniform.color)
  let hostUniformColor: string | null = null;
  if (event?.uniform && event.team.id) {
    const uniformRecord = await prisma.uniform.findUnique({
      where: { teamId_name: { teamId: event.team.id, name: event.uniform } },
      select: { color: true },
    });
    hostUniformColor = uniformRecord?.color ?? null;
  }

  // 수신 팀(상대방) 정보 조회
  let receiverTeam: { id: string; name: string; logoUrl: string | null; primaryColor: string } | null = null;
  if (session?.user?.teamId && !isSameTeam) {
    receiverTeam = await prisma.team.findUnique({
      where: { id: session.user.teamId },
      select: { id: true, name: true, logoUrl: true, primaryColor: true },
    });
  }

  return (
    <ChallengeClient
      token={token}
      event={event ? JSON.parse(JSON.stringify(event)) : null}
      isLoggedIn={isLoggedIn}
      userId={session?.user?.id ?? null}
      hasTeam={hasTeam}
      isSameTeam={isSameTeam}
      isAdmin={isAdmin}
      receiverTeam={receiverTeam ? JSON.parse(JSON.stringify(receiverTeam)) : null}
      hostUniformColor={hostUniformColor}
      opponentTeam={event?.opponentTeam ? JSON.parse(JSON.stringify(event.opponentTeam)) : null}
      opponentTeamName={event?.opponentTeamName ?? null}
    />
  );
}
