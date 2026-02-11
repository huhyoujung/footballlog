"use client";

import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
}

interface TeamInfo {
  id: string;
  vestOrder: string[];
  members: TeamMember[];
}

export default function VestDutyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<TeamInfo | null>(null);
  const [vestOrder, setVestOrder] = useState<string[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
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

  // 터치 이벤트 핸들러 (모바일)
  const handleTouchStart = (index: number, e: React.TouchEvent) => {
    setDraggedIndex(index);
    setTouchStartY(e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggedIndex === null || touchStartY === null) return;

    e.preventDefault();
    const touch = e.touches[0];
    const elementBelow = document.elementFromPoint(touch.clientX, touch.clientY);

    // 드래그 중인 요소의 부모를 찾아서 인덱스 파악
    const listItem = elementBelow?.closest('[data-vest-index]') as HTMLElement;
    if (!listItem) return;

    const targetIndex = parseInt(listItem.dataset.vestIndex || '', 10);
    if (isNaN(targetIndex) || targetIndex === draggedIndex) return;

    const newOrder = [...vestOrder];
    const draggedItem = newOrder[draggedIndex];
    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);
    setVestOrder(newOrder);
    setDraggedIndex(targetIndex);
  };

  const handleTouchEnd = () => {
    setDraggedIndex(null);
    setTouchStartY(null);
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
        setTimeout(() => {
          router.push("/my/team-admin");
        }, 500);
      } else {
        const data = await res.json();
        setError(data.error || "저장에 실패했습니다");
      }
    } catch (err) {
      setError("저장 실패");
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href="/my/team-admin" />
          <h1 className="text-base font-semibold text-gray-900">조끼 빨래 당번</h1>
          <button
            onClick={saveVestOrder}
            className="text-team-500 font-medium"
          >
            저장
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4">
        <div className="bg-white rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-4">
            드래그하여 순서를 조정하세요. 정기운동 생성 시 이 순서대로 자동 추천됩니다.
          </p>

          {/* 조끼 순서 리스트 */}
          {vestOrder.length > 0 ? (
            <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 mb-4">
              {vestOrder.map((userId, index) => {
                const member = team?.members?.find((m) => m.id === userId);
                if (!member) return null;
                return (
                  <div
                    key={userId}
                    data-vest-index={index}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handleTouchStart(index, e)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className={`flex items-center gap-3 p-3 bg-white cursor-move hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl ${
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
                        {member.position || ""} {member.number ? `${member.number}` : ""}
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
                      {member.position || ""} {member.number ? `${member.number}` : ""}
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
          <p className="text-red-500 text-sm text-center mt-4">{error}</p>
        )}
        {success && (
          <p className="text-team-500 text-sm text-center mt-4">{success}</p>
        )}
      </main>
    </div>
  );
}
