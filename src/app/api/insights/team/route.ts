import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /api/insights/team - 팀 인사이트 생성/조회
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { team: true },
    });

    if (!user?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 404 });
    }

    // 오늘 날짜 (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];

    // 1. 오늘 이미 팀 인사이트를 생성했는지 확인
    const existingInsight = await prisma.aIInsight.findUnique({
      where: {
        teamId_dateOnly: {
          teamId: user.teamId,
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

    // 2. 최근 정기운동이 끝났는지 확인 (오늘 또는 어제)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const recentRegularEvent = await prisma.trainingEvent.findFirst({
      where: {
        teamId: user.teamId,
        isRegular: true,
        date: {
          gte: yesterday,
          lte: new Date(),
        },
      },
      orderBy: {
        date: 'desc',
      },
    });

    if (!recentRegularEvent) {
      return NextResponse.json(
        { error: '최근 정기운동이 없습니다' },
        { status: 403 }
      );
    }

    // 3. 팀 훈련일지 데이터 수집 (최근 30일)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const trainingLogs = await prisma.trainingLog.findMany({
      where: {
        user: {
          teamId: user.teamId,
        },
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      include: {
        user: {
          select: {
            name: true,
            position: true,
          },
        },
        trainingEvent: {
          select: {
            title: true,
            date: true,
            location: true,
            weather: true,
            temperature: true,
            isRegular: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // 팀 전체 로그이므로 더 많이
    });

    if (trainingLogs.length < 5) {
      return NextResponse.json(
        { error: '분석할 팀 훈련일지가 충분하지 않습니다' },
        { status: 400 }
      );
    }

    // 4. 평균 컨디션 계산
    const avgCondition = trainingLogs.reduce((sum, log) => sum + log.condition, 0) / trainingLogs.length;

    // 5. 공통 키워드 추출 (keyPoints와 improvement에서)
    const allKeyPoints = trainingLogs
      .filter(log => log.keyPoints)
      .map(log => log.keyPoints)
      .join(' ');

    const allImprovements = trainingLogs
      .filter(log => log.improvement)
      .map(log => log.improvement)
      .join(' ');

    // 6. OpenAI로 팀 인사이트 생성
    const prompt = `당신은 축구팀 "${user.team?.name}"의 AI 코치입니다. 다음은 최근 30일간 팀원들의 훈련일지입니다.

팀 훈련일지 요약:
- 총 로그 개수: ${trainingLogs.length}개
- 평균 컨디션: ${avgCondition.toFixed(1)}/5
- 참여 멤버: ${new Set(trainingLogs.map(log => log.user.name)).size}명

최근 로그 샘플 (최신 20개):
${trainingLogs.slice(0, 20).map((log, idx) => `
[${idx + 1}] ${log.createdAt.toISOString().split('T')[0]} - ${log.user.name} (${log.user.position || '포지션 미정'})
- 컨디션: ${log.condition}/5
${log.conditionReason ? `- 이유: ${log.conditionReason}` : ''}
${log.keyPoints ? `- 중점: ${log.keyPoints}` : ''}
${log.improvement ? `- 개선: ${log.improvement}` : ''}
`).join('\n')}

공통 키워드:
- 중점 연습: ${allKeyPoints.substring(0, 500)}
- 개선 필요: ${allImprovements.substring(0, 500)}

다음 관점에서 팀 인사이트를 제공해주세요:

1. **팀 전체 컨디션 분석**: 평균 컨디션과 트렌드
2. **공통 강점**: 팀이 잘하고 있는 부분
3. **공통 개선점**: 팀 전체가 함께 개선해야 할 부분
4. **팀 케미스트리**: 팀워크와 분위기 분석
5. **다음 훈련 제안**: 팀 차원의 구체적인 훈련 방향

응답은 마크다운 형식으로 작성하고, 팀을 격려하는 톤으로 작성해주세요. 400-600자 정도로 작성하세요.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 팀 전체를 보살피는 전문 축구 코치입니다. 팀워크와 성장을 중시합니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const insightContent = completion.choices[0]?.message?.content || '인사이트를 생성할 수 없습니다.';

    // 7. 인사이트 저장
    const insight = await prisma.aIInsight.create({
      data: {
        type: 'TEAM',
        content: insightContent,
        teamId: user.teamId,
        dateOnly: today,
      },
    });

    return NextResponse.json({
      insight,
      cached: false,
    });
  } catch (error) {
    console.error('Team insight error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
