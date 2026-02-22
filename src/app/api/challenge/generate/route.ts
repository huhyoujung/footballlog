import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import crypto from 'crypto';

// POST /api/challenge/generate - 도전장 토큰 생성
export async function POST(request: NextRequest) {
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
      return NextResponse.json({ error: '팀에 소속되어 있지 않습니다' }, { status: 400 });
    }

    const { trainingEventId, responseDeadline, quarterCount, quarterMinutes, quarterBreak, kickoffTime, quarterRefereeTeams } = await request.json();

    const event = await prisma.trainingEvent.findUnique({
      where: { id: trainingEventId },
      include: {
        matchRules: true,
        rsvps: { where: { status: 'ATTEND' } },
      },
    });

    if (!event) {
      return NextResponse.json({ error: '운동을 찾을 수 없습니다' }, { status: 404 });
    }

    if (event.teamId !== user.teamId) {
      return NextResponse.json({ error: '본인 팀의 운동만 접근할 수 있습니다' }, { status: 403 });
    }

    if (!event.isFriendlyMatch) {
      return NextResponse.json({ error: '친선경기만 도전장을 보낼 수 있습니다' }, { status: 400 });
    }

    // CONFIRMED 상태: 팀원 누구나 matchRules 업데이트 가능 (기록관 역할)
    if (event.matchStatus === 'CONFIRMED') {
      await prisma.matchRules.upsert({
        where: { trainingEventId: event.id },
        create: {
          trainingEventId: event.id,
          kickoffTime: kickoffTime ?? null,
          quarterCount: quarterCount ?? 4,
          quarterMinutes: quarterMinutes ?? 20,
          quarterBreak: quarterBreak ?? 5,
          quarterRefereeTeams: quarterRefereeTeams ?? null,
          playersPerSide: event.minimumPlayers ?? 0,
        },
        update: {
          ...(kickoffTime !== undefined && { kickoffTime }),
          ...(quarterCount !== undefined && { quarterCount }),
          ...(quarterMinutes !== undefined && { quarterMinutes }),
          ...(quarterBreak !== undefined && { quarterBreak }),
          ...(quarterRefereeTeams !== undefined && { quarterRefereeTeams }),
        },
      });
      return NextResponse.json({ token: event.challengeToken, saved: true });
    }

    // CHALLENGE_SENT면 기존 토큰 유지하고 matchRules만 업데이트
    if (event.matchStatus === 'CHALLENGE_SENT' && event.challengeToken) {
      const updatedExpiresAt = responseDeadline ? new Date(responseDeadline) : event.challengeTokenExpiresAt;
      await Promise.all([
        prisma.matchRules.upsert({
          where: { trainingEventId: event.id },
          create: {
            trainingEventId: event.id,
            kickoffTime: kickoffTime ?? null,
            quarterCount: quarterCount ?? 4,
            quarterMinutes: quarterMinutes ?? 20,
            quarterBreak: quarterBreak ?? 5,
            quarterRefereeTeams: quarterRefereeTeams ?? null,
            playersPerSide: event.minimumPlayers ?? 0,
          },
          update: {
            ...(kickoffTime !== undefined && { kickoffTime }),
            ...(quarterCount !== undefined && { quarterCount }),
            ...(quarterMinutes !== undefined && { quarterMinutes }),
            ...(quarterBreak !== undefined && { quarterBreak }),
            ...(quarterRefereeTeams !== undefined && { quarterRefereeTeams }),
            playersPerSide: event.minimumPlayers ?? 0,
          },
        }),
        responseDeadline && prisma.trainingEvent.update({
          where: { id: event.id },
          data: { challengeTokenExpiresAt: new Date(responseDeadline) },
        }),
      ]);
      const baseUrl = process.env.NEXTAUTH_URL || 'https://lockerroom.team';
      const challengeUrl = `${baseUrl}/invite/challenge/${event.challengeToken}`;
      return NextResponse.json({ token: event.challengeToken, challengeUrl, expiresAt: updatedExpiresAt });
    }

    if (event.matchStatus !== 'DRAFT') {
      return NextResponse.json({ error: '이미 확정된 경기입니다' }, { status: 400 });
    }

    const token = crypto.randomUUID();
    const expiresAt = responseDeadline
      ? new Date(responseDeadline)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    await prisma.trainingEvent.update({
      where: { id: trainingEventId },
      data: {
        challengeToken: token,
        challengeTokenExpiresAt: expiresAt,
        matchStatus: 'CHALLENGE_SENT',
      },
    });

    await prisma.matchRules.upsert({
      where: { trainingEventId: event.id },
      create: {
        trainingEventId: event.id,
        kickoffTime: kickoffTime ?? null,
        quarterCount: quarterCount ?? 4,
        quarterMinutes: quarterMinutes ?? 20,
        quarterBreak: quarterBreak ?? 5,
        quarterRefereeTeams: quarterRefereeTeams ?? null,
        playersPerSide: event.minimumPlayers ?? 0,
      },
      update: {
        kickoffTime: kickoffTime ?? null,
        quarterCount: quarterCount ?? 4,
        quarterMinutes: quarterMinutes ?? 20,
        quarterBreak: quarterBreak ?? 5,
        quarterRefereeTeams: quarterRefereeTeams ?? null,
        playersPerSide: event.minimumPlayers ?? 0,
      },
    });

    const baseUrl = process.env.NEXTAUTH_URL || 'https://lockerroom.team';
    const challengeUrl = `${baseUrl}/invite/challenge/${token}`;

    return NextResponse.json({ token, challengeUrl, expiresAt });
  } catch (error) {
    console.error('Challenge generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
