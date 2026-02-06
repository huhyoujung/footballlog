import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import Feed from "@/components/Feed";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  // 팀이 없으면 온보딩으로
  if (!session.user.teamId) {
    redirect("/onboarding");
  }

  return <Feed />;
}
