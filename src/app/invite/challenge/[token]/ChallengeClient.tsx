"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Calendar, Users, Shirt, Footprints, Clock, Shield } from "lucide-react";

interface MatchRules {
  template: string;
  quarterCount: number;
  quarterMinutes: number;
  quarterBreak: number;
  halftime: number;
  playersPerSide: number;
  allowBackpass: boolean;
  allowOffside: boolean;
}

interface ChallengeEvent {
  id: string;
  title: string;
  date: string;
  location: string;
  matchStatus: string;
  challengeTokenExpiresAt: string | null;
  minimumPlayers: number | null;
  notes: string | null;
  shoes: string[];
  uniform: string | null;
  matchRules: MatchRules | null;
  team: {
    id: string;
    name: string;
    logoUrl: string | null;
    primaryColor: string;
  };
}

interface Props {
  token: string;
  event: ChallengeEvent | null;
  isLoggedIn: boolean;
  hasTeam: boolean;
  isSameTeam: boolean;
  isAdmin: boolean;
}

export default function ChallengeClient({
  token,
  event,
  isLoggedIn,
  hasTeam,
  isSameTeam,
  isAdmin,
}: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // 토큰 없음 / 이벤트 없음
  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            유효하지 않은 도전장
          </h1>
          <p className="text-sm text-gray-500">
            도전장 링크가 잘못되었거나 이미 사용되었습니다.
          </p>
        </div>
      </div>
    );
  }

  const isExpired =
    event.challengeTokenExpiresAt &&
    new Date(event.challengeTokenExpiresAt) < new Date();
  // CHALLENGE_SENT 상태만 수락 가능
  const isAlreadyMatched = event.matchStatus !== "CHALLENGE_SENT";

  // 토큰 만료
  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            도전장이 만료되었습니다
          </h1>
          <p className="text-sm text-gray-500">
            이 도전장의 유효기간이 지났습니다.
          </p>
        </div>
      </div>
    );
  }

  // 이미 매칭됨
  if (isAlreadyMatched) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🤝</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            이미 성사된 경기입니다
          </h1>
          <p className="text-sm text-gray-500">
            이 도전장은 이미 수락되었습니다.
          </p>
        </div>
      </div>
    );
  }

  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const timeStr = new Date(event.date).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const teamColor = event.team.primaryColor || "#1D4237";

  const handleAccept = async () => {
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/challenge/${token}/accept`, {
        method: "POST",
      });
      const data = await res.json();

      if (res.ok) {
        setAccepted(true);
        setTimeout(() => {
          router.push(`/training/${data.opponentEventId}`);
        }, 1500);
      } else {
        if (data.code === "SAME_TEAM") {
          setError("자신의 팀에는 도전장을 수락할 수 없습니다");
        } else if (data.code === "ALREADY_MATCHED") {
          setError("이미 매칭이 진행 중입니다");
        } else if (data.code === "INSUFFICIENT_PLAYERS") {
          setError(data.error);
        } else {
          setError(data.error || "수락에 실패했습니다");
        }
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      const res = await fetch(`/api/challenge/${token}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
      });
      if (res.ok) {
        setRejected(true);
        setShowRejectConfirm(false);
      } else {
        const data = await res.json();
        setError(data.error || "거절에 실패했습니다");
        setShowRejectConfirm(false);
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
      setShowRejectConfirm(false);
    } finally {
      setRejecting(false);
    }
  };

  const handleLogin = () => {
    const callbackUrl = encodeURIComponent(window.location.href);
    router.push(`/login?callbackUrl=${callbackUrl}`);
  };

  const handleOnboarding = () => {
    const returnUrl = encodeURIComponent(window.location.href);
    router.push(`/onboarding?returnUrl=${returnUrl}`);
  };

  // 수락 완료
  if (accepted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            도전장을 수락했습니다!
          </h1>
          <p className="text-sm text-gray-500">경기 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  // 거절 완료
  if (rejected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            도전장을 거절했습니다
          </h1>
          <p className="text-sm text-gray-500">상대팀에게 거절 사실이 전달됩니다.</p>
        </div>
      </div>
    );
  }

  const rules = event.matchRules;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-sm w-full space-y-4">
        {/* 도전장 카드 */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* 헤더 */}
          <div
            className="px-6 py-5 text-center"
            style={{ backgroundColor: teamColor + "1A" }}
          >
            <div className="flex justify-center mb-3">
              {event.team.logoUrl ? (
                <img
                  src={event.team.logoUrl}
                  alt={event.team.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
                />
              ) : (
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-white shadow text-2xl font-bold text-white"
                  style={{ backgroundColor: teamColor }}
                >
                  {event.team.name[0]}
                </div>
              )}
            </div>
            <p className="text-xs font-medium text-gray-500 mb-1">⚽ 도전장</p>
            <h1 className="text-lg font-bold text-gray-900">
              {event.team.name}
            </h1>
          </div>

          {/* 경기 정보 */}
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{dateStr}</p>
                <p className="text-xs text-gray-500">{timeStr}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <p className="text-sm text-gray-900">{event.location}</p>
            </div>

            {(event.minimumPlayers || rules?.playersPerSide) && (
              <div className="flex items-start gap-3">
                <Users className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-900">
                  최소 {rules?.playersPerSide ?? event.minimumPlayers}명
                </p>
              </div>
            )}

            {event.uniform && (
              <div className="flex items-start gap-3">
                <Shirt className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-900">{event.uniform}</p>
              </div>
            )}

            {event.shoes.length > 0 && (
              <div className="flex items-start gap-3">
                <Footprints className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-900">
                  {event.shoes.join(", ")}
                </p>
              </div>
            )}

            {/* 룰북 */}
            {rules && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="w-3.5 h-3.5 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">룰북</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-700">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                    <span>{rules.quarterCount}쿼터 × {rules.quarterMinutes}분</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users className="w-3 h-3 text-gray-400 shrink-0" />
                    <span>{rules.playersPerSide}vs{rules.playersPerSide}</span>
                  </div>
                  {rules.quarterBreak > 0 && (
                    <div className="col-span-2 text-gray-500">
                      쿼터 휴식 {rules.quarterBreak}분 / 하프타임 {rules.halftime}분
                    </div>
                  )}
                  <div className="flex gap-2">
                    <span className={rules.allowBackpass ? "text-green-600" : "text-red-500"}>
                      백패스 {rules.allowBackpass ? "허용" : "금지"}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className={rules.allowOffside ? "text-green-600" : "text-red-500"}>
                      오프사이드 {rules.allowOffside ? "적용" : "없음"}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {event.notes && (
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-600">{event.notes}</p>
              </div>
            )}
          </div>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 액션 버튼 */}
        {isSameTeam ? (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-700 text-center">
              본인 팀의 도전장입니다
            </p>
          </div>
        ) : !isLoggedIn ? (
          <button
            onClick={handleLogin}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: teamColor }}
          >
            로그인하고 수락하기
          </button>
        ) : !hasTeam ? (
          <button
            onClick={handleOnboarding}
            className="w-full py-3.5 rounded-xl font-semibold text-white transition-colors"
            style={{ backgroundColor: teamColor }}
          >
            팀 가입 후 수락하기
          </button>
        ) : (
          <div className="space-y-2">
            <button
              onClick={handleAccept}
              disabled={submitting || rejecting}
              className="w-full py-3.5 rounded-xl font-semibold text-white transition-colors disabled:opacity-50"
              style={{ backgroundColor: teamColor }}
            >
              {submitting ? "수락 중..." : "도전 수락하기"}
            </button>
            {isAdmin && (
              <button
                onClick={() => setShowRejectConfirm(true)}
                disabled={submitting || rejecting}
                className="w-full py-3 rounded-xl font-medium text-gray-600 border border-gray-200 transition-colors disabled:opacity-50"
              >
                거절하기
              </button>
            )}
          </div>
        )}
      </div>

      {/* 거절 확인 바텀시트 */}
      {showRejectConfirm && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowRejectConfirm(false)} />
          <div className="relative w-full bg-white rounded-t-2xl p-6 space-y-4">
            <h3 className="font-semibold text-gray-900">도전장을 거절하시겠습니까?</h3>
            <p className="text-sm text-gray-500">거절 사유를 남기면 상대팀에게 전달됩니다.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="거절 사유 (선택)"
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 resize-none focus:ring-2 focus:ring-red-300 focus:border-transparent"
            />
            <div className="flex gap-2">
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
    </div>
  );
}
