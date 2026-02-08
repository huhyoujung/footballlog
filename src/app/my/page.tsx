"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";
import Toast from "@/components/Toast";
import { useToast } from "@/lib/useToast";
import { useTeam } from "@/contexts/TeamContext";
import useSWR from "swr";

interface Team {
  id: string;
  name: string;
  inviteCode: string;
  members: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
    position: string | null;
    number: number | null;
    attendanceRate: number;
  }[];
}

interface ProfileData {
  image: string | null;
}

// SWR fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function MyPage() {
  const { data: session, update } = useSession();
  const { teamData, loading: teamLoading } = useTeam();
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    name: string | null;
  } | null>(null);
  const { toast, showToast, hideToast } = useToast();

  const isAdmin = session?.user?.role === "ADMIN";

  // SWR로 profile 데이터 페칭 (자동 캐싱)
  const { data: profileData, isLoading: profileLoading } = useSWR<ProfileData>(
    session?.user?.teamId ? "/api/profile" : null,
    fetcher,
    {
      fallbackData: { image: session?.user?.image || null },
      revalidateOnFocus: false, // profile은 자주 바뀌지 않으므로
      dedupingInterval: 5000,
    }
  );

  const userImage = profileData?.image || session?.user?.image || null;

  const handleNudge = async (recipientId: string) => {
    const recipientName = selectedMember?.name || "팀원";

    // 모달 닫기
    setSelectedMember(null);

    // Optimistic UI: 즉시 완료 상태로 변경
    setNudgedToday((prev) => new Set(prev).add(recipientId));

    // 백그라운드에서 API 호출
    try {
      const res = await fetch("/api/nudges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });

      if (!res.ok) {
        // 실패 시 롤백
        setNudgedToday((prev) => {
          const next = new Set(prev);
          next.delete(recipientId);
          return next;
        });
        const data = await res.json();
        alert(data.error || "닦달에 실패했습니다");
      } else {
        // 성공 시 토스트 표시
        showToast(`${recipientName}님에게 닦달했습니다! 👉`);
      }
    } catch {
      // 실패 시 롤백
      setNudgedToday((prev) => {
        const next = new Set(prev);
        next.delete(recipientId);
        return next;
      });
      alert("닦달에 실패했습니다");
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  const isLoading = profileLoading || teamLoading;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="text-lg font-semibold text-gray-900">OURPAGE</h1>
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 p-3 -mr-3 min-w-[44px] min-h-[44px] inline-flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-4 w-full space-y-4">
        {teamData && (
          <>
            {/* 메뉴 */}
            <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
              <Link
                href="/my/training-events"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="text-gray-900">팀 운동</span>
                <span className="text-gray-400">&rsaquo;</span>
              </Link>
              <Link
                href="/my/settings"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="text-gray-900">내 프로필 수정</span>
                <span className="text-gray-400">&rsaquo;</span>
              </Link>
              <Link
                href="/my/logs"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="text-gray-900">내 운동 일지</span>
                <span className="text-gray-400">&rsaquo;</span>
              </Link>
              {isAdmin && (
                <Link
                  href="/my/team-admin"
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <span className="text-gray-900">팀 정보 수정</span>
                  <span className="text-gray-400">&rsaquo;</span>
                </Link>
              )}
            </div>

            {/* 팀원 목록 */}
            <div className="bg-white rounded-xl py-6">
              <p className="text-xs text-gray-400 mb-3 px-6">
                우리 팀원 {teamData.members.length}명
              </p>
              <div className="space-y-2 px-6">
                {teamData.members.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => {
                      if (member.id !== session?.user?.id) {
                        setSelectedMember({
                          id: member.id,
                          name: member.name,
                        });
                      }
                    }}
                    className={`flex items-center gap-3 py-1.5 ${
                      member.id !== session?.user?.id
                        ? "cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                        : ""
                    }`}
                  >
                    <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={member.name || ""}
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-team-50" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* 이름 */}
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-medium text-gray-900">
                          {member.name || "익명"}
                        </span>
                        {/* 운영진 왕관 */}
                        {member.role === "ADMIN" && (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-team-600 flex-shrink-0">
                            <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx="12" cy="6" r="1.5" fill="currentColor" />
                            <circle cx="9" cy="9" r="1" fill="currentColor" />
                            <circle cx="15" cy="9" r="1" fill="currentColor" />
                          </svg>
                        )}
                      </div>

                      {/* 포지션/등번호 */}
                      {(member.position || member.number) && (
                        <span className="text-xs text-gray-500">
                          {member.position || ""}{member.number ? ` ${member.number}` : ""}
                        </span>
                      )}

                      {/* 출석률 */}
                      <span className="text-xs text-gray-500">
                        {member.attendanceRate}%
                      </span>

                      {/* 뱃지 (나) */}
                      <div className="flex items-center gap-1 ml-auto">
                        {member.id === session?.user?.id && (
                          <span className="px-2 py-0.5 bg-team-50 text-team-700 text-[10px] font-medium rounded-full">
                            나
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* 문의하기 */}
      <footer className="text-center py-6">
        <a
          href="https://open.kakao.com/o/sqBLurfi"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          문의하기
        </a>
      </footer>

      {/* 팀원 액션 모달 */}
      {selectedMember && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-center"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="bg-white rounded-t-2xl w-full max-w-md p-6 space-y-3 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {selectedMember.name || "팀원"}님에게
              </h3>
            </div>

            {/* 닦달하기 버튼 */}
            <button
              onClick={() => handleNudge(selectedMember.id)}
              disabled={nudgedToday.has(selectedMember.id)}
              className={`w-full py-4 rounded-xl font-medium transition-colors ${
                nudgedToday.has(selectedMember.id)
                  ? "bg-gray-100 text-gray-400"
                  : "bg-team-500 text-white hover:bg-team-600"
              }`}
            >
              {nudgedToday.has(selectedMember.id) ? (
                <>✅ 오늘 닦달 완료</>
              ) : (
                <>👉 닦달하기</>
              )}
            </button>

            {/* 칭찬하기 버튼 (곧 지원) */}
            <button
              disabled
              className="w-full py-4 rounded-xl font-medium bg-gray-100 text-gray-400"
            >
              👏 칭찬하기 (곧 지원됨)
            </button>

            {/* 취소 버튼 */}
            <button
              onClick={() => setSelectedMember(null)}
              className="w-full py-3 text-gray-500 hover:text-gray-700 transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 토스트 */}
      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </div>
  );
}
