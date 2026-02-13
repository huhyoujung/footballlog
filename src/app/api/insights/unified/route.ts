import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * 통합 인사이트 생성 (팀 + 개인)
 * POST /api/insights/unified
 *
 * 요구사항:
 * - 오늘 훈련일지 제출한 사용자만 가능
 * - 하루 1번 제한 (개인별)
 * - 최근 정기운동이 완료되어야 함
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const userId = session.user.id;

    // 1. 사용자의 팀 확인
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        teamMemberships: {
          include: { team: true },
          where: { status: 'ACTIVE' }
        }
      },
    });

    if (!user?.teamMemberships?.[0]?.teamId) {
      return NextResponse.json({ error: '팀에 가입되어 있지 않습니다' }, { status: 400 });
    }

    const teamId = user.teamMemberships[0].teamId;

    // 2. 오늘 날짜 (YYYY-MM-DD)
    const now = new Date();
    const dateOnly = now.toISOString().split('T')[0];

    // 3. 기존 인사이트 확인 (캐시)
    const existing = await prisma.aIInsight.findUnique({
      where: {
        userId_dateOnly: {
          userId,
          dateOnly,
        },
      },
    });

    if (existing) {
      return NextResponse.json({
        insight: existing,
        cached: true,
      });
    }

    // 4. 오늘 훈련일지 제출 여부 확인
    const todayLog = await prisma.trainingLog.findFirst({
      where: {
        userId,
        trainingDate: {
          gte: new Date(dateOnly),
          lt: new Date(new Date(dateOnly).getTime() + 86400000),
        },
      },
    });

    if (!todayLog) {
      return NextResponse.json(
        { error: '오늘 훈련일지를 먼저 작성해주세요' },
        { status: 403 }
      );
    }

    // 5. 최근 정기운동 완료 확인 (7일 이내)
    const recentTraining = await prisma.trainingEvent.findFirst({
      where: {
        teamId,
        type: 'REGULAR',
        status: 'COMPLETED',
        date: {
          gte: new Date(Date.now() - 7 * 86400000),
        },
      },
      orderBy: { date: 'desc' },
    });

    if (!recentTraining) {
      return NextResponse.json(
        { error: '최근 정기운동이 완료되지 않았습니다' },
        { status: 403 }
      );
    }

    // 6. 개인 데이터 수집 (최근 30일)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    const personalLogs = await prisma.trainingLog.findMany({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { trainingDate: 'desc' },
      take: 30,
      select: {
        trainingDate: true,
        condition: true,
        keyPoints: true,
        improvements: true,
        createdAt: true,
      },
    });

    // 7. 팀 데이터 수집 (최근 30일, 최대 100개)
    const teamLogs = await prisma.trainingLog.findMany({
      where: {
        user: {
          teamMemberships: {
            some: {
              teamId,
              status: 'ACTIVE',
            },
          },
        },
        createdAt: { gte: thirtyDaysAgo },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        user: {
          select: {
            name: true,
            position: true,
          },
        },
        trainingDate: true,
        condition: true,
        keyPoints: true,
        improvements: true,
        createdAt: true,
      },
    });

    // 8. 프롬프트 생성
    const personalSummary = personalLogs
      .map((log, i) => {
        const date = new Date(log.trainingDate).toLocaleDateString('ko-KR');
        return `${i + 1}. ${date} - 컨디션: ${log.condition || '미기록'}, 주요내용: ${log.keyPoints || '없음'}, 개선점: ${log.improvements || '없음'}`;
      })
      .join('\n');

    const teamSummary = teamLogs
      .map((log, i) => {
        const date = new Date(log.trainingDate).toLocaleDateString('ko-KR');
        const name = log.user.name || '익명';
        return `${i + 1}. ${name} (${log.user.position || '미정'}) - ${date} - 컨디션: ${log.condition || '미기록'}`;
      })
      .join('\n');

    const prompt = `당신은 친근하고 전문적인 축구 코치입니다. 선수들을 격려하고 구체적인 피드백을 제공합니다.

아래 데이터를 바탕으로 **개인 성장 인사이트 + 팀 인사이트**를 통합하여 제공해주세요.

## 개인 데이터 (최근 30일)
${personalSummary || '아직 데이터가 부족합니다.'}

## 팀 데이터 (최근 30일)
${teamSummary || '팀 데이터가 부족합니다.'}

다음 형식으로 작성해주세요:

# 💪 나의 성장 인사이트
- 최근 컨디션 트렌드 분석
- 구체적인 강점과 개선 제안
- 다음 훈련 포커스 포인트

# ⚽ 팀 인사이트
- 팀 전체 활동 패턴 분석
- 주목할 만한 팀원 활동
- 팀 분위기 및 격려 메시지

**톤**: 친근하고 격려하는 말투, 구체적이고 실용적인 조언
**길이**: 800자 이내`;

    // 9. OpenAI API 호출
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '당신은 친근하고 전문적인 축구 코치입니다.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const content = completion.choices[0]?.message?.content || '인사이트 생성 실패';

    // 10. DB 저장 (PERSONAL 타입으로 저장, userId 기준 중복 방지)
    const insight = await prisma.aIInsight.create({
      data: {
        type: 'PERSONAL',
        content,
        userId,
        dateOnly,
      },
    });

    return NextResponse.json({
      insight,
      cached: false,
    });
  } catch (error) {
    console.error('Unified insight error:', error);
    return NextResponse.json(
      { error: '인사이트 생성 중 오류가 발생했습니다' },
      { status: 500 }
    );
  }
}
