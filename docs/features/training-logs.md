<!-- 운동 일지 기능 명세서 -->

# 운동 일지

> 팀원들이 훈련 기록을 작성하고, 댓글/좋아요/@멘션으로 상호작용하는 핵심 기능

## 개요

운동 일지는 football-log의 핵심 기능으로, 팀원이 팀 운동 또는 개인 운동에 대한 훈련 기록을 작성하고 공유하는 기능이다. 각 일지에는 컨디션(0~10), 핵심 포인트, 개선점 등을 기록하며, 이미지 첨부와 @멘션을 지원한다. 같은 팀 소속 팀원들만 일지를 조회하고 상호작용(댓글, 좋아요)할 수 있다.

### 하위 기능

| ID | 하위 기능 | 설명 |
|----|-----------|------|
| 4-1 | 일지 CRUD | 일지 작성/수정/삭제, @멘션 파싱, 이미지 압축·업로드 |
| 4-2 | 댓글 | 댓글 작성, @멘션(최대 5명), 다중 알림 |
| 4-3 | 좋아요 | 토글 방식, Optimistic UI, 푸시 알림 |

## 관련 파일

| 파일 경로 | 역할 |
|-----------|------|
| `src/app/api/training-logs/route.ts` | 일지 목록 조회 (GET) + 작성 (POST) |
| `src/app/api/training-logs/[id]/route.ts` | 일지 상세 조회 (GET) + 수정 (PUT) + 삭제 (DELETE) |
| `src/app/api/training-logs/[id]/comments/route.ts` | 댓글 작성 (POST) |
| `src/app/api/training-logs/[id]/likes/route.ts` | 좋아요 토글 (POST) |
| `src/app/write/page.tsx` | 일지 작성/수정 폼 페이지 |
| `src/app/log/[id]/page.tsx` | 일지 상세 보기 페이지 |
| `src/lib/compressImage.ts` | 클라이언트 사이드 이미지 압축 |
| `src/lib/mention.tsx` | @멘션 파싱 및 하이라이트 유틸리티 |
| `src/components/MentionTextarea.tsx` | @멘션 자동완성 텍스트 입력 컴포넌트 |

## API 엔드포인트

### 1. `GET /api/training-logs` - 일지 목록 조회

같은 팀의 운동 일지를 페이지네이션으로 조회한다. 특정 유저의 일지만 필터링할 수 있다.

**쿼리 파라미터:**
- `page` (기본값: 1)
- `limit` (기본값: 10, 최대: 50)
- `userId` (선택, 특정 유저 필터)

**응답 형식:**
```json
{
  "logs": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 42,
    "totalPages": 5
  }
}
```

### 2. `POST /api/training-logs` - 일지 작성

새 운동 일지를 작성한다. 팀원에게 푸시 알림을 보내고, @멘션된 유저에게 개별 알림을 발송한다.

**요청 본문:**
- `trainingEventId` (선택, 팀 운동 연결)
- `title` (선택, 개인 운동 제목)
- `trainingDate` (필수)
- `condition` (필수, 0~10)
- `conditionReason` (필수)
- `keyPoints` (필수)
- `improvement` (필수)
- `notes` (선택)
- `imageUrl` (선택)

### 3. `GET /api/training-logs/[id]` - 일지 상세 조회

일지 상세 정보와 댓글 목록, 좋아요 상태를 함께 반환한다. 같은 팀만 접근 가능.

### 4. `PUT /api/training-logs/[id]` - 일지 수정

본인이 작성한 일지만 수정 가능하다.

### 5. `DELETE /api/training-logs/[id]` - 일지 삭제

본인 또는 ADMIN 역할만 삭제 가능하다.

### 6. `POST /api/training-logs/[id]/comments` - 댓글 작성

일지에 댓글을 남긴다. 최대 5명까지 @멘션 가능하다.

### 7. `POST /api/training-logs/[id]/likes` - 좋아요 토글

좋아요가 없으면 추가, 있으면 삭제하는 토글 방식이다.

## 주요 코드

### 4-1. 일지 CRUD

#### 일지 목록 조회 - 같은 팀 필터링 + 좋아요 상태 포함

`src/app/api/training-logs/route.ts`:

```typescript
// 같은 팀의 운동 일지만 조회 (userId 필터 옵션)
const whereClause: any = {
  user: {
    teamId: session.user.teamId,
  },
};

if (userId) {
  whereClause.userId = userId;
}

const [logs, total] = await Promise.all([
  prisma.trainingLog.findMany({
    where: whereClause,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          image: true,
          position: true,
          number: true,
        },
      },
      trainingEvent: {
        select: {
          id: true,
          title: true,
          date: true,
        },
      },
      _count: {
        select: {
          comments: true,
          likes: true,
        },
      },
      likes: {
        where: {
          userId: session.user.id,
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take: limit,
  }),
  prisma.trainingLog.count({
    where: whereClause,
  }),
]);

const logsWithLikeStatus = logs.map((log) => ({
  ...log,
  isLiked: log.likes.length > 0,
  likes: undefined,
}));
```

#### 일지 작성 - @멘션 파싱 + 태그 연결 + 푸시 알림

`src/app/api/training-logs/route.ts`:

```typescript
// 팀원 목록 조회 (멘션 파싱용)
const teamMembers = await prisma.user.findMany({
  where: { teamId: session.user.teamId },
  select: { id: true, name: true },
});

// @멘션 파싱 (컨디션이유, 메모, 핵심포인트, 개선점 모두 포함)
const combinedText = `${conditionReason} ${notes || ""} ${keyPoints} ${improvement}`;
const taggedUserIds = parseMentions(combinedText, teamMembers);

const log = await prisma.trainingLog.create({
  data: {
    userId: session.user.id,
    ...(trainingEventId && { trainingEventId }),
    ...(title && { title }),
    trainingDate: new Date(trainingDate),
    condition,
    conditionReason: conditionReason.trim(),
    keyPoints: keyPoints.trim(),
    improvement: improvement.trim(),
    ...(notes && { notes: notes.trim() }),
    ...(imageUrl && { imageUrl }),
    ...(taggedUserIds.length > 0 && {
      taggedUsers: {
        connect: taggedUserIds.map((id) => ({ id })),
      },
    }),
  },
  // ...
});

// 팀원들에게 푸시 알림 (비동기, 실패해도 응답에 영향 없음)
sendPushToTeam(session.user.teamId, session.user.id, {
  title: "새 운동 일지",
  body: `${session.user.name || "팀원"}님이 운동 일지를 올렸어요!`,
  url: `/log/${log.id}`,
}).catch(() => {});

// 태그된 사람들에게 개별 알림 발송
if (taggedUserIds.length > 0) {
  const { sendPushToUsers } = await import("@/lib/push");
  sendPushToUsers(taggedUserIds, {
    title: "📢 훈련 일지에 언급되셨어요",
    body: `${session.user.name || "팀원"}님이 운동 일지에서 회원님을 언급했습니다`,
    url: `/log/${log.id}`,
  }).catch(() => {});
}
```

#### 일지 삭제 - 본인 또는 ADMIN 권한 확인

`src/app/api/training-logs/[id]/route.ts`:

```typescript
// 본인 또는 ADMIN만 삭제 가능
if (log.userId !== session.user.id && session.user.role !== "ADMIN") {
  return NextResponse.json({ error: "삭제 권한이 없습니다" }, { status: 403 });
}

await prisma.trainingLog.delete({
  where: { id },
});
```

### 4-2. 댓글

#### 댓글 작성 - 멘션 유효성 검사 + 다중 알림

`src/app/api/training-logs/[id]/comments/route.ts`:

```typescript
const { content, mentions = [] } = await req.json();

// 멘션 유효성 검사 (최대 5명, 같은 팀, 자기 자신 제외)
const validMentions: string[] = [];
if (mentions.length > 0) {
  const mentionedUsers = await prisma.user.findMany({
    where: {
      id: { in: mentions },
      teamId: session.user.teamId,
      NOT: { id: session.user.id },
    },
    select: { id: true },
  });
  validMentions.push(...mentionedUsers.map((u) => u.id).slice(0, 5));
}

const comment = await prisma.comment.create({
  data: {
    content: content.trim(),
    mentions: validMentions,
    userId: session.user.id,
    trainingLogId,
  },
  // ...
});

// 푸시 알림
const notifyUsers: string[] = [];

// 1. 일지 작성자에게 (본인 제외)
if (log.userId !== session.user.id && !validMentions.includes(log.userId)) {
  notifyUsers.push(log.userId);
}

// 2. 멘션된 사용자들에게
if (validMentions.length > 0) {
  await sendPushToUsers(validMentions, {
    title: "💬 댓글에서 멘션",
    body: `${session.user.name || "팀원"}님이 댓글에서 회원님을 멘션했어요`,
    url: `/log/${trainingLogId}`,
  });
}

// 3. 일지 작성자에게 (멘션되지 않은 경우)
if (notifyUsers.length > 0) {
  await sendPushToUsers(notifyUsers, {
    title: "새 댓글",
    body: `${session.user.name || "팀원"}님이 회원님의 일지에 댓글을 남겼어요`,
    url: `/log/${trainingLogId}`,
  });
}
```

### 4-3. 좋아요

#### 좋아요 토글 - 존재 여부에 따른 추가/삭제

`src/app/api/training-logs/[id]/likes/route.ts`:

```typescript
// 이미 좋아요 했는지 확인
const existingLike = await prisma.like.findUnique({
  where: {
    userId_trainingLogId: {
      userId: session.user.id,
      trainingLogId,
    },
  },
});

if (existingLike) {
  // 좋아요 취소
  await prisma.like.delete({
    where: { id: existingLike.id },
  });
  const likeCount = await prisma.like.count({ where: { trainingLogId } });
  return NextResponse.json({ liked: false, likeCount });
} else {
  // 좋아요 추가
  await prisma.like.create({
    data: {
      userId: session.user.id,
      trainingLogId,
    },
  });
  const likeCount = await prisma.like.count({ where: { trainingLogId } });

  // 푸시 알림: 일지 작성자에게 (본인 좋아요 제외)
  if (log.userId !== session.user.id) {
    await sendPushToUsers([log.userId], {
      title: "❤️ 좋아요",
      body: `${session.user.name || "팀원"}님이 회원님의 일지에 좋아요를 눌렀어요`,
      url: `/log/${trainingLogId}`,
    });
  }

  return NextResponse.json({ liked: true, likeCount });
}
```

#### @멘션 파싱 유틸리티

`src/lib/mention.tsx`:

```typescript
/**
 * 텍스트에서 @멘션을 파싱하여 태그된 사용자 ID 배열 반환
 * @param text - 파싱할 텍스트 (예: "오늘 @김민수 님과 패스 연습...")
 * @param teamMembers - 팀원 목록
 * @returns 태그된 사용자 ID 배열 (중복 제거)
 */
export function parseMentions(
  text: string,
  teamMembers: TeamMember[]
): string[] {
  const mentionPattern = /@([^\s@]+)/g;
  const matches = Array.from(text.matchAll(mentionPattern));

  if (matches.length === 0) return [];

  const taggedIds = new Set<string>();

  for (const match of matches) {
    const mentionedName = match[1];
    const member = teamMembers.find(
      (m) => m.name && m.name.trim() === mentionedName.trim()
    );
    if (member) {
      taggedIds.add(member.id);
    }
  }

  return Array.from(taggedIds);
}
```

#### 이미지 압축

`src/lib/compressImage.ts`:

```typescript
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.8;
const OUTPUT_TYPE = "image/jpeg";

/**
 * 이미지 파일을 리사이즈 + JPEG 압축하여 반환합니다.
 * - 최대 1920x1920 내로 리사이즈 (비율 유지)
 * - JPEG 품질 0.8로 압축
 * - 보통 10-30MB 폰 사진 → 200KB~1MB로 줄어듦
 */
export async function compressImage(file: File): Promise<File> {
  // 이미 충분히 작으면 그대로 반환 (1MB 이하)
  if (file.size <= 1 * 1024 * 1024) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let newWidth = width;
  let newHeight = height;

  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
    newWidth = Math.round(width * ratio);
    newHeight = Math.round(height * ratio);
  }

  // OffscreenCanvas 지원 시 사용 (메인 스레드 부담 감소)
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");

  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  const blob = await canvas.convertToBlob({
    type: OUTPUT_TYPE,
    quality: QUALITY,
  });

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: OUTPUT_TYPE,
  });
}
```

#### MentionTextarea 컴포넌트 - @멘션 자동완성

`src/components/MentionTextarea.tsx`:

```tsx
export default function MentionTextarea({
  value, onChange, teamMembers, placeholder, rows = 5,
  className = "", dropdownPosition = "bottom",
}: Props) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);

  // @ 입력 감지
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      // @ 이후 공백이 없으면 멘션 입력 중
      if (!textAfterAt.includes(" ") && !textAfterAt.includes("\n")) {
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
        setShowSuggestions(true);
        setSelectedIndex(0);
        return;
      }
    }
    setShowSuggestions(false);
  }, [value]);

  // 필터링된 팀원 목록
  const filteredMembers = teamMembers.filter((member) =>
    member.name?.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  // 팀원 선택
  const selectMember = (member: TeamMember) => {
    if (mentionStartPos === null || !textareaRef.current) return;
    const before = value.substring(0, mentionStartPos);
    const after = value.substring(textareaRef.current.selectionStart);
    const newValue = `${before}@${member.name} ${after}`;
    const mentions = extractMentions(newValue);
    onChange(newValue, mentions);
    setShowSuggestions(false);
  };

  // ...
}
```

## 비즈니스 규칙

### 접근 제어

| 규칙 | 설명 |
|------|------|
| 로그인 필수 | 모든 API에서 `getServerSession` 검증 |
| 팀 소속 필수 | 팀에 가입되지 않은 유저는 일지 작성/조회 불가 |
| 같은 팀만 조회 | 다른 팀의 일지에 접근 시 403 반환 |
| 수정 권한 | 본인이 작성한 일지만 수정 가능 |
| 삭제 권한 | 본인 또는 ADMIN 역할만 삭제 가능 |

### 유효성 검사

| 필드 | 검증 규칙 |
|------|-----------|
| `trainingDate` | 필수, 빈 값 불가 |
| `condition` | 필수, 0~10 사이 정수 |
| `conditionReason` | 필수, 공백만 있는 경우 불가 |
| `keyPoints` | 필수, 공백만 있는 경우 불가 |
| `improvement` | 필수, 공백만 있는 경우 불가 |
| `notes` | 선택, 빈 값이면 null 처리 |

### 댓글 멘션 제한

| 규칙 | 설명 |
|------|------|
| 최대 멘션 수 | 댓글 1개당 최대 5명 |
| 같은 팀만 | 다른 팀원은 멘션 불가 |
| 자기 자신 제외 | 본인은 멘션 대상에서 제외 |

### 페이지네이션

| 파라미터 | 기본값 | 제한 |
|----------|--------|------|
| `page` | 1 | 최소 1 |
| `limit` | 10 | 최소 1, 최대 50 |

### 이미지 압축

| 규칙 | 값 |
|------|-----|
| 1MB 이하 | 압축 없이 그대로 반환 |
| 최대 해상도 | 1920x1920 (비율 유지) |
| JPEG 품질 | 0.8 |
| 처리 방식 | OffscreenCanvas (메인 스레드 부담 감소) |

### 푸시 알림

| 이벤트 | 수신 대상 | 제목 |
|--------|-----------|------|
| 일지 작성 | 같은 팀 전체 (작성자 제외) | "새 운동 일지" |
| @멘션 (일지) | 태그된 유저 | "훈련 일지에 언급되셨어요" |
| 댓글 작성 | 일지 작성자 (본인 제외) | "새 댓글" |
| @멘션 (댓글) | 멘션된 유저 | "댓글에서 멘션" |
| 좋아요 | 일지 작성자 (본인 제외) | "좋아요" |

## 데이터 모델

### TrainingLog

```prisma
model TrainingLog {
  id              String   @id @default(cuid())
  userId          String
  trainingEventId String?  // 팀 운동 연결 (nullable)
  title           String?  // 개인 운동 제목 (nullable)
  trainingDate    DateTime
  condition       Int      // 0-10
  conditionReason String   @db.Text
  keyPoints       String   @db.Text
  improvement     String   @db.Text
  notes           String?  @db.Text
  imageUrl        String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  user          User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  trainingEvent TrainingEvent? @relation(fields: [trainingEventId], references: [id], onDelete: SetNull)
  comments      Comment[]
  likes         Like[]
  taggedUsers   User[]         @relation("TaggedInLogs")
  lockerNotes   LockerNote[]   @relation("LockerNotes")

  @@index([userId, createdAt(sort: Desc)])
  @@index([trainingEventId])
}
```

### Comment

```prisma
model Comment {
  id            String   @id @default(cuid())
  content       String   @db.Text
  mentions      String[] @default([])  // 멘션된 유저 ID 배열
  userId        String
  trainingLogId String
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  trainingLog TrainingLog @relation(fields: [trainingLogId], references: [id], onDelete: Cascade)

  @@index([trainingLogId, createdAt])
}
```

### Like

```prisma
model Like {
  id            String   @id @default(cuid())
  userId        String
  trainingLogId String
  createdAt     DateTime @default(now())

  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  trainingLog TrainingLog @relation(fields: [trainingLogId], references: [id], onDelete: Cascade)

  @@unique([userId, trainingLogId])
  @@index([trainingLogId])
}
```

## 프론트엔드

### 주요 페이지/컴포넌트

| 페이지/컴포넌트 | 경로 | 역할 |
|-----------------|------|------|
| `WritePage` | `/write` | 일지 작성 및 수정 폼 |
| `LogDetailPage` | `/log/[id]` | 일지 상세 보기, 댓글, 좋아요 |
| `MentionTextarea` | 컴포넌트 | @멘션 자동완성 입력 |
| `ConditionPicker` | 컴포넌트 (Lazy) | 컨디션 점수 선택 모달 |

### 데이터 페칭 패턴

**SWR 기반 캐싱:**

```tsx
// 일지 상세 - 2분 캐시, 포커스 시 재검증 안 함
const { data: log, isLoading, mutate } = useSWR<TrainingLog>(
  `/api/training-logs/${id}`,
  fetcher,
  {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 120000, // 2분 캐시
  }
);
```

**낙관적 업데이트 (좋아요):**

```tsx
const handleLike = async () => {
  if (!log) return;
  const wasLiked = log.isLiked;
  const prevCount = log._count.likes;

  // SWR mutate로 낙관적 업데이트
  mutate(
    {
      ...log,
      isLiked: !wasLiked,
      _count: { ...log._count, likes: wasLiked ? prevCount - 1 : prevCount + 1 },
    },
    false
  );

  try {
    const res = await fetch(`/api/training-logs/${id}/likes`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      mutate(
        {
          ...log,
          isLiked: data.liked,
          _count: { ...log._count, likes: data.likeCount },
        },
        false
      );
    } else {
      mutate(); // 롤백
    }
  } catch (error) {
    mutate(); // 롤백
  }
};
```

### UX 특징

1. **작성/수정 겸용 페이지**: `?edit=ID` 쿼리 파라미터로 수정 모드 진입. 같은 페이지에서 `isEditMode` 플래그로 분기 처리.

2. **팀 운동 / 개인 운동 토글**: 운동 분류를 "개인"과 "팀"으로 구분하며, 팀 선택 시 최근 30일의 팀 운동 목록에서 선택.

3. **폼 완성도 기반 CTA**: 모든 필수 필드가 채워져야 하단 제출 버튼이 나타남.
   ```tsx
   const isFormComplete =
     (formData.logType === "team" || formData.title.trim() !== "") &&
     formData.condition !== null &&
     formData.conditionReason.trim() !== "" &&
     formData.keyPoints.trim() !== "" &&
     formData.improvement.trim() !== "";
   ```

4. **이미지 압축 후 업로드**: 이미지 선택 시 `compressImage()`로 클라이언트 사이드 압축 -> `/api/upload`로 업로드 -> 반환된 URL을 일지 작성 시 전달.

5. **수정 불가 이미지**: 수정 모드에서는 기존 이미지를 표시만 하고, "사진은 수정할 수 없습니다" 안내 표시.

6. **ConditionPicker Lazy Loading**: 컨디션 선택 모달은 `React.lazy()`로 필요 시에만 로드.
   ```tsx
   const ConditionPicker = lazy(() => import("@/components/ConditionPicker"));
   ```

7. **수정됨 표시**: `createdAt`과 `updatedAt` 차이가 1초 이상이면 "(수정됨)" 표시.
   ```tsx
   function isEdited(createdAt: string, updatedAt: string) {
     return new Date(updatedAt).getTime() - new Date(createdAt).getTime() > 1000;
   }
   ```

8. **멘션 하이라이트**: 본문과 댓글에서 `@이름` 형태의 텍스트를 팀원 목록과 대조하여 하이라이트 처리.

9. **칭찬하기 배너**: 다른 사람의 일지를 볼 때 "칭찬 쪽지를 남겨보세요!" 배너가 표시되어 락커 페이지로 연결.

10. **댓글 입력 드롭다운 위치**: 하단 고정 댓글 입력창에서는 멘션 드롭다운이 위로 표시 (`dropdownPosition="top"`).
