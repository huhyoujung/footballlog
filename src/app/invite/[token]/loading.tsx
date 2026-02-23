export default function ChallengeLoading() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-sm w-full space-y-4">
        {/* 도전장 카드 스켈레톤 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
          {/* 헤더 */}
          <div className="px-6 py-5 bg-gray-100 flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-gray-200 mb-3" />
            <div className="h-3 w-16 bg-gray-200 rounded mb-2" />
            <div className="h-5 w-24 bg-gray-200 rounded" />
          </div>

          {/* 경기 정보 */}
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-4 w-32 bg-gray-200 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-4 w-40 bg-gray-200 rounded" />
            </div>
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 bg-gray-200 rounded" />
              <div className="h-4 w-24 bg-gray-200 rounded" />
            </div>
          </div>
        </div>

        {/* 버튼 스켈레톤 */}
        <div className="h-12 bg-gray-200 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}
