# 온보딩 프로필 입력 단계 추가 설계

## 배경

신규 가입자 온보딩 흐름에서 프로필 입력 단계(포지션, 등번호)가 코드상 존재했지만 실제로는 스킵되고 있었다. 전화번호(비상연락망)도 온보딩 시점에 수집하면 팀 운영에 유용하다.

## 목표

- 팀 가입/생성 완료 후 프로필 입력 단계를 실제로 보여준다
- 포지션, 등번호, 전화번호를 한 화면에서 입력받는다
- 전화번호는 비상연락망 용도임을 안내한다
- 모든 필드는 선택 사항이며 건너뛸 수 있다

## 흐름

```
팀 선택 (기존 가입 or 새 팀 생성)
      ↓
팀 가입/생성 완료
      ↓
프로필 입력 화면 (mode: "profile")
      ↓                    ↓
  저장하고 시작           건너뛰기
      ↓                    ↓
         홈 화면
```

## UI 구성

- 상단 안내 문구: "나중에 설정에서 수정할 수 있습니다"
- 필드 순서: 포지션 → 등번호 → 전화번호
- 전화번호 필드 하단에 작은 gray 텍스트: "팀 비상연락망으로 활용됩니다"
- 하단 버튼 2개 (나란히):
  - 왼쪽: "건너뛰기" (border 스타일)
  - 오른쪽: "저장하고 시작하기" (filled 스타일)

## 코드 변경 범위

### `src/app/onboarding/page.tsx`

1. `phoneNumber` state 추가
2. `handleCreateTeam`, `handleJoinTeam` 성공 후 `completeOnboarding()` 대신 `setMode("profile")`
3. profile 스텝에 `phoneNumber` 입력 필드 및 안내 문구 추가
4. `handleProfileSubmit`에 `phoneNumber` 포함 + 완료 후 `completeOnboarding()` 호출
5. "건너뛰기" 버튼 추가 → `completeOnboarding()` 직접 호출

### API 변경 없음

`/api/profile` PUT 엔드포인트는 이미 `phoneNumber` 지원함.

## 비고

- 건너뛰기 시 `/api/profile` 호출 없이 바로 홈으로 이동
- 설정 페이지(`/my/settings`)에서 언제든 수정 가능
