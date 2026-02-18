import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

// 피드백 제출
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "로그인이 필요합니다" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const { type, title, content } = body;

    if (!type || !title || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // 내용 길이 제한
    if (title.length > 200 || content.length > 5000) {
      return NextResponse.json(
        { error: "제목은 200자, 내용은 5000자 이내로 작성해주세요" },
        { status: 400 }
      );
    }

    // 10분 내 중복 피드백 방지
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const recentFeedback = await prisma.feedback.findFirst({
      where: {
        userId: session.user.id,
        createdAt: { gte: tenMinutesAgo },
      },
    });

    if (recentFeedback) {
      return NextResponse.json(
        { error: "10분 후에 다시 피드백을 남겨주세요" },
        { status: 429 }
      );
    }

    // 피드백 저장
    const feedback = await prisma.feedback.create({
      data: {
        type,
        title,
        content,
        userId: session.user.id,
        userEmail: session.user.email || null,
        userName: session.user.name || null,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            team: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    // 이메일 전송 (비동기로 백그라운드에서 실행, 실패해도 피드백은 저장됨)
    const feedbackTypeLabel = {
      FEATURE_REQUEST: "기능 제안",
      BUG_REPORT: "버그 신고",
      IMPROVEMENT: "개선 제안",
      OTHER: "기타",
    }[type];

    const emailContent = `
새로운 피드백이 등록되었습니다!

📋 유형: ${feedbackTypeLabel}
📌 제목: ${title}
💬 내용:
${content}

👤 작성자: ${feedback.user?.name || "익명"} (${feedback.user?.email || "이메일 없음"})
🏃 팀: ${feedback.user?.team?.name || "팀 없음"}

📅 등록 시간: ${new Date().toLocaleString("ko-KR")}
🔗 피드백 ID: ${feedback.id}
    `.trim();

    // 이메일 전송 (실패해도 무시)
    if (resend && process.env.FEEDBACK_EMAIL) {
      resend.emails
        .send({
          from: "라커룸 피드백 <feedback@squaretocircle.app>",
          to: process.env.FEEDBACK_EMAIL,
          subject: `[라커룸 피드백] ${feedbackTypeLabel}: ${title}`,
          text: emailContent,
        })
        .catch((error) => {
          console.error("Failed to send feedback email:", error);
        });
    }

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    console.error("Failed to create feedback:", error);
    return NextResponse.json(
      { error: "Failed to create feedback" },
      { status: 500 }
    );
  }
}

// 피드백 목록 조회 (관리자용)
export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // 관리자만 조회 가능
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const feedbacks = await prisma.feedback.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            team: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(feedbacks);
  } catch (error) {
    console.error("Failed to fetch feedbacks:", error);
    return NextResponse.json(
      { error: "Failed to fetch feedbacks" },
      { status: 500 }
    );
  }
}
