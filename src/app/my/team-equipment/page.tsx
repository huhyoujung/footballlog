"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTeam } from "@/contexts/TeamContext";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";
import Image from "next/image";

interface Equipment {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  ownerId: string | null;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
    position: string | null;
    number: number | null;
  } | null;
}

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
}

export default function TeamEquipmentPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { teamData } = useTeam();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // 선택된 관리자 ID 목록 (장비가 없어도 드롭존으로 표시)
  const [designatedManagers, setDesignatedManagers] = useState<Set<string>>(new Set());

  // 드래그 상태
  const [draggedEquipment, setDraggedEquipment] = useState<Equipment | null>(null);
  const [dragOverOwner, setDragOverOwner] = useState<string | null>(null);

  // 터치 드래그 상태
  const [touchDragEquipment, setTouchDragEquipment] = useState<Equipment | null>(null);
  const [touchDragPosition, setTouchDragPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (session?.user?.role !== "ADMIN") {
      router.push("/my");
      return;
    }
    fetchEquipments();
  }, [session]);

  const fetchEquipments = async () => {
    try {
      const res = await fetch("/api/teams/equipment");
      if (res.ok) {
        const data = await res.json();
        setEquipments(data);
      }
    } catch (error) {
      console.error("장비 조회 실패:", error);
    } finally {
      setLoading(false);
    }
  };

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

      const newEquipment = await res.json();
      setEquipments((prev) => [...prev, newEquipment]);

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

      const updatedEquipment = await res.json();
      setEquipments((prev) =>
        prev.map((eq) => (eq.id === selectedEquipment.id ? updatedEquipment : eq))
      );

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

      setEquipments((prev) => prev.filter((eq) => eq.id !== selectedEquipment.id));

      setShowDeleteConfirm(false);
      setSelectedEquipment(null);
    } catch {
      alert("삭제에 실패했습니다");
    }
  };

  const assignEquipmentToOwner = async (equipmentId: string, ownerId: string | null) => {
    const equipment = equipments.find((eq) => eq.id === equipmentId);
    if (!equipment) return;

    // Optimistic update
    setEquipments((prev) =>
      prev.map((eq) =>
        eq.id === equipmentId
          ? {
              ...eq,
              ownerId,
              owner: ownerId
                ? teamData?.members.find((m) => m.id === ownerId) || null
                : null,
            }
          : eq
      )
    );

    try {
      const res = await fetch(`/api/teams/equipment/${equipmentId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: equipment.name,
          description: equipment.description,
          ownerId: ownerId || "",
        }),
      });

      if (!res.ok) {
        // 실패 시 롤백
        fetchEquipments();
        alert("담당자 변경에 실패했습니다");
      }
    } catch {
      fetchEquipments();
      alert("담당자 변경에 실패했습니다");
    }
  };

  // 드래그 핸들러
  const handleDragStart = (equipment: Equipment) => {
    setDraggedEquipment(equipment);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (ownerId: string | null) => {
    if (!draggedEquipment) return;
    assignEquipmentToOwner(draggedEquipment.id, ownerId);
    setDraggedEquipment(null);
    setDragOverOwner(null);
  };

  // 터치 드래그 핸들러
  const handleTouchStart = (equipment: Equipment) => {
    setTouchDragEquipment(equipment);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragEquipment) return;
    e.preventDefault();

    const touch = e.touches[0];
    setTouchDragPosition({ x: touch.clientX, y: touch.clientY });

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    const dropZone = element.closest("[data-owner-drop]");
    if (dropZone) {
      const ownerId = dropZone.getAttribute("data-owner-id");
      setDragOverOwner(ownerId);
    } else {
      setDragOverOwner(null);
    }
  };

  const handleTouchEnd = () => {
    if (!touchDragEquipment || dragOverOwner === null) {
      setTouchDragEquipment(null);
      setTouchDragPosition(null);
      setDragOverOwner(null);
      return;
    }

    assignEquipmentToOwner(
      touchDragEquipment.id,
      dragOverOwner === "unassigned" ? null : dragOverOwner
    );

    setTouchDragEquipment(null);
    setTouchDragPosition(null);
    setDragOverOwner(null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  // 장비를 관리자별로 그룹핑
  const equipmentsByOwner: Record<string, Equipment[]> = {};
  const unassignedEquipments: Equipment[] = [];

  equipments.forEach((eq) => {
    if (!eq.ownerId) {
      unassignedEquipments.push(eq);
    } else {
      if (!equipmentsByOwner[eq.ownerId]) {
        equipmentsByOwner[eq.ownerId] = [];
      }
      equipmentsByOwner[eq.ownerId].push(eq);
    }
  });

  // 관리자 목록 (장비를 가진 사람들 + 지정된 관리자)
  const managers = teamData?.members.filter((m) =>
    equipmentsByOwner[m.id] || designatedManagers.has(m.id)
  ) || [];

  // 관리자 토글
  const toggleManager = (userId: string) => {
    setDesignatedManagers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        // 장비가 있는 관리자는 제거 불가
        if (equipmentsByOwner[userId]?.length > 0) {
          return prev;
        }
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <BackButton href="/my" />
          <h1 className="text-lg font-semibold text-gray-900">장비 관리</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* 장비 관리자 지정 */}
        <div className="bg-white rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">🎯 장비 관리자 지정</h3>
          <p className="text-xs text-gray-500 mb-3">
            장비를 배정할 수 있는 관리자를 선택하세요
          </p>
          <div className="space-y-2">
            {teamData?.members.map((manager) => {
              const hasEquipment = equipmentsByOwner[manager.id]?.length > 0;
              const isManager = designatedManagers.has(manager.id);

              return (
                <div
                  key={manager.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {manager.image ? (
                      <Image
                        src={manager.image}
                        alt={manager.name || ""}
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
                        {manager.name || "익명"}
                      </span>
                      {manager.role === "ADMIN" && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-team-300 flex-shrink-0">
                          <path d="M12 2L15 8L22 9L17 14L18 21L12 18L6 21L7 14L2 9L9 8L12 2Z" fill="currentColor" />
                        </svg>
                      )}
                      <span className="text-xs text-gray-400">
                        {manager.position || ""} {manager.number ? `#${manager.number}` : ""}
                      </span>
                    </div>
                    {hasEquipment && (
                      <span className="text-xs text-team-600 mt-0.5 block">
                        장비 {equipmentsByOwner[manager.id].length}개
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => toggleManager(manager.id)}
                    disabled={hasEquipment && isManager}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors flex-shrink-0 ${
                      isManager
                        ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        : "bg-team-500 text-white hover:bg-team-600"
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isManager ? "해제" : "관리자 지정"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* 관리자별 장비 그룹 */}
        {managers.map((manager) => {
          const managerEquipments = equipmentsByOwner[manager.id] || [];
          return (
            <div
              key={manager.id}
              data-owner-drop="true"
              data-owner-id={manager.id}
              onDragOver={handleDragOver}
              onDragEnter={() => setDragOverOwner(manager.id)}
              onDragLeave={() => setDragOverOwner(null)}
              onDrop={() => handleDrop(manager.id)}
              className={`border-2 rounded-xl p-4 transition-colors ${
                dragOverOwner === manager.id
                  ? "border-team-500 bg-team-50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-200">
                  {manager.image ? (
                    <Image
                      src={manager.image}
                      alt={manager.name || ""}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-team-50" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {manager.name || "익명"}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {managerEquipments.length}개
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {managerEquipments.map((eq) => (
                  <div
                    key={eq.id}
                    draggable
                    onDragStart={() => handleDragStart(eq)}
                    onTouchStart={() => handleTouchStart(eq)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    className={`border border-gray-200 rounded-lg p-3 cursor-grab active:cursor-grabbing touch-none ${
                      draggedEquipment?.id === eq.id || touchDragEquipment?.id === eq.id
                        ? "opacity-50"
                        : ""
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">
                          {eq.name}
                        </h4>
                        {eq.description && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            {eq.description}
                          </p>
                        )}
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
                ))}
              </div>
            </div>
          );
        })}

        {/* 미배정 장비 */}
        <div
          data-owner-drop="true"
          data-owner-id="unassigned"
          onDragOver={handleDragOver}
          onDragEnter={() => setDragOverOwner("unassigned")}
          onDragLeave={() => setDragOverOwner(null)}
          onDrop={() => handleDrop(null)}
          className={`border-2 border-dashed rounded-xl p-4 min-h-[100px] transition-colors ${
            dragOverOwner === "unassigned"
              ? "border-team-500 bg-team-50"
              : "border-gray-300 bg-gray-50"
          }`}
        >
          <h3 className="text-sm font-semibold text-gray-500 mb-3">
            미배정 ({unassignedEquipments.length}개)
          </h3>
          <div className="space-y-2">
            {unassignedEquipments.map((eq) => (
              <div
                key={eq.id}
                draggable
                onDragStart={() => handleDragStart(eq)}
                onTouchStart={() => handleTouchStart(eq)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className={`border border-gray-200 rounded-lg p-3 bg-white cursor-grab active:cursor-grabbing touch-none ${
                  draggedEquipment?.id === eq.id || touchDragEquipment?.id === eq.id
                    ? "opacity-50"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">
                      {eq.name}
                    </h4>
                    {eq.description && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {eq.description}
                      </p>
                    )}
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
            ))}
            {unassignedEquipments.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">
                모든 장비가 배정되었습니다
              </p>
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
      </main>

      {/* 관리자 선택 모달 */}

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

      {/* 터치 드래그 고스트 요소 */}
      {touchDragEquipment && touchDragPosition && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: touchDragPosition.x,
            top: touchDragPosition.y,
            transform: "translate(-50%, -50%)",
          }}
        >
          <span className="inline-block px-2.5 py-1.5 bg-team-500 text-white rounded-md text-xs font-medium shadow-lg opacity-80">
            {touchDragEquipment.name}
          </span>
        </div>
      )}
    </div>
  );
}
