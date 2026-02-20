// 작전판 - 자유 배치 (포메이션 프리셋 없음)
"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { getPositionGroup } from "@/lib/position";

interface Player {
  userId: string;
  name: string | null;
  position: string | null;
}

export interface FreePositionsMap {
  [userId: string]: { x: number; y: number };
}

interface Props {
  mode: "edit" | "readonly";
  positions: FreePositionsMap | null;
  players: Player[]; // 참석자 전체
  onPositionsChange?: (positions: FreePositionsMap) => void;
}

export default function TacticsBoard({
  mode,
  positions,
  players,
  onPositionsChange,
}: Props) {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [draggingUserId, setDraggingUserId] = useState<string | null>(null);
  const pitchRef = useRef<HTMLDivElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);

  // 드래그 상태를 ref로 관리 (리렌더 방지)
  const dragRef = useRef<{
    userId: string;
    source: "pool" | "pitch";
    name: string;
    active: boolean; // pointerMove가 발생했는지 (탭 vs 드래그 구분)
  } | null>(null);
  // 최신 positions를 ref로도 유지 (effect 클로저 문제 방지)
  const positionsRef = useRef(positions);
  positionsRef.current = positions;

  const currentPositions = positions || {};

  // 미배정 선수
  const assignedUserIds = new Set(Object.keys(currentPositions));
  const unassignedPlayers = players.filter((p) => !assignedUserIds.has(p.userId));

  // 피치 내 좌표 계산 (0~1 정규화)
  const getRelativePosition = useCallback((clientX: number, clientY: number) => {
    if (!pitchRef.current) return null;
    const rect = pitchRef.current.getBoundingClientRect();
    const x = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width));
    const y = Math.max(0.05, Math.min(0.95, (clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  // 피치 위에 있는지 확인
  const isOverPitch = useCallback((clientX: number, clientY: number) => {
    if (!pitchRef.current) return false;
    const rect = pitchRef.current.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }, []);

  // 고스트 표시/숨김
  const showGhost = useCallback((x: number, y: number, name: string) => {
    if (!ghostRef.current) return;
    ghostRef.current.style.display = "flex";
    ghostRef.current.style.left = `${x}px`;
    ghostRef.current.style.top = `${y}px`;
    ghostRef.current.textContent = name;
  }, []);

  const hideGhost = useCallback(() => {
    if (!ghostRef.current) return;
    ghostRef.current.style.display = "none";
  }, []);

  // 피치 하이라이트
  const setPitchHighlight = useCallback((on: boolean) => {
    if (!pitchRef.current) return;
    if (on) {
      pitchRef.current.classList.add("ring-2", "ring-white/60");
    } else {
      pitchRef.current.classList.remove("ring-2", "ring-white/60");
    }
  }, []);

  // 포인터 이동 & 끝 핸들러 (window에 등록, deps 최소화)
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      drag.active = true;
      e.preventDefault();
      showGhost(e.clientX, e.clientY, drag.name);
      setPitchHighlight(isOverPitch(e.clientX, e.clientY));
    };

    const handlePointerUp = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      hideGhost();
      setPitchHighlight(false);
      dragRef.current = null;
      setDraggingUserId(null);

      // 드래그가 아닌 탭이었으면 무시 (탭 핸들러에서 처리)
      if (!drag.active) return;

      const cur = positionsRef.current || {};
      if (isOverPitch(e.clientX, e.clientY) && onPositionsChange) {
        const pos = getRelativePosition(e.clientX, e.clientY);
        if (pos) {
          onPositionsChange({ ...cur, [drag.userId]: pos });
        }
      } else if (drag.source === "pitch" && onPositionsChange) {
        // 피치 밖으로 드래그 → 미배정으로
        const newPositions = { ...cur };
        delete newPositions[drag.userId];
        onPositionsChange(newPositions);
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [onPositionsChange, getRelativePosition, isOverPitch, showGhost, hideGhost, setPitchHighlight]);

  // 미배정 선수 포인터 다운
  const handleUnassignedPointerDown = (e: React.PointerEvent, player: Player) => {
    if (mode !== "edit") return;
    e.preventDefault();
    dragRef.current = {
      userId: player.userId,
      source: "pool",
      name: player.name || "?",
      active: false,
    };
  };

  // 미배정 선수 탭 (드래그 안 한 경우)
  const handleUnassignedClick = (userId: string) => {
    if (mode !== "edit") return;
    // dragRef.active가 true면 드래그 후 click이므로 무시
    setSelectedPlayer(selectedPlayer === userId ? null : userId);
  };

  // 피치 탭 → 선택된 선수를 해당 위치에 배치
  const handlePitchClick = (e: React.MouseEvent) => {
    if (mode !== "edit" || !selectedPlayer || !onPositionsChange) return;
    const pos = getRelativePosition(e.clientX, e.clientY);
    if (!pos) return;

    onPositionsChange({ ...currentPositions, [selectedPlayer]: pos });
    setSelectedPlayer(null);
  };

  // 배치된 선수 포인터 다운
  const handlePlacedPointerDown = (e: React.PointerEvent, player: Player) => {
    if (mode !== "edit") return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      userId: player.userId,
      source: "pitch",
      name: player.name || "?",
      active: false,
    };
    setDraggingUserId(player.userId);
  };

  // 배치된 선수 탭 → 제거 (미배정으로)
  const handlePlacedClick = (e: React.MouseEvent, userId: string) => {
    if (mode !== "edit" || !onPositionsChange) return;
    e.stopPropagation();
    // 드래그 후 click이면 무시
    if (dragRef.current?.active) return;
    const newPositions = { ...currentPositions };
    delete newPositions[userId];
    onPositionsChange(newPositions);
  };

  const placedCount = Object.keys(currentPositions).length;

  if (mode === "readonly" && placedCount === 0) return null;

  return (
    <div className="space-y-3">
      {/* 드래그 고스트 (DOM 직접 조작으로 리렌더 없이 이동) */}
      <div
        ref={ghostRef}
        className="fixed z-50 pointer-events-none items-center justify-center min-w-[36px] h-9 rounded-full px-2.5 text-[11px] font-bold shadow-lg bg-white text-team-700 border-2 border-team-500 whitespace-nowrap opacity-90 -translate-x-1/2 -translate-y-1/2"
        style={{ display: "none" }}
      />

      {/* 미배정 선수 풀 (편집 모드) */}
      {mode === "edit" && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-gray-700">
              미배정 ({unassignedPlayers.length}명)
            </span>
            {selectedPlayer && (
              <span className="text-[11px] text-team-500 font-medium animate-pulse">
                피치를 탭하여 배치하세요
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5 min-h-[36px] border border-dashed border-gray-300 rounded-lg p-2.5">
            {unassignedPlayers.length === 0 ? (
              <span className="text-xs text-gray-400">모든 선수가 배치되었습니다</span>
            ) : (
              unassignedPlayers.map((p) => (
                <button
                  key={p.userId}
                  type="button"
                  onClick={() => handleUnassignedClick(p.userId)}
                  onPointerDown={(e) => handleUnassignedPointerDown(e, p)}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all select-none touch-none ${
                    selectedPlayer === p.userId
                      ? "bg-team-500 text-white ring-2 ring-team-300 scale-105"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200 cursor-grab active:cursor-grabbing"
                  }`}
                >
                  {p.name || "이름 없음"}
                  {p.position && (
                    <span className={`ml-1 text-[10px] ${selectedPlayer === p.userId ? "text-white/70" : "text-gray-400"}`}>
                      {getPositionGroup(p.position)}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* 피치 뷰 */}
      <div
        ref={pitchRef}
        className={`relative w-full aspect-[3/5] rounded-xl overflow-hidden transition-shadow ${
          mode === "edit" && selectedPlayer ? "ring-2 ring-team-300 cursor-crosshair" : ""
        }`}
        onClick={handlePitchClick}
      >
        {/* 피치 + 대기석 배경 */}
        <svg
          viewBox="0 0 300 500"
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* 필드 영역 */}
          <rect x="0" y="0" width="300" height="420" fill="currentColor" className="text-team-500" />
          {/* 대기석 영역 */}
          <rect x="0" y="420" width="300" height="80" fill="currentColor" className="text-team-700" />
          <line x1="0" y1="420" x2="300" y2="420" stroke="white" strokeWidth="1.5" opacity="0.3" strokeDasharray="6 4" />
          <text x="150" y="438" textAnchor="middle" fill="white" opacity="0.3" fontSize="10" fontWeight="500">교체 대기</text>

          {/* 피치 라인 */}
          <rect x="10" y="10" width="280" height="400" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
          <line x1="10" y1="210" x2="290" y2="210" stroke="white" strokeWidth="2" opacity="0.4" />
          <circle cx="150" cy="210" r="40" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
          <circle cx="150" cy="210" r="3" fill="white" opacity="0.4" />
          {/* 상단 페널티/골 에어리어 */}
          <rect x="75" y="10" width="150" height="65" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
          <rect x="110" y="10" width="80" height="25" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
          {/* 하단 페널티/골 에어리어 */}
          <rect x="75" y="345" width="150" height="65" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
          <rect x="110" y="385" width="80" height="25" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
          {/* 코너킥 아크 (안쪽으로 볼록) */}
          <path d="M20,10 A10,10 0 0,1 10,20" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
          <path d="M280,10 A10,10 0 0,0 290,20" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
          <path d="M10,400 A10,10 0 0,1 20,410" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
          <path d="M290,400 A10,10 0 0,0 280,410" fill="none" stroke="white" strokeWidth="2" opacity="0.4" />
        </svg>

        {/* 배치된 선수 마커 */}
        {Object.entries(currentPositions).map(([userId, pos]) => {
          const player = players.find((p) => p.userId === userId);
          if (!player) return null;

          return (
            <div
              key={userId}
              className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5 touch-none ${
                mode === "edit" ? "cursor-grab active:cursor-grabbing" : ""
              } ${draggingUserId === userId ? "opacity-30 scale-90" : ""}`}
              style={{
                left: `${pos.x * 100}%`,
                top: `${pos.y * 100}%`,
              }}
              onClick={(e) => handlePlacedClick(e, userId)}
              onPointerDown={(e) => handlePlacedPointerDown(e, player)}
            >
              <div className="min-w-[36px] h-9 rounded-full flex items-center justify-center px-2.5 text-[11px] font-bold shadow-md bg-white text-team-700 border-2 border-team-300 whitespace-nowrap">
                {player.name || "?"}
              </div>
            </div>
          );
        })}
      </div>

      {/* 배치 요약 */}
      <div className="text-xs text-gray-500 text-center">
        {placedCount}명 배치 · {unassignedPlayers.length}명 미배정
      </div>
    </div>
  );
}
