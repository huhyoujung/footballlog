export default function FeedSkeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="flex flex-col items-center gap-10">
        {/* 스켈레톤 카드 1 */}
        <div className="w-full max-w-xs">
          <div className="h-6 w-20 bg-gray-200 rounded mb-2 animate-pulse" />
          <div className="relative">
            <div className="w-28 h-36 bg-white border-4 border-white border-b-8 rounded-sm shadow-lg animate-pulse">
              <div className="w-full h-full bg-gray-200" />
            </div>
          </div>
        </div>

        {/* 스켈레톤 카드 2 */}
        <div className="w-full max-w-xs">
          <div className="h-6 w-24 bg-gray-200 rounded mb-2 animate-pulse" />
          <div className="relative">
            <div className="w-28 h-36 bg-white border-4 border-white border-b-8 rounded-sm shadow-lg animate-pulse">
              <div className="w-full h-full bg-gray-200" />
            </div>
          </div>
        </div>

        {/* 스켈레톤 카드 3 */}
        <div className="w-full max-w-xs">
          <div className="h-6 w-28 bg-gray-200 rounded mb-2 animate-pulse" />
          <div className="relative">
            <div className="w-28 h-36 bg-white border-4 border-white border-b-8 rounded-sm shadow-lg animate-pulse">
              <div className="w-full h-full bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
