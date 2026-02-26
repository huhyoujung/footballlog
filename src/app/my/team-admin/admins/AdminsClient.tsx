// 운영진 관리 클라이언트 컴포넌트
"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  role: string;
  position: string | null;
  number: number | null;
}

interface TeamInfo {
  id: string;
  members: TeamMember[];
}

export default function AdminsClient() {
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchTeam();
  }, []);

  const fetchTeam = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
      } else {
        const errorData = await res.json();
        setError(errorData.error || "팀 정보를 불러오는데 실패했습니다");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "팀 정보를 불러오는데 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setChangingRole(userId);
    try {
      const res = await fetch("/api/teams/role", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role: newRole }),
      });

      if (res.ok) {
        setTeam((prev) =>
          prev
            ? {
                ...prev,
                members: prev.members.map((m) =>
                  m.id === userId ? { ...m, role: newRole } : m
                ),
              }
            : null
        );
      }
    } catch (error) {
      console.error("역할 변경 실패:", error);
    } finally {
      setChangingRole(null);
    }
  };

  const filteredMembers = team?.members?.filter(
    (m) =>
      m.id !== session?.user?.id &&
      (m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.position?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.number?.toString().includes(searchTerm))
  ) || [];

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-white">
      <PageHeader title="운영진 관리" left={<BackButton href="/my/team-admin" />} />

      <main className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            팀원 검색
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="이름, 포지션, 등번호로 검색"
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
          <div className="space-y-2">
            {filteredMembers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                {searchTerm ? "검색 결과가 없습니다" : "팀원이 없습니다"}
              </p>
            ) : (
              filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {member.image ? (
                      <Image
                        src={member.image}
                        alt={member.name || ""}
                        width={32}
                        height={32}
                        sizes="32px"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-team-50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm text-gray-900 font-medium">
                        {member.name || "익명"}
                      </span>
                      {member.role === "ADMIN" && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-team-300 flex-shrink-0">
                          <path d="M12 6L16 12L21 8L19 18H5L3 8L8 12L12 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                      <span className="text-xs text-gray-400">
                        {member.position || ""} {member.number ? `${member.number}` : ""}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      handleRoleChange(
                        member.id,
                        member.role === "ADMIN" ? "MEMBER" : "ADMIN"
                      )
                    }
                    disabled={changingRole === member.id}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${
                      member.role === "ADMIN"
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        : "bg-team-500 text-white hover:bg-team-600"
                    } disabled:opacity-50`}
                  >
                    {changingRole === member.id
                      ? "..."
                      : member.role === "ADMIN"
                        ? "해제"
                        : "운영진 지정"}
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center mt-4">{error}</p>
        )}
      </main>
    </div>
  );
}
