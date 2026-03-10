// 인앱 브라우저에서 접근 시 외부 브라우저/앱 열기 안내 페이지
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type DeviceType = "ios" | "android" | "pc";

function OpenAppContent() {
  const searchParams = useSearchParams();
  const targetUrl = searchParams.get("url") || "/";
  const [device, setDevice] = useState<DeviceType>("pc");

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/iPhone|iPad|iPod/i.test(ua)) setDevice("ios");
    else if (/Android/i.test(ua)) setDevice("android");
    else setDevice("pc");
  }, []);

  const handleOpenBrowser = () => {
    const ua = navigator.userAgent || "";

    // 카카오톡: 외부 브라우저 열기 스킴
    if (/KAKAOTALK/i.test(ua)) {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(targetUrl)}`;
      return;
    }

    // Android: 기본 브라우저 intent
    if (/Android/i.test(ua)) {
      const intentUrl = `intent://${targetUrl.replace(/^https?:\/\//, "")}#Intent;scheme=https;end`;
      window.location.href = intentUrl;
      return;
    }

    // 기타
    window.open(targetUrl, "_system");
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-6 py-16 relative overflow-hidden">
      {/* 라커룸 배경 이미지 */}
      <div
        className="absolute inset-0 bg-cover bg-center blur-[3px]"
        style={{
          backgroundImage: `url('/locker-room.jpg')`,
          transform: "scale(1.1)",
        }}
      />
      <div className="absolute inset-0 bg-black/70" />

      {/* 상단 여백 */}
      <div />

      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-10">
          <div className="mb-5 flex justify-center">
            <img
              src="/locker-logo.svg"
              alt="라커룸 로고"
              className="w-24 h-24"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-3">라커룸</h1>
          <p className="text-base text-white/80">
            필드 밖에서도 이어지는 우리의 이야기
          </p>
        </div>

        <button
          onClick={handleOpenBrowser}
          className="w-full flex items-center justify-center gap-2 bg-white rounded-xl py-4 px-4 text-gray-800 font-bold text-base hover:bg-gray-50 transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          라커룸 앱에서 열기
        </button>

        {device !== "pc" && (
          <div className="mt-6 bg-white/10 backdrop-blur-sm rounded-xl p-4">
            <p className="text-sm text-white/80 font-medium mb-2 text-center">
              앱을 아직 설치하지 않으셨나요?
            </p>
            <p className="text-xs text-white/60 text-center">
              {device === "ios"
                ? "Safari 하단 공유 버튼(□↑)을 누르고 \"홈 화면에 추가\"를 선택하세요"
                : "Chrome 메뉴(⋮)를 누르고 \"홈 화면에 추가\"를 선택하세요"}
            </p>
            <button
              onClick={handleOpenBrowser}
              className="mt-3 w-full text-xs text-white/70 underline underline-offset-2 text-center"
            >
              브라우저에서 열기
            </button>
          </div>
        )}
      </div>

      {/* 하단 여백 */}
      <div />
    </div>
  );
}

export default function OpenAppPage() {
  return (
    <Suspense>
      <OpenAppContent />
    </Suspense>
  );
}
