import { generatePalette as oldGenerate } from "../src/lib/team-color";
import { generatePalette as newGenerate } from "../src/lib/colorPalette";

const NUTTY_COLOR = "#06B6D4";

console.log("=== Nutty FC 컬러 팔레트 비교 ===\n");
console.log(`키 컬러: ${NUTTY_COLOR}\n`);

console.log("[ 기존 로직 ]");
const oldPalette = oldGenerate(NUTTY_COLOR);
Object.entries(oldPalette).forEach(([shade, color]) => {
  console.log(`${shade}: ${color}`);
});

console.log("\n[ 새 로직 (개선) ]");
const newPalette = newGenerate(NUTTY_COLOR);
Object.entries(newPalette).forEach(([shade, color]) => {
  console.log(`${shade}: ${color}`);
});

console.log("\n=== 차이점 ===");
console.log("기존: 채도 고정, 명도만 조정 → 밝은 색상이 너무 선명함");
console.log("개선: 채도도 조정 → 밝은 색상이 더 자연스러움");
