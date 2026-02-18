# 프로젝트 컨벤션

## VoC 이슈 관리

- 사용자 피드백(VoC) 기반 개선사항은 GitHub Issues에 `voc` 라벨로 등록
- 이슈 본문 구조:
  ```
  ## 리서치
  - 수집일: YYYY-MM-DD
  - 수집 방법: (카카오톡 문의 / 앱 내 피드백 / 인터뷰 등)
  - 보고 인원: N/전체M명

  ## VoC 원문
  > 사용자 원문 인용

  ## 원인 분석
  ...

  ## 해결
  ...
  ```
- 커밋으로 이슈를 해결할 때 메시지에 반드시 `Closes #N` 포함 (GitHub가 자동으로 이슈 닫음)
- 이미 해결된 상태로 이슈를 기록할 경우, 생성 후 즉시 닫기

## 커밋 메시지

- 한글 사용
- 해결한 GitHub Issue가 있으면 본문에 `Closes #N` 포함

## 공통 UI 컴포넌트 규칙

- **페이지 헤더**: `<header>` 태그 직접 사용 금지. 반드시 `PageHeader` 컴포넌트(`src/components/PageHeader.tsx`) 사용 (h-10 = 40px 고정). 새 페이지 추가 시에도 동일하게 적용
- **헤더 아래 sticky 요소**: top offset은 `41px` (40px 헤더 + 1px border) 기준. 예: `sticky top-[41px]`

## Next.js 최적화 원칙

1. **이미지**: `<img>` 태그 금지. 반드시 `next/image`의 `Image` 컴포넌트 사용 (자동 WebP 변환, lazy loading, srcset 생성)
2. **렌더링 전략**: 정적 페이지는 SSG, 주기적 갱신은 ISR(`revalidate`), 실시간 필요 시만 SSR. 클라이언트 컴포넌트(`"use client"`)는 꼭 필요한 곳에만 사용
3. **코드 스플리팅**: 무거운 라이브러리(차트, 에디터 등)는 `dynamic(() => import(...), { ssr: false })`로 지연 로딩
4. **외부 스크립트**: 분석/광고 등 외부 스크립트는 `<script>` 대신 `next/script`의 `Script` 컴포넌트 + `strategy="afterInteractive"` 사용
5. **데이터 캐싱**: 서버 측은 `unstable_cache` + `revalidateTag`, 클라이언트 측은 SWR(`dedupingInterval`, `revalidateOnFocus: false` 등) 활용. 캐싱 적용 시 주석으로 캐시 전략 명시
6. **스켈레톤 UI**: `loading.tsx` 및 인라인 스켈레톤은 반드시 해당 페이지의 실제 레이아웃(헤더, 배경색, 섹션 구조)과 동일하게 구현. 범용 스피너나 관계없는 형태 금지
7. **SWR 캐시 무효화**: 데이터를 변경(생성/수정/삭제)할 때, **같은 데이터를 읽는 다른 페이지의 SWR 키도 함께 `mutate`**해야 함. 예: 락커에서 쪽지 작성 → 피드의 `/api/locker-notes` 캐시도 갱신. `useSWRConfig`의 `mutate`(글로벌)를 사용할 것