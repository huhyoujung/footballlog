# Design System

Football Log 디자인 시스템 가이드

## 🎨 Color Palette

### Team Colors (Primary)
프로젝트의 메인 컬러. 따뜻한 브라운 톤.

```css
--color-team-50:  #F7F5F3  /* 가장 밝은 배경 */
--color-team-100: #EFEBE7  /* 밝은 배경 */
--color-team-200: #DED7CE  /* 경계선, 비활성 상태 */
--color-team-300: #C6B9A9  /* 보조 요소 */
--color-team-400: #B3A089  /* 중간 톤 (거의 미사용) */
--color-team-500: #977C5E  /* Primary - 버튼, 링크 */
--color-team-600: #7D684F  /* Hover 상태 */
--color-team-700: #5E4E3B  /* 강조 텍스트 */
```

**사용 빈도 (2025-02-10 기준)**
- `team-500`: 118회 (Primary, 가장 많이 사용)
- `team-600`: 52회 (Hover, Secondary)
- `team-50`: 37회 (배경)
- `team-700`: 25회 (강조 텍스트)
- `team-100`: 16회
- `team-300`: 10회
- `team-200`: 10회
- `team-400`: 4회

### Grayscale
```css
--color-gray-50:  #F9FAFB
--color-gray-100: #F3F4F6
--color-gray-200: #E5E7EB
--color-gray-300: #D1D5DB
--color-gray-400: #9CA3AF  /* 비활성 텍스트, 플레이스홀더 */
--color-gray-500: #6B7280
--color-gray-600: #4B5563
--color-gray-700: #374151
--color-gray-800: #1F2937
--color-gray-900: #111827  /* 본문 텍스트 */
```

### Semantic Colors
```css
--color-red-400:    #F87171  /* 좋아요 아이콘 */
--color-red-500:    #EF4444  /* 에러, 삭제 */
--color-green-50:   #F0FDF4  /* 체크인 성공 배경 */
--color-green-100:  #DCFCE7
--color-green-200:  #BBF7D0
--color-green-600:  #16A34A  /* 성공, 체크인 */
--color-green-700:  #15803D
--color-orange-100: #FFEDD5  /* 지각 경고 배경 */
--color-orange-300: #FDBA74
--color-orange-600: #EA580C  /* 지각 텍스트 */
```

---

## 📝 Typography

### Font Family
```css
font-family: "Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, sans-serif;
```

- **Primary**: Pretendard Variable (가변 폰트)
- **Fallback**: Pretendard → 시스템 폰트

### Font Sizes
```css
text-xs:   0.75rem   (12px)  /* 보조 정보, 캡션 */
text-sm:   0.875rem  (14px)  /* 본문 (대부분의 UI) */
text-base: 1rem      (16px)  /* 기본 텍스트 */
text-lg:   1.125rem  (18px)  /* 중요 정보 */
text-xl:   1.25rem   (20px)  /* 제목 */
text-2xl:  1.5rem    (24px)  /* 큰 제목 */
```

**권장 사용**
- 본문: `text-sm` (14px)
- 인풋 필드: `text-sm` (14px) ✨ 최근 통일됨
- 제목: `text-base` ~ `text-xl`
- 캡션/보조: `text-xs`

### Font Weights
```css
font-normal:    400
font-medium:    500  /* 강조 필요한 일반 텍스트 */
font-semibold:  600  /* 제목, 버튼 */
font-bold:      700  /* 특별한 강조 */
```

---

## 🧩 Component Patterns

### Cards

#### Polaroid Card
```tsx
<div className="bg-white rounded-2xl p-4 shadow-lg">
  <div className="bg-team-50 rounded-xl aspect-square overflow-hidden">
    {/* 사진 영역 */}
  </div>
  <div className="pt-3">
    {/* 텍스트 내용 */}
  </div>
</div>
```

**특징**
- 흰색 외부 프레임
- `team-50` 내부 배경
- 부드러운 그림자 (`shadow-lg`)
- 큰 라운드 (`rounded-2xl`)

#### Content Card
```tsx
<div className="bg-white rounded-xl p-4">
  {/* 내용 */}
</div>
```

**특징**
- 흰색 배경
- 중간 라운드 (`rounded-xl`)
- 그림자 없음 (배경이 흰색이므로)

### Buttons

#### Primary Button
```tsx
<button className="px-4 py-3 bg-team-500 text-white rounded-lg font-semibold hover:bg-team-600 transition-colors">
  버튼 텍스트
</button>
```

**특징**
- 배경: `bg-team-500`
- 호버: `hover:bg-team-600`
- 패딩: `px-4 py-3` (중요 액션) 또는 `px-4 py-2.5` (일반)
- 폰트: `font-semibold`

#### Secondary Button
```tsx
<button className="px-4 py-2.5 bg-team-50 border border-team-200 text-team-700 rounded-lg hover:bg-team-100 transition-colors">
  버튼 텍스트
</button>
```

**특징**
- 배경: `bg-team-50` (밝은 배경)
- 테두리: `border-team-200`
- 호버: `hover:bg-team-100`
- 텍스트: `text-team-700`

#### Button Group (나란히 배치)
```tsx
<div className="flex gap-2">
  <button className="flex-1 px-4 py-2.5 bg-team-50 border border-team-200 text-team-700 rounded-lg hover:bg-team-100">
    보조 액션
  </button>
  <button className="flex-1 px-4 py-2.5 bg-team-500 text-white rounded-lg hover:bg-team-600">
    주요 액션
  </button>
</div>
```

**특징**
- `flex-1`로 동일한 너비
- `gap-2` (8px) 간격
- 좌측: Secondary, 우측: Primary

#### CTA (Call-to-Action) Button
```tsx
<div className="bg-white rounded-xl p-4">
  <button className="w-full py-3 bg-team-500 text-white rounded-lg font-semibold hover:bg-team-600 transition-colors">
    장비 배정 저장
  </button>
  <p className="text-xs text-gray-500 text-center mt-3">
    부가 설명 텍스트
  </p>
</div>
```

**권장사항**
- CTA는 독립된 카드로 분리
- `w-full`로 전체 너비 사용
- 명확한 액션 텍스트 사용
- 필요시 설명 텍스트 추가

#### Icon Button (터치 영역 확보)
```tsx
<button className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center">
  <svg width="24" height="24">...</svg>
</button>
```

**중요**: 터치 타겟은 최소 44x44px 확보

### Form Elements

#### Input
```tsx
<input
  type="text"
  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
/>
```

#### Textarea
```tsx
<textarea
  rows={3}
  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
/>
```

#### Select
```tsx
<select className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent">
  <option>옵션</option>
</select>
```

**최근 변경**
- 모든 인풋 필드 폰트 사이즈 `text-sm`으로 통일 (2025-02-10)

### Toggle Switch
```tsx
<button
  className={`relative w-11 h-6 rounded-full transition-colors ${
    enabled ? "bg-team-500" : "bg-gray-300"
  }`}
>
  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
    enabled ? "translate-x-5" : ""
  }`} />
</button>
```

---

## 🎬 Animations

### Polaroid Spread (카드 등장)
```css
.polaroid-enter {
  animation: polaroid-spread 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
}
```

### Fade In
```css
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
```

### Slide Up (모달)
```css
.animate-slide-up {
  animation: slide-up 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
```

### Toast
```css
.animate-toast-in {
  animation: toast-in 0.3s ease-out;
}
```

---

## 📐 Spacing & Layout

### Container
```tsx
<div className="max-w-2xl mx-auto px-4">
  {/* 내용 */}
</div>
```

**최대 너비**: `max-w-2xl` (672px)

### Card Spacing
```tsx
<main className="max-w-2xl mx-auto p-4 space-y-3">
  <div className="bg-white rounded-xl p-4">카드 1</div>
  <div className="bg-white rounded-xl p-4">카드 2</div>
  <div className="bg-white rounded-xl p-4">카드 3</div>
</main>
```

**권장사항**
- 카드 사이 간격: `space-y-3` (12px)
- 컨테이너 패딩: `p-4` (16px)
- 모든 카드는 동일한 너비 유지 (`bg-white rounded-xl p-4`)

### Gaps
```css
gap-1:  0.25rem  (4px)
gap-2:  0.5rem   (8px)   /* 버튼 그룹, 가장 많이 사용 */
gap-3:  0.75rem  (12px)  /* 카드 내부 요소 */
gap-4:  1rem     (16px)  /* 많이 사용 */
gap-6:  1.5rem   (24px)
```

### Padding
```css
p-2:   0.5rem   (8px)
p-3:   0.75rem  (12px)
p-4:   1rem     (16px)  /* 카드 내부 기본 */
p-6:   1.5rem   (24px)
```

---

## 📱 Responsive Design

### Breakpoints
```css
sm:  640px   /* 거의 사용 안함 (모바일 우선) */
md:  768px
lg:  1024px
xl:  1280px
```

**전략**: 모바일 우선 (Mobile First)
- 기본 스타일은 모바일
- 필요시 `md:` 이상 브레이크포인트 사용

---

## 🎯 Design Principles

### 1. 모바일 우선
- 터치 타겟 최소 44x44px
- 손가락으로 조작하기 편한 UI
- 스와이프, 드래그 등 제스처 지원

### 2. 미니멀리즘
- 불필요한 장식 최소화
- 아이콘과 이모지로 직관적 표현
- 여백을 활용한 가독성 확보

### 3. 일관성
- 동일한 기능은 동일한 패턴 사용
- 컬러, 타이포그래피, 간격 일관 유지
- 폴라로이드 스타일 일관 적용

### 4. 접근성
- 충분한 색 대비 (WCAG AA 이상)
- 터치 타겟 크기 확보
- 의미 있는 HTML 구조

---

## 🔧 Removed/Deprecated

### Condition Spectrum ❌ (삭제됨)
```css
/* 더 이상 사용되지 않음 - 2025-02-10 */
/* cond-red, cond-orange, cond-yellow, cond-green-* */
```

**이유**: 코드베이스에서 전혀 사용되지 않음. Semantic Colors (red, green, orange)로 대체.

---

## 📚 참고

### Tailwind CSS v4
- CSS-first 설정 (`@theme inline`)
- CSS 변수 기반 테마
- 자동 클래스 생성

### Pretendard Font
- 한글 최적화 폰트
- Variable Font (가변 폰트)
- 모던하고 깔끔한 디자인
