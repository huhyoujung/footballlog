"use client";
import LoadingSpinner from "@/components/LoadingSpinner";

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

interface TeamInfo {
  id: string;
  name: string;
  inviteCode: string;
  logoUrl?: string | null;
  primaryColor?: string;
  vestOrder?: string[];
  members?: {
    id: string;
    name: string | null;
    image: string | null;
    role: string;
    position: string | null;
    number: number | null;
  }[];
}

const PRESET_COLORS = [
  "#967B5D", // 기본 갈색
  "#059669", // 초록
  "#3B82F6", // 파랑
  "#EF4444", // 빨강
  "#F59E0B", // 주황
  "#8B5CF6", // 보라
  "#EC4899", // 핑크
  "#06B6D4", // 청록
];

export default function TeamSettingsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [teamName, setTeamName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#967B5D");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [vestOrder, setVestOrder] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

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
        setLogoUrl(data.logoUrl || null);
        setPrimaryColor(data.primaryColor || "#967B5D");
        setVestOrder(data.vestOrder || []);
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

      const updated = await res.json();
      setTeam(updated);
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
        const updated = await res.json();
        setTeam(updated);
        setSuccess("초대 코드가 변경되었습니다");
        setTimeout(() => setSuccess(""), 2000);
      }
    } catch {
      setError("초대 코드 변경에 실패했습니다");
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
                members: prev.members?.map((m) =>
                  m.id === userId ? { ...m, role: newRole } : m
                ) || [],
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

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newOrder = [...vestOrder];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(index, 0, draggedItem);
    setVestOrder(newOrder);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const addToVestOrder = (userId: string) => {
    if (!vestOrder.includes(userId)) {
      setVestOrder([...vestOrder, userId]);
    }
  };

  const removeFromVestOrder = (userId: string) => {
    setVestOrder(vestOrder.filter((id) => id !== userId));
  };

  const saveVestOrder = async () => {
    try {
      const res = await fetch("/api/teams/vest-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vestOrder }),
      });

      if (res.ok) {
        setSuccess("조끼 순서가 저장되었습니다");
        setTimeout(() => setSuccess(""), 2000);
      } else {
        const data = await res.json();
        setError(data.error || "저장에 실패했습니다");
      }
    } catch (err) {
      setError("저장 실패");
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
            {PRESET_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setPrimaryColor(color)}
                className={`w-full aspect-square rounded-lg transition-all ${
                  primaryColor === color
                    ? "ring-2 ring-offset-2 ring-gray-900 scale-110"
                    : "hover:scale-105"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
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

        {/* 운영진 관리 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-3">
            운영진 관리
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="팀원 검색 (이름, 포지션, 등번호)"
            className="w-full px-4 py-2.5 mb-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
          <div className="space-y-2 max-h-64 overflow-y-auto">
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
                      <span className="text-xs text-gray-400">
                        {member.position || ""} {member.number ? `#${member.number}` : ""}
                      </span>
                    </div>
                    {member.role === "ADMIN" && (
                      <span className="inline-block mt-0.5 px-2 py-0.5 bg-team-50 text-team-500 text-[10px] font-medium rounded-full">
                        운영진
                      </span>
                    )}
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

        {/* 조끼 당번 순서 */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <label className="block text-sm font-medium text-gray-700">
              조끼 당번 순서
            </label>
            <button
              onClick={saveVestOrder}
              className="text-xs px-3 py-1.5 bg-team-500 text-white rounded-lg hover:bg-team-600 transition-colors"
            >
              순서 저장
            </button>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            드래그하여 순서를 조정하세요. 정기운동 생성 시 이 순서대로 자동 추천됩니다.
          </p>

          {/* 조끼 순서 리스트 */}
          {vestOrder.length > 0 ? (
            <div className="space-y-2 mb-4">
              {vestOrder.map((userId, index) => {
                const member = team?.members?.find((m) => m.id === userId);
                if (!member) return null;
                return (
                  <div
                    key={userId}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-white cursor-move hover:bg-gray-50 transition-colors ${
                      draggedIndex === index ? "opacity-50" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 text-gray-400">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="8" y1="6" x2="16" y2="6" />
                        <line x1="8" y1="12" x2="16" y2="12" />
                        <line x1="8" y1="18" x2="16" y2="18" />
                      </svg>
                      <span className="text-sm font-medium">{index + 1}</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={member.name || ""}
                          width={32}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-team-50" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-900 font-medium">
                        {member.name || "익명"}
                      </span>
                      <span className="text-xs text-gray-400 ml-1.5">
                        {member.position || ""} {member.number ? `#${member.number}` : ""}
                      </span>
                    </div>
                    <button
                      onClick={() => removeFromVestOrder(userId)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-6 border border-dashed border-gray-200 rounded-lg mb-4">
              조끼 당번 순서가 설정되지 않았습니다
            </p>
          )}

          {/* 팀원 추가 버튼 */}
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 mb-2">팀원 추가</p>
            <div className="flex flex-wrap gap-2">
              {team?.members
                ?.filter((m) => !vestOrder.includes(m.id))
                .map((member) => (
                  <button
                    key={member.id}
                    onClick={() => addToVestOrder(member.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-gray-50 hover:bg-team-50 text-gray-700 hover:text-team-700 text-xs rounded-lg transition-colors"
                  >
                    <span className="font-medium">{member.name || "익명"}</span>
                    <span className="text-gray-400">
                      {member.position || ""} {member.number ? `#${member.number}` : ""}
                    </span>
                  </button>
                ))}
              {team?.members?.filter((m) => !vestOrder.includes(m.id)).length === 0 && (
                <p className="text-xs text-gray-400">모든 팀원이 추가되었습니다</p>
              )}
            </div>
          </div>
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
