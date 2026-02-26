const { PrismaClient } = require('../node_modules/@prisma/client');
const prisma = new PrismaClient();

const TEAM_ID = 'cmla84zo20002e623f8qhsl0c';
const CREATED_BY = 'cmla7uxmm0000e6dbpaq4dcaw'; // 허유정

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
  유정: 'cmla7uxmm0000e6dbpaq4dcaw',
  채원: 'cmlejnwh30000ld04rbbeap9t',
};

async function main() {
  const now = new Date();
  // 1시간 전 시작, rsvp는 이미 마감
  const matchStart = new Date(now.getTime() - 60 * 60 * 1000);
  const rsvpDeadline = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  const event = await prisma.trainingEvent.create({
    data: {
      teamId: TEAM_ID,
      createdById: CREATED_BY,
      title: '테스트 라이브 매치',
      date: matchStart,
      location: '증산체육공원 축구장',
      uniform: '홈',
      shoes: ['풋살화'],
      isRegular: true,
      rsvpDeadline,
      matchStatus: 'IN_PROGRESS',
      enablePomVoting: true,
      pomVotesPerPerson: 1,
      teamAScore: 2,
      teamBScore: 1,
    },
  });
  console.log('✅ 라이브 매치 생성:', event.id);

  const attendees = [
    p.유정, p.예림, p.민아, p.이린, p.지선, p.가영,
    p.은진, p.유빈, p.지예, p.민서, p.지현, p.순영,
    p.영현, p.효선, p.아라, p.짱선, p.채원,
  ];

  await prisma.rsvp.createMany({
    data: attendees.map((userId) => ({
      trainingEventId: event.id,
      userId,
      status: 'ATTEND',
    })),
    skipDuplicates: true,
  });
  console.log(`   참가자 ${attendees.length}명 RSVP 등록`);
  console.log('\n🎉 완료! 이벤트 ID:', event.id);
  console.log(`   → /training/${event.id} 에서 확인 가능`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
