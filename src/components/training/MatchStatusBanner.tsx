"use client";

import { useState } from "react";
import type { TrainingEventDetail } from "@/types/training-event";

interface Props {
  event: TrainingEventDetail;
  isAdmin: boolean;
  onSendChallenge: () => void;
  onConvertToRegular?: () => void;
  mutate: () => void;
}

function getDday(expiresAt: string): string {
  const diff = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (diff <= 0) return "D-day";
  return `D-${diff}`;
}

export default function MatchStatusBanner({ event, isAdmin, onSendChallenge, onConvertToRegular, mutate }: Props) {
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  if (!event.isFriendlyMatch) return null;

  const attendCount = event.rsvps.filter((r) => r.status === "ATTEND").length;
  const requiredPlayers = event.matchRules?.playersPerSide ?? event.minimumPlayers ?? 0;
  const hasEnoughPlayers = requiredPlayers === 0 || attendCount >= requiredPlayers;
  const isHost = !event.linkedEventId || event.matchStatus === "CHALLENGE_SENT" || event.matchStatus === "DRAFT";

  // 만료 체크
  const isExpired =
    event.matchStatus === "CHALLENGE_SENT" &&
    event.challengeTokenExpiresAt &&
    new Date(event.challengeTokenExpiresAt) < new Date();

  const handleReject = async () => {
    if (!event.challengeToken) return;
    setRejecting(true);
    try {
      await fetch(`/api/challenge/${event.challengeToken}/reject`, { method: "POST" });
      mutate();
    } finally {
      setRejecting(false);
      setShowRejectConfirm(false);
    }
  };

  // 상태별 배너 내용
  let icon = "";
  let text = "";
  let bgColor = "";
  let action: React.ReactNode = null;

  if (event.matchStatus === "CANCELLED") {
    icon = "❌";
    text = event.challengeRejectionReason
      ? `상대팀이 거절했습니다: "${event.challengeRejectionReason}"`
      : "매칭이 취소되었습니다";
    bgColor = "bg-red-50 text-red-700 border-red-100";
    if (isAdmin && onConvertToRegular) {
      action = (
        <button
          onClick={onConvertToRegular}
          className="text-xs px-2.5 py-1 bg-white border border-red-200 rounded-lg text-red-600 font-medium"
        >
          팀 운동으로 전환
        </button>
      );
    }
  } else if (event.matchStatus === "CONFIRMED") {
    icon = "🤝";
    text = "매칭 완료!";
    bgColor = "bg-green-50 text-green-700 border-green-100";
  } else if (event.matchStatus === "CHALLENGE_SENT") {
    if (isExpired) {
      icon = "⏰";
      text = "응답 기한이 만료되었습니다";
      bgColor = "bg-gray-50 text-gray-600 border-gray-100";
    } else {
      const dday = event.challengeTokenExpiresAt ? getDday(event.challengeTokenExpiresAt) : "";
      icon = "⏳";
      text = `상대팀의 응답을 기다리고 있습니다${dday ? ` (${dday})` : ""}`;
      bgColor = "bg-amber-50 text-amber-700 border-amber-100";
    }
  } else if (event.matchStatus === "DRAFT") {
    // 상대팀 시점 (linkedEvent가 있고 내가 게스트인 경우)
    // 호스트 시점
    if (!hasEnoughPlayers) {
      icon = "📋";
      text = `인원조사 진행 중 (${attendCount}/${requiredPlayers}명)`;
      bgColor = "bg-blue-50 text-blue-700 border-blue-100";
    } else {
      icon = "⚔️";
      text = "인원이 충족되었습니다. 도전장을 보내세요!";
      bgColor = "bg-amber-50 text-amber-700 border-amber-100";
      if (isAdmin) {
        action = (
          <button
            onClick={onSendChallenge}
            className="text-xs px-2.5 py-1 bg-amber-500 rounded-lg text-white font-medium active:scale-95"
          >
            도전장 보내기
          </button>
        );
      }
    }
  } else {
    return null;
  }

  return (
    <>
      <div className={`mx-4 mt-3 px-4 py-3 rounded-xl border flex items-center justify-between gap-2 ${bgColor}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span aria-hidden="true">{icon}</span>
          <span className="text-sm font-medium truncate">{text}</span>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* 거절 확인 바텀시트 */}
      {showRejectConfirm && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRejectConfirm(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">도전장을 거절하시겠습니까?</h3>
            <p className="text-sm text-gray-500">거절하면 상대팀에게 알려집니다.</p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowRejectConfirm(false)}
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium"
              >
                취소
              </button>
              <button
                onClick={handleReject}
                disabled={rejecting}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium disabled:opacity-50"
              >
                {rejecting ? "처리 중..." : "거절하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
