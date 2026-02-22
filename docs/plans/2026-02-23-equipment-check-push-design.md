# 장비함 체크 푸시 알림 — 설계 문서

작성일: 2026-02-23

## 개요

팀 운동이 끝날 시점에 장비 담당자들에게 자동으로 푸시 알림을 발송하여, 장비함 정리를 놓치지 않도록 한다.

## 요구사항

- **트리거**: MVP 투표 종료 시점 (enablePomVoting=true) 또는 운동 시작 + 2시간 (enablePomVoting=false)
- **수신자**: 해당 팀의 `isEquipmentManager=true` 팀원 전체
- **조건**: 이벤트에 장비 담당자가 1명 이상 있어야 발송
- **중복 방지**: `equipmentCheckPushSentAt` 타임스탬프로 원자적 check-and-set

## 결정 사항

| 질문 | 결정 |
|---|---|
| 종료 감지 방법 | MVP 투표 종료 시각 기준 |
| 알림 수신 대상 | 팀 내 모든 장비 담당자 (`isEquipmentManager=true`) |
| MVP 비활성화 이벤트 | 운동 시작 + 2시간 후 발송 |
| 구현 방식 | 별도 Cron 엔드포인트 (Option B) |

## 데이터 모델 변경

### `TrainingEvent` 모델에 필드 추가

```prisma
equipmentCheckPushSentAt  DateTime?  // 장비 체크 알림 발송 시각 (중복 방지)
```

Prisma 마이그레이션 1회 필요.

## Cron 엔드포인트

**경로:** `GET /api/cron/equipment-check-notification`

**스케줄:** `*/10 * * * *` (10분 간격)

**인증:** `Authorization: Bearer $CRON_SECRET` 헤더 확인

### 실행 흐름

```
1. 쿼리:
   - date <= now
   - equipmentCheckPushSentAt IS NULL
   - team에 isEquipmentManager=true 유저 존재
   - date >= 배포 기준일 (과거 이벤트 알림 폭탄 방지)

2. 각 이벤트별 종료 여부 판단:
   - enablePomVoting=true  → isPomVotingClosed(event.date, event.pomVotingDeadline)
   - enablePomVoting=false → event.date + 2h < now

3. 종료됐으면:
   a. updateMany({ where: { id, equipmentCheckPushSentAt: null }, data: { equipmentCheckPushSentAt: now } })
      → count=0이면 skip (이미 처리됨)
   b. 팀 내 isEquipmentManager=true userId 목록 조회
   c. sendPushToUsers(userIds, payload) 발송

4. 알림 내용:
   - title: "📦 장비함 체크해주세요"
   - body:  "[이벤트 제목] 운동이 끝났어요! 장비 잘 챙겨주세요 🙏"
   - url:   /training/[id]
```

### vercel.json 변경

```json
{
  "path": "/api/cron/equipment-check-notification",
  "schedule": "*/10 * * * *"
}
```

## 엣지 케이스 처리

| 케이스 | 처리 방법 |
|---|---|
| 팀에 장비 담당자 0명 | skip (조용히 넘어감) |
| 장비 담당자 푸시 미구독 | `sendPushToUsers` 내부에서 자연스럽게 skip |
| 동시 실행 중복 발송 | `updateMany` check-and-set으로 원자적 방지 |
| 과거 이벤트 (마이그레이션 후) | 쿼리에 `date >= 배포 기준일` 가드 추가로 방지 |
| VAPID 미설정 환경 | `sendPushToUsers` 내부에서 조용히 return |

## 파일 목록

| 파일 | 변경 내용 |
|---|---|
| `prisma/schema.prisma` | `equipmentCheckPushSentAt DateTime?` 추가 |
| `prisma/migrations/` | 자동 생성 마이그레이션 |
| `src/app/api/cron/equipment-check-notification/route.ts` | 신규 생성 |
| `vercel.json` | crons 배열에 신규 엔드포인트 추가 |

## 기존 코드 재사용

- `src/lib/push.ts` — `sendPushToUsers()` 그대로 사용
- `src/lib/pom.ts` — `isPomVotingClosed()` 그대로 사용
- MVP Cron (`/api/cron/mvp-notification`)의 원자적 check-and-set 패턴 그대로 적용
