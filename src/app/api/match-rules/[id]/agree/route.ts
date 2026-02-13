import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/match-rules/[id]/agree - 친선경기 룰 합의
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

    // MatchRules 조회
    const rules = await prisma.matchRules.findUnique({
      where: { id: id },
      include: {
        trainingEvent: {
          include: {
            linkedEvent: true,
          },
        },
      },
    });

    if (!rules) {
      return NextResponse.json({ error: 'Rules not found' }, { status: 404 });
    }

    const event = rules.trainingEvent;

    // 호스트팀 또는 상대팀인지 확인
    const isHostTeam = event.teamId === user.teamId;
    const isOpponentTeam = event.linkedEvent?.teamId === user.teamId;

    if (!isHostTeam && !isOpponentTeam) {
      return NextResponse.json({ error: 'Not authorized for this match' }, { status: 403 });
    }

    // 합의 처리
    const updateData: any = {};
    if (isHostTeam) {
      updateData.agreedByTeamA = true;
    } else {
      updateData.agreedByTeamB = true;
    }

    const updatedRules = await prisma.matchRules.update({
      where: { id: id },
      data: updateData,
    });

    // 양팀 모두 합의했는지 확인
    const bothAgreed = updatedRules.agreedByTeamA && updatedRules.agreedByTeamB;

    if (bothAgreed) {
      // 양쪽 TrainingEvent 상태를 RULES_CONFIRMED로 업데이트
      await prisma.trainingEvent.update({
        where: { id: event.id },
        data: { matchStatus: 'RULES_CONFIRMED' },
      });

      if (event.linkedEventId) {
        await prisma.trainingEvent.update({
          where: { id: event.linkedEventId },
          data: { matchStatus: 'RULES_CONFIRMED' },
        });
      }
    }

    return NextResponse.json({
      ...updatedRules,
      bothAgreed,
    });
  } catch (error) {
    console.error('Match rules agree error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
