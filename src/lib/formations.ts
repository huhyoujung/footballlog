// 풋살 포메이션 정의 및 좌표 매핑

export interface FormationSlot {
  x: number; // 0~1 정규화 좌표 (좌→우)
  y: number; // 0~1 정규화 좌표 (상=상대골대, 하=우리골대)
  role: "GK" | "DF" | "MF" | "FW";
  label: string;
}

export interface Formation {
  label: string;
  slots: FormationSlot[]; // GK 포함 5명 (풋살)
}

export type FormationKey = "1-2-1" | "2-2" | "2-1-1" | "3-1" | "1-2-2" | "1-3";

// GK는 모든 포메이션에서 동일 위치
const GK: FormationSlot = { x: 0.5, y: 0.9, role: "GK", label: "GK" };

export const FUTSAL_FORMATIONS: Record<FormationKey, Formation> = {
  "1-2-1": {
    label: "1-2-1",
    slots: [
      GK,
      { x: 0.5, y: 0.7, role: "DF", label: "DF" },
      { x: 0.25, y: 0.45, role: "MF", label: "LM" },
      { x: 0.75, y: 0.45, role: "MF", label: "RM" },
      { x: 0.5, y: 0.2, role: "FW", label: "FW" },
    ],
  },
  "2-2": {
    label: "2-2",
    slots: [
      GK,
      { x: 0.3, y: 0.65, role: "DF", label: "LB" },
      { x: 0.7, y: 0.65, role: "DF", label: "RB" },
      { x: 0.3, y: 0.3, role: "FW", label: "LF" },
      { x: 0.7, y: 0.3, role: "FW", label: "RF" },
    ],
  },
  "2-1-1": {
    label: "2-1-1",
    slots: [
      GK,
      { x: 0.3, y: 0.7, role: "DF", label: "LB" },
      { x: 0.7, y: 0.7, role: "DF", label: "RB" },
      { x: 0.5, y: 0.45, role: "MF", label: "CM" },
      { x: 0.5, y: 0.2, role: "FW", label: "FW" },
    ],
  },
  "3-1": {
    label: "3-1",
    slots: [
      GK,
      { x: 0.2, y: 0.6, role: "DF", label: "LB" },
      { x: 0.5, y: 0.6, role: "DF", label: "CB" },
      { x: 0.8, y: 0.6, role: "DF", label: "RB" },
      { x: 0.5, y: 0.25, role: "FW", label: "FW" },
    ],
  },
  "1-2-2": {
    label: "1-2-2",
    slots: [
      GK,
      { x: 0.5, y: 0.7, role: "DF", label: "CB" },
      { x: 0.25, y: 0.45, role: "MF", label: "LM" },
      { x: 0.75, y: 0.45, role: "MF", label: "RM" },
      { x: 0.35, y: 0.2, role: "FW", label: "LF" },
    ],
  },
  "1-3": {
    label: "1-3",
    slots: [
      GK,
      { x: 0.5, y: 0.7, role: "DF", label: "CB" },
      { x: 0.2, y: 0.35, role: "FW", label: "LW" },
      { x: 0.5, y: 0.35, role: "FW", label: "CF" },
      { x: 0.8, y: 0.35, role: "FW", label: "RW" },
    ],
  },
};

export const FORMATION_KEYS = Object.keys(FUTSAL_FORMATIONS) as FormationKey[];

export interface PlayerPosition {
  x: number;
  y: number;
  role: string;
}

export type PositionsMap = Record<string, PlayerPosition>; // userId → position
