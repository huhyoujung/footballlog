import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/player-substitution - 선수 교체 기록
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

    const { trainingEventId, quarter, teamSide, playerOutId, playerInId, minute } = await request.json();

    if (!trainingEventId || !quarter || !teamSide || !playerOutId || !playerInId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 같은 선수가 in/out에 동시에 들어가지 않도록 검증
    if (playerOutId === playerInId) {
      return NextResponse.json({ error: '같은 선수를 교체할 수 없습니다' }, { status: 400 });
    }

    // TrainingEvent 확인
    const event = await prisma.trainingEvent.findUnique({
      where: { id: trainingEventId },
      include: { team: true },
    });

    if (!event) {
      return NextResponse.json({ error: 'Training event not found' }, { status: 404 });
    }

    if (!event.isFriendlyMatch) {
      return NextResponse.json({ error: 'Not a friendly match' }, { status: 400 });
    }

    // 체크인 확인 (기록하는 사람이 체크인했는지)
    const checkIn = await prisma.checkIn.findUnique({
      where: {
        trainingEventId_userId: {
          trainingEventId,
          userId: user.id,
        },
      },
    });

    if (!checkIn) {
      return NextResponse.json({ error: 'Only checked-in members can record substitutions' }, { status: 403 });
    }

    // 교체되는 두 선수가 체크인했는지 확인
    const playersCheckIn = await prisma.checkIn.findMany({
      where: {
        trainingEventId,
        userId: { in: [playerOutId, playerInId] },
      },
    });

    if (playersCheckIn.length !== 2) {
      return NextResponse.json({ error: 'Both players must be checked in' }, { status: 400 });
    }

    // 교체 기록 생성
    const substitution = await prisma.playerSubstitution.create({
      data: {
        trainingEventId,
        quarter,
        teamSide,
        playerOutId,
        playerInId,
        recordedById: user.id,
        minute: minute || null,
      },
      include: {
        playerOut: {
          select: { id: true, name: true, image: true, position: true, number: true },
        },
        playerIn: {
          select: { id: true, name: true, image: true, position: true, number: true },
        },
        recordedBy: {
          select: { id: true, name: true },
        },
      },
    });

    return NextResponse.json(substitution, { status: 201 });
  } catch (error) {
    console.error('Player substitution error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/player-substitution?trainingEventId=xxx - 특정 경기의 교체 기록 조회
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

    const substitutions = await prisma.playerSubstitution.findMany({
      where: { trainingEventId },
      include: {
        playerOut: {
          select: { id: true, name: true, image: true, position: true, number: true },
        },
        playerIn: {
          select: { id: true, name: true, image: true, position: true, number: true },
        },
        recordedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: [{ quarter: 'asc' }, { createdAt: 'asc' }],
    });

    return NextResponse.json({ substitutions });
  } catch (error) {
    console.error('Get substitutions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
