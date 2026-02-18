// 팀 운동 관리 - 서버 인증 (ADMIN 전용)
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import MyTrainingClient from "./MyTrainingClient";

export default async function MyTrainingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/my");

  return <MyTrainingClient />;
}
