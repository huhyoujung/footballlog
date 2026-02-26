/**
 * Test FC 데모 훈련일지에 사진 추가
 *
 * 1. Nutty FC(네모의 꿈)의 기존 사진 URL을 가져와서 재사용
 * 2. 사진이 부족하면 Unsplash stock 이미지로 채움
 *
 * 사용법:
 *   npx tsx prisma/seed-images.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 축구/풋살 훈련 관련 Unsplash 이미지 (무료, 상업적 사용 가능)
const STOCK_IMAGES = [
  'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&q=80', // 축구장
  'https://images.unsplash.com/photo-1553778263-73a83bab9b0c?w=800&q=80', // 축구공
  'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80', // 축구 경기
  'https://images.unsplash.com/photo-1517466787929-bc90951d0974?w=800&q=80', // 훈련
  'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80', // 축구 킥
  'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=800&q=80', // 풋살
];

async function main() {
  // 1. Test FC 팀 찾기
  const joopTeam = await prisma.team.findUnique({ where: { inviteCode: 'JOOP2026' } });
  if (!joopTeam) {
    console.log('❌ Test FC 팀이 없습니다. 먼저 seed.ts를 실행하세요.');
    process.exit(1);
  }

  // 2. Test FC의 훈련일지 가져오기
  const joopLogs = await prisma.trainingLog.findMany({
    where: {
      trainingEvent: { teamId: joopTeam.id },
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log(`📸 Test FC 훈련일지 ${joopLogs.length}개 발견`);

  // 3. Test FC 멤버가 아닌 사용자들의 사진 가져오기
  const joopUserIds = await prisma.user.findMany({
    where: { teamId: joopTeam.id },
    select: { id: true },
  });
  const joopIds = joopUserIds.map((u) => u.id);

  const realLogs = await prisma.trainingLog.findMany({
    where: {
      imageUrl: { not: null },
      userId: { notIn: joopIds },
    },
    select: { imageUrl: true },
  });

  const realImageUrls = realLogs.map((l) => l.imageUrl!).filter(Boolean);
  console.log(`📷 실제 사진 ${realImageUrls.length}개 발견`);

  // 4. 이미지 풀 만들기 (실제 사진 우선 + stock으로 보충)
  const imagePool = [...realImageUrls, ...STOCK_IMAGES];

  // 5. Test FC 일지에 사진 넣기 (일부는 사진 없이 남김 - 현실감)
  let updated = 0;
  for (const [i, log] of joopLogs.entries()) {
    // 약 70%의 일지에만 사진 추가 (현실적)
    if (i % 10 >= 7) continue;

    const imageUrl = imagePool[i % imagePool.length];
    await prisma.trainingLog.update({
      where: { id: log.id },
      data: { imageUrl },
    });
    updated++;
  }

  console.log(`✅ ${updated}/${joopLogs.length}개 일지에 사진 추가 완료`);
}

main()
  .catch((e) => {
    console.error('❌ 에러:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
