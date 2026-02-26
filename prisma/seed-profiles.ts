/**
 * Test FC 데모 유저 프로필 사진만 업데이트
 *
 * 사용법:
 *   DATABASE_URL="..." npx tsx prisma/seed-profiles.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PROFILE_IMAGES: Record<string, string> = {
  '허유정': 'https://randomuser.me/api/portraits/women/44.jpg',
  '김정우': 'https://randomuser.me/api/portraits/men/32.jpg',
  '박태현': 'https://randomuser.me/api/portraits/men/45.jpg',
  '이준호': 'https://randomuser.me/api/portraits/men/22.jpg',
  '정성민': 'https://randomuser.me/api/portraits/men/51.jpg',
  '최동현': 'https://randomuser.me/api/portraits/men/67.jpg',
  '한지훈': 'https://randomuser.me/api/portraits/men/18.jpg',
  '윤재석': 'https://randomuser.me/api/portraits/men/75.jpg',
  '강민재': 'https://randomuser.me/api/portraits/men/28.jpg',
  '오승우': 'https://randomuser.me/api/portraits/men/41.jpg',
  '임현우': 'https://randomuser.me/api/portraits/men/56.jpg',
  '송진형': 'https://randomuser.me/api/portraits/men/63.jpg',
  '배정환': 'https://randomuser.me/api/portraits/men/34.jpg',
  '신우진': 'https://randomuser.me/api/portraits/men/12.jpg',
  '조영수': 'https://randomuser.me/api/portraits/men/85.jpg',
  '문성호': 'https://randomuser.me/api/portraits/men/71.jpg',
  '류건우': 'https://randomuser.me/api/portraits/men/48.jpg',
  '황준서': 'https://randomuser.me/api/portraits/men/93.jpg',
};

async function main() {
  const team = await prisma.team.findUnique({ where: { inviteCode: 'JOOP2026' } });
  if (!team) {
    console.log('❌ Test FC 팀이 없습니다.');
    process.exit(1);
  }

  const members = await prisma.user.findMany({ where: { teamId: team.id } });
  console.log(`👥 Test FC 멤버 ${members.length}명 발견`);

  let updated = 0;
  for (const member of members) {
    const image = PROFILE_IMAGES[member.name ?? ''];
    if (image) {
      await prisma.user.update({
        where: { id: member.id },
        data: { image },
      });
      console.log(`  ✅ ${member.name}`);
      updated++;
    }
  }

  console.log(`\n🎉 ${updated}명 프로필 사진 업데이트 완료`);
}

main()
  .catch((e) => {
    console.error('❌ 에러:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
