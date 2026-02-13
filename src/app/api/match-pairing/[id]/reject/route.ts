import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/match-pairing/[id]/reject - 친선경기 매칭 거절
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

    if (opponentEvent.matchStatus !== 'PENDING') {
      return NextResponse.json({ error: 'Match is not pending' }, { status: 400 });
    }

    if (!opponentEvent.linkedEvent) {
      return NextResponse.json({ error: 'Linked event not found' }, { status: 400 });
    }

    const hostEventId = opponentEvent.linkedEvent.id;

    // 양쪽 이벤트 모두 삭제 (거절 시)
    await prisma.$transaction([
      prisma.trainingEvent.delete({
        where: { id: id },
      }),
      prisma.trainingEvent.update({
        where: { id: hostEventId },
        data: {
          linkedEventId: null,
          opponentTeamId: null,
          matchStatus: 'DRAFT',
        },
      }),
    ]);

    return NextResponse.json({
      message: 'Match rejected',
      hostEventId,
    });
  } catch (error) {
    console.error('Match reject error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
