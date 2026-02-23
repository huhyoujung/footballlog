import { NextResponse, after } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";

// RSVP 목록 조회
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

    const rsvps = await prisma.rsvp.findMany({
      where: { trainingEventId: id },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ rsvps });
  } catch (error) {
    console.error("RSVP 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// RSVP 응답 (upsert)
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    const { id } = await params;

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const event = await prisma.trainingEvent.findUnique({ where: { id }, include: { matchRules: true } });
    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "운동을 찾을 수 없습니다" }, { status: 404 });
    }

    // 마감 확인
    if (new Date() > event.rsvpDeadline) {
      return NextResponse.json({ error: "마감 시간이 지났습니다" }, { status: 400 });
    }

    const { status, reason } = await req.json();

    if (!["ATTEND", "ABSENT", "LATE"].includes(status)) {
      return NextResponse.json({ error: "올바른 응답을 선택해주세요" }, { status: 400 });
    }

    if ((status === "ABSENT" || status === "LATE") && !reason?.trim()) {
      return NextResponse.json({ error: "사유를 입력해주세요" }, { status: 400 });
    }

    // 이전 RSVP 상태 확인 (인원 충족 감지용)
    const prevRsvp = await prisma.rsvp.findUnique({
      where: { trainingEventId_userId: { trainingEventId: id, userId: session.user.id } },
      select: { status: true },
    });
    const wasAttend = prevRsvp?.status === "ATTEND";

    const rsvp = await prisma.rsvp.upsert({
      where: {
        trainingEventId_userId: {
          trainingEventId: id,
          userId: session.user.id,
        },
      },
      update: {
        status,
        reason: status === "ATTEND" ? null : reason?.trim(),
      },
      create: {
        trainingEventId: id,
        userId: session.user.id,
        status,
        reason: status === "ATTEND" ? null : reason?.trim(),
      },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    // 운영진에게 알림 + 친선경기 인원 충족 알림 (응답 이후 비동기 처리)
    const teamId = session.user.teamId;
    const userId = session.user.id;
    const userName = session.user.name || "팀원";
    const newlyAttend = status === "ATTEND" && !wasAttend;
    const isFriendlyDraft = event.isFriendlyMatch && event.matchStatus === "DRAFT";
    const matchRules = event.matchRules as { playersPerSide?: number } | null;
    const requiredPlayers = matchRules?.playersPerSide ?? event.minimumPlayers ?? 0;
    after(async () => {
      try {
        const admins = await prisma.user.findMany({
          where: { teamId, role: "ADMIN", id: { not: userId } },
          select: { id: true },
        });
        if (admins.length > 0) {
          const statusText = status === "ATTEND" ? "참석" : status === "LATE" ? "지각" : "불참";
          await sendPushToUsers(
            admins.map((a) => a.id),
            { title: "RSVP 응답", body: `${userName}님이 ${statusText}으로 응답했습니다`, url: `/training/${id}` }
          );
        }
      } catch {
        // 푸시 실패해도 무시
      }

      // 친선경기 DRAFT 상태에서 인원이 딱 충족된 순간 ATTEND 멤버 전원에게 알림
      if (newlyAttend && isFriendlyDraft && requiredPlayers > 0) {
        try {
          const attendCount = await prisma.rsvp.count({
            where: { trainingEventId: id, status: "ATTEND" },
          });
          if (attendCount === requiredPlayers) {
            const attendRsvps = await prisma.rsvp.findMany({
              where: { trainingEventId: id, status: "ATTEND" },
              select: { userId: true },
            });
            await sendPushToUsers(
              attendRsvps.map((r) => r.userId),
              {
                title: "인원 충족! ⚔️",
                body: "도전장을 보낼 준비가 됐어요. 지금 바로 도전장을 보내세요!",
                url: `/training/${id}`,
              }
            );
          }
        } catch {
          // 푸시 실패해도 무시
        }
      }
    });

    return NextResponse.json(rsvp);
  } catch (error) {
    console.error("RSVP 응답 오류:", error);
    return NextResponse.json({ error: "응답에 실패했습니다" }, { status: 500 });
  }
}
