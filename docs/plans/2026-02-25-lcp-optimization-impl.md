# LCP 최적화 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 피드 및 전체 페이지 LCP 개선 — 폰트 워터폴 제거, 이미지 도메인 preconnect, 훈련 로그 서버 프리페치, LCP 이미지 priority 추가.

**Architecture:**
(1) `layout.tsx` — `<head>`에 preconnect + 폰트 stylesheet `<link>` 추가, `globals.css` @import 제거.
(2) `page.tsx` — 훈련 로그를 이벤트 프리페치와 병렬로 Prisma 직접 조회, SWR fallback 주입.
(3) PolaroidCard/Stack/DateGroup/Feed — 첫 번째 스택의 이미지에 `priority` prop 전달 (4단계 drilling).

**Tech Stack:** Next.js 15 App Router, Prisma, SWR, Tailwind CSS v4

---

## Task 1: 베이스라인 LCP 측정

**목적:** 개선 전 점수 기록. 개선 후 비교용.

**Step 1: Lighthouse CLI 실행**

```bash
npx lighthouse https://[your-vercel-domain].vercel.app --output=html --view --only-categories=performance
```

또는 Chrome DevTools → Lighthouse 탭 → Mode: Navigation, Device: Mobile → Analyze.

**Step 2: 기록**

- LCP 점수 (숫자)
- LCP 요소 (어떤 DOM 요소인지)
- FCP 점수

**Step 3: 커밋 없음** (측정만)

---

## Task 2: preconnect + 폰트 로딩 최적화

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**현재 문제:** `globals.css` 1번째 줄에 `@import url("https://cdn.jsdelivr.net/...")` 존재.
브라우저가 CSS를 먼저 다운로드한 후 @import를 발견 → 추가 네트워크 요청 (직렬 3단계 워터폴).

**Step 1: `src/app/layout.tsx` 읽기**

Read `src/app/layout.tsx`

**Step 2: `<html>` 반환 구문에 `<head>` 태그 추가**

현재:
```tsx
return (
  <html lang="ko" style={cssVars as React.CSSProperties}>
    <body ...>
```

변경 후:
```tsx
return (
  <html lang="ko" style={cssVars as React.CSSProperties}>
    <head>
      {/* Pretendard 폰트: @import(직렬) → <link>(HTML 파싱과 병렬 로딩) */}
      <link rel="preconnect" href="https://cdn.jsdelivr.net" />
      <link
        rel="stylesheet"
        href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
      />
      {/* 훈련 이미지 / 프로필 사진 도메인 preconnect (DNS+TLS 미리 맺기) */}
      <link rel="preconnect" href="https://dssyfyurslaopejnioqx.supabase.co" />
      <link rel="preconnect" href="https://lh3.googleusercontent.com" />
    </head>
    <body ...>
```

**Step 3: `src/app/globals.css` 1번째 줄 제거**

제거 대상 (파일 첫 줄):
```css
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css");
```

삭제 후 파일은 `@import "tailwindcss";`로 시작해야 함.

**Step 4: 커밋**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "perf: 폰트 @import → <link> 변경, 이미지 도메인 preconnect 추가"
```

---

## Task 3: 훈련 로그 서버 프리페치

**Files:**
- Modify: `src/app/page.tsx`

**현재 문제:** 훈련 로그는 클라이언트 하이드레이션 후 SWR이 `/api/training-logs?limit=20`를 호출.
이미지 로딩이 HTML 수신 후 ~500ms-2s 지연됨.

**개선:** 이벤트 프리페치와 동일하게 서버에서 Prisma 직접 조회, SWR fallback에 주입.

**Step 1: `src/app/page.tsx` 읽기**

Read `src/app/page.tsx`

**Step 2: 훈련 로그 Prisma 조회 추가**

현재 코드:
```typescript
// 캐시 히트 ~10ms / 미스 ~100-200ms
const teamEvents = await getTeamUpcomingEvents(teamId);
const eventIds = teamEvents.map((e) => e.id);

// 유저별 RSVP + CheckIn: 행 수가 적어 병렬 조회해도 ~20-50ms
const [rsvpRows, checkInRows] = ...
```

변경 후:
```typescript
// 훈련 로그 서버 프리페치 — 이벤트 조회와 병렬 실행 (독립적)
const [teamEvents, [prefetchedLogs, totalLogs]] = await Promise.all([
  getTeamUpcomingEvents(teamId),
  Promise.all([
    prisma.trainingLog.findMany({
      where: { user: { teamId } },
      include: {
        user: {
          select: { id: true, name: true, image: true, position: true, number: true },
        },
        trainingEvent: {
          select: { id: true, title: true, date: true },
        },
        _count: { select: { comments: true, likes: true } },
        likes: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.trainingLog.count({ where: { user: { teamId } } }),
  ]),
]);

const eventIds = teamEvents.map((e) => e.id);

// 유저별 RSVP + CheckIn: 행 수가 적어 병렬 조회해도 ~20-50ms
const [rsvpRows, checkInRows] = ...
```

**Step 3: fallback에 훈련 로그 추가**

현재 `fallback` 구성 부분 (이벤트 fallback 주입 아래):
```typescript
const fallback: Record<string, unknown> = {};

fallback["/api/training-events/next"] = JSON.parse(
  JSON.stringify({ events: teamEvents.map((event) => ({ ...event, ... })) })
);
```

여기에 추가:
```typescript
// 훈련 로그 SWR fallback — 클라이언트 데이터 페치 없이 즉시 이미지 로딩 가능
fallback["/api/training-logs?limit=20"] = JSON.parse(
  JSON.stringify({
    logs: prefetchedLogs.map((log) => ({
      ...log,
      isLiked: log.likes.length > 0,
      likes: undefined, // 클라이언트에 원시 likes 배열 노출 불필요
    })),
    pagination: {
      page: 1,
      limit: 20,
      total: totalLogs,
      totalPages: Math.ceil(totalLogs / 20),
    },
  })
);
```

**Step 4: 커밋**

```bash
git add src/app/page.tsx
git commit -m "perf: 훈련 로그 서버 프리페치 — SWR fallback 주입으로 LCP 워터폴 제거"
```

---

## Task 4: LCP 이미지에 priority prop 전달

**Files:**
- Modify: `src/components/PolaroidCard.tsx`
- Modify: `src/components/PolaroidStack.tsx`
- Modify: `src/components/PolaroidDateGroup.tsx`
- Modify: `src/components/Feed.tsx`

**목표:** 피드 첫 번째 날짜 그룹의 스택 카드 이미지에 `priority={true}` 추가 (브라우저가 조기 프리로드).

### Step 1: PolaroidCard.tsx 수정

Read `src/components/PolaroidCard.tsx`

`Props` 인터페이스에 `priority?: boolean` 추가:
```typescript
interface Props {
  log: TrainingLog;
  variant: "stack" | "full";
  onLikeToggle?: (logId: string) => void;
  priority?: boolean; // 추가
}
```

함수 시그니처 업데이트:
```typescript
export default function PolaroidCard({ log, variant, onLikeToggle, priority }: Props) {
```

stack variant의 Image에 `priority` 전달 (현재 약 line 51):
```tsx
<Image
  src={log.imageUrl}
  alt=""
  fill
  className="object-cover"
  sizes="144px"
  priority={priority}   // 추가
/>
```

**Step 2: PolaroidStack.tsx 수정**

Read `src/components/PolaroidStack.tsx` (line 38-50 확인)

`Props` 인터페이스에 `prioritizeFirst?: boolean` 추가:
```typescript
interface Props {
  ...
  prioritizeFirst?: boolean; // 추가 — 첫 번째 스택의 이미지에 priority 전달
}
```

함수 시그니처 업데이트:
```typescript
export default function PolaroidStack({ ..., prioritizeFirst }: Props) {
```

`visibleLogs`를 렌더링하는 부분에서 `PolaroidCard`에 `priority` 전달:
현재 PolaroidStack의 visibleLogs.map에서 PolaroidCard를 렌더링하는 부분을 찾아,
`prioritizeFirst`가 true이면 모든 visibleLogs에 priority 전달 (최대 3개 카드, 첫 그룹에만 적용):

```tsx
<PolaroidCard
  key={log.id}
  log={log}
  variant="stack"
  priority={prioritizeFirst} // 추가
/>
```

**Step 3: PolaroidDateGroup.tsx 수정**

Read `src/components/PolaroidDateGroup.tsx`

`Props` 인터페이스에 `prioritizeFirst?: boolean` 추가:
```typescript
interface Props {
  ...
  prioritizeFirst?: boolean;
}
```

함수 시그니처 업데이트:
```typescript
export default function PolaroidDateGroup({ ..., prioritizeFirst }: Props) {
```

PolaroidStack에 전달:
```tsx
<PolaroidStack
  ...
  prioritizeFirst={prioritizeFirst}   // 추가
/>
```

**Step 4: Feed.tsx 수정**

Read `src/components/Feed.tsx` (line 515-540 확인)

`groupedLogs.map`에서 첫 번째 그룹 판별 후 `prioritizeFirst` 전달:
```tsx
{groupedLogs.map((group, index) => {   // index 추가
  const isThisExpanded = expandedDate === group.displayDate;
  if (expandedDate && !isThisExpanded) return null;

  return (
    <div key={group.displayDate}>
      <PolaroidDateGroup
        ...
        prioritizeFirst={index === 0}   // 추가 — 첫 번째 그룹만 priority
      />
    </div>
  );
})}
```

**Step 5: 커밋**

```bash
git add src/components/PolaroidCard.tsx src/components/PolaroidStack.tsx src/components/PolaroidDateGroup.tsx src/components/Feed.tsx
git commit -m "perf: 첫 번째 폴라로이드 스택 이미지에 priority 추가 — LCP 이미지 조기 프리로드"
```

---

## Task 5: 빌드 검증

**Step 1: TypeScript 타입 에러 확인**

```bash
npm run build
```

Expected: 에러 없이 성공. 만약 에러가 있다면:
- `likes: undefined` 관련 타입 에러 → `JSON.parse(JSON.stringify(...))` 직렬화로 undefined가 제거되므로 타입 명시 필요 없음
- `prioritizeFirst` 타입 에러 → Props 인터페이스 누락 확인

**Step 2: 빌드 에러 수정 (있을 경우)**

```bash
git add -u
git commit -m "fix: LCP 최적화 빌드 에러 수정"
```

---

## Task 6: 재측정 및 결과 비교

**Step 1: Lighthouse 재실행**

변경사항을 Vercel에 배포한 후:
```bash
npx lighthouse https://[your-vercel-domain].vercel.app --output=html --view --only-categories=performance
```

**Step 2: 결과 비교**

| 지표 | 개선 전 | 개선 후 |
|------|---------|---------|
| LCP  | ?s      | ?s      |
| FCP  | ?s      | ?s      |
| Performance Score | ? | ? |

**Step 3: 커밋 없음** (측정만)
