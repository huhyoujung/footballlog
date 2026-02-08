/**
 * 한글 이름 뒤에 올바른 조사를 붙여주는 유틸리티
 */

/**
 * 마지막 글자에 받침이 있는지 확인
 */
function hasFinalConsonant(name: string): boolean {
  if (!name || name.length === 0) return false;

  const lastChar = name.charAt(name.length - 1);
  const code = lastChar.charCodeAt(0);

  // 한글 유니코드 범위: 0xAC00 ~ 0xD7A3
  if (code < 0xAC00 || code > 0xD7A3) {
    // 한글이 아니면 받침 없음으로 간주
    return false;
  }

  // 받침 계산: (code - 0xAC00) % 28
  // 0이면 받침 없음, 1~27이면 받침 있음
  return (code - 0xAC00) % 28 !== 0;
}

/**
 * 이름 뒤에 을/를 붙이기
 */
export function withEulReul(name: string | null | undefined): string {
  const displayName = name || "팀원";
  return hasFinalConsonant(displayName) ? `${displayName}을` : `${displayName}를`;
}

/**
 * 이름 뒤에 이/가 붙이기
 */
export function withIGa(name: string | null | undefined): string {
  const displayName = name || "팀원";
  return hasFinalConsonant(displayName) ? `${displayName}이` : `${displayName}가`;
}

/**
 * 이름 뒤에 은/는 붙이기
 */
export function withEunNeun(name: string | null | undefined): string {
  const displayName = name || "팀원";
  return hasFinalConsonant(displayName) ? `${displayName}은` : `${displayName}는`;
}
