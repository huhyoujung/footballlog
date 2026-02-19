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

  // 폴라로이드 양옆에 표시할 쪽지 (각 사이드 최대 5개)
  const sideLeftNotes = notes.filter((_, i) => i % 2 === 0).slice(0, 5);
  const sideRightNotes = notes.filter((_, i) => i % 2 === 1).slice(0, 5);
  // 양옆에 안 들어간 나머지 쪽지 → 아래쪽에 흩뿌리기
  const sideCount = sideLeftNotes.length + sideRightNotes.length;
  const overflowNotes = notes.slice(sideCount);

  return (
    <button
      onClick={logs.length > 0 ? onClick : undefined}
      className={`flex flex-col items-center group ${logs.length > 0 ? 'cursor-pointer' : 'cursor-default'}`}
    >
      {/* 폴라로이드 없고 포스트잇만 있을 때 (MVP 없음) - 3열 그리드 */}
      {logs.length === 0 && notes.length > 0 && !hasMvp ? (
        <div className="grid grid-cols-3 gap-3 justify-items-center" style={{ maxWidth: 228 }}>
          {notes.map((note) => (
            <PostItNote
              key={note.id}
              content={note.content}
              color={note.color}
              rotation={note.rotation}
              recipientId={note.recipient?.id || ""}
              recipientName={note.recipient?.name || "팀원"}
              tags={note.tags}
              onClick={disableNoteOpen ? undefined : () => setExpandedNoteId(note.id)}
              showRecipient={disableNoteOpen}
              isMine={!!currentUserId && note.author?.id === currentUserId}
            />
          ))}
        </div>
      ) : (
        <div className="flex items-start gap-4">
          {/* 왼쪽 포스트잇 */}
          {!isExpanding && sideLeftNotes.length > 0 && (
            <div className="flex flex-col gap-4 pt-8">
              {sideLeftNotes.map((note) => (
                <PostItNote
                  key={note.id}
                  content={note.content}
                  color={note.color}
                  rotation={note.rotation}
                  recipientId={note.recipient?.id || ""}
                  recipientName={note.recipient?.name || "팀원"}
                  tags={note.tags}
                  onClick={disableNoteOpen ? undefined : () => setExpandedNoteId(note.id)}
                  showRecipient={disableNoteOpen}
                  isMine={!!currentUserId && note.author?.id === currentUserId}
                />
              ))}
            </div>
          )}

          {/* 중앙: 폴라로이드 스택 또는 MVP 트로피 단독 */}
          {(logs.length > 0 || hasMvp) && (
          <div className={`relative ${logs.length > 0 ? 'w-44 h-56' : 'w-20 h-20 flex items-center justify-center'}`}>
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

            {/* MVP 트로피 — 클릭 시 MVP 바텀시트 */}
            {!isExpanding && hasMvp && (
              <div
                className="absolute cursor-pointer"
                style={logs.length > 0 ? {
                  top: -5,
                  left: -30,
                  zIndex: 100,
                } : {
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  zIndex: 100,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMvpSheet(true);
                }}
              >
                <div
                  className="text-5xl animate-bounce"
                  style={{
                    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
                  }}
                >
                  🏆
                </div>
              </div>
            )}
          </div>
        )}

          {/* 오른쪽 포스트잇 */}
          {!isExpanding && sideRightNotes.length > 0 && (
            <div className="flex flex-col gap-4 pt-8">
              {sideRightNotes.map((note) => (
                <PostItNote
                  key={note.id}
                  content={note.content}
                  color={note.color}
                  rotation={note.rotation}
                  recipientId={note.recipient?.id || ""}
                  recipientName={note.recipient?.name || "팀원"}
                  tags={note.tags}
                  onClick={disableNoteOpen ? undefined : () => setExpandedNoteId(note.id)}
                  showRecipient={disableNoteOpen}
                  isMine={!!currentUserId && note.author?.id === currentUserId}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* 양옆에 다 안 들어간 쪽지 — 아래쪽에 흩뿌리기 */}
      {!isExpanding && overflowNotes.length > 0 && logs.length > 0 && (
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
              onClick={disableNoteOpen ? undefined : () => setExpandedNoteId(note.id)}
              showRecipient={disableNoteOpen}
              isMine={!!currentUserId && note.author?.id === currentUserId}
            />
          ))}
        </div>
      )}
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
              className="mt-5 text-sm text-white/80 hover:text-white transition-colors underline underline-offset-4"
            >
              나도 누군가에게 쪽지 남기고 도망가기
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
