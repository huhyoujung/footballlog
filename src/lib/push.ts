import webPush from "web-push";
import { prisma } from "./prisma";

let vapidConfigured = false;

function ensureVapid() {
  if (vapidConfigured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys not configured");
  }
  webPush.setVapidDetails("mailto:noreply@football-log.app", publicKey, privateKey);
  vapidConfigured = true;
}

export async function sendPushToTeam(
  teamId: string,
  excludeUserId: string,
  payload: { title: string; body: string; url?: string }
) {
  ensureVapid();
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: { teamId },
      userId: { not: excludeUserId },
    },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        // 만료된 구독은 삭제
        const wpErr = err as { statusCode?: number };
        if (wpErr.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
        throw err;
      }
    })
  );

  return results;
}

export async function sendPushToUsers(
  userIds: string[],
  payload: { title: string; body: string; url?: string }
) {
  ensureVapid();
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        const wpErr = err as { statusCode?: number };
        if (wpErr.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
        throw err;
      }
    })
  );

  return results;
}
