# 팀 운동 목록 카드 UI 개선

**Date**: 2026-02-27
**Status**: Approved
**Scope**: `/my/training-events` 목록 페이지 카드 컴포넌트

---

## 문제

1. "정기운동" 여부가 제목 아래 작은 뱃지 행에 숨어 있어 스캔 시 눈에 잘 띄지 않음
2. "다음 운동" 표시("다음" 칩)가 카드 내부 뱃지 행에 포함되어 `[다음] [정기] [친선]`처럼 뱃지가 복잡하게 쌓임

---

## 변경 사항

### 1. "정기" 뱃지 인라인 배치

**Before**:
```
4월 정기운동
[다음] [정기]
📅 ...
```

**After**:
```
[정기] 4월 정기운동
📅 ...
```

- `event.isRegular`일 때 제목 `<h3>` 왼쪽에 인라인 pill 표시
- 스타일: `px-1.5 py-0.5 bg-team-100 text-team-600 text-[10px] font-medium rounded`
- 제목과 뱃지는 `flex items-center gap-1.5`로 같은 줄에 배치

### 2. "다음 운동" 핀 레이블로 분리

**Before**: 카드 내부 뱃지 행에 `[다음]` 칩

**After**: 첫 번째 예정 운동 카드 **위**에 외부 레이블:
```
📌 다음 운동
┌────────────────────────────┐
│ [정기] 4월 정기운동     >  │  ← bg-team-50 배경 유지
│ 📅 4월 5일(토) 오전 10:00  │
└────────────────────────────┘
```

- `isNext && !event.cancelled` 조건일 때 카드 **위에** `<p className="text-xs font-medium text-team-500 ...">📌 다음 운동</p>` 레이블 렌더링
- 카드 배경 `bg-team-50 border border-team-200`은 그대로 유지 (시각적 강조 중복 활용)
- 카드 내부 뱃지 행에서 "다음" 칩 제거

### 3. 뱃지 행 단순화

카드 내 뱃지 행은 `[친선]`, `[취소됨]`만 남김:
- `isRegular` → 제목 인라인으로 이동
- `isNext` → 카드 외부 레이블로 이동
- 뱃지 행 자체가 비어있으면 렌더링 안 함

---

## 파일

- `src/app/my/training-events/TrainingEventsClient.tsx` — `EventCard` 컴포넌트 수정
