import webPush from "web-push";
import { prisma } from "./prisma";

let vapidConfigured = false;

function ensureVapid(): boolean {
  if (vapidConfigured) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("VAPID keys not configured — push notifications disabled");
    return false;
  }
  webPush.setVapidDetails("mailto:noreply@football-log.app", publicKey, privateKey);
  vapidConfigured = true;
  return true;
}

export async function sendPushToTeam(
  teamId: string,
  excludeUserId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!ensureVapid()) return [];
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
  if (!ensureVapid()) return [];
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
