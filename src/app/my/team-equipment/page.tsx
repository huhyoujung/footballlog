"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import LoadingSpinner from "@/components/LoadingSpinner";
import Link from "next/link";

interface Equipment {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
}

export default function TeamEquipmentPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

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

      setShowAddModal(false);
      setName("");
      setDescription("");
      fetchEquipments();
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
        body: JSON.stringify({ name, description }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "수정에 실패했습니다");
        return;
      }

      setShowEditModal(false);
      setSelectedEquipment(null);
      setName("");
      setDescription("");
      fetchEquipments();
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

      setShowDeleteConfirm(false);
      setSelectedEquipment(null);
      fetchEquipments();
    } catch {
      alert("삭제에 실패했습니다");
    }
  };

  const handleDragStart = (id: string) => {
    setDraggedId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const draggedIndex = equipments.findIndex((eq) => eq.id === draggedId);
    const targetIndex = equipments.findIndex((eq) => eq.id === targetId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedId(null);
      return;
    }

    // 순서 재배치 (로컬)
    const newEquipments = [...equipments];
    const [removed] = newEquipments.splice(draggedIndex, 1);
    newEquipments.splice(targetIndex, 0, removed);
    setEquipments(newEquipments);

    // API 호출
    try {
      const equipmentIds = newEquipments.map((eq) => eq.id);
      await fetch("/api/teams/equipment/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ equipmentIds }),
      });
    } catch {
      // 실패 시 원복
      fetchEquipments();
    }

    setDraggedId(null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/my" className="text-gray-500 hover:text-gray-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">장비 관리</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        <p className="text-xs text-gray-500">우리 팀 장비 {equipments.length}개</p>

        <div className="space-y-2">
          {equipments.map((eq, idx) => (
            <div
              key={eq.id}
              draggable
              onDragStart={() => handleDragStart(eq.id)}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(eq.id)}
              className={`bg-white border border-gray-200 rounded-lg p-4 flex items-start gap-3 cursor-grab active:cursor-grabbing ${
                draggedId === eq.id ? "opacity-50" : ""
              }`}
            >
              {/* 드래그 핸들 */}
              <div className="flex flex-col gap-0.5 mt-1">
                <div className="w-1 h-1 bg-gray-300 rounded-full" />
                <div className="w-1 h-1 bg-gray-300 rounded-full" />
                <div className="w-1 h-1 bg-gray-300 rounded-full" />
              </div>

              {/* 내용 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 font-medium">{idx + 1}.</span>
                  <h3 className="text-sm font-semibold text-gray-900">{eq.name}</h3>
                </div>
                {eq.description && (
                  <p className="text-xs text-gray-500 mt-1">{eq.description}</p>
                )}
              </div>

              {/* 메뉴 */}
              <div className="flex gap-2 flex-shrink-0">
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
          ))}
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
                  placeholder="예: 조끼 10벌"
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
                  placeholder="예: 빨강 5벌, 파랑 5벌"
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
