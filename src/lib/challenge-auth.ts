import { prisma } from "@/lib/prisma";

interface AuthResult {
  eventId: string;
  linkedEventId: string | null;
  isHostTeam: boolean;
  isOpponentTeam: boolean;
}

// 도전장 토큰 기반 기록 권한 확인
export async function checkChallengeRecordAuth(
  token: string,
  userId: string,
  userTeamId: string,
  isAdmin: boolean
): Promise<AuthResult | null> {
  const event = await prisma.trainingEvent.findUnique({
    where: { challengeToken: token },
    select: {
      id: true,
      teamId: true,
      matchStatus: true,
      linkedEventId: true,
      opponentTeamId: true,
      rsvps: { where: { status: "ATTEND" }, select: { userId: true } },
      linkedEvent: {
        select: {
          id: true,
          rsvps: { where: { status: "ATTEND" }, select: { userId: true } },
        },
      },
    },
  });

  if (!event || event.matchStatus !== "IN_PROGRESS") return null;

  const isHostTeam = userTeamId === event.teamId;
  const isOpponentTeam = !!event.opponentTeamId && userTeamId === event.opponentTeamId;

  const hostAttending = event.rsvps.some((r) => r.userId === userId);
  const opponentAttending = event.linkedEvent?.rsvps.some((r) => r.userId === userId) ?? false;

  const canRecord =
    (isHostTeam && (hostAttending || isAdmin)) ||
    (isOpponentTeam && (opponentAttending || isAdmin));

  if (!canRecord) return null;

  return { eventId: event.id, linkedEventId: event.linkedEventId, isHostTeam, isOpponentTeam };
}
