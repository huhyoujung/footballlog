// 팀 운동 상세 페이지 - OG 메타데이터 포함
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import TrainingDetailClient from "./TrainingDetailClient";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;

  const event = await prisma.trainingEvent.findUnique({
    where: { id },
    select: {
      title: true,
      date: true,
      location: true,
      team: { select: { name: true } },
    },
  });

  if (!event) return {};

  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  return {
    title: `${event.team.name} - ${event.title}`,
    description: `${dateStr} · ${event.location}`,
    openGraph: {
      title: `${event.team.name} - ${event.title}`,
      description: `${dateStr} · ${event.location}`,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
    },
  };
}

export default async function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 인증은 미들웨어에서 처리 (소셜 미디어 크롤러는 미들웨어를 통과하여 OG 태그를 읽음)
  return <TrainingDetailClient eventId={id} />;
}
