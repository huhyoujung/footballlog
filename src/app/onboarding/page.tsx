"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import BackButton from "@/components/BackButton";
import { usePushSubscription } from "@/lib/usePushSubscription";

const POSITIONS = [
  "감독",
  "GK", "CB", "LB", "RB",
  "CDM", "CM", "CAM",
  "LM", "RM",
  "LW", "RW", "ST", "CF",
];

interface TeamSearchResult {
  id: string;
  name: string;
  logoUrl: string | null;
  _count: { members: number };
}

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();
  const { isSupported, subscribe } = usePushSubscription();
  const [mode, setMode] = useState<"select" | "find" | "create" | "profile">("select");

  // 팀 찾기
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<TeamSearchResult[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamSearchResult | null>(null);
  const [inviteCode, setInviteCode] = useState("");

  // 팀 생성
  const [teamName, setTeamName] = useState("");

  // 프로필
  const [position, setPosition] = useState("");
  const [number, setNumber] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 온보딩 완료 후 푸시 알림 권한 요청 및 이동
  const completeOnboarding = async () => {
    // 푸시 알림 권한 요청 (비동기, 실패해도 계속 진행)
    if (isSupported) {
      try {
        await subscribe();
      } catch (error) {
        console.log("Push notification prompt skipped or denied");
      }
    }

    // returnUrl이 있으면 해당 URL로, 없으면 홈으로 이동
    const returnUrl = searchParams.get("returnUrl");
    router.push(returnUrl || "/");
    router.refresh();
  };

  // 팀 검색
  useEffect(() => {
    const searchTeams = async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }

      try {
        const res = await fetch(`/api/teams/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.teams || []);
        }
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(searchTeams, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

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
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setLoading(false);
    }
  };

  const handleJoinTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !selectedTeam) return;

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
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setLoading(false);
    }
  };

  const handleProfileSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          position: position || null,
          number: number ? parseInt(number) : null,
          phoneNumber: phoneNumber.trim() || null,
        }),
      });

      if (!res.ok) {
        throw new Error("프로필 저장에 실패했습니다");
      }

      setLoading(false);
      await completeOnboarding();
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* 모드 선택 */}
        {mode === "select" && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">팀 찾기</h1>
            <p className="text-sm text-gray-500 text-center mb-6">
              한 계정은 하나의 팀에만 소속될 수 있습니다
            </p>

            <div className="space-y-3">
              <button
                onClick={() => setMode("find")}
                className="w-full py-4 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors"
              >
                기존 팀 찾아서 가입하기
              </button>
              <button
                onClick={() => setMode("create")}
                className="w-full py-4 bg-white border-2 border-team-500 text-team-600 rounded-xl font-semibold hover:bg-team-50 transition-colors"
              >
                새로운 팀 만들기
              </button>
            </div>

            <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-gray-100">
              <button
                onClick={async () => {
                  await signOut({ redirect: false });
                  window.location.href = "/login";
                }}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                로그아웃
              </button>
              <a
                href="https://open.kakao.com/o/sqBLurfi"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                문의하기
              </a>
            </div>
          </div>
        )}

        {/* 팀 찾기 */}
        {mode === "find" && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="mb-4">
              <BackButton onClick={() => {
                setMode("select");
                setSelectedTeam(null);
                setInviteCode("");
                setSearchQuery("");
                setError("");
              }} />
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-4">팀 검색</h2>

            {!selectedTeam ? (
              <>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="팀 이름을 검색하세요"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg mb-4 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />

                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {searchResults.length === 0 && searchQuery.trim() && (
                    <p className="text-center text-gray-400 py-8">
                      검색 결과가 없습니다
                    </p>
                  )}
                  {searchResults.map((team) => (
                    <button
                      key={team.id}
                      onClick={() => setSelectedTeam(team)}
                      className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      {team.logoUrl ? (
                        <Image src={team.logoUrl} alt={team.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover" />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-team-100 flex items-center justify-center">
                          <span className="text-team-600 font-semibold">{team.name[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <h3 className="font-semibold text-gray-900">{team.name}</h3>
                        <p className="text-sm text-gray-500">{team._count.members}명의 팀원</p>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <form onSubmit={handleJoinTeam} className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-team-50 rounded-lg">
                  {selectedTeam.logoUrl ? (
                    <Image src={selectedTeam.logoUrl} alt={selectedTeam.name} width={48} height={48} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-team-100 flex items-center justify-center">
                      <span className="text-team-600 font-semibold">{selectedTeam.name[0]}</span>
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900">{selectedTeam.name}</h3>
                    <p className="text-sm text-gray-500">{selectedTeam._count.members}명의 팀원</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    초대 코드
                  </label>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="팀 운영진에게 받은 초대 코드를 입력하세요"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
                    required
                  />
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTeam(null);
                      setInviteCode("");
                      setError("");
                    }}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !inviteCode.trim()}
                    className="flex-1 py-3 bg-team-500 text-white rounded-lg font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
                  >
                    {loading ? "가입 중..." : "가입하기"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* 팀 생성 */}
        {mode === "create" && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="mb-4">
              <BackButton onClick={() => {
                setMode("select");
                setTeamName("");
                setError("");
              }} />
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-4">새로운 팀 만들기</h2>

            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  팀 이름
                </label>
                <input
                  type="text"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="예: 네모의 꿈 FC"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
                  required
                />
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <button
                type="submit"
                disabled={loading || !teamName.trim()}
                className="w-full py-3 bg-team-500 text-white rounded-lg font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
              >
                {loading ? "생성 중..." : "팀 만들기"}
              </button>
            </form>
          </div>
        )}

        {/* 프로필 설정 */}
        {mode === "profile" && (
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-2">프로필 설정</h2>
            <p className="text-sm text-gray-500 mb-6">나중에 설정에서 수정할 수 있습니다</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  포지션 (선택)
                </label>
                <select
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
                >
                  <option value="">선택 안함</option>
                  {POSITIONS.map((pos) => (
                    <option key={pos} value={pos}>{pos}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  등번호 (선택)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={2}
                  value={number}
                  onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="예: 10"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  전화번호 (선택)
                </label>
                <input
                  type="tel"
                  inputMode="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="010-0000-0000"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">팀 비상연락망으로 활용됩니다</p>
              </div>

              {error && <p className="text-red-500 text-sm">{error}</p>}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={completeOnboarding}
                  disabled={loading}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  건너뛰기
                </button>
                <button
                  onClick={handleProfileSubmit}
                  disabled={loading}
                  className="flex-1 py-3 bg-team-500 text-white rounded-lg font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
                >
                  {loading ? "저장 중..." : "저장하고 시작하기"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
