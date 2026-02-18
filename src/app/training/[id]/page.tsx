// 팀 운동 상세 페이지 - 서버 인증 및 params 추출
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import TrainingDetailClient from "./TrainingDetailClient";

export default async function TrainingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([
    getServerSession(authOptions),
    params,
  ]);

  if (!session?.user?.id) redirect("/login");

  return <TrainingDetailClient eventId={id} />;
}
