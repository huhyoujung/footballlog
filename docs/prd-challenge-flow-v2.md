# PRD: 친선매치 도전장 플로우 개선 (v2)

## 개요
- **목적**: 친선경기 도전장의 발송-수신-수락 플로우를 "인원 확보 후 도전" 구조로 재설계하고, 매치 상태를 직관적으로 보여주는 배너 시스템을 추가한다.
- **MVP 범위**: 호스트팀 도전장 발송 조건 강화, 상대팀 수락 조건 강화, 매치 상태 배너, 거절 기능, 응답기한 커스텀 설정

---

## 확정된 플로우

```
[호스트팀]
1. 친선경기 생성 (룰북 설정 + 응답기한 설정)
2. 팀 내 인원조사 (기존 팀 운동과 동일하게 RSVP)
3. 최소인원(playersPerSide) 충족 시 → 도전장 발송 가능 (룰북 + 응답기한 포함)

[상대팀]
4. 도전장 수신 (카톡 등으로 링크 공유)
5. 링크 열면 경기 정보 + 룰북 미리보기
   - 비로그인 → 경기 정보 보여주고 "Google로 시작하기"
   - 로그인했는데 팀 없음 → "팀 만들기/참여하기" 안내
   - 로그인 + 팀 있음 → 인원조사 + 수락 플로우
6. 상대팀 내 인원조사 진행
7. 최소인원 충족 → 도전 수락 가능 (룰북에 의견 추가 가능)
   또는 거절 / 응답기한 초과 시 자동 만료

[양팀]
8. 매칭 확정 → 이후 룰북 조정 가능
```

---

## 룰북 (MatchRules) 상세

도전장에 포함되는 룰북 항목 (기존 스키마 활용):

| 항목 | 스키마 필드 | 예시 |
|------|------------|------|
| 킥오프 시간 | TrainingEvent.date | 오전 9:00 |
| 인원 (몇 대 몇) | MatchRules.playersPerSide | 6 vs 6 |
| 쿼터 수 | MatchRules.quarterCount | 4쿼터 |
| 각 쿼터 시간 | MatchRules.quarterMinutes | 12분 |
| 쿼터 간 쉬는시간 | MatchRules.quarterBreak | 2분 |
| 하프타임 쉬는시간 | MatchRules.halftime | 5분 |
| 백패스 허용 | MatchRules.allowBackpass | 허용/불허 |
| 오프사이드 적용 | MatchRules.allowOffside | 적용/미적용 |
| 심판 (쿼터별 어느 팀) | QuarterReferee.teamSide | 1Q: A팀, 2Q: B팀... |

### 룰북 템플릿 (RuleTemplate)
- **FUTSAL**: 5 vs 5, 4쿼터 x 12분, 백패스 불허
- **ELEVEN_HALVES**: 11 vs 11, 전후반 x 45분
- **CUSTOM**: 직접 설정

### 도전장 발송 시
- 호스트가 설정한 룰북이 도전장에 포함됨
- 상대팀은 도전장 페이지에서 룰북 확인 가능

### 수락 시 / 매칭 후
- 상대팀이 수락할 때 룰북에 의견(메시지) 추가 가능
- 매칭 확정 후에도 양팀 합의하에 룰북 조정 가능
- `agreedByTeamA` / `agreedByTeamB`로 양팀 합의 상태 추적

---

## 매치 상태 배너

훈련 상세 페이지 상단에 현재 매치 상태를 배너로 표시한다.

### 호스트팀 시점

| matchStatus | 조건 | 배너 | 배경색 | 액션 |
|-------------|------|------|--------|------|
| DRAFT | attendCount < playersPerSide | 📋 인원조사 진행 중 (N/M명) | blue-50 | 없음 |
| DRAFT | attendCount >= playersPerSide | ⚔️ 도전장을 보낼 수 있습니다 | amber-50 | [보내기] (운영진만) |
| CHALLENGE_SENT | 응답기한 전 | ⏳ 상대팀의 응답을 기다리고 있습니다 | gray-50 | 없음 |
| CHALLENGE_SENT | 응답기한 초과 | ⏰ 응답 기한이 만료되었습니다 | red-50 | 없음 |
| CONFIRMED | - | 🤝 매칭 완료! | green-50 | 없음 |
| CANCELLED | 거절 | ❌ 상대팀이 거절했습니다 | red-50 | 없음 |

### 상대팀 시점

| matchStatus | 조건 | 배너 | 배경색 | 액션 |
|-------------|------|------|--------|------|
| DRAFT | 이벤트 존재 + attendCount < playersPerSide | 📋 인원조사 진행 중 (N/M명) | blue-50 | 없음 |
| DRAFT | attendCount >= playersPerSide | ✅ 도전에 응할 수 있습니다 | green-50 | [수락하기] (운영진만) |
| CONFIRMED | - | 🤝 매칭 완료! | green-50 | 없음 |
| CANCELLED | - | ❌ 매칭 취소됨 | red-50 | 없음 |

---

## MatchStatus enum 변경

### 현재
DRAFT, PENDING, CONFIRMED, RULES_PENDING, RULES_CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED

### 변경
```
DRAFT            // 생성됨, 인원조사 중
CHALLENGE_SENT   // [신규] 도전장 발송 완료, 상대 응답 대기
CONFIRMED        // 매칭 확정
RULES_PENDING    // (기존 유지)
RULES_CONFIRMED  // (기존 유지)
IN_PROGRESS      // 경기 진행 중
COMPLETED        // 경기 종료
CANCELLED        // 취소/거절/만료 통합
```

- `PENDING` → `CHALLENGE_SENT`로 대체
- 거절/만료는 `CANCELLED`로 통합, 세부 사유는 `CancellationReason` 또는 challenge.status로 구분

---

## TrainingEvent 스키마 추가 필드

```prisma
model TrainingEvent {
  // ... 기존 필드
  responseDeadline  DateTime?  // 친선경기 응답 기한 (호스트가 설정)
}
```

---

## API 변경사항

### 도전장 발송 (POST /api/challenge/generate)
- **추가 검증**: 참석(ATTEND) 인원 >= MatchRules.playersPerSide
- **추가 필드**: `responseDeadline`을 `challengeTokenExpiresAt`로 사용 (기존 30일 → 호스트 설정값)
- **응답에 포함**: 룰북 요약 텍스트

### 도전장 수락 (POST /api/challenge/[token]/accept)
- **추가 검증**: 상대팀 참석 인원 >= playersPerSide
- **추가 입력**: message (룰북 의견, optional)

### 도전장 거절 (POST /api/challenge/[token]/reject) [신규]
- 거절 사유 입력 (optional)
- hostEvent.matchStatus → CANCELLED
- challenge.status → DECLINED

### 이벤트 조회 (GET /api/training-events/[id])
- 응답에 challenge 정보 포함 (status, tokenExpiresAt, 상대팀 정보)
- matchRules 포함

---

## 도전장 텍스트 포맷

```
⚔️ 도전장

{우리팀}{이/가} {너네팀}에 도전합니다!

📅 3월 8일 (일) 오전 09:00
📍 살곶이 체육공원

⚽ 룰북
- 6 vs 6 | 4쿼터 x 12분
- 쉬는시간 2분 | 하프타임 5분

아래 링크에서 확인하고 수락하세요:
{URL}
```

---

## 한글 조사 유틸

위치: `src/utils/korean.ts`

```typescript
// addJosa('네모의꿈', '이/가') → '네모의꿈이'
// addJosa('바르셀로나', '이/가') → '바르셀로나가'
// addJosa('ABC', '이/가') → 'ABC이(가)'
function addJosa(word: string, josa: '이/가' | '을/를' | '은/는'): string
```

---

## 스코프 경계

### In Scope
- 호스트팀 도전장 발송 조건 강화 (인원 충족 필수)
- 상대팀 수락 조건 강화 (인원 충족 필수)
- 매치 상태 배너 (호스트/상대 양쪽)
- 도전장 거절 기능
- 응답기한 커스텀 설정
- 도전장에 룰북 포함
- MatchStatus enum 정리
- 한글 조사 유틸 함수
- Lazy expiration (조회 시 만료 처리)

### Out of Scope
- 푸시 알림 (이번 스코프 아님)
- 카카오톡 SDK 공유 (텍스트 복사로 대체)
- Cron 기반 만료 처리
- 실시간 알림 (WebSocket)

---

## 결정된 사항

1. **미러 이벤트 노출** → ✅ 수락 전에도 피드에 표시 (동일 UI). 취소/거절된 경우 "취소됨" 배지 표시.
   - **인원 미달로 취소 시**: "자체 팀 운동으로 전환하시겠습니까?" 바텀시트 노출
     - "전환" 선택 → isFriendlyMatch=false로 변경, 일반 팀 운동으로 유지
     - "취소" 선택 → matchStatus=CANCELLED, 피드에 "취소됨" 배지
2. **거절 사유 노출** → ✅ 상대팀 거절 사유를 호스트팀 배너에 표시
3. **발송 후 수정 불가** → ✅ 도전장 발송 후 날짜/장소/룰북 수정 잠금. 매칭 확정 후에는 양팀 합의하에 룰북 조정 가능.
4. **D-day 표시** → ✅ "⏳ 상대팀 응답 대기 중 (D-3)" 형식으로 배너에 남은 일수 표시
