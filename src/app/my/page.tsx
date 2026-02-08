"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";

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

export default function MyPage() {
  const { data: session, update } = useSession();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());
  const [userImage, setUserImage] = useState<string | null>(null);

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    if (session?.user?.teamId) {
      fetchTeam();
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [session]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        setUserImage(data.image);
      }
    } catch {
      // use session image as fallback
      setUserImage(session?.user?.image || null);
    }
  };

  const fetchTeam = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      }
    } catch (error) {
      console.error("팀 정보 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleNudge = async (recipientId: string) => {
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
      }
      // 성공 시 이미 UI가 업데이트되어 있으므로 추가 작업 불필요
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

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
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

      <main className="flex-1 max-w-2xl mx-auto p-4 space-y-4">
        {team && (
          <>
            {/* 팀원 목록 */}
            <div className="bg-white rounded-xl p-6">
              <p className="text-xs text-gray-400 mb-3">
                우리 팀원 {team.members.length}명
              </p>
              <div className="space-y-2">
                {team.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-1.5"
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
                          {member.position || ""}{member.number ? ` #${member.number}` : ""}
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
                    {member.id !== session?.user?.id && (
                      <button
                        onClick={() => handleNudge(member.id)}
                        disabled={
                          nudging === member.id || nudgedToday.has(member.id)
                        }
                        className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full flex-shrink-0 ${
                          nudgedToday.has(member.id)
                            ? "bg-gray-100 text-gray-400"
                            : "bg-team-50 text-team-600 hover:bg-team-100"
                        } disabled:opacity-50 transition-colors`}
                      >
                        {nudging === member.id ? (
                          "..."
                        ) : nudgedToday.has(member.id) ? (
                          "완료"
                        ) : (
                          <>
                            <span className="text-base">👉</span>
                            닦달
                          </>
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

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
                  href="/my/team-settings"
                  className="flex items-center justify-between p-4 hover:bg-gray-50"
                >
                  <span className="text-gray-900">팀 프로필 수정</span>
                  <span className="text-gray-400">&rsaquo;</span>
                </Link>
              )}
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
    </div>
  );
}
