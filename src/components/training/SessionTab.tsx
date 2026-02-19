"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { getPositionGroup } from "@/lib/position";
import { assignBalanced, assignGrouped } from "@/lib/random-team";
import type { FormationKey, PositionsMap } from "@/lib/formations";

// 모달은 필요할 때만 로드
const AttendanceRateModal = dynamic(() => import("@/components/AttendanceRateModal"), {
  ssr: false,
});

const AutoAssignSheet = dynamic(() => import("@/components/AutoAssignSheet"), {
  ssr: false,
});

const TacticsBoard = dynamic(() => import("@/components/training/TacticsBoard"), {
  ssr: false,
});

interface User {
  id: string;
  name: string | null;
  image: string | null;
  position?: string | null;
  number?: number | null;
}

interface RsvpEntry {
  id: string;
  userId: string;
  status: "ATTEND" | "ABSENT" | "LATE";
  reason: string | null;
  user: User;
}

interface SessionEntry {
  id: string;
  title: string | null;
  memo: string | null;
  requiresTeams: boolean;
  orderIndex: number;
  formation: string | null;
  positions: Record<string, { x: number; y: number; role: string }> | null;
  teamAssignments: {
    id: string;
    userId: string;
    teamLabel: string;
    user: User;
  }[];
}

interface Props {
  eventId: string;
  sessions: SessionEntry[];
  rsvps: RsvpEntry[];
  onRefresh: () => void;
}

export default function SessionTab({ eventId, sessions, rsvps, onRefresh }: Props) {
  // 세션 생성 상태
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionRequiresTeams, setSessionRequiresTeams] = useState(false);
  const [newSessionTeamCount, setNewSessionTeamCount] = useState(2);
  const [newSessionTeamAssignments, setNewSessionTeamAssignments] = useState<{ userId: string; teamLabel: string }[]>([]);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});

  // 세션 편집 상태
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editRequiresTeams, setEditRequiresTeams] = useState(false);
  const [editTeamCount, setEditTeamCount] = useState(2);
  const [editFormation, setEditFormation] = useState<FormationKey | null>(null);
  const [editPositions, setEditPositions] = useState<PositionsMap | null>(null);

  // 팀 배정 상태
  const [teamAssignments, setTeamAssignments] = useState<Record<string, { userId: string; teamLabel: string }[]>>({});
  const [draggedUser, setDraggedUser] = useState<{ userId: string; userName: string; fromTeam: string } | null>(null);

  // 팀 배정 알림 상태
  const [teamAssignmentNotified, setTeamAssignmentNotified] = useState(false);

  // 터치 드래그 상태
  const [touchDragUser, setTouchDragUser] = useState<{ userId: string; userName: string; fromTeam: string; sessionId: string } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ sessionId: string; teamLabel: string } | null>(null);
  const [touchDragPosition, setTouchDragPosition] = useState<{ x: number; y: number } | null>(null);

  // 세션 순서 드래그 상태
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [dragOverSessionIndex, setDragOverSessionIndex] = useState<number | null>(null);

  // 자동배정 바텀시트
  const [showAutoAssignSheet, setShowAutoAssignSheet] = useState(false);

  // 삭제 확인 상태
  const [deleteConfirmSession, setDeleteConfirmSession] = useState<string | null>(null);

  // 출석률 모달 상태
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  // 참석자
  const attendees = rsvps.filter((r) => r.status === "ATTEND" || r.status === "LATE");

  // 세션 생성
  const handleCreateSession = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sessionTitle || null,
          memo: null,
          requiresTeams: sessionRequiresTeams,
        }),
      });

      if (res.ok) {
        // 팀 배정이 있으면 세션 생성 후 바로 저장
        if (sessionRequiresTeams && newSessionTeamAssignments.length > 0) {
          const sessionData = await res.json();
          // teamLabel을 사용자 입력 이름으로 변환
          const assignmentsWithCustomNames = newSessionTeamAssignments.map((a) => ({
            userId: a.userId,
            teamLabel: teamNames[a.teamLabel] || `${a.teamLabel}팀`,
          }));
          await fetch(`/api/training-events/${eventId}/sessions/${sessionData.id}/team-assignments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignments: assignmentsWithCustomNames }),
          });
        }

        // 데이터 새로고침 완료 후 폼 닫기
        await onRefresh();

        setShowSessionForm(false);
        setSessionTitle("");
        setSessionRequiresTeams(false);
        setNewSessionTeamCount(2);
        setNewSessionTeamAssignments([]);
        setTeamNames({});
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  // 세션 삭제
  const handleDeleteSession = async (sessionId: string) => {
    setDeleteConfirmSession(null);
    setEditingSessionId(null);
    const res = await fetch(`/api/training-events/${eventId}/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) onRefresh();
  };

  // 세션 편집 시작
  const startEditing = useCallback((sess: SessionEntry) => {
    setEditingSessionId(sess.id);
    setEditTitle(sess.title || "");

    const assignments = sess.teamAssignments.map((a) => ({
      userId: a.userId,
      teamLabel: a.teamLabel,
    }));

    const labels = [...new Set(assignments.map((a) => a.teamLabel))];
    const hasTeams = labels.length > 0;

    setEditRequiresTeams(hasTeams);
    setEditTeamCount(hasTeams ? labels.length : 2);
    setTeamAssignments((prev) => ({ ...prev, [sess.id]: assignments }));

    // 기존 팀 이름을 teamNames에 로드
    const existingTeamNames: Record<string, string> = {};
    labels.forEach((label) => {
      existingTeamNames[label] = label;
    });
    setTeamNames(existingTeamNames);

    // 포메이션/포지션 로드
    setEditFormation((sess.formation as FormationKey) || null);
    setEditPositions(sess.positions || null);
  }, []);

  // 편집 취소
  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditTitle("");
    setEditRequiresTeams(false);
    setEditTeamCount(2);
    setShowAutoAssignSheet(false);
    setEditFormation(null);
    setEditPositions(null);
  };

  // 자동배정 실행
  const executeAutoAssignment = (mode: "balanced" | "grouped") => {
    if (!editingSessionId) return;

    const attendeesList = attendees.map((r) => ({ userId: r.userId, position: r.user.position }));

    const assignments = mode === "balanced"
      ? assignBalanced(attendeesList, editTeamCount)
      : assignGrouped(attendeesList, editTeamCount);

    setTeamAssignments((prev) => ({ ...prev, [editingSessionId]: assignments }));
    setShowAutoAssignSheet(false);
  };

  // 새 세션: 유저를 팀으로 이동
  const moveUserNewSession = (userId: string, toTeam: string) => {
    if (toTeam === "unassigned") {
      setNewSessionTeamAssignments((prev) => prev.filter((a) => a.userId !== userId));
    } else {
      setNewSessionTeamAssignments((prev) => {
        const filtered = prev.filter((a) => a.userId !== userId);
        return [...filtered, { userId, teamLabel: toTeam }];
      });
    }
  };

  // 새 세션: 드롭 핸들러
  const handleNewSessionDrop = (e: React.DragEvent, toTeam: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-team-100");
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveUserNewSession(data.userId, toTeam);
    } catch {
      if (draggedUser) moveUserNewSession(draggedUser.userId, toTeam);
    }
    setDraggedUser(null);
  };

  // 유저를 팀으로 이동 (기존 세션)
  const moveUserToTeam = (sessionId: string, userId: string, toTeam: string) => {
    setTeamAssignments((prev) => {
      const current = prev[sessionId] || [];
      const filtered = current.filter((a) => a.userId !== userId);
      if (toTeam === "unassigned") return { ...prev, [sessionId]: filtered };
      return { ...prev, [sessionId]: [...filtered, { userId, teamLabel: toTeam }] };
    });
  };

  // 세션 저장 (제목 + 팀 배정)
  const saveSession = async (sessionId: string) => {
    setSubmitting(true);
    try {
      // 제목 + 포메이션 저장
      await fetch(`/api/training-events/${eventId}/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle,
          formation: editFormation,
          positions: editPositions,
        }),
      });

      // 팀 배정 저장 (팀 나누기가 활성화된 경우에만)
      if (editRequiresTeams) {
        const assignments = teamAssignments[sessionId] || [];
        // teamLabel을 사용자 입력 이름으로 변환
        const assignmentsWithCustomNames = assignments.map((a) => ({
          userId: a.userId,
          teamLabel: teamNames[a.teamLabel] || a.teamLabel,
        }));
        await fetch(`/api/training-events/${eventId}/sessions/${sessionId}/teams`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignments: assignmentsWithCustomNames }),
        });
        // 팀 배정 변경되었으므로 알림 상태 리셋
        setTeamAssignmentNotified(false);
      }

      cancelEditing();
      onRefresh();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  // 세션 순서 변경
  const handleReorderSessions = async (newOrder: string[]) => {
    try {
      const res = await fetch(`/api/training-events/${eventId}/sessions/reorder-all`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds: newOrder }),
      });
      if (!res.ok) {
        throw new Error("순서 변경 실패");
      }
      await onRefresh();
    } catch (error) {
      console.error("순서 변경 실패:", error);
      alert("순서 변경에 실패했습니다");
      await onRefresh();
    }
  };

  // 팀 배정 알림 전송
  const handleNotifyTeamAssignments = async () => {
    const hasTeamAssignments = sessions.some((s) => s.teamAssignments.length > 0);
    if (!hasTeamAssignments) {
      alert("배정된 팀이 없습니다");
      return;
    }

    if (!confirm("팀원들에게 '팀 배정을 확인하세요'라는 푸시 알림이 전송됩니다.\n\n알림을 전송하시겠습니까?")) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}/notify-team-assignments`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        alert(`${data.recipientCount}명에게 알림을 전송했습니다`);
        setTeamAssignmentNotified(true);
      } else {
        const data = await res.json();
        alert(data.error || "알림 전송에 실패했습니다");
      }
    } catch {
      alert("알림 전송에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  // 드래그 핸들러
  const handleDragStart = (e: React.DragEvent, userId: string, userName: string, fromTeam: string) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify({ userId, userName, fromTeam }));
    setDraggedUser({ userId, userName, fromTeam });
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    e.currentTarget.classList.add("bg-team-100");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove("bg-team-100");
  };

  const handleDrop = (e: React.DragEvent, sessionId: string, toTeam: string) => {
    e.preventDefault();
    e.currentTarget.classList.remove("bg-team-100");

    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveUserToTeam(sessionId, data.userId, toTeam);
    } catch {
      if (draggedUser) {
        moveUserToTeam(sessionId, draggedUser.userId, toTeam);
      }
    }
    setDraggedUser(null);
  };

  // 터치 드래그 핸들러
  const handleUserTouchStart = (userId: string, userName: string, fromTeam: string, sessionId: string) => {
    setTouchDragUser({ userId, userName, fromTeam, sessionId });
    setDragOverTarget(null);
  };

  const handleUserTouchMove = (e: React.TouchEvent) => {
    if (!touchDragUser) return;
    e.preventDefault();

    const touch = e.touches[0];
    setTouchDragPosition({ x: touch.clientX, y: touch.clientY });

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    const dropZone = element.closest('[data-drop-target]');
    if (dropZone) {
      const sessionId = dropZone.getAttribute('data-session-id');
      const teamLabel = dropZone.getAttribute('data-team-label');
      if (sessionId && teamLabel) {
        setDragOverTarget({ sessionId, teamLabel });
      }
    } else {
      setDragOverTarget(null);
    }
  };

  const handleUserTouchEnd = () => {
    if (!touchDragUser || !dragOverTarget) {
      setTouchDragUser(null);
      setDragOverTarget(null);
      setTouchDragPosition(null);
      return;
    }

    if (touchDragUser.sessionId === "__new__" && dragOverTarget.sessionId === "__new__") {
      moveUserNewSession(touchDragUser.userId, dragOverTarget.teamLabel);
    } else if (touchDragUser.sessionId === dragOverTarget.sessionId) {
      moveUserToTeam(touchDragUser.sessionId, touchDragUser.userId, dragOverTarget.teamLabel);
    }

    setTouchDragUser(null);
    setDragOverTarget(null);
    setTouchDragPosition(null);
  };

  // 세션 드래그 핸들러
  const handleSessionDragStart = (e: React.DragEvent, sessionId: string) => {
    e.stopPropagation();
    setDraggedSessionId(sessionId);
  };

  const handleSessionDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverSessionIndex(index);
  };

  const handleSessionDragEnd = async () => {
    if (draggedSessionId && dragOverSessionIndex !== null) {
      const fromIndex = sessions.findIndex((s) => s.id === draggedSessionId);

      if (fromIndex !== -1 && fromIndex !== dragOverSessionIndex) {
        const newSessions = [...sessions];
        const [movedSession] = newSessions.splice(fromIndex, 1);
        newSessions.splice(dragOverSessionIndex, 0, movedSession);

        const newOrder = newSessions.map((s) => s.id);
        await handleReorderSessions(newOrder);
      }
    }
    setDraggedSessionId(null);
    setDragOverSessionIndex(null);
  };

  const handleSessionTouchStart = (sessionId: string) => {
    setDraggedSessionId(sessionId);
  };

  const handleSessionTouchMove = (e: React.TouchEvent) => {
    if (!draggedSessionId) return;
    e.preventDefault();

    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    const sessionCard = element.closest('[data-session-card]');
    if (sessionCard) {
      const index = parseInt(sessionCard.getAttribute('data-session-index') || '-1');
      if (index >= 0) {
        setDragOverSessionIndex(index);
      }
    }
  };

  const handleSessionTouchEnd = async () => {
    if (draggedSessionId && dragOverSessionIndex !== null) {
      const fromIndex = sessions.findIndex((s) => s.id === draggedSessionId);

      if (fromIndex !== -1 && fromIndex !== dragOverSessionIndex) {
        const newSessions = [...sessions];
        const [movedSession] = newSessions.splice(fromIndex, 1);
        newSessions.splice(dragOverSessionIndex, 0, movedSession);

        const newOrder = newSessions.map((s) => s.id);
        await handleReorderSessions(newOrder);
      }
    }
    setDraggedSessionId(null);
    setDragOverSessionIndex(null);
  };

  return (
    <>
      {/* 참석 인원 요약 + 버튼 */}
      <div className="bg-white rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-gray-700">참석 인원</span>
          <span className="text-sm font-semibold text-team-600">{attendees.length}명</span>
        </div>

        {/* 버튼들 */}
        <div className="flex gap-2">
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-team-700 bg-team-50 border border-team-200 rounded-lg hover:bg-team-100 transition-colors flex items-center justify-center gap-1.5"
          >
            <span>출석률</span>
            <span>📊</span>
          </button>

          {sessions.some((s) => s.teamAssignments.length > 0) && (
            <button
              onClick={handleNotifyTeamAssignments}
              disabled={submitting || teamAssignmentNotified}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-team-500 rounded-lg hover:bg-team-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              {teamAssignmentNotified ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5l10 -10" />
                  </svg>
                  <span>알림 완료</span>
                </>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3h-16a4 4 0 0 0 2 -3v-3a7 7 0 0 1 4 -6" />
                    <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
                  </svg>
                  <span>팀 배정 알리기</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {sessions.map((sess, idx) => (
        <div
          key={sess.id}
          className={`bg-white rounded-xl overflow-hidden transition-opacity ${draggedSessionId === sess.id ? 'opacity-50' : ''} ${dragOverSessionIndex === idx ? 'ring-2 ring-team-300' : ''}`}
          data-session-card="true"
          data-session-index={idx}
          draggable={editingSessionId !== sess.id}
          onDragStart={(e) => handleSessionDragStart(e, sess.id)}
          onDragOver={(e) => handleSessionDragOver(e, idx)}
          onDragEnd={handleSessionDragEnd}
          onTouchStart={() => editingSessionId !== sess.id && handleSessionTouchStart(sess.id)}
          onTouchMove={handleSessionTouchMove}
          onTouchEnd={handleSessionTouchEnd}
        >
          {editingSessionId === sess.id ? (
            /* 편집 모드 */
            <div className="p-4 space-y-4">
              {/* 세션명 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                  세션명
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder={`세션 ${idx + 1}`}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
              </div>

              {/* 팀 나누기 토글 */}
              <div className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-gray-700">팀 나누기</span>
                <button
                  type="button"
                  onClick={() => setEditRequiresTeams(!editRequiresTeams)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${editRequiresTeams ? "bg-team-500" : "bg-gray-300"}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${editRequiresTeams ? "translate-x-5" : ""}`}
                  />
                </button>
              </div>

              {editRequiresTeams && (
                <>
                  {/* 팀 수 선택 */}
                  <div className="flex items-center justify-between py-3">
                    <span className="text-sm font-medium text-gray-700">팀 수</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setEditTeamCount((c) => Math.max(2, c - 1))}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-gray-700 text-sm font-semibold"
                      >
                        −
                      </button>
                      <span className="text-sm font-bold text-gray-900 w-6 text-center">{editTeamCount}</span>
                      <button
                        onClick={() => setEditTeamCount((c) => Math.min(10, c + 1))}
                        className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-gray-700 text-sm font-semibold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* 미배정 인원 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-gray-700">
                        미배정 인원
                      </label>
                      <button
                        onClick={() => setShowAutoAssignSheet(true)}
                        className="text-xs text-team-600 font-medium hover:text-team-700 underline"
                      >
                        자동배정
                      </button>
                    </div>
                    <div
                      className="border border-dashed border-gray-300 rounded-lg p-3 min-h-[60px]"
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, sess.id, "unassigned")}
                      data-drop-target="true"
                      data-session-id={sess.id}
                      data-team-label="unassigned"
                    >
                      <div className="flex flex-wrap gap-2">
                        {attendees
                          .filter((r) => !(teamAssignments[sess.id] || []).some((a) => a.userId === r.userId))
                          .map((r) => (
                            <span
                              key={r.userId}
                              draggable
                              onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, r.userId, r.user.name || "이름 없음", "unassigned"); }}
                              onTouchStart={(e) => { e.stopPropagation(); handleUserTouchStart(r.userId, r.user.name || "이름 없음", "unassigned", sess.id); }}
                              onTouchMove={handleUserTouchMove}
                              onTouchEnd={handleUserTouchEnd}
                              className={`px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium cursor-grab active:cursor-grabbing select-none hover:bg-gray-200 transition-colors touch-none ${
                                touchDragUser?.userId === r.userId ? 'opacity-50' : ''
                              }`}
                            >
                              {r.user.name || "이름 없음"}
                              {r.user.position && <span className="ml-1 text-[10px] text-gray-400">{getPositionGroup(r.user.position)}</span>}
                            </span>
                          ))}
                      </div>
                    </div>
                  </div>

                  {/* 팀 드롭존 */}
                  <div className="space-y-2">
                    {Array.from({ length: editTeamCount }, (_, i) => {
                      const label = String.fromCharCode(65 + i);
                      const teamMembers = (teamAssignments[sess.id] || []).filter((a) => a.teamLabel === label);
                      return (
                        <div key={label}>
                          <div className="flex items-center gap-2 mb-1.5">
                            <input
                              type="text"
                              value={teamNames[label] || `${label}팀`}
                              onChange={(e) => setTeamNames({ ...teamNames, [label]: e.target.value })}
                              placeholder={`${label}팀`}
                              className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 hover:border-gray-300 focus:border-team-500 focus:bg-white focus:outline-none px-2 py-1 rounded max-w-[120px]"
                            />
                            <span className="text-xs text-gray-500">({teamMembers.length}명)</span>
                          </div>
                          <div
                            className={`border border-gray-300 rounded-lg p-3 min-h-[60px] transition-colors ${
                              dragOverTarget?.sessionId === sess.id && dragOverTarget?.teamLabel === label
                                ? 'bg-team-100'
                                : 'bg-team-50/40'
                            }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, sess.id, label)}
                            data-drop-target="true"
                            data-session-id={sess.id}
                            data-team-label={label}
                          >
                            <div className="flex flex-wrap gap-2">
                              {teamMembers.map((a) => {
                                const user = attendees.find((r) => r.userId === a.userId);
                                if (!user) return null;
                                return (
                                  <span
                                    key={a.userId}
                                    draggable
                                    onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, a.userId, user.user.name || "이름 없음", label); }}
                                    onTouchStart={(e) => { e.stopPropagation(); handleUserTouchStart(a.userId, user.user.name || "이름 없음", label, sess.id); }}
                                    onTouchMove={handleUserTouchMove}
                                    onTouchEnd={handleUserTouchEnd}
                                    className={`px-2.5 py-1.5 bg-white border border-team-200 text-team-700 rounded-md text-xs font-medium cursor-grab active:cursor-grabbing select-none hover:bg-team-50 transition-colors touch-none ${
                                      touchDragUser?.userId === a.userId ? 'opacity-50' : ''
                                    }`}
                                  >
                                    {user.user.name || "이름 없음"}
                                    {user.user.position && <span className="ml-1 text-[10px] text-team-400">{getPositionGroup(user.user.position)}</span>}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* 작전판 (포메이션 + 선수 배치) */}
              {editRequiresTeams && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-2">작전판</label>
                  <TacticsBoard
                    mode="edit"
                    formation={editFormation}
                    positions={editPositions}
                    players={
                      (teamAssignments[sess.id] || []).map((a) => {
                        const user = attendees.find((r) => r.userId === a.userId);
                        return {
                          userId: a.userId,
                          name: user?.user.name || "이름 없음",
                          position: user?.user.position || null,
                        };
                      })
                    }
                    onFormationChange={setEditFormation}
                    onPositionsChange={setEditPositions}
                  />
                </div>
              )}

              {/* 버튼 영역 */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setDeleteConfirmSession(sess.id)}
                  className="text-sm text-red-500 px-4 py-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                >
                  삭제
                </button>
                <div className="flex-1" />
                <button
                  onClick={cancelEditing}
                  className="text-sm text-gray-600 px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => saveSession(sess.id)}
                  disabled={submitting}
                  className="text-sm text-white bg-team-500 px-4 py-2 rounded-lg disabled:opacity-50 hover:bg-team-600 transition-colors"
                >
                  {submitting ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          ) : (
            /* 읽기 모드 */
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* 드래그 핸들 */}
                  <div className="cursor-move touch-none -ml-1 text-gray-300 hover:text-gray-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="5" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="9" cy="19" r="1.5" />
                      <circle cx="15" cy="5" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="15" cy="19" r="1.5" />
                    </svg>
                  </div>
                  <span className="w-6 h-6 bg-team-100 text-team-700 text-xs font-medium rounded-full flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {sess.title || `세션 ${idx + 1}`}
                  </h3>
                </div>
                <button
                  onClick={() => startEditing(sess)}
                  className="text-team-600 hover:text-team-700 p-2 rounded-lg transition-colors"
                  aria-label="세션 편집"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" />
                    <path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" />
                    <path d="M16 5l3 3" />
                  </svg>
                </button>
              </div>

              {/* 팀 배정 정보 */}
              {sess.teamAssignments.length > 0 && (
                <div className="mt-3 space-y-2">
                  {Object.entries(
                    sess.teamAssignments.reduce<Record<string, { name: string; position: string | null }[]>>((acc, a) => {
                      if (!acc[a.teamLabel]) acc[a.teamLabel] = [];
                      acc[a.teamLabel].push({
                        name: a.user.name || "이름 없음",
                        position: a.user.position || null,
                      });
                      return acc;
                    }, {})
                  ).map(([label, members]) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 bg-team-500 text-white text-[11px] font-bold rounded-md whitespace-nowrap">
                          {label}
                        </span>
                        <span className="text-xs text-gray-500">{members.length}명</span>
                      </div>
                      <div className="flex flex-wrap gap-x-1 gap-y-1">
                        {members.map((m, i) => (
                          <span key={i} className="text-[13px] text-gray-700">
                            {m.name}
                            {m.position && <span className="text-[10px] text-gray-400 ml-0.5">{getPositionGroup(m.position)}</span>}
                            {i < members.length - 1 && <span className="text-gray-300 mx-0.5">·</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* 작전판 (읽기 전용) */}
              {sess.formation && (
                <div className="mt-3 ml-8">
                  <TacticsBoard
                    mode="readonly"
                    formation={sess.formation as FormationKey}
                    positions={sess.positions as PositionsMap | null}
                    players={
                      sess.teamAssignments.map((a) => ({
                        userId: a.userId,
                        name: a.user.name || "이름 없음",
                        position: a.user.position || null,
                      }))
                    }
                  />
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* 세션 추가 */}
      {!showSessionForm ? (
        <button
          onClick={() => setShowSessionForm(true)}
          className="w-full py-3.5 bg-white rounded-xl text-sm font-medium text-team-600 hover:bg-team-50 transition-colors border border-dashed border-team-200 flex items-center justify-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          세션 추가
        </button>
      ) : (
        <div className="bg-white rounded-xl p-4 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">새 세션</h4>
          <input
            type="text"
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
            placeholder="세션 제목 (예: 5v5 미니게임)"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-team-300 transition-colors"
          />
          <div className="flex items-center justify-between py-3">
            <div>
              <span className="text-sm font-medium text-gray-700">팀 분배 필요</span>
              <p className="text-xs text-gray-400 mt-0.5">게임, 대결 훈련 등</p>
            </div>
            <button
              type="button"
              onClick={() => setSessionRequiresTeams(!sessionRequiresTeams)}
              className={`relative w-11 h-6 rounded-full transition-colors ${sessionRequiresTeams ? "bg-team-500" : "bg-gray-300"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sessionRequiresTeams ? "translate-x-5" : ""}`}
              />
            </button>
          </div>

          {/* 팀 배정 UI */}
          {sessionRequiresTeams && (
            <>
              {/* 팀 수 선택 */}
              <div className="flex items-center justify-between py-3">
                <span className="text-sm font-medium text-gray-700">팀 수</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setNewSessionTeamCount((c) => Math.max(2, c - 1))}
                    className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-gray-700 text-sm font-semibold"
                  >
                    −
                  </button>
                  <span className="text-sm font-bold text-gray-900 w-6 text-center">{newSessionTeamCount}</span>
                  <button
                    onClick={() => setNewSessionTeamCount((c) => Math.min(10, c + 1))}
                    className="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-lg text-gray-700 text-sm font-semibold"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 미배정 인원 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-700">미배정 인원</label>
                  <button
                    onClick={() => {
                      // 간단한 자동배정 (균등분배)
                      const unassigned = attendees.filter((r) => !newSessionTeamAssignments.some((a) => a.userId === r.userId));
                      const newAssignments: { userId: string; teamLabel: string }[] = [];
                      unassigned.forEach((r, i) => {
                        const teamLabel = String.fromCharCode(65 + (i % newSessionTeamCount));
                        newAssignments.push({ userId: r.userId, teamLabel });
                      });
                      setNewSessionTeamAssignments([...newSessionTeamAssignments, ...newAssignments]);
                    }}
                    className="text-xs text-team-600 font-medium hover:text-team-700 underline"
                  >
                    자동배정
                  </button>
                </div>
                <div
                  className="border border-dashed border-gray-300 rounded-lg p-3 min-h-[60px]"
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleNewSessionDrop(e, "unassigned")}
                  data-drop-target="true"
                  data-session-id="__new__"
                  data-team-label="unassigned"
                >
                  <div className="flex flex-wrap gap-2">
                    {attendees
                      .filter((r) => !newSessionTeamAssignments.some((a) => a.userId === r.userId))
                      .map((r) => (
                        <span
                          key={r.userId}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, r.userId, r.user.name || "이름 없음", "unassigned"); }}
                          onTouchStart={(e) => { e.stopPropagation(); handleUserTouchStart(r.userId, r.user.name || "이름 없음", "unassigned", "__new__"); }}
                          onTouchMove={handleUserTouchMove}
                          onTouchEnd={handleUserTouchEnd}
                          className={`px-2.5 py-1.5 bg-gray-100 text-gray-700 rounded-md text-xs font-medium cursor-grab active:cursor-grabbing select-none hover:bg-gray-200 transition-colors touch-none ${
                            touchDragUser?.userId === r.userId ? 'opacity-50' : ''
                          }`}
                        >
                          {r.user.name || "이름 없음"}
                          {r.user.position && <span className="ml-1 text-[10px] text-gray-400">{getPositionGroup(r.user.position)}</span>}
                        </span>
                      ))}
                  </div>
                </div>
              </div>

              {/* 팀 드롭존 */}
              <div className="space-y-2">
                {Array.from({ length: newSessionTeamCount }, (_, i) => {
                  const label = String.fromCharCode(65 + i);
                  const teamMembers = newSessionTeamAssignments.filter((a) => a.teamLabel === label);
                  return (
                    <div key={label}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <input
                          type="text"
                          value={teamNames[label] || `${label}팀`}
                          onChange={(e) => setTeamNames({ ...teamNames, [label]: e.target.value })}
                          placeholder={`${label}팀`}
                          className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 hover:border-gray-300 focus:border-team-500 focus:bg-white focus:outline-none px-2 py-1 rounded max-w-[120px]"
                        />
                        <span className="text-xs text-gray-500">({teamMembers.length}명)</span>
                      </div>
                      <div
                        className={`border border-gray-300 rounded-lg p-3 min-h-[60px] transition-colors ${
                          dragOverTarget?.sessionId === "__new__" && dragOverTarget?.teamLabel === label
                            ? 'bg-team-100'
                            : 'bg-team-50/40'
                        }`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleNewSessionDrop(e, label)}
                        data-drop-target="true"
                        data-session-id="__new__"
                        data-team-label={label}
                      >
                        <div className="flex flex-wrap gap-2">
                          {teamMembers.map((assignment) => {
                            const user = attendees.find((r) => r.userId === assignment.userId)?.user;
                            return (
                              <span
                                key={assignment.userId}
                                draggable
                                onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, assignment.userId, user?.name || "이름 없음", label); }}
                                onTouchStart={(e) => { e.stopPropagation(); handleUserTouchStart(assignment.userId, user?.name || "이름 없음", label, "__new__"); }}
                                onTouchMove={handleUserTouchMove}
                                onTouchEnd={handleUserTouchEnd}
                                className={`px-2.5 py-1.5 bg-white border border-team-200 text-team-700 rounded-md text-xs font-medium cursor-grab active:cursor-grabbing select-none hover:bg-team-50 transition-colors touch-none ${
                                  touchDragUser?.userId === assignment.userId ? 'opacity-50' : ''
                                }`}
                              >
                                {user?.name || "이름 없음"}
                                {user?.position && <span className="ml-1 text-[10px] text-team-400">{getPositionGroup(user.position)}</span>}
                              </span>
                            );
                          })}
                          {teamMembers.length === 0 && (
                            <span className="text-xs text-gray-400">미배정 인원을 여기로 드래그하세요</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowSessionForm(false);
                setSessionTitle("");
                setSessionRequiresTeams(false);
                setNewSessionTeamCount(2);
                setNewSessionTeamAssignments([]);
              }}
              className="flex-1 py-2.5 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleCreateSession}
              disabled={submitting}
              className="flex-1 py-2.5 text-sm text-white bg-team-500 rounded-lg disabled:opacity-50 hover:bg-team-600 transition-colors"
            >
              {submitting ? "생성 중..." : "생성하기"}
            </button>
          </div>
        </div>
      )}

      {sessions.length === 0 && !showSessionForm && (
        <div className="text-center py-8">
          <p className="text-sm text-gray-400">세션을 추가하여 팀을 분배하세요</p>
        </div>
      )}

      {/* 출석률 모달 */}
      <AttendanceRateModal
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
      />

      {/* 세션 삭제 확인 모달 */}
      {deleteConfirmSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">세션 삭제</h3>
            <p className="text-sm text-gray-600 mb-6">
              이 세션을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmSession(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => handleDeleteSession(deleteConfirmSession)}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 자동배정 바텀시트 */}
      {showAutoAssignSheet && (
        <AutoAssignSheet
          onSelect={executeAutoAssignment}
          onClose={() => setShowAutoAssignSheet(false)}
        />
      )}

      {/* 터치 드래그 고스트 요소 */}
      {touchDragUser && touchDragPosition && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: touchDragPosition.x,
            top: touchDragPosition.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          <span className="inline-block px-2.5 py-1.5 bg-team-500 text-white rounded-md text-xs font-medium shadow-lg opacity-80">
            {touchDragUser.userName}
          </span>
        </div>
      )}
    </>
  );
}
