# 어드민 수동 체크인 기능 구현 플랜

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 운영진(ADMIN)이 훈련 상세 페이지에서 체크인하지 못한 팀원을 수동으로 출석 처리할 수 있도록 한다.

**Architecture:** 훈련 상세 페이지에 "출석" 어드민 탭 추가 → AttendanceTab에 "출석 관리" 버튼 추가(어드민 전용) → 클릭 시 바텀시트(AttendanceManageSheet)에서 전체 팀원 체크인 토글. 별도 `/api/training-events/[id]/check-in/admin` 엔드포인트가 RSVP·시간 조건 없이 어드민만 체크인 등록/취소.

**Tech Stack:** Next.js App Router, Prisma (PostgreSQL), SWR, Tailwind CSS v4, TypeScript

---

## Task 1: DB 스키마 — CheckIn에 manualEntry 필드 추가

**Files:**
- Modify: `prisma/schema.prisma` (CheckIn 모델)

**Step 1: schema.prisma 수정**

`prisma/schema.prisma`의 CheckIn 모델에 아래 줄 추가:

```prisma
model CheckIn {
  id              String        @id @default(cuid())
  trainingEventId String
  userId          String
  checkedInAt     DateTime      @default(now())
  isLate          Boolean       @default(false)
  manualEntry     Boolean       @default(false)   // ← 추가
  trainingEvent   TrainingEvent @relation(fields: [trainingEventId], references: [id], onDelete: Cascade)
  user            User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([trainingEventId, userId])
  @@index([trainingEventId])
  @@index([userId])
}
```

**Step 2: 마이그레이션 실행**

```bash
npx prisma migrate dev --name add_checkin_manual_entry
```

Expected: `migrations/..._add_checkin_manual_entry/migration.sql` 파일 생성, "Your database is now in sync" 메시지

**Step 3: Prisma 클라이언트 재생성 확인**

migrate dev 실행 시 자동으로 generate 됨. 확인:

```bash
npx prisma generate
```

**Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: CheckIn 모델에 manualEntry 필드 추가"
```

---

## Task 2: 타입 정의 업데이트

**Files:**
- Modify: `src/types/training-event.ts` (CheckInEntry 인터페이스)

**Step 1: CheckInEntry에 manualEntry 추가**

`src/types/training-event.ts`의 CheckInEntry 인터페이스:

```typescript
export interface CheckInEntry {
  id: string;
  userId: string;
  checkedInAt: string;
  isLate: boolean;
  manualEntry?: boolean;   // ← 추가 (optional: 기존 데이터 호환)
  user: { id: string; name: string | null; image: string | null };
}
```

**Step 2: Commit**

```bash
git add src/types/training-event.ts
git commit -m "feat: CheckInEntry 타입에 manualEntry 필드 추가"
```

---

## Task 3: 어드민 수동 체크인 API

**Files:**
- Create: `src/app/api/training-events/[id]/check-in/admin/route.ts`

**Step 1: 파일 생성**

`src/app/api/training-events/[id]/check-in/admin/route.ts` 를 새로 생성:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 어드민 수동 체크인 추가
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 사용할 수 있습니다" }, { status: 403 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId가 필요합니다" }, { status: 400 });
    }

    // 이벤트가 같은 팀인지 확인
    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    // 대상 유저가 같은 팀인지 확인
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, teamId: true, name: true, image: true },
    });

    if (!targetUser || targetUser.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "같은 팀 팀원이 아닙니다" }, { status: 403 });
    }

    // 중복 체크
    const existing = await prisma.checkIn.findUnique({
      where: { trainingEventId_userId: { trainingEventId: id, userId } },
    });

    if (existing) {
      return NextResponse.json({ error: "이미 체크인되어 있습니다" }, { status: 409 });
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        trainingEventId: id,
        userId,
        checkedInAt: new Date(),
        isLate: false,
        manualEntry: true,
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    return NextResponse.json(checkIn, { status: 201 });
  } catch (error) {
    console.error("어드민 체크인 오류:", error);
    return NextResponse.json({ error: "체크인에 실패했습니다" }, { status: 500 });
  }
}

// 어드민 수동 체크인 취소
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 사용할 수 있습니다" }, { status: 403 });
    }

    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: "userId가 필요합니다" }, { status: 400 });
    }

    // 이벤트 + 팀 확인
    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    // 체크인 기록 존재 여부 확인
    const existing = await prisma.checkIn.findUnique({
      where: { trainingEventId_userId: { trainingEventId: id, userId } },
    });

    if (!existing) {
      return NextResponse.json({ error: "체크인 기록이 없습니다" }, { status: 404 });
    }

    await prisma.checkIn.delete({
      where: { trainingEventId_userId: { trainingEventId: id, userId } },
    });

    return NextResponse.json({ message: "체크인이 취소되었습니다" });
  } catch (error) {
    console.error("어드민 체크인 취소 오류:", error);
    return NextResponse.json({ error: "취소에 실패했습니다" }, { status: 500 });
  }
}
```

**Step 2: 로컬에서 API 동작 확인 (수동)**

로컬 서버 실행 후 curl이나 브라우저 개발자 도구에서 확인:
- 비어드민 세션으로 POST → 403 반환 확인
- 어드민 세션으로 존재하는 userId POST → 201 + checkIn 객체 반환 확인
- 같은 userId 재요청 → 409 반환 확인
- DELETE 요청 → 200 + 메시지 반환 확인

**Step 3: Commit**

```bash
git add src/app/api/training-events/[id]/check-in/admin/route.ts
git commit -m "feat: 어드민 수동 체크인 API 추가 (POST/DELETE /check-in/admin)"
```

---

## Task 4: AttendanceManageSheet 컴포넌트

**Files:**
- Create: `src/components/training/AttendanceManageSheet.tsx`

**Step 1: 컴포넌트 생성**

```typescript
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { X, UserCheck, UserX } from "lucide-react";
import type { CheckInEntry } from "@/types/training-event";

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
}

interface Props {
  eventId: string;
  teamId: string;
  checkIns: CheckInEntry[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

export default function AttendanceManageSheet({
  eventId,
  teamId,
  checkIns,
  isOpen,
  onClose,
  onRefresh,
}: Props) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingMembers(true);
    fetch(`/api/teams/${teamId}/members`)
      .then((res) => res.json())
      .then((data) => setMembers(Array.isArray(data) ? data : []))
      .catch(console.error)
      .finally(() => setLoadingMembers(false));
  }, [isOpen, teamId]);

  const isCheckedIn = (userId: string) =>
    checkIns.some((c) => c.userId === userId);

  const handleToggle = async (userId: string) => {
    if (togglingUserId) return;
    setTogglingUserId(userId);

    const method = isCheckedIn(userId) ? "DELETE" : "POST";

    try {
      const res = await fetch(`/api/training-events/${eventId}/check-in/admin`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "오류가 발생했습니다");
        return;
      }

      onRefresh();
    } catch {
      alert("네트워크 오류가 발생했습니다");
    } finally {
      setTogglingUserId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full bg-white rounded-t-2xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">출석 관리</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <p className="px-5 py-2 text-xs text-gray-500">
          체크인하지 못한 팀원을 직접 등록하거나 취소할 수 있습니다.
        </p>

        {/* 팀원 목록 */}
        <div className="overflow-y-auto flex-1 px-5 pb-6">
          {loadingMembers ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-team-500" />
            </div>
          ) : (
            <div className="space-y-1 pt-2">
              {members.map((member) => {
                const checked = isCheckedIn(member.id);
                const loading = togglingUserId === member.id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center gap-3">
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={member.name || ""}
                          width={32}
                          height={32}
                          className="rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs text-gray-500">
                          {(member.name || "?")[0]}
                        </div>
                      )}
                      <div>
                        <span className="text-sm text-gray-900 font-medium">
                          {member.name || "이름 없음"}
                        </span>
                        {member.number && (
                          <span className="text-xs text-gray-400 ml-1.5">
                            #{member.number}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggle(member.id)}
                      disabled={loading}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        checked
                          ? "bg-green-50 text-green-700 hover:bg-green-100"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      } disabled:opacity-50`}
                    >
                      {loading ? (
                        <div className="w-3.5 h-3.5 animate-spin rounded-full border-b border-current" />
                      ) : checked ? (
                        <>
                          <UserCheck className="w-3.5 h-3.5" />
                          출석
                        </>
                      ) : (
                        <>
                          <UserX className="w-3.5 h-3.5" />
                          미출석
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
              {members.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-6">
                  팀원이 없습니다
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/training/AttendanceManageSheet.tsx
git commit -m "feat: AttendanceManageSheet 바텀시트 컴포넌트 추가"
```

---

## Task 5: AttendanceTab — 어드민 "출석 관리" 버튼 추가

**Files:**
- Modify: `src/components/training/AttendanceTab.tsx`

**Step 1: Props 확장 및 버튼 추가**

기존 `AttendanceTab` Props 인터페이스에 `isAdmin`과 `onManageClick` 추가:

```typescript
interface Props {
  rsvps: RsvpEntry[];
  checkIns: CheckInEntry[];
  isAdmin?: boolean;
  onManageClick?: () => void;
}
```

함수 시그니처 변경:

```typescript
export default function AttendanceTab({ rsvps, checkIns, isAdmin, onManageClick }: Props) {
```

기존 `</div>` (최외곽 `bg-white rounded-xl p-5` div) 닫기 직전에 아래 추가:

```typescript
      {isAdmin && onManageClick && (
        <button
          onClick={onManageClick}
          className="mt-4 w-full py-2.5 rounded-xl bg-team-50 text-team-700 text-sm font-medium hover:bg-team-100 transition-colors"
        >
          출석 관리
        </button>
      )}
```

**Step 2: Commit**

```bash
git add src/components/training/AttendanceTab.tsx
git commit -m "feat: AttendanceTab에 어드민 출석 관리 버튼 추가"
```

---

## Task 6: TrainingDetailClient — "출석" 탭 추가 및 통합

**Files:**
- Modify: `src/app/training/[id]/TrainingDetailClient.tsx`

**Step 1: AdminTab 타입에 "attendance" 추가**

```typescript
type AdminTab = "info" | "latefee" | "session" | "equipment" | "attendance";
```

**Step 2: tabs 배열에 출석 탭 추가**

```typescript
const tabs: { key: AdminTab; label: string }[] = [
  { key: "info", label: "기본 정보" },
  { key: "session", label: "세션" },
  { key: "latefee", label: "지각비" },
  { key: "equipment", label: "장비" },
  { key: "attendance", label: "출석" },   // ← 추가
];
```

**Step 3: import 추가**

파일 상단 import 목록에:

```typescript
const AttendanceTab = lazy(() => import("@/components/training/AttendanceTab"));
const AttendanceManageSheet = lazy(() => import("@/components/training/AttendanceManageSheet"));
```

**Step 4: 상태 추가**

`useState` 선언부에:

```typescript
const [showAttendanceManage, setShowAttendanceManage] = useState(false);
```

**Step 5: 출석 탭 렌더링 추가**

`{isAdmin && activeTab === "equipment" && ...}` 블록 아래에 추가:

```typescript
{isAdmin && activeTab === "attendance" && (
  <Suspense fallback={<div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-team-500" /></div>}>
    <AttendanceTab
      rsvps={event.rsvps}
      checkIns={event.checkIns}
      isAdmin={isAdmin}
      onManageClick={() => setShowAttendanceManage(true)}
    />
  </Suspense>
)}
```

**Step 6: AttendanceManageSheet 마운트**

`{showSendDialog && ...}` 다이얼로그 블록 앞에 추가:

```typescript
{isAdmin && showAttendanceManage && (
  <Suspense fallback={null}>
    <AttendanceManageSheet
      eventId={eventId}
      teamId={event.teamId}
      checkIns={event.checkIns}
      isOpen={showAttendanceManage}
      onClose={() => setShowAttendanceManage(false)}
      onRefresh={() => mutate()}
    />
  </Suspense>
)}
```

**Step 7: 타입 빌드 확인**

```bash
npm run build
```

Expected: 타입 에러 없이 빌드 성공

**Step 8: Commit**

```bash
git add src/app/training/[id]/TrainingDetailClient.tsx
git commit -m "feat: 훈련 상세 출석 탭 추가 및 어드민 수동 체크인 UI 연동"
```

---

## 최종 검증 (수동 테스트)

1. 어드민 계정으로 훈련 상세 페이지 진입
2. "출석" 탭 클릭 → AttendanceTab 렌더링 확인
3. "출석 관리" 버튼 클릭 → 바텀시트 열림 확인
4. 전체 팀원 목록 표시 확인 (RSVP 여부 무관)
5. 미출석 팀원 토글 → "출석"으로 변경, 출석 탭에 반영 확인
6. 출석 처리된 팀원 다시 토글 → "미출석"으로 변경 확인
7. 일반 팀원 계정으로 동일 페이지 → "출석" 탭 없음 확인
8. 출석률 모달 (`/api/teams/attendance-rate`) → 수동 체크인된 팀원도 집계 확인
