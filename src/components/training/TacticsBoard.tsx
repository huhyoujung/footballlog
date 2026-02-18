// 풋살 작전판 (라이트) - 포메이션 선택 + 선수 위치 배치
"use client";

import React, { useState } from "react";
import {
  FUTSAL_FORMATIONS,
  FORMATION_KEYS,
  type FormationKey,
  type FormationSlot,
  type PositionsMap,
} from "@/lib/formations";
import { getPositionGroup } from "@/lib/position";

interface Player {
  userId: string;
  name: string | null;
  position: string | null;
}

interface Props {
  mode: "edit" | "readonly";
  formation: FormationKey | null;
  positions: PositionsMap | null;
  players: Player[]; // 팀에 배정된 선수 목록
  onFormationChange?: (formation: FormationKey) => void;
  onPositionsChange?: (positions: PositionsMap) => void;
}

export default function TacticsBoard({
  mode,
  formation,
  positions,
  players,
  onFormationChange,
  onPositionsChange,
}: Props) {
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);

  const currentFormation = formation ? FUTSAL_FORMATIONS[formation] : null;
  const currentPositions = positions || {};

  // 슬롯에 배정된 선수 찾기
  const getPlayerForSlot = (slotIndex: number): Player | null => {
    const slot = currentFormation?.slots[slotIndex];
    if (!slot) return null;
    const entry = Object.entries(currentPositions).find(
      ([, pos]) =>
        Math.abs(pos.x - slot.x) < 0.01 &&
        Math.abs(pos.y - slot.y) < 0.01
    );
    if (!entry) return null;
    return players.find((p) => p.userId === entry[0]) || null;
  };

  // 배정되지 않은 선수 목록
  const assignedUserIds = new Set(Object.keys(currentPositions));
  const unassignedPlayers = players.filter((p) => !assignedUserIds.has(p.userId));

  // 슬롯에 선수 배정
  const assignPlayer = (slotIndex: number, player: Player) => {
    if (!currentFormation || !onPositionsChange) return;
    const slot = currentFormation.slots[slotIndex];
    const newPositions = { ...currentPositions };

    // 해당 슬롯에 이미 있는 선수 제거
    const existingEntry = Object.entries(newPositions).find(
      ([, pos]) =>
        Math.abs(pos.x - slot.x) < 0.01 &&
        Math.abs(pos.y - slot.y) < 0.01
    );
    if (existingEntry) delete newPositions[existingEntry[0]];

    // 이 선수가 다른 슬롯에 있으면 제거
    delete newPositions[player.userId];

    // 새 위치에 배정
    newPositions[player.userId] = { x: slot.x, y: slot.y, role: slot.role };
    onPositionsChange(newPositions);
    setSelectedSlotIndex(null);
  };

  // 슬롯에서 선수 해제
  const unassignPlayer = (userId: string) => {
    if (!onPositionsChange) return;
    const newPositions = { ...currentPositions };
    delete newPositions[userId];
    onPositionsChange(newPositions);
  };

  // 포메이션 변경 시 기존 배정 유지하되 좌표만 업데이트
  const handleFormationChange = (key: FormationKey) => {
    if (!onFormationChange || !onPositionsChange) return;
    onFormationChange(key);

    const newFormation = FUTSAL_FORMATIONS[key];
    const newPositions: PositionsMap = {};
    const assignedIds = Object.keys(currentPositions);

    // 기존 배정된 선수를 새 포메이션 슬롯에 순서대로 매핑
    newFormation.slots.forEach((slot, i) => {
      if (i < assignedIds.length) {
        newPositions[assignedIds[i]] = { x: slot.x, y: slot.y, role: slot.role };
      }
    });
    onPositionsChange(newPositions);
  };

  if (!currentFormation && mode === "readonly") return null;

  return (
    <div className="space-y-3">
      {/* 포메이션 선택 */}
      {mode === "edit" && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2">포메이션</label>
          <div className="grid grid-cols-3 gap-2">
            {FORMATION_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleFormationChange(key)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  formation === key
                    ? "bg-team-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 피치 뷰 */}
      {currentFormation && (
        <div className="relative w-full aspect-[3/4] bg-green-600 rounded-xl overflow-hidden">
          {/* 피치 라인 */}
          <svg
            viewBox="0 0 300 400"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* 외곽선 */}
            <rect x="10" y="10" width="280" height="380" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
            {/* 중앙선 */}
            <line x1="10" y1="200" x2="290" y2="200" stroke="white" strokeWidth="2" opacity="0.5" />
            {/* 중앙 원 */}
            <circle cx="150" cy="200" r="40" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
            <circle cx="150" cy="200" r="3" fill="white" opacity="0.5" />
            {/* 상단 페널티 박스 */}
            <rect x="75" y="10" width="150" height="60" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
            <rect x="110" y="10" width="80" height="25" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
            {/* 하단 페널티 박스 */}
            <rect x="75" y="330" width="150" height="60" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
            <rect x="110" y="365" width="80" height="25" fill="none" stroke="white" strokeWidth="2" opacity="0.5" />
          </svg>

          {/* 선수 슬롯 */}
          {currentFormation.slots.map((slot, i) => {
            const player = getPlayerForSlot(i);
            const isSelected = selectedSlotIndex === i;

            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  if (mode !== "edit") return;
                  if (player) {
                    unassignPlayer(player.userId);
                  } else {
                    setSelectedSlotIndex(isSelected ? null : i);
                  }
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
                style={{
                  left: `${slot.x * 100}%`,
                  top: `${slot.y * 100}%`,
                }}
              >
                {/* 원형 마커 */}
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shadow-md transition-all ${
                    player
                      ? "bg-white text-team-700 border-2 border-team-400"
                      : isSelected
                      ? "bg-yellow-300 text-yellow-900 border-2 border-yellow-500 scale-110"
                      : "bg-white/30 text-white border-2 border-white/60"
                  }`}
                >
                  {player
                    ? (player.name?.[0] || "?")
                    : slot.label}
                </div>
                {/* 이름 라벨 */}
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded whitespace-nowrap ${
                    player
                      ? "bg-black/60 text-white"
                      : "bg-black/30 text-white/80"
                  }`}
                >
                  {player ? (player.name || "이름 없음") : slot.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* 선수 선택 패널 (편집 모드 + 슬롯 선택 시) */}
      {mode === "edit" && selectedSlotIndex !== null && currentFormation && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">
              {currentFormation.slots[selectedSlotIndex].label} 포지션에 배정할 선수
            </span>
            <button
              type="button"
              onClick={() => setSelectedSlotIndex(null)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              닫기
            </button>
          </div>
          {unassignedPlayers.length === 0 ? (
            <p className="text-xs text-gray-400">모든 선수가 배정되었습니다</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {unassignedPlayers.map((p) => (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => assignPlayer(selectedSlotIndex, p)}
                  className="px-2.5 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-md text-xs font-medium hover:bg-team-50 hover:border-team-200 transition-colors"
                >
                  {p.name || "이름 없음"}
                  {p.position && (
                    <span className="ml-1 text-[10px] text-gray-400">
                      {getPositionGroup(p.position)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 배정된 선수 요약 (읽기 모드) */}
      {mode === "readonly" && currentFormation && (
        <div className="text-xs text-gray-500 text-center">
          {formation} 포메이션 · {Object.keys(currentPositions).length}/{currentFormation.slots.length}명 배정
        </div>
      )}
    </div>
  );
}
