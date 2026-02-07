"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function LoadingSpinner() {
  const [frameIndex, setFrameIndex] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev % 9) + 1);
    }, 100); // 100ms마다 프레임 전환

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
      <div className="relative w-32 h-32 mb-4 opacity-25">
        <Image
          src={`/loading/#${frameIndex}.png`}
          alt="로딩 중"
          fill
          className="object-contain"
          priority
        />
      </div>
      <p className="text-gray-400 text-sm">로딩 중...</p>
    </div>
  );
}
