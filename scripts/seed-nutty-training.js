const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

const TEAM_ID = 'cmla84zo20002e623f8qhsl0c';
const CREATED_BY = 'cmla7uxmm0000e6dbpaq4dcaw'; // 허유정 (팀 생성자)

// 참가자 ID 매핑
const p = {
  예림: 'cmlee0zoh0004l504vaej2q19',
  민아: 'cmlfvhf6k0000ju04ad9lxssi',
  이린: 'cmlfx9z1g0002kz04h9b5vtgw',
  지선: 'cmld4pyll000ejv04wshmyqvi',
  가영: 'cmlkr7wn20000jj04mdf1cetc',
  은진: 'cmlciqfrd0000l4044e4ilhbb',
  유빈: 'cmld4llcb0000l404yzkvcxvs',
  지예: 'cmldd591p0000kz043q6gmcnu',
  민서: 'cmlh9000g0000jq0434f8yx2m',
  지현: 'cmlef4wn90000ky04xk6whhws',
  순영: 'cmlclyou80002i904dggcnsj4',
  영현: 'cmlei65t40000ky04sq75wizc',
  효선: 'cmlegj69n0005ky04qstxh64h',
  아라: 'cmlczyrhe0004ky047ea15qyx',
  짱선: 'cmldejk660000ld04vis8ymgt',
  가인: 'cmlfxfcdb0000if04no7ti240',
  유정: 'cmla7uxmm0000e6dbpaq4dcaw',
  채원: 'cmlejnwh30000ld04rbbeap9t',
  지수: 'cmlck9r5n0000ks04r3617z4c',
  정지: 'cmlg0kuvm0006l8047ifpe1hd',
  망곰: 'cmli59fuw0000kw04cdh3zme9',
  구지: 'cmlcxo2te0000l104wl1m8soz',
  도현: 'cmleslamg0000ld04zkecp9ct',
  서영: 'cmleee55o0002le04jiuy5k1j',
  서형: 'cmledzy400000l504saxijqgu',
  수빈: 'cmledsosr0000l204v6beaj9r',
  예영: 'cmlu23v900000l2046k8wfibv',
  유진: 'cmldfdzno0000jp04jd35zi8w',
  은선: 'cmlcizqvg0000k004e37f34g8',
  최지: 'cmltgijku0000la045s6i5dpm',
  하은: 'cmld3kpa70000jr045qpr0ebg',
  혜원: 'cmlfxmlmz0002jy04b53gtflb',
};

async function main() {
  // ── 1월 정기운동 (1/11 일 16-18시) ──────────────────────────────
  const event1 = await prisma.trainingEvent.create({
    data: {
      teamId: TEAM_ID,
      createdById: CREATED_BY,
      title: '부상 방지 트레이닝 세션',
      date: new Date('2026-01-11T07:00:00.000Z'), // 16:00 KST
      location: '염광학원 보배관 (노원구 월계로45가길9)',
      uniform: '자유',
      shoes: ['풋살화'],
      isRegular: true,
      rsvpDeadline: new Date('2026-01-10T07:00:00.000Z'),
      matchStatus: 'COMPLETED',
      enablePomVoting: false,
    },
  });
  console.log('✅ 1월 정기운동 생성:', event1.id);

  const attendees1 = [
    p.예림, p.민아, p.이린, p.지선, p.가영, p.은진, p.유빈, p.지예,
    p.민서, p.지현, p.순영, p.영현, p.효선, p.아라, p.짱선, p.가인,
    p.유정, p.채원, p.지수, p.정지, p.망곰,
  ];
  await prisma.rsvp.createMany({
    data: attendees1.map((userId) => ({
      trainingEventId: event1.id,
      userId,
      status: 'ATTEND',
    })),
    skipDuplicates: true,
  });
  console.log(`   참가자 ${attendees1.length}명 RSVP 등록`);

  // ── 2월 1차 정기운동 (2/1 일 18-20시) ───────────────────────────
  const event2 = await prisma.trainingEvent.create({
    data: {
      teamId: TEAM_ID,
      createdById: CREATED_BY,
      title: '2월 1차 정기운동',
      date: new Date('2026-02-01T09:00:00.000Z'), // 18:00 KST
      location: '증산체육공원 축구장',
      uniform: '홈',
      shoes: [],
      isRegular: true,
      rsvpDeadline: new Date('2026-01-31T09:00:00.000Z'),
      matchStatus: 'COMPLETED',
      enablePomVoting: false,
    },
  });
  console.log('✅ 2월 1차 정기운동 생성:', event2.id);

  const attendees2 = [
    p.아라, p.가영, p.가인, p.구지, p.도현, p.망곰, p.민서, p.민아,
    p.서영, p.서형, p.수빈, p.순영, p.영현, p.예영, p.유진, p.은선,
    p.은진, p.이린, p.지수, p.지예, p.짱선, p.채원, p.최지, p.하은,
    p.효선,
  ];
  await prisma.rsvp.createMany({
    data: attendees2.map((userId) => ({
      trainingEventId: event2.id,
      userId,
      status: 'ATTEND',
    })),
    skipDuplicates: true,
  });
  console.log(`   참가자 ${attendees2.length}명 RSVP 등록`);

  // ── 2월 2차 정기운동 (2/8 일 18-20시) ───────────────────────────
  const event3 = await prisma.trainingEvent.create({
    data: {
      teamId: TEAM_ID,
      createdById: CREATED_BY,
      title: '2월 2차 정기운동',
      date: new Date('2026-02-08T09:00:00.000Z'), // 18:00 KST
      location: '살곶이 체육공원 축구장',
      uniform: '홈',
      shoes: [],
      isRegular: true,
      rsvpDeadline: new Date('2026-02-07T09:00:00.000Z'),
      matchStatus: 'COMPLETED',
      enablePomVoting: false,
    },
  });
  console.log('✅ 2월 2차 정기운동 생성:', event3.id);

  const attendees3 = [
    p.아라, p.구지, p.도현, p.서형, p.수빈, p.순영, p.영현, p.예영,
    p.유빈, p.유정, p.유진, p.은선, p.은진, p.이린, p.지선, p.지수,
    p.지예, p.지현, p.짱선, p.채원, p.하은, p.혜원, p.효선,
  ];
  await prisma.rsvp.createMany({
    data: attendees3.map((userId) => ({
      trainingEventId: event3.id,
      userId,
      status: 'ATTEND',
    })),
    skipDuplicates: true,
  });
  console.log(`   참가자 ${attendees3.length}명 RSVP 등록`);

  console.log('\n🎉 완료!');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
