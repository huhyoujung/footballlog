// 운영진 관리 페이지 서버 컴포넌트 (인증 + 관리자 권한 확인)
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AdminsClient from "./AdminsClient";

export default async function AdminManagementPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) redirect("/login");
  if (session.user.role !== "ADMIN") redirect("/");

  return <AdminsClient />;
}
