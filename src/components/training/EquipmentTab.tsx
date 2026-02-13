"use client";

import { useState } from "react";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/lib/useToast";
import Toast from "@/components/Toast";
import useSWR from "swr";

interface User {
  id: string;
  name: string | null;
  image: string | null;
  position?: string | null;
  number?: number | null;
}

interface EquipmentWithAssignment {
  id: string;
  name: string;
  description: string | null;
  managers: User[];
  assignment: {
    id: string;
    userId: string | null;
    memo: string | null;
    user: User | null;
  } | null;
}

interface Props {
  eventId: string;
}

export default function EquipmentTab({ eventId }: Props) {
  const { toast, showToast, hideToast } = useToast();
  const [equipmentAssignments, setEquipmentAssignments] = useState<Record<string, { userId: string | null; memo: string }>>({});
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [touchDragEquipment, setTouchDragEquipment] = useState<{ equipmentId: string; name: string } | null>(null);
  const [touchDragEquipmentPosition, setTouchDragEquipmentPosition] = useState<{ x: number; y: number } | null>(null);
  const [equipmentDropTarget, setEquipmentDropTarget] = useState<string | null>(null);

  // SWR로 이벤트별 장비 배정 페칭 (캐싱)
  const { data: equipments, isLoading: loading, error, mutate } = useSWR<EquipmentWithAssignment[]>(
    eventId ? `/api/training-events/${eventId}/equipment` : null,
    fetcher,
    {
      revalidateOnFocus: false, // 탭 전환 시 재검증 방지 (성능 개선)
      revalidateIfStale: false,
      dedupingInterval: 300000, // 5분 캐시
      keepPreviousData: true,
      onSuccess: (data) => {
        // 초기 배정 상태 설정
        const assignments: Record<string, { userId: string | null; memo: string }> = {};
        data.forEach((eq) => {
          assignments[eq.id] = {
            userId: eq.assignment?.userId || null,
            memo: eq.assignment?.memo || "",
          };
        });
        setEquipmentAssignments(assignments);
      },
    }
  );

  const saveEquipmentAssignments = async () => {
    setSavingEquipment(true);
    try {
      const assignments = Object.entries(equipmentAssignments).map(([equipmentId, { userId, memo }]) => ({
        equipmentId,
        userId,
        memo: memo.trim() || undefined,
      }));

      const res = await fetch(`/api/training-events/${eventId}/equipment`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });

      if (res.ok) {
        showToast("저장되었습니다 ✓");
        mutate(); // SWR 캐시 갱신
      } else {
        showToast("저장에 실패했습니다");
      }
    } catch {
      showToast("저장에 실패했습니다");
    } finally {
      setSavingEquipment(false);
    }
  };

  // 장비 드래그 핸들러
  const handleEquipmentDragStart = (e: React.DragEvent, equipmentId: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("equipmentId", equipmentId);
  };

  const handleEquipmentDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleEquipmentDrop = (e: React.DragEvent, targetUserId: string | null) => {
    e.preventDefault();
    const equipmentId = e.dataTransfer.getData("equipmentId");
    if (!equipmentId) return;

    setEquipmentAssignments((prev) => ({
      ...prev,
      [equipmentId]: {
        ...prev[equipmentId],
        userId: targetUserId,
      },
    }));
  };

  // 장비 터치 드래그 핸들러
  const handleEquipmentTouchStart = (equipmentId: string, name: string) => {
    setTouchDragEquipment({ equipmentId, name });
    setEquipmentDropTarget(null);
  };

  const handleEquipmentTouchMove = (e: React.TouchEvent) => {
    if (!touchDragEquipment) return;
    e.preventDefault();

    const touch = e.touches[0];
    setTouchDragEquipmentPosition({ x: touch.clientX, y: touch.clientY });

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    const dropZone = element.closest('[data-equipment-drop-target]');
    if (dropZone) {
      const userId = dropZone.getAttribute('data-user-id');
      setEquipmentDropTarget(userId);
    } else {
      setEquipmentDropTarget(null);
    }
  };

  const handleEquipmentTouchEnd = () => {
    if (touchDragEquipment && equipmentDropTarget) {
      setEquipmentAssignments((prev) => ({
        ...prev,
        [touchDragEquipment.equipmentId]: {
          ...prev[touchDragEquipment.equipmentId],
          userId: equipmentDropTarget,
        },
      }));
    }

    setTouchDragEquipment(null);
    setTouchDragEquipmentPosition(null);
    setEquipmentDropTarget(null);
  };

  if (error) {
    return (
      <div className="bg-white rounded-xl p-6 text-center">
        <p className="text-sm text-red-500 mb-2">장비 정보를 불러오지 못했습니다</p>
        <p className="text-xs text-gray-400 mb-3">{error.message || "알 수 없는 오류"}</p>
        <button
          onClick={() => mutate()}
          className="text-sm text-team-600 hover:text-team-700 font-medium"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (loading || !equipments) {
    return (
      <div className="bg-white rounded-xl p-6 text-center">
        <div className="animate-spin inline-block w-6 h-6 border-2 border-team-500 border-t-transparent rounded-full"></div>
        <p className="text-sm text-gray-500 mt-3">로딩 중...</p>
      </div>
    );
  }

  if (!equipments || equipments.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500 mb-2">등록된 장비가 없습니다</p>
        <p className="text-xs text-gray-400">
          팀 설정에서 장비를 먼저 추가해주세요
        </p>
      </div>
    );
  }

  // 장비 관리자만 수집 (managers 필드만 사용)
  const allManagers = equipments.flatMap(eq => eq.managers || []);

  // 중복 제거
  const relevantMembers = Array.from(
    new Map(allManagers.map(user => [user.id, user])).values()
  );

  return (
    <>
      {/* 미배정 장비 */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">
          <span>미배정 장비</span>
          <span className="text-xs text-gray-400 font-normal">
            ({equipments.filter((eq) => !equipmentAssignments[eq.id]?.userId).length}개)
          </span>
        </h3>
        <div
          className="border-2 border-dashed border-gray-200 rounded-lg p-3 space-y-2 transition-all min-h-[60px]"
          onDragOver={handleEquipmentDragOver}
          onDrop={(e) => handleEquipmentDrop(e, null)}
          data-equipment-drop-target
          data-user-id={null}
        >
          {equipments
            .filter((eq) => !equipmentAssignments[eq.id]?.userId)
            .map((eq) => (
              <div
                key={eq.id}
                draggable
                onDragStart={(e) => handleEquipmentDragStart(e, eq.id)}
                onTouchStart={() => handleEquipmentTouchStart(eq.id, eq.name)}
                onTouchMove={handleEquipmentTouchMove}
                onTouchEnd={handleEquipmentTouchEnd}
                className={`bg-gray-50 border border-gray-200 rounded-lg p-3 cursor-move hover:bg-gray-100 transition-colors touch-none ${
                  touchDragEquipment?.equipmentId === eq.id ? 'opacity-50' : ''
                }`}
              >
                <div className="font-medium text-sm text-gray-900">{eq.name}</div>
                {eq.description && (
                  <div className="text-xs text-gray-500 mt-1">{eq.description}</div>
                )}
              </div>
            ))}
          {equipments.filter((eq) => !equipmentAssignments[eq.id]?.userId).length === 0 && (
            <p className="text-xs text-gray-400 text-center py-8">
              모든 장비가 배정되었습니다
            </p>
          )}
        </div>
      </div>

      {/* 장비 관리자별 배정 */}
      {relevantMembers.map((manager) => {
        const assignedEquipments = equipments.filter(
          (eq) => equipmentAssignments[eq.id]?.userId === manager.id
        );

        return (
          <div key={manager.id} className="bg-white rounded-xl p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-1">
              <span>{manager.name || "익명"}</span>
              {(manager.position || manager.number) && (
                <span className="text-xs text-gray-400 font-normal ml-1">
                  {manager.position || ""} {manager.number ? `#${manager.number}` : ""}
                </span>
              )}
            </h3>
            <div
              className={`border-2 border-dashed rounded-lg p-3 space-y-2 transition-all min-h-[60px] ${
                equipmentDropTarget === manager.id ? 'border-team-500 bg-team-50' : 'border-gray-200'
              }`}
              onDragOver={handleEquipmentDragOver}
              onDrop={(e) => handleEquipmentDrop(e, manager.id)}
              data-equipment-drop-target
              data-user-id={manager.id}
            >
              {assignedEquipments.map((eq) => (
                <div
                  key={eq.id}
                  draggable
                  onDragStart={(e) => handleEquipmentDragStart(e, eq.id)}
                  onTouchStart={() => handleEquipmentTouchStart(eq.id, eq.name)}
                  onTouchMove={handleEquipmentTouchMove}
                  onTouchEnd={handleEquipmentTouchEnd}
                  className={`bg-team-50 border border-team-200 rounded-lg p-3 cursor-move hover:bg-team-100 transition-colors touch-none ${
                    touchDragEquipment?.equipmentId === eq.id ? 'opacity-50' : ''
                  }`}
                >
                  <div className="font-medium text-sm text-gray-900">{eq.name}</div>
                  {eq.description && (
                    <div className="text-xs text-gray-500 mt-1">{eq.description}</div>
                  )}
                </div>
              ))}
              {assignedEquipments.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">
                  장비를 드래그하여 배정하세요
                </p>
              )}
            </div>
          </div>
        );
      })}

      {/* 저장 버튼 */}
      <div className="bg-white rounded-xl p-4">
        <button
          onClick={saveEquipmentAssignments}
          disabled={savingEquipment}
          className="w-full py-3 bg-team-500 text-white rounded-lg text-sm font-semibold hover:bg-team-600 disabled:opacity-50 transition-colors"
        >
          {savingEquipment ? "저장 중..." : "장비 배정 저장"}
        </button>
        <p className="text-xs text-gray-500 text-center mt-3">
          이 페이지에서 편집한 장비 배정은 다른 운동에도 동일하게 적용됩니다
        </p>
      </div>

      {/* 장비 터치 드래그 고스트 요소 */}
      {touchDragEquipment && touchDragEquipmentPosition && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: touchDragEquipmentPosition.x,
            top: touchDragEquipmentPosition.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <span className="inline-block px-3 py-2 bg-team-600 text-white rounded-md text-xs font-medium shadow-lg opacity-80">
            {touchDragEquipment.name}
          </span>
        </div>
      )}

      {/* Toast */}
      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </>
  );
}
