# 팀 운동 목록 카드 UI 개선 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 팀 운동 목록 페이지에서 "정기" 뱃지를 제목 인라인으로 이동하고, "다음 운동" 표시를 카드 외부 핀 레이블로 분리한다.

**Architecture:** `TrainingEventsClient.tsx` 단일 파일 수정. `EventCard` 컴포넌트 내부 뱃지 행을 재구성하고, 예정 운동 렌더링 루프에서 첫 번째 카드 위에 핀 레이블을 추가한다.

**Tech Stack:** Next.js App Router, Tailwind CSS v4, team-* 컬러 변수

---

### Task 1: "정기" 뱃지를 제목 인라인으로 이동

**Files:**
- Modify: `src/app/my/training-events/TrainingEventsClient.tsx:162-164`

현재 `<h3>` 제목은 단순 텍스트. `event.isRegular`일 때 제목 왼쪽에 pill을 붙인다.

**Step 1: `<h3>` 블록을 flex 컨테이너로 교체**

`src/app/my/training-events/TrainingEventsClient.tsx`의 162~164번 줄:

```tsx
// Before
<h3 className={`text-base font-semibold truncate ${event.cancelled ? "text-gray-400" : "text-gray-900"}`}>
  {event.title}
</h3>

// After
<div className="flex items-center gap-1.5 min-w-0">
  {event.isRegular && (
    <span className="shrink-0 px-1.5 py-0.5 bg-team-100 text-team-600 text-[10px] font-semibold rounded">
      정기
    </span>
  )}
  <h3 className={`text-base font-semibold truncate ${event.cancelled ? "text-gray-400" : "text-gray-900"}`}>
    {event.title}
  </h3>
</div>
```

**Step 2: 뱃지 행에서 "정기" 칩 제거**

165~188번 줄 뱃지 행에서 `event.isRegular` 블록 삭제:

```tsx
// Before
{(isNext || event.isRegular || event.isFriendlyMatch || event.cancelled) && (
  <div className="flex items-center gap-1.5 flex-wrap mt-1">
    {isNext && !event.cancelled && (
      <span className="px-2 py-0.5 bg-team-500 text-white text-[10px] font-bold rounded-full whitespace-nowrap">
        다음
      </span>
    )}
    {event.isRegular && (
      <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full whitespace-nowrap">
        정기
      </span>
    )}
    {event.isFriendlyMatch && ( ... )}
    {event.cancelled && ( ... )}
  </div>
)}

// After
{(isNext || event.isFriendlyMatch || event.cancelled) && (
  <div className="flex items-center gap-1.5 flex-wrap mt-1">
    {isNext && !event.cancelled && (
      <span className="px-2 py-0.5 bg-team-500 text-white text-[10px] font-bold rounded-full whitespace-nowrap">
        다음
      </span>
    )}
    {event.isFriendlyMatch && ( ... )}
    {event.cancelled && ( ... )}
  </div>
)}
```

**Step 3: 브라우저에서 시각 확인**

- `정기` 운동 카드: 제목 왼쪽에 `정기` pill이 인라인으로 표시되는지 확인
- 비정기 운동: pill 없이 제목만 표시되는지 확인

**Step 4: Commit**

```bash
git add src/app/my/training-events/TrainingEventsClient.tsx
git commit -m "feat: 정기 뱃지 제목 인라인으로 이동"
```

---

### Task 2: "다음 운동" 칩을 카드 외부 핀 레이블로 분리

**Files:**
- Modify: `src/app/my/training-events/TrainingEventsClient.tsx:110-114` (예정 운동 렌더링 루프)
- Modify: `src/app/my/training-events/TrainingEventsClient.tsx:165-171` (뱃지 행에서 "다음" 칩 제거)

**Step 1: 렌더링 루프에 핀 레이블 추가**

110~114번 줄, 첫 번째 카드(index === 0) 위에 레이블 삽입:

```tsx
// Before
{upcomingEvents.map((event, index) => (
  <div key={event.id} ref={index === 0 ? nextEventRef : undefined}>
    <EventCard event={event} formatDate={formatDate} past={false} isNext={index === 0} />
  </div>
))}

// After
{upcomingEvents.map((event, index) => (
  <div key={event.id} ref={index === 0 ? nextEventRef : undefined}>
    {index === 0 && !event.cancelled && (
      <p className="text-xs font-semibold text-team-500 px-1 mb-1.5">
        📌 다음 운동
      </p>
    )}
    <EventCard event={event} formatDate={formatDate} past={false} isNext={index === 0} />
  </div>
))}
```

**Step 2: 뱃지 행에서 "다음" 칩 제거**

Task 1에서 이미 뱃지 행을 수정했으므로, 이번에는 `isNext` 조건과 "다음" 칩 블록을 삭제:

```tsx
// After (최종)
{(event.isFriendlyMatch || event.cancelled) && (
  <div className="flex items-center gap-1.5 flex-wrap mt-1">
    {event.isFriendlyMatch && (
      <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full whitespace-nowrap">
        친선
      </span>
    )}
    {event.cancelled && (
      <span className="px-2 py-0.5 bg-red-50 text-red-500 text-[10px] font-medium rounded-full whitespace-nowrap">
        취소됨
      </span>
    )}
  </div>
)}
```

`EventCard`의 `isNext` prop은 카드 배경색(`bg-team-50 border border-team-200`)에만 사용되므로 유지.

**Step 3: 브라우저에서 시각 확인**

- 예정된 운동이 1개 이상일 때: 첫 번째 카드 위에 `📌 다음 운동` 레이블 표시
- 첫 번째 카드가 취소된 경우: 핀 레이블 없이 취소 카드 그대로 표시
- 두 번째 이후 예정 카드: 레이블 없음
- 카드 내부 "다음" 칩 완전히 사라졌는지 확인

**Step 4: Commit**

```bash
git add src/app/my/training-events/TrainingEventsClient.tsx
git commit -m "feat: 다음 운동 핀 레이블 외부 분리, 카드 내 다음 칩 제거"
```
