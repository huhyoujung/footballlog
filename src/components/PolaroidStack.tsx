"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import PolaroidCard from "./PolaroidCard";
import PostItNote from "./PostItNote";
import type { TrainingLog } from "@/types/training";

const MvpResultSheet = dynamic(() => import("./MvpResultSheet"), { ssr: false });

interface LockerNote {
  id: string;
  content: string;
  color: string;
  rotation: number;
  positionX: number;
  positionY: number;
  tags: string[];
  createdAt: string;
  isAnonymous: boolean;
  recipient: {
    id: string;
    name: string | null;
  };
  author: {
    id: string;
    name: string | null;
  };
  trainingLog?: {
    trainingDate: string;
  } | null;
  trainingEvent?: {
    date: string;
  } | null;
}

interface Props {
  logs: TrainingLog[];
  date: string; // 실제 날짜 (YYYY-MM-DD) - seed로 사용
  displayDate: string;
  onClick: () => void;
  isExpanding?: boolean;
  notes?: LockerNote[];
  hideCount?: boolean; // 카운트 숨김 여부 (락커룸용)
  disableNoteOpen?: boolean; // 쪽지 클릭 비활성화 (피드용)
  currentUserId?: string; // From 표시용 (내가 쓴 쪽지만 표시)
  mvpEventId?: string; // 이 날짜에 MVP가 선출된 이벤트 ID (로그와 무관하게 트로피 표시)
}

// 날짜 문자열을 seed로 한 결정론적 난수 (같은 날짜 → 항상 같은 배치)
function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (n: number) => {
    hash = (hash * 16807 + 12345) | 0;
    return ((hash & 0x7fffffff) % 1000) / 1000 * n;
  };
}

function generateStackConfigs(date: string) {
  const rand = seededRandom(date);

  return [
    {
      top: 10 + rand(10),
      left: -12 + rand(8),
      rotation: -12 + rand(10),
      zIndex: 1,
    },
    {
      top: 3 + rand(8),
      left: 4 + rand(14),
      rotation: 2 + rand(10),
      zIndex: 2,
    },
    {
      top: rand(4),
      left: -2 + rand(6),
      rotation: -8 + rand(8),
      zIndex: 3,
    },
  ];
}

export default function PolaroidStack({ logs, date, displayDate, onClick, isExpanding, notes = [], hideCount = false, disableNoteOpen = false, currentUserId, mvpEventId }: Props) {
  const router = useRouter();
  const visibleLogs = logs.slice(0, 3);
  const configs = useMemo(() => generateStackConfigs(date), [date]);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [showMvpSheet, setShowMvpSheet] = useState(false);

  // 내가 보냈거나 받은 쪽지는 disableNoteOpen이어도 열 수 있음
  const canOpenNote = (note: LockerNote) => {
    if (!disableNoteOpen) return true;
    if (!currentUserId) return false;
    return note.author?.id === currentUserId || note.recipient?.id === currentUserId;
  };

  // MVP 트로피: 이벤트 날짜 기반 (로그와 무관)
  const hasMvp = !!mvpEventId;

  // 사진 1개일 때는 로그 ID 기반으로 고유한 회전 생성
  const getSingleCardRotation = (logId: string) => {
    const rand = seededRandom(logId);
    return -8 + rand(16); // -8도 ~ +8도 사이 랜덤
  };

  // 펼침 시 카드를 가로로 벌리는 위치 계산 (캐러셀 위치에 가깝게)
  const getExpandedOffset = (i: number, total: number) => {
    const spacing = 76;
    const center = ((total - 1) * spacing) / 2;
    return i * spacing - center;
  };

  // 흩뿌리기 위치 (날짜 seed → 같은 날짜 = 같은 배치, 좌우 교대)
  const scatterSlots = useMemo(() => {
    const rand = seededRandom(date + "-scatter");
    // 컨테이너 280px 기준, 폴라로이드 left=52 (w=176)
    // 좌우 바깥 + 아래쪽으로 확장, 최대 12슬롯
    // 폴라로이드 중앙 높이(y≈100)를 기준으로 좌우부터 채우고 위아래로 퍼지는 순서
    const bases = [
      { x: -8, y: 110 },   // 0: left-center  (폴라로이드 세로 중앙 옆)
      { x: 218, y: 100 },  // 1: right-center (대칭)
      { x: 98, y: 245 },   // 2: bottom-center
      { x: -5, y: 35 },    // 3: left-upper
      { x: 215, y: 18 },   // 4: right-upper
      { x: -5, y: 195 },   // 5: left-lower
      { x: 215, y: 172 },  // 6: right-lower
      { x: 40, y: 295 },   // 7: bottom-left
      { x: 168, y: 305 },  // 8: bottom-right
      { x: -8, y: 275 },   // 9: left-extra
      { x: 215, y: 248 },  // 10: right-extra
      { x: 98, y: 328 },   // 11: very-bottom
    ];
    return bases.map(base => ({
      x: base.x + Math.floor(rand(14)),
      y: base.y + Math.floor(rand(10)),
      rot: -18 + Math.floor(rand(36)),  // -18° ~ +18° 자유 회전
    }));
  }, [date]);

  // 폴라로이드 없을 때 전용 scatter 슬롯 — 컨테이너 중앙(x=108) 기준으로 흩뿌림
  // PostItNote 너비 64px → 중앙정렬 기준 x = (280-64)/2 = 108
  const noLogScatterSlots = useMemo(() => {
    const rand = seededRandom(date + "-nolog-scatter");
    const bases = [
      { x: 108, y: 10 },   // 0: 중앙-상단 (1개일 때 여기)
      { x: 58, y: 15 },    // 1: 좌상단
      { x: 158, y: 12 },   // 2: 우상단
      { x: 20, y: 95 },    // 3: 좌중단
      { x: 196, y: 88 },   // 4: 우중단
      { x: 108, y: 120 },  // 5: 중앙-중단
      { x: 58, y: 190 },   // 6: 좌하단
      { x: 158, y: 183 },  // 7: 우하단
      { x: 108, y: 265 },  // 8: 중앙-하단
      { x: 20, y: 248 },   // 9: 좌-하단
      { x: 196, y: 242 },  // 10: 우-하단
      { x: 108, y: 338 },  // 11: 최하단
    ];
    return bases.map(base => ({
      x: base.x + Math.floor(rand(14)),
      y: base.y + Math.floor(rand(10)),
      rot: -18 + Math.floor(rand(36)),
    }));
  }, [date]);

  // 트로피 기울기 (날짜별 고정)
  const trophyTilt = useMemo(() => {
    const rand = seededRandom(date + "-trophy");
    return -10 + Math.floor(rand(20)); // -10° ~ +10°
  }, [date]);

  // 트로피를 포스트잇과 동일한 scatter 아이템으로 취급 (최대 12슬롯)
  const { scatterItems, overflowNotes } = useMemo(() => {
    const MAX_SCATTER = 12;
    type ScatterItem =
      | { type: "note"; data: LockerNote }
      | { type: "trophy" };

    if (!hasMvp) {
      return {
        scatterItems: notes.slice(0, MAX_SCATTER).map((n): ScatterItem => ({ type: "note", data: n })),
        overflowNotes: notes.slice(MAX_SCATTER),
      };
    }

    // 트로피가 차지할 슬롯을 notes 사이 랜덤 위치에 삽입
    const maxNotes = MAX_SCATTER - 1;
    const notesForScatter = notes.slice(0, maxNotes);
    const rand = seededRandom(date + "-trophy-insert");
    const insertIdx = Math.floor(rand(notesForScatter.length + 1));

    const items: ScatterItem[] = notesForScatter.map((n) => ({ type: "note", data: n }));
    items.splice(insertIdx, 0, { type: "trophy" });

    return {
      scatterItems: items,
      overflowNotes: notes.slice(maxNotes),
    };
  }, [notes, hasMvp, date]);

  // 컨테이너 높이: 폴라로이드 or 마지막 scatter 아이템 하단 중 큰 값
  const scatterHeight = useMemo(() => {
    const baseHeight = logs.length > 0 ? 240 : 100;
    if (scatterItems.length === 0) return baseHeight;
    const slots = logs.length === 0 ? noLogScatterSlots : scatterSlots;
    const maxBottom = Math.max(
      ...slots.slice(0, scatterItems.length).map(s => s.y + 74)
    );
    return Math.max(baseHeight, maxBottom);
  }, [scatterItems.length, scatterSlots, noLogScatterSlots, logs.length]);

  return (
    <button
      onClick={logs.length > 0 ? onClick : undefined}
      className={`flex flex-col items-center group touch-manipulation ${logs.length > 0 ? 'cursor-pointer active:scale-[0.97] transition-transform' : 'cursor-default'}`}
    >
      {/* 폴라로이드 없고 포스트잇만 있을 때 (MVP 없음) - 3열 그리드 */}
      {logs.length === 0 && notes.length > 0 && !hasMvp ? (
        <div className={notes.length <= 2 ? "flex gap-3 justify-center" : "grid grid-cols-3 gap-3 justify-items-center"} style={notes.length > 2 ? { maxWidth: 228 } : undefined}>
          {notes.map((note) => (
            <PostItNote
              key={note.id}
              content={note.content}
              color={note.color}
              rotation={note.rotation}
              recipientId={note.recipient?.id || ""}
              recipientName={note.recipient?.name || "팀원"}
              tags={note.tags}
              onClick={canOpenNote(note) ? () => setExpandedNoteId(note.id) : undefined}
              showRecipient={disableNoteOpen}
              isMine={canOpenNote(note)}
            />
          ))}
        </div>
      ) : (logs.length > 0 || hasMvp || notes.length > 0) ? (
        <>
          {/* 흩뿌리기 컨테이너 */}
          <div className="relative" style={{ width: 280, height: scatterHeight }}>
            {/* 폴라로이드 스택 - 컨테이너 중앙 */}
            {logs.length > 0 && (
              <div className="absolute w-44 h-56" style={{ left: 52, top: 12 }}>
                {visibleLogs.map((log, i) => {
                  const config = configs[visibleLogs.length - 1 - i] || configs[0];
                  const rotation = visibleLogs.length === 1 ? getSingleCardRotation(log.id) : config.rotation;
                  const expandOffset = getExpandedOffset(i, visibleLogs.length);

                  return (
                    <div
                      key={log.id}
                      className="absolute stack-card"
                      style={isExpanding ? {
                        top: 10,
                        left: '50%',
                        marginLeft: -72 + expandOffset,
                        transform: 'rotate(0deg) scale(1.2)',
                        zIndex: i + 1,
                        opacity: 1,
                      } : {
                        top: config.top,
                        left: '50%',
                        marginLeft: -72 + config.left,
                        transform: `rotate(${rotation}deg)`,
                        zIndex: config.zIndex,
                      }}
                    >
                      <PolaroidCard log={log} variant="stack" />
                    </div>
                  );
                })}
              </div>
            )}

            {/* 트로피 + 포스트잇 통합 scatter — 같은 슬롯 시스템으로 섞임 */}
            {!isExpanding && scatterItems.map((item, i) => {
              // 폴라로이드 없으면 중앙 기준 슬롯 사용, 있으면 폴라로이드 옆 슬롯 사용
              const slot = logs.length === 0 ? noLogScatterSlots[i] : scatterSlots[i];
              if (!slot) return null;

              if (item.type === "trophy") {
                return (
                  <div
                    key="trophy"
                    className="absolute cursor-pointer"
                    style={{ left: slot.x, top: slot.y, zIndex: 10 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowMvpSheet(true);
                    }}
                  >
                    <div
                      className="text-5xl animate-bounce"
                      style={{
                        filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
                        transform: `rotate(${trophyTilt}deg)`,
                        width: 64, height: 64,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      🏆
                    </div>
                  </div>
                );
              }

              const note = item.data;
              return (
                <div
                  key={note.id}
                  className="absolute"
                  style={{ left: slot.x, top: slot.y, zIndex: 5 }}
                >
                  <PostItNote
                    content={note.content}
                    color={note.color}
                    rotation={slot.rot}
                    recipientId={note.recipient?.id || ""}
                    recipientName={note.recipient?.name || "팀원"}
                    tags={note.tags}
                    onClick={canOpenNote(note) ? () => setExpandedNoteId(note.id) : undefined}
                    showRecipient={disableNoteOpen}
                    isMine={canOpenNote(note)}
                  />
                </div>
              );
            })}
          </div>

          {/* 넘친 포스트잇 — 아래쪽 가로 배치 */}
          {!isExpanding && overflowNotes.length > 0 && (
            <div className="flex gap-3 flex-wrap justify-center max-w-sm mt-2">
              {overflowNotes.map((note) => (
                <PostItNote
                  key={note.id}
                  content={note.content}
                  color={note.color}
                  rotation={note.rotation}
                  recipientId={note.recipient?.id || ""}
                  recipientName={note.recipient?.name || "팀원"}
                  tags={note.tags}
                  onClick={canOpenNote(note) ? () => setExpandedNoteId(note.id) : undefined}
                  showRecipient={disableNoteOpen}
                  isMine={canOpenNote(note)}
                />
              ))}
            </div>
          )}
        </>
      ) : null}
      <div
        className={`text-center stack-card ${logs.length === 0 && notes.length > 0 ? 'mt-4' : '-mt-1'}`}
        style={{ opacity: isExpanding ? 0 : 1 }}
      >
        <p className="text-sm font-semibold text-team-500">{displayDate}</p>
        {!hideCount && logs.length > 0 && (
          <p className="text-xs text-gray-400">{logs.length}명의 기록</p>
        )}
      </div>

      {/* 쪽지 확대 모달 */}
      {expandedNoteId && (() => {
        const note = notes.find((n) => n.id === expandedNoteId);
        return (
          <div
            className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-50 p-6"
            onClick={(e) => {
              e.stopPropagation();
              setExpandedNoteId(null);
            }}
          >
            {/* 포스트잇 */}
            <div
              className="relative w-full max-w-xs min-h-[280px] p-6 pb-10 shadow-xl flex flex-col"
              style={{
                backgroundColor: note?.color || "#FFF59D",
                transform: `rotate(${(note?.rotation || 0) * 0.3}deg)`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* X 닫기 버튼 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedNoteId(null);
                }}
                className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center text-gray-500 hover:text-gray-700"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              {/* To: 받는 사람 */}
              <p className="text-sm text-gray-500 mb-3">
                To. {note?.recipient?.name || "팀원"}
              </p>

              {/* 내용 */}
              <p className="text-gray-800 whitespace-pre-wrap break-words text-base flex-1">
                {note?.content}
              </p>

              {/* 보낸 사람: currentUserId가 있으면 내가 쓴 것만, 없으면 익명 아닌 것 모두 */}
              {currentUserId
                ? note?.author?.id === currentUserId && (
                    <p className="text-sm text-gray-500 text-center mt-4">
                      From. {note?.author?.name}
                    </p>
                  )
                : !note?.isAnonymous && note?.author?.name && (
                    <p className="text-sm text-gray-500 text-center mt-4">
                      From. {note.author.name}
                    </p>
                  )}
            </div>

            {/* 나도 쪽지 붙이러 가기 CTA */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpandedNoteId(null);
                router.push("/compliment");
              }}
              className="mt-5 px-5 py-2.5 rounded-full bg-white/20 hover:bg-white/30 active:bg-white/40 text-sm text-white font-medium transition-colors"
            >
              나도 누군가의 라커에 쪽지 남기고 도망가기
            </button>
          </div>
        );
      })()}

      {/* MVP 결과 바텀시트 */}
      {showMvpSheet && mvpEventId && (
        <MvpResultSheet
          eventId={mvpEventId}
          isOpen={showMvpSheet}
          onClose={() => setShowMvpSheet(false)}
        />
      )}
    </button>
  );
}
