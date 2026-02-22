"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, UserCheck, UserX } from "lucide-react";
import type { CheckInEntry } from "@/types/training-event";

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
}

interface Props {
  eventId: string;
  teamId: string;
  checkIns: CheckInEntry[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function AttendanceManageSheet({
  eventId,
  teamId,
  checkIns,
  isOpen,
  onClose,
  onRefresh,
}: Props) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingMembers(true);
    fetch(`/api/teams/${teamId}/members`)
      .then((res) => res.json())
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoadingMembers(false));
  }, [isOpen, teamId]);

  const isCheckedIn = (userId: string) =>
    checkIns.some((c) => c.userId === userId);

  const handleToggle = async (userId: string) => {
    if (togglingUserId) return;
    setTogglingUserId(userId);

    const method = isCheckedIn(userId) ? "DELETE" : "POST";

    try {
      const res = await fetch(`/api/training-events/${eventId}/check-in/admin`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "오류가 발생했습니다");
        return;
      }

      onRefresh();
    } catch {
      alert("네트워크 오류가 발생했습니다");
    } finally {
      setTogglingUserId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">출석 관리</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <p className="px-5 py-2 text-xs text-gray-500">
          체크인하지 못한 팀원을 직접 등록하거나 취소할 수 있습니다.
        </p>

        {/* 팀원 목록 */}
        <div className="overflow-y-auto flex-1 px-5 pb-6">
          {loadingMembers ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-team-500" />
            </div>
          ) : (
            <div className="space-y-1 pt-2">
              {members.map((member) => {
                const checked = isCheckedIn(member.id);
                const loading = togglingUserId === member.id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={member.name || ""}
                          width={32}
                          height={32}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                          {(member.name || "?")[0]}
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-gray-900 font-medium">
                          {member.name || "이름 없음"}
                        </span>
                        {member.number && (
                          <span className="text-xs text-gray-400 ml-1.5">
                            #{member.number}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggle(member.id)}
                      disabled={loading}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        checked
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      } disabled:opacity-50`}
                    >
                      {loading ? (
                        <div className="w-3.5 h-3.5 animate-spin rounded-full border-b border-current" />
                      ) : checked ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          출석
                        </>
                      ) : (
                        <>
                          <UserX className="w-3.5 h-3.5" />
                          미출석
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
              {members.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  팀원이 없습니다
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
