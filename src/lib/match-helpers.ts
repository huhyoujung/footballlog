import { prisma } from '@/lib/prisma';

/**
 * 친선경기 점수 재계산
 * @param trainingEventId 운동 이벤트 ID
 * @returns 양팀 점수 { teamAScore, teamBScore }
 */
export async function recalculateMatchScore(trainingEventId: string) {
  // TEAM_A 득점 (자책골 제외)
  const teamAGoals = await prisma.goalRecord.count({
    where: {
      trainingEventId,
      scoringTeam: 'TEAM_A',
      isOwnGoal: false,
    },
  });

  // TEAM_B 득점 (자책골 제외)
  const teamBGoals = await prisma.goalRecord.count({
    where: {
      trainingEventId,
      scoringTeam: 'TEAM_B',
      isOwnGoal: false,
    },
  });

  // TEAM_A의 자책골 = TEAM_B 득점
  const teamAOwnGoals = await prisma.goalRecord.count({
    where: {
      trainingEventId,
      scoringTeam: 'TEAM_B', // TEAM_B가 득점했지만
      isOwnGoal: true,       // 자책골
    },
  });

  // TEAM_B의 자책골 = TEAM_A 득점
  const teamBOwnGoals = await prisma.goalRecord.count({
    where: {
      trainingEventId,
      scoringTeam: 'TEAM_A', // TEAM_A가 득점했지만
      isOwnGoal: true,       // 자책골
    },
  });

  return {
    teamAScore: teamAGoals + teamAOwnGoals,
    teamBScore: teamBGoals + teamBOwnGoals,
  };
}

/**
 * 친선경기 점수를 재계산하고 TrainingEvent 업데이트
 * @param trainingEventId 운동 이벤트 ID
 * @param linkedEventId 링크된 상대팀 이벤트 ID (옵션)
 */
export async function updateMatchScore(trainingEventId: string, linkedEventId?: string | null) {
  const { teamAScore, teamBScore } = await recalculateMatchScore(trainingEventId);

  // 현재 이벤트 업데이트
  await prisma.trainingEvent.update({
    where: { id: trainingEventId },
    data: { teamAScore, teamBScore },
  });

  // 링크된 상대팀 이벤트도 업데이트
  if (linkedEventId) {
    await prisma.trainingEvent.update({
      where: { id: linkedEventId },
      data: { teamAScore, teamBScore },
    });
  }
}
