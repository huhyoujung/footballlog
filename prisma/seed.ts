/**
 * 해커톤 심사위원용 데모 데이터 Seed 스크립트
 *
 * 프로덕션 DB에 가짜 팀 "Test FC"를 생성합니다.
 * 기존 유저/팀에 영향을 주지 않습니다.
 *
 * 사용법:
 *   DATABASE_URL="프로덕션DB주소" npx tsx prisma/seed.ts
 *
 * 심사위원 체험 방법:
 *   1. Google 로그인
 *   2. 온보딩에서 "Test FC" 검색
 *   3. 초대코드: JOOP2026 입력
 *   4. 팀 합류 후 모든 데모 데이터 확인 가능
 */

import { PrismaClient, Role, RsvpStatus, LateFeeStatus } from '@prisma/client';

const prisma = new PrismaClient();

// === 날짜 헬퍼 ===
function getSunday(weeksAgo: number): Date {
  const now = new Date();
  const day = now.getDay(); // 0=일요일
  const lastSunday = new Date(now);
  lastSunday.setDate(now.getDate() - day - 7 * weeksAgo);
  lastSunday.setHours(9, 0, 0, 0); // 일요일 오전 9시
  return lastSunday;
}

function getNextSunday(): Date {
  const now = new Date();
  const day = now.getDay();
  const next = new Date(now);
  next.setDate(now.getDate() + (7 - day));
  next.setHours(9, 0, 0, 0);
  return next;
}

function getFriday(sundayDate: Date): Date {
  const friday = new Date(sundayDate);
  friday.setDate(sundayDate.getDate() - 2);
  friday.setHours(23, 59, 0, 0);
  return friday;
}

function checkinTime(eventDate: Date, minutesBefore: number): Date {
  const t = new Date(eventDate);
  t.setMinutes(t.getMinutes() - minutesBefore);
  return t;
}

function lateCheckinTime(eventDate: Date, minutesAfter: number): Date {
  const t = new Date(eventDate);
  t.setMinutes(t.getMinutes() + minutesAfter);
  return t;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(14, 0, 0, 0);
  return d;
}

// === 멤버 데이터 ===
const MEMBERS = [
  { name: '김정우', position: 'ST', number: 9, image: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { name: '박태현', position: 'CB', number: 4, image: 'https://randomuser.me/api/portraits/men/45.jpg' },
  { name: '이준호', position: 'GK', number: 1, image: 'https://randomuser.me/api/portraits/men/22.jpg' },
  { name: '정성민', position: 'LW', number: 7, image: 'https://randomuser.me/api/portraits/men/51.jpg' },
  { name: '최동현', position: 'RB', number: 2, image: 'https://randomuser.me/api/portraits/men/67.jpg' },   // 지각 캐릭터
  { name: '한지훈', position: 'CDM', number: 6, image: 'https://randomuser.me/api/portraits/men/18.jpg' },
  { name: '윤재석', position: 'CAM', number: 8, image: 'https://randomuser.me/api/portraits/men/75.jpg' },
  { name: '강민재', position: 'LB', number: 3, image: 'https://randomuser.me/api/portraits/men/28.jpg' },
  { name: '오승우', position: 'RW', number: 11, image: 'https://randomuser.me/api/portraits/men/41.jpg' },
  { name: '임현우', position: 'CF', number: 14, image: 'https://randomuser.me/api/portraits/men/56.jpg' },
  { name: '송진형', position: 'CM', number: 16, image: 'https://randomuser.me/api/portraits/men/63.jpg' },
  { name: '배정환', position: 'CB', number: 5, image: 'https://randomuser.me/api/portraits/men/34.jpg' },
  { name: '신우진', position: 'ST', number: 19, image: 'https://randomuser.me/api/portraits/men/12.jpg' },
  { name: '조영수', position: 'GK', number: 21, image: 'https://randomuser.me/api/portraits/men/85.jpg' },
  { name: '문성호', position: 'RM', number: 17, image: 'https://randomuser.me/api/portraits/men/71.jpg' },
  { name: '류건우', position: 'LM', number: 13, image: 'https://randomuser.me/api/portraits/men/48.jpg' },
  { name: '황준서', position: 'CB', number: 15, image: 'https://randomuser.me/api/portraits/men/93.jpg' },
];

// === 훈련일지 내용 ===
const LOG_CONTENTS = [
  {
    condition: 8,
    conditionReason: '잠을 충분히 자서 컨디션이 좋았다. 워밍업부터 몸이 가벼웠음',
    keyPoints: '오늘 수비 라인 올리는 연습에 집중했는데, 간격 유지하면서 동시에 올리는 타이밍이 점점 좋아지고 있다. 3번 중 2번은 완벽한 오프사이드 트랩 성공',
    improvement: '상대 역습 시 몸 방향 전환이 아직 느림. 백스텝 연습을 더 해야 할 듯',
    notes: '다음주에는 빌드업 연습도 하고 싶다',
  },
  {
    condition: 7,
    conditionReason: '어제 회식이 있어서 좀 무거웠는데 뛰다 보니 괜찮아짐',
    keyPoints: '투터치 패스 연습이 효과 있었음. 특히 원투 패스 후 공간으로 달려드는 움직임이 자연스러워졌다',
    improvement: '왼발 패스가 아직 불안정. 왼발 연습 집중적으로 해야겠다',
    notes: null,
  },
  {
    condition: 9,
    conditionReason: '최고의 컨디션! 터치감이 살아있었음',
    keyPoints: '수비수 뒤 공간 파고드는 오프더볼 무브먼트 연습. 타이밍 맞추는 게 핵심인데 오늘 감이 왔다',
    improvement: '왼발 마무리가 아직 부족하다. 골대 앞에서 침착해질 필요 있음',
    notes: '오늘 해트트릭 ㅋㅋ 기분 좋다',
  },
  {
    condition: 6,
    conditionReason: '무릎이 좀 아팠는데 스트레칭 하고 시작하니 괜찮았음',
    keyPoints: '1대1 수비 훈련 집중. 상대를 안쪽으로 몰아가는 포지셔닝 연습했는데 꽤 잘 됐다',
    improvement: '공중볼 경합에서 타이밍이 자꾸 늦음. 점프 타이밍 연습 필요',
    notes: '무릎 상태 주시하면서 훈련 강도 조절하자',
  },
  {
    condition: 8,
    conditionReason: '평소보다 일찍 일어나서 스트레칭 하고 왔더니 컨디션이 좋음',
    keyPoints: '오늘 GK 훈련 집중! 1대1 상황에서 몸을 낮추고 타이밍 맞추는 연습. 세이브 성공률이 올라가는 느낌',
    improvement: '롱킥 정확도가 좀 떨어짐. 목표 지점까지 정확히 보내는 연습 필요',
    notes: '정우 형 슈팅이 진짜 세다...',
  },
  {
    condition: 7,
    conditionReason: '평일에 런닝을 했더니 체력이 좀 더 나아진 느낌',
    keyPoints: '전방 압박 연습. 상대 빌드업 시 어디를 막아야 하는지 감이 잡혔다. 팀 전체가 동시에 움직이는 게 중요',
    improvement: '압박 후 체력 배분이 아직 안 됨. 후반에 너무 처짐',
    notes: null,
  },
  {
    condition: 8,
    conditionReason: '날씨가 좋아서 기분 좋게 시작함',
    keyPoints: '크로스 연습. 풀백에서 올리는 얼리크로스 타이밍이 좋아지고 있다. 정우가 헤딩으로 잘 마무리해줌',
    improvement: '수비 시 역습 전환이 좀 느림. 인터셉트 후 바로 전방으로 전개하는 연습 필요',
    notes: '다음주 비 온다는데 실내 훈련도 고려해봐야겠다',
  },
  {
    condition: 9,
    conditionReason: '오늘 진짜 최고 컨디션. 몸이 가볍고 집중력도 좋았음',
    keyPoints: '미니게임에서 중원 장악이 잘 됐다. 특히 볼 소유 시 주변 시야 확보가 빨라지고 있음',
    improvement: '수비적 미드필더 역할할 때 포지셔닝이 좀 높았음. 밸런스 유지 연습',
    notes: '팀 전체적으로 패스 연결이 좋아지고 있다',
  },
  {
    condition: 5,
    conditionReason: '감기 기운이 있어서 좀 힘들었다',
    keyPoints: '컨디션 안 좋았지만 기본기 위주로 훈련. 숏패스 정확도에 집중했는데 나름 괜찮았음',
    improvement: '체력이 부족하니 기본기마저 흔들림. 꾸준히 체력 관리해야겠다',
    notes: '무리하지 말고 다음주에 만회하자',
  },
  {
    condition: 8,
    conditionReason: '이번주 잘 쉬어서 회복이 잘 됨',
    keyPoints: '세트피스 연습. 코너킥에서 니어존 움직임 타이밍을 잡았다. 프리킥 직접 슈팅도 연습했는데 2/5 on target',
    improvement: '프리킥 벽 넘기는 각도 조절이 아직 부족함',
    notes: '세트피스로 득점하면 진짜 기분 좋겠다',
  },
];

// === 댓글 내용 ===
const COMMENT_TEXTS = [
  '오늘 진짜 잘했어 👍',
  '수비 라인 올리는 거 완전 좋아졌다!',
  '다음주에도 이 컨디션 유지하자 💪',
  'ㅋㅋㅋ 오늘 골 미쳤다',
  '역습 전환 속도 빨라진 거 나도 느꼈어',
  '왼발 연습 같이 하자!',
  '오늘 세이브 진짜 좋았어 👏',
  '체력 훈련 같이 하자 ㅋㅋ',
  '팀 패스 연결 진짜 좋아지고 있다',
  '다음주 비 오면 실내에서 하자!',
  '크로스 타이밍 진짜 좋았어',
  '해트트릭 축하 🎉🎉🎉',
  '프리킥 연습 같이 하자! 나도 연습해야 돼',
  '컨디션 안좋은데도 기본기가 좋으니까 괜찮았어',
  '감기 조심해 ㅠㅠ 푹 쉬어',
];

// === 라커노트 데이터 ===
const LOCKER_NOTES_DATA = [
  { content: '정우야 오늘 골 진짜 미쳤다 🔥 해트트릭 실화냐', color: '#FFD700', tags: ['공격', '슈팅', '득점'] },
  { content: '유정아 매주 훈련 준비해줘서 감사해요! 진짜 운영진 없으면 팀이 안 돌아감', color: '#FFB6C1', tags: ['리더십', '팀워크'] },
  { content: '준호야 오늘 세이브 소름 돋았어... 진짜 프로급', color: '#87CEEB', tags: ['수비', '세이브'] },
  { content: '태현이 형 수비 라인 올리는 거 진짜 잘한다. 오프사이드 트랩 장인', color: '#98FB98', tags: ['수비', '포지셔닝'] },
  { content: '재석아 원투 패스 감각 진짜 좋아지고 있어! 오늘 어시 2개 ㅋㅋ', color: '#DDA0DD', tags: ['패스', '어시스트'] },
  { content: '성민이 오늘 왼쪽에서 올린 크로스 진짜 예술이었다', color: '#FFDAB9', tags: ['크로스', '공격'] },
];

// === MAIN ===
async function main() {
  // 이미 데모 팀이 있는지 확인
  const existing = await prisma.team.findUnique({ where: { inviteCode: 'JOOP2026' } });
  if (existing) {
    console.log('⚠️  Test FC 데모 팀이 이미 존재합니다. 중복 생성을 방지합니다.');
    console.log('   기존 데이터를 삭제하려면 DB에서 직접 삭제 후 다시 실행하세요.');
    process.exit(0);
  }

  console.log('🌱 Test FC 데모 데이터를 생성합니다...');
  console.log('');

  // === 1. 데모 운영진 유저 생성 ===
  console.log('👑 데모 운영진 생성: 허유정');
  const adminUser = await prisma.user.create({
    data: {
      name: '허유정',
      email: 'admin@demo.joopfc.com',
      image: 'https://randomuser.me/api/portraits/women/44.jpg',
      role: Role.ADMIN,
      position: 'CM',
      number: 10,
    },
  });

  // === 2. 팀 생성 ===
  console.log('⚽ 팀 생성: Test FC');
  const team = await prisma.team.create({
    data: {
      name: 'Test FC',
      primaryColor: '#967B5D',
      inviteCode: 'JOOP2026',
      createdBy: adminUser.id,
    },
  });

  // 운영진을 팀에 소속
  await prisma.user.update({
    where: { id: adminUser.id },
    data: { teamId: team.id },
  });

  // === 3. 멤버 생성 ===
  console.log(`👥 팀원 ${MEMBERS.length}명 생성 중...`);
  const memberUsers: { id: string; name: string; position: string; number: number }[] = [];

  for (const m of MEMBERS) {
    const user = await prisma.user.create({
      data: {
        name: m.name,
        email: `${m.name.replace(/\s/g, '')}@demo.joopfc.com`,
        image: m.image,
        role: Role.MEMBER,
        teamId: team.id,
        position: m.position,
        number: m.number,
      },
    });
    memberUsers.push({ id: user.id, name: m.name, position: m.position, number: m.number });
  }

  const allUsers = [
    { id: adminUser.id, name: '허유정', position: 'CM', number: 10 },
    ...memberUsers,
  ];

  // 이름으로 유저 찾기 헬퍼
  const findUser = (name: string) => allUsers.find((u) => u.name === name)!;

  // === 4. 장소 생성 ===
  console.log('📍 훈련 장소 생성...');
  const venue = await prisma.venue.create({
    data: {
      teamId: team.id,
      name: '한강 풋살파크',
      address: '서울시 영등포구 여의도동 한강시민공원',
      surface: '인조잔디',
      usageCount: 12,
    },
  });

  // === 5. 장비 생성 ===
  console.log('🎒 장비 생성...');
  const equipments = [];
  for (const [i, eq] of ['축구공 (5개)', '라바콘', '미니골대', '조끼 세트'].entries()) {
    const equipment = await prisma.equipment.create({
      data: { teamId: team.id, name: eq, orderIndex: i },
    });
    equipments.push(equipment);
  }

  // === 6. 장비 담당자 배정 ===
  console.log('🏷️ 장비 담당자 배정...');
  // 한지훈: 축구공 담당 / 강민재: 라바콘+미니골대 담당 / 배정환: 조끼 세트 담당
  const equipmentManagerAssignments = [
    { managerName: '한지훈', equipmentName: '축구공 (5개)' },
    { managerName: '강민재', equipmentName: '라바콘' },
    { managerName: '강민재', equipmentName: '미니골대' },
    { managerName: '배정환', equipmentName: '조끼 세트' },
  ];
  for (const { managerName, equipmentName } of equipmentManagerAssignments) {
    const manager = findUser(managerName);
    const equipment = equipments.find((e) => e.name === equipmentName)!;
    await prisma.equipment.update({
      where: { id: equipment.id },
      data: { managers: { connect: { id: manager.id } } },
    });
  }
  console.log('  ✅ 장비 담당자 3명 배정: 한지훈(축구공), 강민재(라바콘·미니골대), 배정환(조끼)');

  // === 7. 유니폼 생성 ===
  console.log('👕 유니폼 생성...');
  await prisma.uniform.createMany({
    data: [
      { teamId: team.id, name: '홈', color: '#967B5D' },
      { teamId: team.id, name: '원정', color: '#F5F0EB' },
    ],
  });

  // === 8. 조끼 순번 설정 ===
  console.log('🦺 조끼 순번 설정...');
  const vestOrder = [
    findUser('최동현').id,
    findUser('한지훈').id,
    findUser('강민재').id,
    findUser('배정환').id,
    findUser('류건우').id,
  ];
  await prisma.team.update({
    where: { id: team.id },
    data: { vestOrder },
  });

  // === 9. 훈련 일정 생성 (과거 4주 + 이번주) ===
  console.log('📅 훈련 일정 생성...');

  const eventDates = [
    { date: getSunday(4), label: '4주 전' },
    { date: getSunday(3), label: '3주 전' },
    { date: getSunday(2), label: '2주 전' },
    { date: getSunday(1), label: '지난주' },
  ];

  const pastEvents = [];
  const vestBringerRotation = [
    findUser('최동현'),
    findUser('한지훈'),
    findUser('강민재'),
    findUser('배정환'),
  ];

  for (const [i, { date, label }] of eventDates.entries()) {
    console.log(`  📌 ${label} 훈련 (${date.toLocaleDateString('ko-KR')})`);

    const event = await prisma.trainingEvent.create({
      data: {
        teamId: team.id,
        createdById: adminUser.id,
        title: '정기 훈련',
        date,
        location: '한강 풋살파크',
        venueId: venue.id,
        rsvpDeadline: getFriday(date),
        enablePomVoting: true,
        pomVotingDeadline: new Date(date.getTime() + 24 * 60 * 60 * 1000), // 다음날
        vestBringerId: vestBringerRotation[i].id,
        vestReceiverId: vestBringerRotation[(i + 1) % vestBringerRotation.length].id,
        weather: ['Clear', 'Clouds', 'Clear', 'Clouds'][i],
        weatherDescription: ['맑음', '흐림', '맑음', '구름 조금'][i],
        temperature: [3, 1, 5, 8][i],
        feelsLikeC: [0, -2, 2, 5][i],
        pm25: [15, 25, 12, 18][i],
        pm10: [30, 45, 22, 35][i],
        airQualityIndex: [1, 2, 1, 1][i],
      },
    });
    pastEvents.push(event);

    // RSVP: 대부분 참석, 2명 불참, 1명 늦참
    const attendees = allUsers.filter(
      (u) => u.name !== '조영수' && u.name !== '황준서'
    ); // 이 2명 항상 불참
    const absentees = allUsers.filter(
      (u) => u.name === '조영수' || u.name === '황준서'
    );

    for (const user of attendees) {
      const isLate = user.name === '최동현';
      await prisma.rsvp.create({
        data: {
          trainingEventId: event.id,
          userId: user.id,
          status: isLate ? RsvpStatus.LATE : RsvpStatus.ATTEND,
          reason: isLate ? '좀 늦을 것 같아요 ㅠ' : null,
        },
      });
    }
    for (const user of absentees) {
      await prisma.rsvp.create({
        data: {
          trainingEventId: event.id,
          userId: user.id,
          status: RsvpStatus.ABSENT,
          reason: ['일정이 있어서', '몸이 안 좋아서'][absentees.indexOf(user)],
        },
      });
    }

    // 체크인: 참석자 전원 (최동현만 지각)
    for (const user of attendees) {
      const isLate = user.name === '최동현';
      await prisma.checkIn.create({
        data: {
          trainingEventId: event.id,
          userId: user.id,
          checkedInAt: isLate
            ? lateCheckinTime(date, 15 + Math.floor(Math.random() * 15))
            : checkinTime(date, Math.floor(Math.random() * 15)),
          isLate,
        },
      });
    }

    // 지각비: 최동현에게 매번
    await prisma.lateFee.create({
      data: {
        trainingEventId: event.id,
        userId: findUser('최동현').id,
        amount: 5000,
        status: i < 3 ? LateFeeStatus.PAID : LateFeeStatus.PENDING,
      },
    });

    // 세션 (2개씩)
    const session1 = await prisma.trainingSession.create({
      data: {
        trainingEventId: event.id,
        title: '패스 & 포지셔닝',
        memo: '투터치 패스 위주로 진행',
        requiresTeams: true,
        orderIndex: 0,
      },
    });
    const session2 = await prisma.trainingSession.create({
      data: {
        trainingEventId: event.id,
        title: '미니게임',
        memo: '8:8 미니게임 (골키퍼 포함)',
        requiresTeams: true,
        orderIndex: 1,
      },
    });

    // 팀 배분 (A팀/B팀)
    const shuffled = [...attendees].sort(() => Math.random() - 0.5);
    const half = Math.ceil(shuffled.length / 2);
    for (const [si, session] of [session1, session2].entries()) {
      for (const [j, user] of shuffled.entries()) {
        await prisma.sessionTeamAssignment.create({
          data: {
            trainingSessionId: session.id,
            userId: user.id,
            teamLabel: j < half ? 'A' : 'B',
          },
        });
      }
    }

    // 장비 배정
    const equipManager = attendees[i % attendees.length];
    for (const eq of equipments) {
      await prisma.equipmentAssignment.create({
        data: {
          trainingEventId: event.id,
          equipmentId: eq.id,
          userId: equipManager.id,
        },
      });
    }

    // POM 투표: 김정우가 매번 최다 득표
    const voters = attendees.filter((u) => u.name !== '김정우').slice(0, 8);
    const pomReasons = [
      '오늘 골 3개 넣었다! 해트트릭 장인',
      '역습 전환이 너무 빨랐어',
      '수비수 뒤 침투 타이밍이 예술',
      '오늘 경기 지배했다',
      '슈팅 정확도가 미쳤다',
      '오프더볼 무브먼트 최고',
      '원투 패스 후 마무리까지 완벽',
      '오늘 진짜 못 막았다',
    ];
    for (const [vi, voter] of voters.entries()) {
      // 대부분 김정우에게, 일부 다른 사람에게
      const nominee = vi < 5 ? findUser('김정우') : attendees[vi + 1];
      await prisma.pomVote.create({
        data: {
          trainingEventId: event.id,
          voterId: voter.id,
          nomineeId: nominee.id,
          reason: pomReasons[vi],
        },
      });
    }
  }

  // === 10. 이번주 예정 훈련 (RSVP 진행 중) ===
  console.log('  📌 이번주 훈련 (RSVP 진행 중)');
  const nextEvent = await prisma.trainingEvent.create({
    data: {
      teamId: team.id,
      createdById: adminUser.id,
      title: '정기 훈련',
      date: getNextSunday(),
      location: '한강 풋살파크',
      venueId: venue.id,
      rsvpDeadline: getFriday(getNextSunday()),
      enablePomVoting: true,
      vestBringerId: findUser('류건우').id,
    },
  });

  // 일부만 RSVP 응답 (시연용: 응답 안 한 사람 있어야 함)
  const respondedMembers = allUsers.slice(0, 10);
  const notRespondedMembers = allUsers.slice(10);

  for (const user of respondedMembers) {
    await prisma.rsvp.create({
      data: {
        trainingEventId: nextEvent.id,
        userId: user.id,
        status: RsvpStatus.ATTEND,
      },
    });
  }
  // 2명은 불참
  for (const user of [findUser('조영수'), findUser('황준서')]) {
    await prisma.rsvp.create({
      data: {
        trainingEventId: nextEvent.id,
        userId: user.id,
        status: RsvpStatus.ABSENT,
        reason: '이번주 일정이 있어서',
      },
    });
  }

  console.log(
    `  ✅ RSVP: ${respondedMembers.length}명 참석, 2명 불참, ${notRespondedMembers.length - 2}명 미응답`
  );

  // === 11. 훈련일지 생성 ===
  console.log('📝 훈련일지 생성...');

  // 일지 작성자 배분 (이벤트당 2-3개)
  const logAssignments = [
    { eventIdx: 0, userNames: ['허유정', '김정우', '이준호'] },
    { eventIdx: 1, userNames: ['허유정', '박태현', '정성민'] },
    { eventIdx: 2, userNames: ['김정우', '한지훈', '오승우'] },
    { eventIdx: 3, userNames: ['허유정', '김정우', '윤재석', '강민재'] },
  ];

  let logContentIdx = 0;
  const createdLogs: { id: string; userId: string; userName: string; eventIdx: number }[] = [];

  for (const { eventIdx, userNames } of logAssignments) {
    const event = pastEvents[eventIdx];
    for (const userName of userNames) {
      const user = findUser(userName);
      const content = LOG_CONTENTS[logContentIdx % LOG_CONTENTS.length];
      const log = await prisma.trainingLog.create({
        data: {
          userId: user.id,
          trainingEventId: event.id,
          trainingDate: event.date,
          condition: content.condition,
          conditionReason: content.conditionReason,
          keyPoints: content.keyPoints,
          improvement: content.improvement,
          notes: content.notes,
        },
      });
      createdLogs.push({ id: log.id, userId: user.id, userName, eventIdx });
      logContentIdx++;
    }
  }

  console.log(`  ✅ ${createdLogs.length}개 일지 생성`);

  // === 12. 댓글 & 좋아요 ===
  console.log('💬 댓글 & 좋아요 생성...');

  let commentCount = 0;
  let likeCount = 0;

  for (const log of createdLogs) {
    // 각 일지에 2-4개 댓글
    const commentersPool = allUsers.filter((u) => u.id !== log.userId);
    const numComments = 2 + Math.floor(Math.random() * 3);
    const commenters = commentersPool.sort(() => Math.random() - 0.5).slice(0, numComments);

    for (const [ci, commenter] of commenters.entries()) {
      await prisma.comment.create({
        data: {
          trainingLogId: log.id,
          userId: commenter.id,
          content: COMMENT_TEXTS[(commentCount + ci) % COMMENT_TEXTS.length],
          createdAt: new Date(
            pastEvents[log.eventIdx].date.getTime() + (ci + 1) * 30 * 60 * 1000
          ),
        },
      });
      commentCount++;
    }

    // 각 일지에 3-8개 좋아요
    const numLikes = 3 + Math.floor(Math.random() * 6);
    const likers = commentersPool.sort(() => Math.random() - 0.5).slice(0, numLikes);
    for (const liker of likers) {
      await prisma.like.create({
        data: {
          trainingLogId: log.id,
          userId: liker.id,
        },
      });
      likeCount++;
    }
  }

  console.log(`  ✅ 댓글 ${commentCount}개, 좋아요 ${likeCount}개`);

  // === 13. 라커노트 ===
  console.log('📌 라커노트 생성...');

  const noteAssignments = [
    { authorName: '허유정', recipientName: '김정우', noteIdx: 0, eventIdx: 3 },
    { authorName: '김정우', recipientName: '허유정', noteIdx: 1, eventIdx: 3 },
    { authorName: '박태현', recipientName: '이준호', noteIdx: 2, eventIdx: 2 },
    { authorName: '허유정', recipientName: '박태현', noteIdx: 3, eventIdx: 1 },
    { authorName: '정성민', recipientName: '윤재석', noteIdx: 4, eventIdx: 3 },
    { authorName: '오승우', recipientName: '정성민', noteIdx: 5, eventIdx: 2 },
  ];

  for (const [i, na] of noteAssignments.entries()) {
    const note = LOCKER_NOTES_DATA[na.noteIdx];
    await prisma.lockerNote.create({
      data: {
        content: note.content,
        color: note.color,
        rotation: -2 + Math.random() * 4,
        positionX: 0.2 + Math.random() * 0.6,
        positionY: 0.2 + Math.random() * 0.6,
        isAnonymous: i === 3, // 하나만 익명
        tags: note.tags,
        authorId: findUser(na.authorName).id,
        recipientId: findUser(na.recipientName).id,
        trainingEventId: pastEvents[na.eventIdx].id,
        createdAt: daysAgo(7 - i),
      },
    });
  }

  console.log(`  ✅ 라커노트 ${noteAssignments.length}개`);

  // === 14. 닦달 ===
  console.log('📣 닦달 생성...');

  const nudgeData = [
    { senderName: '허유정', recipientName: '신우진' },
    { senderName: '허유정', recipientName: '문성호' },
    { senderName: '김정우', recipientName: '류건우' },
    { senderName: '박태현', recipientName: '송진형' },
  ];

  for (const [i, nd] of nudgeData.entries()) {
    await prisma.nudge.create({
      data: {
        senderId: findUser(nd.senderName).id,
        recipientId: findUser(nd.recipientName).id,
        teamId: team.id,
        createdAt: daysAgo(i),
      },
    });
  }

  console.log(`  ✅ 닦달 ${nudgeData.length}개`);

  // === 15. 훈련 일정 댓글 ===
  console.log('💬 훈련 일정 댓글 생성...');

  const eventComments = [
    { eventIdx: 3, authorName: '정성민', content: '이번주 비 안 오죠??' },
    { eventIdx: 3, authorName: '허유정', content: '맑음 예보! 걱정 마세요 ☀️' },
    { eventIdx: 3, authorName: '최동현', content: '이번엔 안 늦을게요 ㅋㅋ' },
    { eventIdx: 3, authorName: '김정우', content: 'ㅋㅋㅋㅋ 동현아 그 말 매주 하잖아' },
  ];

  for (const ec of eventComments) {
    await prisma.trainingEventComment.create({
      data: {
        trainingEventId: pastEvents[ec.eventIdx].id,
        authorId: findUser(ec.authorName).id,
        content: ec.content,
      },
    });
  }

  // === 완료 ===
  console.log('');
  console.log('✨ 데모 데이터 생성 완료!');
  console.log('');
  console.log('📊 요약:');
  console.log(`   팀: Test FC (${team.primaryColor})`);
  console.log(`   팀원: ${allUsers.length}명 (운영진 1 + 멤버 ${MEMBERS.length})`);
  console.log(`   훈련 일정: ${pastEvents.length}개 완료 + 1개 예정`);
  console.log(`   훈련일지: ${createdLogs.length}개`);
  console.log(`   댓글: ${commentCount}개, 좋아요: ${likeCount}개`);
  console.log(`   라커노트: ${noteAssignments.length}개`);
  console.log(`   닦달: ${nudgeData.length}개`);
  console.log('');
  console.log('🎬 이제 앱을 새로고침하면 데모 데이터가 보입니다!');
}

main()
  .catch((e) => {
    console.error('❌ 에러:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
