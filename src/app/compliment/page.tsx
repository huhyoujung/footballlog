// 칭찬 쪽지 - 서버 인증
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import ComplimentClient from "./ComplimentClient";

export default async function ComplimentPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return <ComplimentClient userId={session.user.id} />;
}
