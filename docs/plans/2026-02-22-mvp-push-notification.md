# MVP 푸시 알림 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 투표 마감 시 MVP 당선자와 MVP를 맞춘 투표자에게 재치있는 푸시 알림 전송

**Architecture:** pom GET API에 lazy trigger 삽입. 마감 후 첫 조회 시 `pomPushSentAt`으로 원자적 check-and-set, 중복 발송 방지. `sendPushToUsers` 함수로 대상별 발송.

**Tech Stack:** Prisma, web-push (`src/lib/push.ts`), Next.js API Route

---

### Task 1: schema.prisma에 pomPushSentAt 추가 + 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: TrainingEvent 모델에 필드 추가**

`prisma/schema.prisma`에서 `TrainingEvent` 모델을 찾아 다음 필드 추가:
```prisma
pomPushSentAt      DateTime?
```
(다른 `pom` 관련 필드들 근처에 추가)

**Step 2: 마이그레이션 실행**
```bash
cd /Users/huhyoujung/dev/football-log && npx prisma migrate dev --name add-pom-push-sent-at
```
Expected: `✓ Generated Prisma Client`

**Step 3: 커밋**
```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: TrainingEvent에 pomPushSentAt 필드 추가"
```

---

### Task 2: pom GET API에 MVP 푸시 발송 로직 추가

**Files:**
- Modify: `src/app/api/training-events/[id]/pom/route.ts`

**Step 1: import 추가**

파일 상단에 추가:
```ts
import { sendPushToUsers } from "@/lib/push";
import { isPomVotingClosed } from "@/lib/pom";
```

**Step 2: event select에 필드 추가**

기존 select에 두 필드 추가:
```ts
select: {
  date: true,
  teamId: true,
  pomVotesPerPerson: true,
  pomVotingDeadline: true,   // 추가
  pomPushSentAt: true,       // 추가
  team: { select: { name: true } },
},
```

**Step 3: 결과 집계 후, return 직전에 push 로직 삽입**

`return NextResponse.json({...})` 바로 앞에 다음 코드 삽입:

```ts
// MVP 푸시 알림 (lazy trigger: 마감 후 첫 조회 시 1회 발송)
const isClosed = isPomVotingClosed(
  event.date.toISOString(),
  event.pomVotingDeadline?.toISOString() ?? null
);

if (isClosed && !event.pomPushSentAt && results.length > 0) {
  // 원자적 check-and-set (race condition 방지)
  const updated = await prisma.trainingEvent.updateMany({
    where: { id, pomPushSentAt: null },
    data: { pomPushSentAt: new Date() },
  });

  if (updated.count > 0) {
    // 1위 선수들 (공동 포함)
    const topCount = results[0].count;
    const mvps = results.filter((r) => r.count === topCount);
    const mvpIds = mvps.map((r) => r.user.id);

    // MVP 당선 알림
    await Promise.allSettled(
      mvps.map((mvp) =>
        sendPushToUsers([mvp.user.id], {
          title: mvpIds.length > 1 ? "🏆 공동 MVP!" : "🏆 오늘의 MVP는 당신!",
          body:
            mvpIds.length > 1
              ? "팀원들이 선택한 오늘의 영웅 중 한 명이에요 😍"
              : `${mvp.count}명의 팀원이 선택했어요. 이미 알고 있었죠? 😏`,
          url: `/training/${id}`,
        })
      )
    );

    // 투표 적중 알림 (MVP에게 투표한 사람, MVP 본인 제외)
    const mvpVoterIds = votes
      .filter((v) => mvpIds.includes(v.nomineeId) && !mvpIds.includes(v.voterId))
      .map((v) => v.voterId);

    const uniqueVoterIds = [...new Set(mvpVoterIds)];

    if (uniqueVoterIds.length > 0) {
      const mvpNames = mvps.map((m) => m.user.name || "팀원").join(", ");
      await sendPushToUsers(uniqueVoterIds, {
        title: "👀 보는 눈이 있으시네요!",
        body: `${mvpNames}님이 오늘 MVP가 됐어요. 탁월한 안목이에요 🎯`,
        url: `/training/${id}`,
      });
    }
  }
}
```

**Step 4: 빌드 타입 체크**
```bash
cd /Users/huhyoujung/dev/football-log && npm run build 2>&1 | grep -E "error TS|Error:" | head -20
```
Expected: 에러 없음

**Step 5: 커밋**
```bash
git add src/app/api/training-events/\[id\]/pom/route.ts
git commit -m "feat: MVP 투표 마감 시 당선자·투표 적중자에게 푸시 알림 발송"
```
