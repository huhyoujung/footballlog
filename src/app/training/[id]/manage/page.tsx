"use client";
import LoadingSpinner from "@/components/LoadingSpinner";
import BackButton from "@/components/BackButton";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
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

interface CheckInEntry {
  id: string;
  userId: string;
  checkedInAt: string;
  isLate: boolean;
  user: User;
}

interface LateFeeEntry {
  id: string;
  userId: string;
  amount: number;
  status: "PENDING" | "PAID";
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

interface EventDetail {
  id: string;
  title: string;
  date: string;
  location: string;
  rsvps: RsvpEntry[];
  checkIns: CheckInEntry[];
  lateFees: LateFeeEntry[];
  sessions: SessionEntry[];
}

type Tab = "attendance" | "latefee" | "session" | "equipment";

// 팀의 포지션 요약 문자열 생성 (예: "GK1 DF2 MF2 FW1")
function getTeamPositionSummary(
  userIds: string[],
  attendees: RsvpEntry[]
): string {
  const counts: Record<string, number> = {};
  for (const uid of userIds) {
    const user = attendees.find((r) => r.userId === uid)?.user;
    const group = getPositionGroup(user?.position);
    counts[group] = (counts[group] || 0) + 1;
  }
  const order = ["GK", "DF", "MF", "FW", "??"];
  return order
    .filter((g) => counts[g])
    .map((g) => `${g}${counts[g]}`)
    .join(" ");
}

export default function TrainingManagePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [eventId, setEventId] = useState<string>("");
  const [event, setEvent] = useState<EventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("attendance");

  // 지각비 상태
  const [showLateFeeForm, setShowLateFeeForm] = useState(false);
  const [lateFeeUserId, setLateFeeUserId] = useState("");
  const [lateFeeAmount, setLateFeeAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [lateFeeAmounts, setLateFeeAmounts] = useState<Record<string, number>>({});

  // 세션 생성 상태
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionRequiresTeams, setSessionRequiresTeams] = useState(false);

  // 세션 편집 상태 (생성과 통합 - 하나의 세션만 편집)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editRequiresTeams, setEditRequiresTeams] = useState(false);
  const [editTeamCount, setEditTeamCount] = useState(2);

  // 팀 배정 상태 (편집 중인 세션의 배정 정보)
  const [teamAssignments, setTeamAssignments] = useState<Record<string, { userId: string; teamLabel: string }[]>>({});
  const [draggedUser, setDraggedUser] = useState<{ userId: string; userName: string; fromTeam: string } | null>(null);

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

  // 장비 상태
  const [equipments, setEquipments] = useState<EquipmentWithAssignment[]>([]);
  const [equipmentAssignments, setEquipmentAssignments] = useState<Record<string, { userId: string | null; memo: string }>>({});
  const [savingEquipment, setSavingEquipment] = useState(false);

  useEffect(() => {
    params.then((p) => setEventId(p.id));
  }, [params]);

  useEffect(() => {
    if (eventId) fetchEvent();
  }, [eventId]);

  useEffect(() => {
    if (event && activeTab === "latefee") {
      // 지각비 금액 초기화: 기존 지각비 + 지각/미도착 인원
      const amounts: Record<string, number> = {};

      // 기존 지각비 불러오기
      event.lateFees.forEach((fee) => {
        amounts[fee.userId] = fee.amount;
      });

      // 지각자 및 미도착자 0원으로 초기화 (기존 값 없으면)
      const lateCheckIns = event.checkIns.filter((c) => c.isLate);
      const noShows = event.rsvps
        .filter((r) => r.status === "ATTEND" || r.status === "LATE")
        .filter((r) => !event.checkIns.some((c) => c.userId === r.userId));

      [...lateCheckIns, ...noShows].forEach((item) => {
        const userId = item.userId;
        if (!(userId in amounts)) {
          amounts[userId] = 0;
        }
      });

      setLateFeeAmounts(amounts);
    }
  }, [event, activeTab]);

  useEffect(() => {
    if (eventId && activeTab === "equipment") {
      fetchEquipments();
    }
  }, [eventId, activeTab]);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/training-events/${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setEvent(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const fetchEquipments = async () => {
    try {
      const res = await fetch(`/api/training-events/${eventId}/equipment`);
      if (res.ok) {
        const data = await res.json();
        setEquipments(data);

        // 현재 배정 상태를 state에 설정
        const assignments: Record<string, { userId: string | null; memo: string }> = {};
        data.forEach((eq: EquipmentWithAssignment) => {
          assignments[eq.id] = {
            userId: eq.assignment?.userId || null,
            memo: eq.assignment?.memo || "",
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
      // 각 장비의 owner를 userId로 사용 (장비 관리자가 담당)
      const assignments = Object.entries(equipmentAssignments).map(([equipmentId, { memo }]) => {
        const equipment = equipments.find((eq) => eq.id === equipmentId);
        return {
          equipmentId,
          userId: equipment?.owner?.id || null,
          memo: memo.trim() || undefined,
        };
      });

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

  // 지각비 부과
  const handleAddLateFee = async () => {
    if (!lateFeeUserId || !lateFeeAmount) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}/late-fees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: lateFeeUserId, amount: parseInt(lateFeeAmount) }),
      });
      if (res.ok) {
        setShowLateFeeForm(false);
        setLateFeeUserId("");
        setLateFeeAmount("");
        fetchEvent();
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  // 지각비 납부 확인
  const handleMarkPaid = async (feeId: string) => {
    const res = await fetch(`/api/training-events/${eventId}/late-fees/${feeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    if (res.ok) fetchEvent();
  };

  // 지각비 삭제
  const handleDeleteLateFee = async (feeId: string) => {
    if (!confirm("지각비를 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/training-events/${eventId}/late-fees/${feeId}`, { method: "DELETE" });
    if (res.ok) fetchEvent();
  };

  // 지각비 일괄 저장
  const handleSaveLateFees = async () => {
    setSubmitting(true);
    try {
      // 금액이 0보다 큰 항목만 전송
      const feesToSave = Object.entries(lateFeeAmounts)
        .filter(([_, amount]) => amount > 0)
        .map(([userId, amount]) => ({ userId, amount }));

      // 기존 지각비 중 금액이 0으로 변경된 것은 삭제
      const deletePromises = event!.lateFees
        .filter((fee) => lateFeeAmounts[fee.userId] === 0)
        .map((fee) => fetch(`/api/training-events/${eventId}/late-fees/${fee.id}`, { method: "DELETE" }));

      // 새로 추가하거나 업데이트할 항목
      const upsertPromises = feesToSave.map(async ({ userId, amount }) => {
        const existingFee = event!.lateFees.find((f) => f.userId === userId);
        if (existingFee && existingFee.amount !== amount) {
          // 업데이트: 삭제 후 재생성
          await fetch(`/api/training-events/${eventId}/late-fees/${existingFee.id}`, { method: "DELETE" });
          return fetch(`/api/training-events/${eventId}/late-fees`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, amount }),
          });
        } else if (!existingFee) {
          // 신규 생성
          return fetch(`/api/training-events/${eventId}/late-fees`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId, amount }),
          });
        }
        return Promise.resolve();
      });

      await Promise.all([...deletePromises, ...upsertPromises]);
      await fetchEvent();
      alert("저장되었습니다");
    } catch {
      alert("저장에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

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
        fetchEvent();
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
    if (res.ok) fetchEvent();
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
    if (!event || !editingSessionId) return;

    const attendeesList = event.rsvps
      .filter((r) => r.status === "ATTEND" || r.status === "LATE")
      .map((r) => ({ userId: r.userId, position: r.user.position }));

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
      }

      cancelEditing();
      fetchEvent();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  // 세션 순서 변경
  const handleReorderSession = async (sessionId: string, direction: "up" | "down") => {
    try {
      const res = await fetch(`/api/training-events/${eventId}/sessions/${sessionId}/reorder`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ direction }),
      });
      if (res.ok) fetchEvent();
    } catch {
      alert("순서 변경에 실패했습니다");
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

    // dataTransfer에서 데이터 가져오기
    try {
      const data = JSON.parse(e.dataTransfer.getData("text/plain"));
      moveUserToTeam(sessionId, data.userId, toTeam);
    } catch {
      // fallback to state
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

    // 터치 위치 업데이트
    setTouchDragPosition({ x: touch.clientX, y: touch.clientY });

    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!element) return;

    // 드롭 영역 찾기
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
    if (draggedSessionId && dragOverSessionIndex !== null && event) {
      const fromIndex = event.sessions.findIndex((s) => s.id === draggedSessionId);
      if (fromIndex !== -1 && fromIndex !== dragOverSessionIndex) {
        // 위/아래 방향 결정
        const direction = fromIndex < dragOverSessionIndex ? "down" : "up";
        const moves = Math.abs(dragOverSessionIndex - fromIndex);

        // 여러 번 이동
        for (let i = 0; i < moves; i++) {
          await handleReorderSession(draggedSessionId, direction);
        }
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
    if (draggedSessionId && dragOverSessionIndex !== null && event) {
      const fromIndex = event.sessions.findIndex((s) => s.id === draggedSessionId);
      if (fromIndex !== -1 && fromIndex !== dragOverSessionIndex) {
        const direction = fromIndex < dragOverSessionIndex ? "down" : "up";
        const moves = Math.abs(dragOverSessionIndex - fromIndex);

        for (let i = 0; i < moves; i++) {
          await handleReorderSession(draggedSessionId, direction);
        }
      }
    }
    setDraggedSessionId(null);
    setDragOverSessionIndex(null);
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">운동을 찾을 수 없습니다</p>
      </div>
    );
  }

  const isAdmin = session?.user?.role === "ADMIN";
  if (!isAdmin) {
    router.push(`/training/${eventId}`);
    return null;
  }

  // 참석 응답자 중 ATTEND/LATE
  const attendees = event.rsvps.filter((r) => r.status === "ATTEND" || r.status === "LATE");
  const checkedInIds = new Set(event.checkIns.map((c) => c.userId));

  const tabs: { key: Tab; label: string }[] = [
    { key: "attendance", label: "출석" },
    { key: "latefee", label: "지각비" },
    { key: "session", label: "세션" },
    { key: "equipment", label: "장비" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <BackButton href={`/training/${eventId}`} />
          <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[200px]">{event?.title || "운동 관리"}</h1>
          <div className="flex-1" />
          <Link
            href={`/training/${eventId}/edit`}
            className="text-team-500 font-medium text-sm hover:text-team-600 transition-colors"
          >
            수정
          </Link>
        </div>
      </header>

      {/* 탭 */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-lg mx-auto flex">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
                activeTab === tab.key
                  ? "text-team-600 border-b-2 border-team-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* 출석 탭 */}
        {activeTab === "attendance" && (
          <div className="bg-white rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              출석 현황 ({event.checkIns.length}/{attendees.length}명 도착)
            </h3>
            <div className="space-y-2">
              {attendees.map((rsvp) => {
                const checkIn = event.checkIns.find((c) => c.userId === rsvp.userId);
                return (
                  <div key={rsvp.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-2">
                      {checkIn ? (
                        checkIn.isLate ? (
                          <span className="text-red-500 text-sm">🔴</span>
                        ) : (
                          <span className="text-green-500 text-sm">✅</span>
                        )
                      ) : (
                        <span className="text-gray-300 text-sm">⬜</span>
                      )}
                      <span className="text-sm text-gray-900">{rsvp.user.name || "이름 없음"}</span>
                      {rsvp.status === "LATE" && (
                        <span className="text-xs text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">늦참</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      {checkIn
                        ? new Date(checkIn.checkedInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })
                        : "미도착"}
                      {checkIn?.isLate && <span className="text-red-500 ml-1">(지각)</span>}
                    </div>
                  </div>
                );
              })}
              {attendees.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">참석 응답한 멤버가 없습니다</p>
              )}
            </div>
          </div>
        )}

        {/* 지각비 탭 */}
        {activeTab === "latefee" && (
          <>
            {/* 총 금액 */}
            <div className="bg-team-50 rounded-xl px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-team-700">총 지각비</span>
                <span className="text-xl font-bold text-team-600">
                  {Object.values(lateFeeAmounts).reduce((sum, amount) => sum + amount, 0).toLocaleString()}원
                </span>
              </div>
            </div>

            {/* 지각비 리스트 */}
            <div className="bg-white rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">지각 및 미도착 명단</h3>
                <button
                  onClick={handleSaveLateFees}
                  disabled={submitting}
                  className="text-xs font-medium text-white bg-team-500 px-4 py-2 rounded-lg hover:bg-team-600 transition-colors disabled:opacity-50"
                >
                  {submitting ? "저장 중..." : "저장"}
                </button>
              </div>

              {Object.keys(lateFeeAmounts).length > 0 ? (
                <div className="space-y-3">
                  {Object.entries(lateFeeAmounts).map(([userId, amount]) => {
                    const checkIn = event.checkIns.find((c) => c.userId === userId);
                    const rsvp = event.rsvps.find((r) => r.userId === userId);
                    const user = checkIn?.user || rsvp?.user;
                    const existingFee = event.lateFees.find((f) => f.userId === userId);
                    const isLate = checkIn?.isLate;
                    const isNoShow = !checkIn && rsvp;

                    return (
                      <div key={userId} className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${amount === 0 ? 'opacity-60' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${amount === 0 ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              {user?.name || "이름 없음"}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded ${
                              isLate ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"
                            }`}>
                              {isLate ? "지각" : "미도착"}
                            </span>
                            {existingFee?.status === "PAID" && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-600">
                                납부완료
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            value={amount}
                            onChange={(e) => setLateFeeAmounts((prev) => ({ ...prev, [userId]: parseInt(e.target.value) || 0 }))}
                            className="w-24 px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:outline-none focus:border-team-300"
                          />
                          <span className="text-sm text-gray-500">원</span>
                          {existingFee && existingFee.status === "PENDING" && amount > 0 && (
                            <button
                              onClick={() => handleMarkPaid(existingFee.id)}
                              className="text-xs text-green-600 hover:text-green-700 px-2 py-1 border border-green-200 rounded"
                            >
                              완료
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">지각 또는 미도착 인원이 없습니다</p>
              )}
            </div>
          </>
        )}

        {/* 세션 탭 */}
        {activeTab === "session" && (
          <>
            {/* 참석 인원 요약 + 출석률 버튼 */}
            <div className="bg-team-50 rounded-xl px-4 py-3 flex items-center justify-between">
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

            {event.sessions.map((sess, idx) => (
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

            {event.sessions.length === 0 && !showSessionForm && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">⚽</div>
                <p className="text-sm text-gray-400">세션을 추가하여 팀을 분배하세요</p>
              </div>
            )}
          </>
        )}

        {/* 장비 탭 */}
        {activeTab === "equipment" && (
          <>
            {equipments.length === 0 ? (
              <div className="bg-white rounded-xl p-6 text-center">
                <p className="text-sm text-gray-500 mb-2">등록된 장비가 없습니다</p>
                <p className="text-xs text-gray-400">
                  팀 설정에서 장비를 먼저 추가해주세요
                </p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {equipments.map((eq) => {
                    const assignment = equipmentAssignments[eq.id] || { userId: null, memo: "" };
                    return (
                      <div key={eq.id} className="bg-white rounded-xl p-4">
                        <div className="mb-3">
                          <h4 className="text-sm font-semibold text-gray-900">{eq.name}</h4>
                          {eq.description && (
                            <p className="text-xs text-gray-500 mt-0.5">{eq.description}</p>
                          )}
                        </div>

                        <div className="space-y-2">
                          {/* 장비 관리자 표시 (읽기 전용) */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              장비 관리자
                            </label>
                            <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-700">
                              {eq.owner ? (
                                <span>{eq.owner.name || "이름 없음"}</span>
                              ) : (
                                <span className="text-gray-400">미지정</span>
                              )}
                            </div>
                          </div>

                          {/* 메모 */}
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              메모 (선택)
                            </label>
                            <input
                              type="text"
                              value={assignment.memo}
                              onChange={(e) =>
                                setEquipmentAssignments((prev) => ({
                                  ...prev,
                                  [eq.id]: { ...prev[eq.id], memo: e.target.value },
                                }))
                              }
                              placeholder="예: 공 2개, 펌프 포함"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

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
              </>
            )}
          </>
        )}
      </main>

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
    </div>
  );
}
