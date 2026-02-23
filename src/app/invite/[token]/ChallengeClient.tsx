"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Calendar, Clock, Shield, Footprints, Share2, Shirt, ChevronDown, Play, Pencil } from "lucide-react";
import dynamic from "next/dynamic";
import MatchRulesBottomSheet from "@/components/training/MatchRulesBottomSheet";
import type { MatchRulesPayload } from "@/components/training/MatchRulesBottomSheet";

const ChallengeLiveMode = dynamic(() => import("./ChallengeLiveMode"), { ssr: false });

interface GoalRecord {
  id: string;
  quarter: number;
  minute: number | null;
  scoringTeam: "TEAM_A" | "TEAM_B";
  isOwnGoal: boolean;
  scorer: { id: string; name: string | null } | null;
  assistant: { id: string; name: string | null } | null;
}

interface CardRecord {
  id: string;
  quarter: number;
  minute: number | null;
  cardType: "YELLOW" | "RED";
  teamSide: "TEAM_A" | "TEAM_B";
  player: { id: string; name: string | null } | null;
}

interface MatchRules {
  template: string;
  kickoffTime: string | null;
  quarterCount: number;
  quarterMinutes: number;
  quarterBreak: number;
  halftime: number;
  playersPerSide: number;
  allowBackpass: boolean;
  allowOffside: boolean;
  quarterRefereeTeams: ("TEAM_A" | "TEAM_B")[] | null;
}

interface TeamInfo {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
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
  opponentTeamName: string | null;
  teamAScore: number;
  teamBScore: number;
  weather: string | null;
  weatherDescription: string | null;
  temperature: number | null;
  matchRules: MatchRules | null;
  goalRecords: GoalRecord[];
  cardRecords: CardRecord[];
  _count: { rsvps: number };
  team: TeamInfo;
}

interface Props {
  token: string;
  event: ChallengeEvent | null;
  isLoggedIn: boolean;
  userId: string | null;
  hasTeam: boolean;
  isSameTeam: boolean;
  isAdmin: boolean;
  receiverTeam: TeamInfo | null;
  hostUniformColor: string | null;
  opponentTeam: TeamInfo | null;
  opponentTeamName: string | null;
}

function ConfirmedView({
  token,
  event,
  isMatchDay,
  onStarted,
  isAdmin,
  onEditRules,
}: {
  token: string;
  event: ChallengeEvent;
  isMatchDay: boolean;
  onStarted: () => void;
  isAdmin: boolean;
  onEditRules: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  // 다른 관전자가 경기 시작 대기 중일 때 자동 감지 (3초 폴링)
  // /live 엔드포인트가 200 반환 = IN_PROGRESS 됐다는 뜻
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/challenge/${token}/live`);
        if (res.ok) {
          onStarted();
        }
      } catch { /* 무시 */ }
    }, 3000);
    return () => clearInterval(id);
  }, [token, onStarted]);

  const handleStart = async () => {
    setStarting(true);
    setError("");
    try {
      const res = await fetch(`/api/challenge/${token}/match-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "IN_PROGRESS" }),
      });
      if (res.ok) {
        onStarted();
      } else {
        const d = await res.json();
        setError(d.error || "경기 시작에 실패했습니다");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center space-y-4">
        <div className="text-5xl">🤝</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">매칭이 성사되었습니다</h1>
          <p className="text-sm text-gray-400">
            {new Date(event.date).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" })}
          </p>
        </div>
        {isMatchDay ? (
          <div className="pt-2 space-y-2">
            <button
              onClick={handleStart}
              disabled={starting}
              className="w-full py-3.5 rounded-xl font-semibold text-white bg-green-500 flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 transition-transform"
            >
              <Play className="w-4 h-4 fill-white" />
              {starting ? "시작 중..." : "경기 시작"}
            </button>
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
        ) : (
          <p className="text-sm text-gray-500">경기 시작 후 이 링크로 라이브 기록에 참여할 수 있습니다.</p>
        )}
        {isAdmin && (
          <button
            onClick={onEditRules}
            className="w-full py-3 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm flex items-center justify-center gap-2"
          >
            <Pencil className="w-4 h-4" />
            경기 방식 수정
          </button>
        )}
      </div>
    </div>
  );
}

function getWeatherIcon(weather: string | null): string {
  if (!weather) return "🌤️";
  if (weather === "Clear") return "☀️";
  if (weather === "Clouds") return "☁️";
  if (weather === "Rain") return "🌧️";
  if (weather === "Snow") return "❄️";
  return "🌤️";
}

function MatchResultView({
  event,
  opponentTeam,
  opponentTeamName,
  userId,
}: {
  event: ChallengeEvent;
  opponentTeam: TeamInfo | null;
  opponentTeamName: string | null;
  userId: string | null;
}) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const teamAColor = event.team.primaryColor;
  const teamBColor = opponentTeam?.primaryColor ?? "#374151";
  const teamAName = event.team.name;
  const teamBName = opponentTeam?.name ?? opponentTeamName ?? "상대팀";
  const winner =
    event.teamAScore > event.teamBScore ? "A" :
    event.teamBScore > event.teamAScore ? "B" : null;

  // 팀별 득점자 분류
  const teamAScorers = event.goalRecords.filter((g) =>
    g.isOwnGoal ? g.scoringTeam === "TEAM_B" : g.scoringTeam === "TEAM_A"
  );
  const teamBScorers = event.goalRecords.filter((g) =>
    g.isOwnGoal ? g.scoringTeam === "TEAM_A" : g.scoringTeam === "TEAM_B"
  );

  const proxiedLogo = (url: string) =>
    `/_next/image?url=${encodeURIComponent(url)}&w=128&q=75`;

  const TeamAvatar = ({ team }: { team: { logoUrl: string | null; name: string; primaryColor: string } }) =>
    team.logoUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={proxiedLogo(team.logoUrl)}
        alt={team.name}
        className="w-14 h-14 rounded-full object-cover border-2 border-white/80 shadow mx-auto"
        crossOrigin="anonymous"
      />
    ) : (
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center font-black text-white text-2xl border-2 border-white/80 shadow mx-auto"
        style={{ backgroundColor: team.primaryColor }}
      >
        {team.name[0]}
      </div>
    );

  const handleShare = async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const { toPng } = await import("html-to-image");
      const dateStr = new Date(event.date)
        .toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
        .replace(/\.\s*/g, "-").replace(/-$/, "");
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `경기결과-${dateStr}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${teamAName} ${event.teamAScore} - ${event.teamBScore} ${teamBName}` });
      } else {
        const link = document.createElement("a");
        link.href = dataUrl;
        link.download = `경기결과-${dateStr}.png`;
        link.click();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error(err);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4 py-8">
      <div className="max-w-sm w-full space-y-3">
        {/* 카드 wrapper — 공유 버튼은 카드 밖 (캡처 제외) */}
        <div className="relative">
          <button
            onClick={handleShare}
            disabled={sharing}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-white/70 hover:bg-white/95 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            title="결과 공유하기"
          >
            <Share2 className="w-4 h-4" />
          </button>

          {/* 캡처 대상 카드 */}
          <div ref={cardRef} className="bg-white rounded-2xl shadow-lg overflow-hidden">

            {/* 그라디언트 헤더 */}
            <div
              className="relative px-6 pt-7 pb-7"
              style={{ background: `linear-gradient(135deg, ${teamAColor}18 0%, ${teamBColor}18 100%)` }}
            >
              <p className="text-[11px] font-bold tracking-widest text-gray-400 uppercase text-center mb-7">Match Result</p>

              {/* 팀 A — 스코어 — 팀 B */}
              <div className="flex items-start justify-between gap-2">
                {/* 팀 A */}
                <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <TeamAvatar team={event.team} />
                  <p className="text-sm font-bold text-gray-900 text-center leading-tight line-clamp-1">{teamAName}</p>
                  {/* 팀A 득점자 */}
                  {teamAScorers.length > 0 && (
                    <div className="w-full space-y-0.5">
                      {teamAScorers.map((g, idx) => (
                        <p key={idx} className="text-[11px] text-center text-gray-500 truncate">
                          ⚽ {g.scorer?.name ?? "자책골"}{g.isOwnGoal ? " OG" : ""} {g.quarter}Q{g.minute != null ? ` ${g.minute}′` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* 스코어 + 결과 배지 */}
                <div className="shrink-0 flex flex-col items-center gap-2 pt-1">
                  <div className="flex items-center gap-1">
                    <span className="text-5xl font-black tabular-nums" style={{ color: teamAColor }}>{event.teamAScore}</span>
                    <span className="text-4xl font-black text-gray-300">:</span>
                    <span className="text-5xl font-black tabular-nums" style={{ color: teamBColor }}>{event.teamBScore}</span>
                  </div>
                  <div
                    className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                    style={
                      winner === "A"
                        ? { backgroundColor: teamAColor + "22", color: teamAColor }
                        : winner === "B"
                        ? { backgroundColor: teamBColor + "22", color: teamBColor }
                        : { backgroundColor: "#f3f4f6", color: "#9ca3af" }
                    }
                  >
                    {winner ? "🏆 승리" : "🤝 무승부"}
                  </div>
                </div>

                {/* 팀 B */}
                <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                  <TeamAvatar team={opponentTeam ?? { id: null as unknown as string, name: teamBName, primaryColor: teamBColor, logoUrl: null }} />
                  <p className="text-sm font-bold text-gray-900 text-center leading-tight line-clamp-1">{teamBName}</p>
                  {/* 팀B 득점자 */}
                  {teamBScorers.length > 0 && (
                    <div className="w-full space-y-0.5">
                      {teamBScorers.map((g, idx) => (
                        <p key={idx} className="text-[11px] text-center text-gray-500 truncate">
                          ⚽ {g.scorer?.name ?? "자책골"}{g.isOwnGoal ? " OG" : ""} {g.quarter}Q{g.minute != null ? ` ${g.minute}′` : ""}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 카드 이벤트 (경고/퇴장) */}
            {event.cardRecords.length > 0 && (
              <div className="mx-4 mt-3 mb-1 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                {Array.from(new Set(event.cardRecords.map((c) => c.quarter))).sort((a, b) => a - b).map((quarter, qi) => {
                  const cards = event.cardRecords.filter((c) => c.quarter === quarter);
                  return (
                    <div key={quarter} className={qi > 0 ? "border-t border-gray-100" : ""}>
                      <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold text-gray-400 tracking-widest">{quarter}Q</p>
                      <div className="px-4 pb-2.5 space-y-1.5">
                        {cards.map((c, idx) => {
                          const isTeamA = c.teamSide === "TEAM_A";
                          return (
                            <div key={idx} className={`flex items-center gap-2 ${isTeamA ? "" : "flex-row-reverse"}`}>
                              <span className="text-sm shrink-0">{c.cardType === "YELLOW" ? "🟨" : "🟥"}</span>
                              <div className={`flex-1 min-w-0 ${isTeamA ? "" : "text-right"}`}>
                                <span className="text-xs text-gray-700">{c.player?.name ?? "—"}</span>
                              </div>
                              {c.minute != null && <span className="text-xs text-gray-400 shrink-0">{c.minute}′</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 하단 날짜/장소/날씨 */}
            <div className="px-5 py-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>📅</span>
                <span>{new Date(event.date).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric", weekday: "short" })}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>📍</span>
                <span className="truncate">{event.location}</span>
              </div>
              {event.weather && (
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{getWeatherIcon(event.weather)}</span>
                  <span>
                    {event.weatherDescription ?? event.weather}
                    {event.temperature != null && ` · ${event.temperature}°C`}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 팀 운동 페이지로 돌아가기 */}
        <div className="pt-6">
          <button
            onClick={() => router.push(`/training/${event.id}`)}
            className="w-full py-3.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-semibold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform shadow-lg"
          >
            📋 팀 운동 페이지로
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamLogo({ team, size = "lg" }: { team: TeamInfo; size?: "sm" | "lg" }) {
  const dim = size === "lg" ? "w-16 h-16 text-2xl" : "w-10 h-10 text-sm";
  if (team.logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={team.logoUrl}
        alt={team.name}
        className={`${dim} rounded-full object-cover border-2 border-white shadow-md mx-auto`}
      />
    );
  }
  return (
    <div
      className={`${dim} rounded-full flex items-center justify-center border-2 border-white shadow-md mx-auto font-bold text-white`}
      style={{ backgroundColor: team.primaryColor }}
    >
      {team.name[0]}
    </div>
  );
}

export default function ChallengeClient({
  token,
  event,
  isLoggedIn,
  userId,
  hasTeam,
  isSameTeam,
  isAdmin,
  receiverTeam,
  hostUniformColor,
  opponentTeam,
  opponentTeamName,
}: Props) {
  const router = useRouter();
  const cardRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [showRejectConfirm, setShowRejectConfirm] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showReferee, setShowReferee] = useState(false);
  const [showRulesSheet, setShowRulesSheet] = useState(false);

  // 토큰 없음 / 이벤트 없음
  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">유효하지 않은 도전장</h1>
          <p className="text-sm text-gray-500">도전장 링크가 잘못되었거나 이미 사용되었습니다.</p>
        </div>
      </div>
    );
  }

  const teamColor = event.team.primaryColor || "#1D4237";
  const registeredOpponent = opponentTeam ?? receiverTeam;
  const opponentColor = registeredOpponent?.primaryColor ?? "#374151";
  const opponentName = registeredOpponent?.name ?? event.opponentTeamName ?? "상대팀";

  const handleSaveRules = async (rules: MatchRulesPayload) => {
    const res = await fetch(`/api/challenge/${token}/rules`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rules),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "저장에 실패했습니다");
    }
    router.refresh();
  };

  const isExpired =
    event.challengeTokenExpiresAt && new Date(event.challengeTokenExpiresAt) < new Date();

  // 경기 진행 중 → 라이브 기록 모드
  if (event.matchStatus === "IN_PROGRESS") {
    return (
      <>
        <ChallengeLiveMode
          token={token}
          isLoggedIn={isLoggedIn}
          onEditRules={isAdmin ? () => setShowRulesSheet(true) : undefined}
        />
        {isAdmin && (
          <MatchRulesBottomSheet
            isOpen={showRulesSheet}
            onClose={() => setShowRulesSheet(false)}
            onSave={handleSaveRules}
            initialRules={event.matchRules ?? undefined}
            hostTeamName={event.team.name}
            opponentTeamName={opponentName}
            hostTeamColor={teamColor}
            opponentTeamColor={opponentColor}
          />
        )}
      </>
    );
  }

  // 경기 종료
  if (event.matchStatus === "COMPLETED") {
    return (
      <MatchResultView
        event={event}
        opponentTeam={opponentTeam}
        opponentTeamName={opponentTeamName}
        userId={userId}
      />
    );
  }

  // 수락 완료 (인원 모집 중 / 경기 대기)
  if (event.matchStatus === "CONFIRMED") {
    const isMatchDay = new Date().toDateString() === new Date(event.date).toDateString();
    return (
      <>
        <ConfirmedView
          token={token}
          event={event}
          isMatchDay={isMatchDay}
          onStarted={() => router.refresh()}
          isAdmin={isAdmin}
          onEditRules={() => setShowRulesSheet(true)}
        />
        {isAdmin && (
          <MatchRulesBottomSheet
            isOpen={showRulesSheet}
            onClose={() => setShowRulesSheet(false)}
            onSave={handleSaveRules}
            initialRules={event.matchRules ?? undefined}
            hostTeamName={event.team.name}
            opponentTeamName={opponentName}
            hostTeamColor={teamColor}
            opponentTeamColor={opponentColor}
          />
        )}
      </>
    );
  }

  const isAlreadyMatched = event.matchStatus !== "CHALLENGE_SENT";

  if (isExpired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">도전장이 만료되었습니다</h1>
          <p className="text-sm text-gray-500">이 도전장의 유효기간이 지났습니다.</p>
        </div>
      </div>
    );
  }

  if (isAlreadyMatched) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🤝</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">이미 성사된 경기입니다</h1>
          <p className="text-sm text-gray-500">이 도전장은 이미 수락되었습니다.</p>
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
  const rules = event.matchRules;
  const requiredPlayers = event.minimumPlayers ?? rules?.playersPerSide ?? 0;
  const hostAttendCount = event._count.rsvps;
  const hostHasEnoughPlayers = requiredPlayers === 0 || hostAttendCount >= requiredPlayers;
  const mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(event.location)}`;

  const handleSaveImage = async () => {
    if (!cardRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `도전장-${event.team.name}.png`, { type: "image/png" });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `⚽ ${event.team.name} 도전장` });
      } else {
        const link = document.createElement("a");
        link.download = `도전장-${event.team.name}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error(err);
    }
  };

  const handleAccept = async () => {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/challenge/${token}/accept`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setAccepted(true);
        setTimeout(() => router.push(`/training/${data.opponentEventId}`), 1500);
      } else {
        if (data.code === "SAME_TEAM") setError("자신의 팀에는 도전장을 수락할 수 없습니다");
        else if (data.code === "ALREADY_MATCHED") setError("이미 매칭이 진행 중입니다");
        else if (data.code === "INSUFFICIENT_PLAYERS") setError(data.error);
        else setError(data.error || "수락에 실패했습니다");
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
    router.push(`/login?callbackUrl=${encodeURIComponent(window.location.href)}`);
  };

  const handleOnboarding = () => {
    router.push(`/onboarding?returnUrl=${encodeURIComponent(window.location.href)}`);
  };

  if (accepted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">도전장을 수락했습니다!</h1>
          <p className="text-sm text-gray-500">경기 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  if (rejected) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🙏</div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">도전장을 거절했습니다</h1>
          <p className="text-sm text-gray-500">상대팀에게 거절 사실이 전달됩니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="max-w-sm w-full space-y-4">
        {/* 도전장 카드 */}
        <div ref={cardRef} className="bg-white rounded-2xl shadow-lg overflow-hidden">

          {/* VS 헤더 */}
          <div className="relative px-6 py-6" style={{ backgroundColor: teamColor + "12" }}>
            {/* 이미지 저장 버튼 */}
            <button
              onClick={handleSaveImage}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/60 hover:bg-white/90 text-gray-400 hover:text-gray-600 transition-colors"
              title="도전장 공유하기"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <p className="text-xs font-semibold text-gray-400 text-center tracking-widest mb-5">⚽ 도전장</p>
            <div className="flex items-center justify-between gap-2">

              {/* 호스트팀 */}
              <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                <TeamLogo team={event.team} size="lg" />
                <p className="text-sm font-bold text-gray-900 text-center truncate w-full px-1">{event.team.name}</p>
                <div className="flex items-center gap-1 px-2.5 py-1 bg-white/70 rounded-full border border-white/80">
                  <Shirt
                    className="w-3.5 h-3.5 shrink-0"
                    style={{
                      fill: hostUniformColor || "transparent",
                      color: hostUniformColor ? "#9CA3AF" : teamColor,
                    }}
                    strokeWidth={2}
                  />
                  <span
                    className="text-[10px] font-semibold truncate"
                    style={{ color: hostUniformColor || teamColor }}
                  >
                    {event.uniform || "홈"}
                  </span>
                </div>
              </div>

              {/* VS */}
              <div className="flex flex-col items-center gap-1 shrink-0">
                <span className="text-xl font-black text-gray-200">VS</span>
              </div>

              {/* 상대팀 — 앱 가입 팀(opponentTeam/receiverTeam) > 이름만 있는 팀 > 미상 */}
              <div className="flex-1 flex flex-col items-center gap-1.5 min-w-0">
                {(() => {
                  // 앱에 등록된 팀이 있으면 로고 표시
                  const registeredTeam = opponentTeam ?? receiverTeam;
                  if (registeredTeam) {
                    return (
                      <>
                        <TeamLogo team={registeredTeam} size="lg" />
                        <p className="text-sm font-bold text-gray-900 text-center truncate w-full px-1">{registeredTeam.name}</p>
                      </>
                    );
                  }
                  // 이름만 알고 있는 팀 (앱 미가입)
                  const knownName = event.opponentTeamName;
                  return (
                    <>
                      <div className="w-16 h-16 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center mx-auto bg-gray-50">
                        <span className="text-2xl">?</span>
                      </div>
                      <p className={`text-sm text-center truncate w-full px-1 ${knownName ? "font-bold text-gray-900" : "text-gray-400"}`}>
                        {knownName ?? (!isLoggedIn ? "로그인 후 확인" : !hasTeam ? "팀 가입 필요" : "—")}
                      </p>
                    </>
                  );
                })()}
                {/* 원정 유니폼 — 수락 전이므로 항상 미정 */}
                <div className="flex items-center gap-1 px-2.5 py-1 bg-white/70 rounded-full border border-white/80">
                  <Shirt className="w-3.5 h-3.5 shrink-0 text-gray-300" strokeWidth={2} />
                  <span className="text-[10px] text-gray-400 font-medium">유니폼 미정</span>
                </div>
              </div>
            </div>
          </div>

          {/* 경기 정보 */}
          <div className="px-6 py-5 space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{dateStr}</p>
                {rules?.kickoffTime && (() => {
                  const [h, m] = rules.kickoffTime.split(":").map(Number);
                  const totalMin = rules.quarterCount * rules.quarterMinutes + rules.quarterBreak * (rules.quarterCount - 1);
                  const endMin = h * 60 + m + totalMin;
                  const endStr = `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
                  return (
                    <p className="text-xs text-gray-700 font-medium mt-0.5">
                      킥오프 {rules.kickoffTime} → 종료 {endStr}
                    </p>
                  );
                })()}
              </div>
            </div>

            <div className="flex items-start gap-3">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 underline underline-offset-2 break-all"
              >
                {event.location}
              </a>
            </div>

            {event.shoes.length > 0 && (
              <div className="flex items-start gap-3">
                <Footprints className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                <p className="text-sm text-gray-900">{event.shoes.join(", ")}</p>
              </div>
            )}

            {/* 경기 방식 */}
            {rules && (
              <div className="pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">경기 방식</span>
                  </div>
                  {isAdmin && (
                    <button
                      onClick={() => setShowRulesSheet(true)}
                      className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <div className="space-y-1.5 text-xs text-gray-700">
                  {requiredPlayers > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-400 w-3 text-center shrink-0">👥</span>
                      <span className="font-semibold">{requiredPlayers} vs {requiredPlayers}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3 h-3 text-gray-400 shrink-0" />
                    <span>
                      {rules.quarterCount}쿼터 × {rules.quarterMinutes}분
                      {rules.quarterBreak > 0 && `, 쿼터 휴식 ${rules.quarterBreak}분`}
                    </span>
                  </div>
                  {rules.quarterRefereeTeams && rules.quarterRefereeTeams.length > 0 && (
                    <div className="pt-1.5 border-t border-gray-100">
                      <button
                        onClick={() => setShowReferee((v) => !v)}
                        className="flex items-center justify-between w-full"
                      >
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">쿼터별 심판</p>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-gray-400 transition-transform ${showReferee ? "rotate-180" : ""}`}
                        />
                      </button>
                      {showReferee && (
                        <div className="space-y-1.5 mt-2">
                          {rules.quarterRefereeTeams.map((team, i) => (
                            <div key={i} className="flex items-center gap-2">
                              <span className="text-gray-400 w-8 shrink-0">{i + 1}Q</span>
                              <div className="flex gap-1 flex-1">
                                <div
                                  className={`flex-1 text-center py-1 rounded-lg text-xs font-semibold ${
                                    team === "TEAM_A" ? "text-white" : "bg-gray-100 text-gray-400"
                                  }`}
                                  style={team === "TEAM_A" ? { backgroundColor: teamColor } : {}}
                                >
                                  {event.team.name}
                                </div>
                                <div
                                  className={`flex-1 text-center py-1 rounded-lg text-xs font-semibold ${
                                    team === "TEAM_B" ? "text-white" : "bg-gray-100 text-gray-400"
                                  }`}
                                  style={team === "TEAM_B" ? { backgroundColor: opponentColor } : {}}
                                >
                                  {opponentName}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
            <p className="text-sm text-amber-700 text-center">본인 팀의 도전장입니다</p>
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
            {requiredPlayers > 0 && !hostHasEnoughPlayers && (
              <p className="text-xs text-center text-gray-400">
                {event.team.name} 참석 확정 {hostAttendCount}/{requiredPlayers}명 — 인원이 채워지면 수락할 수 있어요
              </p>
            )}
            <button
              onClick={handleAccept}
              disabled={submitting || rejecting || !hostHasEnoughPlayers}
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

      {isAdmin && (
        <MatchRulesBottomSheet
          isOpen={showRulesSheet}
          onClose={() => setShowRulesSheet(false)}
          onSave={handleSaveRules}
          initialRules={event.matchRules ?? undefined}
          hostTeamName={event.team.name}
          opponentTeamName={opponentName}
          hostTeamColor={teamColor}
          opponentTeamColor={opponentColor}
        />
      )}

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
