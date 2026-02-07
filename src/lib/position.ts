// 포지션 그룹 매핑
// 온보딩의 POSITIONS: ["GK", "CB", "LB", "RB", "CDM", "CM", "CAM", "LM", "RM", "LW", "RW", "ST", "CF"]

export const POSITION_GROUPS: Record<string, string[]> = {
  GK: ["GK"],
  DF: ["CB", "LB", "RB"],
  MF: ["CDM", "CM", "CAM", "LM", "RM"],
  FW: ["LW", "RW", "ST", "CF"],
};

export const POSITION_GROUP_LABELS: Record<string, string> = {
  GK: "골키퍼",
  DF: "수비수",
  MF: "미드필더",
  FW: "공격수",
  "??": "미설정",
};

export function getPositionGroup(position: string | null | undefined): string {
  if (!position) return "??";
  for (const [group, positions] of Object.entries(POSITION_GROUPS)) {
    if (positions.includes(position)) return group;
  }
  return "??";
}
