/**
 * 운동 시작까지 남은 시간 또는 지난 시간을 한글로 반환
 * @param eventDate - 운동 시작 시간 (ISO string)
 * @returns 시간 메시지 (예: "1시간 30분 후 시작", "30분 전 시작했어요")
 */
export function getTimeUntilEvent(eventDate: string): {
  message: string;
  isPast: boolean;
} {
  const now = new Date();
  const event = new Date(eventDate);
  const diffMs = event.getTime() - now.getTime();
  const isPast = diffMs < 0;
  const absDiffMs = Math.abs(diffMs);

  const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
  const minutes = Math.floor((absDiffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (isPast) {
    // 운동 시작 후
    if (hours > 0) {
      return {
        message: `${hours}시간 ${minutes}분 전 시작했어요!`,
        isPast: true,
      };
    } else {
      return {
        message: `${minutes}분 전 시작했어요!`,
        isPast: true,
      };
    }
  } else {
    // 운동 시작 전
    if (hours > 0) {
      if (minutes > 0) {
        return {
          message: `${hours}시간 ${minutes}분 후 시작`,
          isPast: false,
        };
      } else {
        return {
          message: `${hours}시간 후 시작`,
          isPast: false,
        };
      }
    } else {
      return {
        message: `${minutes}분 후 시작`,
        isPast: false,
      };
    }
  }
}

/**
 * 현재 시간이 체크인 가능 시간대인지 확인
 * @param eventDate - 운동 시작 시간 (ISO string)
 * @returns 체크인 가능 여부 (운동 시작 2시간 전 ~ 2시간 후)
 */
export function isCheckInPeriod(eventDate: string): boolean {
  const now = new Date();
  const event = new Date(eventDate);
  const twoHoursBefore = new Date(event.getTime() - 2 * 60 * 60 * 1000);
  const twoHoursAfter = new Date(event.getTime() + 2 * 60 * 60 * 1000);

  return now >= twoHoursBefore && now <= twoHoursAfter;
}
