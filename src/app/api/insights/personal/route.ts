import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/insights/personal - 개인 누적 인사이트 생성/조회
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 오늘 날짜 (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];

    // 1. 오늘 이미 인사이트를 받았는지 확인
    const existingInsight = await prisma.aIInsight.findUnique({
      where: {
        userId_dateOnly: {
          userId: user.id,
          dateOnly: today,
        },
      },
    });

    if (existingInsight) {
      // 이미 생성된 인사이트 반환
      return NextResponse.json({
        insight: existingInsight,
        cached: true,
      });
    }

    // 2. 오늘 훈련일지를 작성했는지 확인
    const todayLog = await prisma.trainingLog.findFirst({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date(today),
          lt: new Date(new Date(today).getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (!todayLog) {
      return NextResponse.json(
        { error: '오늘 훈련일지를 작성해야 인사이트를 받을 수 있습니다' },
        { status: 403 }
      );
    }

    // 3. 개인 훈련일지 데이터 수집 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trainingLogs = await prisma.trainingLog.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        trainingEvent: {
          select: {
            title: true,
            date: true,
            location: true,
            weather: true,
            temperature: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 30,
    });

    if (trainingLogs.length === 0) {
      return NextResponse.json(
        { error: '분석할 훈련일지가 충분하지 않습니다' },
        { status: 400 }
      );
    }

    // 4. OpenAI로 인사이트 생성
    const prompt = `당신은 축구팀의 AI 코치입니다. 다음은 선수 "${user.name}"의 최근 30일간 훈련일지입니다.

훈련일지 데이터:
${trainingLogs.map((log, idx) => `
[${idx + 1}] ${log.createdAt.toISOString().split('T')[0]}
- 컨디션: ${log.condition}/5
${log.conditionReason ? `- 컨디션 이유: ${log.conditionReason}` : ''}
${log.keyPoints ? `- 중점 연습: ${log.keyPoints}` : ''}
${log.improvement ? `- 개선할 점: ${log.improvement}` : ''}
${log.notes ? `- 메모: ${log.notes}` : ''}
${log.trainingEvent ? `- 운동 정보: ${log.trainingEvent.title}, 장소: ${log.trainingEvent.location}` : ''}
${log.trainingEvent?.weather ? `- 날씨: ${log.trainingEvent.weather}, 온도: ${log.trainingEvent.temperature}°C` : ''}
`).join('\n')}

다음 관점에서 개인 인사이트를 제공해주세요:

1. **컨디션 트렌드**: 최근 컨디션 변화 패턴 분석
2. **성장 포인트**: keyPoints와 improvement에서 발견되는 성장 영역
3. **외부 요인 영향**: 날씨, 장소 등이 컨디션/퍼포먼스에 미치는 영향
4. **다음 단계 제안**: 구체적이고 실행 가능한 개선 방향

응답은 마크다운 형식으로 작성하고, 친근하고 격려하는 톤으로 작성해주세요. 300-500자 정도로 간결하게 작성하세요.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 친근하고 전문적인 축구 코치입니다. 선수들을 격려하고 구체적인 피드백을 제공합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
    });

    const insightContent = completion.choices[0]?.message?.content || '인사이트를 생성할 수 없습니다.';

    // 5. 인사이트 저장
    const insight = await prisma.aIInsight.create({
      data: {
        type: 'PERSONAL',
        content: insightContent,
        userId: user.id,
        dateOnly: today,
      },
    });

    return NextResponse.json({
      insight,
      cached: false,
    });
  } catch (error) {
    console.error('Personal insight error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
