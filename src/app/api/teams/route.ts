import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 팀 생성
export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // 이미 팀에 소속되어 있는지 확인
    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
    });

    if (existingUser?.teamId) {
      return NextResponse.json(
        { error: "이미 팀에 소속되어 있습니다" },
        { status: 400 }
      );
    }

    const { name } = await req.json();

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "팀 이름을 입력해주세요" },
        { status: 400 }
      );
    }

    // 팀 생성
    const team = await prisma.team.create({
      data: {
        name: name.trim(),
        createdBy: session.user.id,
      },
    });

    // 사용자를 팀에 추가하고 운영진으로 설정
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        teamId: team.id,
        role: "ADMIN",
      },
    });

    return NextResponse.json(team, { status: 201 });
  } catch (error) {
    console.error("팀 생성 오류:", error);
    return NextResponse.json(
      { error: "팀 생성에 실패했습니다" },
      { status: 500 }
    );
  }
}

// 팀 정보 수정 (ADMIN)
export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id || !session.user.teamId) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "운영진만 수정할 수 있습니다" }, { status: 403 });
    }

    const body = await req.json();
    const data: Record<string, unknown> = {};

    if (body.name && typeof body.name === "string" && body.name.trim()) {
      data.name = body.name.trim();
    }

    if (body.logoUrl !== undefined) {
      data.logoUrl = body.logoUrl || null;
    }

    if (body.primaryColor && typeof body.primaryColor === "string") {
      data.primaryColor = body.primaryColor;
    }

    if (body.regenerateInviteCode) {
      data.inviteCode = Math.random().toString(36).substring(2, 10);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "수정할 항목이 없습니다" }, { status: 400 });
    }

    const team = await prisma.team.update({
      where: { id: session.user.teamId },
      data,
    });

    return NextResponse.json(team);
  } catch (error) {
    console.error("팀 수정 오류:", error);
    return NextResponse.json({ error: "팀 수정에 실패했습니다" }, { status: 500 });
  }
}

// 팀 정보 조회
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            inviteCode: true,
            logoUrl: true,
            primaryColor: true,
            vestOrder: true,
            createdAt: true,
            createdBy: true,
            members: {
              select: {
                id: true,
                name: true,
                image: true,
                role: true,
                position: true,
                number: true,
                phoneNumber: true,
              },
            },
          },
        },
      },
    });

    if (!user?.team) {
      return NextResponse.json({ error: "팀에 소속되어 있지 않습니다" }, { status: 404 });
    }

    // 출석률 계산을 위한 데이터 조회 (최적화: 단일 쿼리)
    const now = new Date();
    const totalEvents = await prisma.trainingEvent.count({
      where: {
        teamId: user.team.id,
        date: { lt: now }, // 과거 운동만
      },
    });

    // 모든 출석 데이터를 한 번에 가져오기 (N+1 쿼리 문제 해결)
    const checkIns = await prisma.checkIn.findMany({
      where: {
        trainingEvent: {
          teamId: user.team.id,
          date: { lt: now },
        },
      },
      select: {
        userId: true,
      },
    });

    // 메모리에서 그룹화 (userId별 출석 횟수)
    const checkInsByUser = checkIns.reduce((acc, checkIn) => {
      acc[checkIn.userId] = (acc[checkIn.userId] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // 각 멤버별 출석률 계산
    const membersWithAttendance = user.team.members.map((member) => ({
      ...member,
      attendanceRate: totalEvents > 0
        ? Math.round(((checkInsByUser[member.id] || 0) / totalEvents) * 100)
        : 0,
    }));

    // 출석률 순으로 정렬 (높은 순)
    membersWithAttendance.sort((a, b) => b.attendanceRate - a.attendanceRate);

    return NextResponse.json({
      ...user.team,
      members: membersWithAttendance,
    });
  } catch (error) {
    console.error("팀 조회 오류:", error);
    return NextResponse.json(
      { error: "팀 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}
