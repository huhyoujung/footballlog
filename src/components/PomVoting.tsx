// MVP 투표 컴포넌트 - 바텀시트 UI, pomVotesPerPerson에 따라 다중 선택 지원
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import confetti from "canvas-confetti";
import { useSWRConfig } from "swr";
import { toPng } from "html-to-image";
import { getPomVotingStatus, isPomVotingClosed } from "@/lib/pom";
import { STAT_TAGS } from "@/lib/stat-tags";

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
  votes: { voter: User; reason: string; tags?: string[]; createdAt: string }[];
  count: number;
}

interface MyVote {
  nomineeId: string;
  nomineeName: string | null;
  reason: string;
  tags?: string[];
}

interface Props {
  eventId: string;
  eventDate: string;
  pomVotingDeadline: string | null;
  pomVotesPerPerson: number;
  checkIns: CheckInEntry[];
  teamName?: string;
}

export default function PomVoting({ eventId, eventDate, pomVotingDeadline, pomVotesPerPerson, checkIns, teamName }: Props) {
  const { mutate: globalMutate } = useSWRConfig();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [results, setResults] = useState<PomResult[]>([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const [myVotes, setMyVotes] = useState<MyVote[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [selectionTags, setSelectionTags] = useState<Record<string, string[]>>({});
  const [showVoting, setShowVoting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [mounted, setMounted] = useState(false);

  const maxVotes = pomVotesPerPerson || 1;
  const votingStatus = getPomVotingStatus(eventDate, pomVotingDeadline);
  const isClosed = isPomVotingClosed(eventDate, pomVotingDeadline);
  const selectedCount = Object.keys(selections).length;
  const hasVoted = myVotes.length > 0;

  useEffect(() => {
    setMounted(true);
    fetchPomData();
  }, []);

  useEffect(() => {
    if (showResults && results.length > 0 && isClosed) {
      const confettiKey = `pom-confetti-${eventId}`;
      if (!localStorage.getItem(confettiKey)) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
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
        const votes: MyVote[] = data.myVotes || (data.myVote ? [data.myVote] : []);
        setMyVotes(votes);
        if (votes.length > 0) {
          const restored: Record<string, string> = {};
          const restoredTags: Record<string, string[]> = {};
          for (const v of votes) {
            restored[v.nomineeId] = v.reason;
            restoredTags[v.nomineeId] = v.tags || [];
          }
          setSelections(restored);
          setSelectionTags(restoredTags);
        }
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

  const toggleSelection = (userId: string) => {
    setSelections((prev) => {
      const next = { ...prev };
      if (next[userId] !== undefined) {
        delete next[userId];
        setSelectionTags((t) => { const nt = { ...t }; delete nt[userId]; return nt; });
      } else {
        if (Object.keys(next).length >= maxVotes) return prev;
        next[userId] = "";
      }
      return next;
    });
  };

  const updateReason = (userId: string, reason: string) => {
    setSelections((prev) => ({ ...prev, [userId]: reason }));
  };

  const toggleTag = (userId: string, tag: string) => {
    setSelectionTags((prev) => {
      const current = prev[userId] || [];
      return {
        ...prev,
        [userId]: current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
      };
    });
  };

  const canSubmit = () => {
    if (selectedCount === 0) return false;
    if (!Object.values(selections).every((reason) => reason.trim().length > 0)) return false;
    return Object.keys(selections).every((id) => (selectionTags[id] || []).length > 0);
  };

  const handleSubmit = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    try {
      const nominees = Object.entries(selections).map(([nomineeId, reason]) => ({
        nomineeId,
        reason: reason.trim(),
        tags: selectionTags[nomineeId] || [],
      }));
      const res = await fetch(`/api/training-events/${eventId}/pom`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nominees }),
      });
      if (res.ok) {
        const data = await res.json();
        setMyVotes(data.votes || []);
        setShowVoting(false);
        fetchPomData();
        globalMutate("/api/training-logs?limit=20"); // 피드 MVP 트로피 갱신
        globalMutate("/api/pom/recent-mvp"); // 피드 MVP 배너 갱신
      } else {
        const data = await res.json();
        alert(data.error || "투표에 실패했습니다");
      }
    } catch {
      alert("투표에 실패했습니다");
    } finally {
      setSubmitting(false);
    }
  };

  const openVoting = () => {
    if (!hasVoted) {
      setSelections({});
      setSelectionTags({});
    }
    setShowVoting(true);
  };

  const openRevote = () => {
    const restored: Record<string, string> = {};
    const restoredTags: Record<string, string[]> = {};
    for (const v of myVotes) {
      restored[v.nomineeId] = v.reason;
      restoredTags[v.nomineeId] = v.tags || [];
    }
    setSelections(restored);
    setSelectionTags(restoredTags);
    setMyVotes([]);
    setShowVoting(true);
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

  // 마감 후 - 투표 안 했고 결과가 있는 경우
  if (isClosed && !hasVoted && totalVotes > 0) {
    return (
      <>
        <ClosedResultsInline results={results} onShowDetails={() => setShowResults(true)} />
        {mounted && showResults && results.length > 0 && createPortal(
          <ResultsSheet results={results} eventDate={eventDate} teamName={teamName} onClose={() => setShowResults(false)} />,
          document.getElementById("modal-root")!
        )}
      </>
    );
  }

  // 마감되었는데 아무도 투표 안 한 경우
  if (isClosed && !hasVoted && totalVotes === 0) {
    return (
      <div className="bg-white rounded-xl p-6 text-center space-y-3">
        <div className="text-4xl">🏆</div>
        <h3 className="text-sm font-semibold text-gray-900">오늘의 MVP 투표</h3>
        <p className="text-sm text-gray-500">투표가 마감되었습니다</p>
        <p className="text-xs text-gray-400">아직 투표한 인원이 없습니다</p>
      </div>
    );
  }

  return (
    <>
      {/* 카드 요약 */}
      <div className="bg-white rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏆</span>
            <h3 className="text-sm font-semibold text-gray-900">오늘의 MVP 투표</h3>
          </div>
          <p className="text-xs text-gray-400">{votingStatus.message}</p>
        </div>

        {hasVoted ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-team-700">투표 응답 완료</p>
            <div className="space-y-2">
              {myVotes.map((v) => {
                const nominee = checkIns.find((c) => c.userId === v.nomineeId);
                return (
                  <div key={v.nomineeId} className="bg-team-50/60 rounded-xl px-3.5 py-2.5">
                    <div className="flex items-center gap-2 mb-1">
                      {nominee?.user.image ? (
                        <Image
                          src={nominee.user.image}
                          alt=""
                          width={24}
                          height={24}
                          className="w-6 h-6 rounded-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-team-200 flex items-center justify-center">
                          <span className="text-[10px] font-semibold text-team-600">
                            {(v.nomineeName || "?")[0]}
                          </span>
                        </div>
                      )}
                      <span className="text-sm font-semibold text-gray-900">
                        {v.nomineeName}
                      </span>
                    </div>
                    {v.tags && v.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pl-8 mb-1">
                        {v.tags.map((tag) => (
                          <span key={tag} className="px-2 py-0.5 bg-team-100 text-team-600 rounded-full text-[10px] font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-[13px] text-gray-600 pl-8">
                      &ldquo;{v.reason}&rdquo;
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2">
              {!isClosed && (
                <button
                  onClick={openRevote}
                  className="flex-1 py-2 bg-white border border-team-300 text-team-600 rounded-lg text-sm font-medium hover:bg-team-50 transition-colors"
                >
                  다시 투표하기
                </button>
              )}
              {isClosed && totalVotes > 0 && (
                <button
                  onClick={() => setShowResults(true)}
                  className="flex-1 py-2 bg-team-500 text-white rounded-lg text-sm font-medium"
                >
                  결과 보기 ({totalVotes}표)
                </button>
              )}
            </div>
          </div>
        ) : (
          <button
            onClick={openVoting}
            className="w-full py-3 bg-team-500 text-white rounded-[14px] font-semibold text-sm"
          >
            투표하기
          </button>
        )}
      </div>

      {/* 투표 바텀시트 */}
      {mounted && showVoting && createPortal(
        <VotingSheet
          checkIns={checkIns}
          maxVotes={maxVotes}
          selections={selections}
          selectionTags={selectionTags}
          selectedCount={selectedCount}
          submitting={submitting}
          votingMessage={votingStatus.message}
          onToggle={toggleSelection}
          onUpdateReason={updateReason}
          onToggleTag={toggleTag}
          onSubmit={handleSubmit}
          onClose={() => setShowVoting(false)}
          canSubmit={canSubmit()}
        />,
        document.getElementById("modal-root")!
      )}

      {/* 결과 바텀시트 */}
      {mounted && showResults && results.length > 0 && isClosed && createPortal(
        <ResultsSheet results={results} eventDate={eventDate} teamName={teamName} onClose={() => setShowResults(false)} />,
        document.getElementById("modal-root")!
      )}
    </>
  );
}

/* ─── 투표 바텀시트 ─── */
function VotingSheet({
  checkIns, maxVotes, selections, selectionTags, selectedCount, submitting, votingMessage,
  onToggle, onUpdateReason, onToggleTag, onSubmit, onClose, canSubmit,
}: {
  checkIns: CheckInEntry[];
  maxVotes: number;
  selections: Record<string, string>;
  selectionTags: Record<string, string[]>;
  selectedCount: number;
  submitting: boolean;
  votingMessage: string;
  onToggle: (id: string) => void;
  onUpdateReason: (id: string, reason: string) => void;
  onToggleTag: (id: string, tag: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  canSubmit: boolean;
}) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-50" />
      <div className="fixed bottom-0 left-0 right-0 z-51 animate-slide-up">
        <div className="bg-white rounded-t-[20px] max-w-lg mx-auto px-5 pt-3 pb-6 max-h-[85vh] flex flex-col">
          {/* 핸들바 */}
          <div className="flex justify-center mb-4">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* 헤더 */}
          <div className="text-center mb-4 space-y-2">
            <h3 className="text-lg font-bold text-gray-900">오늘의 MVP 투표</h3>
            <p className="text-xs text-gray-400">오늘 함께한 선수 중 최고의 플레이어를 뽑아주세요</p>
            {maxVotes > 1 && (
              <span className="inline-block px-2.5 py-1 bg-team-50 text-team-600 text-[11px] font-semibold rounded-full">
                최대 {maxVotes}명 선택 가능
              </span>
            )}
          </div>

          {/* 선수 목록 (스크롤) */}
          <div className="flex-1 overflow-y-auto space-y-2 mb-4">
            {checkIns.map((checkIn) => {
              const isSelected = selections[checkIn.userId] !== undefined;
              const isDisabled = !isSelected && selectedCount >= maxVotes;

              return (
                <div key={checkIn.userId} className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => onToggle(checkIn.userId)}
                    disabled={isDisabled}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      isSelected
                        ? "bg-team-50 border-2 border-team-400"
                        : isDisabled
                          ? "border border-gray-100 opacity-40"
                          : "border border-gray-200"
                    }`}
                  >
                    <div className={`w-[22px] h-[22px] rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      isSelected ? "bg-team-500 border-team-500" : "border-gray-300"
                    }`}>
                      {isSelected && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    {checkIn.user.image ? (
                      <Image
                        src={checkIn.user.image}
                        alt={checkIn.user.name || ""}
                        width={36}
                        height={36}
                        className="w-9 h-9 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center">
                        <span className="text-xs text-gray-500">{(checkIn.user.name || "?")[0]}</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-semibold text-gray-900">{checkIn.user.name || "익명"}</span>
                      {(checkIn.user.position || checkIn.user.number) && (
                        <span className="text-xs text-gray-500 ml-1.5">
                          {checkIn.user.position || ""}{checkIn.user.number ? ` · ${checkIn.user.number}번` : ""}
                        </span>
                      )}
                    </div>
                  </button>

                  {isSelected && (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {STAT_TAGS.map((tag) => {
                          const active = (selectionTags[checkIn.userId] || []).includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => onToggleTag(checkIn.userId, tag)}
                              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                                active
                                  ? "bg-team-500 text-white"
                                  : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                      <textarea
                        value={selections[checkIn.userId]}
                        onChange={(e) => onUpdateReason(checkIn.userId, e.target.value)}
                        placeholder="어떤 플레이가 좋았나요?"
                        rows={2}
                        className="w-full px-3 py-2 border border-team-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:border-team-400 focus:outline-none bg-white"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 투표 버튼 */}
          <button
            onClick={onSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-3.5 bg-team-500 text-white rounded-[14px] font-semibold text-[15px] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? "투표 중..." : `투표하기${selectedCount > 0 ? ` (${selectedCount}명)` : ""}`}
          </button>
          <p className="text-[11px] text-gray-400 text-center mt-2">{votingMessage}</p>
        </div>
      </div>
    </>
  );
}

/* ─── 결과 바텀시트 ─── */
function ResultsSheet({ results, eventDate, teamName, onClose }: {
  results: PomResult[];
  eventDate: string;
  teamName?: string;
  onClose: () => void;
}) {
  const winner = results[0];
  const shareCardRef = useRef<HTMLDivElement>(null);
  const [sharing, setSharing] = useState(false);

  const formattedDate = (() => {
    try {
      const d = new Date(eventDate);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    } catch { return eventDate; }
  })();

  // CSS 변수에서 팀 컬러 읽기
  const getTeamColor = (shade: string) => {
    if (typeof window === "undefined") return "";
    return getComputedStyle(document.documentElement).getPropertyValue(`--color-team-${shade}`).trim();
  };

  // 카드를 PNG로 캡처
  const captureCard = useCallback(async () => {
    if (!shareCardRef.current) return null;
    const dataUrl = await toPng(shareCardRef.current, { pixelRatio: 2, cacheBust: true });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return { dataUrl, blob };
  }, []);

  // 공유 (Web Share API → 인스타 스토리 포함 시스템 공유시트)
  const handleShare = useCallback(async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const result = await captureCard();
      if (!result) return;
      const file = new File([result.blob], `mvp-${formattedDate}.png`, { type: "image/png" });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "오늘의 MVP" });
      } else {
        // 데스크톱 fallback: 다운로드
        const link = document.createElement("a");
        link.href = result.dataUrl;
        link.download = `mvp-${formattedDate}.png`;
        link.click();
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") console.error("공유 실패:", err);
    } finally {
      setSharing(false);
    }
  }, [formattedDate, sharing, captureCard]);


  if (!winner) return null;

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-50" />
      <div className="fixed bottom-0 left-0 right-0 z-51 animate-slide-up">
        <div className="bg-white rounded-t-[20px] max-w-lg mx-auto px-5 pt-3 pb-7 max-h-[85vh] overflow-y-auto">
          {/* 핸들바 */}
          <div className="flex justify-center mb-5">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {/* 트로피 + 타이틀 */}
          <div className="text-center mb-4">
            <div className="text-5xl mb-2">🏆</div>
            <h3 className="text-xl font-extrabold text-gray-900">오늘의 MVP</h3>
          </div>

          {/* 우승자 카드 */}
          <div className="bg-gradient-to-b from-team-50 to-team-100 rounded-2xl p-5 mb-5">
            <div className="flex flex-col items-center gap-3">
              {winner.user.image ? (
                <Image
                  src={winner.user.image}
                  alt={winner.user.name || ""}
                  width={64}
                  height={64}
                  className="w-16 h-16 rounded-full object-cover"
                  unoptimized
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-team-200 flex items-center justify-center">
                  <span className="text-2xl text-team-600">{(winner.user.name || "?")[0]}</span>
                </div>
              )}
              <div className="text-center">
                <p className="text-lg font-bold text-gray-900">{winner.user.name || "익명"}</p>
                {(winner.user.position || winner.user.number) && (
                  <p className="text-xs text-gray-500">
                    {winner.user.position || ""}{winner.user.number ? ` · ${winner.user.number}번` : ""}
                  </p>
                )}
              </div>
              <span className="px-3.5 py-1.5 bg-team-500 text-white text-[13px] font-bold rounded-full">
                {winner.count}표 획득
              </span>
            </div>

            {/* 팀원 코멘트 - 가로 스크롤 */}
            {winner.votes.length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-semibold text-gray-500 mb-2">팀원 코멘트</p>
                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
                  {winner.votes.map((vote, idx) => (
                    <div key={idx} className="bg-white rounded-lg px-3 py-2.5 min-w-[160px] max-w-[200px] shrink-0 snap-start">
                      <p className="text-xs font-semibold text-gray-700 mb-1">{vote.voter.name || "익명"}</p>
                      {vote.tags && vote.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {vote.tags.map((tag) => (
                            <span key={tag} className="px-1.5 py-0.5 bg-team-50 text-team-600 rounded text-[10px] font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-gray-600 leading-relaxed">&ldquo;{vote.reason}&rdquo;</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 전체 순위 */}
          {results.length > 1 && (
            <div className="mb-5 space-y-2">
              <p className="text-[13px] font-bold text-gray-700">전체 순위</p>
              {results.slice(1).map((result, idx) => (
                <div key={idx} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-gray-50 rounded-xl">
                  <span className="text-sm font-bold text-gray-400 w-5 text-center">{idx + 2}</span>
                  {result.user.image ? (
                    <Image
                      src={result.user.image}
                      alt={result.user.name || ""}
                      width={28}
                      height={28}
                      className="w-7 h-7 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-[10px] text-gray-500">{(result.user.name || "?")[0]}</span>
                    </div>
                  )}
                  <span className="text-[13px] font-semibold text-gray-700 flex-1">{result.user.name || "익명"}</span>
                  <span className="text-xs text-gray-500">{result.count}표</span>
                </div>
              ))}
            </div>
          )}

          {/* 공유/닫기 */}
          <div className="space-y-2">
            <button
              onClick={handleShare}
              disabled={sharing}
              className="w-full py-3 bg-team-500 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60"
            >
              {sharing ? "준비 중..." : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                    <polyline points="16 6 12 2 8 6" />
                    <line x1="12" y1="2" x2="12" y2="15" />
                  </svg>
                  이미지로 공유하기
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="w-full py-2.5 text-gray-500 text-sm font-medium"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {/* ─── 공유용 MVP 카드 (화면 밖 렌더링) ─── */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <div
          ref={shareCardRef}
          style={{
            width: 360,
            height: 480,
            background: getTeamColor("600") || "#6B5A44",
            fontFamily: "'Pretendard', -apple-system, sans-serif",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* 배경 그라디언트 오버레이 */}
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 50% 0%, ${getTeamColor("400") || "#A8956F"}44 0%, transparent 60%),
                          radial-gradient(ellipse at 80% 100%, ${getTeamColor("500") || "#977C5E"}33 0%, transparent 50%)`,
          }} />

          {/* 상단 장식 라인 */}
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 3,
            background: `linear-gradient(90deg, transparent, ${getTeamColor("300") || "#C6B9A9"}, transparent)`,
          }} />

          {/* 콘텐츠 영역 */}
          <div style={{
            position: "relative", zIndex: 1,
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "36px 28px 24px",
            height: "100%",
          }}>
            {/* 타이틀 영역 */}
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 24,
            }}>
              <div style={{
                width: 1, height: 16,
                background: getTeamColor("300") || "#C6B9A9",
              }} />
              <span style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 3,
                color: getTeamColor("200") || "#DED7CE",
                textTransform: "uppercase" as const,
              }}>
                오늘의 MVP
              </span>
              <div style={{
                width: 1, height: 16,
                background: getTeamColor("300") || "#C6B9A9",
              }} />
            </div>

            {/* 트로피 */}
            <div style={{ fontSize: 48, marginBottom: 16, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>🏆</div>

            {/* 프로필 사진 - 링 장식 */}
            <div style={{
              position: "relative",
              width: 100, height: 100,
              marginBottom: 16,
            }}>
              {/* 외곽 링 */}
              <div style={{
                position: "absolute", inset: -4,
                borderRadius: "50%",
                border: `2px solid ${getTeamColor("300") || "#C6B9A9"}`,
                opacity: 0.5,
              }} />
              {winner.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={winner.user.image}
                  alt=""
                  crossOrigin="anonymous"
                  style={{
                    width: 100, height: 100, borderRadius: "50%",
                    objectFit: "cover",
                    border: `3px solid ${getTeamColor("200") || "#DED7CE"}`,
                    boxShadow: `0 8px 24px rgba(0,0,0,0.3)`,
                  }}
                />
              ) : (
                <div style={{
                  width: 100, height: 100, borderRadius: "50%",
                  background: getTeamColor("500") || "#977C5E",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: `3px solid ${getTeamColor("200") || "#DED7CE"}`,
                  boxShadow: `0 8px 24px rgba(0,0,0,0.3)`,
                }}>
                  <span style={{ fontSize: 36, color: "white", fontWeight: 700 }}>
                    {(winner.user.name || "?")[0]}
                  </span>
                </div>
              )}
            </div>

            {/* 이름 */}
            <p style={{
              fontSize: 22, fontWeight: 800, color: "white",
              textShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}>{winner.user.name || "익명"}</p>
            {(winner.user.position || winner.user.number) && (
              <p style={{
                fontSize: 12, color: getTeamColor("200") || "#DED7CE",
                marginTop: 4, fontWeight: 500,
              }}>
                {winner.user.position || ""}{winner.user.number ? ` · ${winner.user.number}번` : ""}
              </p>
            )}

            {/* 득표 배지 */}
            <div style={{
              marginTop: 12, padding: "6px 20px",
              background: `linear-gradient(135deg, ${getTeamColor("300") || "#C6B9A9"}, ${getTeamColor("200") || "#DED7CE"})`,
              color: getTeamColor("700") || "#564732",
              borderRadius: 20,
              fontSize: 13, fontWeight: 800,
              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}>
              {winner.count}표 획득
            </div>

            {/* 팀원 코멘트 (최대 2개) */}
            {winner.votes.length > 0 && (
              <div style={{
                marginTop: 20, width: "100%",
                display: "flex", flexDirection: "column", gap: 6,
              }}>
                {winner.votes.slice(0, 2).map((vote, idx) => (
                  <div key={idx} style={{
                    background: `${getTeamColor("500") || "#977C5E"}88`,
                    backdropFilter: "blur(8px)",
                    borderRadius: 12, padding: "10px 14px",
                    textAlign: "center",
                    border: `1px solid ${getTeamColor("400") || "#A8956F"}44`,
                  }}>
                    <p style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", lineHeight: 1.5 }}>
                      &ldquo;{vote.reason}&rdquo;
                    </p>
                    <p style={{ fontSize: 10, color: getTeamColor("200") || "#DED7CE", marginTop: 3, fontWeight: 600 }}>
                      — {vote.voter.name || "익명"}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* 하단 팀명 + 날짜 */}
            <div style={{
              marginTop: "auto", paddingTop: 16,
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <div style={{
                width: 20, height: 1,
                background: getTeamColor("400") || "#A8956F",
                opacity: 0.5,
              }} />
              <span style={{ fontSize: 11, color: getTeamColor("300") || "#C6B9A9", fontWeight: 600 }}>
                {teamName || "네모의 꿈"}
              </span>
              <span style={{ fontSize: 11, color: getTeamColor("400") || "#A8956F" }}>·</span>
              <span style={{ fontSize: 11, color: getTeamColor("300") || "#C6B9A9" }}>{formattedDate}</span>
              <div style={{
                width: 20, height: 1,
                background: getTeamColor("400") || "#A8956F",
                opacity: 0.5,
              }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── 마감 후 인라인 결과 (투표 안 한 사용자용) ─── */
function ClosedResultsInline({ results, onShowDetails }: { results: PomResult[]; onShowDetails: () => void }) {
  const winner = results[0];
  if (!winner) return null;

  return (
    <div className="bg-white rounded-xl p-5">
      <button onClick={onShowDetails} className="w-full text-center space-y-3">
        <div className="text-4xl">🏆</div>
        <h3 className="text-base font-bold text-gray-900">오늘의 MVP</h3>
        <div className="flex flex-col items-center gap-2">
          {winner.user.image ? (
            <Image
              src={winner.user.image}
              alt={winner.user.name || ""}
              width={56}
              height={56}
              className="w-14 h-14 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-14 h-14 rounded-full bg-team-100 flex items-center justify-center">
              <span className="text-xl text-team-600">{(winner.user.name || "?")[0]}</span>
            </div>
          )}
          <p className="text-base font-semibold text-gray-900">{winner.user.name || "익명"}</p>
          <span className="text-xs font-medium text-team-600">{winner.count}표 획득</span>
        </div>
        <p className="text-xs text-team-500 font-medium pt-2">자세히 보기 &rsaquo;</p>
      </button>
    </div>
  );
}
