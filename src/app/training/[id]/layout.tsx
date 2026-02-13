import { Metadata } from "next";
import { prisma } from "@/lib/prisma";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  const event = await prisma.trainingEvent.findUnique({
    where: { id },
    include: {
      team: { select: { name: true } },
    },
  });

  if (!event) {
    return {
      title: "팀 운동",
      description: "팀 운동 상세 정보",
    };
  }

  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });

  const title = `${event.title} - ${event.team.name}`;
  const description = `${dateStr} · ${event.location}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function TrainingLayout({ children }: Props) {
  return children;
}
