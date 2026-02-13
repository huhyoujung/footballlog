import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 축구 스탯 기반 칭찬 제안 생성
 * POST /api/compliment-suggestions
 * body: { recipientId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { recipientId } = await req.json();

    if (!recipientId) {
      return NextResponse.json({ error: 'recipientId가 필요합니다' }, { status: 400 });
    }

    // 받는 사람 정보 조회
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
      include: {
        teamMemberships: {
          where: { status: 'ACTIVE' },
          include: {
            team: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!recipient) {
      return NextResponse.json({ error: '사용자를 찾을 수 없습니다' }, { status: 404 });
    }

    // 최근 30일 훈련 일지
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const recentLogs = await prisma.trainingLog.findMany({
      where: {
        userId: recipientId,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { trainingDate: 'desc' },
      take: 30,
      select: {
        trainingDate: true,
        condition: true,
        keyPoints: true,
        createdAt: true,
      },
    });

    // 최근 정기운동 출석률 (최근 10회)
    const recentTrainingEvents = await prisma.trainingEvent.findMany({
      where: {
        teamId: recipient.teamMemberships[0]?.teamId,
        type: 'REGULAR',
        status: 'COMPLETED',
      },
      orderBy: { date: 'desc' },
      take: 10,
      select: {
        id: true,
        date: true,
        checkIns: {
          where: { userId: recipientId },
          select: { id: true },
        },
      },
    });

    const attendanceRate = recentTrainingEvents.length > 0
      ? (recentTrainingEvents.filter((e) => e.checkIns.length > 0).length / recentTrainingEvents.length) * 100
      : 0;

    // MVP 횟수 (최근 30일)
    const mvpCount = await prisma.pOMVote.count({
      where: {
        userId: recipientId,
        isPOM: true,
        trainingEvent: {
          date: { gte: thirtyDaysAgo },
        },
      },
    });

    // 컨디션 평균 (최근 30일)
    const conditionValues = recentLogs
      .map((log) => log.condition)
      .filter((c): c is number => c !== null && c !== undefined);
    const avgCondition = conditionValues.length > 0
      ? conditionValues.reduce((a, b) => a + b, 0) / conditionValues.length
      : 0;

    // 훈련 일지 작성 빈도
    const logCount = recentLogs.length;

    // 프롬프트 생성
    const stats = `
**${recipient.name || '팀원'}님의 최근 활동 (30일)**
- 출석률: ${attendanceRate.toFixed(0)}% (최근 10회 정기운동 기준)
- 훈련 일지: ${logCount}회 작성
- MVP 수상: ${mvpCount}회
- 평균 컨디션: ${avgCondition.toFixed(1)}/10
- 포지션: ${recipient.position || '미정'}
`;

    const prompt = `당신은 친근한 축구 팀 동료입니다. 아래 팀원의 활동 데이터를 보고 **3가지 칭찬 포인트**를 제안해주세요.

${stats}

**요구사항:**
1. 각 칭찬은 50자 이내로 간결하게 작성
2. 구체적인 스탯을 언급하며 칭찬 (예: "출석률 95%!", "MVP 3회 수상!")
3. 격려하고 응원하는 톤
4. 3가지만 제안

**출력 형식 (JSON):**
{
  "suggestions": [
    "첫 번째 칭찬 메시지",
    "두 번째 칭찬 메시지",
    "세 번째 칭찬 메시지"
  ]
}`;

    // OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 친근한 축구 팀 동료입니다. 간결하고 구체적으로 칭찬합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.8,
      max_tokens: 300,
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return NextResponse.json({
      suggestions: parsed.suggestions || [],
      stats: {
        attendanceRate: Math.round(attendanceRate),
        logCount,
        mvpCount,
        avgCondition: Math.round(avgCondition * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Compliment suggestions error:', error);
    return NextResponse.json(
      { error: '칭찬 제안 생성에 실패했습니다' },
      { status: 500 }
    );
  }
}
