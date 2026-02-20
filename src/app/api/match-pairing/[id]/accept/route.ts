import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/match-pairing/[id]/accept - 친선경기 매칭 수락
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 400 });
    }

    // 초대받은 팀의 TrainingEvent 조회
    const opponentEvent = await prisma.trainingEvent.findUnique({
      where: { id: id },
      include: {
        linkedEvent: true, // 호스트 팀의 이벤트
      },
    });

    if (!opponentEvent) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (opponentEvent.teamId !== user.teamId) {
      return NextResponse.json({ error: 'Not your team event' }, { status: 403 });
    }

    if (opponentEvent.matchStatus !== 'CHALLENGE_SENT') {
      return NextResponse.json({ error: 'Match is not pending' }, { status: 400 });
    }

    if (!opponentEvent.linkedEvent) {
      return NextResponse.json({ error: 'Linked event not found' }, { status: 400 });
    }

    // 양쪽 이벤트 모두 CONFIRMED로 업데이트
    await prisma.$transaction([
      prisma.trainingEvent.update({
        where: { id: id },
        data: { matchStatus: 'CONFIRMED' },
      }),
      prisma.trainingEvent.update({
        where: { id: opponentEvent.linkedEvent.id },
        data: { matchStatus: 'CONFIRMED' },
      }),
    ]);

    return NextResponse.json({
      message: 'Match confirmed',
      id,
      linkedEventId: opponentEvent.linkedEvent.id,
    });
  } catch (error) {
    console.error('Match accept error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
