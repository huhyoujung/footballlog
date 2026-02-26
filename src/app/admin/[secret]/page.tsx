import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/PageHeader";
import DashboardTabs from "./DashboardTabs";

// 대시보드 데이터는 1분마다 갱신 (실시간 불필요)
export const revalidate = 60;

interface Props {
  params: Promise<{ secret: string }>;
}

export default async function SuperAdminPage({ params }: Props) {
  const { secret } = await params;

  // 환경변수 미설정 시 접근 불가
  if (!process.env.ADMIN_SECRET || !process.env.SUPER_ADMIN_EMAIL) {
    return notFound();
  }

  // 세션 확인 먼저 (URL보다 세션이 더 안전한 1차 관문)
  const session = await getServerSession(authOptions);
  if (session?.user?.email !== process.env.SUPER_ADMIN_EMAIL) return notFound();

  // 시크릿 URL 확인
  if (secret !== process.env.ADMIN_SECRET) return notFound();

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    todaySignups,
    noTeamCount,
    totalTeams,
    dauSessions,
    recentUsers,
    teamsWithStats,
    recentLogs,
    inactiveUsers,
    recentFeedbacks,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: todayStart } } }),
    prisma.user.count({ where: { teamId: null } }),
    prisma.team.count(),
    prisma.session.findMany({
      where: { expires: { gte: todayStart } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        team: { select: { name: true } },
      },
    }),
    prisma.team.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { members: true } },
        trainingEvents: {
          orderBy: { date: "desc" },
          take: 1,
          select: { date: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.$queryRaw<{ date: string; count: number }[]>`
      SELECT DATE("createdAt") as date, COUNT(*)::int as count
      FROM "TrainingLog"
      WHERE "createdAt" >= ${sevenDaysAgo}
      GROUP BY DATE("createdAt")
    `,
    prisma.user.findMany({
      where: {
        createdAt: { lte: sevenDaysAgo },
        trainingLogs: { none: {} },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        team: { select: { name: true } },
      },
      take: 100,
      orderBy: { createdAt: "desc" },
    }),
    prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        title: true,
        content: true,
        userName: true,
        userEmail: true,
        createdAt: true,
        status: true,
      },
    }),
  ]);

  const dau = dauSessions.length;

  // 날짜별 로그 집계
  const logsByDate: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    logsByDate[d.toISOString().split("T")[0]] = 0;
  }
  recentLogs.forEach((row) => {
    const dateKey = String(row.date);
    if (dateKey in logsByDate) logsByDate[dateKey] = row.count;
  });

  // --- 탭별 콘텐츠 ---

  const overview = (
    <>
      {/* 요약 카드 */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">현황 요약</h2>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { label: "총 유저", value: totalUsers },
            { label: "오늘 가입", value: todaySignups },
            { label: "미가입자", value: noTeamCount },
            { label: "총 팀", value: totalTeams },
            { label: "DAU", value: dau },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-xl p-4 shadow-sm text-center">
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>
      {/* 최근 7일 훈련 로그 */}
      <Section title="최근 7일 훈련 로그">
        <Table
          headers={["날짜", "로그 수"]}
          rows={Object.entries(logsByDate).map(([date, count]) => [date, String(count)])}
        />
      </Section>
    </>
  );

  const users = (
    <>
      <Section title="최근 가입자">
        <Table
          headers={["이름", "이메일", "가입일", "소속팀"]}
          rows={recentUsers.map((u) => [
            u.name ?? "-",
            u.email ?? "-",
            formatDate(u.createdAt),
            u.team?.name ?? "미가입",
          ])}
        />
      </Section>
      <Section title={`활동 없는 유저 (가입 7일+ & 로그 0개) — ${inactiveUsers.length}명`}>
        <Table
          headers={["이름", "이메일", "가입일", "소속팀"]}
          rows={inactiveUsers.map((u) => [
            u.name ?? "-",
            u.email ?? "-",
            formatDate(u.createdAt),
            u.team?.name ?? "미가입",
          ])}
        />
      </Section>
    </>
  );

  const teams = (
    <Section title="팀별 인원 현황">
      <Table
        headers={["팀명", "인원", "최근 훈련"]}
        rows={teamsWithStats.map((t) => [
          t.name,
          String(t._count.members),
          t.trainingEvents[0] ? formatDate(t.trainingEvents[0].date) : "-",
        ])}
      />
    </Section>
  );

  const feedbacks = (
    <Section title="최근 피드백">
      <Table
        headers={["유형", "제목", "내용", "작성자", "날짜", "상태"]}
        rows={recentFeedbacks.map((f) => [
          f.type,
          f.title,
          f.content.length > 50 ? f.content.slice(0, 50) + "…" : f.content,
          f.userName ?? f.userEmail ?? "-",
          formatDate(f.createdAt),
          f.status,
        ])}
      />
    </Section>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <PageHeader title="슈퍼어드민 대시보드" />
      <div className="max-w-5xl mx-auto p-6">
        <DashboardTabs
          overview={overview}
          users={users}
          teams={teams}
          feedbacks={feedbacks}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs font-semibold text-gray-500 uppercase mb-3">{title}</h2>
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">{children}</div>
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-2 text-left font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-4 text-center text-gray-400">
                데이터 없음
              </td>
            </tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-gray-50">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 text-gray-700 whitespace-nowrap">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
