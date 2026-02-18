// OpenAI 클라이언트 싱글톤 (lazy 초기화 — 빌드 시 환경변수 없어도 안전)
import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined;
};

export function getOpenAI(): OpenAI {
  if (!globalForOpenAI.openai) {
    globalForOpenAI.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 30000,
    });
  }
  return globalForOpenAI.openai;
}
