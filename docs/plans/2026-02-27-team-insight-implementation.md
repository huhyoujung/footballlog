# 팀 인사이트 통합 구현 플랜

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** `unified` AI 코치 API에 팀 전체 분석 섹션을 추가해 개인 코칭 + 팀 리포트가 하나의 레포트에 출력되도록 한다.

**Architecture:** GPT 2회 병렬 호출(개인/팀 각각), 결과를 하나의 마크다운 문자열로 합산해 기존 `content` 필드에 반환. 팀 인사이트는 `teamId_dateOnly` 기준으로 캐싱해 팀원 전체가 공유한다. 팀 레포트에서는 선수 이름 대신 포지션 기반 익명 ID(FW1, MF2)를 사용한다.

**Tech Stack:** Next.js API Route, Prisma (PostgreSQL), OpenAI gpt-4o-mini

---

## 수정 파일

- **Modify**: `src/app/api/insights/unified/route.ts`

---

## Task 1: 모듈 스코프 상수 + 순수 헬퍼 함수 추가

**Files:**
- Modify: `src/app/api/insights/unified/route.ts` (파일 상단, POST 함수 외부)

### Step 1: 파일 맨 위(`generatingUsers` Set 바로 아래)에 코드 추가

다음 코드를 `generatingUsers` Set 선언 바로 아래, `export async function POST` 바로 위에 삽입한다:

```typescript
// 동일 팀 동시 생성 방지 (팀원 여럿이 동시 요청해도 팀 GPT 1번만 호출)
const generatingTeams = new Set<string>();

// 개인 + 팀 인사이트를 하나의 마크다운 문자열로 합산
function mergeContent(personal: string, team: string): string {
  return `## 나의 코칭 피드백\n\n${personal}\n\n---\n\n${team}`;
}

// 팀 일지 배열을 포지션 기반 익명 ID로 변환해 문자열 반환
// 이름 → ID 매핑은 이번 호출 내에서만 일관성 유지
function anonymizeTeamLogs(
  logs: Array<{
    condition: number;
    keyPoints: string;
    improvement: string;
    trainingDate: Date;
    user: { name: string; position: string | null };
  }>
): string {
  const nameToAnon = new Map<string, string>();
  const posCounters: Record<string, number> = {};

  return logs
    .map((log) => {
      const name = log.user.name;
      if (!nameToAnon.has(name)) {
        const pos = log.user.position?.toUpperCase() || "선수";
        posCounters[pos] = (posCounters[pos] ?? 0) + 1;
        nameToAnon.set(name, `${pos}${posCounters[pos]}`);
      }
      const anon = nameToAnon.get(name)!;
      const date = log.trainingDate.toLocaleDateString("ko-KR");
      return `- [${date}] ${anon} 컨디션:${log.condition}/10 | 핵심:"${log.keyPoints}" | 개선:"${log.improvement}"`;
    })
    .join("\n");
}

// 포지션별 평균 컨디션 집계
function calcPositionStats(
  logs: Array<{ condition: number; user: { position: string | null } }>
): string {
  const stats: Record<string, { sum: number; count: number }> = {};
  for (const log of logs) {
    const pos = log.user.position?.toUpperCase() || "미정";
    if (!stats[pos]) stats[pos] = { sum: 0, count: 0 };
    stats[pos].sum += log.condition;
    stats[pos].count += 1;
  }
  return Object.entries(stats)
    .map(([pos, { sum, count }]) => `- ${pos}: 평균 ${(sum / count).toFixed(1)}/10 (${count}개 일지)`)
    .join("\n") || "없음";
}

// 칭찬쪽지 태그 빈도 집계 (상위 10개)
function buildTeamTagFrequency(notes: Array<{ tags: string[] }>): string {
  const freq: Record<string, number> = {};
  for (const note of notes) {
    for (const tag of note.tags) {
      freq[tag] = (freq[tag] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => `"${tag}": ${count}회`)
    .join(", ") || "없음";
}
```

### Step 2: TypeScript 타입 체크

```bash
npx tsc --noEmit 2>&1 | head -20
```

에러 없으면 통과.

### Step 3: 커밋

```bash
git add src/app/api/insights/unified/route.ts
git commit -m "feat: AI 코치 팀 인사이트 - 헬퍼 함수 추가"
```

---

## Task 2: 캐시 체크를 4-way 병렬로 교체

**Files:**
- Modify: `src/app/api/insights/unified/route.ts` (POST 함수 내부 캐시 체크 부분)

현재 캐시 체크는 개인 캐시만 확인하고 순차적으로 처리된다. 이를 개인+팀 캐시를 병렬로 확인하도록 교체한다.

### Step 1: 기존 캐시 체크 코드 교체

**교체 전** (현재 코드 줄 33~77):
```typescript
// 1. 일지 존재 여부 확인
const latestLog = await prisma.trainingLog.findFirst(...);
if (!latestLog) { return 400; }

// 2. KST dateOnly 계산

// 3. 오늘 인사이트 존재 + 그 이후 새 일지 없으면 캐시 반환
const existingToday = await prisma.aIInsight.findUnique(...);
if (existingToday && latestLog.createdAt <= existingToday.createdAt) { ... }

// 4. 새 데이터 없으면 마지막 인사이트 반환
if (!existingToday) { const latestInsight = ...; if (...) { ... } }
```

**교체 후**:

`userId = session.user.id;` 이후부터 `// 4. 데이터 수집 (병렬)` 이전까지의 블록 전체를 다음으로 교체한다:

```typescript
    userId = session.user.id;
    const teamId = session.user.teamId;

    if (generatingUsers.has(userId)) {
      return NextResponse.json(
        { error: "인사이트를 생성 중입니다. 잠시만 기다려주세요." },
        { status: 429 }
      );
    }

    // KST 기준 오늘 날짜 (Vercel은 UTC이므로 +9시간)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateOnly = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;

    // 개인/팀 캐시 + 최신 일지 4-way 병렬 조회
    const [personalCache, teamCache, latestMyLog, latestTeamLog] = await Promise.all([
      prisma.aIInsight.findUnique({ where: { userId_dateOnly: { userId, dateOnly } } }),
      prisma.aIInsight.findUnique({ where: { teamId_dateOnly: { teamId, dateOnly } } }),
      prisma.trainingLog.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.trainingLog.findFirst({
        where: { user: { teamId } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    // 개인 일지 없으면 인사이트 불가
    if (!latestMyLog) {
      return NextResponse.json(
        { error: "일지를 작성하면 AI 코치가 인사이트를 제공해요" },
        { status: 400 }
      );
    }

    // 캐시 유효 판단
    const personalHit =
      personalCache !== null && personalCache.createdAt >= latestMyLog.createdAt;
    const teamHit =
      teamCache !== null &&
      latestTeamLog !== null &&
      teamCache.createdAt >= latestTeamLog.createdAt;

    // 둘 다 캐시 HIT → 합산 즉시 반환
    if (personalHit && teamHit) {
      return NextResponse.json({
        insight: { content: mergeContent(personalCache!.content, teamCache!.content) },
        cached: true,
      });
    }
```

### Step 2: 타입 체크

```bash
npx tsc --noEmit 2>&1 | head -20
```

### Step 3: 커밋

```bash
git add src/app/api/insights/unified/route.ts
git commit -m "feat: AI 코치 팀 인사이트 - 4-way 캐시 체크 추가"
```

---

## Task 3: 데이터 수집에 팀 분석용 7개 쿼리 추가

**Files:**
- Modify: `src/app/api/insights/unified/route.ts` (Promise.all 블록)

### Step 1: 현재 `Promise.all` 블록 상단에서 `generatingUsers.add(userId)` 이후를 교체

현재 코드 (줄 79~179) 전체를 다음으로 교체한다:

```typescript
    // 데이터 수집 (병렬) — 여기서부터 OpenAI 호출까지 잠금
    const teamAlreadyGenerating = generatingTeams.has(teamId);
    generatingUsers.add(userId);
    if (!teamHit && !teamAlreadyGenerating) {
      generatingTeams.add(teamId);
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      userInfo,
      myLogs,
      teamLogs,
      recentEvents,
      myCheckInCount,
      totalEventCount,
      myPomVotes,
      myLockerNotes,
      teamMemberCount,
      pastInsights,
      rsvpData,
      // 팀 분석용 추가 데이터
      teamMvpVotes,
      recentMatches,
      activeLoggers,
      teamRsvpDistribution,
      teamLockerTags,
      pendingLateFeeCount,
      recentGoals,
    ] = await Promise.all([
      // 사용자 정보
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, position: true, number: true },
      }),
      // 내 최근 15개 훈련일지
      prisma.trainingLog.findMany({
        where: { userId },
        orderBy: { trainingDate: "desc" },
        take: 15,
        select: {
          condition: true,
          conditionReason: true,
          keyPoints: true,
          improvement: true,
          trainingDate: true,
          trainingEvent: { select: { title: true } },
        },
      }),
      // 팀 최근 30개 훈련일지 (나 제외)
      prisma.trainingLog.findMany({
        where: { user: { teamId }, userId: { not: userId } },
        orderBy: { trainingDate: "desc" },
        take: 30,
        select: {
          condition: true,
          conditionReason: true,
          keyPoints: true,
          improvement: true,
          trainingDate: true,
          user: { select: { name: true, position: true } },
        },
      }),
      // 최근 5개 훈련 이벤트
      prisma.trainingEvent.findMany({
        where: { teamId },
        orderBy: { date: "desc" },
        take: 5,
        select: {
          title: true,
          date: true,
          location: true,
          weather: true,
          temperature: true,
          _count: { select: { checkIns: true, rsvps: true } },
        },
      }),
      // 내 체크인 수
      prisma.checkIn.count({ where: { userId } }),
      // 전체 이벤트 수
      prisma.trainingEvent.count({ where: { teamId } }),
      // 내가 받은 MVP 투표
      prisma.pomVote.findMany({
        where: { nomineeId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { reason: true, createdAt: true },
      }),
      // 내가 받은 칭찬 쪽지 (최근 10개)
      prisma.lockerNote.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          content: true,
          tags: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      }),
      // 팀 인원
      prisma.user.count({ where: { teamId } }),
      // 과거 AI 코칭 기록 (최근 3개, 오늘 제외 — 변화 추적용)
      prisma.aIInsight.findMany({
        where: { userId, type: "PERSONAL", dateOnly: { not: dateOnly } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { content: true, dateOnly: true },
      }),
      // 나의 RSVP 패턴 (최근 10개 — 참석 의향 vs 실제 참석 비교)
      prisma.rsvp.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { status: true, trainingEvent: { select: { date: true } } },
      }),
      // [팀 분석] 팀 전체 MVP 투표 (포지션만 — 이름 제외)
      prisma.pomVote.findMany({
        where: { trainingEvent: { teamId } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { reason: true, tags: true, nominee: { select: { position: true } } },
      }),
      // [팀 분석] 최근 친선전 결과
      prisma.trainingEvent.findMany({
        where: { teamId, isFriendlyMatch: true, matchStatus: "COMPLETED" },
        orderBy: { date: "desc" },
        take: 5,
        select: { date: true, teamAScore: true, teamBScore: true, opponentTeamName: true },
      }),
      // [팀 분석] 최근 30일 일지 작성 참여 인원
      prisma.trainingLog.findMany({
        where: { user: { teamId }, trainingDate: { gte: thirtyDaysAgo } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      // [팀 분석] 팀 전체 RSVP 상태 분포
      prisma.rsvp.groupBy({
        by: ["status"],
        where: { trainingEvent: { teamId } },
        _count: { status: true },
      }),
      // [팀 분석] 팀원 수신 칭찬쪽지 태그 (최근 50개)
      prisma.lockerNote.findMany({
        where: { recipient: { teamId } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { tags: true },
      }),
      // [팀 분석] 미납 지각비 건수
      prisma.lateFee.count({
        where: { trainingEvent: { teamId }, status: "PENDING" },
      }),
      // [팀 분석] 최근 경기 골 기록
      prisma.goalRecord.findMany({
        where: { trainingEvent: { teamId } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { scoringTeam: true, isOwnGoal: true, minute: true },
      }),
    ]);
```

### Step 2: 타입 체크

```bash
npx tsc --noEmit 2>&1 | head -30
```

에러 없으면 통과.

### Step 3: 커밋

```bash
git add src/app/api/insights/unified/route.ts
git commit -m "feat: AI 코치 팀 인사이트 - 팀 분석용 7개 쿼리 추가"
```

---

## Task 4: 팀 시스템 프롬프트 + User Prompt 빌더 추가

**Files:**
- Modify: `src/app/api/insights/unified/route.ts` (프롬프트 구성 섹션)

### Step 1: 기존 `// 5. 프롬프트 구성` 주석 바로 위에 상수 추가

파일 내 `const systemPrompt = ...` 직전에 아래 상수를 추가한다:

```typescript
    const TEAM_SYSTEM_PROMPT = `당신은 한국 아마추어 축구/풋살 팀의 팀 코치입니다.
팀 전체 데이터를 분석해 팀의 현재 상태와 다음 훈련 방향을 제시합니다.

코칭 원칙:
- 선수 이름 절대 금지. 포지션 익명 ID(FW1, MF2 등)만 사용
- 정량 데이터(컨디션 수치, 출석률, 골 기록, RSVP 분포) + 정성 데이터(일지 키워드, MVP 이유, 칭찬 태그) 모두 활용
- 보고가 아닌 처방: "~했다" 대신 "~해보자", "~이 필요하다"
- 지각비 건수, RSVP NO_SHOW 비율 등으로 팀 헌신도(commitment) 언급
- 다음 훈련에서 팀 전체가 집중해야 할 과제 1-2개를 구체적으로 제시해라

응답 형식:
- ## 팀 현황 분석 으로 시작
- 1000자 내외, 마크다운, 이모지 강조 용도
- 반말 (팀원에게 직접 말하는 코치 톤)
- 구조: 이번 주 팀 상태 요약(수치 기반) → 주목할 포지션/패턴 → 다음 훈련 집중 과제
- 한국어로 응답`;
```

### Step 2: 기존 텍스트 포매팅 코드 이후에 팀 프롬프트 구성 코드 추가

기존 `const rsvpText = ...` 블록 바로 뒤에 다음을 추가한다:

```typescript
    // 팀 분석 데이터 포매팅
    const positionStatsText = calcPositionStats(teamLogs);

    const anonymizedTeamLogsText = anonymizeTeamLogs(teamLogs);

    const teamMvpText = teamMvpVotes.length > 0
      ? teamMvpVotes
          .map((v) => `- ${v.nominee.position?.toUpperCase() || "선수"}: "${v.reason}"${(v.tags as string[]).length > 0 ? ` [${(v.tags as string[]).join(", ")}]` : ""}`)
          .join("\n")
      : "없음";

    const matchResultsText = recentMatches.length > 0
      ? recentMatches
          .map((m) => {
            const date = m.date.toLocaleDateString("ko-KR");
            return `- [${date}] vs ${m.opponentTeamName || "상대팀"}: ${m.teamAScore}-${m.teamBScore}`;
          })
          .join("\n")
      : "없음";

    const activeLoggerRate = teamMemberCount > 0
      ? `${activeLoggers.length}/${teamMemberCount}명 (${Math.round((activeLoggers.length / teamMemberCount) * 100)}%)`
      : "없음";

    const rsvpDistText = teamRsvpDistribution.length > 0
      ? teamRsvpDistribution
          .map((r) => `${r.status}: ${r._count.status}건`)
          .join(" / ")
      : "없음";

    const teamTagFreqText = buildTeamTagFrequency(teamLockerTags);

    const ownGoals = recentGoals.filter((g) => g.isOwnGoal).length;
    const goalsText = recentGoals.length > 0
      ? `총 ${recentGoals.length}골 (자책골 ${ownGoals}개)`
      : "없음";

    const teamUserPrompt = `## 팀 기본 현황
- 팀 인원: ${teamMemberCount}명
- 최근 30일 일지 작성 참여: ${activeLoggerRate}
- 팀 평균 컨디션: ${teamAvgCondition}/10 (최근 30개 일지)
- 미납 지각비: ${pendingLateFeeCount}건

## 포지션별 컨디션 분포
${positionStatsText}

## 팀 RSVP 현황
${rsvpDistText}

## 팀원 훈련 일지 (익명, ${teamLogs.length}개)
${anonymizedTeamLogsText || "없음"}

## 팀 전체 MVP 투표 이유 (포지션 익명, ${teamMvpVotes.length}개)
${teamMvpText}

## 팀 칭찬쪽지 태그 빈도 (상위 10개)
${teamTagFreqText}

## 최근 친선전 결과
${matchResultsText}

## 최근 골 기록
${goalsText}

## 최근 훈련 이벤트 (날씨 포함)
${eventsText || "없음"}

위 데이터를 바탕으로, 팀 코치로서 팀원 전체에게 말하듯이 팀 현황 분석 리포트를 작성해줘.
선수 이름은 절대 언급하지 말고, 포지션 익명 ID(FW1, MF2 등)만 사용해줘.
다음 훈련에서 팀 전체가 집중해야 할 구체적인 과제를 포함해줘.`;
```

### Step 3: 타입 체크

```bash
npx tsc --noEmit 2>&1 | head -30
```

### Step 4: 커밋

```bash
git add src/app/api/insights/unified/route.ts
git commit -m "feat: AI 코치 팀 인사이트 - 팀 프롬프트 빌더 추가"
```

---

## Task 5: GPT 2회 병렬 호출 + 저장 + 반환 교체

**Files:**
- Modify: `src/app/api/insights/unified/route.ts` (GPT 호출 ~ 반환 부분)

### Step 1: 기존 `// 6. OpenAI 호출`부터 `generatingUsers.delete(userId)` 반환까지 전체 교체

현재 코드 (줄 299~338) 전체를 다음으로 교체한다:

```typescript
    // 6. GPT 2회 병렬 호출 (캐시 HIT인 경우 해당 호출 스킵)
    const teamFallbackContent = `## 팀 현황 분석\n\n팀 인사이트는 잠시 생성 중이야. 조금 있다가 다시 확인해봐.`;

    const [personalContent, teamContent] = await Promise.all([
      personalHit
        ? Promise.resolve(personalCache!.content)
        : getOpenAI()
            .chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              max_tokens: 1800,
              temperature: 0.7,
            })
            .then((r) => r.choices[0]?.message?.content ?? ""),

      teamHit
        ? Promise.resolve(teamCache!.content)
        : teamAlreadyGenerating
        ? Promise.resolve(teamFallbackContent)
        : teamLogs.length === 0
        ? Promise.resolve(`## 팀 현황 분석\n\n팀 훈련 일지가 아직 없어. 팀원들이 일지를 작성하면 팀 단위 분석을 시작할 수 있어.`)
        : getOpenAI()
            .chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: TEAM_SYSTEM_PROMPT },
                { role: "user", content: teamUserPrompt },
              ],
              max_tokens: 1500,
              temperature: 0.7,
            })
            .then((r) => r.choices[0]?.message?.content ?? ""),
    ]);

    if (!personalContent) {
      return NextResponse.json(
        { error: "AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // 7. 개인 + 팀 병렬 저장
    await Promise.all([
      !personalHit &&
        prisma.aIInsight.upsert({
          where: { userId_dateOnly: { userId, dateOnly } },
          create: { type: "PERSONAL", content: personalContent, userId, dateOnly },
          update: { content: personalContent, createdAt: new Date() },
        }),
      !teamHit &&
        !teamAlreadyGenerating &&
        teamLogs.length > 0 &&
        prisma.aIInsight.upsert({
          where: { teamId_dateOnly: { teamId, dateOnly } },
          create: { type: "TEAM", content: teamContent, teamId, dateOnly },
          update: { content: teamContent, createdAt: new Date() },
        }),
    ].filter(Boolean));

    return NextResponse.json({
      insight: { content: mergeContent(personalContent, teamContent) },
      cached: false,
    });
```

### Step 2: 타입 체크

```bash
npx tsc --noEmit 2>&1 | head -30
```

### Step 3: 커밋

```bash
git add src/app/api/insights/unified/route.ts
git commit -m "feat: AI 코치 팀 인사이트 - GPT 2회 병렬 호출 및 저장"
```

---

## Task 6: finally 블록 + P2002 에러 핸들링

**Files:**
- Modify: `src/app/api/insights/unified/route.ts` (catch/finally 블록)

### Step 1: 현재 catch 블록을 catch + finally로 교체

현재 코드:
```typescript
  } catch (error) {
    if (userId) generatingUsers.delete(userId);
    console.error("인사이트 생성 실패:", error);
    return NextResponse.json(
      { error: "AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
```

교체 후:
```typescript
  } catch (error) {
    // P2002 — 크로스 인스턴스 경쟁으로 팀 캐시 중복 저장 시도
    // 이미 저장된 캐시를 재조회해서 반환
    const prismaError = error as { code?: string };
    if (prismaError.code === "P2002" && userId && session?.user?.teamId) {
      try {
        const now2 = new Date();
        const kst2 = new Date(now2.getTime() + 9 * 60 * 60 * 1000);
        const dateOnly2 = `${kst2.getUTCFullYear()}-${String(kst2.getUTCMonth() + 1).padStart(2, "0")}-${String(kst2.getUTCDate()).padStart(2, "0")}`;
        const [p, t] = await Promise.all([
          prisma.aIInsight.findUnique({ where: { userId_dateOnly: { userId, dateOnly: dateOnly2 } } }),
          prisma.aIInsight.findUnique({ where: { teamId_dateOnly: { teamId: session.user.teamId, dateOnly: dateOnly2 } } }),
        ]);
        if (p && t) {
          return NextResponse.json({
            insight: { content: mergeContent(p.content, t.content) },
            cached: true,
          });
        }
      } catch {
        // 재조회도 실패하면 아래 500 반환으로 fall-through
      }
    }
    console.error("인사이트 생성 실패:", error);
    return NextResponse.json(
      { error: "AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  } finally {
    if (userId) generatingUsers.delete(userId);
    if (session?.user?.teamId) generatingTeams.delete(session.user.teamId);
  }
}
```

**주의**: `session` 변수가 finally 스코프에서 접근 가능하려면 `let session` 선언을 try 블록 밖으로 올려야 한다. `let userId`처럼 `let session: Awaited<ReturnType<typeof getServerSession>> | null = null;`을 함수 최상단에 선언하고 try 블록에서 `session = await getServerSession(authOptions);`로 할당한다.

팀 ID를 finally에서 안전하게 접근하려면 `let teamId: string | undefined;`도 `userId`와 함께 함수 최상단에 선언한다.

### Step 2: `let userId`, `let teamId`, `let session` 함수 상단 선언 확인

함수 시작 부분을 다음과 같이 수정:

```typescript
export async function POST() {
  let userId: string | undefined;
  let teamId: string | undefined;
  let session: Awaited<ReturnType<typeof getServerSession>> | null = null;
  try {
    session = await getServerSession(authOptions);
    // ... 나머지
```

기존 `const teamId = session.user.teamId;` 라인을 `teamId = session.user.teamId;`로 변경 (let → 할당).

### Step 3: 타입 체크

```bash
npx tsc --noEmit 2>&1 | head -30
```

### Step 4: 커밋

```bash
git add src/app/api/insights/unified/route.ts
git commit -m "feat: AI 코치 팀 인사이트 - finally 블록 및 P2002 에러 핸들링"
```

---

## Task 7: 로컬 검증

### Step 1: 개발 서버 기동

```bash
npm run dev
```

### Step 2: AI 인사이트 캐시 초기화 (오늘 기록 삭제)

로컬 DB에서 오늘 날짜의 AIInsight 레코드를 삭제해서 새로 생성되도록 한다:

```bash
npx prisma studio
```

Prisma Studio에서 `AIInsight` 테이블 열고 오늘 날짜(`dateOnly`) 레코드 삭제.

### Step 3: API 직접 호출

브라우저에서 로그인 후 개발자 도구 콘솔에서:

```javascript
const res = await fetch('/api/insights/unified', { method: 'POST' });
const data = await res.json();
console.log(data.insight.content);
console.log('cached:', data.cached);
```

### Step 4: 검증 체크리스트

- [ ] `content`에 `## 나의 코칭 피드백` 섹션 존재
- [ ] `content`에 `## 팀 현황 분석` 섹션 존재
- [ ] 팀 섹션에 한국 이름(홍길동 등)이 없고 FW1, MF2 같은 익명 ID만 있음
- [ ] `cached: false` (첫 호출)
- [ ] 2번째 호출 시 `cached: true`
- [ ] AI 인사이트 모달 UI에서 두 섹션이 올바르게 렌더링됨 (헤더, 구분선)
- [ ] TypeScript 빌드 에러 없음: `npm run build` 통과
