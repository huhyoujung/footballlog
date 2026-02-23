// 팀 운동 수정 클라이언트 컴포넌트 - TrainingEventForm 공유 컴포넌트 사용
"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { useTeam } from "@/contexts/TeamContext";
import BackButton from "@/components/BackButton";
import PageHeader from "@/components/PageHeader";
import LoadingSpinner from "@/components/LoadingSpinner";
import TrainingEventForm, {
  type InitialFormValues,
  type TrainingEventFormData,
} from "@/components/training/TrainingEventForm";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface EventData {
  id: string;
  title: string;
  isRegular: boolean;
  isFriendlyMatch: boolean;
  minimumPlayers: number | null;
  opponentTeamName: string | null;
  enablePomVoting: boolean;
  pomVotingDeadline: string | null;
  pomVotesPerPerson: number;
  date: string;
  location: string;
  venue: {
    id: string;
    name: string;
    mapUrl: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  shoes: string[];
  uniform: string | null;
  notes: string | null;
  vestBringerId: string | null;
  vestReceiverId: string | null;
  rsvpDeadline: string;
}

export default function TrainingEditClient({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { teamData } = useTeam();

  const vestOrder = teamData?.vestOrder || [];
  const allMembers = (teamData?.members || []).map((m) => ({
    id: m.id,
    name: m.name,
    image: m.image,
  }));
  // vestOrder 설정 시 해당 멤버만, 아니면 전체
  const members = vestOrder.length > 0
    ? vestOrder
        .map((id) => allMembers.find((m) => m.id === id))
        .filter((m): m is NonNullable<typeof m> => m != null)
    : allMembers;

  const { data: event, isLoading } = useSWR<EventData>(
    eventId ? `/api/training-events/${eventId}?edit=true` : null,
    fetcher,
    { revalidateOnFocus: true, revalidateOnMount: true, revalidateIfStale: true, dedupingInterval: 0 }
  );

  // 서버 데이터 → 폼 초기값 변환
  const initialValues = useMemo<InitialFormValues | undefined>(() => {
    if (!event) return undefined;

    const vals: InitialFormValues = {
      title: event.title || "",
      isRegular: event.isRegular,
      isFriendlyMatch: event.isFriendlyMatch ?? false,
      minimumPlayers: event.minimumPlayers ?? 11,
      opponentTeam: event.opponentTeamName || "",
      enablePomVoting: event.enablePomVoting ?? true,
      pomVotesPerPerson: event.pomVotesPerPerson ?? 1,
      location: event.location || "",
      shoes: event.shoes || [],
      uniform: event.uniform || "",
      notes: event.notes || "",
      vestBringerId: event.vestBringerId || "",
      vestReceiverId: event.vestReceiverId || "",
    };

    if (event.venue) {
      vals.selectedVenue = {
        name: event.venue.name,
        address: event.location,
        mapUrl: event.venue.mapUrl,
        latitude: event.venue.latitude,
        longitude: event.venue.longitude,
      };
    }

    if (event.date) {
      const eventDate = new Date(event.date);
      if (!isNaN(eventDate.getTime())) {
        vals.date = eventDate.toISOString().split("T")[0];
        vals.time = eventDate.toTimeString().slice(0, 5);

        if (event.pomVotingDeadline) {
          const pomDeadline = new Date(event.pomVotingDeadline);
          if (!isNaN(pomDeadline.getTime())) {
            vals.pomVotingDeadlineDate = pomDeadline.toISOString().split("T")[0];
            vals.pomVotingDeadlineTime = pomDeadline.toTimeString().slice(0, 5);
          }
        } else {
          const defaultPomDeadline = new Date(eventDate);
          defaultPomDeadline.setHours(defaultPomDeadline.getHours() + 2);
          vals.pomVotingDeadlineDate = defaultPomDeadline.toISOString().split("T")[0];
          vals.pomVotingDeadlineTime = defaultPomDeadline.toTimeString().slice(0, 5);
        }
      }
    }

    if (event.rsvpDeadline) {
      const deadline = new Date(event.rsvpDeadline);
      if (!isNaN(deadline.getTime())) {
        vals.rsvpDeadlineDate = deadline.toISOString().split("T")[0];
        vals.rsvpDeadlineTime = deadline.toTimeString().slice(0, 5);
      }
    }

    return vals;
  }, [event]);

  const handleSubmit = async (data: TrainingEventFormData) => {
    const res = await fetch(`/api/training-events/${eventId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const body = await res.json();
      throw new Error(body.error || "저장에 실패했습니다");
    }

    // 수정된 이벤트 + 관련 목록 캐시 모두 무효화
    await Promise.all([
      mutate(`/api/training-events/${eventId}`),
      mutate(`/api/training-events/${eventId}?edit=true`),
      mutate(`/api/training-events/${eventId}?includeSessions=true`),
      mutate(`/api/training-events/next`),
      mutate(`/api/training-events`),
      mutate(`/api/training-events?filter=upcoming`),
      mutate(`/api/training-events?filter=past`),
    ]);
    router.push(`/training/${eventId}?tab=info`);
  };

  if (isLoading) return <LoadingSpinner />;

  if (!event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">운동을 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <PageHeader title="운동 정보 수정" left={<BackButton href={`/training/${eventId}`} />} />


      <main className="max-w-2xl mx-auto p-4">
        <TrainingEventForm
          mode="edit"
          initialValues={initialValues}
          members={members}
          lockFriendlyFields={!!event.isFriendlyMatch && !!event.rsvpDeadline && new Date(event.rsvpDeadline).getTime() < Date.now()}
          onSubmit={handleSubmit}
          submitLabel="저장"
          submittingLabel="저장 중..."
        />
      </main>
    </div>
  );
}
