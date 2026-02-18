// 심판 타이머 컨트롤 API (시작/일시정지/재개/종료/조절)
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

type TimerAction = "START" | "PAUSE" | "RESUME" | "END" | "ADJUST";

// POST - 타이머 액션 실행
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { id } = await params;
    const { action, quarter, adjustSeconds } = (await request.json()) as {
      action: TimerAction;
      quarter: number;
      adjustSeconds?: number;
    };

    if (!action || !quarter) {
      return NextResponse.json(
        { error: "action과 quarter는 필수입니다" },
        { status: 400 }
      );
    }

    // 해당 쿼터의 심판 조회
    const quarterReferee = await prisma.quarterReferee.findFirst({
      where: { assignmentId: id, quarter },
    });

    if (!quarterReferee) {
      return NextResponse.json(
        { error: "해당 쿼터의 심판 배정을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인: 심판만 타이머 조작 가능
    if (quarterReferee.userId !== user.id) {
      return NextResponse.json(
        { error: "이 쿼터의 심판만 타이머를 조작할 수 있습니다" },
        { status: 403 }
      );
    }

    const now = new Date();
    const currentStatus = quarterReferee.timerStatus;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    switch (action) {
      case "START": {
        if (currentStatus !== "IDLE") {
          return NextResponse.json(
            { error: "타이머가 이미 시작되었습니다" },
            { status: 400 }
          );
        }
        updateData.timerStatus = "RUNNING";
        updateData.startedAt = now;
        updateData.lastResumedAt = now;
        updateData.elapsedSeconds = 0;
        break;
      }

      case "PAUSE": {
        if (currentStatus !== "RUNNING") {
          return NextResponse.json(
            { error: "진행 중인 타이머만 일시정지할 수 있습니다" },
            { status: 400 }
          );
        }
        // 누적 시간 계산
        const elapsed = quarterReferee.lastResumedAt
          ? Math.floor((now.getTime() - quarterReferee.lastResumedAt.getTime()) / 1000)
          : 0;
        updateData.timerStatus = "PAUSED";
        updateData.elapsedSeconds = quarterReferee.elapsedSeconds + elapsed;
        updateData.lastResumedAt = null;
        break;
      }

      case "RESUME": {
        if (currentStatus !== "PAUSED") {
          return NextResponse.json(
            { error: "일시정지 상태에서만 재개할 수 있습니다" },
            { status: 400 }
          );
        }
        updateData.timerStatus = "RUNNING";
        updateData.lastResumedAt = now;
        break;
      }

      case "END": {
        if (currentStatus === "IDLE" || currentStatus === "ENDED") {
          return NextResponse.json(
            { error: "시작되지 않았거나 이미 종료된 타이머입니다" },
            { status: 400 }
          );
        }
        // RUNNING이면 현재 구간도 누적
        let finalElapsed = quarterReferee.elapsedSeconds;
        if (currentStatus === "RUNNING" && quarterReferee.lastResumedAt) {
          finalElapsed += Math.floor(
            (now.getTime() - quarterReferee.lastResumedAt.getTime()) / 1000
          );
        }
        updateData.timerStatus = "ENDED";
        updateData.elapsedSeconds = finalElapsed;
        updateData.endedAt = now;
        updateData.lastResumedAt = null;
        break;
      }

      case "ADJUST": {
        if (currentStatus === "IDLE" || currentStatus === "ENDED") {
          return NextResponse.json(
            { error: "시작되지 않았거나 종료된 타이머는 조절할 수 없습니다" },
            { status: 400 }
          );
        }
        if (adjustSeconds === undefined || typeof adjustSeconds !== "number") {
          return NextResponse.json(
            { error: "adjustSeconds 값이 필요합니다" },
            { status: 400 }
          );
        }

        if (currentStatus === "RUNNING" && quarterReferee.lastResumedAt) {
          // RUNNING: 현재 구간 누적 후 조절, lastResumedAt 리셋
          const runningElapsed = Math.floor(
            (now.getTime() - quarterReferee.lastResumedAt.getTime()) / 1000
          );
          updateData.elapsedSeconds = Math.max(
            0,
            quarterReferee.elapsedSeconds + runningElapsed + adjustSeconds
          );
          updateData.lastResumedAt = now;
        } else {
          // PAUSED: 단순 조절
          updateData.elapsedSeconds = Math.max(
            0,
            quarterReferee.elapsedSeconds + adjustSeconds
          );
        }
        break;
      }

      default:
        return NextResponse.json(
          { error: "유효하지 않은 액션입니다" },
          { status: 400 }
        );
    }

    const updated = await prisma.quarterReferee.update({
      where: { id: quarterReferee.id },
      data: updateData,
    });

    return NextResponse.json({
      timerStatus: updated.timerStatus,
      elapsedSeconds: updated.elapsedSeconds,
      lastResumedAt: updated.lastResumedAt?.toISOString() || null,
      startedAt: updated.startedAt?.toISOString() || null,
      endedAt: updated.endedAt?.toISOString() || null,
    });
  } catch (error) {
    console.error("Timer control error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET - 타이머 상태 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const quarter = parseInt(searchParams.get("quarter") || "0");

    if (!quarter) {
      return NextResponse.json(
        { error: "quarter 파라미터가 필요합니다" },
        { status: 400 }
      );
    }

    const quarterReferee = await prisma.quarterReferee.findFirst({
      where: { assignmentId: id, quarter },
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    });

    if (!quarterReferee) {
      return NextResponse.json(
        { error: "해당 쿼터의 심판 배정을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    return NextResponse.json({
      timerStatus: quarterReferee.timerStatus,
      elapsedSeconds: quarterReferee.elapsedSeconds,
      lastResumedAt: quarterReferee.lastResumedAt?.toISOString() || null,
      startedAt: quarterReferee.startedAt?.toISOString() || null,
      endedAt: quarterReferee.endedAt?.toISOString() || null,
      referee: quarterReferee.user,
      isReferee: user?.id === quarterReferee.userId,
    });
  } catch (error) {
    console.error("Timer state error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
