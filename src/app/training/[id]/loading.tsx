import PageHeader from "@/components/PageHeader";

export default function TrainingDetailLoading() {
  return (
    <div className="min-h-screen bg-white pb-8">
      <PageHeader
        left={<div className="w-6 h-6 bg-gray-100 rounded animate-pulse" />}
        right={<div className="w-6 h-6 bg-gray-100 rounded animate-pulse" />}
        sticky={false}
      />
      <main className="max-w-2xl mx-auto p-4 space-y-3 animate-pulse">
        {/* 이벤트 기본 정보 카드 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-100 rounded" />
            <div className="h-4 bg-gray-200 rounded w-44" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-100 rounded" />
            <div className="h-4 bg-gray-200 rounded w-32" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-100 rounded" />
            <div className="h-4 bg-gray-200 rounded w-24" />
          </div>
        </div>

        {/* RSVP 버튼 영역 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="flex gap-2">
            <div className="flex-1 h-11 bg-team-50 rounded-xl" />
            <div className="flex-1 h-11 bg-gray-50 rounded-xl" />
            <div className="flex-1 h-11 bg-gray-50 rounded-xl" />
          </div>
        </div>

        {/* 탭 바 */}
        <div className="flex gap-2">
          <div className="flex-1 h-10 bg-team-50 rounded-xl" />
          <div className="flex-1 h-10 bg-gray-50 rounded-xl" />
          <div className="flex-1 h-10 bg-gray-50 rounded-xl" />
          <div className="flex-1 h-10 bg-gray-50 rounded-xl" />
        </div>

        {/* 참석 목록 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded-lg w-14" />
            ))}
          </div>
        </div>

        {/* 메모 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-2">
          <div className="h-4 bg-gray-200 rounded w-14" />
          <div className="h-3 bg-gray-100 rounded w-full" />
          <div className="h-3 bg-gray-100 rounded w-2/3" />
        </div>
      </main>
    </div>
  );
}
