/**
 * 키 컬러를 받아서 50-700 팔레트를 생성하는 유틸리티
 * 접근성을 고려한 명도 범위로 자동 조정
 */

interface HSL {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

interface RGB {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

/**
 * HEX → RGB 변환
 */
function hexToRgb(hex: string): RGB {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * RGB → HSL 변환
 */
function rgbToHsl(rgb: RGB): HSL {
  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;

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
 * HSL → RGB 변환
 */
function hslToRgb(hsl: HSL): RGB {
  const h = hsl.h / 360;
  const s = hsl.s / 100;
  const l = hsl.l / 100;

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

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

/**
 * RGB → HEX 변환
 */
function rgbToHex(rgb: RGB): string {
  const toHex = (n: number) => {
    const hex = Math.max(0, Math.min(255, Math.round(n))).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`.toUpperCase();
}

/**
 * HEX → HSL 변환
 */
export function hexToHsl(hex: string): HSL {
  return rgbToHsl(hexToRgb(hex));
}

/**
 * HSL → HEX 변환
 */
export function hslToHex(hsl: HSL): string {
  return rgbToHex(hslToRgb(hsl));
}

/**
 * 키 컬러를 받아서 50-700 팔레트 생성
 * Tailwind 스타일 명도 범위 사용
 */
export function generatePalette(keyColor: string): Record<string, string> {
  const baseHsl = hexToHsl(keyColor);

  // 팔레트 명도 맵 (Tailwind 기준)
  const lightnessMap: Record<string, number> = {
    "50": 96,  // 매우 밝은 배경
    "100": 92, // 밝은 배경
    "200": 84, // 호버 배경
    "300": 72, // 비활성 요소
    "400": 62, // 보조 요소
    "500": baseHsl.l, // 키 컬러 (기준)
    "600": Math.max(baseHsl.l - 10, 40), // 호버 상태
    "700": Math.max(baseHsl.l - 20, 30), // 강조/액티브
  };

  const palette: Record<string, string> = {};

  for (const [shade, lightness] of Object.entries(lightnessMap)) {
    // 채도 조정: 밝은 색상은 채도를 낮춤
    let saturation = baseHsl.s;
    if (parseInt(shade) < 500) {
      // 50-400: 채도를 점진적으로 낮춤
      const factor = (500 - parseInt(shade)) / 500;
      saturation = Math.max(baseHsl.s - baseHsl.s * factor * 0.3, 20);
    }

    palette[shade] = hslToHex({
      h: baseHsl.h,
      s: Math.round(saturation),
      l: lightness,
    });
  }

  return palette;
}

/**
 * 접근성을 위해 컬러의 명도/채도를 안전한 범위로 조정
 */
export function adjustColorForAccessibility(hex: string): string {
  const hsl = hexToHsl(hex);

  // 안전한 범위
  const SAFE_LIGHTNESS = { min: 35, max: 65 };
  const SAFE_SATURATION = { min: 30, max: 80 };

  const adjustedHsl: HSL = {
    h: hsl.h,
    s: Math.max(SAFE_SATURATION.min, Math.min(SAFE_SATURATION.max, hsl.s)),
    l: Math.max(SAFE_LIGHTNESS.min, Math.min(SAFE_LIGHTNESS.max, hsl.l)),
  };

  return hslToHex(adjustedHsl);
}

/**
 * 생성된 팔레트를 CSS 변수 형식으로 변환
 */
export function paletteToCssVars(palette: Record<string, string>, prefix = "team"): string {
  return Object.entries(palette)
    .map(([shade, color]) => `--color-${prefix}-${shade}: ${color};`)
    .join("\n  ");
}
