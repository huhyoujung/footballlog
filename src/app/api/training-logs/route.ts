import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToTeam } from "@/lib/push";
import { parseMentions } from "@/lib/mention";

// 운동 일지 목록 조회 (같은 팀만)
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    if (!session.user.teamId) {
      return NextResponse.json({ error: "팀에 소속되어 있지 않습니다" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10")));
    const userId = searchParams.get("userId");
    const skip = (page - 1) * limit;

    // 같은 팀의 운동 일지만 조회 (userId 필터 옵션)
    const whereClause: any = {
      user: {
        teamId: session.user.teamId,
      },
    };

    if (userId) {
      whereClause.userId = userId;
    }

    const [logs, total] = await Promise.all([
      prisma.trainingLog.findMany({
        where: whereClause,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              image: true,
              position: true,
              number: true,
            },
          },
          trainingEvent: {
            select: {
              id: true,
              title: true,
              date: true,
            },
          },
          _count: {
            select: {
              comments: true,
              likes: true,
            },
          },
          likes: {
            where: {
              userId: session.user.id,
            },
            select: {
              id: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        skip,
        take: limit,
      }),
      prisma.trainingLog.count({
        where: whereClause,
      }),
    ]);

    // MVP 판별: trainingEventId 직접 연결 + 날짜 기반 자동 매칭
    const directEventIds = [...new Set(logs.map((l) => l.trainingEventId).filter(Boolean))] as string[];

    // trainingEventId가 없는 로그 → 날짜로 이벤트 자동 매칭
    const logsWithoutEvent = logs.filter((l) => !l.trainingEventId);
    const dateToEventId: Record<string, string> = {};

    if (logsWithoutEvent.length > 0) {
      const uniqueDates = [...new Set(logsWithoutEvent.map((l) => {
        const d = new Date(l.trainingDate);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }))];

      for (const dateStr of uniqueDates) {
        const dayStart = new Date(dateStr + "T00:00:00.000Z");
        const dayEnd = new Date(dateStr + "T23:59:59.999Z");
        const event = await prisma.trainingEvent.findFirst({
          where: {
            teamId: session.user.teamId!,
            date: { gte: dayStart, lte: dayEnd },
          },
          select: { id: true },
        });
        if (event) dateToEventId[dateStr] = event.id;
      }
    }

    // 날짜 매칭으로 찾은 이벤트 ID도 합산
    const allEventIds = [...new Set([...directEventIds, ...Object.values(dateToEventId)])];
    const mvpUserIdByEvent: Record<string, string> = {};

    if (allEventIds.length > 0) {
      const pomVotes = await prisma.pomVote.findMany({
        where: { trainingEventId: { in: allEventIds } },
        select: { trainingEventId: true, nomineeId: true },
      });

      // 이벤트별 최다 득표자 계산
      const countMap: Record<string, Record<string, number>> = {};
      for (const v of pomVotes) {
        if (!countMap[v.trainingEventId]) countMap[v.trainingEventId] = {};
        countMap[v.trainingEventId][v.nomineeId] = (countMap[v.trainingEventId][v.nomineeId] || 0) + 1;
      }
      for (const [eventId, nominees] of Object.entries(countMap)) {
        const sorted = Object.entries(nominees).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) mvpUserIdByEvent[eventId] = sorted[0][0];
      }
    }

    // 로그별 매칭된 이벤트 ID 결정 (직접 연결 우선, 없으면 날짜 매칭)
    const getEventIdForLog = (log: typeof logs[0]) => {
      if (log.trainingEventId) return log.trainingEventId;
      const d = new Date(log.trainingDate);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return dateToEventId[dateStr] || null;
    };

    const logsWithLikeStatus = logs.map((log) => {
      const matchedEventId = getEventIdForLog(log);
      return {
        ...log,
        isLiked: log.likes.length > 0,
        isMvp: !!(matchedEventId && mvpUserIdByEvent[matchedEventId] === log.userId),
        eventHasMvp: !!(matchedEventId && mvpUserIdByEvent[matchedEventId]),
        likes: undefined,
      };
    });

    return NextResponse.json({
      logs: logsWithLikeStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("운동 일지 조회 오류:", error);
    return NextResponse.json(
      { error: "운동 일지 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}

// 운동 일지 작성
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    if (!session.user.teamId) {
      return NextResponse.json({ error: "팀에 소속되어 있지 않습니다" }, { status: 400 });
    }

    const { trainingEventId, title, trainingDate, condition, conditionReason, keyPoints, improvement, notes, imageUrl } =
      await req.json();

    // 유효성 검사
    if (!trainingDate) {
      return NextResponse.json({ error: "운동 날짜를 입력해주세요" }, { status: 400 });
    }

    if (condition === undefined || condition < 0 || condition > 10) {
      return NextResponse.json(
        { error: "컨디션은 0~10 사이여야 합니다" },
        { status: 400 }
      );
    }

    if (!conditionReason?.trim()) {
      return NextResponse.json(
        { error: "컨디션 이유를 입력해주세요" },
        { status: 400 }
      );
    }

    if (!keyPoints?.trim()) {
      return NextResponse.json(
        { error: "운동 핵심 포인트를 입력해주세요" },
        { status: 400 }
      );
    }

    if (!improvement?.trim()) {
      return NextResponse.json(
        { error: "개선점을 입력해주세요" },
        { status: 400 }
      );
    }

    // 팀원 목록 조회 (멘션 파싱용)
    const teamMembers = await prisma.user.findMany({
      where: { teamId: session.user.teamId },
      select: { id: true, name: true },
    });

    // @멘션 파싱 (컨디션이유, 메모, 핵심포인트, 개선점 모두 포함)
    const combinedText = `${conditionReason} ${notes || ""} ${keyPoints} ${improvement}`;
    const taggedUserIds = parseMentions(combinedText, teamMembers);

    const log = await prisma.trainingLog.create({
      data: {
        userId: session.user.id,
        ...(trainingEventId && { trainingEventId }),
        ...(title && { title }),
        trainingDate: new Date(trainingDate),
        condition,
        conditionReason: conditionReason.trim(),
        keyPoints: keyPoints.trim(),
        improvement: improvement.trim(),
        ...(notes && { notes: notes.trim() }),
        ...(imageUrl && { imageUrl }),
        ...(taggedUserIds.length > 0 && {
          taggedUsers: {
            connect: taggedUserIds.map((id) => ({ id })),
          },
        }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    // 팀원들에게 푸시 알림 (비동기, 실패해도 응답에 영향 없음)
    sendPushToTeam(session.user.teamId, session.user.id, {
      title: "새 운동 일지",
      body: `${session.user.name || "팀원"}님이 운동 일지를 올렸어요!`,
      url: `/log/${log.id}`,
    }).catch(() => {});

    // 태그된 사람들에게 개별 알림 발송
    if (taggedUserIds.length > 0) {
      const { sendPushToUsers } = await import("@/lib/push");
      sendPushToUsers(taggedUserIds, {
        title: "📢 훈련 일지에 언급되셨어요",
        body: `${session.user.name || "팀원"}님이 운동 일지에서 회원님을 언급했습니다`,
        url: `/log/${log.id}`,
      }).catch(() => {});
    }

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("운동 일지 작성 오류:", error);
    return NextResponse.json(
      { error: "운동 일지 작성에 실패했습니다" },
      { status: 500 }
    );
  }
}
