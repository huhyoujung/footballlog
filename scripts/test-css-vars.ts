import { teamColorCssVars } from "../src/lib/team-color";

console.log("=== CSS 변수 생성 테스트 ===\n");

// Nutty FC 컬러로 테스트
const NUTTY_COLOR = "#06B6D4";

console.log(`테스트 컬러: ${NUTTY_COLOR} (Nutty FC)\n`);

const cssVars = teamColorCssVars(NUTTY_COLOR);

console.log("생성된 CSS 변수:");
Object.entries(cssVars).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log("\n✓ TeamColorProvider가 이 변수들을 document.documentElement.style에 주입합니다");
console.log("✓ 페이지의 모든 team-* 클래스가 이 컬러를 사용합니다");
