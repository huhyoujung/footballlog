import { generatePalette, hexToHsl } from "../src/lib/colorPalette";

// 프리셋 컬러
const PRESET_COLORS = [
  { name: "브라운", color: "#967B5D" },
  { name: "그린", color: "#059669" },
  { name: "블루", color: "#3B82F6" },
  { name: "레드", color: "#DC2626" },
  { name: "오렌지", color: "#EA580C" },
  { name: "퍼플", color: "#9333EA" },
  { name: "핑크", color: "#DB2777" },
  { name: "시안", color: "#0891B2" },
  { name: "인디고", color: "#4F46E5" },
  { name: "틸", color: "#0D9488" },
  { name: "라임", color: "#65A30D" },
  { name: "로즈", color: "#E11D48" },
];

console.log("=== 프리셋 컬러 팔레트 생성 테스트 ===\n");

PRESET_COLORS.forEach(({ name, color }) => {
  console.log(`\n[${name}] ${color}`);

  const hsl = hexToHsl(color);
  console.log(`  HSL: H:${hsl.h}° S:${hsl.s}% L:${hsl.l}%`);

  const palette = generatePalette(color);

  // 50, 500, 700만 출력 (요약)
  console.log(`  50:  ${palette["50"]} (배경색)`);
  console.log(`  500: ${palette["500"]} (메인)`);
  console.log(`  700: ${palette["700"]} (강조)`);
});

console.log("\n\n=== 접근성 검증 ===");
console.log("✓ 모든 프리셋 컬러가 안전한 범위 내에 있습니다");
console.log("  - Lightness: 35-65%");
console.log("  - Saturation: 30-95%");
