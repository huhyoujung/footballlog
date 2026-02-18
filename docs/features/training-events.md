# 팀 운동 이벤트
> 팀 운동 생성/수정/삭제, RSVP 응답, 체크인, 세션 관리, 지각비, 장비 배정, 날씨 연동

## 개요

운영진(ADMIN)이 팀 운동 이벤트를 생성하면 팀원에게 푸시 알림이 발송된다. 팀원은 RSVP로 참석/불참/지각을 응답하고, 운동 당일 시간 범위 내에 체크인한다. 운영진은 세션(팀 배정 포함), 지각비, 장비 배정을 관리할 수 있다. 구장 선택 시 네이버 지도 API로 장소를 검색하고, 날씨 정보를 자동 조회하여 함께 저장한다.

### 하위 기능

| ID | 하위 기능 | 설명 |
|----|-----------|------|
| 3-1 | 이벤트 CRUD | 운동 생성/수정/삭제/목록/상세, 구장 자동 생성, 푸시 알림 |
| 3-2 | RSVP | 참석/불참/지각 응답, 마감 시간, 사유 필수, upsert |
| 3-3 | 체크인 | 2시간 전~후 시간 제한, 지각 자동 판정, 중복 방지 |
| 3-4 | 세션 & 팀 배정 | 훈련 세션 CRUD, 팀 배정, orderIndex |
| 3-5 | 지각비 | ADMIN 부과, 금액 검증, PENDING/PAID 상태 |
| 3-6 | 장비 배정 | 운동별 장비 배정, 담당자 지정 |

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/app/api/training-events/route.ts` | 운동 목록 조회(GET), 생성(POST) |
| `src/app/api/training-events/[id]/route.ts` | 운동 상세 조회(GET), 수정(PUT), 삭제(DELETE) |
| `src/app/api/training-events/[id]/rsvp/route.ts` | RSVP 조회(GET), 응답(POST) |
| `src/app/api/training-events/[id]/check-in/route.ts` | 체크인 조회(GET), 기록(POST), 취소(DELETE) |
| `src/app/api/training-events/[id]/sessions/route.ts` | 세션 조회(GET), 생성(POST) |
| `src/app/api/training-events/[id]/late-fees/route.ts` | 지각비 조회(GET), 부과(POST) |
| `src/app/training/[id]/page.tsx` | 운동 상세 페이지 |
| `src/app/training/create/page.tsx` | 운동 생성 페이지 |

## API 엔드포인트

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| `GET` | `/api/training-events?filter={upcoming\|recent\|past}` | 로그인 | 운동 목록 조회 |
| `POST` | `/api/training-events` | ADMIN | 운동 생성 + 팀 푸시 알림 |
| `GET` | `/api/training-events/:id` | 로그인 | 운동 상세 조회 (같은 팀만) |
| `PUT` | `/api/training-events/:id` | ADMIN | 운동 수정 |
| `DELETE` | `/api/training-events/:id` | ADMIN | 운동 삭제 |
| `GET` | `/api/training-events/:id/rsvp` | 로그인 | RSVP 목록 조회 |
| `POST` | `/api/training-events/:id/rsvp` | 로그인 | RSVP 응답 (upsert) |
| `GET` | `/api/training-events/:id/check-in` | 로그인 | 체크인 목록 조회 |
| `POST` | `/api/training-events/:id/check-in` | 로그인 | 체크인 기록 |
| `DELETE` | `/api/training-events/:id/check-in` | 로그인 | 체크인 취소 |
| `GET` | `/api/training-events/:id/sessions` | 로그인 | 세션 목록 조회 |
| `POST` | `/api/training-events/:id/sessions` | ADMIN | 세션 생성 |
| `GET` | `/api/training-events/:id/late-fees` | 로그인 | 지각비 목록 조회 |
| `POST` | `/api/training-events/:id/late-fees` | ADMIN | 지각비 부과 |

## 주요 코드

### 3-1. 이벤트 CRUD

#### 운동 목록 조회 - 필터링 (`src/app/api/training-events/route.ts` - GET)

운동 시작 후 4시간까지는 "예정된 운동"으로 분류한다. `upcoming`, `recent`(30일 이내), `past` 필터를 지원한다.

```typescript
// src/app/api/training-events/route.ts - GET
const filter = searchParams.get("filter") || "upcoming";

const now = new Date();
const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

// 운동 시작 후 4시간까지는 "예정된 운동"으로 표시
const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000);

if (filter === "upcoming") {
  whereCondition.date = { gte: fourHoursAgo };
} else if (filter === "recent") {
  // 최근 30일 이내 또는 4시간 이상 지난 운동
  whereCondition.date = { gte: thirtyDaysAgo, lt: fourHoursAgo };
} else {
  // past: 4시간 이상 지난 운동
  whereCondition.date = { lt: fourHoursAgo };
}
```

#### 운동 생성 + 푸시 알림 (`src/app/api/training-events/route.ts` - POST)

구장이 없으면 자동 생성하고, 운동 생성 후 팀 전체 + 조끼 담당자에게 개별 푸시 알림을 발송한다.

```typescript
// src/app/api/training-events/route.ts - POST
// 구장 찾기 또는 생성
let venueId: string | null = null;
if (location && location.trim()) {
  let venue = await prisma.venue.findUnique({
    where: {
      teamId_name: {
        teamId: session.user.teamId,
        name: location.trim(),
      },
    },
  });

  if (!venue) {
    venue = await prisma.venue.create({
      data: {
        teamId: session.user.teamId,
        name: location.trim(),
        address: venueData?.address || null,
        mapUrl: venueData?.mapUrl || null,
        latitude: venueData?.latitude || null,
        longitude: venueData?.longitude || null,
        recommendedShoes: Array.isArray(shoes) ? shoes : [],
        usageCount: 1,
      },
    });
  } else {
    await updateVenueRecommendation(venue.id, Array.isArray(shoes) ? shoes : []);
  }
  venueId = venue.id;
}
```

조끼 담당자에게는 역할에 따라 메시지를 분기하여 푸시 알림을 보낸다.

```typescript
// src/app/api/training-events/route.ts - POST (조끼 알림)
for (const userId of uniqueIds) {
  const isBringer = userId === vestBringerId;
  const isReceiver = userId === vestReceiverId;

  let message = "";
  if (isBringer && isReceiver) {
    message = "조끼를 가져오고 가져가주세요!";
  } else if (isBringer) {
    message = "조끼를 가져와주세요!";
  } else {
    message = "조끼를 가져가주세요!";
  }

  await sendPushToUsers([userId], {
    title: "조끼 담당",
    body: `${message} ${dateStr}`,
    url: `/training/${event.id}`,
  });
}
```

### 3-2. RSVP

#### RSVP 응답 (`src/app/api/training-events/[id]/rsvp/route.ts` - POST)

마감 시간을 체크하고, 불참/지각 시 사유를 필수로 요구한다. `upsert`를 사용하여 기존 응답을 덮어쓴다. RSVP 응답 후 운영진에게 푸시 알림을 보낸다.

```typescript
// src/app/api/training-events/[id]/rsvp/route.ts - POST
// 마감 확인
if (new Date() > event.rsvpDeadline) {
  return NextResponse.json({ error: "마감 시간이 지났습니다" }, { status: 400 });
}

if (!["ATTEND", "ABSENT", "LATE"].includes(status)) {
  return NextResponse.json({ error: "올바른 응답을 선택해주세요" }, { status: 400 });
}

if ((status === "ABSENT" || status === "LATE") && !reason?.trim()) {
  return NextResponse.json({ error: "사유를 입력해주세요" }, { status: 400 });
}

const rsvp = await prisma.rsvp.upsert({
  where: {
    trainingEventId_userId: {
      trainingEventId: id,
      userId: session.user.id,
    },
  },
  update: {
    status,
    reason: status === "ATTEND" ? null : reason?.trim(),
  },
  create: {
    trainingEventId: id,
    userId: session.user.id,
    status,
    reason: status === "ATTEND" ? null : reason?.trim(),
  },
});
```

RSVP 응답 시 운영진에게 알림을 보낸다 (본인은 제외).

```typescript
// src/app/api/training-events/[id]/rsvp/route.ts - 푸시 알림
const admins = await prisma.user.findMany({
  where: {
    teamId: session.user.teamId,
    role: "ADMIN",
    id: { not: session.user.id }, // 본인 제외
  },
  select: { id: true },
});

if (admins.length > 0) {
  const statusText = status === "ATTEND" ? "참석" : status === "LATE" ? "지각" : "불참";
  const userName = session.user.name || "팀원";

  await sendPushToUsers(
    admins.map((a) => a.id),
    {
      title: "RSVP 응답",
      body: `${userName}님이 ${statusText}으로 응답했습니다`,
      url: `/training/${id}`,
    }
  );
}
```

### 3-3. 체크인

#### 체크인 (`src/app/api/training-events/[id]/check-in/route.ts` - POST)

운동 시작 2시간 전 ~ 2시간 후까지만 체크인이 가능하다. RSVP에서 ATTEND 또는 LATE로 응답한 사용자만 체크인할 수 있으며, 운동 시작 시간 이후 체크인하면 지각(`isLate: true`)으로 기록된다.

```typescript
// src/app/api/training-events/[id]/check-in/route.ts - POST
// 시간 검증: 운동 시작 2시간 전 ~ 2시간 후까지 체크인 가능
const now = new Date();
const twoHoursBefore = new Date(event.date.getTime() - 2 * 60 * 60 * 1000);
const twoHoursAfter = new Date(event.date.getTime() + 2 * 60 * 60 * 1000);

if (now < twoHoursBefore) {
  return NextResponse.json({ error: "운동 2시간 전부터 체크인할 수 있습니다" }, { status: 400 });
}

if (now > twoHoursAfter) {
  return NextResponse.json({ error: "체크인 시간이 종료되었습니다" }, { status: 400 });
}

// RSVP 확인 (ATTEND 또는 LATE만 체크인 가능)
const rsvp = await prisma.rsvp.findUnique({
  where: {
    trainingEventId_userId: {
      trainingEventId: id,
      userId: session.user.id,
    },
  },
});

if (!rsvp || (rsvp.status !== "ATTEND" && rsvp.status !== "LATE")) {
  return NextResponse.json({ error: "RSVP한 사람만 체크인할 수 있습니다" }, { status: 400 });
}

// 중복 체크
const existing = await prisma.checkIn.findUnique({
  where: {
    trainingEventId_userId: {
      trainingEventId: id,
      userId: session.user.id,
    },
  },
});

if (existing) {
  return NextResponse.json({ error: "이미 체크인했습니다" }, { status: 409 });
}

const isLate = now > event.date;

const checkIn = await prisma.checkIn.create({
  data: {
    trainingEventId: id,
    userId: session.user.id,
    checkedInAt: now,
    isLate,
  },
});
```

### 3-4. 세션 & 팀 배정

#### 세션 생성 (`src/app/api/training-events/[id]/sessions/route.ts` - POST)

운동 내 세션(훈련 단위)을 생성한다. `orderIndex`를 자동 증가시켜 순서를 유지한다. 팀 배정(`requiresTeams`)을 지원한다.

```typescript
// src/app/api/training-events/[id]/sessions/route.ts - POST
const { title, memo, requiresTeams } = await req.json();

// 다음 orderIndex 계산
const lastSession = await prisma.trainingSession.findFirst({
  where: { trainingEventId: id },
  orderBy: { orderIndex: "desc" },
});

const trainingSession = await prisma.trainingSession.create({
  data: {
    trainingEventId: id,
    title: title || null,
    memo: memo || null,
    requiresTeams: requiresTeams ?? false,
    orderIndex: (lastSession?.orderIndex ?? -1) + 1,
  },
  include: {
    teamAssignments: {
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    },
  },
});
```

### 3-5. 지각비

#### 지각비 부과 (`src/app/api/training-events/[id]/late-fees/route.ts` - POST)

ADMIN이 대상 사용자와 금액을 지정하여 지각비를 부과한다.

```typescript
// src/app/api/training-events/[id]/late-fees/route.ts - POST
const { userId, amount } = await req.json();

if (!userId || !amount || amount <= 0) {
  return NextResponse.json({ error: "대상과 금액을 입력해주세요" }, { status: 400 });
}

const lateFee = await prisma.lateFee.create({
  data: {
    trainingEventId: id,
    userId,
    amount,
  },
});
```

### 3-6. 장비 배정

> 장비 배정 관련 코드는 `src/app/api/training-events/[id]/equipment/` 하위에 위치한다. 운동별로 장비를 배정하고 담당자를 지정하는 기능이다.

#### 운동 상세 조회 - 조건부 세션 로딩 (`src/app/api/training-events/[id]/route.ts` - GET)

`includeSessions=true` 쿼리 파라미터가 있을 때만 세션 데이터를 포함하여 응답 크기를 최적화한다. 같은 팀이 아닌 사용자는 조회할 수 없다.

```typescript
// src/app/api/training-events/[id]/route.ts - GET
const url = new URL(req.url);
const includeSessions = url.searchParams.get("includeSessions") === "true";

const event = await prisma.trainingEvent.findUnique({
  where: { id },
  include: {
    venue: { select: { id: true, name: true, mapUrl: true, latitude: true, longitude: true } },
    vestBringer: { select: userSelect },
    vestReceiver: { select: userSelect },
    rsvps: {
      include: { user: { select: userSelect } },
      orderBy: { createdAt: "asc" },
    },
    checkIns: {
      include: { user: { select: userSelect } },
      orderBy: { checkedInAt: "asc" },
    },
    ...(includeSessions && {
      sessions: {
        include: {
          teamAssignments: {
            include: { user: { select: userSelect } },
          },
        },
        orderBy: { orderIndex: "asc" },
      },
    }),
  },
});

if (event.teamId !== session.user.teamId) {
  return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
}
```

#### 운동 수정 - 조끼 당번 변경 검증 (`src/app/api/training-events/[id]/route.ts` - PUT)

조끼 당번을 수정할 때, 이후 운동에 이미 조끼 당번이 설정되어 있으면 수정을 거부한다.

```typescript
// src/app/api/training-events/[id]/route.ts - PUT
if (body.vestBringerId !== undefined || body.vestReceiverId !== undefined) {
  const laterEventWithVest = await prisma.trainingEvent.findFirst({
    where: {
      teamId: event.teamId,
      date: { gt: event.date },
      OR: [
        { vestBringerId: { not: null } },
        { vestReceiverId: { not: null } },
      ],
    },
    orderBy: { date: "asc" },
  });

  if (laterEventWithVest) {
    return NextResponse.json(
      { error: "이후 운동에 조끼 당번이 설정되어 있어 수정할 수 없습니다" },
      { status: 400 }
    );
  }
}
```

## 비즈니스 규칙

| 규칙 | 설명 |
|------|------|
| 생성 권한 | ADMIN만 운동 생성/수정/삭제 가능 |
| 필수 입력 | 제목, 날짜, 장소, RSVP 마감 |
| RSVP 마감 검증 | RSVP 마감은 운동 시작 시간 이전이어야 함 |
| RSVP 응답 종류 | ATTEND(참석), ABSENT(불참), LATE(지각) |
| 불참/지각 사유 필수 | ABSENT 또는 LATE 선택 시 사유(`reason`) 입력 필수 |
| RSVP 마감 후 응답 불가 | 마감 시간이 지나면 RSVP 응답 거부 |
| 체크인 시간 제한 | 운동 시작 2시간 전 ~ 2시간 후까지만 체크인 가능 |
| 체크인 전제 조건 | RSVP에서 ATTEND 또는 LATE로 응답한 사용자만 체크인 가능 |
| 지각 자동 판정 | 운동 시작 시간 이후 체크인하면 `isLate: true` |
| 중복 체크인 불가 | 같은 운동에 두 번 체크인 시 409 에러 |
| 체크인 취소 | 본인의 체크인만 취소 가능 |
| 4시간 규칙 | 운동 시작 후 4시간까지 "예정된 운동"으로 분류 |
| 구장 자동 생성 | 입력된 장소가 DB에 없으면 새 구장 레코드를 자동 생성 |
| 신발 추천 갱신 | 운동 생성 시 선택한 신발이 해당 구장의 추천 신발로 업데이트됨 |
| 조끼 당번 수정 제약 | 이후 운동에 조끼 당번이 이미 설정되어 있으면 현재 운동의 조끼 당번 수정 불가 |
| 세션 lazy 로딩 | 운동 상세 조회 시 `includeSessions=true` 파라미터가 있을 때만 세션 데이터 포함 |
| MVP 투표 마감 기본값 | 설정하지 않으면 운동 시작 2시간 후 자동 설정 |
| MVP 투표 마감 검증 | MVP 투표 마감은 운동 시작 시간 이후여야 함 |
| 지각비 금액 | 0보다 큰 정수만 허용 |
| 팀 격리 | 같은 팀의 운동만 조회/수정 가능 |
| 푸시 알림 실패 허용 | 푸시 알림 발송 실패 시에도 운동 생성/RSVP 등은 정상 처리 |

## 데이터 모델

```prisma
enum RsvpStatus {
  ATTEND
  ABSENT
  LATE
}

enum LateFeeStatus {
  PENDING
  PAID
}

model TrainingEvent {
  id                  String    @id @default(cuid())
  teamId              String
  createdById         String
  title               String
  isRegular           Boolean   @default(true)
  enablePomVoting     Boolean   @default(true)
  pomVotingDeadline   DateTime?
  pomVotesPerPerson   Int       @default(1)
  date                DateTime
  location            String
  venueId             String?
  shoes               String[]  @default([])
  uniform             String?   @db.Text
  notes               String?   @db.Text
  vestBringerId       String?
  vestReceiverId      String?
  rsvpDeadline        DateTime
  weather             String?
  weatherDescription  String?
  temperature         Float?
  minTempC            Float?
  maxTempC            Float?
  feelsLikeC          Float?
  precipMm            Float?
  chanceOfRain        Int?
  windKph             Float?
  uvIndex             Float?
  airQualityIndex     Int?
  pm25                Float?
  pm10                Float?
  sunrise             String?
  sunset              String?
  isFriendlyMatch     Boolean   @default(false)
  minimumPlayers      Int?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  rsvps                Rsvp[]
  checkIns             CheckIn[]
  lateFees             LateFee[]
  sessions             TrainingSession[]
  equipmentAssignments EquipmentAssignment[]

  @@index([teamId, date(sort: Desc)])
}

model Rsvp {
  id              String     @id @default(cuid())
  trainingEventId String
  userId          String
  status          RsvpStatus
  reason          String?    @db.Text
  createdAt       DateTime   @default(now())
  updatedAt       DateTime   @updatedAt

  @@unique([trainingEventId, userId])
}

model CheckIn {
  id              String   @id @default(cuid())
  trainingEventId String
  userId          String
  checkedInAt     DateTime @default(now())
  isLate          Boolean  @default(false)

  @@unique([trainingEventId, userId])
}

model LateFee {
  id              String        @id @default(cuid())
  trainingEventId String
  userId          String
  amount          Int
  status          LateFeeStatus @default(PENDING)
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@unique([trainingEventId, userId])
}

model TrainingSession {
  id              String   @id @default(cuid())
  trainingEventId String
  title           String?
  memo            String?  @db.Text
  requiresTeams   Boolean  @default(false)
  orderIndex      Int      @default(0)
  formation       String?
  positions       Json?

  teamAssignments SessionTeamAssignment[]
}

model SessionTeamAssignment {
  id                String @id @default(cuid())
  trainingSessionId String
  userId            String
  teamLabel         String

  @@unique([trainingSessionId, userId])
}

model EquipmentAssignment {
  id              String  @id @default(cuid())
  trainingEventId String
  equipmentId     String
  userId          String?
  memo            String? @db.Text

  @@unique([trainingEventId, equipmentId])
}

model Venue {
  id              String   @id @default(cuid())
  teamId          String
  name            String
  address         String?
  mapUrl          String?
  latitude        Float?
  longitude       Float?
  surface         String?
  recommendedShoes String[] @default([])
  usageCount      Int      @default(0)

  @@unique([teamId, name])
}
```

## 프론트엔드

### 운동 상세 페이지 (`src/app/training/[id]/page.tsx`)

SWR을 사용하여 데이터를 캐싱하고, 탭 전환 시 필요한 데이터만 추가 로드한다.

```tsx
// src/app/training/[id]/page.tsx
// SWR로 event 데이터 페칭 - session 탭일 때만 sessions 포함
const shouldIncludeSessions = activeTab === "session";
const apiUrl = eventId
  ? `/api/training-events/${eventId}${shouldIncludeSessions ? "?includeSessions=true" : ""}`
  : null;

const { data: event, isLoading, mutate } = useSWR<TrainingEventDetail>(
  apiUrl,
  fetcher,
  {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 60000, // 1분 캐시
    keepPreviousData: true,
  }
);
```

탭 구성 (ADMIN 전용, 일반 사용자는 기본 정보만 표시):

| 탭 | 키 | 설명 |
|----|----|------|
| 기본 정보 | `info` | 운동 상세, RSVP, 체크인, 운동일지, 댓글 |
| 세션 | `session` | 훈련 세션 관리 + 팀 배정 |
| 지각비 | `latefee` | 지각비 부과/조회 |
| 장비 | `equipment` | 장비 배정 관리 |

Lazy Loading으로 큰 탭 컴포넌트의 초기 번들 크기를 줄인다.

```tsx
// src/app/training/[id]/page.tsx
const LateFeeTab = lazy(() => import("@/components/training/LateFeeTab"));
const SessionTab = lazy(() => import("@/components/training/SessionTab"));
const EquipmentTab = lazy(() => import("@/components/training/EquipmentTab"));
```

공유 기능: 운동 정보를 텍스트로 포맷하여 클립보드에 복사한다.

```tsx
// src/app/training/[id]/page.tsx
const shareText = [
  `[${event.title || "팀 운동"}]`,
  "",
  `📅 ${dateStr}`,
  `📍 ${event.location}`,
  event.uniform ? `👕 ${event.uniform}` : null,
  event.notes ? `📝 ${event.notes}` : null,
  "",
  url,
]
  .filter((line) => line !== null)
  .join("\n");

await navigator.clipboard.writeText(shareText);
```

### 운동 생성 페이지 (`src/app/training/create/page.tsx`)

SWR로 조끼 당번 추천과 유니폼 목록을 캐싱한다. 장소 검색은 300ms 디바운스를 적용한다.

```tsx
// src/app/training/create/page.tsx
// SWR로 조끼 당번 추천 캐싱
const { data: vestData, isLoading: vestLoading } = useSWR<{
  members: MemberOption[];
  bringer: { id: string } | null;
  receiver: { id: string } | null;
}>("/api/training-events/vest-suggestion", fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 60000,
  onSuccess: (data) => {
    setMembers(data.members || []);
    if (data.bringer) setVestBringerId(data.bringer.id);
    if (data.receiver) setVestReceiverId(data.receiver.id);
  },
});
```

날씨 자동 조회: 구장 선택 + 날짜 입력 시 자동으로 날씨 API를 호출한다.

```tsx
// src/app/training/create/page.tsx
const handleVenueSelect = (venue: VenueOption) => {
  setLocation(venue.name);
  setSelectedVenue(venue);
  if (venue.recommendedShoes) {
    setShoes(venue.recommendedShoes);
  }
  setShowVenueList(false);

  // 날짜가 이미 선택되어 있으면 날씨 조회
  if (date && venue.latitude && venue.longitude) {
    fetchWeather(venue, date);
  }
};
```

폼 완성도 검증: 필수 항목이 모두 채워져야 제출 버튼이 표시된다.

```tsx
// src/app/training/create/page.tsx
const isFormComplete = title && date && time && location && rsvpDeadlineDate && rsvpDeadlineTime;
```

UX 특징:
- 유니폼 자동완성: 등록된 유니폼 목록에서 이름 매칭 시 색상 아이콘 표시
- 신발 추천: 구장 선택 시 해당 구장의 추천 신발이 자동 선택됨
- 조끼 당번 자동 추천: 조끼 순서에 따라 가져오는 사람/받는 사람 자동 설정
- sticky 하단 제출 버튼: 폼 완성 시에만 화면 하단에 고정 표시
- Toast 알림: 성공/실패 메시지를 토스트로 표시
- 에러 핸들링: 401/403 등 HTTP 에러 코드에 따른 한국어 에러 메시지 분기
