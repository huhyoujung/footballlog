# 인증 및 온보딩
> Google OAuth 로그인, NextAuth 세션 관리, 팀 검색/생성/가입, 프로필 설정까지의 사용자 진입 플로우

## 개요

사용자는 Google OAuth를 통해 로그인하며, NextAuth.js + PrismaAdapter로 세션이 관리된다. 로그인 후 팀에 소속되지 않은 사용자는 온보딩 플로우를 거쳐 기존 팀에 가입하거나 새 팀을 생성한다. 온보딩 완료 후 포지션/등번호 등 프로필을 설정할 수 있다.

### 하위 기능

| ID | 하위 기능 | 설명 |
|----|-----------|------|
| 1-1 | 인증 | Google OAuth, NextAuth JWT 전략, 인증 미들웨어 |
| 1-2 | 온보딩 | 팀 검색/생성/가입, 4단계 모드 전환 플로우 |
| 1-3 | 프로필 | 포지션/등번호/이미지 프로필 조회·수정 |

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/lib/auth.ts` | NextAuth 설정 (Google Provider, JWT 전략, 콜백) |
| `src/app/(auth)/login/page.tsx` | 로그인 페이지 UI |
| `src/app/onboarding/page.tsx` | 온보딩 페이지 (팀 검색/생성/가입/프로필 설정) |
| `src/middleware.ts` | 인증 미들웨어 (비로그인 사용자 리다이렉트) |
| `src/app/api/teams/search/route.ts` | 팀 검색 API |
| `src/app/api/teams/join/route.ts` | 팀 가입 API (초대 코드) |
| `src/app/api/teams/route.ts` | 팀 생성 API |
| `src/app/api/profile/route.ts` | 프로필 조회/수정 API |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/teams/search?q={query}` | 팀 이름 검색 (대소문자 무시, 최대 20건) |
| `POST` | `/api/teams` | 새 팀 생성 (생성자는 자동 ADMIN) |
| `POST` | `/api/teams/join` | 초대 코드로 팀 가입 (MEMBER 역할) |
| `GET` | `/api/profile` | 내 프로필 조회 |
| `PUT` | `/api/profile` | 프로필 수정 (이름, 포지션, 등번호, 이미지) |

## 주요 코드

### 1-1. 인증

#### NextAuth 설정 (`src/lib/auth.ts`)

JWT 전략을 사용하며, `session` 콜백에서 DB를 조회하여 사용자의 역할(`role`), 팀 ID(`teamId`), 팀 정보(`team`)를 세션에 주입한다.

```typescript
// src/lib/auth.ts
export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        const user = await prisma.user.findUnique({
          where: { id: token.sub },
          include: { team: true },
        });

        if (user) {
          session.user.id = user.id;
          session.user.role = user.role;
          session.user.teamId = user.teamId;
          session.user.team = user.team;
        }
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },
  pages: {
    signIn: "/login",
  },
};
```

#### 인증 미들웨어 (`src/middleware.ts`)

공개 경로(`/login`, `/invite/*`, `/test-modal`)를 제외한 모든 요청에서 세션 토큰 쿠키를 확인한다. 토큰이 없으면 `/login`으로 리다이렉트하며, `callbackUrl`을 쿼리 파라미터로 전달한다.

```typescript
// src/middleware.ts
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 공개 경로는 통과
  if (
    pathname === "/login" ||
    pathname.startsWith("/invite/") ||
    pathname === "/test-modal"
  ) {
    return NextResponse.next();
  }

  // next-auth 세션 토큰 쿠키 확인
  const token =
    req.cookies.get("next-auth.session-token") ||
    req.cookies.get("__Secure-next-auth.session-token");

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icons|manifest.json|custom-sw.js|.*\\.(?:jpg|jpeg|png|gif|svg|webp|ico|mp3|wav|ogg)).*)"],
};
```

### 1-2. 온보딩

#### 팀 검색 API (`src/app/api/teams/search/route.ts`)

팀 이름을 `contains` + `insensitive` 모드로 검색하며, 초대 코드(`inviteCode`)는 응답에서 제외한다.

```typescript
// src/app/api/teams/search/route.ts
const teams = await prisma.team.findMany({
  where: {
    name: {
      contains: query.trim(),
      mode: "insensitive",
    },
  },
  select: {
    id: true,
    name: true,
    inviteCode: false, // 초대 코드는 숨김
    logoUrl: true,
    _count: {
      select: {
        members: true,
      },
    },
  },
  take: 20,
  orderBy: {
    createdAt: "desc",
  },
});
```

#### 팀 가입 API (`src/app/api/teams/join/route.ts`)

초대 코드로 팀을 찾고, 사용자를 해당 팀에 `MEMBER` 역할로 추가한다. 이미 다른 팀에 소속되어 있으면 가입을 거부한다.

```typescript
// src/app/api/teams/join/route.ts
// 이미 팀에 소속되어 있는지 확인
const existingUser = await prisma.user.findUnique({
  where: { id: session.user.id },
});

if (existingUser?.teamId) {
  return NextResponse.json(
    { error: "이미 팀에 소속되어 있습니다" },
    { status: 400 }
  );
}

// 초대 코드로 팀 찾기
const team = await prisma.team.findUnique({
  where: { inviteCode: inviteCode.trim() },
});

if (!team) {
  return NextResponse.json(
    { error: "유효하지 않은 초대 코드입니다" },
    { status: 404 }
  );
}

// 사용자를 팀에 추가
await prisma.user.update({
  where: { id: session.user.id },
  data: {
    teamId: team.id,
    role: "MEMBER",
  },
});
```

### 1-3. 프로필

#### 프로필 수정 API (`src/app/api/profile/route.ts`)

이름, 이미지, 포지션, 등번호를 개별적으로 수정할 수 있다. 등번호는 0~99 범위를 검증한다.

```typescript
// src/app/api/profile/route.ts
if (number !== undefined) {
  if (number !== null && (typeof number !== "number" || number < 0 || number > 99)) {
    return NextResponse.json({ error: "등번호는 0~99 사이여야 합니다" }, { status: 400 });
  }
  updateData.number = number;
}

const user = await prisma.user.update({
  where: { id: session.user.id },
  data: updateData,
  select: {
    id: true,
    name: true,
    email: true,
    image: true,
    position: true,
    number: true,
  },
});
```

#### 온보딩 플로우 (`src/app/onboarding/page.tsx`)

4단계 모드 전환 방식(`select` -> `find` / `create` -> `profile`)으로 구성된다. 팀 검색은 300ms 디바운스를 적용한다.

```typescript
// src/app/onboarding/page.tsx
const [mode, setMode] = useState<"select" | "find" | "create" | "profile">("select");

// 팀 검색 (300ms 디바운스)
useEffect(() => {
  const searchTeams = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const res = await fetch(`/api/teams/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.teams || []);
      }
    } catch {
      // ignore
    }
  };

  const timer = setTimeout(searchTeams, 300);
  return () => clearTimeout(timer);
}, [searchQuery]);
```

온보딩 완료 시 푸시 알림 구독을 시도한다 (실패해도 진행에 영향 없음).

```typescript
// src/app/onboarding/page.tsx
const completeOnboarding = async () => {
  // 푸시 알림 권한 요청 (비동기, 실패해도 계속 진행)
  if (isSupported) {
    try {
      await subscribe();
    } catch (error) {
      console.log("Push notification prompt skipped or denied");
    }
  }

  // 홈으로 이동
  router.push("/");
  router.refresh();
};
```

## 비즈니스 규칙

| 규칙 | 설명 |
|------|------|
| 1계정 1팀 | 한 사용자는 하나의 팀에만 소속 가능. 이미 팀이 있으면 가입/생성 불가 |
| 초대 코드 필수 | 기존 팀에 가입하려면 운영진에게 받은 초대 코드를 입력해야 함 |
| 초대 코드 비공개 | 팀 검색 결과에 초대 코드가 포함되지 않음 (`inviteCode: false`) |
| 팀 생성자 = ADMIN | 팀을 생성한 사용자는 자동으로 `ADMIN` 역할 부여 |
| 팀 가입자 = MEMBER | 초대 코드로 가입한 사용자는 `MEMBER` 역할 |
| 등번호 범위 | 0~99 사이 정수만 허용 |
| 포지션 목록 | 감독, GK, CB, LB, RB, CDM, CM, CAM, LM, RM, LW, RW, ST, CF |
| 미들웨어 예외 | `/login`, `/invite/*`, `/test-modal`, API 경로, 정적 파일은 인증 없이 접근 가능 |
| 쿠키 확인 | `next-auth.session-token` 또는 `__Secure-next-auth.session-token` (HTTPS 환경) |
| 푸시 알림 | 온보딩 완료 시 브라우저 푸시 알림 구독을 시도 (선택적, 실패 허용) |

## 데이터 모델

```prisma
enum Role {
  ADMIN
  MEMBER
}

model User {
  id                 String    @id @default(cuid())
  name               String?
  email              String?   @unique
  emailVerified      DateTime?
  image              String?
  role               Role      @default(MEMBER)
  teamId             String?
  position           String?
  number             Int?
  isEquipmentManager Boolean   @default(false)
  createdAt          DateTime  @default(now())
  updatedAt          DateTime  @updatedAt

  team         Team?         @relation(fields: [teamId], references: [id])
  accounts     Account[]
  sessions     Session[]
  createdTeam  Team?         @relation("CreatedBy")

  @@index([teamId])
}

model Team {
  id           String   @id @default(cuid())
  name         String
  inviteCode   String   @unique @default(cuid())
  logoUrl      String?
  primaryColor String   @default("#967B5D")
  vestOrder    String[] @default([])
  createdAt    DateTime @default(now())
  createdBy    String   @unique

  creator  User   @relation("CreatedBy", fields: [createdBy], references: [id])
  members  User[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}
```

## 프론트엔드

### 로그인 페이지 (`src/app/(auth)/login/page.tsx`)

- 라커룸 배경 이미지 위에 블러 + 어두운 오버레이 처리
- "라커룸" 브랜드명과 "필드 밖에서도 이어지는 우리의 이야기" 서브 카피
- Google 로그인 버튼 단일 제공
- 하단 카카오톡 오픈채팅 문의 링크

```tsx
// src/app/(auth)/login/page.tsx
const handleGoogleSignIn = () => {
  signIn("google", { callbackUrl: "/" });
};
```

### 온보딩 페이지 (`src/app/onboarding/page.tsx`)

- **모드 선택 (`select`)**: "기존 팀 찾아서 가입하기" / "새로운 팀 만들기" 2가지 선택
- **팀 찾기 (`find`)**: 텍스트 입력으로 팀 검색 -> 팀 선택 -> 초대 코드 입력 -> 가입
- **팀 생성 (`create`)**: 팀 이름 입력 -> 생성
- **프로필 설정 (`profile`)**: 포지션 선택(드롭다운) + 등번호 입력(숫자)

데이터 페칭 패턴:
- 팀 검색: `useEffect` + `setTimeout` (300ms 디바운스)
- 팀 생성/가입: `fetch` POST 요청 후 `session.update()` 호출하여 세션 갱신
- 프로필 저장: `fetch` PUT 요청

UX 특징:
- BackButton 컴포넌트로 이전 단계 복귀
- 각 모드 전환 시 관련 상태 초기화 (에러, 입력값 등)
- 로딩 상태에서 버튼 비활성화
- "한 계정은 하나의 팀에만 소속될 수 있습니다" 안내 문구
- 팀 검색 결과에서 로고 또는 팀 이름 첫 글자 아바타 표시
