"use client";

import { useEffect } from "react";

interface Props {
  onSelect: (mode: "balanced" | "grouped") => void;
  onClose: () => void;
}

export default function AutoAssignSheet({ onSelect, onClose }: Props) {
  useEffect(() => {
    // 모달 열릴 때 배경 스크롤 막기
    document.body.style.overflow = 'hidden';

    // 컴포넌트 언마운트 시 배경 스크롤 복구
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl z-50 animate-slide-up shadow-2xl">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-900">자동 배정</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            <button
              onClick={() => {
                onSelect("balanced");
                onClose();
              }}
              className="w-full py-4 px-5 bg-team-500 hover:bg-team-600 text-white rounded-xl transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔀</span>
                <div>
                  <div className="font-semibold">포지션 골고루</div>
                  <div className="text-xs text-team-50 mt-0.5">각 팀에 포지션이 균등하게 분배됩니다</div>
                </div>
              </div>
            </button>

            <button
              onClick={() => {
                onSelect("grouped");
                onClose();
              }}
              className="w-full py-4 px-5 bg-white hover:bg-gray-50 border border-gray-200 rounded-xl transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <div className="font-semibold text-gray-900">포지션끼리</div>
                  <div className="text-xs text-gray-500 mt-0.5">같은 포지션이 한 팀에 모입니다</div>
                </div>
              </div>
            </button>
          </div>

          {/* Cancel */}
          <button
            onClick={onClose}
            className="w-full py-3 text-sm text-gray-600 hover:text-gray-800 transition-colors"
          >
            취소
          </button>
        </div>

        {/* Safe area padding for iOS */}
        <div className="h-6 md:h-0" />
      </div>
    </>
  );
}
