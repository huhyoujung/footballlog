import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// OpenAI 클라이언트 (API 키 없으면 null)
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

/**
 * POST /api/ai/generate-caption
 * 사진에서 운동 일지 캡션 생성
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    // OpenAI API 키 확인
    if (!openai) {
      return NextResponse.json(
        { error: "AI 기능이 설정되지 않았습니다" },
        { status: 503 }
      );
    }

    const { imageUrl } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: "이미지가 필요합니다" }, { status: 400 });
    }

    // OpenAI Vision API로 캡션 생성
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // 저렴하고 빠른 모델
      messages: [
        {
          role: "system",
          content: `당신은 축구팀 운동 일지 작성을 돕는 AI입니다.
사진을 보고 간결하고 자연스러운 한국어로 운동 내용을 요약해주세요.
형식: "오늘은 [활동] 위주로 훈련했다. [특이사항/느낌]"
예시: "오늘은 패스 훈련 위주로 진행했다. 날씨가 좋아서 컨디션도 좋았음!"
최대 2문장, 100자 이내로 작성하세요.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
            {
              type: "text",
              text: "이 운동 사진을 보고 일지 캡션을 작성해줘",
            },
          ],
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const caption = response.choices[0]?.message?.content || "";

    return NextResponse.json({ caption });
  } catch (error: any) {
    console.error("AI caption generation error:", error);
    return NextResponse.json(
      { error: error.message || "캡션 생성에 실패했습니다" },
      { status: 500 }
    );
  }
}
