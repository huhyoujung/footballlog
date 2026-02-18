// 피드 콘텐츠 영역 스켈레톤 (Feed.tsx의 main 안에서 렌더링)
// 실제 피드: 폴라로이드 스택 + 포스트잇 레이아웃에 맞춤
"use client";

function PolaroidStackSkeleton({ rotate1 = -8, rotate2 = 5, rotate3 = -3 }: { rotate1?: number; rotate2?: number; rotate3?: number }) {
  return (
    <div className="relative w-44 h-56">
      {/* 카드 3장 스택 */}
      {[
        { top: 18, left: -8, rotation: rotate1, zIndex: 1 },
        { top: 8, left: 10, rotation: rotate2, zIndex: 2 },
        { top: 2, left: 0, rotation: rotate3, zIndex: 3 },
      ].map((config, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: config.top,
            left: "50%",
            marginLeft: -72 + config.left,
            transform: `rotate(${config.rotation}deg)`,
            zIndex: config.zIndex,
          }}
        >
          {/* 폴라로이드 카드 */}
          <div className="w-36 bg-white rounded-sm p-1.5 pb-6 shadow-md">
            <div className="animate-pulse bg-team-50 rounded-sm w-full aspect-[4/3]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function FeedSkeleton() {
  return (
    <div className="flex flex-col items-center gap-12 px-4 py-8 max-w-2xl mx-auto">
      {/* 날짜 그룹 1 */}
      <div className="flex flex-col items-center">
        <PolaroidStackSkeleton rotate1={-10} rotate2={6} rotate3={-2} />
        <div className="-mt-1 text-center">
          <div className="animate-pulse h-4 bg-gray-200 rounded w-10 mx-auto" />
          <div className="animate-pulse h-3 bg-gray-100 rounded w-16 mx-auto mt-1" />
        </div>
      </div>

      {/* 날짜 그룹 2 */}
      <div className="flex flex-col items-center">
        <PolaroidStackSkeleton rotate1={-6} rotate2={8} rotate3={-4} />
        <div className="-mt-1 text-center">
          <div className="animate-pulse h-4 bg-gray-200 rounded w-8 mx-auto" />
          <div className="animate-pulse h-3 bg-gray-100 rounded w-16 mx-auto mt-1" />
        </div>
      </div>
    </div>
  );
}
