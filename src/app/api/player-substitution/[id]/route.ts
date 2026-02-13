import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

// DELETE /api/player-substitution/[id] - 교체 기록 삭제
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

    // PlayerSubstitution 조회
    const substitution = await prisma.playerSubstitution.findUnique({
      where: { id: id },
      include: {
        trainingEvent: {
          include: {
            team: true,
          },
        },
      },
    });

    if (!substitution) {
      return NextResponse.json({ error: 'Substitution not found' }, { status: 404 });
    }

    // 기록한 사람 또는 운영진만 삭제 가능
    const canDelete = substitution.recordedById === user.id || user.role === 'ADMIN';

    if (!canDelete) {
      return NextResponse.json({ error: 'Not authorized to delete this substitution' }, { status: 403 });
    }

    // 교체 기록 삭제
    await prisma.playerSubstitution.delete({
      where: { id: id },
    });

    return NextResponse.json({
      message: 'Substitution deleted',
    });
  } catch (error) {
    console.error('Delete substitution error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
