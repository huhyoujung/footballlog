"use client";

import { useState, useEffect } from "react";
import Image from "next/image";

export default function LoadingSpinner() {
  const [frameIndex, setFrameIndex] = useState(1);

  useEffect(() => {
    const interval = setInterval(() => {
      setFrameIndex((prev) => (prev % 9) + 1);
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // 스피너 표시 중 배경 스크롤 방지 (로딩 완료 시 layout shift 방지)
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
      <Image
        src={`/loading/${frameIndex}.png`}
        alt="로딩 중"
        width={120}
        height={120}
        priority
        unoptimized
        className="opacity-25"
      />
      <p className="text-gray-400 text-sm mt-4">로딩 중...</p>
    </div>
  );
}
