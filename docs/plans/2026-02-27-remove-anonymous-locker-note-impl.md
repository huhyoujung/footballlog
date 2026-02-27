# 락커 쪽지 익명 기능 제거 구현 플랜

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 쪽지 작성 시 익명 토글을 제거하고, 모든 쪽지에서 발신자 이름을 항상 표시한다.

**Architecture:** 프론트엔드 UI/로직 정리 + API에서 isAnonymous 파라미터 무시. DB 스키마는 변경 없음(마이그레이션 불필요). 기존 isAnonymous=true 쪽지도 소급 적용되어 발신자 이름이 노출됨.

**Tech Stack:** Next.js App Router, TypeScript, Prisma, Tailwind CSS

---

### Task 1: LockerClient.tsx — state 및 API 호출 정리

**Files:**
- Modify: `src/app/locker/[userId]/LockerClient.tsx`

**Step 1: `isAnonymous` state 제거**

`LockerClient.tsx:116` 줄 삭제:
```tsx
// 삭제
const [isAnonymous, setIsAnonymous] = useState(false);
```

**Step 2: `showAuthor` state 제거**

`LockerClient.tsx:120` 줄 삭제:
```tsx
// 삭제
const [showAuthor, setShowAuthor] = useState(false);
```

**Step 3: handleAddNote에서 isAnonymous 제거**

`LockerClient.tsx` 의 `handleAddNote` 함수 내 API 호출 body에서 `isAnonymous,` 라인 삭제.

리셋 로직에서도 `setIsAnonymous(false);` 두 곳 삭제 (`setShowAddModal(false)` 직후 초기화 블록 두 군데).

**Step 4: LockerNote 인터페이스에서 isAnonymous 제거**

`LockerClient.tsx:20` 근처 `LockerNote` 인터페이스에서:
```tsx
// 삭제
isAnonymous: boolean;
```

**Step 5: 타입 체크**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: isAnonymous 관련 에러 발생 (아직 모달 UI와 확대 모달 미수정)

---

### Task 2: LockerClient.tsx — 쪽지 작성 모달 UI 정리

**Files:**
- Modify: `src/app/locker/[userId]/LockerClient.tsx`

**Step 1: 익명 토글 섹션 제거**

다음 블록 전체 삭제 (쪽지 작성 모달 내 "보내는 사람" 섹션):
```tsx
{/* 익명 옵션 - 토글 */}
<div className="mt-4">
  <div className="flex items-center justify-between">
    <span className="text-sm font-medium text-gray-700">보내는 사람</span>
    <div className="inline-flex bg-gray-200 rounded-full p-0.5">
      <button
        type="button"
        onClick={() => setIsAnonymous(false)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          !isAnonymous
            ? "bg-team-500 text-white shadow-sm"
            : "text-gray-600"
        }`}
      >
        드러냄
      </button>
      <button
        type="button"
        onClick={() => setIsAnonymous(true)}
        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
          isAnonymous
            ? "bg-gray-400 text-white shadow-sm"
            : "text-gray-600"
        }`}
      >
        숨김
      </button>
    </div>
  </div>
</div>
```

**Step 2: 모달 닫기 핸들러의 setIsAnonymous 제거**

모달 backdrop onClick과 취소 버튼 onClick에서 `setIsAnonymous(false);` 제거 (이미 Task 1에서 했다면 스킵).

---

### Task 3: LockerClient.tsx — 쪽지 확대 모달 표시 로직 정리

**Files:**
- Modify: `src/app/locker/[userId]/LockerClient.tsx`

**Step 1: 확대 모달 닫기 핸들러에서 showAuthor 제거**

```tsx
// 변경 전
onClick={() => {
  setExpandedNoteId(null);
  setShowAuthor(false);
}}

// 변경 후
onClick={() => {
  setExpandedNoteId(null);
}}
```

**Step 2: 발신자 표시 로직을 항상 author.name으로 변경**

```tsx
// 변경 전
<p className="text-sm text-gray-600">
  {note?.isAnonymous
    ? showAuthor
      ? note.author.name
      : "익명의 팀원"
    : note?.author.name}
</p>
{isMyLocker && note?.isAnonymous && (
  <button
    onClick={() => setShowAuthor(!showAuthor)}
    className="text-xs text-gray-500 hover:text-gray-700 underline"
  >
    {showAuthor ? "숨기기" : "보기"}
  </button>
)}

// 변경 후
<p className="text-sm text-gray-600">
  {note?.author.name}
</p>
```

**Step 3: 타입 체크**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: LockerClient.tsx 관련 에러 없음

**Step 4: 커밋**

```bash
git add src/app/locker/[userId]/LockerClient.tsx
git commit -m "feat: 락커 쪽지 익명 기능 제거 - LockerClient UI/로직 정리"
```

---

### Task 4: PolaroidStack.tsx — 항상 발신자 표시

**Files:**
- Modify: `src/components/PolaroidStack.tsx`

**Step 1: isAnonymous 조건 제거**

`PolaroidStack.tsx:399` 근처:
```tsx
// 변경 전
: !note?.isAnonymous && note?.author?.name && (
    <p className="text-sm text-gray-500 text-center mt-4">
      From. {note.author.name}
    </p>
  )

// 변경 후
: note?.author?.name && (
    <p className="text-sm text-gray-500 text-center mt-4">
      From. {note.author.name}
    </p>
  )
```

**Step 2: 타입 체크**

```bash
npx tsc --noEmit 2>&1 | head -30
```
Expected: 에러 없음

**Step 3: 커밋**

```bash
git add src/components/PolaroidStack.tsx
git commit -m "feat: 쪽지 발신자 항상 표시 (PolaroidStack)"
```

---

### Task 5: API route.ts — isAnonymous 파라미터 제거

**Files:**
- Modify: `src/app/api/locker-notes/route.ts`

**Step 1: POST 핸들러에서 isAnonymous destructuring 제거**

```ts
// 변경 전
const {
  recipientId,
  content,
  color,
  rotation,
  positionX,
  positionY,
  isAnonymous,
  trainingEventId,
  trainingLogId,
  tags,
} = body;

// 변경 후
const {
  recipientId,
  content,
  color,
  rotation,
  positionX,
  positionY,
  trainingEventId,
  trainingLogId,
  tags,
} = body;
```

**Step 2: DB 저장 시 isAnonymous 하드코딩**

```ts
// 변경 전
isAnonymous: isAnonymous || false,

// 변경 후
isAnonymous: false,
```

**Step 3: 타입 체크 + 빌드**

```bash
npx tsc --noEmit 2>&1 | head -30
npm run build 2>&1 | tail -20
```
Expected: 에러 없음

**Step 4: 커밋**

```bash
git add src/app/api/locker-notes/route.ts
git commit -m "feat: 쪽지 API에서 isAnonymous 파라미터 제거"
```

---

### Task 6: 최종 빌드 검증

**Step 1: 전체 빌드**

```bash
npm run build
```
Expected: ✓ Compiled successfully

**Step 2: isAnonymous 잔존 참조 확인**

```bash
grep -r "isAnonymous\|setIsAnonymous\|showAuthor\|setShowAuthor" src/ --include="*.tsx" --include="*.ts"
```
Expected: `Feed.tsx`, `PolaroidDateGroup.tsx`, `PolaroidStack.tsx` 타입 정의에만 남아 있어야 함. 로직/UI 참조 없어야 함.

**Step 3: 완료 커밋 (필요 시)**

빌드 성공 확인 후 추가 수정 사항이 있다면 커밋.
