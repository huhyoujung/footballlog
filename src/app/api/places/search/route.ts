import { NextResponse } from "next/server";

// 네이버 지도 장소 검색 API
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query");

    if (!query) {
      return NextResponse.json({ error: "검색어를 입력해주세요" }, { status: 400 });
    }

    const clientId = process.env.NAVER_CLIENT_ID;
    const clientSecret = process.env.NAVER_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      return NextResponse.json(
        { error: "네이버 API 키가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(
      query
    )}&display=10&sort=random`;

    const response = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": clientId,
        "X-Naver-Client-Secret": clientSecret,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("네이버 API 오류:", errorText);
      return NextResponse.json({
        error: "검색에 실패했습니다",
        details: errorText
      }, { status: 500 });
    }

    const data = await response.json();
    console.log("네이버 API 응답:", data);

    // 네이버 API 응답 형식을 우리 앱 형식으로 변환
    const places = data.items.map((item: any) => ({
      name: item.title.replace(/<[^>]*>/g, ""), // HTML 태그 제거
      address: item.address || item.roadAddress || "",
      roadAddress: item.roadAddress || "",
      mapUrl: item.link || `https://map.naver.com/v5/search/${encodeURIComponent(item.title.replace(/<[^>]*>/g, ""))}`,
      latitude: item.mapy ? parseFloat(item.mapy) / 10000000 : null,
      longitude: item.mapx ? parseFloat(item.mapx) / 10000000 : null,
      category: item.category || "",
    }));

    return NextResponse.json({ places });
  } catch (error) {
    console.error("장소 검색 오류:", error);
    return NextResponse.json({ error: "검색에 실패했습니다" }, { status: 500 });
  }
}
