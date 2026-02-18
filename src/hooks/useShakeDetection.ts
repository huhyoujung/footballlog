// 핸드폰 흔들기 감지 훅 (DeviceMotionEvent)
import { useEffect, useRef, useState } from 'react';

interface ShakeDetectionOptions {
  threshold?: number; // 흔들기 강도 임계값 (기본: 15)
  timeout?: number; // 연속 흔들기 방지 timeout (기본: 1000ms)
  enabled?: boolean; // false면 리스너 해제 (기본: true)
  onShake: () => void; // 흔들기 감지 시 콜백
}

/**
 * 핸드폰 흔들기를 감지하는 커스텀 훅
 * DeviceMotionEvent를 사용하여 가속도 변화를 감지
 */
export function useShakeDetection({
  threshold = 15,
  timeout = 1000,
  enabled = true,
  onShake,
}: ShakeDetectionOptions) {
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const lastShakeTime = useRef(0);

  useEffect(() => {
    // DeviceMotionEvent 지원 여부 확인
    if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
      setIsSupported(true);
      // Android/구형 iOS: 권한 API 없으면 자동 허용 (새로고침 후에도 바로 동작)
      if (typeof (DeviceMotionEvent as any).requestPermission !== 'function') {
        setPermissionGranted(true);
      }
    }
  }, []);

  // 권한 요청 (iOS 13+)
  const requestPermission = async () => {
    if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
      try {
        const permission = await (DeviceMotionEvent as any).requestPermission();
        if (permission === 'granted') {
          setPermissionGranted(true);
          return true;
        }
        return false;
      } catch (error) {
        console.error('Motion permission error:', error);
        return false;
      }
    } else {
      // 권한이 필요없는 경우 (Android, 구형 iOS)
      setPermissionGranted(true);
      return true;
    }
  };

  useEffect(() => {
    if (!isSupported || !permissionGranted || !enabled) return;

    const handleMotion = (event: DeviceMotionEvent) => {
      const { accelerationIncludingGravity } = event;

      if (!accelerationIncludingGravity) return;

      const { x, y, z } = accelerationIncludingGravity;

      // 가속도 변화량 계산
      const acceleration = Math.sqrt(
        (x || 0) ** 2 + (y || 0) ** 2 + (z || 0) ** 2
      );

      // 임계값 초과 && timeout 이후 첫 흔들기인 경우
      const now = Date.now();
      if (acceleration > threshold && now - lastShakeTime.current > timeout) {
        lastShakeTime.current = now;
        onShake();
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isSupported, permissionGranted, enabled, threshold, timeout, onShake]);

  return {
    isSupported,
    permissionGranted,
    requestPermission,
  };
}
