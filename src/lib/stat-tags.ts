// 칭찬/MVP 투표에서 사용하는 스탯 태그 (락커 쪽지 + POM 투표 공통)
export const STAT_TAGS = [
  "공격", "스피드", "드리블", "체력", "수비",
  "피지컬", "패스", "슛", "킥", "팀워크",
] as const;

export type StatTag = (typeof STAT_TAGS)[number];
