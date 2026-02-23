"use client";

import { useState, useEffect } from "react";

export interface MatchRulesPayload {
  quarterCount: number;
  quarterMinutes: number;
  quarterBreak: number;
  kickoffTime: string | null;
  quarterRefereeTeams: ("TEAM_A" | "TEAM_B")[];
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rules: MatchRulesPayload) => Promise<void>;
  initialRules?: {
    quarterCount?: number;
    quarterMinutes?: number;
    quarterBreak?: number;
    kickoffTime?: string | null;
    quarterRefereeTeams?: ("TEAM_A" | "TEAM_B")[] | null;
  };
  hostTeamName: string;
  opponentTeamName: string;
  hostTeamColor: string;
  opponentTeamColor: string;
}

export default function MatchRulesBottomSheet({
  isOpen,
  onClose,
  onSave,
  initialRules,
  hostTeamName,
  opponentTeamName,
  hostTeamColor,
  opponentTeamColor,
}: Props) {
  const [quarterCount, setQuarterCount] = useState(initialRules?.quarterCount ?? 4);
  const [quarterMinutes, setQuarterMinutes] = useState(initialRules?.quarterMinutes ?? 20);
  const [quarterBreak, setQuarterBreak] = useState(initialRules?.quarterBreak ?? 5);
  const [kickoffTime, setKickoffTime] = useState(initialRules?.kickoffTime ?? "");
  const [quarterRefereeTeams, setQuarterRefereeTeams] = useState<("TEAM_A" | "TEAM_B")[]>(
    initialRules?.quarterRefereeTeams ??
      Array.from({ length: initialRules?.quarterCount ?? 4 }, (_, i) =>
        i % 2 === 0 ? "TEAM_A" : "TEAM_B"
      )
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // 시트가 열릴 때마다 initialRules로 초기화
  useEffect(() => {
    if (isOpen) {
      setQuarterCount(initialRules?.quarterCount ?? 4);
      setQuarterMinutes(initialRules?.quarterMinutes ?? 20);
      setQuarterBreak(initialRules?.quarterBreak ?? 5);
      setKickoffTime(initialRules?.kickoffTime ?? "");
      setQuarterRefereeTeams(
        initialRules?.quarterRefereeTeams ??
          Array.from({ length: initialRules?.quarterCount ?? 4 }, (_, i) =>
            i % 2 === 0 ? "TEAM_A" : "TEAM_B"
          )
      );
      setError("");
    }
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave({
        quarterCount,
        quarterMinutes,
        quarterBreak,
        kickoffTime: kickoffTime || null,
        quarterRefereeTeams,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={saving ? undefined : onClose} />
      <div className="relative w-full bg-white rounded-t-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-semibold text-gray-900">경기 방식 수정</h3>

        {/* 경기 방식 */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">경기 방식</label>
          <div className="space-y-3 bg-gray-50 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">쿼터 수</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.max(1, quarterCount - 1);
                    setQuarterCount(next);
                    setQuarterRefereeTeams((prev) =>
                      Array.from({ length: next }, (_, i) => prev[i] ?? (i % 2 === 0 ? "TEAM_A" : "TEAM_B"))
                    );
                  }}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-semibold text-gray-900">{quarterCount}</span>
                <button
                  type="button"
                  onClick={() => {
                    const next = Math.min(8, quarterCount + 1);
                    setQuarterCount(next);
                    setQuarterRefereeTeams((prev) =>
                      Array.from({ length: next }, (_, i) => prev[i] ?? (i % 2 === 0 ? "TEAM_A" : "TEAM_B"))
                    );
                  }}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">쿼터별 시간</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuarterMinutes(Math.max(1, quarterMinutes - 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  −
                </button>
                <span className="w-12 text-center text-sm font-semibold text-gray-900">{quarterMinutes}분</span>
                <button
                  type="button"
                  onClick={() => setQuarterMinutes(Math.min(60, quarterMinutes + 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">쿼터 사이 쉬는시간</span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuarterBreak(Math.max(0, quarterBreak - 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  −
                </button>
                <span className="w-12 text-center text-sm font-semibold text-gray-900">{quarterBreak}분</span>
                <button
                  type="button"
                  onClick={() => setQuarterBreak(Math.min(30, quarterBreak + 1))}
                  className="w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-gray-600 font-medium"
                >
                  +
                </button>
              </div>
            </div>
            <div className="pt-2 border-t border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-500">총 경기시간</span>
              <span className="text-sm font-semibold text-gray-800">
                {quarterCount * quarterMinutes + quarterBreak * (quarterCount - 1)}분
              </span>
            </div>
          </div>
        </div>

        {/* 쿼터별 심판팀 */}
        <div>
          <label className="block text-sm text-gray-600 mb-2">쿼터별 심판</label>
          <div className="grid gap-2">
            {Array.from({ length: quarterCount }, (_, i) => (
              <div key={i} className="flex items-center justify-between">
                <span className="text-sm text-gray-700">{i + 1}쿼터</span>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
                  <button
                    type="button"
                    onClick={() =>
                      setQuarterRefereeTeams((prev) => prev.map((t, j) => (j === i ? "TEAM_A" : t)))
                    }
                    className={`px-3 py-1.5 transition-colors ${
                      quarterRefereeTeams[i] === "TEAM_A" ? "text-white" : "bg-white text-gray-500"
                    }`}
                    style={quarterRefereeTeams[i] === "TEAM_A" ? { backgroundColor: hostTeamColor } : {}}
                  >
                    {hostTeamName}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setQuarterRefereeTeams((prev) => prev.map((t, j) => (j === i ? "TEAM_B" : t)))
                    }
                    className={`px-3 py-1.5 transition-colors ${
                      quarterRefereeTeams[i] === "TEAM_B" ? "text-white" : "bg-white text-gray-500"
                    }`}
                    style={quarterRefereeTeams[i] === "TEAM_B" ? { backgroundColor: opponentTeamColor } : {}}
                  >
                    {opponentTeamName}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 킥오프 시간 */}
        <div>
          <label className="block text-sm text-gray-600 mb-1">킥오프 시간</label>
          <div className="flex items-center gap-3">
            <input
              type="time"
              value={kickoffTime}
              onChange={(e) => setKickoffTime(e.target.value)}
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-sm text-gray-900 focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
            {kickoffTime && (
              <div className="text-sm text-gray-500 shrink-0">
                → 종료{" "}
                <span className="font-semibold text-gray-900">
                  {(() => {
                    const [h, m] = kickoffTime.split(":").map(Number);
                    const totalMin = quarterCount * quarterMinutes + quarterBreak * (quarterCount - 1);
                    const endMin = h * 60 + m + totalMin;
                    return `${String(Math.floor(endMin / 60) % 24).padStart(2, "0")}:${String(endMin % 60).padStart(2, "0")}`;
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-medium disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-xl bg-gray-900 text-white font-medium disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
