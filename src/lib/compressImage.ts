// 클라이언트 사이드 이미지 압축 (Canvas API, 외부 라이브러리 없음)

const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.8;
const OUTPUT_TYPE = "image/jpeg";

/**
 * 이미지 파일을 리사이즈 + JPEG 압축하여 반환합니다.
 * - 최대 1920x1920 내로 리사이즈 (비율 유지)
 * - JPEG 품질 0.8로 압축
 * - 보통 10-30MB 폰 사진 → 200KB~1MB로 줄어듦
 */
export async function compressImage(file: File): Promise<File> {
  // 이미 충분히 작으면 그대로 반환 (1MB 이하)
  if (file.size <= 1 * 1024 * 1024) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  // 리사이즈 비율 계산
  let newWidth = width;
  let newHeight = height;

  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
    newWidth = Math.round(width * ratio);
    newHeight = Math.round(height * ratio);
  }

  // OffscreenCanvas 지원 시 사용 (메인 스레드 부담 감소)
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas context not available");
  }

  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  const blob = await canvas.convertToBlob({
    type: OUTPUT_TYPE,
    quality: QUALITY,
  });

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: OUTPUT_TYPE,
  });
}
