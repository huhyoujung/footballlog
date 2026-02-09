"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function TrainingManageRedirect({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [eventId, setEventId] = useState<string>("");

  useEffect(() => {
    params.then((p) => {
      setEventId(p.id);
      router.replace(`/training/${p.id}`);
    });
  }, [params, router]);

  return null;
}
