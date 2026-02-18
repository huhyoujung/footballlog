-- PomVote: 1인 1표 → pomVotesPerPerson에 따른 다중 투표 지원
-- 기존: @@unique([trainingEventId, voterId]) - 한 이벤트당 1인 1표
-- 변경: @@unique([trainingEventId, voterId, nomineeId]) - 같은 사람에게 중복 투표 방지

-- 1) 기존 unique constraint 삭제
ALTER TABLE "PomVote" DROP CONSTRAINT IF EXISTS "PomVote_trainingEventId_voterId_key";

-- 2) 새 unique constraint 생성 (투표자-후보자 조합으로 중복 방지)
ALTER TABLE "PomVote" ADD CONSTRAINT "PomVote_trainingEventId_voterId_nomineeId_key"
  UNIQUE ("trainingEventId", "voterId", "nomineeId");
