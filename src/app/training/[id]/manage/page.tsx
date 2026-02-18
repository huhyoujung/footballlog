// 팀 운동 관리 페이지 - 서버 인증 + 관리자 확인 및 리다이렉트
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import TrainingManageClient from "./TrainingManageClient";

export default async function TrainingManagePage({ params }: { params: Promise<{ id: string }> }) {
  const [session, { id }] = await Promise.all([
    getServerSession(authOptions),
    params,
  ]);

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return <TrainingManageClient eventId={id} />;
}
