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
    // 기본 브라우저 지원 확인
    const browserSupported = typeof window !== 'undefined' &&
                            'serviceWorker' in navigator &&
                            'PushManager' in window;

    // iOS PWA 모드 체크 (iOS는 PWA에서만 작동)
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;

    // iOS는 PWA 모드에서만, 다른 환경은 브라우저 지원만 확인
    const supported = browserSupported && (!isIOS || isPWA);

    setIsSupported(supported);

    if (!supported && isIOS && !isPWA) {
      console.warn('[Push] iOS에서는 PWA(홈 화면에 추가)로 설치해야 푸시 알림을 사용할 수 있습니다.');
    }
  }, []);

  const checkSubscription = useCallback(async () => {
    if (!isSupported) return;

    try {
      // Service worker가 준비될 때까지 최대 15초 대기
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Service worker timeout')), 15000)
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

      // VAPID 키 사전 확인
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidPublicKey) {
        console.error('VAPID public key not configured');
        return { success: false, error: 'VAPID_KEY_MISSING' };
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        console.log('Notification permission:', permission);
        return { success: false, error: 'PERMISSION_DENIED' };
      }

      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Service worker timeout')), 15000)
        )
      ]) as ServiceWorkerRegistration;

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
