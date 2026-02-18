// 마이페이지 스켈레톤 (전체 페이지 교체용, 실제 레이아웃과 동일 구조)
"use client";
import PageHeader from "@/components/PageHeader";

export default function MyPageSkeleton() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageHeader title="OURPAGE" sticky={false} />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-4 w-full space-y-4">
        {/* 카드 메뉴 - 실제 bg-team-50 색상 사용 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-team-50 rounded-2xl p-5 h-[140px] flex flex-col justify-between">
            <div className="animate-pulse w-7 h-7 bg-team-200 rounded" />
            <div className="space-y-1">
              <div className="animate-pulse h-4 bg-team-200 rounded w-16" />
              <div className="animate-pulse h-3 bg-team-100 rounded w-24" />
            </div>
          </div>
          <div className="bg-team-50 rounded-2xl p-5 h-[140px] flex flex-col justify-between">
            <div className="animate-pulse w-7 h-7 bg-team-200 rounded" />
            <div className="space-y-1">
              <div className="animate-pulse h-4 bg-team-200 rounded w-16" />
              <div className="animate-pulse h-3 bg-team-100 rounded w-24" />
            </div>
          </div>
        </div>

        {/* 팀원 목록 */}
        <div className="bg-white rounded-xl py-6">
          <div className="px-4 mb-3">
            <div className="animate-pulse h-4 bg-gray-200 rounded w-24" />
          </div>
          <div className="space-y-2 px-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <div className="animate-pulse w-6 h-6 bg-gray-200 rounded-full" />
                <div className="flex-1 flex items-center gap-2">
                  <div className="animate-pulse h-3.5 bg-gray-200 rounded w-14" />
                  <div className="animate-pulse h-3 bg-gray-100 rounded w-8" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 피드백 배너 */}
        <div className="bg-team-50 border border-team-200 rounded-xl p-4">
          <div className="space-y-1">
            <div className="animate-pulse h-3.5 bg-team-200 rounded w-28" />
            <div className="animate-pulse h-3 bg-team-100 rounded w-48" />
          </div>
        </div>
      </main>
    </div>
  );
}
