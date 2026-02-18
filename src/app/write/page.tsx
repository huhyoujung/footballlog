// 운동 일지 작성 페이지 서버 컴포넌트 (인증 확인)
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import WriteClient from "./WriteClient";

export default async function WritePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) redirect("/login");

  return <WriteClient />;
}
