// 운동 일지 상세 페이지 라우트 전환 시 즉시 표시되는 스켈레톤 UI
import PageHeader from "@/components/PageHeader";
// 실제: 헤더, 이미지(4:3), 작성자 정보, 컨디션+본문 섹션, 좋아요/댓글 바, 하단 입력
export default function LogDetailLoading() {
  return (
    <div className="min-h-screen bg-white pb-28">
      <PageHeader title="운동 일지" left={<div className="w-5 h-5 bg-gray-100 rounded animate-pulse" />} sticky={false} />

      <div className="max-w-2xl mx-auto">
        {/* 이미지 영역 (4:3) */}
        <div className="bg-gray-50 w-full aspect-[4/3] animate-pulse" />

        {/* 작성자 정보 */}
        <div className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className="h-3.5 w-16 bg-gray-200 rounded animate-pulse" />
                <div className="h-3 w-10 bg-gray-100 rounded animate-pulse" />
              </div>
              <div className="h-3.5 w-36 bg-gray-100 rounded animate-pulse" />
            </div>
          </div>
          {/* 제목 */}
          <div className="h-5 w-32 bg-gray-200 rounded animate-pulse mt-3" />
        </div>

        {/* 본문 - 컨디션 + 섹션들 */}
        <div className="px-4 pt-2 space-y-5">
          {/* 컨디션 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-team-50 rounded-full animate-pulse" />
            <div className="h-3.5 bg-gray-100 rounded w-2/3 animate-pulse" />
          </div>

          {/* 핵심 포인트 */}
          <div>
            <div className="h-3.5 w-24 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="space-y-2">
              <div className="h-3.5 w-full bg-gray-50 rounded animate-pulse" />
              <div className="h-3.5 w-5/6 bg-gray-50 rounded animate-pulse" />
              <div className="h-3.5 w-2/3 bg-gray-50 rounded animate-pulse" />
            </div>
          </div>

          {/* 개선점 */}
          <div>
            <div className="h-3.5 w-32 bg-gray-200 rounded animate-pulse mb-2" />
            <div className="space-y-2">
              <div className="h-3.5 w-full bg-gray-50 rounded animate-pulse" />
              <div className="h-3.5 w-3/4 bg-gray-50 rounded animate-pulse" />
            </div>
          </div>
        </div>

        {/* 좋아요/댓글 수 */}
        <div className="px-4 py-3 mt-4 flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-gray-100 rounded animate-pulse" />
            <div className="w-4 h-3 bg-gray-100 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 bg-gray-100 rounded animate-pulse" />
            <div className="w-4 h-3 bg-gray-100 rounded animate-pulse" />
          </div>
        </div>

        {/* 댓글 영역 */}
        <div className="mt-2">
          <div className="px-4 py-3">
            <div className="h-3.5 w-16 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="px-4 py-6 text-center">
            <div className="h-3.5 w-40 bg-gray-50 rounded animate-pulse mx-auto" />
          </div>
        </div>
      </div>

      {/* 하단 고정 댓글 입력 */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2 items-center">
          <div className="flex-1 h-[42px] bg-gray-50 border border-gray-200 rounded-lg animate-pulse" />
          <div className="h-9 w-14 bg-gray-100 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}
