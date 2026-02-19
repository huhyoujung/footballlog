"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Loader2 } from "lucide-react";

interface MvpUser {
  id: string;
  name: string | null;
  image: string | null;
  position?: string | null;
  number?: number | null;
}

interface MvpResult {
  user: MvpUser;
  votes: { voter: { id: string; name: string | null }; reason: string }[];
  count: number;
}

interface Props {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function MvpResultSheet({ eventId, isOpen, onClose }: Props) {
  const [results, setResults] = useState<MvpResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !eventId) return;

    setLoading(true);
    setError(null);

    const controller = new AbortController();
    fetch(`/api/training-events/${eventId}/pom`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error("결과를 불러올 수 없습니다");
        return res.json();
      })
      .then((data) => {
        setResults(data.results || []);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, eventId]);

  // 모달 열릴 때 배경 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return;

    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.body.style.overflow = "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const winner = results[0];

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-50" />
      <div className="fixed bottom-0 left-0 right-0 z-51 animate-slide-up">
        <div className="bg-white rounded-t-[20px] max-w-lg mx-auto px-5 pt-3 pb-[calc(1.75rem+env(safe-area-inset-bottom))] max-h-[70vh] overflow-y-auto overscroll-contain">
          {/* 핸들바 */}
          <div className="flex justify-center mb-5">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-10 h-10 text-team-500 animate-spin mb-3" />
              <p className="text-sm text-gray-500">MVP 결과 불러오는 중...</p>
            </div>
          )}

          {error && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">{error}</p>
            </div>
          )}

          {!loading && !error && !winner && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">아직 투표 결과가 없습니다</p>
            </div>
          )}

          {!loading && winner && (
            <>
              {/* 트로피 + 타이틀 */}
              <div className="text-center mb-4">
                <div className="text-5xl mb-2">🏆</div>
                <h3 className="text-lg font-semibold text-gray-900">오늘의 MVP</h3>
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
                    <p className="text-base font-semibold text-gray-900">{winner.user.name || "익명"}</p>
                    {(winner.user.position || winner.user.number) && (
                      <p className="text-xs text-gray-500">
                        {winner.user.position || ""}{winner.user.number ? ` · ${winner.user.number}번` : ""}
                      </p>
                    )}
                  </div>
                  <span className="px-3.5 py-1.5 bg-team-500 text-white text-[13px] font-semibold rounded-full">
                    {winner.count}표 획득
                  </span>
                </div>

                {/* 팀원 코멘트 */}
                {winner.votes.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold text-gray-500 mb-2">팀원 코멘트</p>
                    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
                      {winner.votes.map((vote, idx) => (
                        <div key={idx} className="bg-white rounded-lg px-3 py-2.5 min-w-[160px] max-w-[200px] shrink-0 snap-start">
                          <p className="text-xs font-semibold text-gray-700 mb-1">{vote.voter.name || "익명"}</p>
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
                  <p className="text-[13px] font-semibold text-gray-700">전체 순위</p>
                  {results.slice(1).map((result, idx) => (
                    <div key={idx} className="flex items-center gap-2.5 px-3.5 py-2.5 bg-gray-50 rounded-xl">
                      <span className="text-sm font-semibold text-gray-400 w-5 text-center">{idx + 2}</span>
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

              {/* 닫기 */}
              <button
                onClick={onClose}
                className="w-full py-2.5 text-gray-500 text-sm font-medium"
              >
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </>,
    document.body
  );
}
