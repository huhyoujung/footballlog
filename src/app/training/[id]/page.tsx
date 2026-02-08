"use client";
import LoadingSpinner from "@/components/LoadingSpinner";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import type { TrainingEventDetail, RsvpEntry, RsvpStatus } from "@/types/training-event";
import PomVoting from "@/components/PomVoting";

export default function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { data: session } = useSession();
  const [eventId, setEventId] = useState<string>("");
  const [event, setEvent] = useState<TrainingEventDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditRsvp, setShowEditRsvp] = useState(false);

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
        setRsvpStatus(data.myRsvp);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async (status: RsvpStatus) => {
    if ((status === "ABSENT" || status === "LATE") && !reason.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason.trim() || null }),
      });
      if (res.ok) {
        setRsvpStatus(status);
        fetchEvent();
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckIn = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}/check-in`, {
        method: "POST",
      });
      if (res.ok) {
        fetchEvent();
      } else {
        const data = await res.json();
        alert(data.error || "체크인에 실패했습니다");
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelCheckIn = async () => {
    if (!confirm("체크인을 취소하시겠습니까?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}/check-in`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchEvent();
      } else {
        const data = await res.json();
        alert(data.error || "취소에 실패했습니다");
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("정말 이 운동을 삭제하시겠습니까?")) return;
    const res = await fetch(`/api/training-events/${eventId}`, { method: "DELETE" });
    if (res.ok) router.push("/");
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
  const isDeadlinePassed = new Date() > new Date(event.rsvpDeadline);

  // 체크인 가능 시간: 운동 시작 2시간 전 ~ 운동 시작 시간까지
  const now = new Date();
  const eventDate = new Date(event.date);
  const twoHoursBefore = new Date(eventDate.getTime() - 2 * 60 * 60 * 1000);
  const canCheckIn = now >= twoHoursBefore && now <= eventDate;

  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const deadlineStr = new Date(event.rsvpDeadline).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // RSVP 분류
  const attendees = event.rsvps.filter((r: RsvpEntry) => r.status === "ATTEND");
  const absentees = event.rsvps.filter((r: RsvpEntry) => r.status === "ABSENT");
  const lateComers = event.rsvps.filter((r: RsvpEntry) => r.status === "LATE");

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      {/* 헤더 */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">{event?.title || "팀 운동"}</h1>
          {isAdmin ? (
            <div className="relative">
              <button onClick={() => setShowMenu(!showMenu)} className="text-gray-500 hover:text-gray-700 p-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                </svg>
              </button>
              {showMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[120px] z-20">
                  <Link href={`/training/${eventId}/manage`} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50" onClick={() => setShowMenu(false)}>
                    관리하기
                  </Link>
                  <button onClick={handleDelete} className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-gray-50">
                    삭제하기
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="w-6" />
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-3">
        {/* 운동 정보 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-900">
              <span>⚽</span>
              <span className="font-semibold">{dateStr}</span>
            </div>
            {event.isRegular && (
              <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full">정기</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>📍</span>
            <span>{event.location}</span>
          </div>
          {event.shoes.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>👟</span>
              <span>{event.shoes.join(", ")} 권장</span>
            </div>
          )}
          {event.uniform && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>👕</span>
              <span>{event.uniform}</span>
            </div>
          )}
          {event.notes && (
            <div className="flex items-start gap-2 text-sm text-gray-600 border-t border-gray-100 -mx-5 px-5 py-3 mt-3">
              <span className="mt-0.5">💡</span>
              <div className="flex-1 whitespace-pre-wrap">{event.notes}</div>
            </div>
          )}
          {(event.vestBringer || event.vestReceiver) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>🧺</span>
              <span>
                조끼: {event.vestBringer?.name || "미정"} → {event.vestReceiver?.name || "미정"}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>⏰</span>
            <span>응답 마감: {deadlineStr}</span>
            {isDeadlinePassed && <span className="text-xs text-red-500 font-medium">마감됨</span>}
          </div>
        </div>

        {/* RSVP - 응답하지 않은 경우에만 표시 */}
        {!isDeadlinePassed && !event.myRsvp && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">나의 참석 여부</h3>
            <div className="flex gap-2 mb-3">
              {(["ATTEND", "ABSENT", "LATE"] as RsvpStatus[]).map((s) => {
                const labels = { ATTEND: "참석", ABSENT: "불참", LATE: "늦참" };
                const colors = {
                  ATTEND: rsvpStatus === "ATTEND" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700",
                  ABSENT: rsvpStatus === "ABSENT" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-700",
                  LATE: rsvpStatus === "LATE" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700",
                };
                return (
                  <button
                    key={s}
                    onClick={() => {
                      if (s === "ATTEND") handleRsvp("ATTEND");
                      else setRsvpStatus(s);
                    }}
                    disabled={submitting}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${colors[s]}`}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
            {(rsvpStatus === "ABSENT" || rsvpStatus === "LATE") && (
              <div className="space-y-2">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="사유를 입력해주세요"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={() => handleRsvp(rsvpStatus)}
                  disabled={!reason.trim() || submitting}
                  className="w-full py-2 bg-team-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? "전송 중..." : "응답 제출"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 참석 현황 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            참석 현황 ({event.rsvps.length}명 응답)
          </h3>

          {/* 내 응답 표시 및 수정 */}
          {event.myRsvp && !isDeadlinePassed && (
            <div className="mb-4 p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">내 응답</span>
                  <span className={`text-sm font-semibold ${
                    event.myRsvp === "ATTEND" ? "text-green-600" :
                    event.myRsvp === "ABSENT" ? "text-red-600" : "text-yellow-600"
                  }`}>
                    {event.myRsvp === "ATTEND" ? "✅ 참석" : event.myRsvp === "ABSENT" ? "❌ 불참" : "⏰ 늦참"}
                  </span>
                </div>
                <button
                  onClick={() => setShowEditRsvp(!showEditRsvp)}
                  className="text-xs text-team-600 hover:text-team-700 font-medium px-2 py-1"
                >
                  {showEditRsvp ? "취소" : "수정"}
                </button>
              </div>

              {showEditRsvp && (
                <div className="space-y-2 pt-3 mt-3 border-t border-gray-100">
                  <div className="flex gap-2">
                    {(["ATTEND", "ABSENT", "LATE"] as RsvpStatus[]).map((s) => {
                      const labels = { ATTEND: "참석", ABSENT: "불참", LATE: "늦참" };
                      const colors = {
                        ATTEND: rsvpStatus === "ATTEND" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700",
                        ABSENT: rsvpStatus === "ABSENT" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-700",
                        LATE: rsvpStatus === "LATE" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700",
                      };
                      return (
                        <button
                          key={s}
                          onClick={() => {
                            if (s === "ATTEND") {
                              handleRsvp("ATTEND");
                              setShowEditRsvp(false);
                            } else {
                              setRsvpStatus(s);
                            }
                          }}
                          disabled={submitting}
                          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${colors[s]}`}
                        >
                          {labels[s]}
                        </button>
                      );
                    })}
                  </div>
                  {(rsvpStatus === "ABSENT" || rsvpStatus === "LATE") && (
                    <div className="space-y-2">
                      <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="사유를 입력해주세요"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
                      />
                      <button
                        onClick={() => {
                          handleRsvp(rsvpStatus);
                          setShowEditRsvp(false);
                        }}
                        disabled={!reason.trim() || submitting}
                        className="w-full py-2 bg-team-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                      >
                        {submitting ? "전송 중..." : "응답 수정"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {attendees.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-green-600 mb-1">✅ 참석 ({attendees.length}명)</div>
              <p className="text-sm text-gray-700">
                {attendees.map((r: RsvpEntry) => r.user.name || "이름 없음").join(", ")}
              </p>
            </div>
          )}
          {absentees.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-red-600 mb-1">❌ 불참 ({absentees.length}명)</div>
              {absentees.map((r: RsvpEntry) => (
                <p key={r.id} className="text-sm text-gray-700">
                  {r.user.name || "이름 없음"} — <span className="text-gray-500">{r.reason}</span>
                </p>
              ))}
            </div>
          )}
          {lateComers.length > 0 && (
            <div className="mb-3">
              <div className="text-xs font-medium text-yellow-600 mb-1">⏰ 늦참 ({lateComers.length}명)</div>
              {lateComers.map((r: RsvpEntry) => (
                <p key={r.id} className="text-sm text-gray-700">
                  {r.user.name || "이름 없음"} — <span className="text-gray-500">{r.reason}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        {/* 체크인 (운동 2시간 전부터) */}
        {canCheckIn && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">체크인</h3>
            {event.myCheckIn ? (
              <div className="text-center py-3">
                <div className="text-green-500 text-lg font-semibold">✅ 체크인 완료</div>
                <div className="text-sm text-gray-500 mt-1">
                  도착: {new Date(event.myCheckIn).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                </div>
                <button
                  onClick={handleCancelCheckIn}
                  disabled={submitting}
                  className="mt-3 text-sm text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
                >
                  체크인 취소
                </button>
              </div>
            ) : (rsvpStatus === "ATTEND" || rsvpStatus === "LATE") ? (
              <button
                onClick={handleCheckIn}
                disabled={submitting}
                className="w-full py-3 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
              >
                {submitting ? "체크인 중..." : "✅ 도착 체크인"}
              </button>
            ) : (
              <p className="text-sm text-gray-400 text-center py-3">
                참석 응답 후 체크인할 수 있습니다
              </p>
            )}
          </div>
        )}

        {/* 세션 정보 (모두 볼 수 있음) */}
        {event.sessions.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">세션</h3>
            <div className="space-y-3">
              {event.sessions.map((s, idx) => (
                <div key={s.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-6 h-6 bg-team-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                      {idx + 1}
                    </span>
                    <h4 className="text-sm font-semibold text-gray-900">
                      {s.title || `세션 ${idx + 1}`}
                    </h4>
                  </div>
                  {s.memo && <p className="text-xs text-gray-500 mt-1">{s.memo}</p>}
                  {!s.requiresTeams ? (
                    <div className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                      <span>👥</span>
                      <span>전체 함께 진행</span>
                    </div>
                  ) : s.teamAssignments.length > 0 ? (
                    <div className="mt-2 space-y-1">
                      {Object.entries(
                        s.teamAssignments.reduce<Record<string, string[]>>((acc, a) => {
                          if (!acc[a.teamLabel]) acc[a.teamLabel] = [];
                          acc[a.teamLabel].push(a.user.name || "이름 없음");
                          return acc;
                        }, {})
                      ).map(([label, names]) => (
                        <div key={label} className="text-xs text-gray-600">
                          <span className="font-medium text-team-600">{label}팀:</span>{" "}
                          {names.join(", ")}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* POM 투표 (체크인한 사람들 대상) */}
        {event.checkIns.length > 0 && (
          <PomVoting
            eventId={event.id}
            eventDate={event.date}
            checkIns={event.checkIns}
          />
        )}

        {/* 장비 정보 */}
        {event.equipmentAssignments && event.equipmentAssignments.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">장비</h3>
            <div className="space-y-2">
              {event.equipmentAssignments.map((assignment) => (
                <div key={assignment.id} className="flex items-start gap-2 text-sm">
                  <span className="text-gray-900 font-medium">{assignment.equipment.name}:</span>
                  <div className="flex-1">
                    <span className="text-gray-700">
                      {assignment.user?.name || "미배정"}
                    </span>
                    {assignment.memo && (
                      <span className="text-gray-500 ml-1">"{assignment.memo}"</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
