"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect } from "react";
import { useSession } from "next-auth/react";

function PostHogIdentifier() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.id) return;

    posthog.identify(session.user.id, {
      team_id: session.user.teamId ?? null,
      role: session.user.role ?? null,
      name: session.user.name ?? null,
    });
  }, [session?.user?.id, session?.user?.teamId, session?.user?.role]);

  return null;
}

export default function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
    });
  }, []);

  return (
    <PHProvider client={posthog}>
      <PostHogIdentifier />
      {children}
    </PHProvider>
  );
}
