"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

const POSITIONS = [
  "GK", "CB", "LB", "RB",
  "CDM", "CM", "CAM",
  "LM", "RM",
  "LW", "RW", "ST", "CF",
];

export default function OnboardingPage() {
  const router = useRouter();
  const { update } = useSession();
  const [mode, setMode] = useState<"select" | "create" | "join" | "profile">("select");
  const [teamName, setTeamName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [position, setPosition] = useState("");
  const [number, setNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: teamName }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "팀 생성에 실패했습니다");
      }

      await update();
      setMode("profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/teams/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "팀 가입에 실패했습니다");
      }

      await update();
      setMode("profile");
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async () => {
    setLoading(true);
    try {
      await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: position || null,
          number: number ? parseInt(number) : null,
        }),
      });
      router.push("/");
      router.refresh();
    } catch {
      router.push("/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-team-500 to-team-700 px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-4xl">⚽</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">네모의 꿈</h1>
          <p className="text-team-100">
            {mode === "profile" ? "프로필을 설정하세요" : "팀에 참여하세요"}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6">
          {mode === "select" && (
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800 text-center mb-6">
                시작하기
              </h2>
              <button
                onClick={() => setMode("join")}
                className="w-full py-3 px-4 bg-team-500 text-white font-medium rounded-lg hover:bg-team-600 transition-colors"
              >
                초대 코드로 가입하기
              </button>
              <button
                onClick={() => setMode("create")}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors mt-2"
              >
                또는 새 팀 만들기
              </button>
            </div>
          )}

          {mode === "create" && (
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <button
                type="button"
                onClick={() => setMode("select")}
                className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
              >
                ← 뒤로
              </button>
              <h2 className="text-xl font-semibold text-gray-800">
                새 팀 만들기
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  팀 이름
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="예: FC 청춘"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || !teamName.trim()}
                className="w-full py-3 px-4 bg-team-500 text-white font-medium rounded-lg hover:bg-team-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "생성 중..." : "팀 만들기"}
              </button>
            </form>
          )}

          {mode === "join" && (
            <form onSubmit={handleJoinTeam} className="space-y-4">
              <button
                type="button"
                onClick={() => setMode("select")}
                className="text-gray-500 hover:text-gray-700 text-sm flex items-center gap-1"
              >
                ← 뒤로
              </button>
              <h2 className="text-xl font-semibold text-gray-800">
                팀에 가입하기
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  초대 코드
                </label>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="초대 코드를 입력하세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
                  disabled={loading}
                />
              </div>
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button
                type="submit"
                disabled={loading || !inviteCode.trim()}
                className="w-full py-3 px-4 bg-team-500 text-white font-medium rounded-lg hover:bg-team-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "가입 중..." : "팀 가입하기"}
              </button>
            </form>
          )}

          {mode === "profile" && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold text-gray-800">
                내 포지션 & 등번호
              </h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  포지션
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {POSITIONS.map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setPosition(position === pos ? "" : pos)}
                      className={`py-2 text-sm font-medium rounded-lg transition-colors ${
                        position === pos
                          ? "bg-team-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  등번호
                </label>
                <input
                  type="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="예: 10"
                  min={0}
                  max={99}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    router.push("/");
                    router.refresh();
                  }}
                  className="flex-1 py-3 px-4 text-gray-500 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  건너뛰기
                </button>
                <button
                  onClick={handleProfileSubmit}
                  disabled={loading}
                  className="flex-1 py-3 px-4 bg-team-500 text-white font-medium rounded-lg hover:bg-team-600 transition-colors disabled:opacity-50"
                >
                  {loading ? "저장 중..." : "완료"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
