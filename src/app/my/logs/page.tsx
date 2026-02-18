// 내 운동 일지 목록 - 서버 인증
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import MyLogsClient from "./MyLogsClient";

export default async function MyLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return <MyLogsClient userId={session.user.id} />;
}
