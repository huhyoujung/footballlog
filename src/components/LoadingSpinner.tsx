"use client";

export default function LoadingSpinner() {
  return (
    <div className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center">
      <svg
        width={120}
        height={120}
        viewBox="0 0 32 32"
        fill="none"
        className="opacity-25 animate-spin"
        style={{ animationDuration: "1.8s", animationTimingFunction: "linear" }}
      >
        <circle cx="16" cy="16" r="15" className="fill-team-500" />
        <circle cx="16" cy="16" r="7" className="stroke-team-50" strokeWidth="1.5" />
        <path d="M16 9 L16 23 M9 16 L23 16" className="stroke-team-50" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="16" cy="16" r="2.5" className="fill-team-50" />
      </svg>
      <p className="text-gray-400 text-sm mt-4">로딩 중...</p>
    </div>
  );
}
