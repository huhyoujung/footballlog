// POM(Player of the Match) 투표 API - 조회 및 다중 투표 처리
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendPushToUsers } from "@/lib/push";
import { isPomVotingClosed } from "@/lib/pom";

// POM 투표 결과 조회
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
      select: {
        date: true,
        teamId: true,
        pomVotesPerPerson: true,
        pomVotingDeadline: true,
        pomPushSentAt: true,
        team: { select: { name: true } },
      },
    });

    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 투표 결과 집계
    const votes = await prisma.pomVote.findMany({
      where: { trainingEventId: id },
      include: {
        voter: { select: { id: true, name: true, image: true } },
        nominee: { select: { id: true, name: true, image: true, position: true, number: true } },
      },
    });

    // 득표수 집계
    const voteCounts: Record<string, { user: any; votes: any[]; count: number }> = {};
    for (const vote of votes) {
      if (!voteCounts[vote.nomineeId]) {
        voteCounts[vote.nomineeId] = {
          user: vote.nominee,
          votes: [],
          count: 0,
        };
      }
      voteCounts[vote.nomineeId].votes.push({
        voter: vote.voter,
        reason: vote.reason,
        tags: vote.tags,
        createdAt: vote.createdAt,
      });
      voteCounts[vote.nomineeId].count++;
    }

    // 득표순 정렬
    const results = Object.values(voteCounts).sort((a, b) => b.count - a.count);

    // 내 투표 목록 (다중 투표 지원)
    const myVotes = votes
      .filter((v) => v.voterId === session.user.id)
      .map((v) => ({
        nomineeId: v.nomineeId,
        nomineeName: v.nominee.name,
        reason: v.reason,
        tags: v.tags,
      }));

    // MVP 푸시 알림 (lazy trigger: 마감 후 첫 조회 시 1회 발송)
    const isClosed = isPomVotingClosed(
      event.date.toISOString(),
      event.pomVotingDeadline?.toISOString() ?? null
    );

    if (isClosed && !event.pomPushSentAt && results.length > 0) {
      // 원자적 check-and-set (race condition 방지)
      const updated = await prisma.trainingEvent.updateMany({
        where: { id, pomPushSentAt: null },
        data: { pomPushSentAt: new Date() },
      });

      if (updated.count > 0) {
        // 1위 선수들 (공동 포함)
        const topCount = results[0].count;
        const mvps = results.filter((r) => r.count === topCount);
        const mvpIds = mvps.map((r) => r.user.id);

        // MVP 당선 알림
        await Promise.allSettled(
          mvps.map((mvp) =>
            sendPushToUsers([mvp.user.id], {
              title: mvpIds.length > 1 ? "🏆 공동 MVP!" : "🏆 오늘의 MVP는 당신!",
              body:
                mvpIds.length > 1
                  ? "팀원들이 선택한 오늘의 영웅 중 한 명이에요 😍"
                  : `${mvp.count}명의 팀원이 선택했어요. 이미 알고 있었죠? 😏`,
              url: `/training/${id}`,
            })
          )
        );

        // 투표 적중 알림 (MVP에게 투표한 사람, MVP 본인 제외)
        const mvpVoterIds = votes
          .filter((v) => mvpIds.includes(v.nomineeId) && !mvpIds.includes(v.voterId))
          .map((v) => v.voterId);

        const uniqueVoterIds = [...new Set(mvpVoterIds)];

        if (uniqueVoterIds.length > 0) {
          const mvpNames = mvps.map((m) => m.user.name || "팀원").join(", ");
          await sendPushToUsers(uniqueVoterIds, {
            title: "👀 보는 눈이 있으시네요!",
            body: `${mvpNames}님이 오늘 MVP가 됐어요. 탁월한 안목이에요 🎯`,
            url: `/training/${id}`,
          });
        }
      }
    }

    return NextResponse.json({
      results,
      totalVotes: votes.length,
      pomVotesPerPerson: event.pomVotesPerPerson,
      eventDate: event.date,
      teamName: event.team.name,
      myVotes,
      // 하위 호환: 기존 myVote 필드 유지
      myVote: myVotes.length > 0 ? myVotes[0] : null,
    });
  } catch (error) {
    console.error("POM 결과 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// POM 투표하기 (다중 투표 지원)
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

    const body = await req.json();

    // 다중 투표: nominees 배열 지원, 단일 nomineeId도 하위 호환
    let nominees: { nomineeId: string; reason: string; tags?: string[] }[];
    if (Array.isArray(body.nominees)) {
      nominees = body.nominees;
    } else if (body.nomineeId) {
      nominees = [{ nomineeId: body.nomineeId, reason: body.reason, tags: body.tags }];
    } else {
      return NextResponse.json({ error: "선수를 선택해주세요" }, { status: 400 });
    }

    // 유효성 검사
    for (const n of nominees) {
      if (!n.nomineeId || !n.reason || n.reason.trim().length === 0) {
        return NextResponse.json({ error: "모든 선수에 대해 이유를 입력해주세요" }, { status: 400 });
      }
      if (!Array.isArray(n.tags) || n.tags.length === 0) {
        return NextResponse.json({ error: "스탯 태그를 1개 이상 선택해주세요" }, { status: 400 });
      }
      if (n.nomineeId === session.user.id) {
        return NextResponse.json({ error: "본인에게는 투표할 수 없습니다" }, { status: 400 });
      }
    }

    // 중복 선수 체크
    const uniqueNominees = new Set(nominees.map((n) => n.nomineeId));
    if (uniqueNominees.size !== nominees.length) {
      return NextResponse.json({ error: "같은 선수에게 중복 투표할 수 없습니다" }, { status: 400 });
    }

    // 이벤트 확인 + pomVotesPerPerson 조회
    const event = await prisma.trainingEvent.findUnique({
      where: { id },
      select: { date: true, teamId: true, pomVotesPerPerson: true },
    });

    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 투표 인원 수 검증
    const maxVotes = event.pomVotesPerPerson || 1;
    if (nominees.length > maxVotes) {
      return NextResponse.json(
        { error: `최대 ${maxVotes}명까지 투표할 수 있습니다` },
        { status: 400 }
      );
    }

    // 투표 기간 확인: 운동 시작 2시간 후부터 다음날 23:59까지
    const now = new Date();
    const eventDate = new Date(event.date);
    const votingStartTime = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000);
    const votingEndDate = new Date(eventDate);
    votingEndDate.setDate(votingEndDate.getDate() + 1);
    votingEndDate.setHours(23, 59, 59, 999);

    if (now < votingStartTime) {
      return NextResponse.json(
        { error: "투표는 운동 종료 2시간 후부터 가능합니다" },
        { status: 400 }
      );
    }

    if (now > votingEndDate) {
      return NextResponse.json({ error: "투표 기간이 종료되었습니다" }, { status: 400 });
    }

    // 기존 투표 삭제 후 새로 생성 (트랜잭션)
    const createdVotes = await prisma.$transaction(async (tx) => {
      // 이 투표자의 기존 투표 모두 삭제
      await tx.pomVote.deleteMany({
        where: {
          trainingEventId: id,
          voterId: session.user.id,
        },
      });

      // 새 투표 생성
      const votes: { nomineeId: string; reason: string; tags: string[]; nominee: { id: string; name: string | null } }[] = [];
      for (const n of nominees) {
        const vote = await tx.pomVote.create({
          data: {
            trainingEventId: id,
            voterId: session.user.id,
            nomineeId: n.nomineeId,
            reason: n.reason.trim(),
            tags: Array.isArray(n.tags) ? n.tags : [],
          },
          include: {
            nominee: { select: { id: true, name: true } },
          },
        });
        votes.push(vote);
      }

      return votes;
    });

    return NextResponse.json({
      message: "투표가 완료되었습니다",
      votes: createdVotes.map((v) => ({
        nomineeId: v.nomineeId,
        nomineeName: v.nominee.name,
        reason: v.reason,
        tags: v.tags,
      })),
      // 하위 호환
      vote: {
        nomineeId: createdVotes[0].nomineeId,
        nomineeName: createdVotes[0].nominee.name,
        reason: createdVotes[0].reason,
      },
    });
  } catch (error) {
    console.error("POM 투표 오류:", error);
    return NextResponse.json({ error: "투표에 실패했습니다" }, { status: 500 });
  }
}
