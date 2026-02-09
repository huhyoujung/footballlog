import { PrismaClient } from "@prisma/client";
import webPush from "web-push";

const prisma = new PrismaClient();

async function sendTestPush() {
  try {
    // VAPID 키 설정
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;

    if (!publicKey || !privateKey) {
      console.error("❌ VAPID keys not configured");
      process.exit(1);
    }

    webPush.setVapidDetails(
      "mailto:noreply@football-log.app",
      publicKey,
      privateKey
    );

    // 사용자 찾기
    const user = await prisma.user.findUnique({
      where: { email: "gjdbwjd805@gmail.com" },
      include: { pushSubscriptions: true },
    });

    if (!user) {
      console.error("❌ User not found");
      process.exit(1);
    }

    console.log(`📱 Found user: ${user.name} (${user.email})`);
    console.log(`📝 Push subscriptions: ${user.pushSubscriptions.length}`);

    if (user.pushSubscriptions.length === 0) {
      console.error("❌ No push subscriptions found for this user");
      console.log("💡 User needs to enable push notifications first");
      process.exit(1);
    }

    // 테스트 푸시 전송
    const payload = {
      title: "🔔 테스트 알림",
      body: "푸시 알림이 정상적으로 작동합니다!",
      url: "/feed",
    };

    console.log("\n📤 Sending test push notification...");

    const results = await Promise.allSettled(
      user.pushSubscriptions.map(async (sub) => {
        try {
          await webPush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify(payload)
          );
          console.log(`✅ Sent to subscription: ${sub.id}`);
        } catch (err: any) {
          console.error(`❌ Failed to send to ${sub.id}:`, err.message);
          // 만료된 구독 삭제
          if (err.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
            console.log(`🗑️  Deleted expired subscription: ${sub.id}`);
          }
          throw err;
        }
      })
    );

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.log(`\n✨ Done! Success: ${successful}, Failed: ${failed}`);
  } catch (error) {
    console.error("❌ Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

sendTestPush();
