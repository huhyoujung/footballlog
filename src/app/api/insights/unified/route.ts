// AI 코치 통합 인사이트 생성/조회
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";

// 동일 유저 동시 생성 방지 (프로세스 단위 잠금, 크로스 인스턴스는 P2002로 처리)
const generatingUsers = new Set<string>();

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

    // 1. 일지 존재 여부 확인
    const latestLog = await prisma.trainingLog.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });

    if (!latestLog) {
      return NextResponse.json(
        { error: "일지를 작성하면 AI 코치가 인사이트를 제공해요" },
        { status: 400 }
      );
    }

    // 2. KST 기준 오늘 날짜 (Vercel은 UTC이므로 +9시간)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    const dateOnly = `${kst.getUTCFullYear()}-${String(kst.getUTCMonth() + 1).padStart(2, "0")}-${String(kst.getUTCDate()).padStart(2, "0")}`;

    // 3. 오늘 인사이트 존재 + 그 이후 새 일지 없으면 캐시 반환
    const existingToday = await prisma.aIInsight.findUnique({
      where: { userId_dateOnly: { userId, dateOnly } },
    });

    if (existingToday && latestLog.createdAt <= existingToday.createdAt) {
      return NextResponse.json({
        insight: { content: existingToday.content },
        cached: true,
      });
    }

    // 4. 새 데이터 없으면 마지막 인사이트 반환
    if (!existingToday) {
      const latestInsight = await prisma.aIInsight.findFirst({
        where: { userId, type: "PERSONAL" },
        orderBy: { createdAt: "desc" },
      });

      if (latestInsight && latestLog.createdAt <= latestInsight.createdAt) {
        return NextResponse.json({
          insight: { content: latestInsight.content },
          cached: true,
        });
      }
    }

    // 4. 데이터 수집 (병렬) — 여기서부터 OpenAI 호출까지 잠금
    generatingUsers.add(userId);
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
          isAnonymous: true,
          author: { select: { name: true } },
        },
      }),
      // 팀 인원
      prisma.user.count({ where: { teamId } }),
    ]);

    // 5. 프롬프트 구성
    const systemPrompt = `당신은 한국 아마추어 축구/풋살 팀의 AI 코치입니다.
선수의 훈련 일지, MVP 투표, 칭찬 쪽지, 출석 데이터를 종합 분석하여 개인화된 인사이트를 제공합니다.

역할:
- 선수의 컨디션 패턴을 분석하고 트렌드를 파악
- 개선점을 구체적으로 제안 (실제 훈련 내용 기반)
- 팀 내에서의 역할과 기여도를 평가
- 팀원들의 칭찬과 MVP 선정 데이터로 강점을 강화
- 격려와 동기부여를 포함하되, 구체적 데이터에 근거

응답 형식:
- 마크다운 형식
- 이모지를 적절히 사용
- 섹션별로 구분하되 자연스러운 코칭 톤
- 한국어로 응답
- 최대 600자 내외로 간결하게
- 반말(친근한 코칭 톤) 사용`;

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
            const from = n.isAnonymous ? "익명" : (n.author?.name || "팀원");
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

    const userPrompt = `## 선수 정보
- 이름: ${userInfo?.name || "선수"}
- 포지션: ${userInfo?.position || "미정"}
- 등번호: ${userInfo?.number ?? "미정"}

## 내 최근 훈련 일지 (${myLogs.length}개)
${myLogsText || "없음"}

## 내 통계
- 출석률: ${attendanceRate}% (${myCheckInCount}/${totalEventCount} 이벤트 체크인)
- MVP 득표: 총 ${myPomVotes.length}표

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

위 데이터를 바탕으로 이 선수에게 개인화된 AI 코치 인사이트를 작성해줘.`;

    // 6. OpenAI 호출
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const content = completion.choices[0]?.message?.content;

    if (!content) {
      return NextResponse.json(
        { error: "AI 분석에 실패했습니다. 잠시 후 다시 시도해주세요." },
        { status: 500 }
      );
    }

    // 7. 저장 (upsert: 오늘 이미 있으면 갱신, 없으면 생성)
    const saved = await prisma.aIInsight.upsert({
      where: { userId_dateOnly: { userId, dateOnly } },
      create: {
        type: "PERSONAL",
        content,
        userId,
        dateOnly,
      },
      update: {
        content,
        createdAt: new Date(),
      },
    });

    generatingUsers.delete(userId);
    return NextResponse.json({
      insight: { content: saved.content },
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
