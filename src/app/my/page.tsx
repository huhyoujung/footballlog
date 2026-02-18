// OURPAGE - 서버 인증
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import MyPageClient from "./MyPageClient";

export default async function MyPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const isAdmin = session.user.role === "ADMIN";

  return <MyPageClient userId={session.user.id} isAdmin={isAdmin} />;
}
