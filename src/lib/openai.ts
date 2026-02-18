// OpenAI 클라이언트 싱글톤
import OpenAI from "openai";

const globalForOpenAI = globalThis as unknown as {
  openai: OpenAI | undefined;
};

export const openai =
  globalForOpenAI.openai ??
  new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    timeout: 30000,
  });

if (process.env.NODE_ENV !== "production") globalForOpenAI.openai = openai;
