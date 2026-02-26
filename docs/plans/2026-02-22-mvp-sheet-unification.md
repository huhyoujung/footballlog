# MVP 결과 바텀시트 통합 설계

## 배경

현재 MVP 결과 바텀시트가 두 곳에 별도로 구현되어 있다.

- **피드** (`MvpResultSheet.tsx`): 공유 버튼 없음, 2위 이후 코멘트 없음
- **상세** (`PomVoting.tsx` 내부 `ResultsSheet`): 공유 버튼 있음, 1위 코멘트만 있음

사용자 요청:
1. 두 바텀시트를 하나로 통합 (피드에서도 공유 버튼 포함)
2. 공유 이미지에 전체 순위 + 추천사 포함
3. 2위 이후 선수들도 추천사(팀원 코멘트 가로 스크롤) 표시
4. 공동 순위 처리 (1위 포함 모든 순위에서 동점 가능)

## 변경 범위

### 1. API — `GET /api/training-events/[id]/pom`

응답에 `eventDate`, `teamName` 추가.
`MvpResultSheet`가 props 없이 내부에서 직접 사용.

```ts
// event select에 team 추가
select: {
  date: true,
  teamId: true,
  pomVotesPerPerson: true,
  team: { select: { name: true } },
}

// 응답에 추가
{
  ...기존,
  eventDate: event.date,
  teamName: event.team.name,
}
```

### 2. `MvpResultSheet.tsx` — 완전 재작성

**Props (변경 없음):**
```ts
interface Props {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}
```

**내부 데이터:**
- `/api/training-events/${eventId}/pom` 에서 `eventDate`, `teamName`, `results` 수신

**rank 계산 로직:**
```ts
const rankedResults = results.map((r, i) => ({
  ...r,
  rank: i === 0 ? 1
    : r.count === results[i - 1].count
      ? /* 앞 선수와 동일 rank */
      : i + 1,
}));
```

**바텀시트 레이아웃:**

- 단독 1위: 큰 히어로 카드 (현재 디자인 유지)
- 공동 1위: "공동 1위 🏆" 헤더 + 각 선수 블록 (사진 · 이름 · 표 수 · 코멘트 가로 스크롤)
- 2위 이하: "전체 순위" 섹션, 동점이면 같은 rank 숫자 표시, 각 선수에 코멘트 가로 스크롤 카드

**공유 이미지 (`shareCardRef`):**

- 360px × 가변 높이
- 단독 1위: 큰 프로필 + 추천사 최대 2개, 이하 순위 소형 카드
- 공동 1위: "공동 1위 🏆" 헤더 + 선수 나란히 배치, 각 추천사 1개
- 2위 이하: 소형 카드 (사진 · 이름 · 표 수 · 추천사 1개)
- 하단: 팀명 · 날짜

### 3. `PomVoting.tsx`

- 내부 `ResultsSheet` 함수 제거
- `import MvpResultSheet` 추가
- 기존 `ResultsSheet` 사용 위치를 `MvpResultSheet`로 교체
  - `eventDate`, `teamName` props 불필요 (API에서 수신)

### 4. `PolaroidStack.tsx`

- 이미 `MvpResultSheet` import 중 — 변경 불필요
- Props chain 변경 없음

## 파일 변경 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/app/api/training-events/[id]/pom/route.ts` | 응답에 `eventDate`, `teamName` 추가 |
| `src/components/MvpResultSheet.tsx` | 전면 재작성 (풀 기능, 공동 순위, 공유) |
| `src/components/PomVoting.tsx` | `ResultsSheet` 제거, `MvpResultSheet` 사용 |

## 공동 순위 예시

| 득표 분포 | ranks |
|-----------|-------|
| 3, 3, 2, 1 | 1, 1, 3, 4 |
| 3, 2, 2, 1 | 1, 2, 2, 4 |
| 3, 2, 1, 1 | 1, 2, 3, 3 |
| 2, 2, 2    | 1, 1, 1    |
