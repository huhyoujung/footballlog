/**
 * 임시 테스트용: Web Audio API로 간단한 beep 소리 생성
 * 실제 효과음 파일 추가 전까지 사용 가능
 */
export function generateBeep() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // 휘슬 느낌의 높은 주파수
    oscillator.frequency.value = 2000; // Hz
    oscillator.type = "sine";

    // 볼륨 페이드
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    console.log("Beep generation failed:", error);
  }
}
