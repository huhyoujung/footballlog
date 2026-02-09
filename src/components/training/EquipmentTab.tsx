"use client";

import { useState, useEffect } from "react";

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
  owner: User | null;
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
  const [equipments, setEquipments] = useState<EquipmentWithAssignment[]>([]);
  const [equipmentAssignments, setEquipmentAssignments] = useState<Record<string, { userId: string | null; memo: string }>>({});
  const [savingEquipment, setSavingEquipment] = useState(false);
  const [touchDragEquipment, setTouchDragEquipment] = useState<{ equipmentId: string; name: string } | null>(null);
  const [touchDragEquipmentPosition, setTouchDragEquipmentPosition] = useState<{ x: number; y: number } | null>(null);
  const [equipmentDropTarget, setEquipmentDropTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchEquipments();
  }, [eventId]);

  const fetchEquipments = async () => {
    try {
      const [equipRes, teamRes] = await Promise.all([
        fetch(`/api/training-events/${eventId}/equipment`),
        fetch(`/api/teams/equipment`),
      ]);

      if (equipRes.ok && teamRes.ok) {
        const data = await equipRes.json();
        const teamEquip = await teamRes.json();

        setEquipments(teamEquip);

        const assignments: Record<string, { userId: string | null; memo: string }> = {};
        teamEquip.forEach((eq: EquipmentWithAssignment) => {
          const eventAssignment = data.find((d: any) => d.id === eq.id)?.assignment;
          assignments[eq.id] = {
            userId: eventAssignment?.userId || null,
            memo: eventAssignment?.memo || "",
          };
        });
        setEquipmentAssignments(assignments);
      }
    } catch {
      // ignore
    }
  };

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
        alert("저장되었습니다");
        fetchEquipments();
      } else {
        alert("저장에 실패했습니다");
      }
    } catch {
      alert("저장에 실패했습니다");
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

  // 모든 관련 사용자 수집
  const allRelatedUsers = [
    ...equipments.filter(eq => eq.owner).map(eq => eq.owner!),
    ...equipments.filter(eq => eq.assignment?.user).map(eq => eq.assignment!.user!)
  ];

  // 중복 제거
  const relevantMembers = Array.from(
    new Map(allRelatedUsers.map(user => [user.id, user])).values()
  );

  if (equipments.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500 mb-2">등록된 장비가 없습니다</p>
        <p className="text-xs text-gray-400">
          팀 설정에서 장비를 먼저 추가해주세요
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 미배정 장비 */}
      <div className="bg-white rounded-xl p-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <span>미배정 장비</span>
          <span className="text-xs text-gray-400 font-normal">
            ({equipments.filter((eq) => !equipmentAssignments[eq.id]?.userId).length}개)
          </span>
        </h3>
        <div
          className="min-h-[100px] border-2 border-dashed border-gray-200 rounded-lg p-3 space-y-2"
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
            <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <span>{manager.name || "익명"}</span>
              {(manager.position || manager.number) && (
                <span className="text-xs text-gray-400 font-normal">
                  {manager.position || ""} {manager.number ? `#${manager.number}` : ""}
                </span>
              )}
              <span className="text-xs text-gray-400 font-normal ml-auto">
                ({assignedEquipments.length}개)
              </span>
            </h3>
            <div
              className={`min-h-[80px] border-2 border-dashed rounded-lg p-3 space-y-2 ${
                equipmentDropTarget === manager.id ? 'border-team-500 bg-team-50' : 'border-gray-200'
              }`}
              onDragOver={handleEquipmentDragOver}
              onDrop={(e) => handleEquipmentDrop(e, manager.id)}
              data-equipment-drop-target
              data-user-id={manager.id}
            >
              {assignedEquipments.map((eq) => {
                const assignment = equipmentAssignments[eq.id];
                return (
                  <div key={eq.id} className="space-y-2">
                    <div
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
                    {/* 메모 입력 */}
                    <input
                      type="text"
                      value={assignment?.memo || ""}
                      onChange={(e) =>
                        setEquipmentAssignments((prev) => ({
                          ...prev,
                          [eq.id]: { ...prev[eq.id], memo: e.target.value },
                        }))
                      }
                      placeholder="메모 (예: 공 2개, 펌프 포함)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-team-500 focus:border-transparent"
                    />
                  </div>
                );
              })}
              {assignedEquipments.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">
                  장비를 드래그하여 배정하세요
                </p>
              )}
            </div>
          </div>
        );
      })}

      <div className="flex gap-3">
        <button
          onClick={() => fetchEquipments()}
          className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50"
        >
          취소
        </button>
        <button
          onClick={saveEquipmentAssignments}
          disabled={savingEquipment}
          className="flex-1 py-2.5 bg-team-500 text-white rounded-lg font-medium hover:bg-team-600 disabled:opacity-50"
        >
          {savingEquipment ? "저장 중..." : "저장"}
        </button>
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
    </>
  );
}
