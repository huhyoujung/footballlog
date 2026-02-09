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

type Tab = "equipment" | "manager";

export default function TeamEquipmentPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { teamData } = useTeam();
  const [activeTab, setActiveTab] = useState<Tab>("equipment");
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [managers, setManagers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
        // 장비 관리자 목록 추출
        const managerIds = new Set<string>(data.filter((eq: Equipment) => eq.ownerId).map((eq: Equipment) => eq.ownerId!));
        setManagers(managerIds);
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


  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <BackButton href="/my" />
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
              <p className="text-xs text-gray-400 mb-3">장비는 모든 페이지에서 동일하게 보입니다</p>
              <div className="space-y-2">
                {equipments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">
                    등록된 장비가 없습니다
                  </p>
                ) : (
                  equipments.map((eq) => (
                    <div
                      key={eq.id}
                      className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-medium text-gray-900">{eq.name}</h4>
                          {eq.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{eq.description}</p>
                          )}
                          {eq.owner && (
                            <p className="text-xs text-team-600 mt-1">
                              담당: {eq.owner.name || "익명"}
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
            <h3 className="text-sm font-semibold text-gray-900 mb-3">장비 관리자</h3>
            <p className="text-xs text-gray-500 mb-3">
              팀 운동에서 장비를 배정받을 수 있는 관리자 목록입니다
            </p>
            <div className="space-y-2">
              {managers.size === 0 ? (
                <p className="text-xs text-gray-400 text-center py-8">
                  장비에 담당자를 지정하면 자동으로 관리자로 등록됩니다
                </p>
              ) : (
                teamData?.members
                  .filter((member) => managers.has(member.id))
                  .map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-gray-50"
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
                        <span className="text-xs text-team-600 mt-0.5 block">
                          장비 {equipments.filter((eq) => eq.ownerId === member.id).length}개 담당
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        )}
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
