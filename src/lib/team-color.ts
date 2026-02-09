/**
 * 팀 커스텀 컬러 시스템 (개선 버전)
 * primaryColor로부터 접근성을 고려한 50-700 팔레트 자동 생성
 * - 밝은 색상(50-400)은 채도를 낮춰서 자연스러운 배경색 생성
 * - 어두운 색상(600-700)은 채도 유지하여 강조 효과 유지
 */

import { generatePalette as generatePaletteBase } from "./colorPalette";

/**
 * primaryColor로부터 팀 컬러 팔레트 생성
 * 개선: 채도도 함께 조정하여 더 자연스러운 팔레트 생성
 */
export function generatePalette(primaryColor: string): Record<string, string> {
  const basePalette = generatePaletteBase(primaryColor);

  // "50" → "team-50" 형식으로 변환
  const teamPalette: Record<string, string> = {};
  Object.entries(basePalette).forEach(([shade, color]) => {
    teamPalette[`team-${shade}`] = color;
  });

  return teamPalette;
}

/**
 * 팔레트를 CSS 변수 객체로 변환
 */
export function teamColorCssVars(primaryColor: string): Record<string, string> {
  const palette = generatePalette(primaryColor);
  const vars: Record<string, string> = {};

  Object.entries(palette).forEach(([key, value]) => {
    vars[`--color-${key}`] = value;
  });

  return vars;
}
