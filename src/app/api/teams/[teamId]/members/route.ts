import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 팀원 목록 조회
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { teamId } = await params;

    // 같은 팀 소속인지 확인 (친선경기 상대팀 조회 허용)
    if (session.user.teamId !== teamId) {
      const linkedEvent = await prisma.trainingEvent.findFirst({
        where: {
          OR: [
            { teamId: session.user.teamId!, opponentTeamId: teamId },
            { teamId: teamId, opponentTeamId: session.user.teamId! },
          ],
          matchStatus: { in: ["CHALLENGE_SENT", "CONFIRMED"] },
        },
      });

      if (!linkedEvent) {
        return NextResponse.json(
          { error: "You are not a member of this team" },
          { status: 403 }
        );
      }
    }

    const members = await prisma.user.findMany({
      where: {
        teamId,
      },
      select: {
        id: true,
        name: true,
        image: true,
        role: true,
        position: true,
        number: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    return NextResponse.json(members);
  } catch (error) {
    console.error("Failed to fetch team members:", error);
    return NextResponse.json(
      { error: "Failed to fetch team members" },
      { status: 500 }
    );
  }
}
