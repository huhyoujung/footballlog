import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { recalculateMatchScore, updateMatchScore } from '@/lib/match-helpers';

// POST /api/match-score - 득점 기록
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

    const {
      trainingEventId,
      quarter,
      scoringTeam,
      scorerId,
      assistId,
      minute,
      isOwnGoal,
    } = await request.json();

    // TrainingEvent 조회 (체크인 여부 확인)
    const event = await prisma.trainingEvent.findUnique({
      where: { id: trainingEventId },
      include: {
        checkIns: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // 체크인한 사람만 기록 가능
    const hasCheckedIn = event.checkIns.some((checkIn) => checkIn.userId === user.id);
    if (!hasCheckedIn) {
      return NextResponse.json({ error: 'Only checked-in members can record goals' }, { status: 403 });
    }

    // 득점 기록 생성
    const goalRecord = await prisma.goalRecord.create({
      data: {
        trainingEventId,
        quarter,
        scoringTeam,
        scorerId,
        assistId,
        recordedById: user.id,
        minute,
        isOwnGoal: isOwnGoal || false,
      },
      include: {
        scorer: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        assistant: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        recordedBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // 총점 재계산 및 업데이트
    await updateMatchScore(trainingEventId, event.linkedEventId);
    const { teamAScore, teamBScore } = await recalculateMatchScore(trainingEventId);

    return NextResponse.json({
      ...goalRecord,
      teamAScore,
      teamBScore,
    });
  } catch (error) {
    console.error('Record goal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/match-score?trainingEventId=xxx - 득점 기록 조회
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const trainingEventId = searchParams.get('trainingEventId');

    if (!trainingEventId) {
      return NextResponse.json({ error: 'trainingEventId required' }, { status: 400 });
    }

    const goals = await prisma.goalRecord.findMany({
      where: { trainingEventId },
      include: {
        scorer: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        assistant: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        recordedBy: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
      orderBy: [
        { quarter: 'asc' },
        { createdAt: 'asc' },
      ],
    });

    return NextResponse.json(goals);
  } catch (error) {
    console.error('Get goals error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
