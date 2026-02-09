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
  rsvps: RsvpEntry[];
  checkIns: CheckInEntry[];
  lateFees: LateFeeEntry[];
  onRefresh: () => void;
}

export default function LateFeeTab({ eventId, rsvps, checkIns, lateFees, onRefresh }: Props) {
  const [lateFeeAmounts, setLateFeeAmounts] = useState<Record<string, number>>({});
  const [initialLateFeeAmounts, setInitialLateFeeAmounts] = useState<Record<string, number>>({});
  const [notificationSent, setNotificationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

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

  // 지각비 납부 확인
  const handleMarkPaid = async (feeId: string) => {
    // 낙관적 업데이트: 즉시 UI 반영
    const updatedFees = lateFees.map(fee =>
      fee.id === feeId ? { ...fee, status: "PAID" as const } : fee
    );

    // 백그라운드에서 API 호출
    const res = await fetch(`/api/training-events/${eventId}/late-fees/${feeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });

    if (res.ok) {
      // 성공하면 백그라운드에서 refresh (await 제거로 즉시 반환)
      onRefresh();
    } else {
      // 실패하면 롤백을 위해 refresh
      onRefresh();
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

  return (
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
          <div className="flex gap-2">
            {/* 저장 버튼 - 변경사항이 있을 때만 표시 */}
            {hasChanges && (
              <button
                onClick={handleSaveLateFees}
                disabled={submitting}
                className="text-xs font-medium text-white bg-team-500 px-4 py-2 rounded-lg hover:bg-team-600 transition-colors disabled:opacity-50"
              >
                {submitting ? "저장 중..." : "저장"}
              </button>
            )}
            {/* 알리기 버튼 - 변경사항 없고, 알림 전송 안했고, 미납 지각비 있을 때 표시 */}
            {!hasChanges && !notificationSent && unpaidFees.length > 0 && (
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
  );
}
