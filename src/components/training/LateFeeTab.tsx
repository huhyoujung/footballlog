"use client";

import { useState, useEffect } from "react";

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

interface Props {
  eventId: string;
  eventDate: string;
  rsvps: RsvpEntry[];
  checkIns: CheckInEntry[];
  lateFees: LateFeeEntry[];
  onRefresh: () => void;
}

export default function LateFeeTab({ eventId, eventDate, rsvps, checkIns, lateFees, onRefresh }: Props) {
  // 운동 시작 여부 확인
  const now = new Date();
  const eventStart = new Date(eventDate);
  const isEventStarted = now >= eventStart;

  const [lateFeeAmounts, setLateFeeAmounts] = useState<Record<string, number>>({});
  const [initialLateFeeAmounts, setInitialLateFeeAmounts] = useState<Record<string, number>>({});
  const [notificationSent, setNotificationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autoSaving, setAutoSaving] = useState(false);

  useEffect(() => {
    // 지각비 금액 초기화: 기존 지각비 + 지각/미도착 인원
    const amounts: Record<string, number> = {};

    // 기존 지각비 불러오기
    lateFees.forEach((fee) => {
      amounts[fee.userId] = fee.amount;
    });

    // 지각자 및 미도착자 0원으로 초기화 (기존 값 없으면)
    const lateCheckIns = checkIns.filter((c) => c.isLate);
    const noShows = rsvps
      .filter((r) => r.status === "ATTEND" || r.status === "LATE")
      .filter((r) => !checkIns.some((c) => c.userId === r.userId));

    [...lateCheckIns, ...noShows].forEach((item) => {
      const userId = item.userId;
      if (!(userId in amounts)) {
        amounts[userId] = 0;
      }
    });

    setLateFeeAmounts(amounts);
    setInitialLateFeeAmounts(amounts);
    setNotificationSent(false);
  }, [rsvps, checkIns, lateFees]);

  // 지각비 금액 자동 저장 (debounced)
  useEffect(() => {
    // 초기 로드 시에는 저장하지 않음
    if (JSON.stringify(lateFeeAmounts) === JSON.stringify(initialLateFeeAmounts)) {
      return;
    }

    // 1초 후 자동 저장
    const timer = setTimeout(async () => {
      setAutoSaving(true);
      try {
        // 금액이 0보다 큰 항목만 전송
        const feesToSave = Object.entries(lateFeeAmounts)
          .filter(([_, amount]) => amount > 0)
          .map(([userId, amount]) => ({ userId, amount }));

        // 기존 지각비 중 금액이 0으로 변경된 것은 삭제
        const deletePromises = lateFees
          .filter((fee) => lateFeeAmounts[fee.userId] === 0)
          .map((fee) => fetch(`/api/training-events/${eventId}/late-fees/${fee.id}`, { method: "DELETE" }));

        // 새로 추가하거나 업데이트할 항목
        const upsertPromises = feesToSave.map(async ({ userId, amount }) => {
          const existingFee = lateFees.find((f) => f.userId === userId);
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

        // 저장 성공 후 초기값 업데이트
        setInitialLateFeeAmounts(lateFeeAmounts);

        // 백그라운드에서 refresh
        setTimeout(() => onRefresh(), 100);
      } catch {
        // 실패 시 무시 (사용자가 계속 입력 중일 수 있음)
      } finally {
        setAutoSaving(false);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [lateFeeAmounts, initialLateFeeAmounts, eventId, lateFees, onRefresh]);

  // 지각비 납부 상태를 로컬에서 추적 (즉각 반응을 위함)
  const [localFeeStatus, setLocalFeeStatus] = useState<Record<string, "PENDING" | "PAID">>({});

  useEffect(() => {
    // 초기 상태 설정
    const status: Record<string, "PENDING" | "PAID"> = {};
    lateFees.forEach((fee) => {
      status[fee.id] = fee.status;
    });
    setLocalFeeStatus(status);
  }, [lateFees]);

  // 지각비 납부 상태 토글
  const handleTogglePaid = async (feeId: string, currentStatus: "PENDING" | "PAID") => {
    const newStatus = currentStatus === "PAID" ? "PENDING" : "PAID";

    // 즉시 로컬 상태 업데이트 (optimistic update)
    setLocalFeeStatus((prev) => ({ ...prev, [feeId]: newStatus }));

    // 백그라운드에서 API 호출
    try {
      const res = await fetch(`/api/training-events/${eventId}/late-fees/${feeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) {
        // 실패하면 원래 상태로 롤백
        setLocalFeeStatus((prev) => ({ ...prev, [feeId]: currentStatus }));
      } else {
        // 성공하면 백그라운드에서 refresh (await 제거)
        setTimeout(() => onRefresh(), 100);
      }
    } catch {
      // 에러 발생 시 롤백
      setLocalFeeStatus((prev) => ({ ...prev, [feeId]: currentStatus }));
    }
  };

  // 지각비 일괄 저장
  const handleSaveLateFees = async () => {
    setSubmitting(true);

    // 즉시 UI 업데이트 (사용자는 기다리지 않음)
    setInitialLateFeeAmounts(lateFeeAmounts);
    setNotificationSent(false);

    try {
      // 금액이 0보다 큰 항목만 전송
      const feesToSave = Object.entries(lateFeeAmounts)
        .filter(([_, amount]) => amount > 0)
        .map(([userId, amount]) => ({ userId, amount }));

      // 기존 지각비 중 금액이 0으로 변경된 것은 삭제
      const deletePromises = lateFees
        .filter((fee) => lateFeeAmounts[fee.userId] === 0)
        .map((fee) => fetch(`/api/training-events/${eventId}/late-fees/${fee.id}`, { method: "DELETE" }));

      // 새로 추가하거나 업데이트할 항목
      const upsertPromises = feesToSave.map(async ({ userId, amount }) => {
        const existingFee = lateFees.find((f) => f.userId === userId);
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

      // 백그라운드에서 refresh (await 제거)
      onRefresh();

      setSubmitting(false);
      alert("저장되었습니다");
    } catch {
      // 실패 시 롤백
      setInitialLateFeeAmounts(initialLateFeeAmounts);
      setSubmitting(false);
      alert("저장에 실패했습니다");
    }
  };

  // 지각비 알림 전송
  const handleNotifyLateFees = async () => {
    if (lateFees.length === 0) {
      alert("부과된 지각비가 없습니다");
      return;
    }

    if (!confirm(`${lateFees.length}건의 지각비 알림을 전송하시겠습니까?`)) {
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}/notify-late-fees`, {
        method: "POST",
      });

      if (res.ok) {
        const data = await res.json();
        setNotificationSent(true);
        alert(`${data.recipientCount}명에게 알림을 전송했습니다`);
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

  // 변경사항 확인
  const hasChanges = JSON.stringify(lateFeeAmounts) !== JSON.stringify(initialLateFeeAmounts);
  const unpaidFees = lateFees.filter((fee) => fee.status === "PENDING");

  // 운동 시작 전에는 잠금 화면 표시
  if (!isEventStarted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">운동 시작 전</h3>
        <p className="text-sm text-gray-500 text-center">
          지각비는 운동 시작 후부터 확인할 수 있습니다
        </p>
        <p className="text-xs text-gray-400 mt-2">
          {eventStart.toLocaleString("ko-KR", {
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
          부터 확인 가능
        </p>
      </div>
    );
  }

  return (
    <>
      {/* 총 금액 */}
      <div className="bg-team-50 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-team-700">총 지각비</span>
          <span className="text-lg font-bold text-team-600">
            {Object.values(lateFeeAmounts).reduce((sum, amount) => sum + amount, 0).toLocaleString()}원
          </span>
        </div>
      </div>

      {/* 지각비 리스트 */}
      <div className="bg-white rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900">명단</h3>
          <div className="flex gap-2">
            {/* 자동저장 상태 표시 */}
            {autoSaving && (
              <span className="text-xs text-gray-500 px-3 py-2">저장 중...</span>
            )}
            {/* 알리기 버튼 - 알림 전송 안했고, 미납 지각비 있을 때 표시 */}
            {!notificationSent && unpaidFees.length > 0 && (
              <button
                onClick={handleNotifyLateFees}
                disabled={submitting}
                className="text-xs font-medium text-team-600 bg-team-50 border border-team-200 px-3 py-2 rounded-lg hover:bg-team-100 transition-colors disabled:opacity-50"
              >
                💰 알리기
              </button>
            )}
          </div>
        </div>

        {Object.keys(lateFeeAmounts).length > 0 ? (
          <div className="space-y-3">
            {Object.entries(lateFeeAmounts).map(([userId, amount]) => {
              const checkIn = checkIns.find((c) => c.userId === userId);
              const rsvp = rsvps.find((r) => r.userId === userId);
              const user = checkIn?.user || rsvp?.user;
              const existingFee = lateFees.find((f) => f.userId === userId);
              const isLate = checkIn?.isLate;
              const isNoShow = !checkIn && rsvp;

              // 로컬 상태에서 현재 상태 가져오기 (즉각 반응)
              const currentStatus = existingFee ? (localFeeStatus[existingFee.id] ?? existingFee.status) : null;

              return (
                <div key={userId} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  {/* 납부 체크박스 (토글 가능) */}
                  {existingFee && (
                    <button
                      onClick={() => handleTogglePaid(existingFee.id, currentStatus || "PENDING")}
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all cursor-pointer ${
                        currentStatus === "PAID"
                          ? "bg-green-500 hover:bg-green-600 hover:scale-110 active:scale-95"
                          : "bg-gray-300 hover:bg-gray-400 hover:scale-110 active:scale-95"
                      }`}
                      title={currentStatus === "PAID" ? "클릭하여 미납으로 변경" : "클릭하여 납부 완료로 표시"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </button>
                  )}
                  {!existingFee && <div className="w-6" />}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${amount === 0 ? "text-gray-400 line-through" : "text-gray-900"}`}>
                        {user?.name || "이름 없음"}
                      </span>
                      <span className={`text-xs px-1.5 py-0.5 rounded ${
                        isLate ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-600"
                      }`}>
                        {isLate ? "지각" : "미도착"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={amount === 0 ? "" : amount}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, "");
                        setLateFeeAmounts((prev) => ({ ...prev, [userId]: val === "" ? 0 : parseInt(val) }));
                      }}
                      placeholder="0"
                      className={`w-24 px-2 py-1.5 border border-gray-200 rounded text-sm text-right focus:outline-none focus:border-team-300 ${amount === 0 ? "text-gray-400" : ""}`}
                    />
                    <span className={`text-sm ${amount === 0 ? "text-gray-400 line-through" : "text-gray-500"}`}>원</span>
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
  );
}
