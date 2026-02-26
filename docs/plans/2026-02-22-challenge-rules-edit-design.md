# 설계: /invite/[token]에서 경기 방식 수정

## 배경

경기 방식(쿼터 수, 쿼터별 시간, 쉬는 시간, 심판팀, 킥오프 시간)은 현재 `/training/[id]`의 도전장 발송 다이얼로그에서만 수정 가능하며, 호스트팀 운영진만 접근할 수 있다. 매칭이 성사된 이후에는 양 팀이 `/invite/[token]` 링크를 통해 경기를 준비하는데, 이 페이지에서 직접 경기 방식을 수정할 수 없어 불편하다.

## 목표

- **대상 상태**: CHALLENGE_SENT, CONFIRMED, IN_PROGRESS 모두에서 수정 가능
- **권한**: 양 팀 운영진(ADMIN role) 모두 수정 가능
- **방식**: 토큰 기반 API + 기존 바텀시트 UI 재사용

---

## 아키텍처

### 1. 새 API: `PATCH /api/challenge/[token]/rules`

**파일**: `src/app/api/challenge/[token]/rules/route.ts`

**인증 로직**:
```
challengeToken으로 TrainingEvent 조회 (linkedEvent 포함)
→ user.role === "ADMIN" AND (user.teamId === event.teamId OR user.teamId === event.linkedEvent.teamId)
→ 실패 시 403
```

**허용 상태**: CHALLENGE_SENT | CONFIRMED | IN_PROGRESS (나머지는 400)

**요청 Body**:
```json
{
  "quarterCount": 4,
  "quarterMinutes": 20,
  "quarterBreak": 5,
  "kickoffTime": "15:00",
  "quarterRefereeTeams": ["TEAM_A", "TEAM_B", "TEAM_A", "TEAM_B"]
}
```

**동작**: `prisma.matchRules.upsert` — 상태 전환 없음

**응답**: `{ saved: true }`

---

### 2. 새 컴포넌트: `MatchRulesBottomSheet`

**파일**: `src/components/training/MatchRulesBottomSheet.tsx`

**Props**:
```typescript
interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rules: MatchRulesPayload) => Promise<void>;
  initialRules?: {
    quarterCount: number;
    quarterMinutes: number;
    quarterBreak: number;
    kickoffTime: string | null;
    quarterRefereeTeams: ("TEAM_A" | "TEAM_B")[] | null;
  };
  hostTeamName: string;
  opponentTeamName: string;
  hostTeamColor: string;
  opponentTeamColor: string;
}
```

**UI (기존 TrainingDetailClient 바텀시트에서 추출)**:
- 쿼터 수 (1~8, ± 버튼)
- 쿼터별 시간 (1~60분, ± 버튼)
- 쿼터 사이 쉬는시간 (0~30분, ± 버튼)
- 총 경기시간 요약
- 쿼터별 심판팀 (각 쿼터마다 우리팀/상대팀 토글)
- 킥오프 시간 (time input, 종료 시간 자동 계산)
- 취소 / 저장 버튼

**응답기한**: 포함하지 않음 (TrainingDetailClient 전용)

---

### 3. `ChallengeClient` 변경

**파일**: `src/app/invite/[token]/ChallengeClient.tsx`

**추가 상태**:
```typescript
const [showRulesSheet, setShowRulesSheet] = useState(false);
const [rulesError, setRulesError] = useState("");
```

**저장 핸들러**:
```typescript
const handleSaveRules = async (rules) => {
  const res = await fetch(`/api/challenge/${token}/rules`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(rules),
  });
  if (!res.ok) throw new Error((await res.json()).error);
  router.refresh();
};
```

**상태별 편집 버튼 위치**:

- **CHALLENGE_SENT**: 도전장 카드의 "경기 방식" 섹션 헤딩 우측에 연필 아이콘 버튼 (isAdmin만 표시)
- **CONFIRMED** (ConfirmedView 컴포넌트): "경기 방식 수정" 텍스트 버튼 추가. ConfirmedView에 `isAdmin`, `opponentTeam`, `opponentTeamName`, `onEditRules` props 추가
- **IN_PROGRESS**: ChallengeLiveMode 위에 `fixed bottom-20 right-4 z-50` FAB 버튼 (연필 아이콘, isAdmin만 표시)

모든 상태에서 `<MatchRulesBottomSheet>` 는 ChallengeClient 최하단에 단 1개 렌더.

---

### 4. `TrainingDetailClient` — 변경 없음

기존 바텀시트 로직은 도전장 발송(토큰 생성, URL 복사, 응답기한) 과 결합되어 있어 분리 시 리스크가 있음. 이번 태스크 범위에서 제외. (향후 리팩토링 가능)

---

## 파일 변경 목록

| 파일 | 변경 유형 |
|------|---------|
| `src/app/api/challenge/[token]/rules/route.ts` | 신규 |
| `src/components/training/MatchRulesBottomSheet.tsx` | 신규 |
| `src/app/invite/[token]/ChallengeClient.tsx` | 수정 |

---

## 엣지 케이스

1. **룰 미존재 상태에서 수정**: upsert로 처리, 자동 생성
2. **COMPLETED / CANCELLED 상태**: API에서 400 반환
3. **비운영진 접근**: API 403, UI 버튼 미노출 (isAdmin 조건)
4. **토큰 만료 후 접근**: 토큰 조회 실패 시 404
5. **네트워크 에러**: 바텀시트에서 에러 메시지 표시, 닫히지 않음
