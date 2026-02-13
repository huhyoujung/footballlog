import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { recalculateMatchScore, updateMatchScore } from '@/lib/match-helpers';

// DELETE /api/match-score/[id] - 득점 기록 삭제
export async function DELETE(
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

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // GoalRecord 조회
    const goal = await prisma.goalRecord.findUnique({
      where: { id: id },
      include: {
        trainingEvent: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!goal) {
      return NextResponse.json({ error: 'Goal not found' }, { status: 404 });
    }

    // 기록한 사람 또는 운영진만 삭제 가능
    const canDelete = goal.recordedById === user.id || user.role === 'ADMIN';

    if (!canDelete) {
      return NextResponse.json({ error: 'Not authorized to delete this goal' }, { status: 403 });
    }

    const trainingEventId = goal.trainingEventId;
    const linkedEventId = goal.trainingEvent.linkedEventId;

    // 득점 삭제
    await prisma.goalRecord.delete({
      where: { id: id },
    });

    // 총점 재계산 및 업데이트
    await updateMatchScore(trainingEventId, linkedEventId);
    const { teamAScore, teamBScore } = await recalculateMatchScore(trainingEventId);

    return NextResponse.json({
      message: 'Goal deleted',
      teamAScore,
      teamBScore,
    });
  } catch (error) {
    console.error('Delete goal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
