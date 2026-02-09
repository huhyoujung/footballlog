"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useTeam } from "@/contexts/TeamContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";
import Image from "next/image";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Equipment {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  ownerId: string | null;
}

type Tab = "equipment" | "manager";

export default function TeamEquipmentPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { teamData } = useTeam();
  const [activeTab, setActiveTab] = useState<Tab>("equipment");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 드래그 상태
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [touchDragItem, setTouchDragItem] = useState<{ index: number; name: string } | null>(null);
  const [touchPosition, setTouchPosition] = useState<{ x: number; y: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") {
      router.push("/my");
    }
  }, [session, router]);

  // SWR로 장비 데이터 페칭
  const { data: equipments = [], isLoading, mutate: refetchEquipments } = useSWR<Equipment[]>(
    session?.user?.role === "ADMIN" ? "/api/teams/equipment" : null,
    fetcher
  );

  const fetchEquipments = () => refetchEquipments();

  // 장비 관리자 목록 (ownerId가 있는 장비들의 ownerId 중복 제거)
  const managers = new Set<string>(equipments.filter((eq) => eq.ownerId).map((eq) => eq.ownerId!));

  const handleAdd = async () => {
    if (!name.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch("/api/teams/equipment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "추가에 실패했습니다");
        return;
      }

      await fetchEquipments();
      setShowAddModal(false);
      setName("");
      setDescription("");
    } catch {
      alert("추가에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!selectedEquipment || !name.trim()) return;
    setSubmitting(true);

    try {
      const res = await fetch(`/api/teams/equipment/${selectedEquipment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          ownerId: selectedEquipment.ownerId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "수정에 실패했습니다");
        return;
      }

      await fetchEquipments();
      setShowEditModal(false);
      setSelectedEquipment(null);
      setName("");
      setDescription("");
    } catch {
      alert("수정에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEquipment) return;

    try {
      const res = await fetch(`/api/teams/equipment/${selectedEquipment.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "삭제에 실패했습니다");
        return;
      }

      await fetchEquipments();
      setShowDeleteConfirm(false);
      setSelectedEquipment(null);
    } catch {
      alert("삭제에 실패했습니다");
    }
  };

  // 드래그 앤 드롭 (데스크톱)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDropTarget(index);
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDropTarget(null);
      return;
    }

    const reordered = [...equipments];
    const [moved] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, moved);

    // 서버에 순서 업데이트
    await updateOrder(reordered.map((eq) => eq.id));

    setDraggedIndex(null);
    setDropTarget(null);
  };

  // 터치 드래그 (모바일)
  const handleTouchStart = (index: number, name: string) => {
    setTouchDragItem({ index, name });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragItem) return;
    e.preventDefault();

    const touch = e.touches[0];
    setTouchPosition({ x: touch.clientX, y: touch.clientY });

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const dropZone = element?.closest('[data-drop-index]');
    if (dropZone) {
      const index = parseInt(dropZone.getAttribute('data-drop-index') || '-1');
      if (index >= 0) setDropTarget(index);
    } else {
      setDropTarget(null);
    }
  };

  const handleTouchEnd = async () => {
    if (touchDragItem !== null && dropTarget !== null && touchDragItem.index !== dropTarget) {
      const reordered = [...equipments];
      const [moved] = reordered.splice(touchDragItem.index, 1);
      reordered.splice(dropTarget, 0, moved);

      await updateOrder(reordered.map((eq) => eq.id));
    }

    setTouchDragItem(null);
    setTouchPosition(null);
    setDropTarget(null);
  };

  const updateOrder = async (equipmentIds: string[]) => {
    try {
      const res = await fetch("/api/teams/equipment/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentIds }),
      });

      if (res.ok) {
        await fetchEquipments();
      } else {
        alert("순서 변경에 실패했습니다");
      }
    } catch {
      alert("순서 변경에 실패했습니다");
    }
  };

  // 관리자 추가/제거
  const handleToggleManager = async (memberId: string) => {
    const isManager = managers.has(memberId);

    try {
      if (isManager) {
        // 관리자 제거: 해당 멤버가 owner인 모든 장비의 ownerId를 null로
        const equipmentsToUpdate = equipments.filter((eq) => eq.ownerId === memberId);
        await Promise.all(
          equipmentsToUpdate.map((eq) =>
            fetch(`/api/teams/equipment/${eq.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: eq.name,
                description: eq.description,
                ownerId: null,
              }),
            })
          )
        );
      } else {
        // 관리자 추가: 첫 번째 장비의 ownerId를 해당 멤버로 (임시)
        // 실제 배정은 정기운동 장비 탭에서 함
        if (equipments.length > 0) {
          const firstEquipment = equipments[0];
          await fetch(`/api/teams/equipment/${firstEquipment.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: firstEquipment.name,
              description: firstEquipment.description,
              ownerId: memberId,
            }),
          });
        }
      }

      await fetchEquipments();
    } catch {
      alert("관리자 설정에 실패했습니다");
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <BackButton href="/my/team-admin" />
          <h1 className="text-lg font-semibold text-gray-900">장비 관리</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto flex">
          <button
            onClick={() => setActiveTab("equipment")}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "equipment"
                ? "border-team-500 text-team-600"
                : "border-transparent text-gray-500"
            }`}
          >
            장비
          </button>
          <button
            onClick={() => setActiveTab("manager")}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "manager"
                ? "border-team-500 text-team-600"
                : "border-transparent text-gray-500"
            }`}
          >
            관리자
          </button>
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* 장비 탭 */}
        {activeTab === "equipment" && (
          <>
            <div className="bg-white rounded-xl p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">팀 장비 목록</h3>
              <p className="text-xs text-gray-400 mb-3">드래그해서 순서 변경 가능</p>
              <div className="space-y-2">
                {equipments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    등록된 장비가 없습니다
                  </p>
                ) : (
                  equipments.map((eq, index) => (
                    <div
                      key={eq.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onTouchStart={() => handleTouchStart(index, eq.name)}
                      onTouchMove={handleTouchMove}
                      onTouchEnd={handleTouchEnd}
                      data-drop-index={index}
                      className={`border border-gray-200 rounded-lg p-3 cursor-move touch-none transition-all ${
                        dropTarget === index ? "border-team-500 bg-team-50" : "hover:bg-gray-50"
                      } ${touchDragItem?.index === index ? "opacity-50" : ""}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1">
                          {/* 드래그 핸들 */}
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-gray-400 flex-shrink-0">
                            <path d="M9 5h2v2H9V5zm0 6h2v2H9v-2zm0 6h2v2H9v-2zm6-12h2v2h-2V5zm0 6h2v2h-2v-2zm0 6h2v2h-2v-2z" fill="currentColor"/>
                          </svg>
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">{eq.name}</h4>
                            {eq.description && (
                              <p className="text-xs text-gray-500 mt-0.5">{eq.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-2">
                          <button
                            onClick={() => {
                              setSelectedEquipment(eq);
                              setName(eq.name);
                              setDescription(eq.description || "");
                              setShowEditModal(true);
                            }}
                            className="text-xs text-team-600 hover:text-team-700 px-2 py-1"
                          >
                            수정
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEquipment(eq);
                              setShowDeleteConfirm(true);
                            }}
                            className="text-xs text-red-500 hover:text-red-600 px-2 py-1"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <button
              onClick={() => {
                setName("");
                setDescription("");
                setShowAddModal(true);
              }}
              className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-team-400 hover:text-team-600 transition-colors"
            >
              + 장비 추가
            </button>
          </>
        )}

        {/* 관리자 탭 */}
        {activeTab === "manager" && (
          <div className="bg-white rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">장비 관리자 설정</h3>
            <p className="text-xs text-gray-500 mb-3">
              팀 운동에서 장비를 배정받을 수 있는 관리자입니다
            </p>
            <div className="space-y-2">
              {teamData?.members.map((member) => {
                const isManager = managers.has(member.id);
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
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
                        {member.role === "ADMIN" && (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-team-300 flex-shrink-0">
                            <path d="M12 6L16 12L21 8L19 18H5L3 8L8 12L12 6Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                        <span className="text-xs text-gray-400">
                          {member.position || ""} {member.number ? `#${member.number}` : ""}
                        </span>
                      </div>
                      {isManager && (
                        <span className="text-xs text-team-600 mt-0.5 block">
                          장비 관리자
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleManager(member.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        isManager
                          ? "bg-red-100 text-red-600 hover:bg-red-200"
                          : "bg-team-100 text-team-600 hover:bg-team-200"
                      }`}
                    >
                      {isManager ? "제거" : "추가"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* 터치 드래그 고스트 */}
      {touchDragItem && touchPosition && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: touchPosition.x,
            top: touchPosition.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <span className="inline-block px-3 py-2 bg-team-600 text-white rounded-md text-xs font-medium shadow-lg opacity-80">
            {touchDragItem.name}
          </span>
        </div>
      )}

      {/* 추가 모달 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">장비 추가</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  장비 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 축구공 (5개)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  설명 (선택)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 공기 빠지지 않게 관리"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium"
              >
                취소
              </button>
              <button
                onClick={handleAdd}
                disabled={!name.trim() || submitting}
                className="flex-1 py-2.5 bg-team-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {submitting ? "추가 중..." : "추가"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">장비 수정</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  장비 이름 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  설명 (선택)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setSelectedEquipment(null);
                  setName("");
                  setDescription("");
                }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium"
              >
                취소
              </button>
              <button
                onClick={handleEdit}
                disabled={!name.trim() || submitting}
                className="flex-1 py-2.5 bg-team-500 text-white rounded-lg font-medium disabled:opacity-50"
              >
                {submitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">장비 삭제</h3>
            <p className="text-sm text-gray-600 mb-6">
              이 장비를 삭제하시겠습니까? 과거 배정 기록도 모두 삭제됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setSelectedEquipment(null);
                }}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
