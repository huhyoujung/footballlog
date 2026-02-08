import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
      select: { date: true, teamId: true },
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
        createdAt: vote.createdAt,
      });
      voteCounts[vote.nomineeId].count++;
    }

    // 득표순 정렬
    const results = Object.values(voteCounts).sort((a, b) => b.count - a.count);

    // 내 투표 여부
    const myVote = votes.find((v) => v.voterId === session.user.id);

    return NextResponse.json({
      results,
      totalVotes: votes.length,
      myVote: myVote
        ? {
            nomineeId: myVote.nomineeId,
            nomineeName: myVote.nominee.name,
            reason: myVote.reason,
          }
        : null,
    });
  } catch (error) {
    console.error("POM 결과 조회 오류:", error);
    return NextResponse.json({ error: "조회에 실패했습니다" }, { status: 500 });
  }
}

// POM 투표하기
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

    const { nomineeId, reason } = await req.json();

    if (!nomineeId || !reason || reason.trim().length === 0) {
      return NextResponse.json({ error: "선수와 이유를 입력해주세요" }, { status: 400 });
    }

    // 이벤트 확인
    const event = await prisma.trainingEvent.findUnique({
      where: { id },
      select: { date: true, teamId: true },
    });

    if (!event || event.teamId !== session.user.teamId) {
      return NextResponse.json({ error: "권한이 없습니다" }, { status: 403 });
    }

    // 투표 기간 확인: 운동 시작 2시간 후부터 다음날 23:59까지
    const now = new Date();
    const eventDate = new Date(event.date);
    const votingStartTime = new Date(eventDate.getTime() + 2 * 60 * 60 * 1000); // +2시간
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

    // 본인에게 투표 방지
    if (nomineeId === session.user.id) {
      return NextResponse.json({ error: "본인에게는 투표할 수 없습니다" }, { status: 400 });
    }

    // 투표 생성 또는 수정 (upsert)
    const vote = await prisma.pomVote.upsert({
      where: {
        trainingEventId_voterId: {
          trainingEventId: id,
          voterId: session.user.id,
        },
      },
      create: {
        trainingEventId: id,
        voterId: session.user.id,
        nomineeId,
        reason: reason.trim(),
      },
      update: {
        nomineeId,
        reason: reason.trim(),
      },
      include: {
        nominee: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({
      message: "투표가 완료되었습니다",
      vote: {
        nomineeId: vote.nomineeId,
        nomineeName: vote.nominee.name,
        reason: vote.reason,
      },
    });
  } catch (error) {
    console.error("POM 투표 오류:", error);
    return NextResponse.json({ error: "투표에 실패했습니다" }, { status: 500 });
  }
}
