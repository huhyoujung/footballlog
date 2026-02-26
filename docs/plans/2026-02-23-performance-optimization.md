# Performance Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 모든 페이지에서 정보가 빠르게 표시되고, 터치 시 즉각적인 피드백을 제공한다.

**Architecture:**
(1) 이미지: `unoptimized` 제거 → Next.js 자동 WebP 변환·srcset 적용.
(2) HTTP 캐시: 주요 API 응답에 `Cache-Control` 헤더 추가 → 브라우저 캐시 활용으로 반복 방문 시 응답 속도 향상.
(3) 터치: `transition-all` → 구체적인 속성 전환으로 제한, 누락된 `touch-manipulation`·`active:` 피드백 추가.

**Tech Stack:** Next.js 15 App Router, SWR, Tailwind CSS v4, Prisma

---

## Task 1: PolaroidCard 이미지 최적화 (unoptimized 제거)

**Files:**
- Modify: `src/components/PolaroidCard.tsx`

**목표:** 폴라로이드 사진·팀 로고에 WebP 자동 변환 적용. `unoptimized` prop 제거.
`remotePatterns`에 `lh3.googleusercontent.com`과 `dssyfyurslaopejnioqx.supabase.co` 이미 등록됨 → 제거해도 안전.

**Step 1: PolaroidCard.tsx 읽기**

Read `src/components/PolaroidCard.tsx`

**Step 2: 3곳의 `unoptimized` 제거**

- Line 30 (TeamLogoFallback의 팀 로고 `unoptimized`)
- Line 58 (stack variant 훈련 사진 `unoptimized`)
- Line 83 (full variant 훈련 사진 `unoptimized`)

**Step 3: 커밋**

```bash
git add src/components/PolaroidCard.tsx
git commit -m "perf: PolaroidCard 이미지 unoptimized 제거 → WebP 자동 최적화"
```

---

## Task 2: CommentsSection·Feed·BasicInfoTab 이미지 최적화

**Files:**
- Modify: `src/components/training/CommentsSection.tsx`
- Modify: `src/components/Feed.tsx`
- Modify: `src/components/training/BasicInfoTab.tsx`

**Step 1: 3개 파일 읽기**

Read `src/components/training/CommentsSection.tsx`
Read `src/components/Feed.tsx` (line 430-450 확인)
Read `src/components/training/BasicInfoTab.tsx` (line 310-320 확인)

**Step 2: unoptimized 제거**

- CommentsSection.tsx:178 — 유저 아바타 `unoptimized` 제거
- Feed.tsx:442 — 팀 로고 `unoptimized` 제거 (이미 `priority` 있음)
- BasicInfoTab.tsx:316 — 상대팀 로고 `unoptimized` 제거

**Step 3: 커밋**

```bash
git add src/components/training/CommentsSection.tsx src/components/Feed.tsx src/components/training/BasicInfoTab.tsx
git commit -m "perf: CommentsSection·Feed·BasicInfoTab 이미지 unoptimized 제거"
```

---

## Task 3: training-logs API 캐시 헤더 추가

**Files:**
- Modify: `src/app/api/training-logs/route.ts`

**목표:** GET 응답에 `Cache-Control: private, max-age=30, stale-while-revalidate=60` 추가.
브라우저 캐시가 SWR 재검증 요청에 즉시 응답 → 네트워크 레이턴시 제거.

**Step 1: route.ts 읽기**

Read `src/app/api/training-logs/route.ts`

**Step 2: GET 핸들러의 성공 응답에 헤더 추가**

`NextResponse.json(...)` 호출에 두 번째 인자로:
```typescript
{ headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
```

**Step 3: 커밋**

```bash
git add src/app/api/training-logs/route.ts
git commit -m "perf: training-logs API 캐시 헤더 추가 (30s max-age)"
```

---

## Task 4: training-events/next API 캐시 헤더 추가

**Files:**
- Modify: `src/app/api/training-events/next/route.ts`

**목표:** GET 응답에 `private, max-age=60, stale-while-revalidate=120` 추가.

**Step 1: route.ts 읽기**

Read `src/app/api/training-events/next/route.ts`

**Step 2: GET 성공 응답에 헤더 추가**

```typescript
{ headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
```

**Step 3: 커밋**

```bash
git add src/app/api/training-events/next/route.ts
git commit -m "perf: training-events/next API 캐시 헤더 추가 (60s max-age)"
```

---

## Task 5: pom/recent-mvp·locker-notes API 캐시 헤더 추가

**Files:**
- Modify: `src/app/api/pom/recent-mvp/route.ts`
- Modify: `src/app/api/locker-notes/route.ts`

**목표:**
- MVP: `private, max-age=300, stale-while-revalidate=600` (5분 — MVP는 자주 안 바뀜)
- locker-notes: `private, max-age=30, stale-while-revalidate=60`

**Step 1: 두 파일 읽기**

Read `src/app/api/pom/recent-mvp/route.ts`
Read `src/app/api/locker-notes/route.ts`

**Step 2: 각 GET 성공 응답에 헤더 추가**

recent-mvp:
```typescript
{ headers: { "Cache-Control": "private, max-age=300, stale-while-revalidate=600" } }
```

locker-notes:
```typescript
{ headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" } }
```

**Step 3: 커밋**

```bash
git add src/app/api/pom/recent-mvp/route.ts src/app/api/locker-notes/route.ts
git commit -m "perf: pom/recent-mvp·locker-notes API 캐시 헤더 추가"
```

---

## Task 6: PomVoting 터치 반응 개선

**Files:**
- Modify: `src/components/PomVoting.tsx`

**목표:** 투표 버튼들에 `touch-manipulation`·`active:` 상태·구체적인 transition 추가.

현재 문제:
- Player toggle button: `transition-all` (비효율), `touch-manipulation` 없음, `active:` 없음
- Vote tag buttons: `transition-all`, `touch-manipulation` 없음
- Open voting button (line ~331): `touch-manipulation` 없음, `active:` 없음
- Re-vote/view results buttons: `touch-manipulation` 없음, `active:` 없음

**Step 1: PomVoting.tsx 읽기**

Read `src/components/PomVoting.tsx`

**Step 2: 버튼 클래스 수정**

Player toggle button (`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all`):
```
→ "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors touch-manipulation active:scale-[0.98]"
```

Vote tag buttons (`px-2.5 py-1 rounded-full text-xs font-medium transition-all`):
```
→ "px-2.5 py-1 rounded-full text-xs font-medium transition-colors touch-manipulation active:scale-[0.97]"
```

Open voting button (`w-full py-3 bg-team-500 text-white rounded-[14px] font-semibold text-sm`):
```
→ "w-full py-3 bg-team-500 text-white rounded-[14px] font-semibold text-sm transition-colors touch-manipulation active:scale-[0.98]"
```

Re-vote button (`flex-1 py-2 bg-white border border-team-300 text-team-600 rounded-lg text-sm font-medium hover:bg-team-50 transition-colors`):
```
→ "flex-1 py-2 bg-white border border-team-300 text-team-600 rounded-lg text-sm font-medium hover:bg-team-50 transition-colors touch-manipulation active:scale-[0.97]"
```

View results button (`flex-1 py-2 bg-team-500 text-white rounded-lg text-sm font-medium`):
```
→ "flex-1 py-2 bg-team-500 text-white rounded-lg text-sm font-medium transition-colors touch-manipulation active:scale-[0.97]"
```

Submit vote button (`w-full py-3.5 bg-team-500 text-white rounded-[14px] font-semibold text-[15px] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors`):
```
→ 기존 유지 (이미 transition-colors 있음), 단 `touch-manipulation active:scale-[0.98]` 추가
```

**Step 3: 커밋**

```bash
git add src/components/PomVoting.tsx
git commit -m "perf: PomVoting 버튼 touch-manipulation·active 피드백 추가"
```

---

## Task 7: PostItNote·기타 누락된 touch 반응 개선

**Files:**
- Modify: `src/components/PostItNote.tsx`
- Modify: `src/app/my/MyPageClient.tsx` (transition-all 최적화)

**Step 1: 두 파일 읽기**

Read `src/components/PostItNote.tsx`
Read `src/app/my/MyPageClient.tsx` (line 178-190, 295-345)

**Step 2: PostItNote 수정**

`isClickable ? "cursor-pointer" : "cursor-default"` 포함 부분:
```
transition-all → transition-transform
isClickable 일 때: "cursor-pointer touch-manipulation active:scale-[0.97]" 추가
```

구체적으로:
```typescript
className={`relative transition-transform ${isClickable ? "cursor-pointer touch-manipulation active:scale-[0.97]" : "cursor-default"}`}
```

**Step 3: MyPageClient.tsx의 transition-all 최적화**

line 181: `transition-all` → `transition-colors` (block link, 색상만 변함)
line 300: `transition-all` → `transition-[background-color,transform,opacity]` (버튼)

**Step 4: 커밋**

```bash
git add src/components/PostItNote.tsx src/app/my/MyPageClient.tsx
git commit -m "perf: PostItNote touch 피드백·MyPageClient transition 최적화"
```

---

## Task 8: BackButton·Feed FAB transition 최적화

**Files:**
- Modify: `src/components/BackButton.tsx`
- Modify: `src/components/Feed.tsx`

**목표:** `transition-all` → 구체적인 속성으로 제한 → Composite Layer 재계산 최소화

**Step 1: 두 파일 읽기**

Read `src/components/BackButton.tsx`
Read `src/components/Feed.tsx` (line 590-620 확인)

**Step 2: BackButton 수정**

```
transition-all → transition-[background-color,color,transform]
```

**Step 3: Feed FAB 버튼 수정**

FAB 버튼들 (`transition-all`): → `transition-[background-color,transform]`

**Step 4: 커밋**

```bash
git add src/components/BackButton.tsx src/components/Feed.tsx
git commit -m "perf: BackButton·Feed FAB transition-all → 구체적 속성으로 최적화"
```

---

## Task 9: LockerClient 이미지 최적화

**Files:**
- Modify: `src/app/locker/[userId]/LockerClient.tsx`

**목표:** line 783의 `unoptimized` 제거 (락커룸 프로필 이미지)

**Step 1: LockerClient.tsx line 775-795 읽기**

Read `src/app/locker/[userId]/LockerClient.tsx` (offset 775, limit 20)

**Step 2: unoptimized 제거**

**Step 3: 커밋**

```bash
git add src/app/locker/[userId]/LockerClient.tsx
git commit -m "perf: LockerClient 이미지 unoptimized 제거"
```

---

## Task 10: 빌드 검증

**Step 1: TypeScript 타입 에러 확인**

```bash
npm run build
```

Expected: 에러 없이 성공. 만약 에러가 있다면 해당 파일 수정 후 재빌드.

**Step 2: 최종 커밋 (필요 시)**

빌드 오류 수정이 있었다면:
```bash
git add -A
git commit -m "fix: 빌드 오류 수정"
```
