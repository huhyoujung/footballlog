/**
 * 한글 조사 자동 판별 유틸
 * 마지막 글자의 받침 유무에 따라 올바른 조사를 반환
 */
export function addJosa(word: string, josa: '이/가' | '을/를' | '은/는' | '으로/로'): string {
  if (!word) return word;
  const last = word.charCodeAt(word.length - 1);
  const isHangul = last >= 0xAC00 && last <= 0xD7A3;

  if (!isHangul) {
    // 한글이 아닌 경우 (영문, 숫자 등) 양쪽 모두 표기
    const [a, b] = josa.split('/');
    return `${word}${a}(${b})`;
  }

  const hasJongseong = (last - 0xAC00) % 28 !== 0;

  switch (josa) {
    case '이/가': return word + (hasJongseong ? '이' : '가');
    case '을/를': return word + (hasJongseong ? '을' : '를');
    case '은/는': return word + (hasJongseong ? '은' : '는');
    case '으로/로': return word + (hasJongseong ? '으로' : '로');
  }
}
