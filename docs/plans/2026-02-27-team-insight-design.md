# 팀 인사이트 통합 설계

**Date**: 2026-02-27
**Status**: Approved

## 배경

개인 AI 코치 피드백(unified)에 팀 전체 분석 섹션을 추가한다. 하나의 레포트 안에 "나의 코칭 피드백"과 "팀 현황 분석"이 함께 출력된다. 팀 리포트에서는 선수 이름을 절대 언급하지 않고 포지션 기반 익명 ID를 사용한다.

---

## 변경 대상

- **메인**: `src/app/api/insights/unified/route.ts`
- UI 변경 없음 (`AIInsightModal.tsx`는 마크다운 문자열을 그대로 렌더링하므로 변경 불필요)

---

## 설계 결정

### 1. GPT 2회 병렬 호출

개인과 팀 각각 전용 프롬프트로 집중도 높게 생성. 두 호출을 `Promise.all`로 병렬 실행하므로 레이턴시는 단일 호출과 동일하다.

| | 개인 | 팀 |
|---|---|---|
| max_tokens | 1800 | 1500 |
| 기존 | 2500 | - |

### 2. 캐시 전략

| 캐시 키 | 설명 |
|---|---|
| `userId_dateOnly` | 개인 캐시 (기존) |
| `teamId_dateOnly` | 팀 캐시 (신규, 스키마에 이미 정의됨) |

- 둘 다 HIT → 즉시 합산 반환 (`cached: true`)
- 하나만 HIT → 나머지만 재생성
- 팀 캐시는 팀원 누구나 생성하면 팀 전체가 공유

무효화 기준: "마지막 GPT 생성 이후 새 일지 없으면 캐시 유효"
- 개인: `latestMyLog.createdAt <= personalCache.createdAt`
- 팀: `latestTeamLog.createdAt <= teamCache.createdAt`

### 3. 동시성 제어

```typescript
const generatingUsers = new Set<string>(); // 기존 유지
const generatingTeams = new Set<string>(); // 신규 추가 — 팀원 여럿이 동시 요청 시 GPT 1번만 호출
```

팀이 이미 생성 중일 때(`generatingTeams.has(teamId)`): 팀 섹션은 "잠시 후 다시 확인해봐" fallback 텍스트로 대체 후 개인 코칭만 반환.

크로스 인스턴스 중복 저장: P2002 에러 → 팀 캐시 재조회해서 반환.

### 4. 익명화 전략

팀 일지 데이터에서 이름을 제거하고 포지션 기반 익명 ID로 대체한다.

```
홍길동(FW) → FW1
김철수(MF) → MF1
이영희(MF) → MF2
```

GPT가 같은 세션 내 동일 ID를 일관되게 참조할 수 있어 "FW1은 최근 3회 연속 컨디션 하락 중" 같은 패턴 분석이 가능하다.

### 5. 출력 합산 형식

```
## 나의 코칭 피드백

[개인 코칭 텍스트]

---

## 팀 현황 분석

[팀 분석 텍스트]
```

`AIInsightModal.tsx`의 ReactMarkdown이 `h2`를 `text-sm font-semibold text-gray-900`으로 렌더링하므로 UI 변경 없이 섹션이 구분된다.

---

## 데이터 수집 계획

### 기존 (개인 코칭용 — 유지)
- 내 훈련일지 15개
- 팀 훈련일지 30개 (팀 컨텍스트용)
- 최근 이벤트 5개 (날씨, 참여자)
- 출석률 (checkIn / totalEvent)
- MVP 투표 10개 (내가 받은 것)
- 칭찬쪽지 10개 (내가 받은 것)
- 팀 인원
- 과거 AI 코칭 3개
- RSVP 패턴 10개 (내 것)

### 신규 추가 (팀 분석용)
모두 `Promise.all`에 병렬 추가.

```typescript
// 1. 팀 전체 MVP 투표 (포지션만 — 이름 제외)
prisma.pomVote.findMany({
  where: { trainingEvent: { teamId } },
  orderBy: { createdAt: 'desc' },
  take: 30,
  select: { reason: true, tags: true, nominee: { select: { position: true } } },
})

// 2. 최근 친선전 결과
prisma.trainingEvent.findMany({
  where: { teamId, isFriendlyMatch: true, matchStatus: 'COMPLETED' },
  orderBy: { date: 'desc' },
  take: 5,
  select: { date: true, teamAScore: true, teamBScore: true, opponentTeamName: true },
})

// 3. 최근 30일 일지 작성 참여 인원
prisma.trainingLog.findMany({
  where: { user: { teamId }, trainingDate: { gte: thirtyDaysAgo } },
  distinct: ['userId'],
  select: { userId: true },
})

// 4. 팀 전체 RSVP 집계 (RsvpStatus 분포)
prisma.rsvp.groupBy({
  by: ['status'],
  where: { trainingEvent: { teamId } },
  _count: { status: true },
})

// 5. 팀 전체 칭찬쪽지 태그 집계 (팀 문화 파악)
prisma.lockerNote.findMany({
  where: { trainingEvent: { teamId } },
  orderBy: { createdAt: 'desc' },
  take: 50,
  select: { tags: true },
})

// 6. 미납 지각비 건수 (팀 규율 지표)
prisma.lateFee.count({
  where: { trainingEvent: { teamId }, status: 'PENDING' },
})

// 7. 최근 경기 골 기록 (공격/수비 성향)
prisma.goalRecord.findMany({
  where: { trainingEvent: { teamId } },
  orderBy: { createdAt: 'desc' },
  take: 30,
  select: { teamSide: true, minute: true, isOwnGoal: true },
})
```

---

## 팀 프롬프트 설계

### System Prompt 핵심

```
당신은 한국 아마추어 축구/풋살 팀의 팀 코치입니다.
팀 전체 데이터를 분석해 팀의 현재 상태와 다음 훈련 방향을 제시합니다.

코칭 원칙:
- 선수 이름 절대 금지. 포지션 익명 ID(FW1, MF2 등)만 사용
- 정량(컨디션 수치, 출석률, 골 기록) + 정성(일지 키워드, MVP 이유, 칭찬 태그) 모두 활용
- 보고가 아닌 처방: "~했다" 대신 "~해보자", "~가 필요하다"
- 팀 RSVP 패턴, 지각비 건수 등으로 팀 헌신도(commitment) 언급
- 다음 훈련 집중 과제 1-2개 제시

응답 형식:
- ## 팀 현황 분석 으로 시작
- 1000자 내외, 마크다운
- 반말 (팀원에게 말하는 코치 톤)
- 구조: 이번 주 팀 상태 요약 → 주목할 패턴/포지션 → 다음 훈련 과제
```

### User Prompt 구조

```
## 팀 기본 현황
- 팀 인원: N명
- 최근 30일 일지 작성 참여: N/M명 (X%)
- 팀 평균 컨디션: X.X/10

## 포지션별 컨디션 분포
- FW: 평균 X/10 (N개 일지)
- MF: ...

## 팀 RSVP 현황
- ATTENDING: N건 / DECLINED: N건 / ...

## 팀원 훈련 일지 (익명, N개)
- [날짜] FW1 컨디션:X/10 | 핵심:"..." | 개선:"..."

## 팀 전체 MVP 투표 이유 (포지션 익명)
- FW: "..."

## 팀 칭찬쪽지 태그 빈도
- "리더십": 8회, "패스": 6회, ...

## 최근 친선전 결과
- [날짜] vs 상대팀: X-X

## 최근 골 기록 (N개)
- 공격팀 골: N개 / 자책골: N개

## 미납 지각비: N건

## 최근 훈련 이벤트 (날씨 포함)
- [날짜] 장소 | 참여:N명 | RSVP:N명 | 날씨:...

위 데이터를 바탕으로, 팀 코치로서 팀 현황 분석 리포트를 작성해줘.
선수 이름은 절대 언급하지 말고, 포지션 익명 ID만 사용해줘.
```

---

## 구현 순서

1. 모듈 스코프에 `generatingTeams` Set 추가
2. 헬퍼 함수 추가: `anonymizeTeamLogs()`, `calcPositionStats()`, `mergeContent()`
3. 캐시 조회를 4-way `Promise.all`로 변경 (personalCache, teamCache, latestMyLog, latestTeamLog)
4. 캐시 HIT 판단 로직 추가
5. 기존 `Promise.all` 데이터 수집에 신규 7개 쿼리 추가
6. 기존 개인 프롬프트 구성 코드를 함수로 추출
7. `TEAM_SYSTEM_PROMPT` + `buildTeamUserPrompt()` 추가
8. GPT 2회 `Promise.all` 병렬 호출 구조로 변경
9. 저장을 `Promise.all` 병렬화 (개인 + 팀)
10. `mergeContent`로 합산 반환
11. `finally` 블록으로 잠금 해제 통합
12. P2002 에러 핸들링 추가

---

## 검증 방법

1. 팀 일지가 있는 계정으로 `/api/insights/unified` POST 호출
2. 응답 `content`에 `## 나의 코칭 피드백`과 `## 팀 현황 분석` 두 섹션이 존재하는지 확인
3. 팀 섹션에 선수 이름이 없고 "FW1", "MF2" 같은 익명 ID 또는 "한 팀원" 표현만 있는지 확인
4. 같은 요청 2번 호출 시 두 번째는 `cached: true`인지 확인
5. 팀원 A가 인사이트 생성 후 팀원 B가 호출했을 때 팀 섹션이 캐시에서 반환되는지 확인
6. AI 인사이트 모달 UI에서 두 섹션이 올바르게 렌더링되는지 확인
