import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/match-pairing - 친선경기 매칭 요청
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { team: true },
    });

    if (!user?.teamId) {
      return NextResponse.json({ error: 'No team found' }, { status: 400 });
    }

    const { trainingEventId, opponentTeamId } = await request.json();

    // 호스트 팀의 TrainingEvent 조회
    const hostEvent = await prisma.trainingEvent.findUnique({
      where: { id: trainingEventId },
      include: { team: true },
    });

    if (!hostEvent) {
      return NextResponse.json({ error: 'Training event not found' }, { status: 404 });
    }

    if (hostEvent.teamId !== user.teamId) {
      return NextResponse.json({ error: 'Not your team event' }, { status: 403 });
    }

    if (!hostEvent.isFriendlyMatch) {
      return NextResponse.json({ error: 'Not a friendly match' }, { status: 400 });
    }

    // 이미 매칭 요청이 진행 중인지 확인
    if (hostEvent.matchStatus !== 'DRAFT') {
      return NextResponse.json({ error: '이미 매칭 요청이 진행 중입니다' }, { status: 400 });
    }

    // 자기 팀과 매칭하려는지 확인
    if (opponentTeamId === user.teamId) {
      return NextResponse.json({ error: '자기 팀과는 매칭할 수 없습니다' }, { status: 400 });
    }

    // 상대팀 조회
    const opponentTeam = await prisma.team.findUnique({
      where: { id: opponentTeamId },
    });

    if (!opponentTeam) {
      return NextResponse.json({ error: 'Opponent team not found' }, { status: 404 });
    }

    // 상대팀에 대응하는 TrainingEvent 생성
    const opponentEvent = await prisma.trainingEvent.create({
      data: {
        teamId: opponentTeamId,
        createdById: user.id, // 호스트팀이 요청했으므로
        title: `${hostEvent.team.name}과(와)의 친선경기`,
        isRegular: false,
        isFriendlyMatch: true,
        enablePomVoting: hostEvent.enablePomVoting,
        date: hostEvent.date,
        location: hostEvent.location,
        venueId: hostEvent.venueId,
        shoes: hostEvent.shoes,
        uniform: hostEvent.uniform,
        notes: `${hostEvent.team.name} 팀으로부터 친선경기 요청`,
        rsvpDeadline: hostEvent.rsvpDeadline,
        rsvpDeadlineOffset: hostEvent.rsvpDeadlineOffset,
        minimumPlayers: hostEvent.minimumPlayers,
        opponentTeamId: user.teamId,
        matchStatus: 'PENDING',
      },
    });

    // 호스트 이벤트 업데이트 (링크 연결)
    await prisma.trainingEvent.update({
      where: { id: trainingEventId },
      data: {
        linkedEventId: opponentEvent.id,
        opponentTeamId: opponentTeamId,
        matchStatus: 'PENDING',
      },
    });

    return NextResponse.json({
      hostEvent: hostEvent,
      opponentEvent: opponentEvent,
      message: 'Match pairing request sent',
    });
  } catch (error) {
    console.error('Match pairing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
