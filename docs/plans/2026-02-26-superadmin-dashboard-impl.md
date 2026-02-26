# 슈퍼어드민 대시보드 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 앱 오너 전용 읽기 전용 대시보드 — 유저/팀/활동 지표를 한눈에 파악할 수 있는 `/admin/[secret]` 페이지 구현

**Architecture:** 서버 컴포넌트(SSR)로 Prisma 직접 조회. 별도 API 없음. 시크릿 URL + 이메일 이중 접근 제어. 404로 존재를 숨김.

**Tech Stack:** Next.js App Router (Server Component), Prisma, Tailwind CSS v4

---

### Task 1: 환경변수 추가

**Files:**
- Modify: `.env.example`
- Modify: `.env.local` (직접 수동으로 값 설정 필요)

**Step 1: `.env.example`에 새 변수 추가**

```
# Super Admin Dashboard
ADMIN_SECRET="your-random-secret-token"
SUPER_ADMIN_EMAIL="your-email@gmail.com"
```

`.env.example` 파일 하단에 위 두 줄 추가.

**Step 2: `.env.local`에 실제 값 설정 (수동)**

`.env.local` 파일에 직접 추가:
```
ADMIN_SECRET=원하는_랜덤문자열  # 예: fl-admin-2026-xk9m
SUPER_ADMIN_EMAIL=gjdbwjd805@gmail.com
```

> Vercel 대시보드에도 동일하게 추가해야 프로덕션에서 동작함.

**Step 3: Commit**

```bash
git add .env.example
git commit -m "chore: 슈퍼어드민 환경변수 예시 추가"
```

---

### Task 2: 어드민 페이지 라우트 생성

**Files:**
- Create: `src/app/admin/[secret]/page.tsx`

**Step 1: 디렉토리 및 파일 생성**

`src/app/admin/[secret]/page.tsx`:

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

interface Props {
  params: Promise<{ secret: string }>;
}

export default async function SuperAdminPage({ params }: Props) {
  const { secret } = await params;

  // 접근 제어: URL 시크릿 + 이메일 이중 확인
  if (secret !== process.env.ADMIN_SECRET) return notFound();

  const session = await getServerSession(authOptions);
  if (session?.user?.email !== process.env.SUPER_ADMIN_EMAIL) return notFound();

  // --- 데이터 조회 ---
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    todaySignups,
    noTeamUsers,
    totalTeams,
    dau,
    recentUsers,
    teamsWithMembers,
    recentLogs,
    inactiveUsers,
    recentFeedbacks,
  ] = await Promise.all([
    // 총 유저 수
    prisma.user.count(),

    // 오늘 가입자
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),

    // 팀 없는 유저 (미가입자)
    prisma.user.count({ where: { teamId: null } }),

    // 총 팀 수
    prisma.team.count(),

    // DAU: 오늘 세션 있는 유저 수 (중복 제거)
    prisma.session
      .findMany({
        where: { expires: { gte: todayStart } },
        select: { userId: true },
        distinct: ["userId"],
      })
      .then((s) => s.length),

    // 최근 가입자 20명
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        team: { select: { name: true } },
      },
    }),

    // 팀별 인원 + 최근 로그
    prisma.team.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
        trainingEvents: {
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),

    // 최근 7일 날짜별 훈련 로그 수
    prisma.trainingLog.groupBy({
      by: ["createdAt"],
      where: { createdAt: { gte: sevenDaysAgo } },
      _count: true,
    }),

    // 활동 없는 유저: 가입 7일 이상 + 로그 0개
    prisma.user.findMany({
      where: {
        createdAt: { lte: sevenDaysAgo },
        trainingLogs: { none: {} },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        team: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    }),

    // 최근 피드백 20개
    prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        userName: true,
        userEmail: true,
        createdAt: true,
        status: true,
      },
    }),
  ]);

  // 날짜별 로그 집계 (groupBy createdAt은 exact datetime이므로 날짜로 묶기)
  const logsByDate: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    logsByDate[d.toISOString().split("T")[0]] = 0;
  }
  recentLogs.forEach((log) => {
    const dateKey = new Date(log.createdAt).toISOString().split("T")[0];
    if (dateKey in logsByDate) logsByDate[dateKey] += log._count;
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        <h1 className="text-2xl font-bold text-gray-900">슈퍼어드민 대시보드</h1>

        {/* 요약 카드 */}
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">현황 요약</h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: "총 유저", value: totalUsers },
              { label: "오늘 가입", value: todaySignups },
              { label: "미가입자", value: noTeamUsers },
              { label: "총 팀", value: totalTeams },
              { label: "DAU", value: dau },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white rounded-xl p-4 shadow-sm text-center">
                <div className="text-2xl font-bold text-gray-900">{value}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </section>

        {/* 최근 가입자 */}
        <Section title="최근 가입자">
          <Table
            headers={["이름", "이메일", "가입일", "소속팀"]}
            rows={recentUsers.map((u) => [
              u.name ?? "-",
              u.email ?? "-",
              formatDate(u.createdAt),
              u.team?.name ?? "미가입",
            ])}
          />
        </Section>

        {/* 팀별 인원 */}
        <Section title="팀별 인원 현황">
          <Table
            headers={["팀명", "인원", "최근 훈련"]}
            rows={teamsWithMembers.map((t) => [
              t.name,
              String(t._count.members),
              t.trainingEvents[0] ? formatDate(t.trainingEvents[0].date) : "-",
            ])}
          />
        </Section>

        {/* 최근 7일 훈련 로그 */}
        <Section title="최근 7일 훈련 로그">
          <Table
            headers={["날짜", "로그 수"]}
            rows={Object.entries(logsByDate).map(([date, count]) => [date, String(count)])}
          />
        </Section>

        {/* 활동 없는 유저 */}
        <Section title={`활동 없는 유저 (가입 7일+ & 로그 0개) — ${inactiveUsers.length}명`}>
          <Table
            headers={["이름", "이메일", "가입일", "소속팀"]}
            rows={inactiveUsers.map((u) => [
              u.name ?? "-",
              u.email ?? "-",
              formatDate(u.createdAt),
              u.team?.name ?? "미가입",
            ])}
          />
        </Section>

        {/* 최근 피드백 */}
        <Section title="최근 피드백">
          <Table
            headers={["유형", "제목", "내용", "작성자", "날짜", "상태"]}
            rows={recentFeedbacks.map((f) => [
              f.type,
              f.title,
              f.content.slice(0, 50) + (f.content.length > 50 ? "…" : ""),
              f.userName ?? f.userEmail ?? "-",
              formatDate(f.createdAt),
              f.status,
            ])}
          />
        </Section>
      </div>
    </div>
  );
}

// --- 유틸 컴포넌트 ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-500 uppercase mb-3">{title}</h2>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">{children}</div>
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-4 text-center text-gray-400">
                데이터 없음
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
```

**Step 2: 빌드 확인**

```bash
npm run build
```

TypeScript 에러가 없어야 함. `trainingEvents` 관계명이 Team 모델에 없을 경우 아래 확인:

```bash
grep -A 30 "^model Team {" prisma/schema.prisma
```

실제 관계 필드명으로 수정할 것.

**Step 3: 로컬 테스트**

1. `npm run dev` 실행
2. 브라우저에서 `http://localhost:3000/admin/잘못된시크릿` → 404 확인
3. `http://localhost:3000/admin/[.env.local의 ADMIN_SECRET 값]` 접속
4. 로그인 안 된 상태 → 404 확인
5. `gjdbwjd805@gmail.com`으로 로그인 후 접속 → 대시보드 확인
6. 다른 계정으로 로그인 후 접속 → 404 확인

**Step 4: Commit**

```bash
git add src/app/admin/[secret]/page.tsx
git commit -m "feat: 슈퍼어드민 대시보드 페이지 추가 (/admin/[secret])"
```

---

### Task 3: Vercel 환경변수 설정 (배포 시)

> 배포 전 수동 작업 — 코드 변경 없음.

Vercel 대시보드 → Project Settings → Environment Variables에 추가:

| Key | Value | Environment |
|-----|-------|-------------|
| `ADMIN_SECRET` | `.env.local`에 설정한 값과 동일 | Production, Preview |
| `SUPER_ADMIN_EMAIL` | `gjdbwjd805@gmail.com` | Production, Preview |

---

## 주의사항

- `ADMIN_SECRET` 값은 `.env.local`에만 있고 Git에 커밋되지 않음
- `trainingEvents` 관계명은 `prisma/schema.prisma`의 Team 모델 실제 필드명으로 확인 후 사용
- DAU는 NextAuth Session 테이블의 `expires` 기준으로 오늘 만료되지 않은 세션 수로 근사치 계산
