# 온보딩 앱 설치 안내 화면 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 온보딩 마지막 단계에 슬라이드형 카드 2장(앱 설치 안내 + 기능 소개)을 추가한다.

**Architecture:** 기존 온보딩 페이지의 `mode` 상태에 `"install"` 단계를 추가. 프로필 완료 후 install 모드로 전환되며, 2장의 카드를 스와이프/버튼으로 네비게이션. `usePWA` 훅의 기존 `installApp()`, `isInstalled` 등을 활용. iOS/Android 감지로 카드 1 내용 분기.

**Tech Stack:** Next.js App Router, React (useState), Tailwind CSS v4, 기존 usePWA 훅

---

## 사전 지식

- 온보딩 페이지: `src/app/onboarding/page.tsx` — 단일 파일, `mode` 상태로 4단계 관리
- PWA 훅: `src/hooks/usePWA.ts` — `installApp()`, `isInstalled`, `canInstall()` 제공
- `deferredPrompt`가 있으면 Android 네이티브 설치 가능, 없으면 iOS 수동 안내
- 기존 `completeOnboarding()`은 푸시 구독 + 피드 이동 처리

---

### Task 1: mode 타입에 "install" 추가 및 프로필 → install 전환

**Files:**
- Modify: `src/app/onboarding/page.tsx:30` (mode 타입), `:165` (프로필 완료 시 전환), `:439` (건너뛰기 시 전환)

**Step 1: mode 타입 확장**

```tsx
// 기존
const [mode, setMode] = useState<"select" | "find" | "create" | "profile">("select");

// 변경
const [mode, setMode] = useState<"select" | "find" | "create" | "profile" | "install">("select");
```

**Step 2: usePWA 훅 import 추가**

```tsx
import { usePWA } from "@/hooks/usePWA";
```

컴포넌트 내부에서:
```tsx
const { isInstalled, installApp } = usePWA();
```

**Step 3: 프로필 완료 시 install 모드로 전환**

`handleProfileSubmit` 함수에서:
```tsx
// 기존: await completeOnboarding();
// 변경:
setMode("install");
```

프로필 "건너뛰기" 버튼도 동일하게:
```tsx
// 기존: onClick={completeOnboarding}
// 변경:
onClick={() => setMode("install")}
```

**Step 4: 빌드 확인**

Run: `npm run build`
Expected: 타입 에러 없이 빌드 성공 (install 모드 렌더링은 아직 없으므로 빈 화면)

---

### Task 2: 카드 네비게이션 상태 및 install 모드 컨테이너

**Files:**
- Modify: `src/app/onboarding/page.tsx`

**Step 1: 카드 인덱스 상태 추가**

기존 상태 선언 근처에:
```tsx
const [installStep, setInstallStep] = useState(0); // 0: 앱 설치, 1: 기능 소개
```

**Step 2: 플랫폼 감지 로직 추가**

컴포넌트 내부에:
```tsx
const [isIOS, setIsIOS] = useState(false);

useEffect(() => {
  setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
}, []);
```

카드 1의 UI 분기 로직:
- `deferredPrompt` 있음 → "앱으로 설치하기" 버튼 (네이티브 프롬프트)
- `deferredPrompt` 없음 + iOS → 공유 버튼(⎋) → '홈 화면에 추가' → '추가' 수동 안내
- `deferredPrompt` 없음 + Android → Chrome 메뉴(⋮) → '홈 화면에 추가' → '설치' 수동 안내

**Step 3: install 모드 기본 구조 렌더링**

`{mode === "profile" && (...)}` 블록 뒤에 추가:

```tsx
{mode === "install" && (
  <div className="bg-white rounded-2xl shadow-lg p-6 text-center">
    {installStep === 0 && (
      <div>
        {/* Task 3에서 구현 */}
        <p>카드 1: 앱 설치 안내</p>
      </div>
    )}

    {installStep === 1 && (
      <div>
        {/* Task 4에서 구현 */}
        <p>카드 2: 기능 소개</p>
      </div>
    )}

    {/* 도트 인디케이터 */}
    <div className="flex justify-center gap-2 mt-6">
      {[0, 1].map((i) => (
        <button
          key={i}
          onClick={() => setInstallStep(i)}
          className={`w-2 h-2 rounded-full transition-colors ${
            installStep === i ? "bg-team-500" : "bg-gray-300"
          }`}
        />
      ))}
    </div>
  </div>
)}
```

**Step 4: 수동 확인**

브라우저에서 온보딩 진행 → 프로필 완료 → install 모드로 전환되는지 확인

---

### Task 3: 카드 1 — 앱 설치 안내 (Android/iOS 분기)

**Files:**
- Modify: `src/app/onboarding/page.tsx`

**Step 1: 이미 설치된 경우 자동 스킵**

install 모드 진입 시 이미 설치되어 있으면 카드 1 건너뛰기:

```tsx
useEffect(() => {
  if (mode === "install" && isInstalled) {
    setInstallStep(1);
  }
}, [mode, isInstalled]);
```

**Step 2: 카드 1 — 3가지 분기**

`installStep === 0` 안의 placeholder를 교체. 공통 상단(아이콘 + 타이틀 + 혜택 목록)은 동일하고, 하단 액션 영역만 분기:

```tsx
{installStep === 0 && (
  <div>
    {/* 공통: 아이콘 + 타이틀 + 혜택 목록 (3가지 분기 모두 동일) */}
    <div className="w-20 h-20 mx-auto mb-6 bg-team-50 rounded-full flex items-center justify-center">
      <Smartphone className="w-10 h-10 text-team-500" />
    </div>
    <h2 className="text-xl font-bold text-gray-900 mb-2">홈 화면에 추가하면</h2>
    <p className="text-gray-500 mb-6">팀 소식을 바로 확인할 수 있어요</p>
    <div className="text-left space-y-3 mb-8">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-team-50 rounded-full flex items-center justify-center flex-shrink-0">
          <Bell className="w-[18px] h-[18px] text-team-500" />
        </div>
        <span className="text-sm text-gray-700">경기 일정 알림</span>
      </div>
      {/* ... 나머지 2개 동일 패턴 */}
    </div>

    {/* 분기 1: deferredPrompt 있음 — 네이티브 설치 버튼 */}
    {deferredPrompt ? (
      <>
        <button onClick={handleInstall} className="w-full py-3 bg-team-500 text-white rounded-xl font-semibold">
          앱으로 설치하기
        </button>
      </>
    ) : (
      /* 분기 2, 3: deferredPrompt 없음 — 수동 안내 (iOS/Android 텍스트만 다름) */
      <div className="text-left space-y-4 mb-8 bg-gray-50 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-2">설치 방법</p>
        {isIOS ? (
          <>
            <Step n={1}>하단 공유 버튼 ⎋ 을 탭하세요</Step>
            <Step n={2}>&lsquo;홈 화면에 추가&rsquo;를 선택하세요</Step>
            <Step n={3}>오른쪽 상단 &lsquo;추가&rsquo;를 탭하세요</Step>
          </>
        ) : (
          <>
            <Step n={1}>Chrome 메뉴 ⋮ 를 탭하세요</Step>
            <Step n={2}>&lsquo;홈 화면에 추가&rsquo;를 선택하세요</Step>
            <Step n={3}>&lsquo;설치&rsquo;를 탭하세요</Step>
          </>
        )}
      </div>
    )}

    <button onClick={() => setInstallStep(1)} className="text-sm text-gray-400">
      {deferredPrompt ? "나중에 할게요" : "다음"}
    </button>
            <p className="text-sm text-gray-600">오른쪽 상단 &quot;추가&quot;를 탭하세요</p>
          </div>
        </div>

        <button
          onClick={() => setInstallStep(1)}
          className="w-full py-3 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors"
        >
          다음
        </button>
      </>
    ) : (
      <>
        {/* Android 원클릭 설치 */}
        <button
          onClick={async () => {
            try {
              const accepted = await installApp();
              if (accepted) {
                setInstallStep(1);
              }
            } catch {
              // 설치 불가 환경 — 다음으로 넘어감
              setInstallStep(1);
            }
          }}
          className="w-full py-3 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors mb-3"
        >
          앱으로 설치하기
        </button>
      </>
    )}

    <button
      onClick={() => setInstallStep(1)}
      className="text-sm text-gray-400 hover:text-gray-600 transition-colors mt-2"
    >
      나중에 할게요
    </button>
  </div>
)}
```

**Step 3: 수동 확인**

- Android 기기/에뮬레이터: "앱으로 설치하기" 버튼 → 네이티브 프롬프트 노출 확인
- iOS Safari: 3단계 안내 표시 확인
- 데스크탑: "앱으로 설치하기" 버튼 동작 확인 (Chrome은 deferredPrompt 지원)

---

### Task 4: 카드 2 — 기능 소개 + 완료

**Files:**
- Modify: `src/app/onboarding/page.tsx`

**Step 1: 팀 이름 가져오기**

이미 세션에서 팀 정보를 가지고 있으므로, 팀 이름을 저장하는 상태를 추가:

```tsx
const [teamNameDisplay, setTeamNameDisplay] = useState("");
```

팀 생성/가입 완료 시 팀 이름 저장:
- `handleCreateTeam`에서: `setTeamNameDisplay(teamName);`
- `handleJoinTeam`에서: `setTeamNameDisplay(selectedTeam?.name || "");`

**Step 2: 카드 2 구현**

`installStep === 1` 안의 placeholder를 교체:

```tsx
{installStep === 1 && (
  <div>
    {/* 로고 영역 */}
    <div className="w-20 h-20 mx-auto mb-6 bg-team-50 rounded-full flex items-center justify-center">
      <span className="text-3xl">⚽</span>
    </div>

    <h2 className="text-xl font-bold text-gray-900 mb-2">
      {teamNameDisplay ? `${teamNameDisplay} 라커룸에` : "라커룸에"}<br />
      오신 걸 환영합니다!
    </h2>

    <div className="text-left space-y-3 my-8">
      <div className="flex items-center gap-3">
        <span className="text-team-500">📝</span>
        <span className="text-sm text-gray-700">훈련 일지를 남기고</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-team-500">📸</span>
        <span className="text-sm text-gray-700">팀원들의 기록을 구경하고</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-team-500">🏆</span>
        <span className="text-sm text-gray-700">MVP 투표에 참여하세요</span>
      </div>
    </div>

    <button
      onClick={completeOnboarding}
      className="w-full py-3 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors"
    >
      시작하기 →
    </button>
  </div>
)}
```

**Step 3: 수동 확인**

- 카드 2에서 팀 이름이 정상 표시되는지 확인
- "시작하기" 클릭 시 푸시 알림 권한 요청 후 피드로 이동하는지 확인

---

### Task 5: 스와이프 제스처 및 전환 애니메이션

**Files:**
- Modify: `src/app/onboarding/page.tsx`

**Step 1: 터치 스와이프 핸들러**

컴포넌트 상단에:
```tsx
const [touchStart, setTouchStart] = useState<number | null>(null);
```

install 모드 컨테이너에 터치 이벤트 추가:
```tsx
<div
  className="bg-white rounded-2xl shadow-lg p-6 text-center"
  onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
  onTouchEnd={(e) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (diff > 50 && installStep < 1) setInstallStep(1); // 왼쪽 스와이프 → 다음
    if (diff < -50 && installStep > 0) setInstallStep(0); // 오른쪽 스와이프 → 이전
    setTouchStart(null);
  }}
>
```

**Step 2: 전환 애니메이션**

카드 내용물을 감싸는 div에 transition 적용:
```tsx
<div className="transition-opacity duration-300 ease-in-out">
  {installStep === 0 && (...)}
  {installStep === 1 && (...)}
</div>
```

**Step 3: 수동 확인**

모바일 기기에서 좌우 스와이프로 카드 전환 확인

---

### Task 6: 빌드 검증 및 커밋

**Step 1: 빌드 확인**

Run: `npm run build`
Expected: 에러 없이 빌드 성공

**Step 2: 커밋**

```bash
git add src/app/onboarding/page.tsx
git commit -m "feat: 온보딩 마지막 단계에 앱 설치 안내 + 기능 소개 카드 추가

- 프로필 설정 후 2장의 슬라이드 카드 표시
- 카드 1: Android 네이티브 설치 / iOS 수동 설치 가이드
- 카드 2: 팀 환영 메시지 + 주요 기능 소개
- 이미 설치된 경우 카드 1 자동 스킵
- 스와이프 제스처 + 도트 인디케이터 네비게이션"
```
