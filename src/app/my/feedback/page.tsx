// 피드백 보내기 - 서버 인증
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import FeedbackClient from "./FeedbackClient";

export default async function FeedbackPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  return <FeedbackClient userName={session.user.name || "선수"} />;
}
