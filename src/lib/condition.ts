export interface ConditionLevel {
  level: number;
  label: string;
  description: string;
  color: string;
}

export const CONDITION_LEVELS: ConditionLevel[] = [
  { level: 0, label: "운동 불가", description: "부상이나 극심한 피로", color: "#DC2626" },
  { level: 1, label: "극도로 낮음", description: "몸이 매우 무거운 상태", color: "#EF4444" },
  { level: 2, label: "매우 낮음", description: "천천히 걷는 수준", color: "#F97316" },
  { level: 3, label: "낮음", description: "가벼운 활동만 가능", color: "#FB923C" },
  { level: 4, label: "다소 낮음", description: "평소보다 힘이 없음", color: "#FBBF24" },
  { level: 5, label: "보통", description: "무난한 컨디션", color: "#EAB308" },
  { level: 6, label: "양호", description: "평소 수준의 컨디션", color: "#86EFAC" },
  { level: 7, label: "좋음", description: "몸이 가벼운 느낌", color: "#4ADE80" },
  { level: 8, label: "매우 좋음", description: "에너지가 넘침", color: "#22C55E" },
  { level: 9, label: "최상", description: "뭐든 할 수 있는 느낌", color: "#16A34A" },
  { level: 10, label: "완벽", description: "인생 최고의 컨디션", color: "#15803D" },
];

export function getConditionLevel(level: number): ConditionLevel {
  return CONDITION_LEVELS[Math.max(0, Math.min(10, level))];
}

export function getConditionColor(level: number): string {
  return getConditionLevel(level).color;
}

export function getConditionLabel(level: number): string {
  return getConditionLevel(level).label;
}

export function getConditionBgColor(level: number): string {
  if (level >= 6) return "bg-green-100";
  if (level >= 4) return "bg-yellow-100";
  if (level >= 2) return "bg-orange-100";
  return "bg-red-100";
}

export function getConditionTextColor(level: number): string {
  if (level >= 6) return "text-green-600";
  if (level >= 4) return "text-yellow-600";
  if (level >= 2) return "text-orange-500";
  return "text-red-500";
}
