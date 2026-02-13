import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 최근 락커 쪽지 조회 (24시간 이내)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { teamId: true },
    });

    if (!user?.teamId) {
      return NextResponse.json({ error: "No team found" }, { status: 404 });
    }

    // 24시간 이내의 쪽지 조회 (같은 팀 멤버가 받은 쪽지)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentNotes = await prisma.lockerNote.findMany({
      where: {
        createdAt: {
          gte: twentyFourHoursAgo,
        },
        recipient: {
          teamId: user.teamId,
        },
      },
      select: {
        id: true,
        content: true,
        color: true,
        rotation: true,
        positionX: true,
        positionY: true,
        tags: true,
        isAnonymous: true,
        createdAt: true,
        recipient: {
          select: {
            id: true,
            name: true,
          },
        },
        author: {
          select: {
            id: true,
            name: true,
          },
        },
        trainingLog: {
          select: {
            trainingDate: true,
          },
        },
        trainingEvent: {
          select: {
            date: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 10, // 최대 10개
    });

    return NextResponse.json(recentNotes);
  } catch (error) {
    console.error("Failed to fetch recent locker notes:", error);
    return NextResponse.json(
      { error: "Failed to fetch recent locker notes" },
      { status: 500 }
    );
  }
}

// 락커 쪽지 생성
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    console.log("📝 Locker note POST body:", JSON.stringify(body, null, 2));

    const {
      recipientId,
      content,
      color,
      rotation,
      positionX,
      positionY,
      isAnonymous,
      trainingEventId,
      trainingLogId,
      tags,
    } = body;

    console.log("📝 Extracted values:", { recipientId, content, color, rotation, positionX, positionY, isAnonymous, trainingEventId, trainingLogId, tags });

    // 유효성 검사
    if (!recipientId || !content || !color) {
      console.log("❌ Validation failed: missing required fields");
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 자기 자신에게는 쪽지를 보낼 수 없음
    if (recipientId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot send note to yourself" },
        { status: 400 }
      );
    }

    // 받는 사람이 같은 팀인지 확인
    const [sender, recipient] = await Promise.all([
      prisma.user.findUnique({
        where: { id: session.user.id },
        select: { teamId: true },
      }),
      prisma.user.findUnique({
        where: { id: recipientId },
        select: { teamId: true, name: true },
      }),
    ]);

    if (!sender?.teamId || !recipient?.teamId) {
      return NextResponse.json(
        { error: "User not found or not in a team" },
        { status: 404 }
      );
    }

    if (sender.teamId !== recipient.teamId) {
      return NextResponse.json(
        { error: "Cannot send note to user in different team" },
        { status: 403 }
      );
    }

    // 쪽지 생성
    console.log("📝 Creating locker note with data:", {
      content,
      color,
      rotation: rotation || 0,
      positionX: positionX || 0,
      positionY: positionY || 0,
      isAnonymous: isAnonymous || false,
      tags: tags || [],
      authorId: session.user.id,
      recipientId,
      trainingEventId: trainingEventId || null,
      trainingLogId: trainingLogId || null,
    });

    const note = await prisma.lockerNote.create({
      data: {
        content,
        color,
        rotation: rotation || 0,
        positionX: positionX || 0,
        positionY: positionY || 0,
        isAnonymous: isAnonymous || false,
        tags: tags || [],
        authorId: session.user.id,
        recipientId,
        trainingEventId: trainingEventId || null,
        trainingLogId: trainingLogId || null,
      },
      include: {
        recipient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    console.log("✅ Locker note created successfully:", note.id);
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("❌ Failed to create locker note:", error);
    console.error("Error details:", {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { error: "Failed to create locker note" },
      { status: 500 }
    );
  }
}
