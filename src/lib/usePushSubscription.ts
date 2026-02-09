"use client";

import { useEffect, useState, useCallback } from "react";

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

type SubscribeResult =
  | { success: true }
  | { success: false; error: string; details?: any };

export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const supported = typeof window !== 'undefined' &&
                     'serviceWorker' in navigator &&
                     'PushManager' in window;
    setIsSupported(supported);
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!isSupported) return;

    try {
      // Service worker가 준비될 때까지 최대 5초 대기
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Service worker timeout')), 5000)
        )
      ]) as ServiceWorkerRegistration;

      const sub = await registration.pushManager.getSubscription();
      setIsSubscribed(!!sub);
      setIsReady(true);
    } catch (error) {
      console.error('[Push] Failed to check subscription:', error);
      setIsReady(true); // 에러가 나도 ready 상태로 만들어 UI 차단 방지
    }
  }, [isSupported]);

  useEffect(() => {
    if (isSupported) {
      checkSubscription();
    }
  }, [isSupported, checkSubscription]);

  async function subscribe(): Promise<SubscribeResult> {
    try {
      if (!isSupported) {
        console.error('Push notifications not supported');
        return { success: false, error: 'NOT_SUPPORTED' };
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log('Notification permission:', permission);
        return { success: false, error: 'PERMISSION_DENIED' };
      }

      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Service worker timeout')), 5000)
        )
      ]) as ServiceWorkerRegistration;

      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not configured');
        return { success: false, error: 'VAPID_KEY_MISSING' };
      }

      const applicationServerKey = urlBase64ToUint8Array(vapidPublicKey);

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey as BufferSource,
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Server subscription failed:', error);
        return { success: false, error: 'SERVER_ERROR', details: error };
      }

      setIsSubscribed(true);
      return { success: true };
    } catch (error: any) {
      console.error('Push subscription error:', error);
      return { success: false, error: error.message || 'UNKNOWN_ERROR' };
    }
  }

  async function unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('Unsubscribe error:', error);
      return false;
    }
  }

  return { isSupported, isSubscribed, isReady, subscribe, unsubscribe };
}
