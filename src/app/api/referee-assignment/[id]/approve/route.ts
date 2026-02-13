import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/referee-assignment/[id]/approve - 심판 배정 승인
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

    // RefereeAssignment 조회
    const assignment = await prisma.refereeAssignment.findUnique({
      where: { id: id },
      include: {
        trainingEvent: {
          include: {
            linkedEvent: true,
          },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    const event = assignment.trainingEvent;

    // 호스트팀 또는 상대팀인지 확인
    const isHostTeam = event.teamId === user.teamId;
    const isOpponentTeam = event.linkedEvent?.teamId === user.teamId;

    if (!isHostTeam && !isOpponentTeam) {
      return NextResponse.json({ error: 'Not authorized for this match' }, { status: 403 });
    }

    // 승인 처리
    const updateData: any = {};
    if (isHostTeam) {
      updateData.approvedByTeamA = true;
    } else {
      updateData.approvedByTeamB = true;
    }

    const updatedAssignment = await prisma.refereeAssignment.update({
      where: { id: id },
      data: updateData,
    });

    // 양팀 모두 승인했는지 확인
    const bothApproved = updatedAssignment.approvedByTeamA && updatedAssignment.approvedByTeamB;

    if (bothApproved) {
      // 상태를 CONFIRMED로 업데이트
      await prisma.refereeAssignment.update({
        where: { id: id },
        data: { status: 'CONFIRMED' },
      });
    }

    return NextResponse.json({
      ...updatedAssignment,
      bothApproved,
      status: bothApproved ? 'CONFIRMED' : 'PENDING_APPROVAL',
    });
  } catch (error) {
    console.error('Referee assignment approve error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
