"use client";

import { useEffect } from "react";
import useSWR from "swr";
import Image from "next/image";

interface AttendanceRate {
  userId: string;
  name: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
  attendedCount: number;
  totalEvents: number;
  rate: number;
}

interface AttendanceData {
  attendanceRates: AttendanceRate[];
  totalEvents: number;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function AttendanceRateModal({ isOpen, onClose }: Props) {
  // SWR 캐시: 5분간 유지, 모달 열릴 때만 fetch
  const { data, isLoading } = useSWR<AttendanceData>(
    isOpen ? "/api/teams/attendance-rate" : null,
    fetcher,
    { dedupingInterval: 5 * 60 * 1000, revalidateOnFocus: false }
  );

  const attendanceRates = data?.attendanceRates || [];
  const totalEvents = data?.totalEvents || 0;

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">팀원 출석률</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* 내용 */}
        <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
          {isLoading && attendanceRates.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500" />
            </div>
          ) : attendanceRates.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              출석 데이터가 없습니다
            </div>
          ) : (
            <div className="p-4 space-y-0.5">
              <p className="text-xs text-gray-500 mb-3 px-2">
                총 {totalEvents}회 운동 기준
              </p>
              {attendanceRates.map((item, index) => (
                <div
                  key={item.userId}
                  className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  {/* 순위 */}
                  <div className="w-5 text-center flex-shrink-0">
                    <span className={`text-xs font-bold ${
                      index === 0 ? "text-yellow-500" :
                      index === 1 ? "text-gray-400" :
                      index === 2 ? "text-orange-400" :
                      "text-gray-300"
                    }`}>
                      {index + 1}
                    </span>
                  </div>

                  {/* 프로필 */}
                  <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {item.image ? (
                      <Image
                        src={item.image}
                        alt={item.name || ""}
                        width={32}
                        height={32}
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
                      {(item.position || item.number !== null) && (
                        <span className="text-xs text-gray-500">
                          {item.position || ""}{item.number !== null ? ` ${item.number}` : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 출석 횟수 + 출석률 */}
                  <div className="flex-shrink-0">
                    <span
                      className={`text-sm font-semibold ${
                        item.rate >= 80
                          ? "text-green-600"
                          : item.rate >= 50
                            ? "text-yellow-600"
                            : "text-gray-400"
                      }`}
                    >
                      {item.attendedCount}회 ({item.rate}%)
                    </span>
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
