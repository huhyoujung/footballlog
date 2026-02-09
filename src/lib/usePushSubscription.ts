"use client";

import { useEffect, useState } from "react";

// base64 URL-safe 문자열을 Uint8Array로 변환
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported("serviceWorker" in navigator && "PushManager" in window);
  }, []);

  useEffect(() => {
    if (!isSupported) return;
    checkSubscription();
  }, [isSupported]);

  async function checkSubscription() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    setIsSubscribed(!!sub);
  }

  async function subscribe() {
    if (!isSupported) return false;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const reg = await navigator.serviceWorker.ready;

    // VAPID 공개 키를 base64 URL-safe에서 Uint8Array로 변환
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublicKey) {
      console.error('VAPID public key not configured');
      return false;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });

    setIsSubscribed(true);
    return true;
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setIsSubscribed(false);
  }

  return { isSupported, isSubscribed, subscribe, unsubscribe };
}
