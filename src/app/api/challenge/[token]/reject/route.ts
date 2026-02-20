import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// POST /api/challenge/[token]/reject - 도전장 거절
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
      return NextResponse.json({ error: '팀에 소속된 후 거절할 수 있습니다' }, { status: 400 });
    }

    if (user.role !== 'ADMIN') {
      return NextResponse.json({ error: '운영진만 도전장을 거절할 수 있습니다' }, { status: 403 });
    }

    const { token } = await params;
    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    const hostEvent = await prisma.trainingEvent.findUnique({
      where: { challengeToken: token },
      include: { team: true },
    });

    if (!hostEvent) {
      return NextResponse.json({ error: '유효하지 않은 도전장입니다', code: 'NOT_FOUND' }, { status: 404 });
    }

    if (hostEvent.challengeTokenExpiresAt && hostEvent.challengeTokenExpiresAt < new Date()) {
      return NextResponse.json({ error: '도전장이 만료되었습니다', code: 'EXPIRED' }, { status: 410 });
    }

    if (hostEvent.matchStatus !== 'CHALLENGE_SENT') {
      return NextResponse.json({ error: '수락 대기 중인 도전장이 아닙니다' }, { status: 409 });
    }

    if (hostEvent.teamId === user.teamId) {
      return NextResponse.json({ error: '자신의 팀 도전장은 거절할 수 없습니다' }, { status: 400 });
    }

    // 호스트 이벤트 → CANCELLED, 거절 사유 저장
    await prisma.trainingEvent.update({
      where: { id: hostEvent.id },
      data: {
        matchStatus: 'CANCELLED',
        challengeToken: null,
        challengeTokenExpiresAt: null,
        challengeRejectionReason: reason || null,
        cancellationReason: 'OTHER',
      },
    });

    return NextResponse.json({ message: '도전장을 거절했습니다' });
  } catch (error) {
    console.error('Challenge reject error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
