"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import confetti from "canvas-confetti";
import { getPomVotingStatus, isPomVotingClosed } from "@/lib/pom";

interface User {
  id: string;
  name: string | null;
  image: string | null;
  position?: string | null;
  number?: number | null;
}

interface CheckInEntry {
  userId: string;
  user: User;
}

interface PomResult {
  user: User;
  votes: { voter: User; reason: string; createdAt: string }[];
  count: number;
}

interface Props {
  eventId: string;
  eventDate: string;
  pomVotingDeadline: string | null;
  checkIns: CheckInEntry[];
}

export default function PomVoting({ eventId, eventDate, pomVotingDeadline, checkIns }: Props) {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<PomResult[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [myVote, setMyVote] = useState<{ nomineeId: string; nomineeName: string | null; reason: string } | null>(null);
  const [selectedNomineeId, setSelectedNomineeId] = useState("");
  const [reason, setReason] = useState("");
  const [showResults, setShowResults] = useState(false);

  const votingStatus = getPomVotingStatus(eventDate, pomVotingDeadline);
  const isClosed = isPomVotingClosed(eventDate, pomVotingDeadline);

  useEffect(() => {
    fetchPomData();
  }, []);

  // 결과 표시 시 confetti 실행 (첫 회만)
  useEffect(() => {
    if (showResults && results.length > 0 && isClosed) {
      const confettiKey = `pom-confetti-${eventId}`;
      const hasShownConfetti = localStorage.getItem(confettiKey);

      if (!hasShownConfetti) {
        // Confetti 애니메이션
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        localStorage.setItem(confettiKey, "true");
      }
    }
  }, [showResults, results.length, isClosed, eventId]);

  const fetchPomData = async () => {
    try {
      const res = await fetch(`/api/training-events/${eventId}/pom`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setTotalVotes(data.totalVotes || 0);
        setMyVote(data.myVote);
        if (data.myVote) {
          setSelectedNomineeId(data.myVote.nomineeId);
          setReason(data.myVote.reason);
        }
        // 투표 마감 시 자동으로 결과 표시
        if (isClosed && data.results.length > 0) {
          setShowResults(true);
        }
      }
    } catch (error) {
      console.error("POM 데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedNomineeId || !reason.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${eventId}/pom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nomineeId: selectedNomineeId, reason: reason.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        setMyVote({
          nomineeId: data.vote.nomineeId,
          nomineeName: data.vote.nomineeName,
          reason: data.vote.reason,
        });
        fetchPomData();
      } else {
        const data = await res.json();
        alert(data.error || "투표에 실패했습니다");
      }
    } catch (error) {
      console.error("투표 실패:", error);
      alert("투표에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-5">
        <p className="text-sm text-gray-400 text-center">로딩 중...</p>
      </div>
    );
  }

  // 투표 기간 아직 시작 안 됨
  if (!votingStatus.isOpen && !isClosed) {
    return (
      <div className="bg-white rounded-xl p-5 text-center">
        <div className="text-4xl mb-3">🏆</div>
        <h3 className="text-sm font-semibold text-gray-900 mb-2">오늘의 MVP 투표</h3>
        <p className="text-sm text-gray-500">{votingStatus.message}</p>
      </div>
    );
  }

  // 마감 후 자동으로 결과 표시
  if (isClosed && totalVotes > 0 && !myVote) {
    const winner = results[0];
    return (
      <div className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 space-y-4">
        {/* 우승자 */}
        {winner && (
          <div className="text-center space-y-3">
            <div className="text-6xl animate-bounce">🏆</div>
            <h3 className="text-xl font-bold text-gray-900">오늘의 MVP</h3>
            <div className="flex flex-col items-center gap-2">
              {winner.user.image ? (
                <Image
                  src={winner.user.image}
                  alt={winner.user.name || ""}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-team-100 flex items-center justify-center">
                  <span className="text-2xl text-team-500">🎖️</span>
                </div>
              )}
              <div>
                <p className="text-lg font-semibold text-gray-900">{winner.user.name || "익명"}</p>
                {(winner.user.position || winner.user.number) && (
                  <p className="text-sm text-gray-500">
                    {winner.user.position || ""} {winner.user.number ? `${winner.user.number}` : ""}
                  </p>
                )}
                <p className="text-sm font-medium text-team-600 mt-1">{winner.count}표 획득</p>
              </div>
            </div>

            {/* 팀원 코멘트 */}
            <div className="bg-white rounded-lg p-4 space-y-2 max-h-60 overflow-y-auto">
              <p className="text-xs font-semibold text-gray-700 mb-2">팀원 코멘트</p>
              {winner.votes.map((vote, idx) => (
                <div key={idx} className="text-left p-2 bg-gray-50 rounded text-sm">
                  <p className="font-medium text-gray-900 text-xs mb-1">{vote.voter.name || "익명"}</p>
                  <p className="text-gray-700">{vote.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 전체 결과 */}
        {results.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-700">전체 결과</p>
            {results.slice(1).map((result, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm bg-white rounded-lg p-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400">{idx + 2}위</span>
                  <span className="font-medium text-gray-900">{result.user.name || "익명"}</span>
                </div>
                <span className="text-gray-500">{result.count}표</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // 투표 진행 중
  return (
    <div className="space-y-4">
      {/* 투표 마감 정보 */}
      <p className="text-xs text-gray-500">{votingStatus.message}</p>

      {myVote ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold text-team-700">✅ 투표 완료</p>
          {!isClosed ? (
            // 마감 전: 본인 투표 내용 숨김
            <>
              <p className="text-sm text-gray-700">
                투표가 완료되었습니다. 마감 후 결과를 확인할 수 있습니다.
              </p>
              <button
                onClick={() => {
                  // 다시 투표하기 - myVote를 null로 설정하고 기존 값으로 폼 채우기
                  setMyVote(null);
                  setSelectedNomineeId(myVote.nomineeId);
                  setReason(myVote.reason);
                }}
                className="w-full py-2 bg-white border border-team-300 text-team-600 rounded-lg text-sm font-medium hover:bg-team-50 transition-colors"
              >
                다시 투표하기
              </button>
            </>
          ) : (
            // 마감 후: 본인 투표 내용 공개
            <>
              <p className="text-sm text-gray-900">
                <span className="font-medium">{myVote.nomineeName}</span>에게 투표했습니다
              </p>
              <p className="text-sm text-gray-700 italic">"{myVote.reason}"</p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* 선수 선택 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">선수 선택</label>
            <select
              value={selectedNomineeId}
              onChange={(e) => setSelectedNomineeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900"
            >
              <option value="">선수를 선택하세요</option>
              {checkIns.map((checkIn) => (
                <option key={checkIn.userId} value={checkIn.userId}>
                  {checkIn.user.name || "익명"}
                  {checkIn.user.position || checkIn.user.number
                    ? ` (${checkIn.user.position || ""} ${checkIn.user.number ? `${checkIn.user.number}` : ""})`
                    : ""}
                </option>
              ))}
            </select>
          </div>

          {/* 이유 입력 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-2">
              어떤 플레이가 좋았나요?
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 마지막 골 결정력이 대단했어요"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* 투표 버튼 */}
          <button
            onClick={handleSubmit}
            disabled={!selectedNomineeId || !reason.trim() || submitting}
            className="w-full py-3 bg-team-500 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? "투표 중..." : "투표하기"}
          </button>

          {/* 결과 보기 (투표 마감 후에만 가능) */}
          {isClosed && totalVotes > 0 && !showResults && (
            <button
              onClick={() => setShowResults(true)}
              className="w-full py-2 text-sm text-team-600 hover:text-team-700"
            >
              결과 보기 ({totalVotes}표)
            </button>
          )}
        </>
      )}

      {/* 결과 모달 */}
      {showResults && results.length > 0 && isClosed && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setShowResults(false)}
        >
          <div
            className="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 우승자 */}
            {results[0] && (
              <div className="text-center space-y-3">
                <div className="text-5xl">🏆</div>
                <h3 className="text-lg font-bold text-gray-900">
                  {isClosed ? "오늘의 MVP" : "현재 1위"}
                </h3>
                <div className="flex flex-col items-center gap-2">
                  {results[0].user.image ? (
                    <Image
                      src={results[0].user.image}
                      alt={results[0].user.name || ""}
                      width={56}
                      height={56}
                      className="w-14 h-14 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-team-100 flex items-center justify-center">
                      <span className="text-xl text-team-500">🎖️</span>
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-semibold text-gray-900">{results[0].user.name || "익명"}</p>
                    {(results[0].user.position || results[0].user.number) && (
                      <p className="text-sm text-gray-500">
                        {results[0].user.position || ""} {results[0].user.number ? `${results[0].user.number}` : ""}
                      </p>
                    )}
                    <p className="text-sm font-medium text-team-600 mt-1">{results[0].count}표 획득</p>
                  </div>
                </div>

                {/* 팀원 코멘트 */}
                <div className="bg-white rounded-lg p-4 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-gray-700 mb-2">팀원 코멘트</p>
                  {results[0].votes.map((vote, idx) => (
                    <div key={idx} className="text-left p-2 bg-gray-50 rounded text-sm">
                      <p className="font-medium text-gray-900 text-xs mb-1">{vote.voter.name || "익명"}</p>
                      <p className="text-gray-700">{vote.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 전체 결과 */}
            {results.length > 1 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">전체 결과</p>
                {results.slice(1).map((result, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm bg-white rounded-lg p-2">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">{idx + 2}위</span>
                      <span className="font-medium text-gray-900">{result.user.name || "익명"}</span>
                    </div>
                    <span className="text-gray-500">{result.count}표</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowResults(false)}
              className="w-full py-2.5 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </ div>
  );
}
