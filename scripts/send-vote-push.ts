import { PrismaClient } from "@prisma/client";
import webPush from "web-push";

// 프로덕션 DB 직접 연결
const prisma = new PrismaClient({
  datasourceUrl: process.env.PROD_DATABASE_URL || process.env.DATABASE_URL,
});

async function main() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    console.error("❌ VAPID keys not configured");
    process.exit(1);
  }

  webPush.setVapidDetails("mailto:noreply@football-log.app", publicKey, privateKey);

  const user = await prisma.user.findUnique({
    where: { email: "gjdbwjd805@gmail.com" },
    include: { pushSubscriptions: true },
  });

  if (!user) {
    console.error("❌ 사용자를 찾을 수 없습니다");
    process.exit(1);
  }

  console.log(`📱 사용자: ${user.name} (${user.email})`);
  console.log(`📝 푸시 구독: ${user.pushSubscriptions.length}개`);

  if (user.pushSubscriptions.length === 0) {
    console.error("❌ 푸시 구독이 없습니다. 앱에서 알림을 허용해야 합니다.");
    process.exit(1);
  }

  const payload = {
    title: "⚽ 정기운동 참석 투표",
    body: "이번주 일요일 정기운동에 참석하시나요? 지금 투표해주세요!",
    url: "/my/training-events",
  };

  console.log("\n📤 푸시 알림 전송 중...");

  const results = await Promise.allSettled(
    user.pushSubscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        console.log(`✅ 전송 성공: ${sub.id}`);
      } catch (err: any) {
        console.error(`❌ 전송 실패 (${sub.id}):`, err.message);
        if (err.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
          console.log(`🗑️ 만료된 구독 삭제: ${sub.id}`);
        }
        throw err;
      }
    })
  );

  const ok = results.filter((r) => r.status === "fulfilled").length;
  const fail = results.filter((r) => r.status === "rejected").length;
  console.log(`\n✨ 완료! 성공: ${ok}, 실패: ${fail}`);

  await prisma.$disconnect();
}

main();
