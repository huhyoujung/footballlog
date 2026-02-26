// AI 코치 통합 인사이트 생성/조회
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOpenAI } from "@/lib/openai";

// 동일 유저 동시 생성 방지 (프로세스 단위 잠금, 크로스 인스턴스는 P2002로 처리)
const generatingUsers = new Set<string>();

// 동일 팀 동시 생성 방지 (팀원 여럿이 동시 요청해도 팀 GPT 1번만 호출)
const generatingTeams = new Set<string>();

// 개인 + 팀 인사이트를 하나의 마크다운 문자열로 합산
function mergeContent(personal: string, team: string): string {
  return `## 나의 코칭 피드백\n\n${personal}\n\n---\n\n${team}`;
}

// 팀 일지 배열을 포지션 기반 익명 ID로 변환해 문자열 반환
// 이름 → ID 매핑은 이번 호출 내에서만 일관성 유지
function anonymizeTeamLogs(
  logs: Array<{
    condition: number;
    keyPoints: string;
    improvement: string;
    trainingDate: Date;
    user: { name: string | null; position: string | null };
  }>
): string {
  const nameToAnon = new Map<string, string>();
  const posCounters: Record<string, number> = {};

  return logs
    .map((log) => {
      const name = log.user.name ?? `__unnamed_${nameToAnon.size}`;
      if (!nameToAnon.has(name)) {
        const pos = log.user.position?.toUpperCase() || "선수";
        posCounters[pos] = (posCounters[pos] ?? 0) + 1;
        nameToAnon.set(name, `${pos}${posCounters[pos]}`);
      }
      const anon = nameToAnon.get(name)!;
      const date = log.trainingDate.toLocaleDateString("ko-KR");
      return `- [${date}] ${anon} 컨디션:${log.condition}/10 | 핵심:"${log.keyPoints}" | 개선:"${log.improvement}"`;
    })
    .join("\n");
}

// 포지션별 평균 컨디션 집계
function calcPositionStats(
  logs: Array<{ condition: number; user: { position: string | null } }>
): string {
  const stats: Record<string, { sum: number; count: number }> = {};
  for (const log of logs) {
    const pos = log.user.position?.toUpperCase() || "미정";
    if (!stats[pos]) stats[pos] = { sum: 0, count: 0 };
    stats[pos].sum += log.condition;
    stats[pos].count += 1;
  }
  return (
    Object.entries(stats)
      .map(
        ([pos, { sum, count }]) =>
          `- ${pos}: 평균 ${(sum / count).toFixed(1)}/10 (${count}개 일지)`
      )
      .join("\n") || "없음"
  );
}

// 칭찬쪽지 태그 빈도 집계 (상위 10개)
function buildTeamTagFrequency(notes: Array<{ tags: string[] }>): string {
  const freq: Record<string, number> = {};
  for (const note of notes) {
    for (const tag of note.tags) {
      freq[tag] = (freq[tag] ?? 0) + 1;
    }
  }
  return (
    Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => `"${tag}": ${count}회`)
      .join(", ") || "없음"
  );
}

export async function POST() {
  let userId: string | undefined;
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (!session.user.teamId) {
      return NextResponse.json({ error: "팀에 소속되어 있지 않습니다" }, { status: 400 });
    }

    userId = session.user.id;
    const teamId = session.user.teamId;

    if (generatingUsers.has(userId)) {
      return NextResponse.json(
        { error: "인사이트를 생성 중입니다. 잠시만 기다려주세요." },
        { status: 429 }
      );
    }

    // KST 기준 오늘 날짜 (Vercel은 UTC이므로 +9시간)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateOnly = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;

    // 개인/팀 캐시 + 최신 일지 4-way 병렬 조회
    const [personalCache, teamCache, latestMyLog, latestTeamLog] = await Promise.all([
      prisma.aIInsight.findUnique({ where: { userId_dateOnly: { userId, dateOnly } } }),
      prisma.aIInsight.findUnique({ where: { teamId_dateOnly: { teamId, dateOnly } } }),
      prisma.trainingLog.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
      prisma.trainingLog.findFirst({
        where: { user: { teamId } },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    // 개인 일지 없으면 인사이트 불가
    if (!latestMyLog) {
      return NextResponse.json(
        { error: "일지를 작성하면 AI 코치가 인사이트를 제공해요" },
        { status: 400 }
      );
    }

    // 캐시 유효 판단
    const personalHit =
      personalCache !== null && personalCache.createdAt >= latestMyLog.createdAt;
    const teamHit =
      teamCache !== null &&
      latestTeamLog !== null &&
      teamCache.createdAt >= latestTeamLog.createdAt;

    // 둘 다 캐시 HIT → 합산 즉시 반환
    if (personalHit && teamHit) {
      return NextResponse.json({
        insight: { content: mergeContent(personalCache!.content, teamCache!.content) },
        cached: true,
      });
    }

    // 데이터 수집 (병렬) — 여기서부터 OpenAI 호출까지 잠금
    const teamAlreadyGenerating = generatingTeams.has(teamId);
    generatingUsers.add(userId);
    if (!teamHit && !teamAlreadyGenerating) {
      generatingTeams.add(teamId);
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [
      userInfo,
      myLogs,
      teamLogs,
      recentEvents,
      myCheckInCount,
      totalEventCount,
      myPomVotes,
      myLockerNotes,
      teamMemberCount,
      pastInsights,
      rsvpData,
      // 팀 분석용 추가 데이터
      teamMvpVotes,
      recentMatches,
      activeLoggers,
      teamRsvpDistribution,
      teamLockerTags,
      pendingLateFeeCount,
      recentGoals,
    ] = await Promise.all([
      // 사용자 정보
      prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, position: true, number: true },
      }),
      // 내 최근 15개 훈련일지
      prisma.trainingLog.findMany({
        where: { userId },
        orderBy: { trainingDate: "desc" },
        take: 15,
        select: {
          condition: true,
          conditionReason: true,
          keyPoints: true,
          improvement: true,
          trainingDate: true,
          trainingEvent: { select: { title: true } },
        },
      }),
      // 팀 최근 30개 훈련일지 (나 제외)
      prisma.trainingLog.findMany({
        where: { user: { teamId }, userId: { not: userId } },
        orderBy: { trainingDate: "desc" },
        take: 30,
        select: {
          condition: true,
          conditionReason: true,
          keyPoints: true,
          improvement: true,
          trainingDate: true,
          user: { select: { name: true, position: true } },
        },
      }),
      // 최근 5개 훈련 이벤트
      prisma.trainingEvent.findMany({
        where: { teamId },
        orderBy: { date: "desc" },
        take: 5,
        select: {
          title: true,
          date: true,
          location: true,
          weather: true,
          temperature: true,
          _count: { select: { checkIns: true, rsvps: true } },
        },
      }),
      // 내 체크인 수
      prisma.checkIn.count({ where: { userId } }),
      // 전체 이벤트 수
      prisma.trainingEvent.count({ where: { teamId } }),
      // 내가 받은 MVP 투표
      prisma.pomVote.findMany({
        where: { nomineeId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { reason: true, createdAt: true },
      }),
      // 내가 받은 칭찬 쪽지 (최근 10개)
      prisma.lockerNote.findMany({
        where: { recipientId: userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          content: true,
          tags: true,
          createdAt: true,
          author: { select: { name: true } },
        },
      }),
      // 팀 인원
      prisma.user.count({ where: { teamId } }),
      // 과거 AI 코칭 기록 (최근 3개, 오늘 제외 — 변화 추적용)
      prisma.aIInsight.findMany({
        where: { userId, type: "PERSONAL", dateOnly: { not: dateOnly } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { content: true, dateOnly: true },
      }),
      // 나의 RSVP 패턴 (최근 10개 — 참석 의향 vs 실제 참석 비교)
      prisma.rsvp.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { status: true, trainingEvent: { select: { date: true } } },
      }),
      // [팀 분석] 팀 전체 MVP 투표 (포지션만 — 이름 제외)
      prisma.pomVote.findMany({
        where: { trainingEvent: { teamId } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { reason: true, tags: true, nominee: { select: { position: true } } },
      }),
      // [팀 분석] 최근 친선전 결과
      prisma.trainingEvent.findMany({
        where: { teamId, isFriendlyMatch: true, matchStatus: "COMPLETED" },
        orderBy: { date: "desc" },
        take: 5,
        select: { date: true, teamAScore: true, teamBScore: true, opponentTeamName: true },
      }),
      // [팀 분석] 최근 30일 일지 작성 참여 인원
      prisma.trainingLog.findMany({
        where: { user: { teamId }, trainingDate: { gte: thirtyDaysAgo } },
        distinct: ["userId"],
        select: { userId: true },
      }),
      // [팀 분석] 팀 전체 RSVP 상태 분포
      prisma.rsvp.groupBy({
        by: ["status"],
        where: { trainingEvent: { teamId } },
        _count: { status: true },
      }),
      // [팀 분석] 팀원 수신 칭찬쪽지 태그 (최근 50개)
      prisma.lockerNote.findMany({
        where: { recipient: { teamId } },
        orderBy: { createdAt: "desc" },
        take: 50,
        select: { tags: true },
      }),
      // [팀 분석] 미납 지각비 건수
      prisma.lateFee.count({
        where: { trainingEvent: { teamId }, status: "PENDING" },
      }),
      // [팀 분석] 최근 경기 골 기록
      prisma.goalRecord.findMany({
        where: { trainingEvent: { teamId } },
        orderBy: { createdAt: "desc" },
        take: 30,
        select: { scoringTeam: true, isOwnGoal: true, minute: true },
      }),
    ]);

    // 팀 분석 시스템 프롬프트
    const TEAM_SYSTEM_PROMPT = `당신은 한국 아마추어 축구/풋살 팀의 팀 코치입니다.
팀 전체 데이터를 분석해 팀의 현재 상태와 다음 훈련 방향을 제시합니다.

코칭 원칙:
- 선수 이름 절대 금지. 포지션 익명 ID(FW1, MF2 등)만 사용
- 정량 데이터(컨디션 수치, 출석률, 골 기록, RSVP 분포) + 정성 데이터(일지 키워드, MVP 이유, 칭찬 태그) 모두 활용
- 보고가 아닌 처방: "~했다" 대신 "~해보자", "~이 필요하다"
- 지각비 건수, RSVP NO_SHOW 비율 등으로 팀 헌신도(commitment) 언급
- 다음 훈련에서 팀 전체가 집중해야 할 과제 1-2개를 구체적으로 제시해라

응답 형식:
- ## 팀 현황 분석 으로 시작
- 1000자 내외, 마크다운, 이모지 강조 용도
- 반말 (팀원에게 직접 말하는 코치 톤)
- 구조: 이번 주 팀 상태 요약(수치 기반) → 주목할 포지션/패턴 → 다음 훈련 집중 과제
- 한국어로 응답`;

    // 5. 프롬프트 구성
    const systemPrompt = `당신은 한국 아마추어 축구/풋살 팀의 현장 코치입니다.
선수 데이터를 바탕으로 "지금 이 선수에게 무엇을 시킬지"를 중심으로 코칭합니다.

코칭 원칙:
- 보고하지 말고 지시해라: "컨디션이 낮았어" 대신 "이렇게 해봐"
- 데이터에서 패턴을 찾아 개인화된 처방을 내려라
- 이론 기반: 주기화(periodization), 자기결정이론(SDT), 성장형 마인드셋 적용
- 강점은 더 강화하고, 약점은 실행 가능한 작은 과제로 쪼개라
- 과거 코칭 기록이 있으면 반드시 참조해, 그때와 지금을 비교하고 아직 안 된 과제는 다시 강조해
- 단기(이번 훈련)와 장기(이번 달) 목표를 동시에 제시해라
- RSVP 패턴이 있으면 참석 의향 vs 실제 참석을 비교해 헌신도(commitment)를 짚어라

응답 형식:
- 마크다운 형식, 이모지를 섹션 레이블이 아닌 강조 용도로 활용
- 섹션 헤더(##) 없이 코치가 선수에게 직접 말하는 흐르는 텍스트
- 반말 (친근한 코칭 톤)
- 1000~1500자 내외
- 구조: 핵심 발견(데이터 기반, 2-3문장) → 지금 당장 실행 과제(1-2개, 매우 구체적) → 장기 성장 방향
- 한국어로 응답`;

    const myLogsText = myLogs
      .map((log, i) => {
        const date = log.trainingDate.toLocaleDateString("ko-KR");
        const event = log.trainingEvent?.title || "";
        return `${i + 1}. [${date}] 컨디션:${log.condition}/10 | 이유:"${log.conditionReason}" | 핵심:"${log.keyPoints}" | 개선:"${log.improvement}"${event ? ` | 훈련:${event}` : ""}`;
      })
      .join("\n");

    const teamAvgCondition = teamLogs.length > 0
      ? (teamLogs.reduce((sum, l) => sum + l.condition, 0) / teamLogs.length).toFixed(1)
      : "없음";

    const teamKeywords = teamLogs
      .map((l) => l.keyPoints)
      .filter(Boolean)
      .join(" ")
      .slice(0, 300);

    const attendanceRate = totalEventCount > 0
      ? ((myCheckInCount / totalEventCount) * 100).toFixed(0)
      : "0";

    const mvpReasonsText = myPomVotes.length > 0
      ? myPomVotes.map((v) => `- "${v.reason}"`).join("\n")
      : "없음";

    const notesText = myLockerNotes.length > 0
      ? myLockerNotes
          .map((n) => {
            const from = n.author?.name ?? "팀원";
            const tags = (n.tags as string[])?.join(", ") || "";
            return `- ${from}: "${n.content}"${tags ? ` [${tags}]` : ""}`;
          })
          .join("\n")
      : "없음";

    const eventsText = recentEvents
      .map((e) => {
        const date = e.date.toLocaleDateString("ko-KR");
        const weather = e.weather && e.temperature !== null
          ? `${e.weather} ${e.temperature}°C`
          : "";
        return `- [${date}] ${e.title || "훈련"} @ ${e.location} | 참여:${e._count.checkIns}명 | RSVP:${e._count.rsvps}명${weather ? ` | ${weather}` : ""}`;
      })
      .join("\n");

    const pastInsightsText = pastInsights.length > 0
      ? pastInsights
          .map((ins) => `[${ins.dateOnly}]\n${ins.content}`)
          .join("\n\n---\n\n")
      : "없음";

    const rsvpText = rsvpData.length > 0
      ? rsvpData
          .map((r) => {
            const date = r.trainingEvent.date.toLocaleDateString("ko-KR");
            return `- [${date}]: ${r.status}`;
          })
          .join("\n")
      : "없음";

    // 팀 분석 데이터 포매팅
    const positionStatsText = calcPositionStats(teamLogs);

    const anonymizedTeamLogsText = anonymizeTeamLogs(teamLogs);

    const teamMvpText =
      teamMvpVotes.length > 0
        ? teamMvpVotes
            .map(
              (v) =>
                `- ${v.nominee.position?.toUpperCase() || "선수"}: "${v.reason}"${v.tags.length > 0 ? ` [${v.tags.join(", ")}]` : ""}`
            )
            .join("\n")
        : "없음";

    const matchResultsText =
      recentMatches.length > 0
        ? recentMatches
            .map((m) => {
              const date = m.date.toLocaleDateString("ko-KR");
              return `- [${date}] vs ${m.opponentTeamName || "상대팀"}: ${m.teamAScore}-${m.teamBScore}`;
            })
            .join("\n")
        : "없음";

    const activeLoggerRate =
      teamMemberCount > 0
        ? `${activeLoggers.length}/${teamMemberCount}명 (${Math.round((activeLoggers.length / teamMemberCount) * 100)}%)`
        : "없음";

    const rsvpDistText =
      teamRsvpDistribution.length > 0
        ? teamRsvpDistribution
            .map((r) => `${r.status}: ${r._count.status}건`)
            .join(" / ")
        : "없음";

    const teamTagFreqText = buildTeamTagFrequency(teamLockerTags);

    const ownGoals = recentGoals.filter((g) => g.isOwnGoal).length;
    const goalsText =
      recentGoals.length > 0
        ? `총 ${recentGoals.length}골 (자책골 ${ownGoals}개)`
        : "없음";

    const teamUserPrompt = `## 팀 기본 현황
- 팀 인원: ${teamMemberCount}명
- 최근 30일 일지 작성 참여: ${activeLoggerRate}
- 팀 평균 컨디션: ${teamAvgCondition}/10 (최근 30개 일지)
- 미납 지각비: ${pendingLateFeeCount}건

## 포지션별 컨디션 분포
${positionStatsText}

## 팀 RSVP 현황
${rsvpDistText}

## 팀원 훈련 일지 (익명, ${teamLogs.length}개)
${anonymizedTeamLogsText || "없음"}

## 팀 전체 MVP 투표 이유 (포지션 익명, ${teamMvpVotes.length}개)
${teamMvpText}

## 팀 칭찬쪽지 태그 빈도 (상위 10개)
${teamTagFreqText}

## 최근 친선전 결과
${matchResultsText}

## 최근 골 기록
${goalsText}

## 최근 훈련 이벤트 (날씨 포함)
${eventsText || "없음"}

위 데이터를 바탕으로, 팀 코치로서 팀원 전체에게 말하듯이 팀 현황 분석 리포트를 작성해줘.
선수 이름은 절대 언급하지 말고, 포지션 익명 ID(FW1, MF2 등)만 사용해줘.
다음 훈련에서 팀 전체가 집중해야 할 구체적인 과제를 포함해줘.`;

    const userPrompt = `## 선수 정보
- 이름: ${userInfo?.name || "선수"}
- 포지션: ${userInfo?.position || "미정"}
- 등번호: ${userInfo?.number ?? "미정"}

## 내 최근 훈련 일지 (${myLogs.length}개)
${myLogsText || "없음"}

## 내 통계
- 출석률: ${attendanceRate}% (${myCheckInCount}/${totalEventCount} 이벤트 체크인)
- MVP 득표: 총 ${myPomVotes.length}표

## 나의 RSVP 패턴 (최근 ${rsvpData.length}개)
${rsvpText}

## 팀원들이 나를 MVP로 뽑은 이유 (최근 ${myPomVotes.length}개)
${mvpReasonsText}

## 팀원들의 칭찬 쪽지 (${myLockerNotes.length}개)
${notesText}

## 팀 현황
- 팀 인원: ${teamMemberCount}명
- 팀 평균 컨디션: ${teamAvgCondition}/10 (최근 30개 일지)
- 팀 최근 핵심 키워드: ${teamKeywords || "없음"}

## 최근 훈련 이벤트
${eventsText || "없음"}

## 과거 코칭 기록 (최근 ${pastInsights.length}회)
${pastInsightsText}

위 데이터를 바탕으로, 현장 코치로서 이 선수에게 직접 말하듯이 코칭 피드백을 작성해줘.
단순 현황 보고가 아니라, 선수가 다음 훈련에서 바로 실행할 수 있는 구체적인 과제 중심으로 써줘.
과거 코칭 기록이 있다면 그때와 지금을 비교해서 성장을 짚어주고, 아직 안 된 과제가 있으면 다시 강조해줘.`;

    // 6. GPT 2회 병렬 호출 (캐시 HIT인 경우 해당 호출 스킵)
    const teamFallbackContent = `## 팀 현황 분석\n\n팀 인사이트는 잠시 생성 중이야. 조금 있다가 다시 확인해봐.`;

    const [personalContent, teamContent] = await Promise.all([
      personalHit
        ? Promise.resolve(personalCache!.content)
        : getOpenAI()
            .chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
              max_tokens: 1800,
              temperature: 0.7,
            })
            .then((r) => r.choices[0]?.message?.content ?? ""),

      teamHit
        ? Promise.resolve(teamCache!.content)
        : teamAlreadyGenerating
        ? Promise.resolve(teamFallbackContent)
        : teamLogs.length === 0
        ? Promise.resolve(
            `## 팀 현황 분석\n\n팀 훈련 일지가 아직 없어. 팀원들이 일지를 작성하면 팀 단위 분석을 시작할 수 있어.`
          )
        : getOpenAI()
            .chat.completions.create({
              model: "gpt-4o-mini",
              messages: [
                { role: "system", content: TEAM_SYSTEM_PROMPT },
                { role: "user", content: teamUserPrompt },
              ],
              max_tokens: 1500,
              temperature: 0.7,
            })
            .then((r) => r.choices[0]?.message?.content ?? ""),
    ]);

    if (!personalContent) {
      return NextResponse.json(
        { error: "AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // 7. 개인 + 팀 병렬 저장
    await Promise.all(
      [
        !personalHit &&
          prisma.aIInsight.upsert({
            where: { userId_dateOnly: { userId, dateOnly } },
            create: { type: "PERSONAL", content: personalContent, userId, dateOnly },
            update: { content: personalContent, createdAt: new Date() },
          }),
        !teamHit &&
          !teamAlreadyGenerating &&
          teamLogs.length > 0 &&
          prisma.aIInsight.upsert({
            where: { teamId_dateOnly: { teamId, dateOnly } },
            create: { type: "TEAM", content: teamContent, teamId, dateOnly },
            update: { content: teamContent, createdAt: new Date() },
          }),
      ].filter(Boolean)
    );

    return NextResponse.json({
      insight: { content: mergeContent(personalContent, teamContent) },
      cached: false,
    });
  } catch (error) {
    if (userId) generatingUsers.delete(userId);
    console.error("인사이트 생성 실패:", error);
    return NextResponse.json(
      { error: "AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요." },
      { status: 500 }
    );
  }
}
