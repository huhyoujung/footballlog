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

interface Manager {
  id: string;
  name: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
}

interface Equipment {
  id: string;
  name: string;
  description: string | null;
  orderIndex: number;
  ownerId: string | null;
  managers: Manager[];
}

type Tab = "equipment" | "manager";

export default function TeamEquipmentPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { teamData } = useTeam();
  const [activeTab, setActiveTab] = useState<Tab>("equipment");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  // 장비 관리자 목록 (Equipment의 managers 필드에서 수집)
  const managerSet = new Set<string>();
  equipments.forEach((eq) => {
    eq.managers?.forEach((m) => managerSet.add(m.id));
  });
  const managers = managerSet;

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

  // 관리자 추가/제거
  const handleToggleManager = async (memberId: string) => {
    const isManager = managers.has(memberId);

    try {
      const res = await fetch("/api/teams/equipment-managers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: memberId,
          isManager: !isManager,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "관리자 설정에 실패했습니다");
        return;
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
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href="/my/team-admin" />
          <h1 className="text-base font-semibold text-gray-900">장비 관리</h1>
          <div className="w-6" />
        </div>
      </header>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto flex">
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

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* 장비 탭 */}
        {activeTab === "equipment" && (
          <>
            <div className="bg-white">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 px-1">팀 장비 목록</h3>
              <div className="divide-y divide-gray-100">
                {equipments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-12">
                    등록된 장비가 없습니다
                  </p>
                ) : (
                  equipments.map((eq) => (
                    <div
                      key={eq.id}
                      className="py-3 px-1"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-900">{eq.name}</h4>
                          {eq.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{eq.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setSelectedEquipment(eq);
                            setShowDeleteConfirm(true);
                          }}
                          className="text-xs text-red-500 hover:text-red-600 flex-shrink-0"
                        >
                          삭제
                        </button>
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
              className="w-full py-3 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-team-400 hover:text-team-600 transition-colors"
            >
              + 장비 추가
            </button>
          </>
        )}

        {/* 관리자 탭 */}
        {activeTab === "manager" && (
          <div className="bg-white">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 px-1">장비 관리자 설정</h3>
            <p className="text-xs text-gray-500 mb-3 px-1">
              팀 운동에서 장비를 배정받을 수 있는 관리자입니다
            </p>
            <div className="divide-y divide-gray-100">
              {teamData?.members.map((member) => {
                const isManager = managers.has(member.id);
                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 py-3 px-1"
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
                        {(member.position || member.number) && (
                          <span className="text-xs text-gray-400">
                            {member.position || ""} {member.number ? `#${member.number}` : ""}
                          </span>
                        )}
                      </div>
                      {isManager && (
                        <span className="text-xs text-team-600 mt-0.5 block">
                          장비 관리자
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => handleToggleManager(member.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0 ${
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
