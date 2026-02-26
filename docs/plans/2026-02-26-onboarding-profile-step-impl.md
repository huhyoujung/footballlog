# 온보딩 프로필 입력 단계 추가 구현 계획

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 온보딩에서 팀 가입/생성 완료 후 프로필 입력 단계(포지션, 등번호, 전화번호)가 실제로 표시되도록 수정

**Architecture:** 단일 파일 수정. `src/app/onboarding/page.tsx`에서 (1) 팀 처리 완료 후 profile 모드로 전환하고, (2) profile 스텝에 phoneNumber 필드 추가, (3) 건너뛰기 버튼 추가.

**Tech Stack:** React (useState), Next.js App Router, Tailwind CSS v4

---

### Task 1: phoneNumber state 추가 및 핸들러 흐름 수정

**Files:**
- Modify: `src/app/onboarding/page.tsx`

**Step 1: phoneNumber state 추가**

[src/app/onboarding/page.tsx](src/app/onboarding/page.tsx) 42-43번째 줄 `// 프로필` 블록에 `phoneNumber` state를 추가한다.

```tsx
// 프로필
const [position, setPosition] = useState("");
const [number, setNumber] = useState("");
const [phoneNumber, setPhoneNumber] = useState("");
```

**Step 2: handleCreateTeam 흐름 수정**

108번째 줄 `await completeOnboarding();` 를 아래로 교체:

```tsx
await update();
setMode("profile");
setLoading(false);
```

**Step 3: handleJoinTeam 흐름 수정**

135번째 줄 `await completeOnboarding();` 를 아래로 교체:

```tsx
await update();
setMode("profile");
setLoading(false);
```

> **주의:** `setLoading(false)`를 명시적으로 추가해야 한다. 기존엔 `completeOnboarding()`이 페이지 이동을 해서 자동으로 언마운트됐지만, 이제는 같은 컴포넌트 내에서 모드만 바뀌므로 로딩 상태를 직접 해제해야 버튼이 다시 활성화된다.

**Step 4: handleProfileSubmit 수정**

`phoneNumber` 포함 및 완료 후 `completeOnboarding()` 호출로 교체:

```tsx
const handleProfileSubmit = async () => {
  setLoading(true);
  setError("");

  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        position: position || null,
        number: number ? parseInt(number) : null,
        phoneNumber: phoneNumber.trim() || null,
      }),
    });

    if (!res.ok) {
      throw new Error("프로필 저장에 실패했습니다");
    }

    await completeOnboarding();
  } catch (err) {
    setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    setLoading(false);
  }
};
```

**Step 5: 빌드 확인**

```bash
npm run build
```

Expected: 타입 에러 없이 빌드 성공

**Step 6: 커밋**

```bash
git add src/app/onboarding/page.tsx
git commit -m "feat: 온보딩 팀 가입/생성 후 프로필 입력 단계로 이동"
```

---

### Task 2: profile 스텝 UI — 전화번호 필드 및 건너뛰기 버튼 추가

**Files:**
- Modify: `src/app/onboarding/page.tsx`

**Step 1: profile 스텝 전체 교체**

`{mode === "profile" && (...)}` 블록(366~416번째 줄)을 아래 내용으로 교체한다:

```tsx
{/* 프로필 설정 */}
{mode === "profile" && (
  <div className="bg-white rounded-2xl shadow-lg p-6">
    <h2 className="text-xl font-bold text-gray-900 mb-2">프로필 설정</h2>
    <p className="text-sm text-gray-500 mb-6">나중에 설정에서 수정할 수 있습니다</p>

    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          포지션 (선택)
        </label>
        <select
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
        >
          <option value="">선택 안함</option>
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          등번호 (선택)
        </label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={2}
          value={number}
          onChange={(e) => setNumber(e.target.value.replace(/[^0-9]/g, ""))}
          placeholder="예: 10"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          전화번호 (선택)
        </label>
        <input
          type="tel"
          inputMode="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="010-0000-0000"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-team-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-400 mt-1">팀 비상연락망으로 활용됩니다</p>
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={completeOnboarding}
          disabled={loading}
          className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          건너뛰기
        </button>
        <button
          onClick={handleProfileSubmit}
          disabled={loading}
          className="flex-1 py-3 bg-team-500 text-white rounded-lg font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
        >
          {loading ? "저장 중..." : "저장하고 시작하기"}
        </button>
      </div>
    </div>
  </div>
)}
```

**Step 2: 빌드 확인**

```bash
npm run build
```

Expected: 타입 에러 없이 빌드 성공

**Step 3: 수동 테스트 체크리스트**

로컬에서 `npm run dev` 후 확인:
- [ ] 새 팀 만들기 → 팀 이름 입력 → "팀 만들기" → 프로필 화면 표시
- [ ] 기존 팀 가입 → 초대 코드 입력 → "가입하기" → 프로필 화면 표시
- [ ] 프로필 화면에서 "건너뛰기" → 홈으로 이동 (API 호출 없음, 네트워크 탭 확인)
- [ ] 포지션/등번호/전화번호 입력 후 "저장하고 시작하기" → 홈으로 이동
- [ ] 저장 후 `/my/settings`에서 입력값 반영 확인

**Step 4: 커밋**

```bash
git add src/app/onboarding/page.tsx
git commit -m "feat: 온보딩 프로필 단계에 전화번호 필드 및 건너뛰기 버튼 추가"
```
