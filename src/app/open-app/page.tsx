// 인앱 브라우저에서 접근 시 외부 브라우저/앱 열기 안내 페이지
// 서버에서 URL 파싱 → 팀 정보 조회 → 클라이언트에 전달
import { prisma } from "@/lib/prisma";
import OpenAppClient from "./OpenAppClient";

// URL에서 팀 정보를 추출하는 함수
async function getTeamFromUrl(url: string) {
  try {
    const urlObj = new URL(url);

    // /training/[id] 패턴
    const trainingMatch = urlObj.pathname.match(/^\/training\/([^/]+)/);
    if (trainingMatch) {
      const event = await prisma.trainingEvent.findUnique({
        where: { id: trainingMatch[1] },
        select: { team: { select: { name: true, logoUrl: true, primaryColor: true } } },
      });
      return event?.team ?? null;
    }

    // /locker/[userId] 패턴
    const lockerMatch = urlObj.pathname.match(/^\/locker\/([^/]+)/);
    if (lockerMatch) {
      const user = await prisma.user.findUnique({
        where: { id: lockerMatch[1] },
        select: { team: { select: { name: true, logoUrl: true, primaryColor: true } } },
      });
      return user?.team ?? null;
    }

    // /log/[id] 패턴
    const logMatch = urlObj.pathname.match(/^\/log\/([^/]+)/);
    if (logMatch) {
      const log = await prisma.trainingLog.findUnique({
        where: { id: logMatch[1] },
        select: { user: { select: { team: { select: { name: true, logoUrl: true, primaryColor: true } } } } },
      });
      return log?.user?.team ?? null;
    }
  } catch {
    // URL 파싱 실패 시 무시
  }
  return null;
}

export default async function OpenAppPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const { url } = await searchParams;
  const targetUrl = url || "/";
  const team = await getTeamFromUrl(targetUrl);

  return <OpenAppClient targetUrl={targetUrl} team={team} />;
}
