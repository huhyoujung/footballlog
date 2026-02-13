import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/match-pairing/[id]/cancel - 친선경기 취소
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

    const { reason, convertToTraining } = await request.json();

    // TrainingEvent 조회
    const event = await prisma.trainingEvent.findUnique({
      where: { id: id },
      include: {
        linkedEvent: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (event.teamId !== user.teamId) {
      return NextResponse.json({ error: 'Not your team event' }, { status: 403 });
    }

    if (!event.isFriendlyMatch) {
      return NextResponse.json({ error: 'Not a friendly match' }, { status: 400 });
    }

    // 취소 처리
    if (convertToTraining) {
      // 팀 운동으로 전환
      await prisma.trainingEvent.update({
        where: { id: id },
        data: {
          isFriendlyMatch: false,
          linkedEventId: null,
          opponentTeamId: null,
          matchStatus: 'DRAFT',
          convertedFromMatch: true,
        },
      });

      // 상대팀 이벤트 삭제
      if (event.linkedEventId) {
        await prisma.trainingEvent.delete({
          where: { id: event.linkedEventId },
        });
      }

      return NextResponse.json({
        message: 'Converted to regular training',
        id,
      });
    } else {
      // 친선경기 취소 (양쪽 모두 취소 상태로 변경)
      const updates = [
        prisma.trainingEvent.update({
          where: { id: id },
          data: {
            matchStatus: 'CANCELLED',
            cancelled: true,
            cancellationReason: reason || 'OTHER',
          },
        }),
      ];

      if (event.linkedEventId) {
        updates.push(
          prisma.trainingEvent.update({
            where: { id: event.linkedEventId },
            data: {
              matchStatus: 'CANCELLED',
              cancelled: true,
              cancellationReason: reason || 'OTHER',
            },
          })
        );
      }

      await prisma.$transaction(updates);

      return NextResponse.json({
        message: 'Match cancelled',
        id,
        linkedEventId: event.linkedEventId,
      });
    }
  } catch (error) {
    console.error('Match cancel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
