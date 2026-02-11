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
import { withEulReul } from "@/lib/korean";
import { fetcher } from "@/lib/fetcher";
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

export default function MyPage() {
  const { data: session, update } = useSession();
  const { teamData, loading: teamLoading } = useTeam();
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());
  const [selectedMember, setSelectedMember] = useState<{
    id: string;
    name: string | null;
    position?: string | null;
    number?: number | null;
  } | null>(null);
  const { toast, showToast, hideToast } = useToast();

  const isAdmin = session?.user?.role === "ADMIN";

  // SWR로 profile 데이터 페칭 (자동 캐싱)
  const { data: profileData, isLoading: profileLoading } = useSWR<ProfileData>(
    session?.user?.teamId ? "/api/profile" : null,
    fetcher,
    {
      fallbackData: { image: session?.user?.image || null },
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 300000, // 5분 캐시
    }
  );

  const userImage = profileData?.image || session?.user?.image || null;

  const handleNudge = async (recipientId: string) => {
    const recipientName = selectedMember?.name || "팀원";

    // 모달 닫기
    setSelectedMember(null);

    // Optimistic UI: 즉시 완료 상태로 변경
    setNudgedToday((prev) => new Set(prev).add(recipientId));

    // 즉시 토스트 표시 (UX 개선)
    showToast(`${withEulReul(recipientName)} 닦달했습니다! 👉`);

    // 백그라운드에서 API 호출 (await 없음)
    fetch("/api/nudges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId }),
    })
      .then(async (res) => {
        if (!res.ok) {
          // 실패 시 롤백
          setNudgedToday((prev) => {
            const next = new Set(prev);
            next.delete(recipientId);
            return next;
          });
          const data = await res.json();
          showToast(data.error || "닦달에 실패했습니다");
        }
      })
      .catch(() => {
        // 실패 시 롤백
        setNudgedToday((prev) => {
          const next = new Set(prev);
          next.delete(recipientId);
          return next;
        });
        showToast("닦달에 실패했습니다");
      });
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  const isLoading = profileLoading || teamLoading;

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="text-base font-semibold text-gray-900">OURPAGE</h1>
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 p-2 -mr-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-2xl mx-auto px-4 py-4 w-full space-y-4">
        {teamData && (
          <>
            {/* 메뉴 */}
            <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
              <Link
                href="/my/training-events"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="text-gray-900">팀 운동</span>
                <span className="text-gray-300">&rsaquo;</span>
              </Link>
              <Link
                href="/my/logs"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="text-gray-900">내 운동 일지</span>
                <span className="text-gray-300">&rsaquo;</span>
              </Link>
              {isAdmin && (
                <Link
                  href="/my/team-admin"
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <span className="text-gray-900">팀 관리</span>
                  <span className="text-gray-300">&rsaquo;</span>
                </Link>
              )}
              <Link
                href="/my/settings"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="text-gray-900">내 프로필 수정</span>
                <span className="text-gray-300">&rsaquo;</span>
              </Link>
            </div>

            {/* 팀원 목록 */}
            <div className="bg-white rounded-xl py-6">
              <p className="text-xs text-gray-400 mb-3 px-4">
                우리 팀원 {teamData.members.length}명
              </p>
              <div className="space-y-2 px-4">
                {teamData.members.map((member) => (
                  <button
                    type="button"
                    key={member.id}
                    onClick={() => {
                      if (member.id !== session?.user?.id) {
                        setSelectedMember({
                          id: member.id,
                          name: member.name,
                        });
                      }
                    }}
                    disabled={member.id === session?.user?.id}
                    className={`flex items-center gap-3 py-1.5 w-full text-left ${
                      member.id !== session?.user?.id
                        ? "cursor-pointer hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                        : "-mx-2 px-2"
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
                        {/* 운영진 */}
                        {member.role === "ADMIN" && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-team-300 flex-shrink-0">
                            <path d="M12 6L16 12L21 8L19 18H5L3 8L8 12L12 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </main>

      {/* 문의하기 및 버전 */}
      <footer className="py-6 px-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <p className="text-[10px] text-gray-300">v0.1.0</p>
          <a
            href="https://open.kakao.com/o/sqBLurfi"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            문의하기
          </a>
        </div>
      </footer>

      {/* 팀원 액션 모달 */}
      {selectedMember && (
        <div
          className="fixed inset-0 bg-black/10 backdrop-blur-lg z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedMember(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="px-6 pt-5 pb-4 text-center">
              <h3 className="text-lg font-bold text-gray-900">
                {selectedMember.name}
              </h3>
              {selectedMember.position && (
                <p className="text-sm text-gray-500 mt-1">
                  {selectedMember.position} {selectedMember.number !== null && `· #${selectedMember.number}`}
                </p>
              )}
            </div>

            {/* 액션 버튼들 */}
            <div className="p-4 space-y-2">
              {/* 닦달하기 버튼 */}
              <button
                onClick={() => handleNudge(selectedMember.id)}
                disabled={nudgedToday.has(selectedMember.id)}
                className={`w-full py-3.5 px-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                  nudgedToday.has(selectedMember.id)
                    ? "bg-gray-50 text-gray-400 cursor-not-allowed"
                    : "bg-team-500 text-white hover:bg-team-600 active:scale-[0.98]"
                }`}
              >
                {nudgedToday.has(selectedMember.id) ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    오늘 닦달 완료
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 8h-8.5a1.5 1.5 0 0 0 0 3h7.5"/>
                      <path d="M11 11v-1a1 1 0 0 1 1 -1h1a1 1 0 0 1 1 1v1"/>
                      <path d="M13 12v-1a1 1 0 0 1 1 -1h1a1 1 0 0 1 1 1v1"/>
                      <path d="M15 13v-1a1 1 0 0 1 1 -1h1a1 1 0 0 1 1 1v1"/>
                      <path d="M14 16h3a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-12a1 1 0 0 1 -1 -1v-6a1 1 0 0 1 1 -1h1"/>
                      <path d="M11 11v-4a1 1 0 0 1 1 -1h2"/>
                    </svg>
                    닦달하기
                  </>
                )}
              </button>

              {/* 칭찬하기 버튼 (곧 지원) */}
              <button
                disabled
                className="w-full py-3.5 px-4 rounded-xl font-medium bg-gray-50 text-gray-400 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M7 10v12" />
                  <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
                </svg>
                칭찬하기 (곧 지원)
              </button>
            </div>

            {/* 취소 버튼 */}
            <button
              onClick={() => setSelectedMember(null)}
              className="w-full py-4 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-100"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 토스트 */}
      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </div>
  );
}
