"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface TeamInfo {
  id: string;
  name: string;
  inviteCode: string;
}

export default function TeamSettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [teamName, setTeamName] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") {
      router.push("/my");
      return;
    }
    fetchTeam();
  }, [session]);

  const fetchTeam = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeam(data);
        setTeamName(data.name || "");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!teamName.trim()) {
      setError("팀 이름을 입력해주세요");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장에 실패했습니다");
      }

      const updated = await res.json();
      setTeam(updated);
      setSuccess("저장되었습니다");
      setTimeout(() => setSuccess(""), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleCopyInviteCode = async () => {
    if (!team) return;
    try {
      await navigator.clipboard.writeText(team.inviteCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleRegenerateCode = async () => {
    if (!confirm("초대 코드를 변경하시겠습니까? 기존 코드는 더 이상 사용할 수 없습니다.")) return;

    try {
      const res = await fetch("/api/teams", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regenerateInviteCode: true }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTeam(updated);
        setSuccess("초대 코드가 변경되었습니다");
        setTimeout(() => setSuccess(""), 2000);
      }
    } catch {
      setError("초대 코드 변경에 실패했습니다");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/my" className="text-gray-500 hover:text-gray-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">팀 프로필 수정</h1>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-team-500 font-medium disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* 팀 이름 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            팀 이름
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="팀 이름을 입력하세요"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
        </div>

        {/* 초대 코드 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            초대 코드
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-4 py-3 bg-gray-50 rounded-lg text-gray-900 font-mono tracking-wider text-sm">
              {team?.inviteCode}
            </div>
            <button
              onClick={handleCopyInviteCode}
              className="px-3 py-3 text-gray-400 hover:text-team-500 transition-colors"
            >
              {copied ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#967B5D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                </svg>
              )}
            </button>
          </div>
          <button
            onClick={handleRegenerateCode}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            초대 코드 변경
          </button>
        </div>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}
        {success && (
          <p className="text-team-500 text-sm text-center">{success}</p>
        )}
      </main>
    </div>
  );
}
