import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const userSelect = { id: true, name: true, image: true, position: true, number: true };

// 팀 운동 상세 조회
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const event = await prisma.trainingEvent.findUnique({
      where: { id },
      include: {
        createdBy: { select: userSelect },
        vestBringer: { select: userSelect },
        vestReceiver: { select: userSelect },
        rsvps: {
          include: { user: { select: userSelect } },
          orderBy: { createdAt: "asc" },
        },
        checkIns: {
          include: { user: { select: userSelect } },
          orderBy: { checkedInAt: "asc" },
        },
        lateFees: {
          include: { user: { select: userSelect } },
          orderBy: { createdAt: "asc" },
        },
        sessions: {
          include: {
            teamAssignments: {
              include: { user: { select: userSelect } },
            },
          },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!event) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    if (event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    const myRsvp = event.rsvps.find((r) => r.userId === session.user.id);
    const myCheckIn = event.checkIns.find((c) => c.userId === session.user.id);

    return NextResponse.json({
      ...event,
      myRsvp: myRsvp?.status || null,
      myCheckIn: myCheckIn?.checkedInAt || null,
    });
  } catch (error) {
    console.error("팀 운동 상세 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// 팀 운동 수정 (ADMIN)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 수정할 수 있습니다" }, { status: 403 });
    }

    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    const body = await req.json();

    const updated = await prisma.trainingEvent.update({
      where: { id },
      data: {
        ...(body.date && { date: new Date(body.date) }),
        ...(body.location && { location: body.location }),
        ...(body.uniform !== undefined && { uniform: body.uniform || null }),
        ...(body.vestBringerId !== undefined && { vestBringerId: body.vestBringerId || null }),
        ...(body.vestReceiverId !== undefined && { vestReceiverId: body.vestReceiverId || null }),
        ...(body.rsvpDeadline && { rsvpDeadline: new Date(body.rsvpDeadline) }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("팀 운동 수정 오류:", error);
    return NextResponse.json({ error: "수정에 실패했습니다" }, { status: 500 });
  }
}

// 팀 운동 삭제 (ADMIN)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 삭제할 수 있습니다" }, { status: 403 });
    }

    const event = await prisma.trainingEvent.findUnique({ where: { id } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    await prisma.trainingEvent.delete({ where: { id } });
    return NextResponse.json({ message: "삭제되었습니다" });
  } catch (error) {
    console.error("팀 운동 삭제 오류:", error);
    return NextResponse.json({ error: "삭제에 실패했습니다" }, { status: 500 });
  }
}
