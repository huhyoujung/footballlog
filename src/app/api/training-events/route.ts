import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToTeam, sendPushToUsers } from "@/lib/push";

// 구장 신발 추천 업데이트 (최근 1회 데이터 기반)
async function updateVenueRecommendation(venueId: string, currentShoes: string[]) {
  // 구장 업데이트: 현재 신발을 그대로 추천 신발로 설정
  await prisma.venue.update({
    where: { id: venueId },
    data: {
      recommendedShoes: currentShoes.length > 0 ? currentShoes : [],
      usageCount: { increment: 1 },
    },
  });
}

// 팀 운동 목록 조회
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
    console.error("팀 운동 목록 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// 팀 운동 생성 (ADMIN)
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 생성할 수 있습니다" }, { status: 403 });
    }

    const { title, isRegular, date, location, shoes, uniform, notes, vestBringerId, vestReceiverId, rsvpDeadline } =
      await req.json();

    if (!title || !date || !location || !rsvpDeadline) {
      return NextResponse.json({ error: "필수 항목을 입력해주세요" }, { status: 400 });
    }

    // 구장 찾기 또는 생성
    let venueId: string | null = null;
    if (location && location.trim()) {
      let venue = await prisma.venue.findUnique({
        where: {
          teamId_name: {
            teamId: session.user.teamId,
            name: location.trim(),
          },
        },
      });

      if (!venue) {
        // 새 구장 생성
        venue = await prisma.venue.create({
          data: {
            teamId: session.user.teamId,
            name: location.trim(),
            recommendedShoes: Array.isArray(shoes) ? shoes : [],
            usageCount: 1,
          },
        });
      } else {
        // 기존 구장: 사용 횟수 증가 + 신발 추천 업데이트
        await updateVenueRecommendation(venue.id, Array.isArray(shoes) ? shoes : []);
      }
      venueId = venue.id;
    }

    const event = await prisma.trainingEvent.create({
      data: {
        teamId: session.user.teamId,
        createdById: session.user.id,
        title,
        isRegular: isRegular ?? true,
        date: new Date(date),
        location,
        venueId,
        shoes: Array.isArray(shoes) ? shoes : [],
        uniform: uniform || null,
        notes: notes || null,
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
      // 팀 전체에게 새 운동 알림
      await sendPushToTeam(session.user.teamId, session.user.id, {
        title: "팀 운동",
        body: `새 운동이 올라왔어요! ${dateStr}`,
        url: `/training/${event.id}`,
      });
    } catch {
      // 푸시 실패해도 생성은 성공
    }

    // 조끼 담당자에게 개별 알림
    try {
      const vestNotifyIds: string[] = [];
      if (vestBringerId) vestNotifyIds.push(vestBringerId);
      if (vestReceiverId) vestNotifyIds.push(vestReceiverId);

      if (vestNotifyIds.length > 0) {
        // 가져오는 사람과 가져가는 사람이 같으면 한 번만 알림
        const uniqueIds = [...new Set(vestNotifyIds)];

        for (const userId of uniqueIds) {
          const isBringer = userId === vestBringerId;
          const isReceiver = userId === vestReceiverId;

          let message = "";
          if (isBringer && isReceiver) {
            message = "조끼를 가져오고 가져가주세요!";
          } else if (isBringer) {
            message = "조끼를 가져와주세요!";
          } else {
            message = "조끼를 가져가주세요!";
          }

          await sendPushToUsers([userId], {
            title: "조끼 담당",
            body: `${message} ${dateStr}`,
            url: `/training/${event.id}`,
          });
        }
      }
    } catch {
      // 푸시 실패해도 생성은 성공
    }

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("팀 운동 생성 오류:", error);
    const msg = error instanceof Error ? error.message : "생성에 실패했습니다";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
