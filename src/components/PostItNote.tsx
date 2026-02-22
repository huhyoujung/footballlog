"use client";

interface PostItNoteProps {
  content: string;
  color: string;
  rotation: number;
  recipientId: string;
  recipientName: string;
  tags?: string[];
  onClick?: () => void;
  showRecipient?: boolean; // 피드에서 받는 사람 이름 표시
  isMine?: boolean; // 내가 보낸 쪽지 여부
}

const FOLD = 14;

/**
 * 작은 포스트잇 쪽지 컴포넌트
 * 폴라로이드 사진 근처에 붙는 작은 메모 스타일
 * isMine일 때 clip-path로 모서리를 실제로 잘라내고 접힌 종이 표시
 * drop-shadow가 잘린 형태를 따라가므로 흰색 아티팩트 없음
 */
export default function PostItNote({
  content,
  color,
  rotation,
  recipientId,
  recipientName,
  tags = [],
  onClick,
  showRecipient = false,
  isMine = false,
}: PostItNoteProps) {
  const isClickable = !!onClick;

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className="block post-it-note"
      style={{
        transform: `rotate(${rotation}deg)`,
        zIndex: 5,
      }}
    >
      {/* drop-shadow가 자식 전체 합성 결과에 적용 → clip-path 형태를 따라감 */}
      <div
        className={`relative transition-transform ${isClickable ? "cursor-pointer touch-manipulation active:scale-[0.97]" : "cursor-default"}`}
        style={{
          width: 64,
          height: 64,
          filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.13)) drop-shadow(0 1px 2px rgba(0,0,0,0.08))",
        }}
      >
        {/* 포스트잇 본체 — isMine일 때 우하단 모서리 clip */}
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: color,
            clipPath: isMine
              ? `polygon(0 0, 100% 0, 100% calc(100% - ${FOLD}px), calc(100% - ${FOLD}px) 100%, 0 100%)`
              : undefined,
          }}
        >
          {showRecipient && (
            <p className="absolute inset-0 flex items-center justify-center text-[9px] text-gray-600 font-medium px-1 text-center leading-tight">
              To. {recipientName}
            </p>
          )}
        </div>

        {/* 접힌 종이 뒷면 — clip된 모서리 위에 올라오는 어두운 삼각형 */}
        {isMine && (
          <div
            className="absolute bottom-0 right-0 w-0 h-0"
            style={{
              borderTop: `${FOLD}px solid ${color}`,
              borderRight: `${FOLD}px solid transparent`,
              filter: "brightness(0.72) drop-shadow(-1px -1px 2px rgba(0,0,0,0.18))",
            }}
          />
        )}
      </div>
    </div>
  );
}
