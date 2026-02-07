import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToTeam } from "@/lib/push";

// 정기운동 목록 조회
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const filter = searchParams.get("filter") || "upcoming";

    const now = new Date();
    const events = await prisma.trainingEvent.findMany({
      where: {
        teamId: session.user.teamId,
        ...(filter === "upcoming" ? { date: { gte: now } } : { date: { lt: now } }),
      },
      include: {
        createdBy: { select: { id: true, name: true } },
        vestBringer: { select: { id: true, name: true } },
        vestReceiver: { select: { id: true, name: true } },
        _count: { select: { rsvps: true } },
        rsvps: {
          where: { userId: session.user.id },
          select: { status: true },
          take: 1,
        },
      },
      orderBy: { date: filter === "upcoming" ? "asc" : "desc" },
      take: 20,
    });

    const result = events.map((e) => ({
      ...e,
      myRsvp: e.rsvps[0]?.status || null,
      rsvps: undefined,
    }));

    return NextResponse.json({ events: result });
  } catch (error) {
    console.error("정기운동 목록 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// 정기운동 생성 (ADMIN)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 생성할 수 있습니다" }, { status: 403 });
    }

    const { title, isRegular, date, location, uniform, vestBringerId, vestReceiverId, rsvpDeadline } =
      await req.json();

    if (!title || !date || !location || !rsvpDeadline) {
      return NextResponse.json({ error: "필수 항목을 입력해주세요" }, { status: 400 });
    }

    const event = await prisma.trainingEvent.create({
      data: {
        teamId: session.user.teamId,
        createdById: session.user.id,
        title,
        isRegular: isRegular ?? true,
        date: new Date(date),
        location,
        uniform: uniform || null,
        vestBringerId: vestBringerId || null,
        vestReceiverId: vestReceiverId || null,
        rsvpDeadline: new Date(rsvpDeadline),
      },
    });

    // 푸시 알림
    const dateStr = new Date(date).toLocaleDateString("ko-KR", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

    try {
      await sendPushToTeam(session.user.teamId, session.user.id, {
        title: "운동 공고",
        body: `운동 공고가 올라왔어요! ${dateStr}`,
        url: `/training/${event.id}`,
      });
    } catch {
      // 푸시 실패해도 생성은 성공
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("정기운동 생성 오류:", error);
    const msg = error instanceof Error ? error.message : "생성에 실패했습니다";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
