"use client";

import { useState, useEffect } from "react";

export default function LoadingSpinner() {
  const [frameIndex, setFrameIndex] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev % 9) + 1);
    }, 200); // 200ms마다 프레임 전환 (2배 느리게)

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
      <div className="w-32 h-32 mb-4 opacity-25 flex items-center justify-center">
        <img
          src={`/loading/${frameIndex}.png`}
          alt="로딩 중"
          className="w-full h-full object-contain"
        />
      </div>
      <p className="text-gray-400 text-sm">로딩 중...</p>
    </div>
  );
}
