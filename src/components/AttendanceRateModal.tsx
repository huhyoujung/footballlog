"use client";
import LoadingSpinner from "@/components/LoadingSpinner";

import { useState, useEffect } from "react";
import Image from "next/image";

interface AttendanceRate {
  userId: string;
  name: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
  checkInCount: number;
  totalEvents: number;
  rate: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AttendanceRateModal({ isOpen, onClose }: Props) {
  const [loading, setLoading] = useState(true);
  const [attendanceRates, setAttendanceRates] = useState<AttendanceRate[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);

  useEffect(() => {
    if (isOpen) {
      fetchAttendanceRates();
    }
  }, [isOpen]);

  const fetchAttendanceRates = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/teams/attendance-rate");
      if (res.ok) {
        const data = await res.json();
        setAttendanceRates(data.attendanceRates || []);
        setTotalEvents(data.totalEvents || 0);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden">
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-2.5 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">팀원 출석률</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500" />
            </div>
          ) : attendanceRates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              출석 데이터가 없습니다
            </div>
          ) : (
            <div className="p-5 space-y-1">
              <p className="text-xs text-gray-400 mb-3">
                총 {totalEvents}회 운동 기준
              </p>
              {attendanceRates.map((item) => (
                <div
                  key={item.userId}
                  className="flex items-center gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50"
                >
                  {/* 프로필 */}
                  <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name || ""}
                        width={40}
                        height={40}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-team-50" />
                    )}
                  </div>

                  {/* 이름 + 포지션 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-gray-900 truncate">
                        {item.name || "익명"}
                      </span>
                      {item.position && (
                        <span className="text-xs text-gray-400">
                          {item.position}
                        </span>
                      )}
                      {item.number !== null && (
                        <span className="text-xs text-gray-400">
                          #{item.number}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {item.checkInCount}회 / {item.totalEvents}회
                    </div>
                  </div>

                  {/* 출석률 */}
                  <div className="flex-shrink-0 text-right">
                    <div
                      className={`text-lg font-bold ${
                        item.rate >= 80
                          ? "text-green-600"
                          : item.rate >= 50
                            ? "text-yellow-600"
                            : "text-gray-400"
                      }`}
                    >
                      {item.rate}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
