// 팀 운동 목록 스켈레톤 — 서버 데이터 로딩 중 즉각 표시
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";

function EventCardSkeleton({ highlighted = false }: { highlighted?: boolean }) {
  return (
    <div
      className={`rounded-xl p-4 ${highlighted ? "bg-team-50 border border-team-200" : ""}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="animate-pulse h-5 bg-gray-200 rounded w-40" />
          {highlighted && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="animate-pulse h-4 bg-team-100 rounded-full w-10" />
            </div>
          )}
        </div>
        <div className="animate-pulse w-4 h-4 bg-gray-100 rounded mt-1 flex-shrink-0" />
      </div>
      <div className="flex items-center gap-2 mb-1">
        <div className="animate-pulse h-4 bg-gray-100 rounded w-48" />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="animate-pulse h-4 bg-gray-100 rounded w-32" />
      </div>
      <div className="animate-pulse h-3 bg-gray-100 rounded w-16" />
    </div>
  );
}

export default function TrainingEventsLoading() {
  return (
    <div className="min-h-screen bg-white">
      <PageHeader title="팀 운동" left={<BackButton />} />
      <main className="max-w-2xl mx-auto p-4">
        <div className="space-y-3">
          <div className="animate-pulse h-4 bg-team-100 rounded w-16" />
          <EventCardSkeleton highlighted />
          <EventCardSkeleton />

          <div className="animate-pulse h-4 bg-gray-100 rounded w-16 pt-4 mt-4" />
          <EventCardSkeleton />
          <EventCardSkeleton />
          <EventCardSkeleton />
        </div>
      </main>
    </div>
  );
}
