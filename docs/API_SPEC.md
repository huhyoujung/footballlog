# 네모의 꿈 - API 명세서

## 📡 API 개요

**Base URL**: `/api`
**인증**: NextAuth.js 세션 기반
**응답 형식**: JSON

### 공통 응답 형식

**성공 (200)**:
```json
{
  "data": { ... }
}
```

**생성 성공 (201)**:
```json
{
  "data": { "id": "...", ... }
}
```

**에러 (4xx, 5xx)**:
```json
{
  "error": "에러 메시지"
}
```

### 인증 헤더

세션 쿠키 자동 전송 (NextAuth.js)

---

## 🔐 인증 (Auth)

### `POST /api/auth/[...nextauth]`

NextAuth.js 엔드포인트 (자동 생성)

**Provider**: Google OAuth

**Callbacks**:
- `signIn`: 사용자 정보 DB 저장
- `session`: 세션에 userId, teamId, role 추가

---

## 👤 프로필 (Profile)

### `PUT /api/profile`

프로필 수정

**권한**: 로그인 사용자

**Request Body**:
```json
{
  "name": "홍길동",
  "position": "FW",
  "number": 10
}
```

**Response**:
```json
{
  "data": {
    "id": "user_123",
    "name": "홍길동",
    "position": "FW",
    "number": 10,
    "email": "user@example.com",
    "role": "MEMBER",
    "teamId": "team_123"
  }
}
```

**에러**:
- `401`: 인증 필요
- `400`: 유효하지 않은 입력

---

## 👥 팀 (Teams)

### `POST /api/teams`

팀 생성

**권한**: 로그인 사용자 (팀 미가입)

**Request Body**:
```json
{
  "name": "네모의 꿈 FC",
  "primaryColor": "#967B5D",
  "logoUrl": "https://cloudinary.com/..."
}
```

**Response**:
```json
{
  "data": {
    "id": "team_123",
    "name": "네모의 꿈 FC",
    "inviteCode": "abc123xyz",
    "primaryColor": "#967B5D",
    "createdBy": "user_123"
  }
}
```

### `POST /api/teams/join`

팀 가입

**권한**: 로그인 사용자 (팀 미가입)

**Request Body**:
```json
{
  "inviteCode": "abc123xyz",
  "name": "홍길동",
  "position": "MF",
  "number": 7
}
```

**Response**:
```json
{
  "data": {
    "userId": "user_123",
    "teamId": "team_123",
    "role": "MEMBER"
  }
}
```

**에러**:
- `404`: 유효하지 않은 초대 코드
- `400`: 이미 팀에 가입됨

### `GET /api/teams/search?code={inviteCode}`

초대 코드로 팀 검색

**권한**: 로그인 사용자

**Response**:
```json
{
  "data": {
    "id": "team_123",
    "name": "네모의 꿈 FC",
    "memberCount": 15,
    "logoUrl": "https://..."
  }
}
```

### `PUT /api/teams/role`

팀원 권한 변경

**권한**: ADMIN

**Request Body**:
```json
{
  "userId": "user_456",
  "role": "ADMIN"
}
```

**Response**:
```json
{
  "data": {
    "userId": "user_456",
    "role": "ADMIN"
  }
}
```

### `PUT /api/teams/vest-order`

조끼 당번 순서 변경

**권한**: ADMIN

**Request Body**:
```json
{
  "vestOrder": ["user_123", "user_456", "user_789"]
}
```

**Response**:
```json
{
  "data": {
    "vestOrder": ["user_123", "user_456", "user_789"]
  }
}
```

### `GET /api/teams/attendance-rate`

팀 출석 통계

**권한**: 로그인 사용자 (같은 팀)

**Response**:
```json
{
  "data": {
    "teamStats": {
      "totalEvents": 20,
      "averageAttendance": 12.5,
      "averageAttendanceRate": 83.3
    },
    "memberStats": [
      {
        "userId": "user_123",
        "name": "홍길동",
        "totalEvents": 20,
        "attended": 18,
        "late": 1,
        "absent": 1,
        "attendanceRate": 90.0
      }
    ]
  }
}
```

---

## 📝 운동 일지 (Training Logs)

### `POST /api/training-logs`

일지 작성

**권한**: 로그인 사용자 (팀 가입 완료)

**Request Body**:
```json
{
  "trainingEventId": "event_123",  // null이면 개인 운동
  "title": "개인 런닝",             // 개인 운동일 때만 필수
  "trainingDate": "2026-02-09T19:00:00Z",
  "condition": 8,
  "conditionReason": "컨디션이 정말 좋았어요!",
  "keyPoints": "슈팅 정확도가 많이 향상됐어요",
  "improvement": "패스 타이밍을 더 연습해야겠어요",
  "imageUrl": "https://cloudinary.com/...",
  "taggedUserIds": ["user_456", "user_789"]
}
```

**Response**:
```json
{
  "data": {
    "id": "log_123",
    "userId": "user_123",
    "trainingEventId": "event_123",
    "trainingDate": "2026-02-09T19:00:00Z",
    "condition": 8,
    "createdAt": "2026-02-09T21:00:00Z"
  }
}
```

**Side Effects**:
- 팀 전체에 푸시 알림 (작성자 제외)
- 태그된 유저에게 별도 푸시 알림

### `GET /api/training-logs?cursor={cursor}&limit={limit}`

일지 목록 (피드)

**권한**: 로그인 사용자 (같은 팀)

**Query Params**:
- `cursor`: 페이지네이션 커서 (선택)
- `limit`: 페이지 크기 (기본값: 20)

**Response**:
```json
{
  "data": {
    "logs": [
      {
        "id": "log_123",
        "user": {
          "id": "user_123",
          "name": "홍길동",
          "image": "https://...",
          "position": "FW",
          "number": 10
        },
        "trainingDate": "2026-02-09T19:00:00Z",
        "condition": 8,
        "imageUrl": "https://...",
        "likesCount": 5,
        "commentsCount": 3,
        "createdAt": "2026-02-09T21:00:00Z",
        "trainingEvent": {
          "id": "event_123",
          "title": "정기 운동"
        }
      }
    ],
    "nextCursor": "log_100"
  }
}
```

### `GET /api/training-logs/{id}`

일지 상세

**권한**: 로그인 사용자 (같은 팀)

**Response**:
```json
{
  "data": {
    "id": "log_123",
    "user": { ... },
    "trainingDate": "2026-02-09T19:00:00Z",
    "condition": 8,
    "conditionReason": "...",
    "keyPoints": "...",
    "improvement": "...",
    "imageUrl": "https://...",
    "taggedUsers": [
      { "id": "user_456", "name": "김철수" }
    ],
    "likes": [
      { "userId": "user_789", "createdAt": "..." }
    ],
    "comments": [
      {
        "id": "comment_1",
        "user": { ... },
        "content": "좋았어요!",
        "createdAt": "..."
      }
    ],
    "isLikedByMe": true,
    "createdAt": "2026-02-09T21:00:00Z"
  }
}
```

### `PUT /api/training-logs/{id}`

일지 수정

**권한**: 작성자 본인

**Request Body**: (수정할 필드만)
```json
{
  "condition": 9,
  "keyPoints": "수정된 내용"
}
```

### `DELETE /api/training-logs/{id}`

일지 삭제

**권한**: 작성자 본인

**Response**:
```json
{
  "data": { "deleted": true }
}
```

---

## ❤️ 좋아요 (Likes)

### `POST /api/training-logs/{id}/likes`

좋아요 토글

**권한**: 로그인 사용자 (같은 팀)

**Request Body**: 없음

**Response**:
```json
{
  "data": {
    "liked": true,
    "likesCount": 6
  }
}
```

**Side Effects**:
- 좋아요 추가 시 일지 작성자에게 푸시 알림 (본인 제외)

---

## 💬 댓글 (Comments)

### `POST /api/training-logs/{id}/comments`

댓글 작성

**권한**: 로그인 사용자 (같은 팀)

**Request Body**:
```json
{
  "content": "@user_789 정말 좋았어요!",
  "mentions": ["user_789"]
}
```

**Response**:
```json
{
  "data": {
    "id": "comment_1",
    "userId": "user_123",
    "trainingLogId": "log_123",
    "content": "@user_789 정말 좋았어요!",
    "mentions": ["user_789"],
    "createdAt": "2026-02-09T22:00:00Z"
  }
}
```

**Side Effects**:
1. 일지 작성자에게 푸시 알림 (본인 제외)
2. 멘션된 유저에게 푸시 알림
3. 같은 일지에 댓글 남긴 사람들에게 푸시 알림

### `DELETE /api/training-logs/{id}/comments/{commentId}`

댓글 삭제

**권한**: 댓글 작성자 본인 또는 ADMIN

**Response**:
```json
{
  "data": { "deleted": true }
}
```

---

## 💪 닦달 (Nudges)

### `POST /api/nudges`

닦달 보내기

**권한**: 로그인 사용자 (같은 팀)

**Request Body**:
```json
{
  "recipientId": "user_456"
}
```

**Response**:
```json
{
  "data": {
    "id": "nudge_123",
    "senderId": "user_123",
    "recipientId": "user_456",
    "createdAt": "2026-02-09T22:00:00Z"
  }
}
```

**제약**:
- 1시간 1회 제한
- 같은 팀 멤버에게만 가능

**에러**:
- `429`: 1시간 이내 이미 닦달 발송함

**Side Effects**:
- 수신자에게 푸시 알림
- 전광판 배너에 메시지 표시 (2시간)

---

## ⚽ 팀 운동 (Training Events)

### `POST /api/training-events`

팀 운동 생성

**권한**: ADMIN

**Request Body**:
```json
{
  "title": "정기 운동",
  "date": "2026-02-15T19:00:00Z",
  "location": "서울 월드컵 경기장",
  "venueId": "venue_123",  // 또는 null
  "shoes": ["AG", "TF"],
  "uniform": "흰색 상의, 검정 하의",
  "notes": "공 2개 가져오기",
  "vestBringerId": "user_123",
  "vestReceiverId": "user_456",
  "rsvpDeadline": "2026-02-15T17:00:00Z",
  "enablePomVoting": true,
  "pomVotingDeadline": "2026-02-15T21:00:00Z",
  "pomVotesPerPerson": 1
}
```

**Response**:
```json
{
  "data": {
    "id": "event_123",
    "title": "정기 운동",
    "date": "2026-02-15T19:00:00Z",
    "createdAt": "2026-02-09T22:00:00Z"
  }
}
```

**Side Effects**:
- 팀 전체에 푸시 알림 (생성자 제외)
- 조끼 담당자에게 별도 푸시 알림

### `GET /api/training-events/{id}`

팀 운동 상세

**권한**: 로그인 사용자 (같은 팀)

**Response**:
```json
{
  "data": {
    "id": "event_123",
    "title": "정기 운동",
    "date": "2026-02-15T19:00:00Z",
    "location": "서울 월드컵 경기장",
    "venue": {
      "id": "venue_123",
      "name": "서울 월드컵 경기장",
      "surface": "인조잔디",
      "recommendedShoes": ["AG", "TF"]
    },
    "uniform": "흰색 상의, 검정 하의",
    "notes": "공 2개 가져오기",
    "vestBringer": { "id": "user_123", "name": "홍길동" },
    "vestReceiver": { "id": "user_456", "name": "김철수" },
    "rsvpDeadline": "2026-02-15T17:00:00Z",
    "rsvpStats": {
      "attend": 12,
      "late": 2,
      "absent": 3,
      "noResponse": 5
    },
    "rsvps": [
      {
        "user": { "id": "user_123", "name": "홍길동" },
        "status": "ATTEND",
        "reason": null,
        "createdAt": "..."
      }
    ],
    "sessions": [
      {
        "id": "session_1",
        "title": "5 vs 5",
        "requiresTeams": true,
        "orderIndex": 0,
        "teamAssignments": [
          {
            "user": { "id": "user_123", "name": "홍길동" },
            "teamLabel": "A팀"
          }
        ]
      }
    ],
    "checkIns": [
      {
        "user": { "id": "user_123", "name": "홍길동" },
        "checkedInAt": "...",
        "isLate": false
      }
    ],
    "lateFees": [
      {
        "user": { "id": "user_789", "name": "이영희" },
        "amount": 5000,
        "status": "PENDING"
      }
    ],
    "equipmentAssignments": [
      {
        "equipment": { "id": "eq_1", "name": "공" },
        "user": { "id": "user_123", "name": "홍길동" },
        "memo": "2개"
      }
    ],
    "pomVotes": [
      {
        "voter": { "id": "user_123", "name": "홍길동" },
        "nominee": { "id": "user_456", "name": "김철수" },
        "reason": "결정력이 좋았어요"
      }
    ]
  }
}
```

### `PUT /api/training-events/{id}`

팀 운동 수정

**권한**: ADMIN

**Request Body**: (수정할 필드만)

### `DELETE /api/training-events/{id}`

팀 운동 삭제

**권한**: ADMIN

### `GET /api/training-events/next`

다음 예정 운동

**권한**: 로그인 사용자 (같은 팤)

**Response**:
```json
{
  "data": {
    "id": "event_123",
    "title": "정기 운동",
    "date": "2026-02-15T19:00:00Z"
  }
}
```

---

## 🙋 RSVP (참석 여부)

### `POST /api/training-events/{id}/rsvp`

참석 여부 응답

**권한**: 로그인 사용자 (같은 팀)

**Request Body**:
```json
{
  "status": "ATTEND",  // "ATTEND" | "LATE" | "ABSENT"
  "reason": "회사 야근"  // LATE, ABSENT일 때만
}
```

**Response**:
```json
{
  "data": {
    "id": "rsvp_123",
    "trainingEventId": "event_123",
    "userId": "user_123",
    "status": "ATTEND",
    "createdAt": "2026-02-09T22:00:00Z"
  }
}
```

**제약**:
- RSVP 마감 전까지만 가능
- 마감 후 에러: `400 RSVP 마감됨`

---

## ✅ 체크인 (Check-in)

### `POST /api/training-events/{id}/check-in`

체크인 생성

**권한**: ADMIN

**Request Body**:
```json
{
  "userId": "user_123",
  "isLate": false
}
```

**Response**:
```json
{
  "data": {
    "id": "checkin_123",
    "trainingEventId": "event_123",
    "userId": "user_123",
    "isLate": false,
    "checkedInAt": "2026-02-15T19:05:00Z"
  }
}
```

---

## 💰 지각비 (Late Fees)

### `POST /api/training-events/{id}/late-fees`

지각비 부과

**권한**: ADMIN

**Request Body**:
```json
{
  "userId": "user_789",
  "amount": 5000
}
```

**Response**:
```json
{
  "data": {
    "id": "fee_123",
    "trainingEventId": "event_123",
    "userId": "user_789",
    "amount": 5000,
    "status": "PENDING",
    "createdAt": "2026-02-15T20:00:00Z"
  }
}
```

### `PUT /api/training-events/{id}/late-fees/{feeId}`

지각비 상태 변경

**권한**: ADMIN

**Request Body**:
```json
{
  "status": "PAID"  // "PENDING" | "PAID"
}
```

### `POST /api/training-events/{id}/notify-late-fees`

지각비 알림 발송

**권한**: ADMIN

**Response**:
```json
{
  "data": {
    "sentCount": 3
  }
}
```

**Side Effects**:
- 모든 지각비 대상자에게 푸시 알림

---

## 🏃 세션 및 팀 배정 (Sessions)

### `POST /api/training-events/{id}/sessions`

세션 생성

**권한**: ADMIN

**Request Body**:
```json
{
  "title": "5 vs 5",
  "memo": "전반 20분",
  "requiresTeams": true,
  "orderIndex": 0
}
```

### `PUT /api/training-events/{id}/sessions/{sessionId}`

세션 수정

**권한**: ADMIN

### `DELETE /api/training-events/{id}/sessions/{sessionId}`

세션 삭제

**권한**: ADMIN

### `PUT /api/training-events/{id}/sessions/reorder-all`

세션 순서 재배치

**권한**: ADMIN

**Request Body**:
```json
{
  "sessionIds": ["session_3", "session_1", "session_2"]
}
```

### `POST /api/training-events/{id}/sessions/{sessionId}/teams`

팀 배정

**권한**: ADMIN

**Request Body**:
```json
{
  "assignments": [
    { "userId": "user_123", "teamLabel": "A팀" },
    { "userId": "user_456", "teamLabel": "B팀" }
  ]
}
```

**Response**:
```json
{
  "data": {
    "sessionId": "session_1",
    "assignments": [...]
  }
}
```

### `PUT /api/training-events/{id}/sessions/{sessionId}/reorder`

세션 내 팀원 순서 변경

**권한**: ADMIN

**Request Body**:
```json
{
  "userIds": ["user_123", "user_456", "user_789"]
}
```

### `POST /api/training-events/{id}/notify-team-assignments`

팀 배정 알림 발송

**권한**: ADMIN

**Response**:
```json
{
  "data": {
    "sentCount": 15
  }
}
```

**Side Effects**:
- 팀 배정된 모든 참석자에게 푸시 알림

---

## 🎽 장비 (Equipment)

### `POST /api/teams/equipment`

장비 생성

**권한**: ADMIN

**Request Body**:
```json
{
  "name": "공",
  "description": "5호 축구공",
  "ownerId": "user_123",  // 기본 담당자 (선택)
  "orderIndex": 0
}
```

### `PUT /api/teams/equipment/{id}`

장비 수정

**권한**: ADMIN

### `DELETE /api/teams/equipment/{id}`

장비 삭제

**권한**: ADMIN

### `PUT /api/teams/equipment/reorder`

장비 순서 변경

**권한**: ADMIN

**Request Body**:
```json
{
  "equipmentIds": ["eq_1", "eq_3", "eq_2"]
}
```

### `POST /api/training-events/{id}/equipment`

운동별 장비 담당자 배정

**권한**: ADMIN

**Request Body**:
```json
{
  "assignments": [
    { "equipmentId": "eq_1", "userId": "user_123", "memo": "2개" },
    { "equipmentId": "eq_2", "userId": "user_456", "memo": null }
  ]
}
```

---

## 🏆 POM 투표 (POM Voting)

### `POST /api/training-events/{id}/pom`

POM 투표

**권한**: 로그인 사용자 (같은 팀)

**Request Body**:
```json
{
  "nomineeId": "user_456",
  "reason": "결정력이 정말 좋았어요!"
}
```

**Response**:
```json
{
  "data": {
    "id": "pom_123",
    "trainingEventId": "event_123",
    "voterId": "user_123",
    "nomineeId": "user_456",
    "reason": "결정력이 정말 좋았어요!",
    "createdAt": "2026-02-15T21:00:00Z"
  }
}
```

**제약**:
- 투표 마감 전까지만 가능
- 1인 N표 (운동 설정에 따라)
- 본인 투표 불가

### `GET /api/pom/recent-mvp`

최근 POM 수상자 목록

**권한**: 로그인 사용자 (같은 팀)

**Response**:
```json
{
  "data": [
    {
      "user": { "id": "user_456", "name": "김철수" },
      "trainingEvent": { "id": "event_123", "title": "정기 운동", "date": "..." },
      "votesCount": 8,
      "reasons": [
        { "voter": { "name": "홍길동" }, "reason": "결정력이 좋았어요" }
      ]
    }
  ]
}
```

---

## 📍 장소 (Venues)

### `POST /api/venues`

장소 생성

**권한**: ADMIN

**Request Body**:
```json
{
  "name": "서울 월드컵 경기장",
  "address": "서울 마포구 ...",
  "surface": "인조잔디",
  "recommendedShoes": ["AG", "TF"]
}
```

### `GET /api/venues`

장소 목록 (팀별)

**권한**: 로그인 사용자 (같은 팀)

**Response**:
```json
{
  "data": [
    {
      "id": "venue_123",
      "name": "서울 월드컵 경기장",
      "usageCount": 15,
      "surface": "인조잔디"
    }
  ]
}
```

---

## 🔔 푸시 알림 (Push Notifications)

### `POST /api/push/subscribe`

푸시 구독

**권한**: 로그인 사용자

**Request Body**:
```json
{
  "subscription": {
    "endpoint": "https://fcm.googleapis.com/...",
    "keys": {
      "p256dh": "...",
      "auth": "..."
    }
  }
}
```

**Response**:
```json
{
  "data": {
    "id": "sub_123",
    "userId": "user_123",
    "endpoint": "https://...",
    "createdAt": "2026-02-09T22:00:00Z"
  }
}
```

### `DELETE /api/push/subscribe`

푸시 구독 해제

**권한**: 로그인 사용자

**Request Body**:
```json
{
  "endpoint": "https://fcm.googleapis.com/..."
}
```

**Response**:
```json
{
  "data": { "deleted": true }
}
```

---

## 📤 파일 업로드 (Upload)

### `POST /api/upload`

이미지 업로드 (Cloudinary)

**권한**: 로그인 사용자

**Request Body**: `multipart/form-data`
- `file`: 이미지 파일 (최대 10MB)

**Response**:
```json
{
  "data": {
    "url": "https://res.cloudinary.com/.../image.jpg"
  }
}
```

**제약**:
- 이미지 파일만 (JPEG, PNG, GIF, WebP)
- 최대 10MB

---

## ⏰ Cron Jobs

### `GET /api/cron/rsvp-reminder`

RSVP 리마인더 발송 (자동)

**실행 주기**: 30분마다 (Vercel Cron)

**동작**:
1. 마감 2시간 전인 운동 조회
2. RSVP 미응답 팀원에게 푸시 알림

**응답**:
```json
{
  "data": {
    "processedEvents": 3,
    "sentNotifications": 12
  }
}
```

---

## 🔍 조끼 담당 추천

### `GET /api/training-events/vest-suggestion`

조끼 담당자 자동 추천

**권한**: ADMIN

**Query Params**:
- `date`: 운동 날짜 (ISO 8601)

**Response**:
```json
{
  "data": {
    "vestBringer": {
      "id": "user_123",
      "name": "홍길동",
      "lastAssignedDate": "2026-01-15"
    },
    "vestReceiver": {
      "id": "user_456",
      "name": "김철수",
      "lastAssignedDate": "2026-01-20"
    }
  }
}
```

**로직**:
1. `Team.vestOrder` 배열 참조
2. 최근 담당했던 사람 건너뛰기
3. 순서대로 다음 사람 추천

---

## 📊 응답 코드 정리

| 코드 | 의미 | 예시 |
|-----|------|------|
| 200 | 성공 | GET, PUT, DELETE 성공 |
| 201 | 생성 성공 | POST 성공 |
| 400 | 잘못된 요청 | 유효하지 않은 입력, 제약 위반 |
| 401 | 인증 필요 | 로그인 안 됨 |
| 403 | 권한 없음 | ADMIN 전용 API를 MEMBER가 호출 |
| 404 | 리소스 없음 | 존재하지 않는 ID |
| 429 | 요청 제한 | 닦달 1시간 제한 |
| 500 | 서버 에러 | 예상치 못한 에러 |

---

## 🔐 권한 체계 요약

| API | 권한 |
|-----|------|
| 프로필 수정 | 본인 |
| 팀 생성/가입 | 로그인 (팀 미가입) |
| 팀 설정 변경 | ADMIN |
| 운영진 관리 | ADMIN |
| 조끼 당번 관리 | ADMIN |
| 장비 관리 | ADMIN |
| 일지 작성 | 로그인 (팀 가입) |
| 일지 수정/삭제 | 본인 |
| 댓글 작성 | 로그인 (같은 팀) |
| 댓글 삭제 | 본인 또는 ADMIN |
| 좋아요 | 로그인 (같은 팀) |
| 닦달 | 로그인 (같은 팀) |
| 팀 운동 생성/수정/삭제 | ADMIN |
| RSVP | 로그인 (같은 팀) |
| 체크인 | ADMIN |
| 지각비 | ADMIN |
| 세션/팀 배정 | ADMIN |
| POM 투표 | 로그인 (같은 팀) |

---

**최종 수정일**: 2026-02-09
**버전**: 1.0.0
