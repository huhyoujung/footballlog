import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import ChallengeClient from "./ChallengeClient";

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
      matchRules: {
        select: {
          template: true,
          quarterCount: true,
          quarterMinutes: true,
          quarterBreak: true,
          halftime: true,
          playersPerSide: true,
          allowBackpass: true,
          allowOffside: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          primaryColor: true,
        },
      },
    },
  });

  const isLoggedIn = !!session?.user?.id;
  const hasTeam = !!session?.user?.teamId;
  const isSameTeam = event ? session?.user?.teamId === event.team.id : false;
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <ChallengeClient
      token={token}
      event={event ? JSON.parse(JSON.stringify(event)) : null}
      isLoggedIn={isLoggedIn}
      hasTeam={hasTeam}
      isSameTeam={isSameTeam}
      isAdmin={isAdmin}
    />
  );
}
