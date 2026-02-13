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
}

/**
 * 작은 포스트잇 쪽지 컴포넌트
 * 폴라로이드 사진 근처에 붙는 작은 메모 스타일
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
        className={`w-16 h-16 shadow-md transition-all relative ${isClickable ? "cursor-pointer hover:shadow-lg" : "cursor-default"}`}
        style={{
          backgroundColor: color,
        }}
      >
        {showRecipient && (
          <p className="absolute inset-0 flex items-center justify-center text-[9px] text-gray-600 font-medium px-1 text-center leading-tight">
            To. {recipientName}
          </p>
        )}
      </div>
    </div>
  );
}
