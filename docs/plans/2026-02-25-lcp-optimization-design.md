# LCP 최적화 설계 문서

> **날짜**: 2026-02-25
> **목표**: 피드(홈) 및 전체 페이지 LCP 개선

---

## 배경

Lighthouse / Chrome DevTools로 측정(측정 전 베이스라인 확보). 측정 방법:

```bash
npx lighthouse https://[your-domain].vercel.app --output=html --view --only-categories=performance
```

또는 Chrome DevTools → Performance Insights 탭 (모바일 에뮬레이션).

---

## 현재 LCP 문제점

1. **CSS @import 폰트 워터폴**: `globals.css`에서 `@import url(cdn.jsdelivr.net/...)`
   → CSS 파일 다운로드 → 브라우저가 @import 발견 → 폰트 CSS 다운로드 → 실제 폰트 파일 다운로드 (3단계 직렬)

2. **이미지 도메인 preconnect 없음**: Supabase, Google 이미지 도메인에 DNS/TLS 핸드셰이크 지연

3. **훈련 로그 클라이언트 페치 워터폴** (가장 큰 문제):
   ```
   HTML 수신 → 하이드레이션 → SWR /api/training-logs 호출 →
   응답 도착 → 이미지 src 설정 → 이미지 다운로드 → LCP
   ```
   훈련 이벤트는 서버에서 프리페치하지만, 훈련 로그는 클라이언트에서 지연 페치됨.

4. **LCP 이미지에 priority 없음**: 첫 폴라로이드 카드 이미지가 지연 로딩으로 처리됨.

---

## 설계

### Phase 1: 측정 (베이스라인)

Lighthouse를 통해 LCP 요소와 점수를 기록. 개선 전후 비교용.

### Phase 2: preconnect + 폰트 최적화

**파일**: `src/app/layout.tsx`, `src/app/globals.css`

`layout.tsx` `<html>` 반환 직전에 `<head>` 태그 추가:

```tsx
<html lang="ko" style={cssVars as React.CSSProperties}>
  <head>
    {/* Pretendard 폰트: @import(직렬) → <link>(병렬 로딩) */}
    <link rel="preconnect" href="https://cdn.jsdelivr.net" />
    <link
      rel="stylesheet"
      href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
    />
    {/* 이미지 도메인 preconnect */}
    <link rel="preconnect" href="https://dssyfyurslaopejnioqx.supabase.co" />
    <link rel="preconnect" href="https://lh3.googleusercontent.com" />
  </head>
  <body>...</body>
</html>
```

`globals.css`에서 아래 줄 제거:
```css
@import url("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css");
```

### Phase 3: 훈련 로그 서버 프리페치

**파일**: `src/app/page.tsx`, `src/app/FeedClient.tsx`

훈련 이벤트와 동일하게 `page.tsx`에서 Prisma를 직접 조회해 SWR fallback 주입.
likes는 유저별이라 캐시 불가 → `unstable_cache` 없이 직접 조회.

```typescript
// page.tsx — 기존 이벤트 프리페치와 병렬로 실행
const [teamEvents, logsResult] = await Promise.all([
  getTeamUpcomingEvents(teamId),
  // 훈련 로그 (limit=20, 최신순)
  Promise.all([
    prisma.trainingLog.findMany({
      where: { user: { teamId } },
      include: {
        user: { select: { id: true, name: true, image: true, position: true, number: true } },
        trainingEvent: { select: { id: true, title: true, date: true } },
        _count: { select: { comments: true, likes: true } },
        likes: { where: { userId }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.trainingLog.count({ where: { user: { teamId } } }),
  ]),
]);

const [recentLogs, totalLogs] = logsResult;

// SWR fallback 키는 Feed.tsx가 실제로 사용하는 키와 정확히 일치해야 함
fallback["/api/training-logs?limit=20"] = {
  logs: JSON.parse(JSON.stringify(recentLogs)),
  total: totalLogs,
};
```

**주의**: 직렬화를 위해 `JSON.parse(JSON.stringify(...))` 적용 (Date 객체 → string 변환).

### Phase 4: LCP 이미지 priority prop 전달

**파일**: `src/components/PolaroidCard.tsx`, `src/components/PolaroidStack.tsx`, `src/components/PolaroidDateGroup.tsx`, `src/components/Feed.tsx`

첫 번째 날짜 그룹의 첫 번째 카드에만 `priority` 전달 (4단계 prop drilling):

- `Feed` → `PolaroidDateGroup` (index=0에 `prioritizeFirst`)
- `PolaroidDateGroup` → `PolaroidStack` (첫 스택에 `prioritizeFirst`)
- `PolaroidStack` → `PolaroidCard` (index=0에 `priority={true}`)
- `PolaroidCard`: `<Image priority={priority} ...>`

### Phase 5: 재측정

개선 후 Lighthouse 재실행 → LCP 점수 비교.

---

## 예상 효과

| 문제 | 개선 내용 | 예상 효과 |
|------|-----------|-----------|
| 폰트 @import 워터폴 | `<link>` 병렬 로딩 | FCP 100~300ms 감소 |
| 이미지 도메인 DNS 지연 | preconnect | 이미지 로딩 50~200ms 감소 |
| 로그 클라이언트 페치 | 서버 프리페치 | LCP 1~2초 감소 |
| LCP 이미지 priority 없음 | priority 추가 | 이미지 발견 즉시 고우선순위 로딩 |

---

## 영향 받는 파일

- `src/app/layout.tsx` — preconnect + 폰트 link
- `src/app/globals.css` — @import 제거
- `src/app/page.tsx` — 훈련 로그 프리페치 추가
- `src/app/FeedClient.tsx` — 필요 시 타입 업데이트
- `src/components/PolaroidCard.tsx` — priority prop 추가
- `src/components/PolaroidStack.tsx` — priority prop 전달
- `src/components/PolaroidDateGroup.tsx` — prioritizeFirst prop 전달
- `src/components/Feed.tsx` — 첫 DateGroup에 prioritizeFirst 전달
