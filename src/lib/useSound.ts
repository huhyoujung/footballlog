"use client";

import { useEffect, useState } from "react";
import { generateBeep } from "./generateBeep";

/**
 * 사운드 재생 훅
 * localStorage로 사용자 설정(on/off) 관리
 */
export function useSound() {
  const [soundEnabled, setSoundEnabled] = useState(true);

  useEffect(() => {
    // 클라이언트에서만 실행
    const enabled = localStorage.getItem("soundEnabled");
    setSoundEnabled(enabled !== "false");
  }, []);

  const playSound = (soundName: string, volume = 0.5) => {
    if (!soundEnabled) return;

    try {
      const audio = new Audio(`/sounds/${soundName}.mp3`);
      audio.volume = volume;
      audio.play().catch((err) => {
        // 파일이 없으면 임시 beep 소리로 대체
        console.log("Sound file not found, using beep fallback");
        generateBeep();
      });
    } catch (error) {
      console.log("Sound error:", error);
      generateBeep();
    }
  };

  const toggleSound = () => {
    const newValue = !soundEnabled;
    setSoundEnabled(newValue);
    localStorage.setItem("soundEnabled", String(newValue));
  };

  return { playSound, soundEnabled, toggleSound };
}
