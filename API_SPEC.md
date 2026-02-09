# API Specification

Football Log API 명세서

## Base URL
- Development: `http://localhost:3000/api`
- Production: `https://footballlog.vercel.app/api`

## Authentication
모든 API는 NextAuth.js 세션 기반 인증을 사용합니다.

---

## Teams API

### `GET /api/teams`
현재 사용자의 팀 정보 조회

**Response**
```json
{
  "id": "string",
  "name": "string",
  "code": "string",
  "vestOrder": ["userId1", "userId2"],
  "lateFeeMinutes": 10,
  "lateFeeAmount": 5000,
  "members": [
    {
      "id": "string",
      "name": "string",
      "email": "string",
      "image": "string",
      "role": "USER | ADMIN",
      "position": "string",
      "number": 10
    }
  ]
}
```

### `POST /api/teams`
새 팀 생성

**Request Body**
```json
{
  "name": "string",
  "position": "string",
  "number": 10
}
```

### `POST /api/teams/join`
팀 가입

**Request Body**
```json
{
  "code": "string",
  "position": "string",
  "number": 10
}
```

### `GET /api/teams/search?code=ABC123`
팀 코드로 팀 검색

**Response**
```json
{
  "name": "string",
  "memberCount": 10
}
```

### `PUT /api/teams/vest-order`
조끼 당번 순서 업데이트 (운영진 전용)

**Request Body**
```json
{
  "vestOrder": ["userId1", "userId2"]
}
```

### `POST /api/teams/role`
운영진 추가/제거 (운영진 전용)

**Request Body**
```json
{
  "userId": "string",
  "action": "ADD | REMOVE"
}
```

### `GET /api/teams/attendance-rate`
팀원별 출석률 조회

**Response**
```json
{
  "members": [
    {
      "id": "string",
      "name": "string",
      "image": "string",
      "totalEvents": 10,
      "attendedEvents": 8,
      "attendanceRate": 80
    }
  ]
}
```

### `GET /api/teams/equipment`
팀 장비 목록 조회

**Response**
```json
{
  "equipments": [
    {
      "id": "string",
      "name": "string",
      "userId": "string | null"
    }
  ]
}
```

---

## Training Events API

### `GET /api/training-events`
팀 운동 목록 조회

**Query Parameters**
- `filter`: `upcoming` | `past` (optional)

**Response**
```json
{
  "events": [
    {
      "id": "string",
      "title": "string",
      "date": "ISO8601",
      "location": "string",
      "rsvpDeadline": "ISO8601",
      "_count": {
        "rsvps": 10
      }
    }
  ]
}
```

### `POST /api/training-events`
팀 운동 생성 (운영진 전용)

**Request Body**
```json
{
  "title": "string",
  "isRegular": true,
  "enablePomVoting": true,
  "pomVotingDeadline": "ISO8601",
  "pomVotesPerPerson": 1,
  "date": "ISO8601",
  "location": "string",
  "shoes": ["축구화", "풋살화"],
  "uniform": "string | null",
  "notes": "string | null",
  "vestBringerId": "string | null",
  "vestReceiverId": "string | null",
  "rsvpDeadline": "ISO8601"
}
```

**Validation Rules**
- `rsvpDeadline` must be before `date`
- `pomVotingDeadline` must be after `date` (if enabled)

### `GET /api/training-events/[id]`
팀 운동 상세 조회

**Query Parameters**
- `includeManagement`: `true` (운영진 전용, 세션/지각비 포함)
- `edit`: `true` (수정 페이지용 데이터)

**Response**
```json
{
  "id": "string",
  "title": "string",
  "isRegular": true,
  "enablePomVoting": true,
  "pomVotingDeadline": "ISO8601",
  "pomVotesPerPerson": 1,
  "date": "ISO8601",
  "location": "string",
  "shoes": ["축구화"],
  "uniform": "string | null",
  "notes": "string | null",
  "vestBringer": { "name": "string" },
  "vestReceiver": { "name": "string" },
  "rsvpDeadline": "ISO8601",
  "venue": {
    "name": "string",
    "address": "string"
  },
  "rsvps": [
    {
      "userId": "string",
      "status": "YES | NO | MAYBE",
      "user": {
        "name": "string",
        "image": "string"
      }
    }
  ],
  "checkIns": [
    {
      "userId": "string",
      "checkInTime": "ISO8601",
      "user": { "name": "string" }
    }
  ],
  "pomVotes": [
    {
      "voterId": "string",
      "votedUserId": "string"
    }
  ]
}
```

### `PUT /api/training-events/[id]`
팀 운동 수정 (운영진 전용)

**Request Body**: Same as POST

### `DELETE /api/training-events/[id]`
팀 운동 삭제 (운영진 전용)

### `POST /api/training-events/[id]/rsvp`
RSVP 응답 생성/업데이트

**Request Body**
```json
{
  "status": "YES | NO | MAYBE"
}
```

### `POST /api/training-events/[id]/check-in`
체크인

**Response**
```json
{
  "checkInTime": "ISO8601",
  "isLate": false
}
```

### `DELETE /api/training-events/[id]/check-in`
체크인 취소

### `POST /api/training-events/[id]/pom-vote`
MVP 투표

**Request Body**
```json
{
  "votedUserIds": ["userId1", "userId2"]
}
```

### `POST /api/training-events/[id]/sessions`
세션 생성 (운영진 전용)

**Request Body**
```json
{
  "title": "string",
  "participants": ["userId1", "userId2"]
}
```

### `PUT /api/training-events/[id]/sessions/[sessionId]`
세션 수정 (운영진 전용)

**Request Body**
```json
{
  "title": "string",
  "participants": ["userId1"]
}
```

### `DELETE /api/training-events/[id]/sessions/[sessionId]`
세션 삭제 (운영진 전용)

### `PUT /api/training-events/[id]/late-fee`
지각비 설정 업데이트 (운영진 전용)

**Request Body**
```json
{
  "minutes": 10,
  "amount": 5000
}
```

### `PUT /api/training-events/[id]/late-fee/[userId]`
지각비 납부 상태 토글 (운영진 전용)

### `PUT /api/training-events/[id]/equipment`
장비 배정 저장 (운영진 전용)

**Request Body**
```json
{
  "assignments": {
    "equipmentId1": { "userId": "userId1" },
    "equipmentId2": { "userId": null }
  }
}
```

### `GET /api/training-events/next`
다음 예정된 팀 운동 조회

**Response**
```json
{
  "event": {
    "id": "string",
    "title": "string",
    "date": "ISO8601",
    "location": "string"
  }
}
```

### `GET /api/training-events/vest-suggestion`
조끼 당번 추천

**Response**
```json
{
  "members": [...],
  "bringer": { "id": "string" },
  "receiver": { "id": "string" }
}
```

---

## Training Logs API

### `GET /api/training-logs`
운동 일지 목록 조회

**Query Parameters**
- `userId`: 특정 사용자의 일지만 조회 (optional)

**Response**
```json
{
  "logs": [
    {
      "id": "string",
      "imageUrl": "string",
      "keyPoints": "string",
      "createdAt": "ISO8601",
      "author": {
        "name": "string",
        "image": "string"
      },
      "_count": {
        "likes": 10,
        "comments": 5
      },
      "isLiked": true
    }
  ]
}
```

### `POST /api/training-logs`
운동 일지 작성

**Request Body**
```json
{
  "imageUrl": "string",
  "keyPoints": "string"
}
```

### `GET /api/training-logs/[id]`
운동 일지 상세 조회

**Response**
```json
{
  "id": "string",
  "imageUrl": "string",
  "keyPoints": "string",
  "createdAt": "ISO8601",
  "author": {
    "name": "string",
    "image": "string"
  },
  "likes": [
    {
      "userId": "string",
      "user": { "name": "string" }
    }
  ],
  "comments": [
    {
      "id": "string",
      "content": "string",
      "createdAt": "ISO8601",
      "author": { "name": "string" }
    }
  ],
  "_count": {
    "likes": 10,
    "comments": 5
  },
  "isLiked": true
}
```

### `POST /api/training-logs/[id]/like`
좋아요 토글

### `POST /api/training-logs/[id]/comment`
댓글 작성

**Request Body**
```json
{
  "content": "string"
}
```

---

## Venues API

### `GET /api/venues?search=구장명`
구장 검색 및 자동완성

**Response**
```json
{
  "venues": [
    {
      "id": "string",
      "name": "string",
      "address": "string",
      "surface": "인조잔디",
      "recommendedShoes": ["축구화", "풋살화"],
      "usageCount": 5
    }
  ]
}
```

---

## Push Notifications API

### `POST /api/push/subscribe`
푸시 알림 구독

**Request Body**
```json
{
  "subscription": {
    "endpoint": "string",
    "keys": {
      "p256dh": "string",
      "auth": "string"
    }
  }
}
```

### `GET /api/push/check`
푸시 알림 구독 상태 확인

**Response**
```json
{
  "subscribed": true
}
```

---

## Upload API

### `POST /api/upload`
이미지 업로드 (Vercel Blob)

**Request Body**: FormData with `file`

**Response**
```json
{
  "url": "https://..."
}
```

---

## Nudges API

### `GET /api/nudges`
닦달 메시지 및 활동 피드 조회

**Response**
```json
{
  "nudges": [
    {
      "type": "rsvp",
      "text": "운동 2시간 전입니다! RSVP 응답해주세요",
      "url": "/training/123"
    }
  ],
  "activities": [
    {
      "text": "홍길동님이 운동에 참석 응답했습니다",
      "url": "/training/123"
    }
  ]
}
```

---

## POM (Player of Match) API

### `GET /api/pom/recent-mvp`
최근 MVP 조회

**Response**
```json
{
  "mvp": {
    "name": "string",
    "image": "string",
    "voteCount": 5
  },
  "event": {
    "title": "string",
    "date": "ISO8601"
  }
}
```

---

## Cron Jobs

### `GET /api/cron/rsvp-reminder`
RSVP 닦달 크론잡 (Vercel Cron, 매시간)
- 운동 2시간 전에 미응답자에게 푸시 알림 전송

---

## Error Responses

모든 API는 오류 발생 시 다음 형식으로 응답합니다:

```json
{
  "error": "Error message"
}
```

### Common Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error
