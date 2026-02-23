// 팀 운동 생성 클라이언트 컴포넌트 - TrainingEventForm 공유 컴포넌트 사용
"use client";

import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";
import TrainingEventForm, {
  type MemberOption,
  type TrainingEventFormData,
} from "@/components/training/TrainingEventForm";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function TrainingCreateClient() {
  const router = useRouter();

  // 조끼 당번 추천 + 멤버 목록
  const { data: vestData, isLoading: vestLoading } = useSWR<{
    members: MemberOption[];
    bringer: { id: string } | null;
    receiver: { id: string } | null;
  }>("/api/training-events/vest-suggestion", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
  });

  const members = vestData?.members || [];

  const initialValues = {
    vestBringerId: vestData?.bringer?.id ?? "",
    vestReceiverId: vestData?.receiver?.id ?? "",
  };

  const handleSubmit = async (data: TrainingEventFormData) => {
    const res = await fetch("/api/training-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "생성에 실패했습니다");
    }

    const event = await res.json();
    // 신규 이벤트 생성 후 관련 목록 캐시 무효화
    await Promise.all([
      mutate(`/api/training-events/next`),
      mutate(`/api/training-events`),
      mutate(`/api/training-events?filter=upcoming`),
      mutate(`/api/training-events?filter=past`),
    ]);
    router.push(`/training/${event.id}`);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader title="팀 운동" left={<BackButton href="/" />} />

      <main className="max-w-2xl mx-auto p-4">
        {!vestLoading && (
          <TrainingEventForm
            mode="create"
            initialValues={initialValues}
            members={members}
            showVestSuggestion={!!(vestData?.bringer && vestData?.receiver)}
            onSubmit={handleSubmit}
            submitLabel="운동 올리기"
            submittingLabel="생성 중..."
          />
        )}
      </main>
    </div>
  );
}
