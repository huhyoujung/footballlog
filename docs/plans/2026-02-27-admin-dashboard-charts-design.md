# 슈퍼어드민 대시보드 차트 + GPT 사용량 탭 추가

**날짜**: 2026-02-27
**상태**: 설계 확정

---

## 목표

슈퍼어드민 대시보드(`/admin/[secret]`)에 데이터 시각화 차트를 추가하고, GPT API 사용량을 추적하는 신규 탭을 만든다.

---

## 범위

1. **Recharts 도입** — 전체 탭에 적용되는 공통 차트 라이브러리
2. **기존 탭 차트 추가** — 개요/팀/피드백 탭
3. **AI 사용량 탭 신설** — GPT 호출 수, 토큰, 비용 추적
4. **DB 스키마 변경** — `AIInsight`에 토큰 필드 추가
5. **route.ts 수정** — OpenAI 응답에서 토큰 수 저장

---

## 차트 라이브러리

- **Recharts** (`npm install recharts`)
- Next.js 최적화 원칙에 따라 `dynamic(() => import(...), { ssr: false })`로 지연 로딩
- 사용 컴포넌트: `BarChart`, `Bar`, `XAxis`, `YAxis`, `Tooltip`, `ResponsiveContainer`

---

## DB 스키마 변경

### `AIInsight` 모델에 필드 추가

```prisma
model AIInsight {
  // 기존 필드 유지
  id        String      @id @default(cuid())
  type      InsightType
  content   String
  userId    String?
  teamId    String?
  dateOnly  String
  createdAt DateTime    @default(now())

  // 신규 추가
  promptTokens     Int?    // OpenAI prompt tokens
  completionTokens Int?    // OpenAI completion tokens
  model            String? // 사용 모델명 (예: "gpt-4o-mini")

  // 기존 관계 및 인덱스 유지
}
```

기존 레코드는 null 유지. 마이그레이션 이후 새 호출부터 기록.

---

## route.ts 수정 (`src/app/api/insights/unified/route.ts`)

OpenAI 응답의 `usage` 필드를 AIInsight upsert 시 함께 저장:

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

---

## 어드민 대시보드 변경

### 탭 구성 변경

기존: `["개요", "유저", "팀", "피드백"]`
변경: `["개요", "유저", "팀", "피드백", "AI 사용량"]`

### 각 탭별 차트

#### 개요 탭
- **7일 신규 가입자 추이** (BarChart) — X: 날짜, Y: 가입자 수
  - 신규 쿼리: `users` GROUP BY DATE(`createdAt`) 최근 7일
- **7일 훈련 로그 수 추이** (BarChart) — 기존 `recentLogs` 데이터 활용

#### 팀 탭
- **팀별 인원 막대그래프** (BarChart) — X: 팀명, Y: 인원 수
  - 기존 `teamsWithStats._count.members` 데이터 활용

#### 피드백 탭
- **유형별 피드백 분포** (BarChart) — X: 유형, Y: 건수
  - 기존 `recentFeedbacks`에서 type별 집계

#### AI 사용량 탭 (신규)
요약 카드 4개:
| 카드 | 값 |
|---|---|
| 총 AI 호출 수 | COUNT(AIInsight WHERE promptTokens IS NOT NULL) |
| 총 입력 토큰 | SUM(promptTokens) |
| 총 출력 토큰 | SUM(completionTokens) |
| 누적 비용 | 계산값 (아래 참고) |

비용 계산식 (gpt-4o-mini 기준):
```
비용 = (promptTokens / 1_000_000 × 0.15) + (completionTokens / 1_000_000 × 0.60)
```

7일 일별 추이 BarChart: X: 날짜, Y: 비용($)
7일 일별 상세 테이블: 날짜 | 호출 수 | 입력 토큰 | 출력 토큰 | 비용

신규 쿼리:
```ts
// 전체 누적 집계
prisma.aIInsight.aggregate({
  _sum: { promptTokens: true, completionTokens: true },
  _count: { id: true },
  where: { promptTokens: { not: null } },
})

// 7일 일별 집계
prisma.$queryRaw<...>`
  SELECT "dateOnly", COUNT(*)::int as calls,
         SUM("promptTokens")::int as prompt,
         SUM("completionTokens")::int as completion
  FROM "AIInsight"
  WHERE "promptTokens" IS NOT NULL
    AND "dateOnly" >= ${sevenDaysAgo}
  GROUP BY "dateOnly"
  ORDER BY "dateOnly"
`
```

---

## 파일 변경 목록

| 파일 | 변경 유형 |
|---|---|
| `prisma/schema.prisma` | AIInsight에 3개 필드 추가 |
| `prisma/migrations/...` | 신규 마이그레이션 |
| `src/app/api/insights/unified/route.ts` | usage 저장 로직 추가 |
| `src/app/admin/[secret]/page.tsx` | 데이터 쿼리 추가, AI탭 콘텐츠 추가 |
| `src/app/admin/[secret]/DashboardTabs.tsx` | AI 사용량 탭 추가 |
| `src/app/admin/[secret]/AdminChart.tsx` | 신규: 공통 차트 컴포넌트 (dynamic import) |

---

## 제약 사항

- DAU 7일 추이는 NextAuth sessions 테이블 구조상 날짜별 집계가 부정확하여 제외
- 기존 AIInsight 레코드(토큰 미기록)는 AI 사용량 집계에서 제외 (`WHERE promptTokens IS NOT NULL`)
- Recharts는 `dynamic(() => import(...), { ssr: false })`로만 사용
