"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { toPng } from "html-to-image";

interface MvpUser {
  id: string;
  name: string | null;
  image: string | null;
  position?: string | null;
  number?: number | null;
}

interface MvpResult {
  user: MvpUser;
  votes: { voter: { id: string; name: string | null }; reason: string; tags?: string[] }[];
  count: number;
}

interface RankedResult extends MvpResult {
  rank: number;
}

interface Props {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}

function computeRanks(results: MvpResult[]): RankedResult[] {
  return results.reduce<RankedResult[]>((acc, r, i) => {
    const rank = i === 0 ? 1 : r.count === acc[i - 1].count ? acc[i - 1].rank : i + 1;
    acc.push({ ...r, rank });
    return acc;
  }, []);
}

export default function MvpResultSheet({ eventId, isOpen, onClose }: Props) {
  const [rankedResults, setRankedResults] = useState<RankedResult[]>([]);
  const [eventDate, setEventDate] = useState("");
  const [teamName, setTeamName] = useState("네모의 꿈");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

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
        setRankedResults(computeRanks(data.results || []));
        setEventDate(data.eventDate || "");
        setTeamName(data.teamName || "네모의 꿈");
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [isOpen, eventId]);

  // 배경 스크롤 잠금 (iOS Safari 포함)
  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    document.documentElement.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, [isOpen]);

  const formattedDate = (() => {
    try {
      const d = new Date(eventDate);
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return "";
    }
  })();

  // 공유 카드용: /_next/image 프록시를 통해 same-origin으로 로드 → CORS 캐시 오염 방지
  const getProxiedImageUrl = (src: string, size: number) =>
    `/_next/image?url=${encodeURIComponent(src)}&w=${size}&q=75`;

  const getTeamColor = (shade: string) => {
    if (typeof window === "undefined") return "";
    return getComputedStyle(document.documentElement)
      .getPropertyValue(`--color-team-${shade}`)
      .trim();
  };

  const captureCard = useCallback(async () => {
    if (!shareCardRef.current) return null;
    const dataUrl = await toPng(shareCardRef.current, { pixelRatio: 2, cacheBust: true });
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return { dataUrl, blob };
  }, []);

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

  if (!isOpen) return null;

  const rank1Results = rankedResults.filter((r) => r.rank === 1);
  const rank2PlusResults = rankedResults.filter((r) => r.rank > 1);
  const isSharedFirst = rank1Results.length > 1;

  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-50" />
      <div className="fixed bottom-0 left-0 right-0 z-51 animate-slide-up">
        <div className="bg-white rounded-t-[20px] max-w-lg mx-auto px-5 pt-3 pb-[calc(1.75rem+env(safe-area-inset-bottom))] max-h-[85vh] overflow-y-auto overscroll-contain">
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

          {!loading && !error && rankedResults.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-gray-500">아직 투표 결과가 없습니다</p>
            </div>
          )}

          {!loading && !error && rankedResults.length > 0 && (
            <>
              {/* 트로피 + 타이틀 */}
              <div className="text-center mb-4">
                <div className="text-5xl mb-2">🏆</div>
                <h3 className="text-xl font-extrabold text-gray-900">
                  {isSharedFirst ? "공동 1위" : "오늘의 MVP"}
                </h3>
              </div>

              {/* 1위 카드(들) */}
              <div className={`mb-5 ${isSharedFirst ? "space-y-3" : ""}`}>
                {rank1Results.map((result, idx) => (
                  <div
                    key={idx}
                    className="bg-gradient-to-b from-team-50 to-team-100 rounded-2xl p-5"
                  >
                    <div className="flex flex-col items-center gap-3">
                      {result.user.image ? (
                        <Image
                          src={result.user.image}
                          alt={result.user.name || ""}
                          width={64}
                          height={64}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-team-200 flex items-center justify-center">
                          <span className="text-2xl text-team-600">
                            {(result.user.name || "?")[0]}
                          </span>
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-lg font-bold text-gray-900">
                          {result.user.name || "익명"}
                        </p>
                        {(result.user.position || result.user.number) && (
                          <p className="text-xs text-gray-500">
                            {result.user.position || ""}
                            {result.user.number ? ` · ${result.user.number}번` : ""}
                          </p>
                        )}
                      </div>
                      <span className="px-3.5 py-1.5 bg-team-500 text-white text-[13px] font-bold rounded-full">
                        {result.count}표 획득
                      </span>
                    </div>

                    {result.votes.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold text-gray-500 mb-2">팀원 코멘트</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory scrollbar-hide">
                          {result.votes.map((vote, vIdx) => (
                            <div
                              key={vIdx}
                              className="bg-white rounded-lg px-3 py-2.5 min-w-[160px] max-w-[200px] shrink-0 snap-start"
                            >
                              <p className="text-xs font-semibold text-gray-700 mb-1">
                                {vote.voter.name || "익명"}
                              </p>
                              {vote.tags && vote.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-1">
                                  {vote.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="px-1.5 py-0.5 bg-team-50 text-team-600 rounded text-[10px] font-medium"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <p className="text-xs text-gray-600 leading-relaxed">
                                &ldquo;{vote.reason}&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 2위 이하 */}
              {rank2PlusResults.length > 0 && (
                <div className="mb-5 space-y-3">
                  <p className="text-[13px] font-bold text-gray-700">전체 순위</p>
                  {rank2PlusResults.map((result, idx) => (
                    <div key={idx} className="bg-gray-50 rounded-xl px-3.5 py-3">
                      <div className="flex items-center gap-2.5 mb-2">
                        <span className="text-sm font-bold text-gray-400 w-5 text-center">
                          {result.rank}
                        </span>
                        {result.user.image ? (
                          <Image
                            src={result.user.image}
                            alt={result.user.name || ""}
                            width={32}
                            height={32}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <span className="text-xs text-gray-500">
                              {(result.user.name || "?")[0]}
                            </span>
                          </div>
                        )}
                        <span className="text-[13px] font-semibold text-gray-700 flex-1">
                          {result.user.name || "익명"}
                        </span>
                        <span className="text-xs text-gray-500">{result.count}표</span>
                      </div>

                      {result.votes.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto pb-1 pl-7 snap-x snap-mandatory scrollbar-hide">
                          {result.votes.map((vote, vIdx) => (
                            <div
                              key={vIdx}
                              className="bg-white rounded-lg px-3 py-2 min-w-[150px] max-w-[190px] shrink-0 snap-start"
                            >
                              <p className="text-[11px] font-semibold text-gray-600 mb-0.5">
                                {vote.voter.name || "익명"}
                              </p>
                              {vote.tags && vote.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-0.5">
                                  {vote.tags.map((tag) => (
                                    <span
                                      key={tag}
                                      className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px]"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <p className="text-[11px] text-gray-500 leading-relaxed">
                                &ldquo;{vote.reason}&rdquo;
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
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
                  {sharing ? (
                    "준비 중..."
                  ) : (
                    <>
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
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
            </>
          )}
        </div>
      </div>

      {/* ─── 공유용 카드 (화면 밖 렌더링) ─── */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <div
          ref={shareCardRef}
          style={{
            width: 360,
            background: getTeamColor("600") || "#6B5A44",
            fontFamily: "'Pretendard', -apple-system, sans-serif",
            display: "flex",
            flexDirection: "column",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* 배경 그라디언트 */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: `radial-gradient(ellipse at 50% 0%, ${getTeamColor("400") || "#A8956F"}44 0%, transparent 60%)`,
            }}
          />
          {/* 상단 라인 */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${getTeamColor("300") || "#C6B9A9"}, transparent)`,
            }}
          />

          <div
            style={{
              position: "relative",
              zIndex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "32px 24px 24px",
              gap: 0,
            }}
          >
            {/* 타이틀 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 20,
              }}
            >
              <div style={{ width: 1, height: 14, background: getTeamColor("300") || "#C6B9A9" }} />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 3,
                  color: getTeamColor("200") || "#DED7CE",
                  textTransform: "uppercase" as const,
                }}
              >
                {isSharedFirst ? "공동 MVP" : "오늘의 MVP"}
              </span>
              <div style={{ width: 1, height: 14, background: getTeamColor("300") || "#C6B9A9" }} />
            </div>

            {/* 트로피 */}
            <div style={{ fontSize: 44, marginBottom: 16, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.3))" }}>
              🏆
            </div>

            {/* 1위 선수(들) */}
            <div
              style={{
                display: "flex",
                flexDirection: isSharedFirst ? "row" : "column",
                alignItems: "center",
                justifyContent: "center",
                gap: isSharedFirst ? 16 : 0,
                width: "100%",
                marginBottom: 16,
              }}
            >
              {rank1Results.map((result, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                    flex: isSharedFirst ? 1 : undefined,
                  }}
                >
                  <div style={{ position: "relative", width: isSharedFirst ? 72 : 96, height: isSharedFirst ? 72 : 96 }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: -3,
                        borderRadius: "50%",
                        border: `2px solid ${getTeamColor("300") || "#C6B9A9"}`,
                        opacity: 0.5,
                      }}
                    />
                    {result.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getProxiedImageUrl(result.user.image, isSharedFirst ? 144 : 192)}
                        alt=""
                        style={{
                          width: isSharedFirst ? 72 : 96,
                          height: isSharedFirst ? 72 : 96,
                          borderRadius: "50%",
                          objectFit: "cover" as const,
                          border: `2px solid ${getTeamColor("200") || "#DED7CE"}`,
                          boxShadow: "0 6px 20px rgba(0,0,0,0.3)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: isSharedFirst ? 72 : 96,
                          height: isSharedFirst ? 72 : 96,
                          borderRadius: "50%",
                          background: getTeamColor("500") || "#977C5E",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: `2px solid ${getTeamColor("200") || "#DED7CE"}`,
                        }}
                      >
                        <span style={{ fontSize: isSharedFirst ? 28 : 36, color: "white", fontWeight: 700 }}>
                          {(result.user.name || "?")[0]}
                        </span>
                      </div>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: isSharedFirst ? 16 : 22,
                      fontWeight: 800,
                      color: "white",
                      textShadow: "0 2px 8px rgba(0,0,0,0.3)",
                      textAlign: "center",
                    }}
                  >
                    {result.user.name || "익명"}
                  </p>
                  <div
                    style={{
                      padding: "4px 14px",
                      background: `linear-gradient(135deg, ${getTeamColor("300") || "#C6B9A9"}, ${getTeamColor("200") || "#DED7CE"})`,
                      color: getTeamColor("700") || "#564732",
                      borderRadius: 20,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    {result.count}표
                  </div>
                </div>
              ))}
            </div>

            {/* 1위 추천사 */}
            {rank1Results.map((result, rIdx) => {
              const maxComments = isSharedFirst ? 1 : 2;
              if (result.votes.length === 0) return null;
              return (
                <div
                  key={rIdx}
                  style={{
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    marginBottom: 10,
                  }}
                >
                  {isSharedFirst && (
                    <p
                      style={{
                        fontSize: 10,
                        color: getTeamColor("300") || "#C6B9A9",
                        fontWeight: 600,
                        textAlign: "center",
                        marginBottom: 2,
                      }}
                    >
                      {result.user.name}
                    </p>
                  )}
                  {result.votes.slice(0, maxComments).map((vote, vIdx) => (
                    <div
                      key={vIdx}
                      style={{
                        background: `${getTeamColor("500") || "#977C5E"}88`,
                        borderRadius: 10,
                        padding: "8px 12px",
                        textAlign: "center",
                        border: `1px solid ${getTeamColor("400") || "#A8956F"}44`,
                      }}
                    >
                      <p style={{ fontSize: 11, color: "rgba(255,255,255,0.9)", lineHeight: 1.5 }}>
                        &ldquo;{vote.reason}&rdquo;
                      </p>
                      <p
                        style={{
                          fontSize: 10,
                          color: getTeamColor("200") || "#DED7CE",
                          marginTop: 2,
                          fontWeight: 600,
                        }}
                      >
                        — {vote.voter.name || "익명"}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })}

            {/* 2위 이하 */}
            {rank2PlusResults.length > 0 && (
              <div
                style={{
                  width: "100%",
                  borderTop: `1px solid ${getTeamColor("500") || "#977C5E"}`,
                  paddingTop: 12,
                  marginTop: 6,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {rank2PlusResults.map((result, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      background: `${getTeamColor("700") || "#4A3D2E"}66`,
                      borderRadius: 10,
                      padding: "8px 12px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: getTeamColor("300") || "#C6B9A9",
                        width: 18,
                        flexShrink: 0,
                        paddingTop: 2,
                      }}
                    >
                      {result.rank}
                    </span>
                    {result.user.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={getProxiedImageUrl(result.user.image, 64)}
                        alt=""
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          objectFit: "cover" as const,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          background: getTeamColor("500") || "#977C5E",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <span style={{ fontSize: 13, color: "white", fontWeight: 700 }}>
                          {(result.user.name || "?")[0]}
                        </span>
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 4,
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 700, color: "white" }}>
                          {result.user.name || "익명"}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            color: getTeamColor("300") || "#C6B9A9",
                            fontWeight: 600,
                          }}
                        >
                          {result.count}표
                        </span>
                      </div>
                      {result.votes.length > 0 && (
                        <p
                          style={{
                            fontSize: 11,
                            color: "rgba(255,255,255,0.7)",
                            lineHeight: 1.4,
                          }}
                        >
                          &ldquo;{result.votes[0].reason}&rdquo;{" "}
                          <span style={{ color: getTeamColor("300") || "#C6B9A9", fontWeight: 600 }}>
                            — {result.votes[0].voter.name || "익명"}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 하단 팀명 + 날짜 */}
            <div
              style={{
                marginTop: 20,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ width: 20, height: 1, background: getTeamColor("400") || "#A8956F", opacity: 0.5 }} />
              <span style={{ fontSize: 11, color: getTeamColor("300") || "#C6B9A9", fontWeight: 600 }}>
                {teamName}
              </span>
              <span style={{ fontSize: 11, color: getTeamColor("400") || "#A8956F" }}>·</span>
              <span style={{ fontSize: 11, color: getTeamColor("300") || "#C6B9A9" }}>{formattedDate}</span>
              <div style={{ width: 20, height: 1, background: getTeamColor("400") || "#A8956F", opacity: 0.5 }} />
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
