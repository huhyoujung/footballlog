# 팀 관리
> 팀 CRUD, 멤버 역할 관리, 장비/유니폼 관리, 조끼 당번 순서, 출석률 조회

## 개요

팀 생성 후 운영진(ADMIN)은 팀 정보 수정, 멤버 역할 변경, 초대 코드 재생성, 장비 등록, 유니폼 등록, 조끼 빨래 당번 순서 관리 등을 수행할 수 있다. 출석률은 과거 운동 이벤트 대비 체크인 비율로 자동 계산되며, 팀 조회 시 멤버별 출석률과 함께 반환된다.

### 하위 기능

| ID | 하위 기능 | 설명 |
|----|-----------|------|
| 2-1 | 팀 설정 | 팀 생성/수정, 초대 코드 재생성, 팀 색상, 출석률 |
| 2-2 | 멤버/역할 관리 | ADMIN/MEMBER 역할 변경, 권한 제어 |
| 2-3 | 장비 관리 | 장비 CRUD, 이름 유니크, orderIndex 자동 증가 |
| 2-4 | 유니폼 관리 | 유니폼 CRUD, 이름 유니크, 색상 코드 |
| 2-5 | 조끼 당번 | 조끼 빨래 순서 관리, 중복/팀원 검증 |

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/app/api/teams/route.ts` | 팀 생성(POST), 수정(PUT), 조회(GET) |
| `src/app/api/teams/role/route.ts` | 멤버 역할 변경 (ADMIN/MEMBER) |
| `src/app/api/teams/equipment/route.ts` | 장비 목록 조회(GET) 및 추가(POST) |
| `src/app/api/teams/uniforms/route.ts` | 유니폼 목록 조회(GET) 및 추가(POST) |
| `src/app/api/teams/vest-order/route.ts` | 조끼 당번 순서 저장(PUT) |
| `src/app/api/teams/attendance-rate/route.ts` | 팀 출석률 조회(GET) |
| `src/app/my/team-admin/page.tsx` | 팀 관리 메뉴 페이지 |

## API 엔드포인트

| 메서드 | 경로 | 권한 | 설명 |
|--------|------|------|------|
| `POST` | `/api/teams` | 로그인 | 팀 생성 (생성자 자동 ADMIN) |
| `PUT` | `/api/teams` | ADMIN | 팀 정보 수정 (이름, 로고, 색상, 초대코드 재생성) |
| `GET` | `/api/teams` | 로그인 | 팀 정보 + 멤버(출석률 포함) 조회 |
| `PUT` | `/api/teams/role` | ADMIN | 멤버 역할 변경 |
| `GET` | `/api/teams/equipment` | ADMIN | 장비 목록 조회 |
| `POST` | `/api/teams/equipment` | ADMIN | 장비 추가 |
| `GET` | `/api/teams/uniforms` | 로그인 | 유니폼 목록 조회 |
| `POST` | `/api/teams/uniforms` | ADMIN | 유니폼 추가 |
| `PUT` | `/api/teams/vest-order` | ADMIN | 조끼 당번 순서 저장 |
| `GET` | `/api/teams/attendance-rate` | 로그인 | 팀 출석률 조회 |

## 주요 코드

### 2-1. 팀 설정

#### 팀 생성 (`src/app/api/teams/route.ts` - POST)

팀 생성 시 생성자를 자동으로 ADMIN 역할로 지정하고, 해당 팀에 소속시킨다.

```typescript
// src/app/api/teams/route.ts - POST
// 팀 생성
const team = await prisma.team.create({
  data: {
    name: name.trim(),
    createdBy: session.user.id,
  },
});

// 사용자를 팀에 추가하고 운영진으로 설정
await prisma.user.update({
  where: { id: session.user.id },
  data: {
    teamId: team.id,
    role: "ADMIN",
  },
});
```

#### 팀 정보 수정 (`src/app/api/teams/route.ts` - PUT)

이름, 로고, 팀 색상 수정과 초대 코드 재생성을 지원한다. `regenerateInviteCode: true`를 보내면 랜덤 문자열로 초대 코드를 교체한다.

```typescript
// src/app/api/teams/route.ts - PUT
if (body.name && typeof body.name === "string" && body.name.trim()) {
  data.name = body.name.trim();
}

if (body.logoUrl !== undefined) {
  data.logoUrl = body.logoUrl || null;
}

if (body.primaryColor && typeof body.primaryColor === "string") {
  data.primaryColor = body.primaryColor;
}

if (body.regenerateInviteCode) {
  data.inviteCode = Math.random().toString(36).substring(2, 10);
}
```

#### 팀 조회 + 출석률 계산 (`src/app/api/teams/route.ts` - GET)

N+1 쿼리 문제를 방지하기 위해 전체 체크인을 한 번에 조회한 후 메모리에서 그룹화한다.

```typescript
// src/app/api/teams/route.ts - GET
// 출석률 계산을 위한 데이터 조회 (최적화: 단일 쿼리)
const now = new Date();
const totalEvents = await prisma.trainingEvent.count({
  where: {
    teamId: user.team.id,
    date: { lt: now }, // 과거 운동만
  },
});

// 모든 출석 데이터를 한 번에 가져오기 (N+1 쿼리 문제 해결)
const checkIns = await prisma.checkIn.findMany({
  where: {
    trainingEvent: {
      teamId: user.team.id,
      date: { lt: now },
    },
  },
  select: {
    userId: true,
  },
});

// 메모리에서 그룹화 (userId별 출석 횟수)
const checkInsByUser = checkIns.reduce((acc, checkIn) => {
  acc[checkIn.userId] = (acc[checkIn.userId] || 0) + 1;
  return acc;
}, {} as Record<string, number>);

// 각 멤버별 출석률 계산
const membersWithAttendance = user.team.members.map((member) => ({
  ...member,
  attendanceRate: totalEvents > 0
    ? Math.round(((checkInsByUser[member.id] || 0) / totalEvents) * 100)
    : 0,
}));

// 출석률 순으로 정렬 (높은 순)
membersWithAttendance.sort((a, b) => b.attendanceRate - a.attendanceRate);
```

### 2-2. 멤버/역할 관리

#### 멤버 역할 변경 (`src/app/api/teams/role/route.ts`)

ADMIN만 다른 멤버의 역할을 변경할 수 있으며, 본인의 역할은 변경할 수 없다. 같은 팀 소속 여부도 검증한다.

```typescript
// src/app/api/teams/role/route.ts
if (session.user.role !== "ADMIN") {
  return NextResponse.json({ error: "운영진만 역할을 변경할 수 있습니다" }, { status: 403 });
}

if (userId === session.user.id) {
  return NextResponse.json({ error: "본인의 역할은 변경할 수 없습니다" }, { status: 400 });
}

const targetUser = await prisma.user.findUnique({
  where: { id: userId },
});

if (!targetUser || targetUser.teamId !== session.user.teamId) {
  return NextResponse.json({ error: "같은 팀의 멤버만 변경할 수 있습니다" }, { status: 400 });
}

const updated = await prisma.user.update({
  where: { id: userId },
  data: { role },
  select: { id: true, name: true, role: true },
});
```

### 2-3. 장비 관리

#### 장비 추가 (`src/app/api/teams/equipment/route.ts` - POST)

장비 이름 중복을 체크하고, `orderIndex`를 자동으로 증가시켜 순서를 관리한다.

```typescript
// src/app/api/teams/equipment/route.ts - POST
// 중복 체크
const existing = await prisma.equipment.findUnique({
  where: {
    teamId_name: {
      teamId: session.user.teamId,
      name: name.trim(),
    },
  },
});

if (existing) {
  return NextResponse.json({ error: "이미 존재하는 장비 이름입니다" }, { status: 400 });
}

// 현재 최대 orderIndex 조회
const maxOrder = await prisma.equipment.findFirst({
  where: { teamId: session.user.teamId },
  orderBy: { orderIndex: "desc" },
  select: { orderIndex: true },
});

const equipment = await prisma.equipment.create({
  data: {
    teamId: session.user.teamId,
    name: name.trim(),
    description: description?.trim() || null,
    orderIndex: (maxOrder?.orderIndex ?? -1) + 1,
  },
});
```

### 2-4. 유니폼 관리

#### 유니폼 추가 (`src/app/api/teams/uniforms/route.ts` - POST)

팀 내 유니폼 이름 중복 시 Prisma P2002 에러를 처리한다.

```typescript
// src/app/api/teams/uniforms/route.ts - POST
const uniform = await prisma.uniform.create({
  data: {
    teamId: session.user.teamId,
    name: name.trim(),
    color: color.trim(),
  },
});

// ... catch 블록
if (error.code === "P2002") {
  return NextResponse.json({ error: "이미 같은 이름의 유니폼이 있습니다" }, { status: 400 });
}
```

### 2-5. 조끼 당번

#### 조끼 당번 순서 저장 (`src/app/api/teams/vest-order/route.ts`)

사용자 ID 배열의 중복을 체크하고, 모든 ID가 같은 팀 소속인지 검증한 후 저장한다.

```typescript
// src/app/api/teams/vest-order/route.ts
const { vestOrder } = await req.json();

// 중복 체크
const uniqueIds = new Set(vestOrder);
if (uniqueIds.size !== vestOrder.length) {
  return NextResponse.json({ error: "중복된 사용자가 있습니다" }, { status: 400 });
}

// 모든 userId가 같은 팀 멤버인지 확인
if (vestOrder.length > 0) {
  const members = await prisma.user.findMany({
    where: {
      id: { in: vestOrder },
      teamId: session.user.teamId,
    },
    select: { id: true },
  });

  if (members.length !== vestOrder.length) {
    return NextResponse.json({ error: "팀원이 아닌 사용자가 포함되어 있습니다" }, { status: 400 });
  }
}

// 순서 저장
const team = await prisma.team.update({
  where: { id: session.user.teamId },
  data: { vestOrder },
});
```

#### 출석률 조회 (`src/app/api/teams/attendance-rate/route.ts`)

모든 운동 이벤트와 체크인을 조회하여 멤버별 출석률을 계산하고, 높은 순으로 정렬한다.

```typescript
// src/app/api/teams/attendance-rate/route.ts
const attendanceRates = members.map((member) => {
  const checkInCount = events.filter((event) =>
    event.checkIns.some((checkIn) => checkIn.userId === member.id)
  ).length;

  const rate = totalEvents > 0 ? Math.round((checkInCount / totalEvents) * 100) : 0;

  return {
    userId: member.id,
    name: member.name,
    image: member.image,
    position: member.position,
    number: member.number,
    checkInCount,
    totalEvents,
    rate,
  };
});

// 출석률 높은 순으로 정렬
attendanceRates.sort((a, b) => b.rate - a.rate);
```

## 비즈니스 규칙

| 규칙 | 설명 |
|------|------|
| ADMIN 전용 기능 | 팀 수정, 역할 변경, 장비/유니폼 추가, 조끼 순서 관리는 ADMIN만 가능 |
| 자기 역할 변경 불가 | ADMIN이라도 본인의 역할은 변경할 수 없음 |
| 같은 팀만 변경 | 역할 변경 대상은 같은 팀 소속이어야 함 |
| 장비 이름 유니크 | 팀 내에서 장비 이름 중복 불가 (`@@unique([teamId, name])`) |
| 유니폼 이름 유니크 | 팀 내에서 유니폼 이름 중복 불가 (`@@unique([teamId, name])`) |
| 조끼 순서 중복 불가 | 같은 사용자가 순서에 두 번 포함될 수 없음 |
| 팀원 검증 | 조끼 순서에 포함된 모든 사용자가 같은 팀 소속이어야 함 |
| 출석률 계산 기준 | 과거 운동 이벤트 중 체크인 비율 (미래 운동은 제외) |
| 초대 코드 재생성 | 8자리 랜덤 문자열로 교체 (`Math.random().toString(36).substring(2, 10)`) |
| 팀 색상 기본값 | `#967B5D` (갈색 계열) |
| 장비 정렬 | `orderIndex` 오름차순 (자동 증가) |

## 데이터 모델

```prisma
model Team {
  id           String   @id @default(cuid())
  name         String
  inviteCode   String   @unique @default(cuid())
  logoUrl      String?
  primaryColor String   @default("#967B5D")
  vestOrder    String[] @default([])  // 조끼 당번 순서 (사용자 ID 배열)
  eloRating    Float    @default(1000.0)
  createdAt    DateTime @default(now())
  createdBy    String   @unique

  creator  User   @relation("CreatedBy", fields: [createdBy], references: [id])
  members  User[]
}

model Equipment {
  id          String   @id @default(cuid())
  teamId      String
  name        String
  description String?
  orderIndex  Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  team        Team                  @relation(fields: [teamId], references: [id], onDelete: Cascade)
  managers    User[]                @relation("EquipmentManagers")
  assignments EquipmentAssignment[]

  @@unique([teamId, name])
}

model Uniform {
  id        String   @id @default(cuid())
  teamId    String
  name      String   // 예: "홈", "원정", "3rd"
  color     String   // HEX color code (예: "#FF0000")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@unique([teamId, name])
  @@index([teamId])
}
```

## 프론트엔드

### 팀 관리 메뉴 (`src/app/my/team-admin/page.tsx`)

ADMIN 전용 페이지로, 비인가 사용자는 자동 리다이렉트된다. 4개의 관리 메뉴로 구성된다.

```tsx
// src/app/my/team-admin/page.tsx
useEffect(() => {
  if (status === "unauthenticated") {
    router.push("/login");
  } else if (status === "authenticated" && session?.user?.role !== "ADMIN") {
    router.push("/");
  }
}, [status, session, router]);
```

메뉴 구성:
- **팀 프로필** (`/my/team-settings`): 팀 이름, 로고 등 기본 정보 수정
- **운영진 관리** (`/my/team-admin/admins`): 멤버 역할(ADMIN/MEMBER) 지정/해제
- **조끼 빨래 당번** (`/my/team-admin/vest`): 당번 순서 드래그 앤 드롭 관리
- **장비 관리** (`/my/team-equipment`): 팀 장비 및 담당자 관리

데이터 페칭 패턴:
- `useSession()`으로 클라이언트 사이드 인증 상태 확인
- 각 하위 페이지에서 해당 API를 개별 호출

UX 특징:
- `useSession` 로딩 중 `LoadingSpinner` 표시
- 권한 없는 사용자(MEMBER)는 자동으로 홈(`/`)으로 리다이렉트
- sticky 헤더 + BackButton으로 마이페이지(`/my`)로 복귀
- 각 메뉴 항목에 보조 설명 텍스트 (gray-400)
