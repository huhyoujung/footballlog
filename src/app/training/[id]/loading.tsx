// 팀 운동 상세 페이지 라우트 전환 시 즉시 표시되는 스켈레톤 UI
import PageHeader from "@/components/PageHeader";
// 실제: bg-white, 헤더(뒤로+제목+아이콘), 기본 정보 카드, 참석 현황, RSVP, 일지/댓글 섹션
export default function TrainingDetailLoading() {
  return (
    <div className="min-h-screen bg-white pb-8">
      <PageHeader
        left={<div className="w-5 h-5 bg-gray-100 rounded animate-pulse" />}
        right={<div className="w-5 h-5 bg-gray-100 rounded animate-pulse" />}
        sticky={false}
      />

      <main className="max-w-2xl mx-auto p-4 space-y-3 animate-pulse">
        {/* 일정 정보 카드 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-4">
          {/* 날짜/시간 */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-100 rounded" />
            <div className="h-4 bg-gray-200 rounded w-40" />
          </div>
          {/* 장소 */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-100 rounded" />
            <div className="h-4 bg-gray-200 rounded w-28" />
          </div>
          {/* 유니폼 */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-100 rounded" />
            <div className="h-4 bg-gray-200 rounded w-20" />
          </div>
        </div>

        {/* 참석 현황 카드 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-100 rounded-lg w-16" />
            ))}
          </div>
        </div>

        {/* RSVP 버튼 영역 */}
        <div className="flex gap-2">
          <div className="flex-1 h-12 bg-team-50 rounded-xl" />
          <div className="flex-1 h-12 bg-gray-50 rounded-xl" />
          <div className="flex-1 h-12 bg-gray-50 rounded-xl" />
        </div>

        {/* 운동 일지 섹션 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-20" />
          <div className="space-y-2">
            <div className="h-3.5 bg-gray-100 rounded w-full" />
            <div className="h-3.5 bg-gray-100 rounded w-2/3" />
          </div>
        </div>

        {/* 댓글 섹션 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
          <div className="h-4 bg-gray-200 rounded w-16" />
          <div className="h-3.5 bg-gray-50 rounded w-40 mx-auto" />
        </div>
      </main>
    </div>
  );
}
