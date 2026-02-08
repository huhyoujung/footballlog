"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";

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
  }[];
}

export default function MyPage() {
  const { data: session } = useSession();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [nudging, setNudging] = useState<string | null>(null);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());

  const isAdmin = session?.user?.role === "ADMIN";

  useEffect(() => {
    if (session?.user?.teamId) {
      fetchTeam();
    } else {
      setLoading(false);
    }
  }, [session]);

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
    setNudging(recipientId);
    try {
      const res = await fetch("/api/nudges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId }),
      });

      if (res.ok) {
        setNudgedToday((prev) => new Set(prev).add(recipientId));
      } else {
        const data = await res.json();
        alert(data.error || "닦달에 실패했습니다");
      }
    } catch {
      alert("닦달에 실패했습니다");
    } finally {
      setNudging(null);
    }
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">MY</h1>
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* 프로필 카드 */}
        <div className="bg-white rounded-xl p-6">
          <div className="flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-team-50 overflow-hidden flex items-center justify-center">
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt={session.user.name || ""}
                  width={56}
                  height={56}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#A08B7A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <div className="text-center">
              <h2 className="text-lg font-semibold text-gray-900">
                {session?.user?.name || "사용자"}
              </h2>
              <p className="text-sm text-gray-500">{session?.user?.email}</p>
              {team && (
                <p className="text-xs text-gray-400 mt-1">{team.name}</p>
              )}
            </div>
          </div>
        </div>

        {/* 팀원 목록 + 초대 코드 */}
        {team && (
          <div className="bg-white rounded-xl p-6">
            <p className="text-xs text-gray-400 mb-3">
              팀원 {team.members.length}명
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
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <span className="text-sm text-gray-900">
                      {member.name || "익명"}
                    </span>
                    <span className="text-xs text-gray-400">
                      {member.position || ""} {member.number ? `#${member.number}` : ""}
                    </span>
                    {member.id === session?.user?.id && (
                      <span className="px-2 py-0.5 bg-team-50 text-team-700 text-[10px] font-medium rounded-full flex-shrink-0">
                        나
                      </span>
                    )}
                    {member.role === "ADMIN" && (
                      <span className="px-2 py-0.5 bg-team-50 text-team-500 text-[10px] font-medium rounded-full flex-shrink-0">
                        운영진
                      </span>
                    )}
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
        )}

        {/* 내 정보 */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-400 px-2">내 정보</p>
          <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
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
          </div>
        </div>

        {/* 팀 관리 (운영진만) */}
        {isAdmin && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-400 px-2">팀 관리</p>
            <div className="bg-white rounded-xl overflow-hidden divide-y divide-gray-100">
              <Link
                href="/my/team-settings"
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <span className="text-gray-900">팀 프로필 수정</span>
                <span className="text-gray-400">&rsaquo;</span>
              </Link>
            </div>
          </div>
        )}
      </main>

    </div>
  );
}
