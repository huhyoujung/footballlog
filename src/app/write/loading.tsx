// 일지 작성 페이지 라우트 전환 시 즉시 표시되는 스켈레톤 UI
import PageHeader from "@/components/PageHeader";
// 실제: 헤더, 운동 분류 토글, 컨디션, 텍스트 입력 섹션들, 폴라로이드 이미지
export default function WritePageLoading() {
  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader title="운동 일지 작성" left={<div className="w-5 h-5 bg-gray-100 rounded animate-pulse" />} sticky={false} />

      <div className="max-w-2xl mx-auto divide-y divide-gray-100 animate-pulse">
        {/* 운동 분류 토글 */}
        <div className="px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-16 bg-gray-200 rounded" />
            <div className="inline-flex bg-gray-200 rounded-full p-0.5">
              <div className="px-3 py-1.5 bg-white rounded-full">
                <div className="h-3 w-6 bg-gray-200 rounded" />
              </div>
              <div className="px-3 py-1.5">
                <div className="h-3 w-4 bg-gray-300 rounded" />
              </div>
            </div>
          </div>
          {/* 제목 입력 */}
          <div className="mt-4 space-y-2">
            <div className="h-3.5 w-8 bg-gray-200 rounded" />
            <div className="h-[46px] w-full bg-gray-50 border border-gray-200 rounded-lg" />
          </div>
          {/* 날짜 입력 */}
          <div className="mt-4 space-y-2">
            <div className="h-3.5 w-16 bg-gray-200 rounded" />
            <div className="h-[46px] w-full bg-gray-50 border border-gray-200 rounded-lg" />
          </div>
        </div>

        {/* 컨디션 */}
        <div className="px-4 py-5">
          <div className="h-3.5 w-12 bg-gray-200 rounded" />
        </div>

        {/* 컨디션 이유 */}
        <div className="px-4 py-5 space-y-2">
          <div className="h-3.5 w-20 bg-gray-200 rounded" />
          <div className="h-[82px] w-full bg-gray-50 border border-gray-200 rounded-lg" />
        </div>

        {/* 기타 메모 */}
        <div className="px-4 py-5 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-3.5 w-16 bg-gray-200 rounded" />
            <div className="h-3 w-8 bg-gray-100 rounded" />
          </div>
          <div className="h-[82px] w-full bg-gray-50 border border-gray-200 rounded-lg" />
        </div>

        {/* 핵심 포인트 */}
        <div className="px-4 py-5 space-y-2">
          <div className="h-3.5 w-20 bg-gray-200 rounded" />
          <div className="h-[122px] w-full bg-gray-50 border border-gray-200 rounded-lg" />
        </div>

        {/* 더 잘하기 위해서는 */}
        <div className="px-4 py-5 space-y-2">
          <div className="h-3.5 w-32 bg-gray-200 rounded" />
          <div className="h-[102px] w-full bg-gray-50 border border-gray-200 rounded-lg" />
        </div>

        {/* 폴라로이드 이미지 업로드 */}
        <div className="px-4 pt-0 pb-5 flex flex-col items-center !border-t-0">
          <div
            className="w-32 bg-white rounded-sm p-2 pb-4"
            style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.12)' }}
          >
            <div className="w-full aspect-[3/4] bg-team-50 rounded-sm" />
          </div>
        </div>
      </div>
    </div>
  );
}
