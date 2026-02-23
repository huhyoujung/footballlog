import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        position: true,
        number: true,
        phoneNumber: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("프로필 조회 오류:", error);
    return NextResponse.json({ error: "프로필 조회에 실패했습니다" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const body = await req.json();
    const { name, image, position, number, phoneNumber } = body;

    const updateData: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json({ error: "이름을 입력해주세요" }, { status: 400 });
      }
      updateData.name = name.trim();
    }

    if (image !== undefined) {
      updateData.image = image;
    }

    if (position !== undefined) {
      updateData.position = position || null;
    }

    if (number !== undefined) {
      if (number !== null && (typeof number !== "number" || number < 0 || number > 99)) {
        return NextResponse.json({ error: "등번호는 0~99 사이여야 합니다" }, { status: 400 });
      }
      updateData.number = number;
    }

    if (phoneNumber !== undefined) {
      updateData.phoneNumber = phoneNumber || null;
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        position: true,
        number: true,
        phoneNumber: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    console.error("프로필 업데이트 오류:", error);
    return NextResponse.json({ error: "프로필 업데이트에 실패했습니다" }, { status: 500 });
  }
}
