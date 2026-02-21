"use client";

import { useState, useRef, useEffect } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";
import { useToast } from "@/lib/useToast";
import Toast from "@/components/Toast";
import { MoreVertical, ChevronDown } from "lucide-react";
import { buildPhases, getPhaseInfo, calcElapsed } from "@/lib/match-phases";

interface Attendee {
  id: string;
  name: string | null;
  image: string | null;
}

interface TeamInfo {
  id: string | null;
  name: string;
  primaryColor: string;
  logoUrl: string | null;
}

interface GoalRecord {
  id: string;
  quarter: number;
  minute: number | null;
  scoringTeam: "TEAM_A" | "TEAM_B";
  isOwnGoal: boolean;
  scorer: Attendee | null;
  assistant: Attendee | null;
  createdAt: string;
}

interface CardRecord {
  id: string;
  quarter: number;
  minute: number | null;
  cardType: "YELLOW" | "RED";
  teamSide: "TEAM_A" | "TEAM_B";
  player: Attendee | null;
  createdAt: string;
}

interface SubstitutionRecord {
  id: string;
  quarter: number;
  minute: number | null;
  teamSide: "TEAM_A" | "TEAM_B";
  playerOut: Attendee | null;
  playerIn: Attendee | null;
  createdAt: string;
}

interface SessionAssignment {
  teamLabel: string;
  user: Attendee;
}

interface HostSession {
  orderIndex: number;
  title: string | null;
  teamAssignments: SessionAssignment[];
}

interface LiveData {
  matchStatus: string;
  teamAScore: number;
  teamBScore: number;
  teamA: TeamInfo;
  teamB: TeamInfo;
  teamAAttendees: Attendee[];
  teamBAttendees: Attendee[];
  quarterCount: number;
  goalRecords: GoalRecord[];
  cardRecords: CardRecord[];
  playerSubstitutions: SubstitutionRecord[];
  canRecord: boolean;
  canEnd: boolean;
  quarterMinutes: number;
  quarterBreak: number;
  halftime: number;
  timerPhase: number;
  timerRunning: boolean;
  timerStartedAt: string | null;
  timerElapsedSec: number;
  myTeamSessions: HostSession[];
}

type Sheet = "goal" | "substitution" | "card" | null;
type TeamSide = "TEAM_A" | "TEAM_B";
type TimelineItem =
  | { type: "goal"; data: GoalRecord }
  | { type: "substitution"; data: SubstitutionRecord }
  | { type: "card"; data: CardRecord };

interface Props {
  token: string;
  isLoggedIn: boolean;
}

export default function ChallengeLiveMode({ token, isLoggedIn }: Props) {
  const { data, mutate } = useSWR<LiveData>(
    `/api/challenge/${token}/live`,
    fetcher,
    { refreshInterval: 5000, revalidateOnFocus: true }
  );

  const [currentQuarter, setCurrentQuarter] = useState(1);
  const [viewQuarter, setViewQuarter] = useState<number | "all">("all");
  const [activeSheet, setActiveSheet] = useState<Sheet>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showKebab, setShowKebab] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showLineup, setShowLineup] = useState(false);
  const [tick, setTick] = useState(0);
  const [timerLoading, setTimerLoading] = useState(false);
  const kebabRef = useRef<HTMLDivElement>(null);
  const prevRemainingRef = useRef<number>(Infinity);
  const { toast, showToast, hideToast } = useToast();

  useEffect(() => {
    if (!showKebab) return;
    const handler = (e: MouseEvent) => {
      if (kebabRef.current && !kebabRef.current.contains(e.target as Node)) {
        setShowKebab(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showKebab]);

  // 타이머 로컬 틱
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // 진동 효과 (타이머 0이 됐을 때, canRecord 사용자만)
  // 주의: data 의존성이 있어 early return 이전에 위치해야 함 (React hooks 규칙)
  const timerPhaseForHook = data?.timerPhase ?? 0;
  const timerRunningForHook = data?.timerRunning ?? false;
  const timerStartedAtForHook = data?.timerStartedAt ?? null;
  const timerElapsedSecForHook = data?.timerElapsedSec ?? 0;
  const quarterCountForHook = data?.quarterCount ?? 4;
  const quarterMinutesForHook = data?.quarterMinutes ?? 12;
  const quarterBreakForHook = data?.quarterBreak ?? 2;
  const halftimeForHook = data?.halftime ?? 5;
  const canRecordForHook = data?.canRecord ?? false;
  useEffect(() => {
    if (timerPhaseForHook === 0) return;
    const phasesForHook = buildPhases(quarterCountForHook, quarterMinutesForHook, quarterBreakForHook, halftimeForHook);
    const phaseInfo = getPhaseInfo(timerPhaseForHook, phasesForHook);
    if (!phaseInfo) return;
    const elapsedNow = calcElapsed(timerElapsedSecForHook, timerRunningForHook ? timerStartedAtForHook : null);
    const rem = Math.max(0, phaseInfo.durationSec - elapsedNow);
    if (rem === 0 && prevRemainingRef.current > 0 && canRecordForHook) {
      navigator.vibrate?.([300, 100, 300, 100, 300]);
    }
    prevRemainingRef.current = rem;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, timerPhaseForHook]);

  // Goal sheet
  const [goalTeam, setGoalTeam] = useState<TeamSide>("TEAM_A");
  const [scorerId, setScorerId] = useState("");
  const [assistId, setAssistId] = useState("");
  const [isOwnGoal, setIsOwnGoal] = useState(false);
  const [goalMinute, setGoalMinute] = useState("");

  // Substitution sheet
  const [subTeam, setSubTeam] = useState<TeamSide>("TEAM_A");
  const [playerOutId, setPlayerOutId] = useState("");
  const [playerInId, setPlayerInId] = useState("");
  const [subMinute, setSubMinute] = useState("");

  // Card sheet
  const [cardType, setCardType] = useState<"YELLOW" | "RED">("YELLOW");
  const [cardTeam, setCardTeam] = useState<TeamSide>("TEAM_A");
  const [cardPlayerId, setCardPlayerId] = useState("");
  const [cardMinute, setCardMinute] = useState("");

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-400 text-sm">경기 데이터 로딩 중...</p>
      </div>
    );
  }

  const { teamA, teamB, teamAAttendees, teamBAttendees, quarterCount, canRecord, canEnd, myTeamSessions,
          quarterMinutes, quarterBreak, halftime, timerPhase, timerRunning, timerStartedAt, timerElapsedSec } = data;

  // 현재 쿼터 세션 (orderIndex = quarter - 1)
  const currentSession = myTeamSessions.find((s: HostSession) => s.orderIndex === currentQuarter - 1) ?? null;

  // 타이머 계산
  const phases = buildPhases(quarterCount, quarterMinutes, quarterBreak, halftime);
  const currentPhaseInfo = getPhaseInfo(timerPhase, phases);
  const elapsed = calcElapsed(timerElapsedSec, timerRunning ? timerStartedAt : null);
  // tick 참조해서 매초 재계산되도록
  void tick;
  const remaining = currentPhaseInfo ? Math.max(0, currentPhaseInfo.durationSec - elapsed) : 0;
  const remainingMin = Math.floor(remaining / 60);
  const remainingSec = remaining % 60;
  const isUrgent = remaining < 60 && timerPhase > 0;

  const handleTimer = async (action: "start" | "pause" | "next" | "prev") => {
    setTimerLoading(true);
    try {
      const res = await fetch(`/api/challenge/${token}/timer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        mutate();
      } else {
        const d = await res.json();
        showToast(d.error || "타이머 조작에 실패했습니다");
      }
    } finally {
      setTimerLoading(false);
    }
  };

  const handleEndMatch = async () => {
    if (!confirm("경기를 종료하시겠습니까?")) return;
    setEnding(true);
    setShowKebab(false);
    try {
      const res = await fetch(`/api/challenge/${token}/match-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const d = await res.json();
        showToast(d.error || "종료에 실패했습니다");
      }
    } finally {
      setEnding(false);
    }
  };

  const teamSideLabel = (side: TeamSide) => (side === "TEAM_A" ? teamA.name : teamB.name);
  const attendeesFor = (side: TeamSide) => (side === "TEAM_A" ? teamAAttendees : teamBAttendees);

  const allEvents: TimelineItem[] = [
    ...data.goalRecords.map((d) => ({ type: "goal" as const, data: d })),
    ...data.playerSubstitutions.map((d) => ({ type: "substitution" as const, data: d })),
    ...data.cardRecords.map((d) => ({ type: "card" as const, data: d })),
  ].sort((a, b) => {
    if (a.data.quarter !== b.data.quarter) return a.data.quarter - b.data.quarter;
    return new Date(a.data.createdAt).getTime() - new Date(b.data.createdAt).getTime();
  });

  const filteredEvents =
    viewQuarter === "all" ? allEvents : allEvents.filter((e) => e.data.quarter === viewQuarter);

  const openSheet = (sheet: Sheet) => {
    if (sheet === "goal") { setGoalTeam("TEAM_A"); setScorerId(""); setAssistId(""); setIsOwnGoal(false); setGoalMinute(""); }
    else if (sheet === "substitution") { setSubTeam("TEAM_A"); setPlayerOutId(""); setPlayerInId(""); setSubMinute(""); }
    else if (sheet === "card") { setCardType("YELLOW"); setCardTeam("TEAM_A"); setCardPlayerId(""); setCardMinute(""); }
    setActiveSheet(sheet);
  };

  const post = async (path: string, body: object) => {
    const res = await fetch(`/api/challenge/${token}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res;
  };

  // 참석자 중 ID로 찾기 (양팀 통합)
  const findAttendee = (id: string): Attendee | null => {
    if (!id || !data) return null;
    return [...data.teamAAttendees, ...data.teamBAttendees].find((u) => u.id === id) ?? null;
  };

  const handleGoalSubmit = async () => {
    setSubmitting(true);
    const body = {
      quarter: currentQuarter,
      minute: goalMinute ? parseInt(goalMinute) : null,
      scoringTeam: goalTeam,
      scorerId: !isOwnGoal && scorerId ? scorerId : null,
      assistId: assistId || null,
      isOwnGoal,
    };
    // 즉시 sheet 닫고 optimistic update 적용
    setActiveSheet(null);
    const optimisticGoal: GoalRecord = {
      id: `opt-${Date.now()}`,
      quarter: currentQuarter,
      minute: body.minute,
      scoringTeam: goalTeam,
      isOwnGoal,
      scorer: !isOwnGoal && scorerId ? findAttendee(scorerId) : null,
      assistant: assistId ? findAttendee(assistId) : null,
      createdAt: new Date().toISOString(),
    };
    mutate(
      (cur) => {
        if (!cur) return cur;
        const aGoal = goalTeam === "TEAM_A";
        return {
          ...cur,
          teamAScore: aGoal ? cur.teamAScore + 1 : cur.teamAScore,
          teamBScore: !aGoal ? cur.teamBScore + 1 : cur.teamBScore,
          goalRecords: [...cur.goalRecords, optimisticGoal],
        };
      },
      { revalidate: false }
    );
    try {
      const res = await post("goal", body);
      if (res.ok) {
        showToast("⚽ 골이 기록되었습니다!");
        mutate(); // 백그라운드에서 실제 서버 데이터로 동기화
      } else {
        const d = await res.json();
        showToast(d.error || "기록에 실패했습니다");
        mutate(); // 롤백을 위해 서버 데이터로 복원
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubSubmit = async () => {
    setSubmitting(true);
    const body = {
      quarter: currentQuarter,
      minute: subMinute ? parseInt(subMinute) : null,
      teamSide: subTeam,
      playerOutId: playerOutId || null,
      playerInId: playerInId || null,
    };
    setActiveSheet(null);
    const optimisticSub: SubstitutionRecord = {
      id: `opt-${Date.now()}`,
      quarter: currentQuarter,
      minute: body.minute,
      teamSide: subTeam,
      playerOut: playerOutId ? findAttendee(playerOutId) : null,
      playerIn: playerInId ? findAttendee(playerInId) : null,
      createdAt: new Date().toISOString(),
    };
    mutate(
      (cur) => cur ? { ...cur, playerSubstitutions: [...cur.playerSubstitutions, optimisticSub] } : cur,
      { revalidate: false }
    );
    try {
      const res = await post("substitution", body);
      if (res.ok) { showToast("↕ 교체가 기록되었습니다!"); mutate(); }
      else { const d = await res.json(); showToast(d.error || "기록에 실패했습니다"); mutate(); }
    } finally { setSubmitting(false); }
  };

  const handleCardSubmit = async () => {
    setSubmitting(true);
    const body = {
      quarter: currentQuarter,
      minute: cardMinute ? parseInt(cardMinute) : null,
      cardType,
      teamSide: cardTeam,
      playerId: cardPlayerId || null,
    };
    setActiveSheet(null);
    const optimisticCard: CardRecord = {
      id: `opt-${Date.now()}`,
      quarter: currentQuarter,
      minute: body.minute,
      cardType,
      teamSide: cardTeam,
      player: cardPlayerId ? findAttendee(cardPlayerId) : null,
      createdAt: new Date().toISOString(),
    };
    mutate(
      (cur) => cur ? { ...cur, cardRecords: [...cur.cardRecords, optimisticCard] } : cur,
      { revalidate: false }
    );
    try {
      const res = await post("card", body);
      if (res.ok) { showToast("카드가 기록되었습니다!"); mutate(); }
      else { const d = await res.json(); showToast(d.error || "기록에 실패했습니다"); mutate(); }
    } finally { setSubmitting(false); }
  };

  const TeamSideToggle = ({ value, onChange }: { value: TeamSide; onChange: (v: TeamSide) => void }) => (
    <div className="flex rounded-xl overflow-hidden border border-gray-200">
      <button
        type="button"
        className={`flex-1 py-2.5 text-sm font-medium transition-colors ${value === "TEAM_A" ? "text-white" : "bg-white text-gray-600"}`}
        style={value === "TEAM_A" ? { backgroundColor: teamA.primaryColor } : {}}
        onClick={() => onChange("TEAM_A")}
      >
        {teamA.name}
      </button>
      <button
        type="button"
        className={`flex-1 py-2.5 text-sm font-medium transition-colors ${value === "TEAM_B" ? "text-white" : "bg-white text-gray-600"}`}
        style={value === "TEAM_B" ? { backgroundColor: teamB.primaryColor } : {}}
        onClick={() => onChange("TEAM_B")}
      >
        {teamB.name}
      </button>
    </div>
  );

  const MemberSelect = ({
    value, onChange, placeholder, exclude, side,
  }: { value: string; onChange: (v: string) => void; placeholder?: string; exclude?: string; side: TeamSide }) => {
    const list = attendeesFor(side).filter((u) => u.id !== exclude);
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 bg-white"
      >
        <option value="">{placeholder ?? "선수 선택 (선택사항)"}</option>
        {list.map((u) => (
          <option key={u.id} value={u.id}>{u.name ?? "이름없음"}</option>
        ))}
      </select>
    );
  };

  const MinuteInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <input
      type="number" min="1" max="120" placeholder="분 입력 (선택사항)"
      value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900"
    />
  );

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Score header */}
      <div className="bg-white border-b border-gray-100 px-4 py-5">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center mb-4 relative">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              경기 진행 중
            </span>
            {canEnd && (
              <div ref={kebabRef} className="absolute right-0">
                <button
                  onClick={() => setShowKebab((v) => !v)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {showKebab && (
                  <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-lg border border-gray-100 py-1 w-36 z-30">
                    <button
                      onClick={handleEndMatch}
                      disabled={ending}
                      className="w-full px-4 py-2.5 text-sm text-red-600 font-medium text-left hover:bg-red-50 disabled:opacity-50"
                    >
                      {ending ? "종료 중..." : "경기 종료"}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1 truncate font-medium">{teamA.name}</p>
              <p className="text-5xl font-bold tabular-nums" style={{ color: teamA.primaryColor }}>{data.teamAScore}</p>
            </div>
            <div className="text-center shrink-0">
              <p className="text-2xl text-gray-300 font-light">:</p>
              <p className="text-xs text-gray-400 mt-1">{currentQuarter}Q</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-xs text-gray-500 mb-1 truncate font-medium">{teamB.name}</p>
              <p className="text-5xl font-bold tabular-nums" style={{ color: teamB.primaryColor }}>{data.teamBScore}</p>
            </div>
          </div>
          {/* 쿼터 이동 (기록 권한 있는 사용자) */}
          {canRecord && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button onClick={() => setCurrentQuarter((q) => Math.max(1, q - 1))} disabled={currentQuarter <= 1}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 text-lg disabled:opacity-30 active:scale-90">‹</button>
              <span className="text-sm font-medium text-gray-600 w-24 text-center">{currentQuarter}쿼터 기록 중</span>
              <button onClick={() => setCurrentQuarter((q) => Math.min(quarterCount, q + 1))} disabled={currentQuarter >= quarterCount}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-500 text-lg disabled:opacity-30 active:scale-90">›</button>
            </div>
          )}
          {/* 타이머 */}
          {timerPhase > 0 ? (
            <div className="mt-4 text-center">
              <div className={`text-2xl font-mono font-bold tabular-nums ${isUrgent ? "text-red-500" : "text-gray-900"}`}>
                {String(remainingMin).padStart(2, "0")}:{String(remainingSec).padStart(2, "0")}
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{currentPhaseInfo?.label ?? ""}</p>
              {canRecord && (
                <div className="flex items-center justify-center gap-2 mt-3">
                  <button
                    onClick={() => handleTimer(timerRunning ? "pause" : "start")}
                    disabled={timerLoading}
                    className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 text-base disabled:opacity-40 active:scale-90"
                  >
                    {timerRunning ? "⏸" : "▶"}
                  </button>
                  <button
                    onClick={() => handleTimer("prev")}
                    disabled={timerLoading || timerPhase <= 1}
                    className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium disabled:opacity-30 active:scale-90"
                  >
                    ‹
                  </button>
                  <button
                    onClick={() => handleTimer("next")}
                    disabled={timerLoading}
                    className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium disabled:opacity-30 active:scale-90"
                  >
                    ›
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* timerPhase === 0: 시작 전 — canRecord에게만 시작 버튼 표시 */
            canRecord && (
              <div className="mt-4 text-center">
                <button
                  onClick={() => handleTimer("next")}
                  disabled={timerLoading}
                  className="px-5 py-2 rounded-xl bg-gray-900 text-white text-sm font-semibold disabled:opacity-50 active:scale-95"
                >
                  1Q 시작
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Quarter filter */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex overflow-x-auto">
          {["all", ...Array.from({ length: quarterCount }, (_, i) => i + 1)].map((q) => (
            <button key={q} onClick={() => setViewQuarter(q as number | "all")}
              className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                viewQuarter === q ? "border-gray-700 text-gray-900" : "border-transparent text-gray-400"
              }`}>
              {q === "all" ? "전체" : `${q}Q`}
            </button>
          ))}
        </div>
      </div>

      {/* 선발 라인업 (호스트팀 세션 기반) */}
      {currentSession && currentSession.teamAssignments.length > 0 && (
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setShowLineup((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3"
            >
              <span className="text-xs font-semibold text-gray-500">
                내 팀 {currentQuarter}Q 선발
                {currentSession.title && (
                  <span className="ml-1.5 text-gray-400 font-normal">· {currentSession.title}</span>
                )}
                <span className="ml-1.5 text-gray-400 font-normal">({currentSession.teamAssignments.length}명)</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showLineup ? "rotate-180" : ""}`} />
            </button>
            {showLineup && (
              <div className="px-4 pb-3 flex flex-wrap gap-2">
                {currentSession.teamAssignments.map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-full text-xs text-gray-700 font-medium border border-gray-100">
                    {a.user.name ?? "이름없음"}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="max-w-2xl mx-auto px-4 py-3 space-y-2">
        {filteredEvents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400 text-sm">아직 기록된 이벤트가 없습니다</p>
            {canRecord && <p className="text-gray-300 text-xs mt-1">아래 버튼으로 기록을 시작하세요</p>}
          </div>
        ) : (
          filteredEvents.map((evt, idx) => (
            <div key={idx} className="bg-white rounded-xl px-4 py-3 flex items-center gap-3 border border-gray-100">
              {evt.type === "goal" && (
                <>
                  <span className="text-xl shrink-0">{evt.data.isOwnGoal ? "🔄" : "⚽"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {evt.data.scorer?.name ?? (evt.data.isOwnGoal ? "자책골" : "선수미상")}
                      {evt.data.minute != null && <span className="text-gray-400 font-normal text-xs ml-1">{evt.data.minute}&apos;</span>}
                    </p>
                    {evt.data.assistant && <p className="text-xs text-gray-500 truncate">어시: {evt.data.assistant.name}</p>}
                    <p className="text-xs font-medium" style={{ color: evt.data.scoringTeam === "TEAM_A" ? teamA.primaryColor : teamB.primaryColor }}>
                      {evt.data.quarter}Q · {teamSideLabel(evt.data.scoringTeam)}
                    </p>
                  </div>
                </>
              )}
              {evt.type === "substitution" && (
                <>
                  <span className="text-xl shrink-0">↕️</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {evt.data.playerOut?.name ?? "—"} → {evt.data.playerIn?.name ?? "—"}
                      {evt.data.minute != null && <span className="text-gray-400 font-normal text-xs ml-1">{evt.data.minute}&apos;</span>}
                    </p>
                    <p className="text-xs text-gray-400">{evt.data.quarter}Q · {teamSideLabel(evt.data.teamSide)}</p>
                  </div>
                </>
              )}
              {evt.type === "card" && (
                <>
                  <span className="text-xl shrink-0">{evt.data.cardType === "YELLOW" ? "🟨" : "🟥"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {evt.data.player?.name ?? "선수미상"}
                      {evt.data.minute != null && <span className="text-gray-400 font-normal text-xs ml-1">{evt.data.minute}&apos;</span>}
                    </p>
                    <p className="text-xs text-gray-400">{evt.data.quarter}Q · {teamSideLabel(evt.data.teamSide)} · {evt.data.cardType === "YELLOW" ? "경고" : "퇴장"}</p>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>

      {/* 기록 버튼 (권한 있을 때만) */}
      {canRecord && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-20 pb-safe">
          <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2">
            <button onClick={() => openSheet("goal")} className="flex-1 py-3 rounded-xl bg-gray-900 text-white text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95">
              <span>⚽</span> 골
            </button>
            <button onClick={() => openSheet("substitution")} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95">
              <span>↕</span> 교체
            </button>
            <button onClick={() => openSheet("card")} className="flex-1 py-3 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold flex items-center justify-center gap-1.5 active:scale-95">
              <span>🟨</span> 카드
            </button>
          </div>
        </div>
      )}

      {/* 비로그인 안내 */}
      {!isLoggedIn && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 text-center">
          <p className="text-xs text-gray-400">로그인하면 경기 기록에 참여할 수 있습니다</p>
        </div>
      )}

      {/* Bottom sheets */}
      {activeSheet && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="absolute inset-0 bg-black/40" onClick={() => setActiveSheet(null)} />
          <div className="relative w-full bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {activeSheet === "goal" && (
              <>
                <h3 className="font-semibold text-gray-900 text-base">⚽ 골 기록</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">득점팀</label>
                    <TeamSideToggle value={goalTeam} onChange={(v) => { setGoalTeam(v); setScorerId(""); setAssistId(""); }} />
                  </div>
                  {!isOwnGoal && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">득점자 (선택)</label>
                      <MemberSelect value={scorerId} onChange={setScorerId} side={goalTeam} exclude={assistId} />
                    </div>
                  )}
                  {!isOwnGoal && scorerId && (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">어시스트 (선택)</label>
                      <MemberSelect value={assistId} onChange={setAssistId} side={goalTeam} exclude={scorerId} />
                    </div>
                  )}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={isOwnGoal}
                      onChange={(e) => { setIsOwnGoal(e.target.checked); setScorerId(""); setAssistId(""); }}
                      className="w-4 h-4 rounded" />
                    <span className="text-sm text-gray-700">자책골</span>
                  </label>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">분 (선택)</label>
                    <MinuteInput value={goalMinute} onChange={setGoalMinute} />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setActiveSheet(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium">취소</button>
                  <button onClick={handleGoalSubmit} disabled={submitting} className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-50">
                    {submitting ? "기록 중..." : "골 기록"}
                  </button>
                </div>
              </>
            )}

            {activeSheet === "substitution" && (
              <>
                <h3 className="font-semibold text-gray-900 text-base">↕ 교체 기록</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">팀</label>
                    <TeamSideToggle value={subTeam} onChange={(v) => { setSubTeam(v); setPlayerOutId(""); setPlayerInId(""); }} />
                  </div>
                  {attendeesFor(subTeam).length > 0 ? (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1.5">교체 아웃</label>
                        <MemberSelect value={playerOutId} onChange={setPlayerOutId} placeholder="나가는 선수" side={subTeam} exclude={playerInId} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1.5">교체 인</label>
                        <MemberSelect value={playerInId} onChange={setPlayerInId} placeholder="들어오는 선수" side={subTeam} exclude={playerOutId} />
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">이 팀의 참석 확정 멤버 정보가 없습니다.</p>
                  )}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">분 (선택)</label>
                    <MinuteInput value={subMinute} onChange={setSubMinute} />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setActiveSheet(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium">취소</button>
                  <button onClick={handleSubSubmit} disabled={submitting} className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-50">
                    {submitting ? "기록 중..." : "교체 기록"}
                  </button>
                </div>
              </>
            )}

            {activeSheet === "card" && (
              <>
                <h3 className="font-semibold text-gray-900 text-base">카드 기록</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">카드 종류</label>
                    <div className="flex rounded-xl overflow-hidden border border-gray-200">
                      <button type="button" onClick={() => setCardType("YELLOW")}
                        className={`flex-1 py-2.5 text-sm font-medium ${cardType === "YELLOW" ? "bg-yellow-400 text-white" : "bg-white text-gray-600"}`}>
                        🟨 경고
                      </button>
                      <button type="button" onClick={() => setCardType("RED")}
                        className={`flex-1 py-2.5 text-sm font-medium ${cardType === "RED" ? "bg-red-500 text-white" : "bg-white text-gray-600"}`}>
                        🟥 퇴장
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">팀</label>
                    <TeamSideToggle value={cardTeam} onChange={(v) => { setCardTeam(v); setCardPlayerId(""); }} />
                  </div>
                  {attendeesFor(cardTeam).length > 0 ? (
                    <div>
                      <label className="block text-sm text-gray-600 mb-1.5">선수 (선택)</label>
                      <MemberSelect value={cardPlayerId} onChange={setCardPlayerId} placeholder="선수 선택 (선택사항)" side={cardTeam} />
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">이 팀의 참석 확정 멤버 정보가 없습니다.</p>
                  )}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1.5">분 (선택)</label>
                    <MinuteInput value={cardMinute} onChange={setCardMinute} />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={() => setActiveSheet(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium">취소</button>
                  <button onClick={handleCardSubmit} disabled={submitting} className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-50">
                    {submitting ? "기록 중..." : "카드 기록"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <Toast message={toast?.message ?? ""} visible={!!toast} onHide={hideToast} />
    </div>
  );
}
