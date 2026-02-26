# 락커 쪽지 익명 기능 제거

**날짜**: 2026-02-27
**배경**: 내 라커에서 수신자는 이미 발신자를 볼 수 있도록 하려다, 익명 기능 자체를 제거하는 방향으로 결정.

## 결정 사항

모든 쪽지는 발신자 이름을 항상 표시한다. 익명으로 보내는 옵션을 완전히 제거한다.
기존 `isAnonymous: true`로 저장된 쪽지도 소급 적용 — 발신자 이름이 노출된다.

## 변경 범위

### 1. `src/app/locker/[userId]/LockerClient.tsx`
- `isAnonymous` state 제거
- `showAuthor` state 제거
- 쪽지 작성 모달에서 "보내는 사람 드러냄/숨김" 토글 섹션 제거
- `handleAddNote`: `isAnonymous` 파라미터 제거
- `handleAddNote` 리셋 로직에서 `setIsAnonymous(false)` 제거
- 쪽지 확대 모달: `isAnonymous` 조건 제거 → 항상 `author.name` 표시
- 쪽지 확대 모달: "보기/숨기기" 버튼 제거

### 2. `src/components/PolaroidStack.tsx`
- `!note?.isAnonymous &&` 조건 제거 → 항상 `From. {name}` 표시

### 3. `src/app/api/locker-notes/route.ts` (POST)
- `isAnonymous` 파라미터 destructuring 제거
- DB 저장 시 `isAnonymous: false` 하드코딩

### 4. DB 스키마 (`prisma/schema.prisma`)
- `isAnonymous` 필드 유지 (마이그레이션 불필요)
- 새 쪽지는 항상 `false`로 저장됨

## 변경하지 않는 것

- `Feed.tsx`, `PolaroidDateGroup.tsx`: 타입에 `isAnonymous` 있으나 표시 로직에 미사용 → 변경 없음
- API GET 엔드포인트: `isAnonymous` 필드 반환 유지 (기존 클라이언트 타입 호환)
