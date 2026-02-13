import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/match-rules - 친선경기 룰 생성/수정
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

    const {
      trainingEventId,
      template,
      quarterCount,
      quarterMinutes,
      quarterBreak,
      halftime,
      playersPerSide,
      allowBackpass,
      allowOffside,
    } = await request.json();

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

    // 기존 룰이 있는지 확인
    const existingRules = await prisma.matchRules.findUnique({
      where: { trainingEventId: event.id },
    });

    if (existingRules) {
      // 기존 룰 업데이트 (합의 상태 리셋)
      const updatedRules = await prisma.matchRules.update({
        where: { trainingEventId: event.id },
        data: {
          template,
          quarterCount,
          quarterMinutes,
          quarterBreak,
          halftime,
          playersPerSide,
          allowBackpass,
          allowOffside,
          // 수정하면 양팀 합의 리셋
          agreedByTeamA: isHostTeam,
          agreedByTeamB: isOpponentTeam,
        },
      });

      return NextResponse.json(updatedRules);
    } else {
      // 새 룰 생성
      const newRules = await prisma.matchRules.create({
        data: {
          trainingEventId: event.id,
          template,
          quarterCount,
          quarterMinutes,
          quarterBreak,
          halftime,
          playersPerSide,
          allowBackpass,
          allowOffside,
          agreedByTeamA: isHostTeam,
          agreedByTeamB: isOpponentTeam,
        },
      });

      // 양쪽 TrainingEvent 상태 업데이트
      await prisma.trainingEvent.update({
        where: { id: event.id },
        data: { matchStatus: 'RULES_PENDING' },
      });

      if (event.linkedEventId) {
        await prisma.trainingEvent.update({
          where: { id: event.linkedEventId },
          data: { matchStatus: 'RULES_PENDING' },
        });
      }

      return NextResponse.json(newRules);
    }
  } catch (error) {
    console.error('Match rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET /api/match-rules?trainingEventId=xxx - 친선경기 룰 조회
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

    const rules = await prisma.matchRules.findUnique({
      where: { trainingEventId },
    });

    if (!rules) {
      return NextResponse.json({ error: 'Rules not found' }, { status: 404 });
    }

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Get match rules error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
