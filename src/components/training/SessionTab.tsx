"use client";

import React, { useState, useCallback } from "react";
import { getPositionGroup } from "@/lib/position";
import { assignBalanced, assignGrouped } from "@/lib/random-team";
import AttendanceRateModal from "@/components/AttendanceRateModal";
import AutoAssignSheet from "@/components/AutoAssignSheet";

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

  // 세션 편집 상태
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editRequiresTeams, setEditRequiresTeams] = useState(false);
  const [editTeamCount, setEditTeamCount] = useState(2);

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
        setShowSessionForm(false);
        setSessionTitle("");
        setSessionRequiresTeams(false);
        onRefresh();
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
  }, []);

  // 편집 취소
  const cancelEditing = () => {
    setEditingSessionId(null);
    setEditTitle("");
    setEditRequiresTeams(false);
    setEditTeamCount(2);
    setShowAutoAssignSheet(false);
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

  // 유저를 팀으로 이동
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
      // 제목 저장
      await fetch(`/api/training-events/${eventId}/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle }),
      });

      // 팀 배정 저장 (팀 나누기가 활성화된 경우에만)
      if (editRequiresTeams) {
        const assignments = teamAssignments[sessionId] || [];
        await fetch(`/api/training-events/${eventId}/sessions/${sessionId}/teams`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignments }),
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

    if (!confirm("팀 배정 알림을 전송하시겠습니까?")) {
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

    if (touchDragUser.sessionId === dragOverTarget.sessionId) {
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
      <div className="bg-team-50 rounded-xl px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-team-700">참석 인원</span>
            <span className="text-sm font-bold text-team-600">{attendees.length}명</span>
          </div>
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="text-xs text-team-600 font-medium hover:text-team-700 transition-colors"
          >
            출석률 📊
          </button>
        </div>
        {sessions.some((s) => s.teamAssignments.length > 0) && (
          <button
            onClick={handleNotifyTeamAssignments}
            disabled={submitting || teamAssignmentNotified}
            className="w-full mt-2 text-xs font-medium text-white bg-team-500 px-4 py-2.5 rounded-lg hover:bg-team-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {teamAssignmentNotified ? "✅ 알림 전송 완료" : "⚽ 팀 배정 알리기"}
          </button>
        )}
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
            <div className="p-5 space-y-4">
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
              <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
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
                  <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
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
                        onClick={() => setEditTeamCount((c) => Math.min(4, c + 1))}
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
                      className="border-2 border-dashed border-gray-200 rounded-lg p-3 min-h-[60px]"
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
                          <label className="block text-xs font-medium text-gray-700 mb-1.5">
                            {label}팀 ({teamMembers.length}명)
                          </label>
                          <div
                            className={`border border-team-200 rounded-lg p-3 min-h-[60px] transition-colors ${
                              dragOverTarget?.sessionId === sess.id && dragOverTarget?.teamLabel === label
                                ? 'bg-team-100'
                                : 'bg-team-50/30'
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
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {/* 드래그 핸들 */}
                  <div className="cursor-move touch-none p-1 text-gray-300 hover:text-gray-500">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <circle cx="9" cy="5" r="1.5" />
                      <circle cx="9" cy="12" r="1.5" />
                      <circle cx="9" cy="19" r="1.5" />
                      <circle cx="15" cy="5" r="1.5" />
                      <circle cx="15" cy="12" r="1.5" />
                      <circle cx="15" cy="19" r="1.5" />
                    </svg>
                  </div>
                  <span className="w-6 h-6 bg-team-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <h3 className="text-sm font-semibold text-gray-900">
                    {sess.title || `세션 ${idx + 1}`}
                  </h3>
                </div>
                <button
                  onClick={() => startEditing(sess)}
                  className="text-xs text-team-600 hover:text-team-700 px-3 py-1.5 border border-team-200 rounded-lg transition-colors"
                >
                  편집
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
                    <div key={label} className="bg-gray-50 rounded-lg p-2.5">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-5 h-5 bg-team-500 text-white text-[10px] font-bold rounded flex items-center justify-center">
                          {label}
                        </span>
                        <span className="text-xs font-semibold text-gray-700">{members.length}명</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {members.map((m, i) => (
                          <span key={i} className="inline-flex items-center gap-0.5 text-xs text-gray-600">
                            {m.name}
                            {m.position && <span className="text-[9px] text-gray-400">{getPositionGroup(m.position)}</span>}
                            {i < members.length - 1 && <span className="text-gray-300 mx-0.5">·</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
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
        <div className="bg-white rounded-xl p-5 space-y-3">
          <h4 className="text-sm font-semibold text-gray-900">새 세션</h4>
          <input
            type="text"
            value={sessionTitle}
            onChange={(e) => setSessionTitle(e.target.value)}
            placeholder="세션 제목 (예: 5v5 미니게임)"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-team-300 transition-colors"
          />
          <div className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
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
          <div className="flex gap-2">
            <button
              onClick={() => { setShowSessionForm(false); setSessionTitle(""); setSessionRequiresTeams(false); }}
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
          <div className="text-3xl mb-2">⚽</div>
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
