import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 초대 코드로 팀 가입
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

    const { inviteCode } = await req.json();

    if (!inviteCode || typeof inviteCode !== "string" || inviteCode.trim().length === 0) {
      return NextResponse.json(
        { error: "초대 코드를 입력해주세요" },
        { status: 400 }
      );
    }

    // 초대 코드로 팀 찾기
    const team = await prisma.team.findUnique({
      where: { inviteCode: inviteCode.trim() },
    });

    if (!team) {
      return NextResponse.json(
        { error: "유효하지 않은 초대 코드입니다" },
        { status: 404 }
      );
    }

    // 사용자를 팀에 추가
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        teamId: team.id,
        role: "MEMBER",
      },
    });

    return NextResponse.json({ message: "팀에 가입되었습니다", team });
  } catch (error) {
    console.error("팀 가입 오류:", error);
    return NextResponse.json(
      { error: "팀 가입에 실패했습니다" },
      { status: 500 }
    );
  }
}
