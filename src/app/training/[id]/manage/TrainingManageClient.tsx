// 팀 운동 관리 리다이렉트 클라이언트 컴포넌트
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TrainingManageClient({ eventId }: { eventId: string }) {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/training/${eventId}`);
  }, [eventId, router]);

  return null;
}
