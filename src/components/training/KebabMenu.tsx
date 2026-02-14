"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Toast from "@/components/Toast";
import { useToast } from "@/lib/useToast";

interface Props {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventLocation: string;
  eventUniform?: string | null;
  eventNotes?: string | null;
  rsvpCount: number;
  checkInCount: number;
  lateFeeCount: number;
  sessionCount: number;
}

export default function KebabMenu({
  eventId,
  eventTitle,
  eventDate,
  eventLocation,
  eventUniform,
  eventNotes,
  rsvpCount,
  checkInCount,
  lateFeeCount,
  sessionCount,
}: Props) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast, showToast, hideToast } = useToast();

  // 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleShare = async () => {
    setShowMenu(false);
    const url = `${window.location.origin}/training/${eventId}`;

    // 운동 정보 포맷팅
    const dateStr = new Date(eventDate).toLocaleDateString("ko-KR", {
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    const shareText = [
      `[${eventTitle || "팀 운동"}]`,
      "",
      `📅 ${dateStr}`,
      `📍 ${eventLocation}`,
      eventUniform ? `👕 ${eventUniform}` : null,
      eventNotes ? `📝 ${eventNotes}` : null,
      "",
      url,
    ]
      .filter((line) => line !== null)
      .join("\n");

    // 클립보드에 복사
    try {
      await navigator.clipboard.writeText(shareText);
      showToast("운동 정보가 복사되었습니다!");
    } catch {
      showToast("복사에 실패했습니다");
    }
  };

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/training-events/${eventId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/");
      } else {
        const data = await res.json();
        alert(data.error || "삭제에 실패했습니다");
      }
    } catch {
      alert("삭제에 실패했습니다");
    }
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg transition-colors touch-manipulation"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-600"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="12" cy="5" r="1" />
            <circle cx="12" cy="19" r="1" />
          </svg>
        </button>

        {showMenu && (
          <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-[100]">
            <button
              onClick={handleShare}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors touch-manipulation"
            >
              공유하기
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                router.push(`/training/${eventId}/edit`);
              }}
              className="w-full px-4 py-3 text-left text-sm text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors border-t border-gray-100 touch-manipulation"
            >
              기본 정보 수정
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                setShowDeleteModal(true);
              }}
              className="w-full px-4 py-3 text-left text-sm text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors border-t border-gray-100 touch-manipulation"
            >
              팀 운동 삭제
            </button>
          </div>
        )}
      </div>

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-red-600 mb-2 flex items-center gap-2">
              <span>⚠️</span>
              <span>운동 삭제</span>
            </h3>
            <p className="text-sm text-gray-900 font-medium mb-4">
              이 운동을 삭제하시겠습니까?
            </p>

            {/* 운동 정보 */}
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <span>📅</span>
                <span className="text-gray-900">
                  {new Date(eventDate).toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                    weekday: "short",
                  })}{" "}
                  {new Date(eventDate).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>📍</span>
                <span className="text-gray-900">{eventLocation}</span>
              </div>
            </div>

            {/* 삭제될 데이터 */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-2">다음 데이터가 모두 삭제됩니다:</p>
              <ul className="space-y-1 text-xs text-gray-600">
                <li>• RSVP ({rsvpCount}건)</li>
                <li>• 체크인 기록 ({checkInCount}건)</li>
                <li>• 지각비 내역 ({lateFeeCount}건)</li>
                <li>• 세션 및 팀 배정 ({sessionCount}개 세션)</li>
              </ul>
            </div>

            <p className="text-xs text-red-600 font-medium mb-6">
              ⚠️ 이 작업은 되돌릴 수 없습니다
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2.5 bg-red-500 text-white rounded-lg font-medium hover:bg-red-600 transition-colors"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </>
  );
}
