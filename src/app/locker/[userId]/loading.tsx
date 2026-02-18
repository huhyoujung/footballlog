// 개인 락커 페이지 라우트 전환 시 즉시 표시되는 스켈레톤 UI
// 실제: bg-white, 뒤로가기(fixed), 이름표(금속 프레임), 액션 버튼 2개, 폴라로이드 타임라인
export default function LockerLoading() {
  return (
    <div className="min-h-screen bg-white">
      {/* 뒤로가기 버튼 (fixed) */}
      <div className="fixed top-4 left-4 z-30">
        <div className="w-9 h-9 bg-gray-100 rounded-full animate-pulse" />
      </div>

      {/* 이름표 영역 */}
      <div className="pt-16 pb-2 flex flex-col items-center">
        {/* 금속 프레임 이름표 */}
        <div
          className="relative p-2 rounded"
          style={{
            background: "linear-gradient(135deg, #9CA3AF 0%, #6B7280 50%, #9CA3AF 100%)",
          }}
        >
          <div className="bg-white px-6 py-3">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-pulse h-3 w-8 bg-gray-200 rounded" />
              <div className="animate-pulse h-4 w-14 bg-gray-200 rounded" />
            </div>
          </div>
        </div>

        {/* 액션 버튼 2개 */}
        <div className="flex gap-2.5 mt-4 w-64">
          <div className="flex-1 py-2.5 bg-team-50 rounded-xl animate-pulse h-[38px]" />
          <div className="flex-1 py-2.5 bg-team-50 rounded-xl animate-pulse h-[38px]" />
        </div>
      </div>

      {/* 폴라로이드 타임라인 스켈레톤 */}
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center gap-12 py-6 px-4 animate-pulse">
          {/* 날짜 그룹 1 */}
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-56">
              {[
                { top: 18, left: -8, rotation: -10 },
                { top: 8, left: 10, rotation: 6 },
                { top: 2, left: 0, rotation: -2 },
              ].map((config, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    top: config.top,
                    left: "50%",
                    marginLeft: -72 + config.left,
                    transform: `rotate(${config.rotation}deg)`,
                    zIndex: i + 1,
                  }}
                >
                  <div className="w-36 bg-white rounded-sm p-1.5 pb-6 shadow-md">
                    <div className="bg-team-50 rounded-sm w-full aspect-[4/3]" />
                  </div>
                </div>
              ))}
            </div>
            <div className="-mt-1 text-center">
              <div className="h-4 bg-gray-200 rounded w-10 mx-auto" />
            </div>
          </div>

          {/* 날짜 그룹 2 */}
          <div className="flex flex-col items-center">
            <div className="relative w-44 h-56">
              {[
                { top: 14, left: -6, rotation: -6 },
                { top: 6, left: 12, rotation: 8 },
                { top: 0, left: 2, rotation: -4 },
              ].map((config, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    top: config.top,
                    left: "50%",
                    marginLeft: -72 + config.left,
                    transform: `rotate(${config.rotation}deg)`,
                    zIndex: i + 1,
                  }}
                >
                  <div className="w-36 bg-white rounded-sm p-1.5 pb-6 shadow-md">
                    <div className="bg-team-50 rounded-sm w-full aspect-[4/3]" />
                  </div>
                </div>
              ))}
            </div>
            <div className="-mt-1 text-center">
              <div className="h-4 bg-gray-200 rounded w-8 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
