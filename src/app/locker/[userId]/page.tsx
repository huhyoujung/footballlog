// 개인 락커 페이지 - 서버 인증 및 params 추출
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LockerClient from "./LockerClient";

export default async function LockerPage({ params }: { params: Promise<{ userId: string }> }) {
  const [session, { userId }] = await Promise.all([
    getServerSession(authOptions),
    params,
  ]);

  if (!session?.user?.id) redirect("/login");

  return <LockerClient userId={userId} />;
}
