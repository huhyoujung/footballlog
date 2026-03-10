// PostHog 이벤트 트래킹 훅
// 모든 이벤트에 team_id, user_role 자동 주입
"use client";

import posthog from "posthog-js";
import { useSession } from "next-auth/react";
import { useCallback } from "react";

export function useAnalytics() {
  const { data: session } = useSession();

  const capture = useCallback(
    (event: string, properties?: Record<string, unknown>) => {
      posthog.capture(event, {
        team_id: session?.user?.teamId ?? null,
        user_role: session?.user?.role ?? null,
        ...properties,
      });
    },
    [session]
  );

  return { capture };
}
