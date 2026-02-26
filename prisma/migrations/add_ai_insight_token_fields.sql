-- AIInsight: OpenAI 토큰 사용량 추적 필드 추가
ALTER TABLE "AIInsight" ADD COLUMN IF NOT EXISTS "promptTokens" INTEGER;
ALTER TABLE "AIInsight" ADD COLUMN IF NOT EXISTS "completionTokens" INTEGER;
ALTER TABLE "AIInsight" ADD COLUMN IF NOT EXISTS "model" TEXT;
