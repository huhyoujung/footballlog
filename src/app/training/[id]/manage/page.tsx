"use client";
import LoadingSpinner from "@/components/LoadingSpinner";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { getPositionGroup } from "@/lib/position";
import { assignBalanced, assignGrouped } from "@/lib/random-team";
import AttendanceRateModal from "@/components/AttendanceRateModal";

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

type Tab = "attendance" | "latefee" | "session";

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

  // 세션 상태
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionMemo, setSessionMemo] = useState("");
  const [sessionRequiresTeams, setSessionRequiresTeams] = useState(false);

  // 세션 수정 상태
  const [editingSessionInfo, setEditingSessionInfo] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editMemo, setEditMemo] = useState("");

  // 팀 배정 상태
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [teamAssignments, setTeamAssignments] = useState<Record<string, { userId: string; teamLabel: string }[]>>({});
  const [teamLabels, setTeamLabels] = useState<Record<string, string[]>>({});
  const [draggedUser, setDraggedUser] = useState<{ userId: string; userName: string; fromTeam: string } | null>(null);

  // 랜덤 배정 상태
  const [showRandomPanel, setShowRandomPanel] = useState<string | null>(null);
  const [randomTeamCount, setRandomTeamCount] = useState(2);

  // 출석률 모달 상태
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  useEffect(() => {
    params.then((p) => setEventId(p.id));
  }, [params]);

  useEffect(() => {
    if (eventId) fetchEvent();
  }, [eventId]);

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

  // 세션 생성
  const handleCreateSession = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: sessionTitle || null,
          memo: sessionMemo || null,
          requiresTeams: sessionRequiresTeams,
        }),
      });
      if (res.ok) {
        setShowSessionForm(false);
        setSessionTitle("");
        setSessionMemo("");
        setSessionRequiresTeams(false);
        fetchEvent();
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  // 세션 수정
  const handleUpdateSession = async (sessionId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}/sessions/${sessionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle || null,
          memo: editMemo || null,
        }),
      });
      if (res.ok) {
        setEditingSessionInfo(null);
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
    if (!confirm("이 세션을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/training-events/${eventId}/sessions/${sessionId}`, { method: "DELETE" });
    if (res.ok) fetchEvent();
  };

  // 팀 배정 편집 시작
  const startEditingTeams = useCallback((sess: SessionEntry) => {
    setEditingSession(sess.id);
    setShowRandomPanel(null);

    const assignments = sess.teamAssignments.map((a) => ({
      userId: a.userId,
      teamLabel: a.teamLabel,
    }));

    const labels = [...new Set(assignments.map((a) => a.teamLabel))];
    if (labels.length === 0) labels.push("A", "B");

    setTeamAssignments((prev) => ({ ...prev, [sess.id]: assignments }));
    setTeamLabels((prev) => ({ ...prev, [sess.id]: labels }));
  }, []);

  // 랜덤 배정 시작 (편집 모드 진입 + 패널 표시)
  const startRandomAssignment = useCallback((sess: SessionEntry) => {
    setEditingSession(sess.id);
    setShowRandomPanel(sess.id);
    setRandomTeamCount(2);

    // 기존 배정 초기화
    setTeamAssignments((prev) => ({ ...prev, [sess.id]: [] }));
    setTeamLabels((prev) => ({ ...prev, [sess.id]: ["A", "B"] }));
  }, []);

  // 랜덤 배정 실행
  const executeRandomAssignment = (sessionId: string, mode: "balanced" | "grouped") => {
    if (!event) return;

    const attendeesList = event.rsvps
      .filter((r) => r.status === "ATTEND" || r.status === "LATE")
      .map((r) => ({ userId: r.userId, position: r.user.position }));

    const assignments = mode === "balanced"
      ? assignBalanced(attendeesList, randomTeamCount)
      : assignGrouped(attendeesList, randomTeamCount);

    // 팀 라벨 생성
    const labels = Array.from({ length: randomTeamCount }, (_, i) => String.fromCharCode(65 + i));

    setTeamAssignments((prev) => ({ ...prev, [sessionId]: assignments }));
    setTeamLabels((prev) => ({ ...prev, [sessionId]: labels }));
    setShowRandomPanel(null);
  };

  // 팀 추가
  const addTeamLabel = (sessionId: string) => {
    const current = teamLabels[sessionId] || ["A", "B"];
    const nextChar = String.fromCharCode(65 + current.length);
    setTeamLabels((prev) => ({ ...prev, [sessionId]: [...current, nextChar] }));
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

  // 팀 배정 저장
  const saveTeamAssignments = async (sessionId: string) => {
    setSubmitting(true);
    try {
      const assignments = teamAssignments[sessionId] || [];
      const res = await fetch(`/api/training-events/${eventId}/sessions/${sessionId}/teams`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      if (res.ok) {
        setEditingSession(null);
        setShowRandomPanel(null);
        fetchEvent();
      }
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
  ];

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <Link href={`/training/${eventId}`} className="text-gray-500 hover:text-gray-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
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
            <div className="bg-white rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">지각비 현황</h3>
              {event.lateFees.length > 0 ? (
                <div className="space-y-2">
                  {event.lateFees.map((fee) => (
                    <div key={fee.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900">{fee.user.name || "이름 없음"}</span>
                        <span className="text-sm font-medium text-gray-700">
                          {fee.amount.toLocaleString()}원
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          fee.status === "PAID" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                        }`}>
                          {fee.status === "PAID" ? "납부" : "미납"}
                        </span>
                      </div>
                      <div className="flex gap-1">
                        {fee.status === "PENDING" && (
                          <button
                            onClick={() => handleMarkPaid(fee.id)}
                            className="text-xs text-green-600 hover:text-green-700 px-2 py-1"
                          >
                            완료
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteLateFee(fee.id)}
                          className="text-xs text-red-400 hover:text-red-500 px-2 py-1"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">지각비 내역이 없습니다</p>
              )}
            </div>

            {/* 지각비 추가 */}
            {!showLateFeeForm ? (
              <button
                onClick={() => setShowLateFeeForm(true)}
                className="w-full py-3 bg-white rounded-xl text-sm font-medium text-team-600 hover:bg-team-50 transition-colors border border-team-100"
              >
                + 지각비 추가
              </button>
            ) : (
              <div className="bg-white rounded-xl p-5 space-y-3">
                <h4 className="text-sm font-semibold text-gray-900">지각비 부과</h4>
                <select
                  value={lateFeeUserId}
                  onChange={(e) => setLateFeeUserId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
                >
                  <option value="">멤버 선택</option>
                  {event.checkIns
                    .filter((c) => c.isLate)
                    .filter((c) => !event.lateFees.some((f) => f.userId === c.userId))
                    .map((c) => (
                      <option key={c.userId} value={c.userId}>
                        {c.user.name || "이름 없음"} (지각)
                      </option>
                    ))}
                  {attendees
                    .filter((r) => !checkedInIds.has(r.userId))
                    .map((r) => (
                      <option key={r.userId} value={r.userId}>
                        {r.user.name || "이름 없음"} (미도착)
                      </option>
                    ))}
                </select>
                <input
                  type="number"
                  value={lateFeeAmount}
                  onChange={(e) => setLateFeeAmount(e.target.value)}
                  placeholder="금액 (원)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowLateFeeForm(false)}
                    className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleAddLateFee}
                    disabled={!lateFeeUserId || !lateFeeAmount || submitting}
                    className="flex-1 py-2 text-sm text-white bg-team-500 rounded-lg disabled:opacity-50"
                  >
                    {submitting ? "처리 중..." : "부과하기"}
                  </button>
                </div>
              </div>
            )}
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
              <div key={sess.id} className="bg-white rounded-xl overflow-hidden">
                {/* 세션 헤더 */}
                <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                  {editingSessionInfo === sess.id ? (
                    /* 편집 모드 */
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-team-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          placeholder={`세션 ${idx + 1}`}
                          className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm text-gray-900 focus:outline-none focus:border-team-300"
                        />
                      </div>
                      <textarea
                        value={editMemo}
                        onChange={(e) => setEditMemo(e.target.value)}
                        placeholder="메모 (선택)"
                        rows={2}
                        className="w-full ml-8 px-2 py-1.5 border border-gray-200 rounded text-xs text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:border-team-300"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => setEditingSessionInfo(null)}
                          className="text-xs text-gray-500 px-3 py-1 border border-gray-200 rounded"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => handleUpdateSession(sess.id)}
                          disabled={submitting}
                          className="text-xs text-white bg-team-500 px-3 py-1 rounded disabled:opacity-50"
                        >
                          {submitting ? "저장 중..." : "저장"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 읽기 모드 */
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 bg-team-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <h3 className="text-sm font-semibold text-gray-900">
                            {sess.title || `세션 ${idx + 1}`}
                          </h3>
                        </div>
                        <div className="flex gap-1">
                          {/* 순서 변경 버튼 */}
                          <button
                            onClick={() => handleReorderSession(sess.id, "up")}
                            disabled={idx === 0}
                            className="text-xs text-gray-400 hover:text-team-500 p-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="18 15 12 9 6 15" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleReorderSession(sess.id, "down")}
                            disabled={idx === event.sessions.length - 1}
                            className="text-xs text-gray-400 hover:text-team-500 p-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          <button
                            onClick={() => {
                              setEditingSessionInfo(sess.id);
                              setEditTitle(sess.title || "");
                              setEditMemo(sess.memo || "");
                            }}
                            className="text-xs text-gray-400 hover:text-team-500 p-1 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteSession(sess.id)}
                            className="text-xs text-gray-400 hover:text-red-500 p-1 transition-colors"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18" />
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {sess.memo && <p className="text-xs text-gray-500 mt-1.5 ml-8">{sess.memo}</p>}
                    </>
                  )}
                </div>

                <div className="p-5">
                  {!sess.requiresTeams ? (
                    /* 팀 분배 불필요 */
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-500">
                      <span>💡</span>
                      <span>전체 함께 진행</span>
                    </div>
                  ) : editingSession === sess.id ? (
                    <div className="space-y-3">
                      {/* 랜덤 배정 패널 */}
                      {showRandomPanel === sess.id && (
                        <div className="bg-team-50 rounded-lg p-3 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-team-700">팀 수</span>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setRandomTeamCount((c) => Math.max(2, c - 1))}
                                className="w-7 h-7 flex items-center justify-center bg-white border border-team-200 rounded text-team-700 text-sm font-semibold"
                              >
                                −
                              </button>
                              <span className="text-sm font-bold text-team-700 w-4 text-center">{randomTeamCount}</span>
                              <button
                                onClick={() => setRandomTeamCount((c) => Math.min(4, c + 1))}
                                className="w-7 h-7 flex items-center justify-center bg-white border border-team-200 rounded text-team-700 text-sm font-semibold"
                              >
                                +
                              </button>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => executeRandomAssignment(sess.id, "balanced")}
                              className="flex-1 py-2 bg-team-500 text-white text-xs font-semibold rounded-lg"
                            >
                              🔀 포지션 골고루
                            </button>
                            <button
                              onClick={() => executeRandomAssignment(sess.id, "grouped")}
                              className="flex-1 py-2 bg-white text-team-700 text-xs font-semibold rounded-lg border border-team-200"
                            >
                              🎯 포지션끼리
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 미배정 풀 */}
                      <div
                        className="border-2 border-dashed border-gray-200 rounded-lg p-3 min-h-[48px] transition-colors"
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, sess.id, "unassigned")}
                      >
                        <div className="text-xs font-medium text-gray-400 mb-2">미배정</div>
                        <div className="flex flex-wrap gap-1.5">
                          {attendees
                            .filter((r) => !(teamAssignments[sess.id] || []).some((a) => a.userId === r.userId))
                            .map((r) => (
                              <div
                                key={r.userId}
                                draggable
                                onDragStart={(e) => handleDragStart(e, r.userId, r.user.name || "이름 없음", "unassigned")}
                                className="inline-flex flex-col items-center cursor-grab active:cursor-grabbing select-none"
                                style={{ width: "60px" }}
                              >
                                {/* 선수 아이콘 */}
                                <svg width="48" height="56" viewBox="0 0 24 28" fill="none" className="text-gray-600">
                                  {/* 머리 */}
                                  <circle cx="12" cy="4" r="3" fill="currentColor" />
                                  {/* 몸통 */}
                                  <path d="M12 8 L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  {/* 팔 */}
                                  <path d="M6 11 L12 10 L18 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  {/* 다리 */}
                                  <path d="M12 16 L9 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                  <path d="M12 16 L15 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                </svg>
                                {/* 이름 */}
                                <span className="text-[9px] font-medium text-gray-700 mt-0.5 text-center leading-tight truncate max-w-full px-0.5">
                                  {r.user.name || "이름 없음"}
                                </span>
                                {/* 포지션 */}
                                {r.user.position && (
                                  <span className="text-[7px] font-semibold text-gray-400 uppercase">
                                    {getPositionGroup(r.user.position)}
                                  </span>
                                )}
                              </div>
                            ))}
                        </div>
                      </div>

                      {/* 팀별 드롭 영역 */}
                      {(teamLabels[sess.id] || ["A", "B"]).map((label) => {
                        const teamMembers = (teamAssignments[sess.id] || []).filter((a) => a.teamLabel === label);
                        const summary = getTeamPositionSummary(
                          teamMembers.map((m) => m.userId),
                          attendees
                        );
                        return (
                          <div
                            key={label}
                            className="border border-team-200 bg-team-50/30 rounded-lg p-3 min-h-[48px] transition-colors"
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, sess.id, label)}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-1.5">
                                <span className="w-5 h-5 bg-team-500 text-white text-[10px] font-bold rounded flex items-center justify-center">
                                  {label}
                                </span>
                                <span className="text-xs font-semibold text-team-700">{teamMembers.length}명</span>
                              </div>
                              {summary && (
                                <span className="text-[9px] text-team-400 bg-team-50 px-1.5 py-0.5 rounded">{summary}</span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {teamMembers.map((a) => {
                                const user = attendees.find((r) => r.userId === a.userId)?.user;
                                return (
                                  <div
                                    key={a.userId}
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, a.userId, user?.name || "이름 없음", label)}
                                    className="inline-flex flex-col items-center cursor-grab active:cursor-grabbing select-none"
                                    style={{ width: "60px" }}
                                  >
                                    {/* 선수 아이콘 */}
                                    <svg width="48" height="56" viewBox="0 0 24 28" fill="none" className="text-team-600">
                                      {/* 머리 */}
                                      <circle cx="12" cy="4" r="3" fill="currentColor" />
                                      {/* 몸통 */}
                                      <path d="M12 8 L12 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                      {/* 팔 */}
                                      <path d="M6 11 L12 10 L18 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                      {/* 다리 */}
                                      <path d="M12 16 L9 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                      <path d="M12 16 L15 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                    </svg>
                                    {/* 이름 */}
                                    <span className="text-[9px] font-medium text-team-700 mt-0.5 text-center leading-tight truncate max-w-full px-0.5">
                                      {user?.name || "이름 없음"}
                                    </span>
                                    {/* 포지션 */}
                                    {user?.position && (
                                      <span className="text-[7px] font-semibold text-team-400 uppercase">
                                        {getPositionGroup(user.position)}
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                              {teamMembers.length === 0 && (
                                <span className="text-xs text-gray-300 py-1">여기에 드래그</span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => addTeamLabel(sess.id)}
                          className="text-xs text-team-600 hover:text-team-700 px-3 py-1.5 border border-team-100 rounded-lg"
                        >
                          + 팀 추가
                        </button>
                        <div className="flex-1" />
                        <button
                          onClick={() => { setEditingSession(null); setShowRandomPanel(null); }}
                          className="text-xs text-gray-500 px-3 py-1.5 border border-gray-200 rounded-lg"
                        >
                          취소
                        </button>
                        <button
                          onClick={() => saveTeamAssignments(sess.id)}
                          disabled={submitting}
                          className="text-xs text-white bg-team-500 px-4 py-1.5 rounded-lg disabled:opacity-50"
                        >
                          {submitting ? "저장 중..." : "저장"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* 팀 배정 읽기 모드 */
                    <div>
                      {sess.teamAssignments.length > 0 ? (
                        <div className="space-y-2.5">
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
                            <div key={label} className="bg-gray-50 rounded-lg p-3">
                              <div className="flex items-center gap-1.5 mb-1.5">
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
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-2">팀이 아직 배정되지 않았어요</p>
                      )}

                      {/* 편집 버튼 */}
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => startEditingTeams(sess)}
                          className="flex-1 py-2 text-xs font-medium text-team-600 bg-white border border-team-200 rounded-lg hover:bg-team-50 transition-colors"
                        >
                          팀 배정
                        </button>
                        <button
                          onClick={() => startRandomAssignment(sess)}
                          className="flex-1 py-2 text-xs font-semibold text-white bg-team-500 rounded-lg hover:bg-team-600 transition-colors"
                        >
                          🔀 랜덤 배정
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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
                <textarea
                  value={sessionMemo}
                  onChange={(e) => setSessionMemo(e.target.value)}
                  placeholder="메모 (선택)"
                  rows={2}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:outline-none focus:border-team-300 transition-colors"
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
                    onClick={() => { setShowSessionForm(false); setSessionTitle(""); setSessionMemo(""); setSessionRequiresTeams(false); }}
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
      </main>

      {/* 출석률 모달 */}
      <AttendanceRateModal
        isOpen={showAttendanceModal}
        onClose={() => setShowAttendanceModal(false)}
      />
    </div>
  );
}
