"use client";

import { useState } from "react";
import type { TrainingEventDetail, RsvpEntry, RsvpStatus } from "@/types/training-event";
import type { Session } from "next-auth";
import PomVoting from "@/components/PomVoting";
import { useTeam } from "@/contexts/TeamContext";
import Image from "next/image";

interface Props {
  event: TrainingEventDetail;
  session: Session | null;
  onRefresh: () => void;
}

export default function BasicInfoTab({ event, session, onRefresh }: Props) {
  const { teamData } = useTeam();
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | null>(event.myRsvp);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showEditRsvp, setShowEditRsvp] = useState(false);
  const [showAttendance, setShowAttendance] = useState(true);
  const [showAttendees, setShowAttendees] = useState(true);
  const [showAbsentees, setShowAbsentees] = useState(true);
  const [showLateComers, setShowLateComers] = useState(true);
  const [showNoResponse, setShowNoResponse] = useState(true);
  const [showSessions, setShowSessions] = useState(true);
  const [showPomVoting, setShowPomVoting] = useState(true);

  const isDeadlinePassed = new Date() > new Date(event.rsvpDeadline);

  // 체크인 가능 시간: 운동 시작 2시간 전 ~ 운동 시작 2시간 후까지
  const now = new Date();
  const eventDate = new Date(event.date);
  const twoHoursBefore = new Date(eventDate.getTime() - 2 * 60 * 60 * 1000);
  const twoHoursAfter = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
  const canCheckIn = now >= twoHoursBefore && now <= twoHoursAfter;

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

  // 미응답자 계산 (전체 팀원 - 응답자)
  const respondedUserIds = new Set(event.rsvps.map((r: RsvpEntry) => r.userId));
  const noResponse = teamData?.members.filter((m) => !respondedUserIds.has(m.id)) || [];

  const handleRsvp = async (status: RsvpStatus) => {
    if ((status === "ABSENT" || status === "LATE") && !reason.trim()) {
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${event.id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason.trim() || null }),
      });
      if (res.ok) {
        setRsvpStatus(status);
        onRefresh();
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
      const res = await fetch(`/api/training-events/${event.id}/check-in`, {
        method: "POST",
      });
      if (res.ok) {
        onRefresh();
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
      const res = await fetch(`/api/training-events/${event.id}/check-in`, {
        method: "DELETE",
      });
      if (res.ok) {
        onRefresh();
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

  return (
    <div className="space-y-3">
      {/* 운동 정보 */}
      <div className="bg-white rounded-xl p-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-900">
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
          <div className="flex items-start gap-2 text-sm text-gray-600 border-t border-gray-100 -mx-5 px-5 pt-2.5">
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
          <span>응답 마감: {deadlineStr} {isDeadlinePassed && <span className="text-gray-400">(마감됨)</span>}</span>
        </div>
      </div>

      {/* RSVP - 응답하지 않은 경우에만 표시 */}
      {!isDeadlinePassed && !event.myRsvp && (
        <div className="bg-white rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">나의 참석 여부</h3>
          <div className="flex gap-2 mb-3">
            {(["ATTEND", "ABSENT", "LATE"] as RsvpStatus[]).map((s) => {
              const labels = { ATTEND: "정참", ABSENT: "불참", LATE: "늦참" };
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

      {/* 체크인 (운동 2시간 전부터) */}
      {canCheckIn && (
        <div className="bg-white rounded-xl p-5">
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
              RSVP 후 체크인할 수 있습니다
            </p>
          )}
        </div>
      )}

      {/* POM 투표 (체크인한 사람들 대상) - enablePomVoting이 true이고 체크인한 사람들이 있을 때만 표시 */}
      {event.enablePomVoting && event.checkIns.length > 0 && (
        <div className="bg-white rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setShowPomVoting(!showPomVoting)}>
            <h3 className="text-sm font-semibold text-gray-900">MVP 투표</h3>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-gray-500 transition-transform ${showPomVoting ? '' : '-rotate-90'}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          {showPomVoting && (
            <div className="pt-3 border-t border-gray-100">
              <PomVoting
                eventId={event.id}
                eventDate={event.date}
                pomVotingDeadline={event.pomVotingDeadline}
                checkIns={event.checkIns}
              />
            </div>
          )}
        </div>
      )}

      {/* 참석 현황 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-900">참석 현황</h3>
          {event.checkIns.length > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">
              {event.checkIns.length}/{attendees.length + lateComers.length}명 도착
            </p>
          )}
        </div>

        <div className="space-y-2">
        {attendees.length > 0 && (
          <div className="bg-gray-50 rounded-lg">
            <div
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => setShowAttendees(!showAttendees)}
            >
              <div className="text-xs font-semibold text-gray-700">정참 ({attendees.length}명)</div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-gray-500 transition-transform ${showAttendees ? '' : '-rotate-90'}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
            {showAttendees && (
            <div className="px-3 pb-3 space-y-2">
              {attendees.map((r: RsvpEntry) => {
                const isMe = r.user.id === session?.user?.id;
                const checkIn = event.checkIns.find((c) => c.userId === r.userId);
                return (
                  <div key={r.id}>
                    <div className="flex items-center gap-3 py-1.5">
                      {/* 프로필 이미지 */}
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {r.user.image ? (
                          <Image
                            src={r.user.image}
                            alt={r.user.name || ""}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-team-50" />
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* 이름 */}
                        <span className="text-sm font-medium text-gray-900">
                          {r.user.name || "익명"}
                        </span>

                        {/* 체크인 시간 */}
                        {checkIn && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <span>
                              {new Date(checkIn.checkedInAt).toLocaleTimeString("ko-KR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {checkIn.isLate ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-red-500 flex-shrink-0">
                                <circle cx="12" cy="12" r="10" fill="currentColor" />
                              </svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-green-500 flex-shrink-0">
                                <circle cx="12" cy="12" r="10" fill="currentColor" />
                                <path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                        )}

                        {/* 뱃지 및 버튼 */}
                        <div className="flex items-center gap-2 ml-auto">
                          {isMe && (
                            <span className="px-2 py-0.5 bg-team-50 text-team-700 text-[10px] font-medium rounded-full">
                              나
                            </span>
                          )}
                          {isMe && !isDeadlinePassed && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowEditRsvp(!showEditRsvp);
                              }}
                              className="text-xs text-team-600 hover:text-team-700 font-medium underline"
                            >
                              수정
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    {isMe && showEditRsvp && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex gap-2">
                          {(["ATTEND", "ABSENT", "LATE"] as RsvpStatus[]).map((s) => {
                            const labels = { ATTEND: "정참", ABSENT: "불참", LATE: "늦참" };
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
                );
              })}
            </div>
            )}
          </div>
        )}
        {absentees.length > 0 && (
          <div className="bg-red-50 rounded-lg border border-red-100">
            <div
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => setShowAbsentees(!showAbsentees)}
            >
              <div className="text-xs font-semibold text-red-700">불참 ({absentees.length}명)</div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-red-600 transition-transform ${showAbsentees ? '' : '-rotate-90'}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
            {showAbsentees && (
            <div className="px-3 pb-3 space-y-2">
              {absentees.map((r: RsvpEntry) => {
                const isMe = r.user.id === session?.user?.id;
                return (
                  <div key={r.id}>
                    <div className="flex items-center gap-3 py-1.5">
                      {/* 프로필 이미지 */}
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {r.user.image ? (
                          <Image
                            src={r.user.image}
                            alt={r.user.name || ""}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-team-50" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {/* 이름 */}
                          <span className="text-sm font-medium text-gray-900">
                            {r.user.name || "익명"}
                          </span>

                          {/* 뱃지 및 버튼 */}
                          <div className="flex items-center gap-2 ml-auto">
                            {isMe && (
                              <span className="px-2 py-0.5 bg-team-50 text-team-700 text-[10px] font-medium rounded-full">
                                나
                              </span>
                            )}
                            {isMe && !isDeadlinePassed && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEditRsvp(!showEditRsvp);
                                }}
                                className="text-xs text-team-600 hover:text-team-700 font-medium underline"
                              >
                                수정
                              </button>
                            )}
                          </div>
                        </div>
                        {/* 불참 사유 */}
                        <div className="text-xs text-gray-500 mt-0.5">{r.reason}</div>
                      </div>
                    </div>
                    {isMe && showEditRsvp && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex gap-2">
                          {(["ATTEND", "ABSENT", "LATE"] as RsvpStatus[]).map((s) => {
                            const labels = { ATTEND: "정참", ABSENT: "불참", LATE: "늦참" };
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
                );
              })}
            </div>
            )}
          </div>
        )}
        {lateComers.length > 0 && (
          <div className="bg-yellow-50 rounded-lg border border-yellow-100">
            <div
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => setShowLateComers(!showLateComers)}
            >
              <div className="text-xs font-semibold text-yellow-700">늦참 ({lateComers.length}명)</div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-yellow-600 transition-transform ${showLateComers ? '' : '-rotate-90'}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
            {showLateComers && (
            <div className="px-3 pb-3 space-y-2">
              {lateComers.map((r: RsvpEntry) => {
                const isMe = r.user.id === session?.user?.id;
                const checkIn = event.checkIns.find((c) => c.userId === r.userId);
                return (
                  <div key={r.id}>
                    <div className="flex items-center gap-3 py-1.5">
                      {/* 프로필 이미지 */}
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {r.user.image ? (
                          <Image
                            src={r.user.image}
                            alt={r.user.name || ""}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-team-50" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          {/* 이름 */}
                          <span className="text-sm font-medium text-gray-900">
                            {r.user.name || "익명"}
                          </span>

                          {/* 체크인 시간 */}
                          {checkIn && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <span>
                                {new Date(checkIn.checkedInAt).toLocaleTimeString("ko-KR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {checkIn.isLate ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-red-500 flex-shrink-0">
                                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                                </svg>
                              ) : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-green-500 flex-shrink-0">
                                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                                  <path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                          )}

                          {/* 뱃지 및 버튼 */}
                          <div className="flex items-center gap-2 ml-auto">
                            {isMe && (
                              <span className="px-2 py-0.5 bg-team-50 text-team-700 text-[10px] font-medium rounded-full">
                                나
                              </span>
                            )}
                            {isMe && !isDeadlinePassed && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEditRsvp(!showEditRsvp);
                                }}
                                className="text-xs text-team-600 hover:text-team-700 font-medium underline"
                              >
                                수정
                              </button>
                            )}
                          </div>
                        </div>
                        {/* 늦참 사유 */}
                        <div className="text-xs text-gray-500 mt-0.5">{r.reason}</div>
                      </div>
                    </div>
                    {isMe && showEditRsvp && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex gap-2">
                          {(["ATTEND", "ABSENT", "LATE"] as RsvpStatus[]).map((s) => {
                            const labels = { ATTEND: "정참", ABSENT: "불참", LATE: "늦참" };
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
                );
              })}
            </div>
            )}
          </div>
        )}
        {noResponse.length > 0 && (
          <div className="bg-gray-50 rounded-lg">
            <div
              className="flex items-center justify-between p-3 cursor-pointer"
              onClick={() => setShowNoResponse(!showNoResponse)}
            >
              <div className="text-xs font-semibold text-gray-500">미응답 ({noResponse.length}명)</div>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-gray-400 transition-transform ${showNoResponse ? '' : '-rotate-90'}`}
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </div>
            {showNoResponse && (
            <div className="px-3 pb-3 space-y-2">
              {noResponse.map((member) => {
                const isMe = member.id === session?.user?.id;
                return (
                  <div key={member.id} className="flex items-center gap-3 py-1.5">
                    {/* 프로필 이미지 */}
                    <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={member.name || ""}
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-team-50" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {/* 이름 */}
                      <span className="text-sm font-medium text-gray-900">
                        {member.name || "익명"}
                      </span>

                      {/* 나 뱃지 */}
                      {isMe && (
                        <span className="px-2 py-0.5 bg-team-50 text-team-700 text-[10px] font-medium rounded-full ml-auto">
                          나
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* 세션 정보 (모두 볼 수 있음) */}
      {event.sessions.length > 0 && (
        <div className="bg-white rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setShowSessions(!showSessions)}>
            <h3 className="text-sm font-semibold text-gray-900">세션</h3>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-gray-500 transition-transform ${showSessions ? '' : '-rotate-90'}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          {showSessions && (
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
          )}
        </div>
      )}
    </div>
  );
}
