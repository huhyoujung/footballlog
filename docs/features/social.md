<!-- 소셜 기능 명세서 (락커 쪽지, 닦달, POM 투표, 칭찬) -->

# 소셜 기능

> 락커 쪽지, 닦달, POM/MVP 투표, 칭찬 플로우를 통해 팀원 간 상호작용을 촉진하는 기능 모음

## 개요

소셜 기능은 운동 일지 외에 팀원 간 비공식적인 상호작용을 지원하는 기능 모음이다. 핵심은 네 가지이다:

1. **락커 쪽지 (Locker Notes)**: 팀원의 락커에 포스트잇 형태의 칭찬 쪽지를 남기는 기능. 색상, 스탯 태그, 익명 옵션을 지원하며 하루 1장 제한이 있다.
2. **닦달 (Nudge)**: 팀원에게 "일지 써!" 라고 재촉하는 기능. 1시간 쿨타임이 있으며 푸시 알림으로 전달된다.
3. **POM 투표 (Player of the Match)**: 팀 운동 후 가장 잘한 팀원에게 투표하는 기능. 운동 2시간 후부터 다음날 23:59까지 투표 가능하다.
4. **칭찬 플로우 (Compliment)**: 팀원 목록에서 선택하여 락커 쪽지를 남기는 전용 진입점이다.

### 하위 기능

| ID | 하위 기능 | 설명 |
|----|-----------|------|
| 5-1 | 락커 쪽지 | 포스트잇 형태 칭찬 쪽지, 색상/스탯 태그/익명, 하루 1장 |
| 5-2 | 닦달 | "일지 써!" 재촉, 1시간 쿨타임, 메시지 첨부 |
| 5-3 | POM/MVP 투표 | 운동 후 MVP 투표, 2시간 후~다음날 23:59, 전광판 |
| 5-4 | 칭찬 플로우 | 팀원 선택 → 락커 쪽지 작성 전용 진입점 |

## 관련 파일

| 파일 경로 | 역할 |
|-----------|------|
| `src/app/api/locker-notes/route.ts` | 락커 쪽지 목록 조회 (GET) + 생성 (POST) |
| `src/app/api/locker-notes/user/[userId]/route.ts` | 특정 유저의 쪽지 조회 (GET) |
| `src/app/api/nudges/route.ts` | 닦달 보내기 (POST) + 최근 목록 (GET) |
| `src/app/api/training-events/[id]/pom/route.ts` | POM 투표 결과 (GET) + 투표 (POST) |
| `src/app/api/pom/recent-mvp/route.ts` | 최근 MVP 조회 (GET) |
| `src/app/locker/[userId]/page.tsx` | 락커 페이지 (타임라인 + 프로필 + 쪽지) |
| `src/app/my/page.tsx` | 마이페이지 (닦달 모달 포함) |
| `src/app/compliment/page.tsx` | 칭찬 페이지 (팀원 선택) |

## API 엔드포인트

### 1. `GET /api/locker-notes` - 최근 락커 쪽지 조회

24시간 이내의 팀 전체 쪽지를 최대 50개까지 반환한다.

### 2. `POST /api/locker-notes` - 락커 쪽지 생성

팀원의 락커에 칭찬 쪽지를 남긴다.

**요청 본문:**
- `recipientId` (필수)
- `content` (필수, 최대 500자)
- `color` (필수, HEX 색상)
- `rotation` (선택, 기본값 0)
- `positionX`, `positionY` (선택, 기본값 0)
- `isAnonymous` (선택, 기본값 false)
- `trainingEventId` (선택, 팀 운동 연결)
- `trainingLogId` (선택, 개인 일지 연결)
- `tags` (선택, 스탯 태그 배열)

### 3. `GET /api/locker-notes/user/[userId]` - 특정 유저의 쪽지 목록

특정 유저가 받은 모든 락커 쪽지를 시간 역순으로 반환한다.

### 4. `POST /api/nudges` - 닦달 보내기

팀원에게 닦달을 보낸다. 1시간 이내 동일 대상 중복 불가.

**요청 본문:**
- `recipientId` (필수)
- `message` (선택, 닦달 메시지)

### 5. `GET /api/nudges` - 최근 닦달 목록

1시간 이내의 팀 닦달 목록을 최대 10개까지 반환한다 (피드 배너용).

### 6. `GET /api/training-events/[id]/pom` - POM 투표 결과 조회

특정 운동의 POM 투표 결과를 득표순으로 정렬하여 반환한다.

**응답 형식:**
```json
{
  "results": [
    { "user": {...}, "votes": [...], "count": 3 }
  ],
  "totalVotes": 8,
  "myVote": {
    "nomineeId": "...",
    "nomineeName": "김민수",
    "reason": "수비가 정말 좋았어요"
  }
}
```

### 7. `POST /api/training-events/[id]/pom` - POM 투표하기

특정 운동의 POM에 투표한다. 이미 투표한 경우 변경(upsert) 처리.

**요청 본문:**
- `nomineeId` (필수)
- `reason` (필수, 선택 이유)

### 8. `GET /api/pom/recent-mvp` - 최근 MVP 조회

24시간 이내에 투표가 마감된 운동 중 가장 많은 표를 받은 선수를 반환한다 (전광판용).

## 주요 코드

### 5-1. 락커 쪽지

#### 락커 쪽지 생성 - 같은 팀 확인 + 자기 자신 제한

`src/app/api/locker-notes/route.ts`:

```typescript
const { recipientId, content, color, rotation, positionX,
        positionY, isAnonymous, trainingEventId, trainingLogId, tags } = body;

// 유효성 검사
if (!recipientId || !content || !color) {
  return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
}

// 쪽지 내용 길이 제한 (500자)
if (content.length > 500) {
  return NextResponse.json(
    { error: "쪽지는 500자 이내로 작성해주세요" }, { status: 400 }
  );
}

// 자기 자신에게는 쪽지를 보낼 수 없음
if (recipientId === session.user.id) {
  return NextResponse.json(
    { error: "Cannot send note to yourself" }, { status: 400 }
  );
}

// 받는 사람이 같은 팀인지 확인
const [sender, recipient] = await Promise.all([
  prisma.user.findUnique({
    where: { id: session.user.id },
    select: { teamId: true },
  }),
  prisma.user.findUnique({
    where: { id: recipientId },
    select: { teamId: true, name: true },
  }),
]);

if (sender.teamId !== recipient.teamId) {
  return NextResponse.json(
    { error: "Cannot send note to user in different team" }, { status: 403 }
  );
}

// 쪽지 생성
const note = await prisma.lockerNote.create({
  data: {
    content,
    color,
    rotation: rotation || 0,
    positionX: positionX || 0,
    positionY: positionY || 0,
    isAnonymous: isAnonymous || false,
    tags: tags || [],
    authorId: session.user.id,
    recipientId,
    trainingEventId: trainingEventId || null,
    trainingLogId: trainingLogId || null,
  },
  // ...
});
```

#### 최근 락커 쪽지 조회 - 24시간 이내 필터

`src/app/api/locker-notes/route.ts`:

```typescript
// 24시간 이내의 쪽지 조회 (같은 팀 멤버가 받은 쪽지)
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

const recentNotes = await prisma.lockerNote.findMany({
  where: {
    createdAt: {
      gte: twentyFourHoursAgo,
    },
    recipient: {
      teamId: user.teamId,
    },
  },
  select: {
    id: true,
    content: true,
    color: true,
    rotation: true,
    positionX: true,
    positionY: true,
    tags: true,
    isAnonymous: true,
    createdAt: true,
    recipient: { select: { id: true, name: true } },
    author: { select: { id: true, name: true } },
    trainingLog: { select: { trainingDate: true } },
    trainingEvent: { select: { date: true } },
  },
  orderBy: { createdAt: "desc" },
  take: 50,
});
```

### 5-2. 닦달

#### 닦달 보내기 - 1시간 쿨타임 + 푸시 알림

`src/app/api/nudges/route.ts`:

```typescript
if (recipientId === session.user.id) {
  return NextResponse.json({ error: "자기 자신은 닦달할 수 없어요" }, { status: 400 });
}

// 같은 팀인지 확인
const recipient = await prisma.user.findFirst({
  where: { id: recipientId, teamId: session.user.teamId },
});

if (!recipient) {
  return NextResponse.json({ error: "같은 팀원만 닦달할 수 있어요" }, { status: 400 });
}

// 1시간 내 중복 확인
const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);
const existing = await prisma.nudge.findFirst({
  where: {
    senderId: session.user.id,
    recipientId,
    createdAt: { gte: oneHourAgo },
  },
});

if (existing) {
  return NextResponse.json({ error: "1시간 뒤에 다시 닦달할 수 있어요!" }, { status: 429 });
}

// 닦달 생성
const nudge = await prisma.nudge.create({
  data: {
    senderId: session.user.id,
    recipientId,
    teamId: session.user.teamId,
  },
  // ...
});

// 대상에게 푸시 알림
const pushBody = message
  ? `${session.user.name || "팀원"}: ${message}`
  : `${session.user.name || "팀원"}님이 운동하래요! 일지 올려주세요~`;

await sendPushToUsers([recipientId], {
  title: "💪 닦달!",
  body: pushBody,
  url: "/write",
});
```

### 5-3. POM/MVP 투표

#### POM 투표 - 투표 기간 제한 + upsert

`src/app/api/training-events/[id]/pom/route.ts`:

```typescript
const { nomineeId, reason } = await req.json();

if (!nomineeId || !reason || reason.trim().length === 0) {
  return NextResponse.json({ error: "선수와 이유를 입력해주세요" }, { status: 400 });
}

// 투표 기간 확인: 운동 시작 2시간 후부터 다음날 23:59까지
const now = new Date();
const eventDate = new Date(event.date);
const votingStartTime = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
const votingEndDate = new Date(eventDate);
votingEndDate.setDate(votingEndDate.getDate() + 1);
votingEndDate.setHours(23, 59, 59, 999);

if (now < votingStartTime) {
  return NextResponse.json(
    { error: "투표는 운동 종료 2시간 후부터 가능합니다" }, { status: 400 }
  );
}

if (now > votingEndDate) {
  return NextResponse.json({ error: "투표 기간이 종료되었습니다" }, { status: 400 });
}

// 본인에게 투표 방지
if (nomineeId === session.user.id) {
  return NextResponse.json({ error: "본인에게는 투표할 수 없습니다" }, { status: 400 });
}

// 투표 생성 또는 수정 (upsert)
const vote = await prisma.pomVote.upsert({
  where: {
    trainingEventId_voterId: {
      trainingEventId: id,
      voterId: session.user.id,
    },
  },
  create: {
    trainingEventId: id,
    voterId: session.user.id,
    nomineeId,
    reason: reason.trim(),
  },
  update: {
    nomineeId,
    reason: reason.trim(),
  },
  // ...
});
```

#### POM 투표 결과 집계

`src/app/api/training-events/[id]/pom/route.ts`:

```typescript
// 투표 결과 집계
const votes = await prisma.pomVote.findMany({
  where: { trainingEventId: id },
  include: {
    voter: { select: { id: true, name: true, image: true } },
    nominee: { select: { id: true, name: true, image: true, position: true, number: true } },
  },
});

// 득표수 집계
const voteCounts: Record<string, { user: any; votes: any[]; count: number }> = {};
for (const vote of votes) {
  if (!voteCounts[vote.nomineeId]) {
    voteCounts[vote.nomineeId] = { user: vote.nominee, votes: [], count: 0 };
  }
  voteCounts[vote.nomineeId].votes.push({
    voter: vote.voter,
    reason: vote.reason,
    createdAt: vote.createdAt,
  });
  voteCounts[vote.nomineeId].count++;
}

// 득표순 정렬
const results = Object.values(voteCounts).sort((a, b) => b.count - a.count);

// 내 투표 여부
const myVote = votes.find((v) => v.voterId === session.user.id);
```

#### 최근 MVP 조회 - 전광판용

`src/app/api/pom/recent-mvp/route.ts`:

```typescript
const now = new Date();
const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

// 최근 24시간 내 마감된 운동 중 POM 투표가 있는 이벤트 찾기
const recentEvents = await prisma.trainingEvent.findMany({
  where: {
    teamId: session.user.teamId,
    pomVotingDeadline: {
      gte: yesterday,
      lte: now,
    },
  },
  include: {
    pomVotes: {
      include: {
        nominee: {
          select: { id: true, name: true, image: true, position: true, number: true },
        },
      },
    },
  },
  orderBy: { pomVotingDeadline: "desc" },
  take: 1,
});

// MVP 계산 (가장 많은 표를 받은 사람)
const voteCount: Record<string, { user: any; count: number }> = {};
for (const vote of event.pomVotes) {
  if (!voteCount[vote.nomineeId]) {
    voteCount[vote.nomineeId] = { user: vote.nominee, count: 0 };
  }
  voteCount[vote.nomineeId].count += 1;
}

const mvpEntries = Object.values(voteCount).sort((a, b) => b.count - a.count);
const mvp = mvpEntries[0];
```

#### 락커 페이지 - 쪽지 작성 + 닦달 (프론트엔드)

`src/app/locker/[userId]/page.tsx`:

```tsx
const STICKY_COLORS = [
  { value: "#FFF59D", label: "노랑" },
  { value: "#F8BBD0", label: "핑크" },
  { value: "#B2DFDB", label: "민트" },
  { value: "#D1C4E9", label: "라벤더" },
  { value: "#FFCCBC", label: "피치" },
];

const STAT_TAGS = [
  "공격", "스피드", "드리블", "체력", "수비",
  "피지컬", "패스", "슛", "킥", "팀워크"
];

const handleAddNote = async () => {
  if (!noteContent.trim()) {
    showToast("내용을 입력해주세요");
    return;
  }
  if (noteContent.length > 50) {
    showToast("쪽지는 50자 이내로 작성해주세요");
    return;
  }

  setIsSubmitting(true);
  try {
    const res = await fetch("/api/locker-notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipientId: userId,
        content: noteContent,
        color: noteColor,
        rotation: Math.random() * 6 - 3, // -3 ~ +3도 랜덤 회전
        positionX: 0,
        positionY: 0,
        isAnonymous,
        trainingEventId: selectedActivityType === "event" ? selectedActivityId : null,
        trainingLogId: selectedActivityType === "log" ? selectedActivityId : null,
        tags: selectedTags,
      }),
    });

    if (res.ok) {
      showToast("쪽지를 남겼습니다!");
      // 상태 초기화
      setNoteContent("");
      setNoteColor(STICKY_COLORS[0].value);
      setIsAnonymous(false);
      setSelectedTags([]);
      setShowAddModal(false);
      setNoteSentToday(true);
      mutate();
    }
  } catch (error) {
    showToast("쪽지 작성에 실패했습니다");
  } finally {
    setIsSubmitting(false);
  }
};
```

#### 마이페이지 - 닦달 모달 + Optimistic UI

`src/app/my/page.tsx`:

```tsx
const handleNudge = async (recipientId: string, recipientName: string) => {
  const message = nudgeMessage.trim();

  // 모달 닫기 및 메시지 초기화
  setSelectedMember(null);
  setNudgeMessage("");

  // Optimistic UI: 즉시 완료 상태로 변경
  setNudgedToday((prev) => new Set(prev).add(recipientId));

  // 즉시 토스트 표시
  showToast(`${withEulReul(recipientName)} 닦달했습니다! 👉`);

  // 백그라운드에서 API 호출
  fetch("/api/nudges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recipientId, message }),
  })
    .then(async (res) => {
      if (!res.ok) {
        // 실패 시 롤백
        setNudgedToday((prev) => {
          const next = new Set(prev);
          next.delete(recipientId);
          return next;
        });
        const data = await res.json();
        showToast(data.error || "닦달에 실패했습니다");
      }
    })
    .catch(() => {
      // 실패 시 롤백
      setNudgedToday((prev) => {
        const next = new Set(prev);
        next.delete(recipientId);
        return next;
      });
      showToast("닦달에 실패했습니다");
    });
};
```

### 5-4. 칭찬 플로우

#### 칭찬 페이지 - 팀원 선택 후 락커로 이동

`src/app/compliment/page.tsx`:

```tsx
export default function ComplimentPage() {
  const { data: session } = useSession();
  const { teamData, loading: teamLoading } = useTeam();
  const router = useRouter();

  // ...

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="text-base font-semibold text-gray-900">칭찬 쪽지 놓고오기</h1>
          <div className="w-6" />
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4">
        <div className="bg-team-50 border border-team-200 rounded-xl p-4">
          <p className="text-sm text-team-700">
            💌 팀원의 락커에 칭찬 쪽지를 남겨보세요!
          </p>
          <p className="text-xs text-team-600 mt-1">
            익명으로 응원과 칭찬의 메시지를 전할 수 있습니다
          </p>
        </div>
      </div>

      <main className="max-w-2xl mx-auto px-4 pb-4">
        <TeamMemberList
          members={teamData.members}
          currentUserId={session?.user?.id}
          onMemberClick={(member) => {
            router.push(`/locker/${member.id}?openNote=true`);
          }}
          showSelfBadge={false}
        />
      </main>
    </div>
  );
}
```

## 비즈니스 규칙

### 락커 쪽지

| 규칙 | 설명 |
|------|------|
| 같은 팀만 | 다른 팀 유저에게 쪽지 불가 (403) |
| 자기 자신 제한 | 본인 락커에 쪽지 불가 (400) |
| 내용 길이 | API 기준 최대 500자, 프론트 기준 50자 제한 |
| 하루 1장 | 프론트에서 같은 날 같은 유저에게 쪽지 보냈으면 비활성화 |
| 익명 옵션 | 본인 락커에서만 익명 작성자 확인 가능 |
| 수정 불가 | 작성 후 수정 불가, 삭제만 가능 (본인 락커 쪽지만) |
| 색상 선택 | 노랑, 핑크, 민트, 라벤더, 피치 5가지 |
| 스탯 태그 | 공격, 스피드, 드리블, 체력, 수비, 피지컬, 패스, 슛, 킥, 팀워크 10종 |
| 랜덤 회전 | 쪽지 생성 시 -3 ~ +3도 랜덤 회전 적용 |
| 운동 연결 | 팀 운동 또는 개인 일지에 선택적으로 연결 가능 |

### 닦달

| 규칙 | 설명 |
|------|------|
| 같은 팀만 | 다른 팀 유저에게 닦달 불가 |
| 자기 자신 제한 | 본인에게 닦달 불가 |
| 1시간 쿨타임 | 같은 대상에게 1시간 이내 재닦달 시 429 반환 |
| 메시지 선택 | 최대 50자 메시지를 함께 보낼 수 있음 |
| 피드 배너 | 1시간 이내 닦달을 최대 10개까지 피드에 표시 |
| 푸시 URL | 닦달 수신 시 `/write` (일지 작성) 페이지로 이동 |

### POM 투표

| 규칙 | 설명 |
|------|------|
| 같은 팀만 | 다른 팀 운동에 투표 불가 (403) |
| 투표 시작 | 운동 시작 2시간 후부터 가능 |
| 투표 마감 | 운동 다음날 23:59:59 |
| 본인 투표 불가 | 자기 자신에게 투표 불가 |
| 1인 1표 | 한 이벤트당 1명만 선택 가능 (upsert로 변경 허용) |
| 이유 필수 | 투표 이유를 반드시 입력해야 함 |

### MVP 전광판

| 규칙 | 설명 |
|------|------|
| 조회 범위 | 24시간 이내 마감된 투표 중 최신 1건 |
| MVP 결정 | 가장 많은 표를 받은 선수 |
| 날짜 표시 | 오늘/어제 여부를 `isToday`/`isYesterday` 플래그로 반환 |

## 데이터 모델

### LockerNote

```prisma
model LockerNote {
  id          String   @id @default(cuid())
  content     String   @db.Text
  color       String   // 포스트잇 색상 (hex)
  rotation    Float    @default(0) // 회전 각도 (-3 ~ +3)
  positionX   Float    @default(0)
  positionY   Float    @default(0)
  isAnonymous Boolean  @default(false)
  tags        String[] // 축구 스탯 태그 (공격, 패스, 수비 등)

  authorId    String
  author      User     @relation("SentNotes", fields: [authorId], references: [id], onDelete: Cascade)

  recipientId String
  recipient   User     @relation("ReceivedNotes", fields: [recipientId], references: [id], onDelete: Cascade)

  trainingEventId String?
  trainingEvent   TrainingEvent? @relation(fields: [trainingEventId], references: [id], onDelete: SetNull)

  trainingLogId String?
  trainingLog   TrainingLog? @relation("LockerNotes", fields: [trainingLogId], references: [id], onDelete: SetNull)

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([recipientId, createdAt(sort: Desc)])
  @@index([authorId])
  @@index([trainingLogId])
}
```

### Nudge

```prisma
model Nudge {
  id          String   @id @default(cuid())
  senderId    String
  recipientId String
  teamId      String
  createdAt   DateTime @default(now())

  sender    User @relation("NudgeSender", fields: [senderId], references: [id], onDelete: Cascade)
  recipient User @relation("NudgeRecipient", fields: [recipientId], references: [id], onDelete: Cascade)
  team      Team @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([teamId, createdAt(sort: Desc)])
}
```

### PomVote

```prisma
model PomVote {
  id              String   @id @default(cuid())
  trainingEventId String
  voterId         String   // 투표한 사람
  nomineeId       String   // 선택된 사람
  reason          String   @db.Text // 어떤 플레이가 좋았는지
  createdAt       DateTime @default(now())

  trainingEvent TrainingEvent @relation(fields: [trainingEventId], references: [id], onDelete: Cascade)
  voter         User          @relation("PomVoter", fields: [voterId], references: [id], onDelete: Cascade)
  nominee       User          @relation("PomNominee", fields: [nomineeId], references: [id], onDelete: Cascade)

  @@unique([trainingEventId, voterId]) // 한 이벤트당 1인 1표
  @@index([trainingEventId])
  @@index([nomineeId])
}
```

## 프론트엔드

### 주요 페이지/컴포넌트

| 페이지/컴포넌트 | 경로 | 역할 |
|-----------------|------|------|
| `LockerPage` | `/locker/[userId]` | 락커 타임라인 + 쪽지 + 프로필 + 스탯 |
| `MyPage` | `/my` | 마이페이지, 팀원 목록, 닦달 모달 |
| `ComplimentPage` | `/compliment` | 칭찬 대상 팀원 선택 페이지 |
| `TeamMemberList` | 컴포넌트 | 팀원 목록 표시 (공용) |
| `PolaroidDateGroup` | 컴포넌트 | 날짜별 폴라로이드 카드 그룹 |
| `PolaroidCard` | 컴포넌트 | 개별 일지 카드 |

### 데이터 페칭 패턴

**SWR 기반 캐싱 (락커 쪽지):**

```tsx
const { data: allNotes, mutate } = useSWR<LockerNote[]>(
  userId ? `/api/locker-notes/user/${userId}` : null,
  fetcher,
  {
    revalidateOnFocus: false,
    dedupingInterval: 60000, // 1분 캐시
    keepPreviousData: true,
  }
);
```

**TeamContext 활용 (팀원 정보):**

```tsx
const { teamData } = useTeam();
// 사용자 정보를 TeamContext에서 가져와 추가 API 호출 제거
useEffect(() => {
  if (!userId || !teamData?.members) return;
  const targetUser = teamData.members.find((m) => m.id === userId);
  if (targetUser) setUser(targetUser);
}, [userId, teamData]);
```

**Optimistic UI (닦달):**

마이페이지의 닦달은 Optimistic UI 패턴을 사용한다. API 응답을 기다리지 않고 즉시 UI를 업데이트하고, 실패 시 롤백한다.

```tsx
// Optimistic UI: 즉시 완료 상태로 변경
setNudgedToday((prev) => new Set(prev).add(recipientId));
showToast(`${withEulReul(recipientName)} 닦달했습니다! 👉`);

// 백그라운드에서 API 호출
fetch("/api/nudges", { ... })
  .then(async (res) => {
    if (!res.ok) {
      // 실패 시 롤백
      setNudgedToday((prev) => {
        const next = new Set(prev);
        next.delete(recipientId);
        return next;
      });
    }
  });
```

### UX 특징

1. **락커 타임라인**: 날짜별로 그룹핑된 폴라로이드 카드와 쪽지를 함께 표시. 쪽지만 있는 날짜도 타임라인에 포함.

2. **쪽지 하루 1장 제한 (프론트)**: 같은 날 같은 유저에게 쪽지를 이미 보냈으면 쪽지 버튼 비활성화.
   ```tsx
   useEffect(() => {
     if (allNotes && session?.user?.id) {
       const today = getLocalDateString(new Date());
       const sentToday = allNotes.some(
         (note) =>
           note.author.id === session.user.id &&
           getLocalDateString(new Date(note.createdAt)) === today
       );
       setNoteSentToday(sentToday);
     }
   }, [allNotes, session?.user?.id]);
   ```

3. **스탯 레이더 차트**: 쪽지 5개 이상 모이면 SVG 레이더 차트로 태그 기반 강점 시각화. 5개 미만이면 잠금 UI 표시.
   ```tsx
   const { stats, statEntries, maxStatValue, hasEnoughNotes } = useMemo(() => {
     const s: Record<string, number> = {};
     for (const note of notes) {
       for (const tag of note.tags) {
         s[tag] = (s[tag] || 0) + 1;
       }
     }
     const entries = Object.entries(s).sort((a, b) => b[1] - a[1]);
     const maxVal = Math.max(...Object.values(s), 0);
     return { stats: s, statEntries: entries, maxStatValue: maxVal, hasEnoughNotes: notes.length >= 5 };
   }, [notes]);
   ```

4. **익명 쪽지 확인**: 본인 락커에서만 익명 작성자를 "보기/숨기기" 토글로 확인 가능.

5. **URL 파라미터로 쪽지 모달 자동 열기**: `/locker/[userId]?openNote=true` 접근 시 쪽지 작성 모달이 자동으로 열림. 칭찬 플로우에서 활용.
   ```tsx
   useEffect(() => {
     const openNote = searchParams.get("openNote");
     if (openNote === "true" && userId && userId !== session?.user?.id) {
       setShowAddModal(true);
       const url = new URL(window.location.href);
       url.searchParams.delete("openNote");
       window.history.replaceState({}, "", url.toString());
     }
   }, [searchParams, userId, session?.user?.id]);
   ```

6. **칭찬 플로우**: 메인 피드 -> `/compliment` -> 팀원 선택 -> `/locker/[userId]?openNote=true` -> 쪽지 작성 모달. 또는 마이페이지 모달에서 "칭찬하기" 클릭 시 동일 플로우.

7. **마이페이지 팀원 모달**: 팀원 클릭 시 닦달하기, 락커 보기, 칭찬하기 세 가지 액션을 모달로 제공. `createPortal`로 `#modal-root`에 렌더링.

8. **닦달 메시지 입력**: 닦달 시 선택적으로 50자 이내 메시지를 함께 보낼 수 있음. 메시지가 있으면 푸시 알림 본문에 포함.

9. **POM 투표 변경 허용**: upsert를 사용하여 투표 기간 내에는 투표 대상을 변경할 수 있음. 한 번 투표하면 끝이 아니라 마음이 바뀌면 수정 가능.

10. **한국어 조사 처리**: `withEulReul()` 유틸리티로 "김민수를 닦달했습니다" / "박지훈을 닦달했습니다" 등 을/를 조사를 자동 처리.
