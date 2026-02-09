import { generatePalette } from "../src/lib/colorPalette";

const DEFAULT_COLOR = "#967B5D"; // 기본 브라운

console.log("=== 기본 팀 컬러 팔레트 (globals.css용) ===\n");
console.log(`키 컬러: ${DEFAULT_COLOR}\n`);

const palette = generatePalette(DEFAULT_COLOR);
Object.entries(palette).forEach(([shade, color]) => {
  console.log(`  --color-team-${shade}: ${color};`);
});
