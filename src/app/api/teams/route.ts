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
          include: {
            members: {
              select: {
                id: true,
                name: true,
                image: true,
                role: true,
                position: true,
                number: true,
              },
            },
          },
        },
      },
    });

    if (!user?.team) {
      return NextResponse.json({ error: "팀에 소속되어 있지 않습니다" }, { status: 404 });
    }

    return NextResponse.json(user.team);
  } catch (error) {
    console.error("팀 조회 오류:", error);
    return NextResponse.json(
      { error: "팀 조회에 실패했습니다" },
      { status: 500 }
    );
  }
}
