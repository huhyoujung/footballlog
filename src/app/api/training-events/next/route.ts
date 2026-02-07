import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 다음 예정 이벤트 1건 (피드 배너용)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ event: null });
    }

    const event = await prisma.trainingEvent.findFirst({
      where: {
        teamId: session.user.teamId,
        date: { gte: new Date() },
      },
      include: {
        _count: { select: { rsvps: true } },
        rsvps: {
          where: { userId: session.user.id },
          select: { status: true },
          take: 1,
        },
      },
      orderBy: { date: "asc" },
    });

    if (!event) {
      return NextResponse.json({ event: null });
    }

    return NextResponse.json({
      event: {
        id: event.id,
        date: event.date,
        location: event.location,
        rsvpDeadline: event.rsvpDeadline,
        _count: event._count,
        myRsvp: event.rsvps[0]?.status || null,
      },
    });
  } catch (error) {
    console.error("다음 이벤트 조회 오류:", error);
    return NextResponse.json({ event: null });
  }
}
