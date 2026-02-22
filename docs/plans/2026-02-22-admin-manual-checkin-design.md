# 어드민 수동 체크인 기능 설계

## 배경

출석률 정확도를 높이기 위해, 운영진(ADMIN)이 앱에서 체크인하지 못한 팀원의 출석을 수동으로 등록/취소할 수 있는 기능 추가.

## 요구사항

- 위치: 훈련 상세 페이지 → AttendanceTab
- 진입: 어드민에게만 보이는 "출석 관리" 버튼 → 바텀시트 오픈
- 조건: RSVP 여부 무관, 시간 제한 없음 (어드민 전용)
- 알림: 없음

## UI 흐름

```
AttendanceTab
└── [출석 관리] 버튼 (isAdmin === true 일 때만 표시)
    └── AttendanceManageSheet (바텀시트)
        ├── 전체 팀원 목록 (RSVP 무관)
        ├── 각 팀원: 아바타 + 이름 + 체크인 상태 + 토글 버튼
        │   ├── ✅ 체크인 됨 → 버튼: 체크인 제거
        │   └── ⬜ 미체크인 → 버튼: 체크인 추가
        └── 닫기 시 부모 데이터 refresh
```

## API

### 어드민 수동 체크인 추가

```
POST /api/training-events/[id]/check-in/admin
Body: { userId: string }
```

- 세션 role === "ADMIN" 검증
- 같은 팀 팀원인지 확인 (teamId 비교)
- 시간 제한 없음, RSVP 조건 없음
- 이미 체크인된 경우 409 반환
- `manualEntry: true`, `isLate: false`로 생성

### 어드민 수동 체크인 취소

```
DELETE /api/training-events/[id]/check-in/admin
Body: { userId: string }
```

- 세션 role === "ADMIN" 검증
- 같은 팀 팀원인지 확인
- 체크인 기록이 없으면 404 반환

## DB 스키마 변경

```prisma
model CheckIn {
  id              String        @id @default(cuid())
  trainingEventId String
  userId          String
  checkedInAt     DateTime      @default(now())
  isLate          Boolean       @default(false)
  manualEntry     Boolean       @default(false)  // 추가: 어드민 수동 등록 여부
  trainingEvent   TrainingEvent @relation(...)
  user            User          @relation(...)
}
```

`manualEntry` 필드는 출석률 계산에 영향 없음. 추후 데이터 품질 분석용.

## 컴포넌트 변경

### AttendanceTab (수정)

- `isAdmin: boolean` prop 추가
- `onManageClick: () => void` prop 추가
- 하단에 어드민 전용 "출석 관리" 버튼 렌더링

### AttendanceManageSheet (신규)

- Props: `eventId`, `checkIns`, `teamMembers`, `isOpen`, `onClose`, `onRefresh`
- 전체 팀원 목록 렌더링
- 각 팀원별 체크인 토글 (POST/DELETE admin API 호출)
- 로딩/에러 상태 처리

### TrainingDetailClient (수정)

- `teamMembers` 상태 추가 (팀원 목록 fetch)
- `AttendanceManageSheet` 마운트 및 상태 관리

## isLate 처리

어드민 수동 등록 시 `isLate: false` 고정 (정상 출석으로 간주). 추후 필요 시 어드민이 지각 여부를 직접 선택할 수 있는 UI 추가 가능.
