"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import Image from "next/image";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface TeamInfo {
  id: string;
  name: string;
  inviteCode: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

// 접근성을 고려한 프리셋 컬러 (모바일 친화적)
// HSL 기준: Lightness 35-65%, Saturation 30-80%
const PRESET_COLORS = [
  { name: "브라운", color: "#967B5D" },    // 기본 갈색 (L:52%, S:46%)
  { name: "그린", color: "#059669" },      // 초록 (L:42%, S:95%)
  { name: "블루", color: "#3B82F6" },      // 파랑 (L:60%, S:92%)
  { name: "레드", color: "#DC2626" },      // 빨강 (L:49%, S:78%) - 조정됨
  { name: "오렌지", color: "#EA580C" },    // 주황 (L:48%, S:92%) - 조정됨
  { name: "퍼플", color: "#9333EA" },      // 보라 (L:56%, S:84%) - 조정됨
  { name: "핑크", color: "#DB2777" },      // 핑크 (L:50%, S:77%) - 조정됨
  { name: "시안", color: "#0891B2" },      // 청록 (L:36%, S:92%) - 조정됨
  { name: "인디고", color: "#4F46E5" },    // 인디고 (L:59%, S:78%)
  { name: "틸", color: "#0D9488" },        // 틸 (L:46%, S:85%)
  { name: "라임", color: "#65A30D" },      // 라임 (L:35%, S:86%)
  { name: "로즈", color: "#E11D48" },      // 로즈 (L:50%, S:80%)
];

export default function TeamSettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#967B5D");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") {
      router.push("/my");
    }
  }, [session, router]);

  // SWR로 팀 데이터 페칭
  const { data: team, isLoading: loading, mutate: refetchTeam } = useSWR<TeamInfo>(
    session?.user?.role === "ADMIN" ? "/api/teams" : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateIfStale: false,
      dedupingInterval: 120000, // 2분 캐시
    }
  );

  // team 데이터가 변경될 때마다 상태 업데이트
  useEffect(() => {
    if (team) {
      setTeamName(team.name || "");
      setLogoUrl(team.logoUrl || null);
      setPrimaryColor(team.primaryColor || "#967B5D");
    }
  }, [team]);

  const fetchTeam = () => refetchTeam();

  const handleLogoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("이미지는 5MB 이하만 가능합니다");
      return;
    }

    if (!file.type.startsWith("image/")) {
      setError("이미지 파일만 업로드 가능합니다");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const uploadData = new FormData();
      uploadData.append("file", file);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: uploadData,
      });

      if (!uploadRes.ok) {
        const data = await uploadRes.json();
        throw new Error(data.error || "이미지 업로드에 실패했습니다");
      }

      const { url } = await uploadRes.json();
      setLogoUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 업로드 실패");
    } finally {
      setUploading(false);
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
        body: JSON.stringify({
          name: teamName.trim(),
          logoUrl: logoUrl,
          primaryColor
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장에 실패했습니다");
      }

      await res.json();
      await refetchTeam();
      setSuccess("저장되었습니다");
      setTimeout(() => {
        router.push("/my");
      }, 1000);
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
        await res.json();
        await refetchTeam();
        setSuccess("초대 코드가 변경되었습니다");
        setTimeout(() => setSuccess(""), 2000);
      }
    } catch {
      setError("초대 코드 변경에 실패했습니다");
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <BackButton href="/my/team-admin" />
          <h1 className="text-lg font-semibold text-gray-900">팀 프로필</h1>
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
        {/* 팀 로고 */}
        <div className="bg-white rounded-xl p-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            팀 로고
          </label>
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden mb-3 flex items-center justify-center">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="팀 로고"
                  width={96}
                  height={96}
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M12 7 L15.5 10 L14 14.5 L10 14.5 L8.5 10 Z" fill="none" />
                </svg>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-team-500 text-sm font-medium"
            >
              {uploading ? "업로드 중..." : "로고 변경"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleLogoSelect}
              className="hidden"
            />
          </div>
        </div>

        {/* 팀 컬러 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            팀 컬러
          </label>
          <div className="grid grid-cols-4 gap-3">
            {PRESET_COLORS.map(({ name, color }) => (
              <button
                key={color}
                onClick={() => setPrimaryColor(color)}
                className={`relative w-full aspect-square rounded-lg transition-all ${
                  primaryColor === color
                    ? "ring-2 ring-offset-2 ring-gray-900 scale-105"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: color }}
                title={name}
              >
                {primaryColor === color && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-500">
            💡 모바일 접근성을 고려한 컬러입니다
          </p>
        </div>

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
