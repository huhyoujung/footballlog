interface TeamMember {
  id: string;
  name: string | null;
}

/**
 * 텍스트에서 @멘션을 파싱하여 태그된 사용자 ID 배열 반환
 * @param text - 파싱할 텍스트 (예: "오늘 @김민수 님과 패스 연습...")
 * @param teamMembers - 팀원 목록
 * @returns 태그된 사용자 ID 배열 (중복 제거)
 */
export function parseMentions(
  text: string,
  teamMembers: TeamMember[]
): string[] {
  // @로 시작하는 단어들 추출 (공백이나 구두점까지)
  const mentionPattern = /@([^\s@]+)/g;
  const matches = Array.from(text.matchAll(mentionPattern));

  if (matches.length === 0) return [];

  const taggedIds = new Set<string>();

  for (const match of matches) {
    const mentionedName = match[1]; // @ 뒤의 이름

    // 팀원 중에서 이름이 일치하는 사람 찾기
    const member = teamMembers.find(
      (m) => m.name && m.name.trim() === mentionedName.trim()
    );

    if (member) {
      taggedIds.add(member.id);
    }
  }

  return Array.from(taggedIds);
}

/**
 * 텍스트의 @멘션을 하이라이트된 span으로 변환
 * @param text - 변환할 텍스트
 * @returns 하이라이트된 JSX 요소 배열
 */
export function highlightMentions(text: string): React.ReactNode {
  const mentionPattern = /@([^\s@]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;

  let match;
  while ((match = mentionPattern.exec(text)) !== null) {
    // 멘션 이전 텍스트
    if (match.index > lastIndex) {
      parts.push(text.substring(lastIndex, match.index));
    }

    // 멘션 (하이라이트)
    parts.push(
      <span
        key={match.index}
        className="text-team-600 font-medium bg-team-50 px-1 rounded"
      >
        {match[0]}
      </span>
    );

    lastIndex = match.index + match[0].length;
  }

  // 남은 텍스트
  if (lastIndex < text.length) {
    parts.push(text.substring(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}
