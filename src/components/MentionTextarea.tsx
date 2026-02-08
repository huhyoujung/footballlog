"use client";

import { useState, useRef, useEffect } from "react";

interface TeamMember {
  id: string;
  name: string | null;
  position: string | null;
  number: number | null;
}

interface Props {
  value: string;
  onChange: (value: string, mentions: string[]) => void;
  teamMembers: TeamMember[];
  placeholder?: string;
  rows?: number;
  className?: string;
  dropdownPosition?: "top" | "bottom";
}

export default function MentionTextarea({
  value,
  onChange,
  teamMembers,
  placeholder,
  rows = 5,
  className = "",
  dropdownPosition = "bottom",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);

  // @ 입력 감지
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);

    // @ 위치 찾기 (가장 최근의 @)
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);

      // @ 이후 공백이 없으면 멘션 입력 중
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }

    setShowSuggestions(false);
  }, [value]);

  // 필터링된 팀원 목록
  const filteredMembers = teamMembers.filter((member) =>
    member.name?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // 멘션 ID 추출 함수
  const extractMentions = (text: string): string[] => {
    const mentionPattern = /@(\S+)/g;
    const foundMentions: string[] = [];
    let match;

    while ((match = mentionPattern.exec(text)) !== null) {
      const mentionName = match[1];
      const member = teamMembers.find((m) => m.name === mentionName);
      if (member && !foundMentions.includes(member.id)) {
        foundMentions.push(member.id);
      }
    }

    return foundMentions;
  };

  // 팀원 선택
  const selectMember = (member: TeamMember) => {
    if (mentionStartPos === null || !textareaRef.current) return;

    const before = value.substring(0, mentionStartPos);
    const after = value.substring(textareaRef.current.selectionStart);
    const newValue = `${before}@${member.name} ${after}`;

    const mentions = extractMentions(newValue);
    onChange(newValue, mentions);
    setShowSuggestions(false);

    // 커서 위치 조정
    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStartPos + 1 + (member.name?.length || 0) + 1;
        textareaRef.current.selectionStart = newCursorPos;
        textareaRef.current.selectionEnd = newCursorPos;
        textareaRef.current.focus();
      }
    }, 0);
  };

  // 키보드 이벤트
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || filteredMembers.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredMembers.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === "Enter" && filteredMembers[selectedIndex]) {
      e.preventDefault();
      selectMember(filteredMembers[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 실제 텍스트 영역 */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          const newValue = e.target.value;
          const mentions = extractMentions(newValue);
          onChange(newValue, mentions);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
      />

      {/* 자동완성 드롭다운 */}
      {showSuggestions && filteredMembers.length > 0 && (
        <div
          className={`absolute z-50 left-0 right-0 w-full bg-white border border-gray-200 rounded-lg shadow-xl max-h-48 overflow-y-auto ${
            dropdownPosition === "top" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {filteredMembers.slice(0, 5).map((member, index) => (
            <button
              key={member.id}
              type="button"
              onClick={() => selectMember(member)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors first:rounded-t-lg last:rounded-b-lg ${
                index === selectedIndex ? "bg-team-50" : ""
              }`}
            >
              <span className="font-medium text-gray-900 text-sm">
                {member.name || "익명"}
              </span>
              {(member.position || member.number) && (
                <span className="text-xs text-gray-500">
                  {member.position || ""} {member.number ? `#${member.number}` : ""}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
