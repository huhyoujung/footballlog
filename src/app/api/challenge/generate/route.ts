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

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: '운영진만 도전장을 보낼 수 있습니다' }, { status: 403 });
    }

    const { trainingEventId, responseDeadline } = await request.json();

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
      return NextResponse.json({ error: '본인 팀의 운동만 도전장을 보낼 수 있습니다' }, { status: 403 });
    }

    if (!event.isFriendlyMatch) {
      return NextResponse.json({ error: '친선경기만 도전장을 보낼 수 있습니다' }, { status: 400 });
    }

    if (event.matchStatus !== 'DRAFT') {
      return NextResponse.json({ error: '이미 매칭이 진행 중입니다' }, { status: 400 });
    }

    // 최소 인원 충족 여부 확인
    const requiredPlayers = event.matchRules?.playersPerSide ?? event.minimumPlayers ?? 0;
    if (requiredPlayers > 0 && event.rsvps.length < requiredPlayers) {
      return NextResponse.json(
        { error: `최소 ${requiredPlayers}명이 참석 확정되어야 도전장을 보낼 수 있습니다 (현재 ${event.rsvps.length}명)`, code: 'INSUFFICIENT_PLAYERS' },
        { status: 400 }
      );
    }

    const token = crypto.randomUUID();
    // responseDeadline이 있으면 사용, 없으면 30일 기본값
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

    const baseUrl = process.env.NEXTAUTH_URL || 'https://lockerroom.team';
    const challengeUrl = `${baseUrl}/invite/challenge/${token}`;

    return NextResponse.json({ token, challengeUrl, expiresAt });
  } catch (error) {
    console.error('Challenge generate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
