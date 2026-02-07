import { getPositionGroup } from "./position";

type UserWithPosition = {
  userId: string;
  position: string | null | undefined;
};

type Assignment = {
  userId: string;
  teamLabel: string;
};

// Fisher-Yates 셔플
function shuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// 팀 라벨 생성 (A, B, C, D...)
function getTeamLabels(count: number): string[] {
  return Array.from({ length: count }, (_, i) => String.fromCharCode(65 + i));
}

// 가장 인원이 적은 팀 인덱스 반환
function getSmallestTeamIndex(teamCounts: number[]): number {
  let minIdx = 0;
  for (let i = 1; i < teamCounts.length; i++) {
    if (teamCounts[i] < teamCounts[minIdx]) minIdx = i;
  }
  return minIdx;
}

/**
 * 포지션 골고루 (Balanced)
 * 각 포지션 그룹을 라운드 로빈으로 각 팀에 균등 분배
 */
export function assignBalanced(
  users: UserWithPosition[],
  teamCount: number
): Assignment[] {
  const labels = getTeamLabels(teamCount);
  const assignments: Assignment[] = [];

  // 포지션 그룹별 분류
  const groups: Record<string, UserWithPosition[]> = {};
  for (const user of users) {
    const group = getPositionGroup(user.position);
    if (!groups[group]) groups[group] = [];
    groups[group].push(user);
  }

  // 각 그룹 내 셔플
  for (const group of Object.keys(groups)) {
    groups[group] = shuffle(groups[group]);
  }

  // GK, DF, MF, FW 순서대로 라운드 로빈 분배
  const teamCounts = new Array(teamCount).fill(0);
  const orderedGroups = ["GK", "DF", "MF", "FW", "??"];

  for (const groupName of orderedGroups) {
    const groupUsers = groups[groupName];
    if (!groupUsers) continue;

    for (const user of groupUsers) {
      const teamIdx = getSmallestTeamIndex(teamCounts);
      assignments.push({ userId: user.userId, teamLabel: labels[teamIdx] });
      teamCounts[teamIdx]++;
    }
  }

  return assignments;
}

/**
 * 비슷한 포지션끼리 (Grouped)
 * 같은 포지션 그룹을 한 팀에 모으되, GK는 각 팀에 분산
 */
export function assignGrouped(
  users: UserWithPosition[],
  teamCount: number
): Assignment[] {
  const labels = getTeamLabels(teamCount);
  const assignments: Assignment[] = [];

  // 포지션 그룹별 분류
  const groups: Record<string, UserWithPosition[]> = {};
  for (const user of users) {
    const group = getPositionGroup(user.position);
    if (!groups[group]) groups[group] = [];
    groups[group].push(user);
  }

  // 각 그룹 내 셔플
  for (const group of Object.keys(groups)) {
    groups[group] = shuffle(groups[group]);
  }

  const teamCounts = new Array(teamCount).fill(0);

  // GK는 특수: 1명씩 각 팀에 분산 (한 팀에 몰리면 안됨)
  if (groups["GK"]) {
    for (const user of groups["GK"]) {
      const teamIdx = getSmallestTeamIndex(teamCounts);
      assignments.push({ userId: user.userId, teamLabel: labels[teamIdx] });
      teamCounts[teamIdx]++;
    }
    delete groups["GK"];
  }

  // DF, MF, FW 그룹을 크기 내림차순 정렬 → 인원 적은 팀에 그룹 전체 배정
  const remainingGroups = Object.entries(groups)
    .filter(([key]) => key !== "??")
    .sort((a, b) => b[1].length - a[1].length);

  for (const [, groupUsers] of remainingGroups) {
    const teamIdx = getSmallestTeamIndex(teamCounts);
    for (const user of groupUsers) {
      assignments.push({ userId: user.userId, teamLabel: labels[teamIdx] });
      teamCounts[teamIdx]++;
    }
  }

  // ?? 그룹: 인원 적은 팀부터 1명씩 채움
  if (groups["??"]) {
    for (const user of groups["??"]) {
      const teamIdx = getSmallestTeamIndex(teamCounts);
      assignments.push({ userId: user.userId, teamLabel: labels[teamIdx] });
      teamCounts[teamIdx]++;
    }
  }

  return assignments;
}
