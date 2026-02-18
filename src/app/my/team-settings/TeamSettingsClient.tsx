// 팀 프로필 설정 클라이언트 컴포넌트
"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";
import UniformManager from "@/components/UniformManager";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface TeamInfo {
  id: string;
  name: string;
  inviteCode: string;
  logoUrl?: string | null;
  primaryColor?: string;
}

// 접근성을 고려한 프리셋 컬러 (모바일 친화적)
// 비슷한 색상 제거하여 선택하기 쉽게
const PRESET_COLORS = [
  { name: "브라운", color: "#967B5D" },    // 기본 갈색
  { name: "그린", color: "#059669" },      // 초록
  { name: "블루", color: "#3B82F6" },      // 파랑
  { name: "레드", color: "#DC2626" },      // 빨강
  { name: "오렌지", color: "#EA580C" },    // 주황
  { name: "퍼플", color: "#9333EA" },      // 보라
  { name: "틸", color: "#0D9488" },        // 청록
  { name: "라임", color: "#65A30D" },      // 라임
];

export default function TeamSettingsClient() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#967B5D");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // SWR로 팀 데이터 페칭
  const { data: team, isLoading: loading, mutate: refetchTeam } = useSWR<TeamInfo>(
    "/api/teams",
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

      // 팀 컬러 변경 시 CSS 변수 업데이트를 위해 새로고침
      setTimeout(() => {
        window.location.href = "/my/team-admin";
      }, 800);
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
    <div className="min-h-screen bg-white">
      <PageHeader
        title="팀 프로필"
        left={<BackButton href="/my/team-admin" />}
        right={
          <button onClick={handleSave} disabled={saving} className="text-team-500 font-medium disabled:opacity-50">
            {saving ? "저장 중..." : "저장"}
          </button>
        }
      />

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* 팀 로고 및 기본 정보 */}
        <div className="bg-white rounded-xl p-6">
          <div className="flex flex-col items-center mb-6">
            <div className="w-24 h-24 rounded-full bg-gray-100 overflow-hidden mb-3 flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="팀 로고"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    e.currentTarget.nextElementSibling?.classList.remove('hidden');
                  }}
                />
              ) : null}
              <span className={`text-5xl ${logoUrl ? 'hidden' : ''}`}>⚽</span>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-sm font-medium transition-colors"
              style={{ color: primaryColor }}
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

          {/* 팀 이름 */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              팀 이름
            </label>
            <div className="text-center text-lg font-semibold text-gray-900 mb-4">
              {teamName || "팀 이름 없음"}
            </div>
          </div>

          {/* 초대 코드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
              초대 코드
            </label>
            <div className="flex items-center justify-center gap-2">
              <div className="px-4 py-2 bg-gray-50 rounded-lg text-gray-900 font-mono tracking-wider text-sm">
                {team?.inviteCode}
              </div>
              <button
                onClick={handleCopyInviteCode}
                className="px-3 py-2 text-gray-400 hover:opacity-80 transition-opacity"
                style={{ color: copied ? primaryColor : undefined }}
              >
                {copied ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
            <div className="text-center mt-2">
              <button
                onClick={handleRegenerateCode}
                className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
              >
                초대 코드 변경
              </button>
            </div>
          </div>
        </div>

        {/* 팀 이름 수정 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            팀 이름 수정
          </label>
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="팀 이름을 입력하세요"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:border-transparent transition-all"
            style={{
              outlineColor: primaryColor,
            }}
            onFocus={(e) => {
              e.target.style.borderColor = primaryColor;
              e.target.style.boxShadow = `0 0 0 3px ${primaryColor}20`;
            }}
            onBlur={(e) => {
              e.target.style.borderColor = '';
              e.target.style.boxShadow = '';
            }}
          />
        </div>

        {/* 팀 컬러 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            팀 컬러
          </label>
          <div className="flex flex-wrap gap-3">
            {PRESET_COLORS.map(({ name, color }) => (
              <button
                key={color}
                onClick={() => setPrimaryColor(color)}
                className={`relative w-12 h-12 rounded-full transition-all ${
                  primaryColor === color
                    ? "ring-2 ring-offset-2 scale-110"
                    : "hover:scale-110"
                }`}
                style={{
                  backgroundColor: color,
                  '--tw-ring-color': color
                } as React.CSSProperties}
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

        {/* 유니폼 관리 */}
        <UniformManager />

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
