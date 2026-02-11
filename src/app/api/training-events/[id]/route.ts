import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

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

    // 기본 정보만 로드 (빠른 응답)
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

    // 조끼 당번 수정 시, 이후 운동에서 이미 설정되어 있으면 수정 불가
    if (body.vestBringerId !== undefined || body.vestReceiverId !== undefined) {
      const laterEventWithVest = await prisma.trainingEvent.findFirst({
        where: {
          teamId: event.teamId,
          date: { gt: event.date },
          OR: [
            { vestBringerId: { not: null } },
            { vestReceiverId: { not: null } },
          ],
        },
        orderBy: { date: "asc" },
      });

      if (laterEventWithVest) {
        return NextResponse.json(
          { error: "이후 운동에 조끼 당번이 설정되어 있어 수정할 수 없습니다" },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.trainingEvent.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.isRegular !== undefined && { isRegular: body.isRegular }),
        ...(body.enablePomVoting !== undefined && { enablePomVoting: body.enablePomVoting }),
        ...(body.pomVotingDeadline !== undefined && { pomVotingDeadline: body.pomVotingDeadline ? new Date(body.pomVotingDeadline) : null }),
        ...(body.pomVotesPerPerson !== undefined && { pomVotesPerPerson: body.pomVotesPerPerson }),
        ...(body.date && { date: new Date(body.date) }),
        ...(body.location && { location: body.location }),
        ...(body.shoes !== undefined && { shoes: Array.isArray(body.shoes) ? body.shoes : [] }),
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.uniform !== undefined && { uniform: body.uniform || null }),
        ...(body.vestBringerId !== undefined && { vestBringerId: body.vestBringerId || null }),
        ...(body.vestReceiverId !== undefined && { vestReceiverId: body.vestReceiverId || null }),
        ...(body.rsvpDeadline && { rsvpDeadline: new Date(body.rsvpDeadline) }),
      },
    });

    // 조끼 담당자가 변경된 경우 푸시 알림 발송
    try {
      const vestNotifyIds: string[] = [];
      const newBringerId = body.vestBringerId !== undefined ? body.vestBringerId : null;
      const newReceiverId = body.vestReceiverId !== undefined ? body.vestReceiverId : null;

      // 이전 담당자와 다르고, 새로 지정된 경우만 알림 (null이 아닌 경우)
      if (newBringerId && newBringerId !== event.vestBringerId) {
        vestNotifyIds.push(newBringerId);
      }
      if (newReceiverId && newReceiverId !== event.vestReceiverId) {
        vestNotifyIds.push(newReceiverId);
      }

      if (vestNotifyIds.length > 0) {
        // 날짜 포맷 (수정된 날짜 또는 기존 날짜)
        const eventDate = body.date ? new Date(body.date) : event.date;
        const dateStr = eventDate.toLocaleDateString("ko-KR", {
          month: "numeric",
          day: "numeric",
          weekday: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

        // 가져오는 사람과 가져가는 사람이 같으면 한 번만 알림
        const uniqueIds = [...new Set(vestNotifyIds)];

        for (const userId of uniqueIds) {
          const isBringer = userId === newBringerId;
          const isReceiver = userId === newReceiverId;

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
            url: `/training/${id}`,
          });
        }
      }
    } catch {
      // 푸시 실패해도 수정은 성공
    }

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
