import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/challenge/[token]/accept - 도전장 수락
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, teamId: true, role: true },
    });

    if (!user?.teamId) {
      return NextResponse.json(
        { error: '팀에 소속된 후 수락할 수 있습니다', code: 'NO_TEAM' },
        { status: 400 }
      );
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: '운영진만 도전장을 수락할 수 있습니다' }, { status: 403 });
    }

    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const { message } = body;

    const hostEvent = await prisma.trainingEvent.findUnique({
      where: { challengeToken: token },
      include: {
        team: true,
        matchRules: true,
        rsvps: { where: { status: 'ATTEND' } },
      },
    });

    if (!hostEvent) {
      return NextResponse.json(
        { error: '유효하지 않은 도전장입니다', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // 토큰 만료 확인
    if (hostEvent.challengeTokenExpiresAt && hostEvent.challengeTokenExpiresAt < new Date()) {
      // lazy expiration: 만료 시 상태 업데이트
      await prisma.trainingEvent.update({
        where: { id: hostEvent.id },
        data: { matchStatus: 'CANCELLED', challengeToken: null, challengeTokenExpiresAt: null },
      });
      return NextResponse.json(
        { error: '도전장이 만료되었습니다', code: 'EXPIRED' },
        { status: 410 }
      );
    }

    if (hostEvent.matchStatus !== 'CHALLENGE_SENT') {
      return NextResponse.json(
        { error: '이미 매칭이 진행 중입니다', code: 'ALREADY_MATCHED' },
        { status: 409 }
      );
    }

    if (hostEvent.teamId === user.teamId) {
      return NextResponse.json(
        { error: '자신의 팀에는 도전장을 수락할 수 없습니다', code: 'SAME_TEAM' },
        { status: 400 }
      );
    }

    // 상대팀 최소 인원 충족 여부 확인
    const requiredPlayers = hostEvent.matchRules?.playersPerSide ?? hostEvent.minimumPlayers ?? 0;
    if (requiredPlayers > 0) {
      const opponentAttendCount = await prisma.rsvp.count({
        where: {
          trainingEvent: { teamId: user.teamId, isFriendlyMatch: true },
          status: 'ATTEND',
        },
      });

      // 상대팀 이벤트가 아직 없으니 linkedEvent의 rsvp를 확인할 수 없음
      // 대신 수락 시점에 인원 확인을 위해 별도 쿼리
      const guestEvent = await prisma.trainingEvent.findFirst({
        where: {
          teamId: user.teamId,
          date: hostEvent.date,
          isFriendlyMatch: true,
          matchStatus: 'DRAFT',
        },
        include: { rsvps: { where: { status: 'ATTEND' } } },
      });

      if (guestEvent && guestEvent.rsvps.length < requiredPlayers) {
        return NextResponse.json(
          { error: `최소 ${requiredPlayers}명이 참석 확정되어야 수락할 수 있습니다 (현재 ${guestEvent.rsvps.length}명)`, code: 'INSUFFICIENT_PLAYERS' },
          { status: 400 }
        );
      }
    }

    // 상대팀 이벤트 생성 + 호스트 이벤트 링크 연결
    const opponentEvent = await prisma.trainingEvent.create({
      data: {
        teamId: user.teamId,
        createdById: user.id,
        title: `${hostEvent.team.name}과(와)의 친선경기`,
        isRegular: false,
        isFriendlyMatch: true,
        enablePomVoting: hostEvent.enablePomVoting,
        date: hostEvent.date,
        location: hostEvent.location,
        venueId: hostEvent.venueId,
        shoes: hostEvent.shoes,
        uniform: hostEvent.uniform,
        notes: message || `${hostEvent.team.name} 팀의 도전장을 수락`,
        rsvpDeadline: hostEvent.rsvpDeadline,
        rsvpDeadlineOffset: hostEvent.rsvpDeadlineOffset,
        minimumPlayers: hostEvent.minimumPlayers,
        opponentTeamId: hostEvent.teamId,
        matchStatus: 'CONFIRMED',
      },
    });

    // 호스트 이벤트 업데이트
    await prisma.trainingEvent.update({
      where: { id: hostEvent.id },
      data: {
        linkedEventId: opponentEvent.id,
        opponentTeamId: user.teamId,
        matchStatus: 'CONFIRMED',
        challengeToken: null,
        challengeTokenExpiresAt: null,
      },
    });

    return NextResponse.json({
      opponentEventId: opponentEvent.id,
      hostEventId: hostEvent.id,
      message: '도전장을 수락했습니다',
    });
  } catch (error) {
    console.error('Challenge accept error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
