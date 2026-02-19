// 마이페이지 스켈레톤 (loading.tsx와 동일 구조 — 이중 전환 방지)
"use client";
import PageHeader from "@/components/PageHeader";

export default function MyPageSkeleton() {
  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PageHeader title="OURPAGE" left={<div className="w-5 h-5 bg-gray-100 rounded animate-pulse" />} sticky={false} />

      <main className="flex-1 max-w-2xl mx-auto px-4 py-4 w-full space-y-4">
        {/* 2열 카드 메뉴 - 실제와 동일 구조 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-team-50 rounded-2xl p-5 h-[140px] flex flex-col justify-between">
            <div className="animate-pulse w-7 h-7 bg-team-200 rounded" />
            <div className="space-y-1">
              <div className="animate-pulse h-[17px] bg-team-200 rounded w-16" />
              <div className="animate-pulse h-3 bg-team-100 rounded w-28" />
            </div>
          </div>
          <div className="bg-team-50 rounded-2xl p-5 h-[140px] flex flex-col justify-between">
            <div className="animate-pulse w-7 h-7 bg-team-200 rounded" />
            <div className="space-y-1">
              <div className="animate-pulse h-[17px] bg-team-200 rounded w-14" />
              <div className="animate-pulse h-3 bg-team-100 rounded w-28" />
            </div>
          </div>
        </div>

        {/* 팀원 목록 - 실제와 동일 리스트 레이아웃 */}
        <div className="bg-white rounded-xl py-6">
          <div className="px-4 mb-3">
            <div className="animate-pulse h-3.5 bg-gray-200 rounded w-24" />
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
        <div className="bg-team-50 border border-team-200 rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="animate-pulse h-3.5 bg-team-200 rounded w-28" />
              <div className="animate-pulse h-3 bg-team-100 rounded w-56" />
            </div>
            <div className="animate-pulse h-5 w-3 bg-team-200 rounded" />
          </div>
        </div>
      </main>

      {/* 푸터 */}
      <footer className="py-6 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-center gap-3">
          <div className="animate-pulse h-3 bg-gray-100 rounded w-12" />
          <span className="text-xs text-gray-300">|</span>
          <div className="animate-pulse h-3 bg-gray-100 rounded w-10" />
          <span className="text-xs text-gray-300">|</span>
          <div className="animate-pulse h-3 bg-gray-100 rounded w-12" />
        </div>
      </footer>
    </div>
  );
}
