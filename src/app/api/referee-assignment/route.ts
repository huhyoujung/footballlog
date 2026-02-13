import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/referee-assignment - 심판 배정 생성/수정
export async function POST(request: NextRequest) {
  try {
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

    const { trainingEventId, referees } = await request.json();
    // referees: [{ quarter: 1, userId: 'xxx', teamSide: 'TEAM_A' }, ...]

    // TrainingEvent 조회
    const event = await prisma.trainingEvent.findUnique({
      where: { id: trainingEventId },
      include: {
        linkedEvent: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    // 호스트팀 또는 상대팀인지 확인
    const isHostTeam = event.teamId === user.teamId;
    const isOpponentTeam = event.linkedEvent?.teamId === user.teamId;

    if (!isHostTeam && !isOpponentTeam) {
      return NextResponse.json({ error: 'Not authorized for this match' }, { status: 403 });
    }

    // 기존 배정이 있는지 확인
    const existingAssignment = await prisma.refereeAssignment.findUnique({
      where: { trainingEventId: event.id },
      include: { quarterReferees: true },
    });

    if (existingAssignment) {
      // 기존 쿼터 심판 삭제 후 새로 생성
      await prisma.quarterReferee.deleteMany({
        where: { assignmentId: existingAssignment.id },
      });

      const quarterReferees = referees.map((ref: any) => ({
        assignmentId: existingAssignment.id,
        quarter: ref.quarter,
        userId: ref.userId,
        teamSide: ref.teamSide,
      }));

      await prisma.quarterReferee.createMany({
        data: quarterReferees,
      });

      // 수정하면 합의 상태 리셋
      const updatedAssignment = await prisma.refereeAssignment.update({
        where: { id: existingAssignment.id },
        data: {
          status: 'PENDING_APPROVAL',
          approvedByTeamA: isHostTeam,
          approvedByTeamB: isOpponentTeam,
        },
        include: { quarterReferees: true },
      });

      return NextResponse.json(updatedAssignment);
    } else {
      // 새 배정 생성
      const newAssignment = await prisma.refereeAssignment.create({
        data: {
          trainingEventId: event.id,
          status: 'DRAFT',
          approvedByTeamA: isHostTeam,
          approvedByTeamB: isOpponentTeam,
          quarterReferees: {
            create: referees.map((ref: any) => ({
              quarter: ref.quarter,
              userId: ref.userId,
              teamSide: ref.teamSide,
            })),
          },
        },
        include: { quarterReferees: true },
      });

      return NextResponse.json(newAssignment);
    }
  } catch (error) {
    console.error('Referee assignment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/referee-assignment?trainingEventId=xxx - 심판 배정 조회
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

    const assignment = await prisma.refereeAssignment.findUnique({
      where: { trainingEventId },
      include: {
        quarterReferees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                image: true,
              },
            },
          },
          orderBy: { quarter: 'asc' },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });
    }

    return NextResponse.json(assignment);
  } catch (error) {
    console.error('Get referee assignment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
