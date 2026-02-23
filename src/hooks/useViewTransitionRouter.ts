"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";

// startViewTransition을 쓰면 새 페이지 렌더까지 화면이 동결돼 사용자가 반응 없다고 인식함
// → 직접 라우팅으로 loading.tsx 스켈레톤이 즉시 보이도록 변경
export function useViewTransitionRouter() {
  const router = useRouter();

  const push = useCallback(
    (href: string) => {
      router.push(href);
    },
    [router]
  );

  const back = useCallback(() => {
    window.history.back();
  }, []);

  return { push, back };
}
