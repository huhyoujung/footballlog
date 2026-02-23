import PageHeader from "@/components/PageHeader";

export default function LogDetailLoading() {
  return (
    <div className="min-h-screen bg-white pb-8">
      <PageHeader
        left={<div className="w-6 h-6 bg-gray-100 rounded animate-pulse" />}
        right={<div className="w-6 h-6 bg-gray-100 rounded animate-pulse" />}
        sticky={false}
      />
      <main className="max-w-2xl mx-auto p-4 space-y-4 animate-pulse">
        {/* 작성자 */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full" />
          <div className="space-y-1.5">
            <div className="h-4 bg-gray-200 rounded w-24" />
            <div className="h-3 bg-gray-100 rounded w-16" />
          </div>
        </div>

        {/* 사진 영역 */}
        <div className="w-full aspect-[3/4] max-h-80 bg-team-50 rounded-xl" />

        {/* 컨디션 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-gray-200 rounded-full" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-3/4" />
        </div>

        {/* 핵심 포인트 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-5/6" />
        </div>

        {/* 개선점 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
        </div>

        {/* 댓글 */}
        <div className="bg-white rounded-xl p-4 border border-gray-100 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-14" />
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-2">
              <div className="w-8 h-8 bg-gray-200 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-gray-200 rounded w-20" />
                <div className="h-3 bg-gray-100 rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
