# 슈퍼어드민 대시보드 차트 + GPT 사용량 탭 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 슈퍼어드민 대시보드에 Recharts 기반 데이터 시각화 차트를 추가하고, GPT API 토큰/비용을 추적하는 "AI 사용량" 탭을 신설한다.

**Architecture:** AIInsight 테이블에 토큰 필드를 추가해 OpenAI 응답의 usage 데이터를 저장한다. 어드민 page.tsx에서 추가 쿼리로 날짜별 집계 데이터를 수집하고, 공통 AdminChart 컴포넌트(dynamic import)를 통해 각 탭에 BarChart를 렌더링한다.

**Tech Stack:** Next.js App Router, Prisma, Recharts, Tailwind CSS v4

---

## 참고 파일

- 설계 문서: `docs/plans/2026-02-27-admin-dashboard-charts-design.md`
- 어드민 페이지: `src/app/admin/[secret]/page.tsx`
- 탭 컴포넌트: `src/app/admin/[secret]/DashboardTabs.tsx`
- OpenAI route: `src/app/api/insights/unified/route.ts`
- Prisma schema: `prisma/schema.prisma`

---

### Task 1: Recharts 설치

**Files:**
- Modify: `package.json` (자동)

**Step 1: 패키지 설치**

```bash
npm install recharts
```

**Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 빌드 성공 (Recharts는 타입 정의 내장)

**Step 3: 커밋**

```bash
git add package.json package-lock.json
git commit -m "chore: recharts 설치"
```

---

### Task 2: AIInsight DB 스키마 변경 + 마이그레이션

**Files:**
- Modify: `prisma/schema.prisma`

**Step 1: schema.prisma 수정**

`prisma/schema.prisma`의 `AIInsight` 모델에 아래 3개 필드를 `createdAt` 바로 아래에 추가:

```prisma
model AIInsight {
  id        String      @id @default(cuid())
  type      InsightType
  content   String
  userId    String?
  teamId    String?
  dateOnly  String
  createdAt DateTime    @default(now())
  // 추가
  promptTokens     Int?
  completionTokens Int?
  model            String?
  team      Team?       @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user      User?       @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, dateOnly])
  @@unique([teamId, dateOnly])
  @@index([userId, createdAt(sort: Desc)])
  @@index([teamId, createdAt(sort: Desc)])
}
```

**Step 2: 마이그레이션 생성 및 적용**

```bash
npx prisma migrate dev --name add-ai-insight-token-fields
```

Expected: `prisma/migrations/..._add_ai_insight_token_fields/migration.sql` 생성됨

**Step 3: Prisma 클라이언트 재생성 확인**

```bash
npx prisma generate
```

**Step 4: 빌드 확인**

```bash
npm run build
```

**Step 5: 커밋**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: AIInsight에 토큰 사용량 필드 추가 (promptTokens, completionTokens, model)"
```

---

### Task 3: route.ts에 토큰 저장 로직 추가

**Files:**
- Modify: `src/app/api/insights/unified/route.ts` (약 320-333번째 줄, upsert 부분)

**Step 1: upsert create/update에 토큰 필드 추가**

현재 코드:
```ts
const saved = await prisma.aIInsight.upsert({
  where: { userId_dateOnly: { userId, dateOnly } },
  create: {
    type: "PERSONAL",
    content,
    userId,
    dateOnly,
  },
  update: {
    content,
    createdAt: new Date(),
  },
});
```

변경 후:
```ts
const saved = await prisma.aIInsight.upsert({
  where: { userId_dateOnly: { userId, dateOnly } },
  create: {
    type: "PERSONAL",
    content,
    userId,
    dateOnly,
    promptTokens: completion.usage?.prompt_tokens ?? null,
    completionTokens: completion.usage?.completion_tokens ?? null,
    model: completion.model ?? "gpt-4o-mini",
  },
  update: {
    content,
    createdAt: new Date(),
    promptTokens: completion.usage?.prompt_tokens ?? null,
    completionTokens: completion.usage?.completion_tokens ?? null,
  },
});
```

**Step 2: 빌드 확인**

```bash
npm run build
```

Expected: TypeScript 타입 에러 없음 (completion.usage는 CompletionUsage | undefined 타입)

**Step 3: 커밋**

```bash
git add src/app/api/insights/unified/route.ts
git commit -m "feat: AI 코치 인사이트 생성 시 OpenAI 토큰 사용량 저장"
```

---

### Task 4: AdminChart 공통 컴포넌트 생성

**Files:**
- Create: `src/app/admin/[secret]/AdminChart.tsx`

**Step 1: 컴포넌트 작성**

```tsx
"use client";

import dynamic from "next/dynamic";
import {
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

// SSR 비활성화 (Recharts는 브라우저 전용)
const BarChart = dynamic(
  () => import("recharts").then((m) => m.BarChart),
  { ssr: false }
);

interface DataPoint {
  label: string;
  value: number;
}

interface Props {
  data: DataPoint[];
  unit?: string;       // Y축 단위 표시용 (예: "명", "$")
  color?: string;      // 막대 색상 (기본: #6366f1)
  height?: number;     // 차트 높이 (기본: 200)
  valueFormatter?: (v: number) => string; // 툴팁 값 포맷
}

export default function AdminChart({
  data,
  unit = "",
  color = "#6366f1",
  height = 200,
  valueFormatter,
}: Props) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-gray-400 text-sm"
        style={{ height }}
      >
        데이터 없음
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "#9ca3af" }}
          axisLine={false}
          tickLine={false}
          width={36}
          tickFormatter={(v) => (unit === "$" ? `$${v.toFixed(3)}` : String(v))}
        />
        <Tooltip
          formatter={(v: number) =>
            valueFormatter ? valueFormatter(v) : `${v}${unit}`
          }
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid #e5e7eb",
          }}
        />
        <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Step 2: 빌드 확인**

```bash
npm run build
```

**Step 3: 커밋**

```bash
git add "src/app/admin/[secret]/AdminChart.tsx"
git commit -m "feat: 어드민 공통 BarChart 컴포넌트 추가"
```

---

### Task 5: 개요 탭 — 7일 신규 가입자 차트 추가

**Files:**
- Modify: `src/app/admin/[secret]/page.tsx`

**Step 1: 신규 가입자 7일 쿼리 추가**

`page.tsx`의 `Promise.all` 배열에 새 쿼리 추가 (기존 `recentFeedbacks` 다음):

```ts
// 기존 10개 쿼리 이후에 추가
prisma.$queryRaw<{ date: string; count: number }[]>`
  SELECT DATE("createdAt") as date, COUNT(*)::int as count
  FROM "User"
  WHERE "createdAt" >= ${sevenDaysAgo}
  GROUP BY DATE("createdAt")
`,
```

destructuring에도 추가:
```ts
const [
  totalUsers,
  todaySignups,
  noTeamCount,
  totalTeams,
  dauSessions,
  recentUsers,
  teamsWithStats,
  recentLogs,
  inactiveUsers,
  recentFeedbacks,
  recentSignups,  // 추가
] = await Promise.all([...]);
```

**Step 2: 7일 신규 가입자 집계 (logsByDate 패턴과 동일하게)**

`logsByDate` 집계 코드 바로 아래에 추가:

```ts
const signupsByDate: Record<string, number> = {};
for (let i = 6; i >= 0; i--) {
  const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
  signupsByDate[d.toISOString().split("T")[0]] = 0;
}
recentSignups.forEach((row) => {
  const dateKey = String(row.date);
  if (dateKey in signupsByDate) signupsByDate[dateKey] = row.count;
});
```

**Step 3: 개요 탭 JSX에 차트 추가**

`overview` 변수의 기존 "최근 7일 훈련 로그" Section 위에 차트를 추가. import 없이 AdminChart는 동적 컴포넌트이므로 page.tsx 상단에 import 추가:

```ts
import AdminChart from "./AdminChart";
```

그리고 `overview` JSX 수정:

```tsx
const overview = (
  <>
    {/* 요약 카드 — 기존 그대로 */}
    <section>...</section>

    {/* 7일 신규 가입자 차트 — 추가 */}
    <Section title="최근 7일 신규 가입자">
      <div className="p-4">
        <AdminChart
          data={Object.entries(signupsByDate).map(([date, count]) => ({
            label: date.slice(5), // "MM-DD" 형태
            value: count,
          }))}
          unit="명"
          color="#10b981"
        />
      </div>
    </Section>

    {/* 7일 훈련 로그 차트 — 기존 테이블 대신 차트로 교체 */}
    <Section title="최근 7일 훈련 로그">
      <div className="p-4">
        <AdminChart
          data={Object.entries(logsByDate).map(([date, count]) => ({
            label: date.slice(5),
            value: count,
          }))}
          unit="개"
          color="#6366f1"
        />
      </div>
    </Section>
  </>
);
```

**Step 4: 빌드 확인**

```bash
npm run build
```

**Step 5: 커밋**

```bash
git add "src/app/admin/[secret]/page.tsx"
git commit -m "feat: 어드민 개요 탭 신규 가입자/훈련 로그 차트 추가"
```

---

### Task 6: 팀 탭 — 팀별 인원 차트 추가

**Files:**
- Modify: `src/app/admin/[secret]/page.tsx`

**Step 1: `teams` JSX에 차트 추가**

기존 `teams` 변수의 Section 안 Table 위에 차트 추가:

```tsx
const teams = (
  <Section title="팀별 인원 현황">
    <div className="p-4 border-b border-gray-100">
      <AdminChart
        data={teamsWithStats.map((t) => ({
          label: t.name.length > 6 ? t.name.slice(0, 6) + "…" : t.name,
          value: t._count.members,
        }))}
        unit="명"
        color="#f59e0b"
        height={180}
      />
    </div>
    <Table
      headers={["팀명", "인원", "최근 훈련"]}
      rows={teamsWithStats.map((t) => [
        t.name,
        String(t._count.members),
        t.trainingEvents[0] ? formatDate(t.trainingEvents[0].date) : "-",
      ])}
    />
  </Section>
);
```

**Step 2: 빌드 확인**

```bash
npm run build
```

**Step 3: 커밋**

```bash
git add "src/app/admin/[secret]/page.tsx"
git commit -m "feat: 어드민 팀 탭 인원 분포 차트 추가"
```

---

### Task 7: 피드백 탭 — 유형별 분포 차트 추가

**Files:**
- Modify: `src/app/admin/[secret]/page.tsx`

**Step 1: 피드백 유형별 집계 계산**

`recentFeedbacks` 집계 코드를 `logsByDate` 집계 바로 아래에 추가:

```ts
const feedbackByType: Record<string, number> = {};
recentFeedbacks.forEach((f) => {
  feedbackByType[f.type] = (feedbackByType[f.type] ?? 0) + 1;
});
```

**Step 2: `feedbacks` JSX에 차트 추가**

```tsx
const feedbacks = (
  <>
    <Section title="피드백 유형별 분포">
      <div className="p-4">
        <AdminChart
          data={Object.entries(feedbackByType).map(([type, count]) => ({
            label: type,
            value: count,
          }))}
          unit="건"
          color="#ec4899"
          height={160}
        />
      </div>
    </Section>
    <Section title="최근 피드백">
      <Table ... /> {/* 기존 그대로 */}
    </Section>
  </>
);
```

**Step 3: 빌드 확인**

```bash
npm run build
```

**Step 4: 커밋**

```bash
git add "src/app/admin/[secret]/page.tsx"
git commit -m "feat: 어드민 피드백 탭 유형별 분포 차트 추가"
```

---

### Task 8: AI 사용량 탭 — 데이터 쿼리 추가

**Files:**
- Modify: `src/app/admin/[secret]/page.tsx`

**Step 1: AI 사용량 쿼리 2개 추가**

`Promise.all` 배열에 추가 (recentSignups 다음):

```ts
// 전체 누적 AI 토큰 집계
prisma.aIInsight.aggregate({
  _sum: { promptTokens: true, completionTokens: true },
  _count: { id: true },
  where: { promptTokens: { not: null } },
}),
// 7일 일별 AI 사용량 집계
prisma.$queryRaw<{ date_only: string; calls: number; prompt: number; completion: number }[]>`
  SELECT "dateOnly" as date_only,
         COUNT(*)::int as calls,
         COALESCE(SUM("promptTokens"), 0)::int as prompt,
         COALESCE(SUM("completionTokens"), 0)::int as completion
  FROM "AIInsight"
  WHERE "promptTokens" IS NOT NULL
    AND "dateOnly" >= ${sevenDaysAgo.toISOString().split("T")[0]}
  GROUP BY "dateOnly"
  ORDER BY "dateOnly"
`,
```

destructuring에 추가:
```ts
const [
  ...기존 11개...,
  recentSignups,
  aiAggregate,   // 추가
  aiDailyUsage,  // 추가
] = await Promise.all([...]);
```

**Step 2: 비용 계산 헬퍼 (page.tsx 하단 formatDate 근처에 추가)**

```ts
// gpt-4o-mini 기준: 입력 $0.15/1M, 출력 $0.60/1M
function calcCost(promptTokens: number, completionTokens: number): number {
  return (promptTokens / 1_000_000) * 0.15 + (completionTokens / 1_000_000) * 0.6;
}
```

**Step 3: 빌드 확인**

```bash
npm run build
```

**Step 4: 커밋**

```bash
git add "src/app/admin/[secret]/page.tsx"
git commit -m "feat: 어드민 AI 사용량 쿼리 추가"
```

---

### Task 9: AI 사용량 탭 — UI 구성

**Files:**
- Modify: `src/app/admin/[secret]/page.tsx`

**Step 1: AI 탭 JSX 추가**

`feedbacks` 변수 선언 바로 아래에 추가:

```tsx
const totalPrompt = aiAggregate._sum.promptTokens ?? 0;
const totalCompletion = aiAggregate._sum.completionTokens ?? 0;
const totalCalls = aiAggregate._count.id;
const totalCost = calcCost(totalPrompt, totalCompletion);

// 7일 날짜 슬롯 초기화 (데이터 없는 날도 0으로 표시)
const aiByDate: Record<string, { calls: number; prompt: number; completion: number }> = {};
for (let i = 6; i >= 0; i--) {
  const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
  aiByDate[d.toISOString().split("T")[0]] = { calls: 0, prompt: 0, completion: 0 };
}
aiDailyUsage.forEach((row) => {
  if (row.date_only in aiByDate) {
    aiByDate[row.date_only] = {
      calls: row.calls,
      prompt: row.prompt,
      completion: row.completion,
    };
  }
});

const aiUsage = (
  <>
    {/* 요약 카드 */}
    <section>
      <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">GPT API 사용량 요약</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "총 호출 수", value: `${totalCalls}회` },
          { label: "총 입력 토큰", value: totalPrompt.toLocaleString() },
          { label: "총 출력 토큰", value: totalCompletion.toLocaleString() },
          { label: "누적 비용", value: `$${totalCost.toFixed(4)}` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl p-4 shadow-sm text-center">
            <div className="text-2xl font-bold text-gray-900">{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>
    </section>

    {/* 7일 비용 추이 차트 */}
    <Section title="최근 7일 일별 비용">
      <div className="p-4">
        <AdminChart
          data={Object.entries(aiByDate).map(([date, d]) => ({
            label: date.slice(5),
            value: parseFloat(calcCost(d.prompt, d.completion).toFixed(5)),
          }))}
          unit="$"
          color="#f97316"
          valueFormatter={(v) => `$${v.toFixed(5)}`}
        />
      </div>
    </Section>

    {/* 7일 일별 상세 테이블 */}
    <Section title="최근 7일 상세">
      <Table
        headers={["날짜", "호출 수", "입력 토큰", "출력 토큰", "비용"]}
        rows={Object.entries(aiByDate).map(([date, d]) => [
          date,
          `${d.calls}회`,
          d.prompt.toLocaleString(),
          d.completion.toLocaleString(),
          `$${calcCost(d.prompt, d.completion).toFixed(5)}`,
        ])}
      />
    </Section>
  </>
);
```

**Step 2: 빌드 확인**

```bash
npm run build
```

**Step 3: 커밋**

```bash
git add "src/app/admin/[secret]/page.tsx"
git commit -m "feat: 어드민 AI 사용량 탭 UI 추가"
```

---

### Task 10: DashboardTabs에 AI 사용량 탭 연결

**Files:**
- Modify: `src/app/admin/[secret]/DashboardTabs.tsx`
- Modify: `src/app/admin/[secret]/page.tsx`

**Step 1: DashboardTabs.tsx 수정**

```tsx
"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const TABS = ["개요", "유저", "팀", "피드백", "AI 사용량"] as const; // "AI 사용량" 추가
type Tab = (typeof TABS)[number];

interface Props {
  overview: ReactNode;
  users: ReactNode;
  teams: ReactNode;
  feedbacks: ReactNode;
  aiUsage: ReactNode; // 추가
}

export default function DashboardTabs({ overview, users, teams, feedbacks, aiUsage }: Props) {
  const [active, setActive] = useState<Tab>("개요");

  const content: Record<Tab, ReactNode> = {
    개요: overview,
    유저: users,
    팀: teams,
    피드백: feedbacks,
    "AI 사용량": aiUsage, // 추가
  };

  return (
    <div>
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              active === tab
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="space-y-8">{content[active]}</div>
    </div>
  );
}
```

**Step 2: page.tsx의 DashboardTabs 호출에 aiUsage prop 추가**

```tsx
<DashboardTabs
  overview={overview}
  users={users}
  teams={teams}
  feedbacks={feedbacks}
  aiUsage={aiUsage}  // 추가
/>
```

**Step 3: 빌드 확인**

```bash
npm run build
```

Expected: TypeScript 에러 없음, 빌드 성공

**Step 4: 최종 커밋**

```bash
git add "src/app/admin/[secret]/DashboardTabs.tsx" "src/app/admin/[secret]/page.tsx"
git commit -m "feat: 어드민 대시보드 AI 사용량 탭 연결 완료"
```

---

## 완료 기준

- [ ] `npm run build` 성공
- [ ] `/admin/[secret]` 접근 시 5개 탭 표시 (개요/유저/팀/피드백/AI 사용량)
- [ ] 개요 탭: 신규 가입자 + 훈련 로그 bar chart 렌더링
- [ ] 팀 탭: 팀별 인원 bar chart 렌더링
- [ ] 피드백 탭: 유형별 분포 bar chart 렌더링
- [ ] AI 사용량 탭: 요약 카드 4개 + 비용 차트 + 상세 테이블 렌더링
- [ ] AI 코치 호출 후 `AIInsight.promptTokens` 저장 확인 (Prisma Studio로 확인 가능)
