/**
 * 원더티처 팀 생성 + 오늘의 친선경기 도전장 수락 스크립트
 *
 * 사용법:
 *   DATABASE_URL="..." npx tsx scripts/create-wonderteacher-and-accept.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 오늘 날짜 기준 (한국 시간 기준 오늘)
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  console.log(`오늘 날짜 범위: ${todayStart.toISOString()} ~ ${todayEnd.toISOString()}`);

  // 1. 오늘의 CHALLENGE_SENT 상태 친선경기 이벤트 찾기
  const hostEvent = await prisma.trainingEvent.findFirst({
    where: {
      isFriendlyMatch: true,
      matchStatus: 'CHALLENGE_SENT',
      date: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
    include: {
      team: true,
      matchRules: true,
    },
  });

  if (!hostEvent) {
    console.error('오늘 날짜의 CHALLENGE_SENT 상태 친선경기를 찾을 수 없습니다.');
    process.exit(1);
  }

  console.log(`\n호스트 이벤트 발견:`);
  console.log(`  팀: ${hostEvent.team.name}`);
  console.log(`  제목: ${hostEvent.title}`);
  console.log(`  날짜: ${hostEvent.date.toISOString()}`);
  console.log(`  챌린지 토큰: ${hostEvent.challengeToken}`);

  // 2. 원더티처 팀 이미 존재하는지 확인
  let wonderTeam = await prisma.team.findFirst({
    where: { name: '원더티처' },
    include: { members: { where: { role: 'ADMIN' } } },
  });

  let wonderAdmin;

  if (wonderTeam) {
    console.log(`\n원더티처 팀이 이미 존재합니다 (id: ${wonderTeam.id})`);
    wonderAdmin = wonderTeam.members[0];
    if (!wonderAdmin) {
      console.error('원더티처 팀에 ADMIN 유저가 없습니다.');
      process.exit(1);
    }
  } else {
    console.log('\n원더티처 팀 생성 중...');

    // 원더티처 팀 창설자(더미 유저) 생성
    wonderAdmin = await prisma.user.create({
      data: {
        name: '원더티처 운영진',
        email: `wonderteacher-admin@football-log.internal`,
        role: 'ADMIN',
      },
    });

    // 원더티처 팀 생성
    wonderTeam = await prisma.team.create({
      data: {
        name: '원더티처',
        createdBy: wonderAdmin.id,
        primaryColor: '#3B7DD8', // 파란색 계열
        members: {
          connect: { id: wonderAdmin.id },
        },
      },
      include: { members: { where: { role: 'ADMIN' } } },
    });

    // 유저에게 teamId 설정
    await prisma.user.update({
      where: { id: wonderAdmin.id },
      data: { teamId: wonderTeam.id },
    });

    console.log(`  원더티처 팀 생성 완료 (id: ${wonderTeam.id})`);
    console.log(`  운영진 유저 생성 완료 (id: ${wonderAdmin.id})`);
  }

  // 3. 이미 수락되었는지 확인
  if (hostEvent.matchStatus !== 'CHALLENGE_SENT') {
    console.error(`이벤트가 CHALLENGE_SENT 상태가 아닙니다: ${hostEvent.matchStatus}`);
    process.exit(1);
  }

  // 4. 원더티처 입장에서 상대팀 이벤트 생성
  console.log('\n도전장 수락 처리 중...');

  const opponentEvent = await prisma.trainingEvent.create({
    data: {
      teamId: wonderTeam.id,
      createdById: wonderAdmin.id,
      title: `${hostEvent.team.name}과(와)의 친선경기`,
      isRegular: false,
      isFriendlyMatch: true,
      enablePomVoting: hostEvent.enablePomVoting,
      date: hostEvent.date,
      location: hostEvent.location,
      venueId: hostEvent.venueId,
      shoes: hostEvent.shoes,
      uniform: hostEvent.uniform,
      notes: null,
      rsvpDeadline: hostEvent.rsvpDeadline,
      rsvpDeadlineOffset: hostEvent.rsvpDeadlineOffset,
      minimumPlayers: hostEvent.minimumPlayers,
      opponentTeamId: hostEvent.teamId,
      matchStatus: 'CONFIRMED',
    },
  });

  // 5. 호스트 이벤트 업데이트 (링크 + CONFIRMED)
  await prisma.trainingEvent.update({
    where: { id: hostEvent.id },
    data: {
      linkedEventId: opponentEvent.id,
      opponentTeamId: wonderTeam.id,
      matchStatus: 'CONFIRMED',
    },
  });

  // 6. 쿼터 세션 동기화
  const quarterCount = hostEvent.matchRules?.quarterCount ?? 4;
  const sessionData = Array.from({ length: quarterCount }, (_, i) => ({
    orderIndex: i,
    title: `${i + 1}Q`,
    requiresTeams: false,
    sessionType: 'LINEUP' as const,
  }));

  await prisma.trainingSession.deleteMany({ where: { trainingEventId: hostEvent.id } });
  await prisma.trainingSession.createMany({
    data: sessionData.map((s) => ({ ...s, trainingEventId: hostEvent.id })),
  });

  await prisma.trainingSession.deleteMany({ where: { trainingEventId: opponentEvent.id } });
  await prisma.trainingSession.createMany({
    data: sessionData.map((s) => ({ ...s, trainingEventId: opponentEvent.id })),
  });

  console.log(`\n✅ 완료!`);
  console.log(`  호스트 이벤트 (${hostEvent.team.name}): ${hostEvent.id}`);
  console.log(`  상대팀 이벤트 (원더티처): ${opponentEvent.id}`);
  console.log(`  매치 상태: CONFIRMED`);
  console.log(`  쿼터 수: ${quarterCount}`);
  console.log(`\n챌린지 토큰: ${hostEvent.challengeToken}`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
