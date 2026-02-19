// 핸드폰 흔들기 감지 훅 (DeviceMotionEvent)
import { useEffect, useRef, useState } from 'react';

interface ShakeDetectionOptions {
  threshold?: number; // 흔들기 강도 임계값 — 연속 프레임 간 변화량 (기본: 8)
  timeout?: number; // 연속 흔들기 방지 timeout (기본: 1000ms)
  enabled?: boolean; // false면 리스너 해제 (기본: true)
  onShake: () => void; // 흔들기 감지 시 콜백
}

/**
 * 핸드폰 흔들기를 감지하는 커스텀 훅
 * DeviceMotionEvent를 사용하여 가속도 변화를 감지
 */
export function useShakeDetection({
  threshold = 8,
  timeout = 1000,
  enabled = true,
  onShake,
}: ShakeDetectionOptions) {
  const [isSupported, setIsSupported] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [debugDelta, setDebugDelta] = useState(0);
  const lastShakeTime = useRef(0);
  const lastAccel = useRef<{ x: number; y: number; z: number } | null>(null);

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

  // 리스너는 permissionGranted와 무관하게 항상 등록
  // iOS Safari: 같은 세션 내에서 권한이 유지되므로, 페이지 새로고침 후에도 이벤트가 발생함
  // 권한 없으면 이벤트가 안 오거나 null 데이터 → handler가 무시 → 성능 영향 없음
  useEffect(() => {
    if (!isSupported || !enabled) return;

    lastAccel.current = null;

    const handleMotion = (event: DeviceMotionEvent) => {
      const accel = event.accelerationIncludingGravity;
      if (!accel || (accel.x == null && accel.y == null && accel.z == null)) return;

      const x = accel.x || 0;
      const y = accel.y || 0;
      const z = accel.z || 0;

      // 실제 모션 데이터가 오면 권한이 부여된 것 → 상태 동기화
      if (!permissionGranted) {
        setPermissionGranted(true);
      }

      // 첫 프레임은 기준값 저장만
      if (!lastAccel.current) {
        lastAccel.current = { x, y, z };
        return;
      }

      // 이전 프레임과의 변화량 (중력 상쇄됨)
      const dx = x - lastAccel.current.x;
      const dy = y - lastAccel.current.y;
      const dz = z - lastAccel.current.z;
      lastAccel.current = { x, y, z };

      const delta = Math.sqrt(dx * dx + dy * dy + dz * dz);
      setDebugDelta(Math.round(delta * 10) / 10);

      const now = Date.now();
      if (delta > threshold && now - lastShakeTime.current > timeout) {
        lastShakeTime.current = now;
        onShake();
      }
    };

    window.addEventListener('devicemotion', handleMotion);

    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isSupported, enabled, threshold, timeout, onShake, permissionGranted]);

  return {
    isSupported,
    permissionGranted,
    requestPermission,
    debugDelta, // 디버그용 — 테스트 후 제거
  };
}
