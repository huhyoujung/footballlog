/**
 * 팀 커스텀 컬러 시스템
 * primaryColor(진한 색)로부터 7단계 팔레트 자동 생성
 */

/**
 * HEX → HSL 변환
 */
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // #RRGGBB 형식
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * HSL → HEX 변환
 */
function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;
  s = s / 100;
  l = l / 100;

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;

    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * primaryColor로부터 7단계 팔레트 생성
 * team-500 = 원본, 나머지는 lightness 조절
 */
export function generatePalette(primaryColor: string): Record<string, string> {
  const hsl = hexToHSL(primaryColor);

  return {
    "team-50": hslToHex(hsl.h, hsl.s, 95),
    "team-100": hslToHex(hsl.h, hsl.s, 90),
    "team-200": hslToHex(hsl.h, hsl.s, 82),
    "team-300": hslToHex(hsl.h, hsl.s, 65),
    "team-400": hslToHex(hsl.h, hsl.s, 55),
    "team-500": primaryColor, // 원본
    "team-600": hslToHex(hsl.h, hsl.s, 40),
    "team-700": hslToHex(hsl.h, hsl.s, 30),
  };
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
