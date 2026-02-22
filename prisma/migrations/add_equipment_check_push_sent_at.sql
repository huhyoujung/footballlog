-- TrainingEvent: 장비 담당자 푸시 알림 중복 발송 방지 필드 추가
-- pomPushSentAt과 동일한 패턴으로 추가

ALTER TABLE "TrainingEvent" ADD COLUMN IF NOT EXISTS "equipmentCheckPushSentAt" TIMESTAMP(3);
