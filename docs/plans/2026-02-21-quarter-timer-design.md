# 쿼터 타이머 설계 (2026-02-21)

## 개요

ChallengeLiveMode에 실시간 쿼터 타이머를 추가한다.
심판 역할 사용자(canRecord)가 시작/정지/다음 단계를 컨트롤하며,
서버 DB에 타이머 상태를 저장해 전 기기에 동기화한다.

---

## 요구사항

- 카운트다운 타이머 (quarterMinutes → 0)
- 0이 되면 진동(`navigator.vibrate`) 알림
- 정지 / 재개 가능
- 서버 싱크 — 다른 기기에서도 같은 타이머가 보임
- 컨트롤 권한: canRecord 사용자 (ATTEND 또는 ADMIN)
- 라인업: 본인 팀 것만 노출

---

## 페이즈 시퀀스

quarterCount = N일 때 전체 단계 = 2N-1개:

```
1Q → 휴식 → 2Q → 하프타임 → 3Q → 휴식 → 4Q
```

- 홀수 인덱스 페이즈 (1,3,5,...): 쿼터 (duration = quarterMinutes)
- 짝수 인덱스 페이즈 (2,4,6,...): 휴식/하프타임
  - 중간 지점(quarterCount/2번째 후): 하프타임 (duration = halftime)
  - 그 외: 짧은 휴식 (duration = quarterBreak)

심판이 [다음 ›] 버튼을 수동으로 눌러야 다음 단계로 전환됨.
각 단계 시작 시 타이머 자동 시작.

---

## DB 스키마 변경

`MatchRules` 모델에 3개 필드 추가:

```prisma
model MatchRules {
  // 기존 필드 유지...
  currentPhase    Int       @default(0)  // 0=시작전, 1=1Q, 2=휴식, 3=2Q, ...
  timerStartedAt  DateTime?              // null = 정지 상태
  timerElapsedSec Int       @default(0)  // 정지 시점까지 누적 초
}
```

타이머 경과 시간 계산:
- 실행 중: `timerElapsedSec + floor((now - timerStartedAt) / 1000)`
- 정지 중: `timerElapsedSec`

---

## 새 API

### `POST /api/challenge/[token]/timer`

권한: canRecord (ATTEND 또는 ADMIN)

| action | 동작 |
|--------|------|
| `start` | `timerStartedAt = now`, elapsed 유지 |
| `pause` | `timerElapsedSec += now - startedAt`, `timerStartedAt = null` |
| `next`  | pause 후 `currentPhase += 1`, elapsed=0, 자동 start |
| `prev`  | pause 후 `currentPhase -= 1`, elapsed=0, 자동 start |

응답: 업데이트된 타이머 상태 (live API 응답과 동일 구조)

---

## Live API 변경

`GET /api/challenge/[token]/live` 응답에 추가:

```ts
quarterMinutes: number   // matchRules에서
quarterBreak: number     // matchRules에서
halftime: number         // matchRules에서
timerPhase: number       // currentPhase
timerRunning: boolean    // timerStartedAt !== null
timerStartedAt: string | null
timerElapsedSec: number
myTeamSessions: Session[]  // 로그인 사용자 소속 팀의 sessions만 반환
```

`hostSessions` 필드 제거 → `myTeamSessions`로 교체:
- 호스트팀 사용자 → 호스트 이벤트 sessions
- 상대팀 사용자 → linkedEvent sessions
- 비로그인/타팀 → `[]`

---

## 클라이언트 (ChallengeLiveMode)

### 타이머 UI (스코어 헤더 아래)

```
┌──────────────────────────────┐
│  ● 경기 진행 중           ⋮  │
│                              │
│  FC Seoul   2 : 1   Test FC  │
│                              │
│  [ 2Q 진행 중  ·  08:42 ]   │  ← 모든 사용자
│  쿼터 12분 | 쉬는시간 2분    │
│                              │
│  [⏸]  [‹ 이전]  [다음 ›]   │  ← canRecord만
└──────────────────────────────┘
```

타이머 색상: 1분 미만 → 빨간색으로 전환

### 로컬 타이머 tick

```ts
useEffect(() => {
  const id = setInterval(() => setTick(t => t + 1), 1000);
  return () => clearInterval(id);
}, []);

const elapsed = timerRunning
  ? timerElapsedSec + Math.floor((Date.now() - new Date(timerStartedAt).getTime()) / 1000)
  : timerElapsedSec;
const remaining = phaseDuration - elapsed;
```

### 진동 (canRecord 사용자만)

```ts
useEffect(() => {
  if (remaining === 0 && canRecord) {
    navigator.vibrate?.([300, 100, 300, 100, 300]);
  }
}, [remaining === 0]);
```

### 라인업 섹션

- `hostSessions` → `myTeamSessions` 변경
- "○○FC Xq 선발" → "내 팀 Xq 선발"
- 기존 로직 동일 (현재 타이머 페이즈의 쿼터 기준 표시)

---

## 기존 기능과의 관계

- **기록용 쿼터 셀렉터** (`currentQuarter` state): 타이머 페이즈와 독립적으로 유지.
  심판이 쿼터를 넘겨도 기록 중인 쿼터는 수동으로 변경.
- **SWR 5초 폴링**: 기존 유지. 타이머는 클라이언트 로컬 계산이라 정확.
  pause/next 이벤트만 최대 5초 지연 허용.
