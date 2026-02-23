"use client";

import type { CheckInEntry } from "@/types/training-event";

interface RsvpEntry {
  id: string;
  userId: string;
  status: "ATTEND" | "ABSENT" | "LATE" | "NO_SHOW";
  reason: string | null;
  user: { id: string; name: string | null; image: string | null };
}

interface Props {
  rsvps: RsvpEntry[];
  checkIns: CheckInEntry[];
  isAdmin?: boolean;
  onManageClick?: () => void;
}

export default function AttendanceTab({ rsvps, checkIns, isAdmin, onManageClick }: Props) {
  // RSVP 중 ATTEND/LATE
  const attendees = rsvps.filter((r) => r.status === "ATTEND" || r.status === "LATE");

  return (
    <div className="bg-white rounded-xl p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">
        출석 현황 ({checkIns.length}/{attendees.length}명 도착)
      </h3>
      <div className="space-y-2">
        {attendees.map((rsvp) => {
          const checkIn = checkIns.find((c) => c.userId === rsvp.userId);
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
          <p className="text-sm text-gray-400 text-center py-4">RSVP한 멤버가 없습니다</p>
        )}
      </div>
      {isAdmin && onManageClick && (
        <button
          onClick={onManageClick}
          className="mt-4 w-full py-2.5 rounded-xl bg-team-50 text-team-700 text-sm font-medium hover:bg-team-100 transition-colors"
        >
          출석 관리
        </button>
      )}
    </div>
  );
}
