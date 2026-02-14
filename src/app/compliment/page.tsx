"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import BackButton from "@/components/BackButton";
import TeamMemberList from "@/components/TeamMemberList";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useTeam } from "@/contexts/TeamContext";

export default function ComplimentPage() {
  const { data: session } = useSession();
  const { teamData, loading: teamLoading } = useTeam();
  const router = useRouter();

  if (teamLoading) {
    return <LoadingSpinner />;
  }

  if (!teamData) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">팀 정보를 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="text-base font-semibold text-gray-900">칭찬 쪽지 놓고오기</h1>
          <div className="w-6" /> {/* 우측 여백 */}
        </div>
      </header>

      {/* 설명 */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="bg-team-50 border border-team-200 rounded-xl p-4">
          <p className="text-sm text-team-700">
            💌 팀원의 락커에 칭찬 쪽지를 남겨보세요!
          </p>
          <p className="text-xs text-team-600 mt-1">
            익명으로 응원과 칭찬의 메시지를 전할 수 있습니다
          </p>
        </div>
      </div>

      {/* 팀원 목록 */}
      <main className="max-w-2xl mx-auto px-4 pb-4">
        <TeamMemberList
          members={teamData.members}
          currentUserId={session?.user?.id}
          onMemberClick={(member) => {
            router.push(`/locker/${member.id}?openNote=true`);
          }}
          showSelfBadge={false}
        />
      </main>
    </div>
  );
}
