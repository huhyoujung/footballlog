# 장비함 체크 푸시 알림 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 팀 운동이 끝날 때(MVP 투표 마감 또는 시작 +2시간) 자동으로 팀 장비 담당자들에게 장비함 체크 푸시 알림을 발송한다.

**Architecture:** Vercel Cron이 10분마다 `/api/cron/equipment-check-notification`을 호출. 조건에 맞는 이벤트를 찾아 `equipmentCheckPushSentAt` 원자적 check-and-set으로 중복 방지 후 `sendPushToUsers`로 발송. MVP Cron의 패턴을 그대로 따름.

**Tech Stack:** Next.js App Router, Prisma (PostgreSQL), web-push (VAPID), Vercel Cron

---

### Task 1: Prisma 스키마에 필드 추가

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: `pomPushSentAt` 바로 아래에 필드 삽입**

`prisma/schema.prisma`에서 아래 줄을 찾는다:

```prisma
  pomPushSentAt            DateTime?
```

그 바로 아래에 한 줄 추가:

```prisma
  equipmentCheckPushSentAt DateTime?
```

**Step 2: 마이그레이션 생성 및 적용**

```bash
npx prisma migrate dev --name add-equipment-check-push-sent-at
```

Expected: `✔ Your database is now in sync with your schema.`

**Step 3: Prisma 클라이언트 재생성 확인**

마이그레이션 완료 후 `prisma migrate dev`가 자동으로 `generate`를 실행함. TypeScript에서 `trainingEvent.equipmentCheckPushSentAt` 필드가 인식되는지 확인:

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: 에러 없음 (또는 이미 있던 에러만 출력)

**Step 4: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: TrainingEvent에 equipmentCheckPushSentAt 필드 추가"
```

---

### Task 2: Cron 엔드포인트 생성

**Files:**
- Create: `src/app/api/cron/equipment-check-notification/route.ts`

**Step 1: 파일 생성**

아래 내용 전체를 `src/app/api/cron/equipment-check-notification/route.ts`로 저장:

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { isPomVotingClosed } from "@/lib/pom";

// 장비함 체크 알림 (Cron Job - 10분 간격)
// 운동 종료 시점(MVP 투표 마감 또는 시작 +2h)에 팀 장비 담당자에게 푸시 발송
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const now = new Date();

    // 배포 기준일: 이 날짜 이전 이벤트는 처리하지 않아 알림 폭탄 방지
    const deployedAt = new Date("2026-02-23T00:00:00Z");

    // 아직 장비 알림 미발송된 이벤트 조회
    const events = await prisma.trainingEvent.findMany({
      where: {
        date: {
          gte: deployedAt,
          lte: now,
        },
        equipmentCheckPushSentAt: null,
      },
      select: {
        id: true,
        title: true,
        date: true,
        teamId: true,
        enablePomVoting: true,
        pomVotingDeadline: true,
      },
    });

    let notified = 0;

    for (const event of events) {
      // 운동 종료 여부 판단
      let isEnded: boolean;
      if (event.enablePomVoting) {
        // MVP 투표 활성화 → 투표 마감 여부 기준
        isEnded = isPomVotingClosed(
          event.date.toISOString(),
          event.pomVotingDeadline?.toISOString() ?? null
        );
      } else {
        // MVP 투표 없음 → 운동 시작 +2시간 기준
        const twoHoursAfter = new Date(event.date.getTime() + 2 * 60 * 60 * 1000);
        isEnded = now >= twoHoursAfter;
      }

      if (!isEnded) continue;

      // 원자적 check-and-set (중복 발송 방지)
      const updated = await prisma.trainingEvent.updateMany({
        where: { id: event.id, equipmentCheckPushSentAt: null },
        data: { equipmentCheckPushSentAt: new Date() },
      });
      if (updated.count === 0) continue; // 이미 처리됨

      // 팀 장비 담당자 조회
      const managers = await prisma.user.findMany({
        where: {
          teamId: event.teamId,
          isEquipmentManager: true,
        },
        select: { id: true },
      });

      if (managers.length === 0) continue; // 담당자 없으면 skip

      const managerIds = managers.map((m) => m.id);

      await sendPushToUsers(managerIds, {
        title: "📦 장비함 체크해주세요",
        body: `${event.title} 운동이 끝났어요! 장비 잘 챙겨주세요 🙏`,
        url: `/training/${event.id}`,
      });

      console.log(
        `[EQUIPMENT CHECK] Sent to ${managers.length} managers for event ${event.id}`
      );
      notified++;
    }

    return NextResponse.json({
      ok: true,
      eventsChecked: events.length,
      notified,
    });
  } catch (error) {
    console.error("[EQUIPMENT CHECK] Cron 오류:", error);
    return NextResponse.json({ error: "실패했습니다" }, { status: 500 });
  }
}
```

**Step 2: TypeScript 타입 체크**

```bash
npx tsc --noEmit 2>&1 | grep "equipment-check" | head -20
```

Expected: 에러 없음

**Step 3: 커밋**

```bash
git add src/app/api/cron/equipment-check-notification/route.ts
git commit -m "feat: 장비함 체크 푸시 알림 Cron 엔드포인트 추가"
```

---

### Task 3: vercel.json에 Cron 스케줄 등록

**Files:**
- Modify: `vercel.json`

**Step 1: `crons` 배열에 항목 추가**

`vercel.json`의 `crons` 배열에 아래 항목을 추가:

```json
{
  "path": "/api/cron/equipment-check-notification",
  "schedule": "*/10 * * * *"
}
```

최종 `vercel.json`은 아래 형태:

```json
{
  "crons": [
    {
      "path": "/api/scheduled/weather-reminder",
      "schedule": "0 20 * * *"
    },
    {
      "path": "/api/cron/mvp-notification",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/equipment-check-notification",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

**Step 2: 빌드 확인**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` (또는 에러 없음)

**Step 3: 커밋**

```bash
git add vercel.json
git commit -m "feat: 장비함 체크 알림 Cron 스케줄 등록 (vercel.json)"
```

---

### Task 4: 로컬 동작 검증

**Step 1: 개발 서버 실행**

```bash
npm run dev
```

**Step 2: 테스트 DB에 과거 이벤트 생성 (선택)**

이미 DB에 이벤트가 있다면 `equipmentCheckPushSentAt`이 null인 이벤트 중 `date`가 오늘 이전인 것이 있는지 확인:

```bash
npx prisma studio
```

또는 psql로 직접 확인:
```sql
SELECT id, title, date, "equipmentCheckPushSentAt"
FROM "TrainingEvent"
WHERE date <= now()
  AND "equipmentCheckPushSentAt" IS NULL
LIMIT 5;
```

**Step 3: Cron 수동 호출**

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  http://localhost:3000/api/cron/equipment-check-notification
```

Expected:
```json
{"ok":true,"eventsChecked":N,"notified":M}
```

**Step 4: 중복 방지 확인**

같은 curl 명령을 다시 실행하면 `notified: 0`이어야 함 (이미 `equipmentCheckPushSentAt`이 설정됨).

---

## 완료 기준

- [ ] `prisma migrate dev` 성공, 새 필드 존재 확인
- [ ] `npm run build` 에러 없음
- [ ] Cron 수동 호출 시 `ok: true` 반환
- [ ] 두 번째 호출 시 `notified: 0` 반환 (중복 방지)
- [ ] Vercel 대시보드에서 Cron 등록 확인 (배포 후)
