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

/**
 * 작은 포스트잇 쪽지 컴포넌트
 * 폴라로이드 사진 근처에 붙는 작은 메모 스타일
 * isMine일 때 우측 하단 접힌 모서리 표시
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
      <div
        className={`w-16 h-16 shadow-md transition-all relative overflow-hidden ${isClickable ? "cursor-pointer hover:shadow-lg" : "cursor-default"}`}
        style={{
          backgroundColor: color,
        }}
      >
        {showRecipient && (
          <p className="absolute inset-0 flex items-center justify-center text-[9px] text-gray-600 font-medium px-1 text-center leading-tight">
            To. {recipientName}
          </p>
        )}

        {/* 내가 보낸 쪽지: 우측 하단 접힌 모서리 */}
        {isMine && (
          <>
            {/* 배경이 드러나는 흰색 삼각형 (모서리 잘림) */}
            <div
              className="absolute bottom-0 right-0 w-0 h-0"
              style={{
                borderLeft: "14px solid transparent",
                borderBottom: "14px solid #ffffff",
              }}
            />
            {/* 접힌 종이 뒷면 (어두운 톤 + 그림자) */}
            <div
              className="absolute bottom-0 right-0 w-0 h-0"
              style={{
                borderTop: `14px solid ${color}`,
                borderRight: "14px solid transparent",
                filter: "brightness(0.82) drop-shadow(-1px 1px 1px rgba(0,0,0,0.12))",
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}
