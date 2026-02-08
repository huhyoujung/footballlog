/**
 * POM (Player of the Match) 투표 시간 관리 유틸리티
 */

export function getPomVotingStatus(eventDate: string): {
  isOpen: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
  message: string;
} {
  const now = new Date();
  const event = new Date(eventDate);

  // 투표 시작: 운동 시작 2시간 후
  const votingStartTime = new Date(event.getTime() + 2 * 60 * 60 * 1000);

  // 투표 마감: 다음날 23:59
  const votingEndDate = new Date(event);
  votingEndDate.setDate(votingEndDate.getDate() + 1);
  votingEndDate.setHours(23, 59, 59, 999);

  if (now < votingStartTime) {
    const hoursUntil = Math.floor((votingStartTime.getTime() - now.getTime()) / (60 * 60 * 1000));
    const minutesUntil = Math.floor(((votingStartTime.getTime() - now.getTime()) % (60 * 60 * 1000)) / (60 * 1000));

    return {
      isOpen: false,
      startsAt: votingStartTime,
      endsAt: null,
      message: hoursUntil > 0
        ? `${hoursUntil}시간 ${minutesUntil}분 후 투표 시작`
        : `${minutesUntil}분 후 투표 시작`,
    };
  }

  if (now > votingEndDate) {
    return {
      isOpen: false,
      startsAt: null,
      endsAt: votingEndDate,
      message: "투표가 마감되었습니다",
    };
  }

  // 투표 진행 중
  const hoursLeft = Math.floor((votingEndDate.getTime() - now.getTime()) / (60 * 60 * 1000));
  const minutesLeft = Math.floor(((votingEndDate.getTime() - now.getTime()) % (60 * 60 * 1000)) / (60 * 1000));

  return {
    isOpen: true,
    startsAt: votingStartTime,
    endsAt: votingEndDate,
    message: hoursLeft > 1
      ? `투표 마감까지 ${hoursLeft}시간`
      : `투표 마감까지 ${minutesLeft}분`,
  };
}

/**
 * 투표 마감 여부 확인
 */
export function isPomVotingClosed(eventDate: string): boolean {
  const now = new Date();
  const event = new Date(eventDate);

  const votingEndDate = new Date(event);
  votingEndDate.setDate(votingEndDate.getDate() + 1);
  votingEndDate.setHours(23, 59, 59, 999);

  return now > votingEndDate;
}
