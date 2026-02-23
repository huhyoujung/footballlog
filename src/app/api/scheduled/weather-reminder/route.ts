import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToTeam } from "@/lib/push";
import { getAirQualityGrade, getWindGrade } from "@/lib/weather";

// 내일 예정된 운동의 날씨 알림 발송 (스케줄러용 API)
// 매일 저녁 8시에 실행되도록 Vercel Cron 설정 필요
export async function GET(req: Request) {
  try {
    // 보안: Authorization 헤더 확인 (스케줄러만 호출 가능)
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 내일 00:00 ~ 23:59:59 범위
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // 내일 예정된 운동 중 날씨 정보가 있는 것만
    const events = await prisma.trainingEvent.findMany({
      where: {
        date: {
          gte: tomorrow,
          lt: dayAfterTomorrow,
        },
        weather: { not: null },
        temperature: { not: null },
      },
      include: {
        team: { select: { id: true, name: true } },
      },
    });

    console.log(`[WEATHER REMINDER] Found ${events.length} events for tomorrow`);

    const results: Array<{ eventId: string; teamId: string; success: boolean; error?: string }> = [];
    for (const event of events) {
      const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
        month: "numeric",
        day: "numeric",
        weekday: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

      // 날씨 아이콘
      let weatherIcon = "🌤️";
      if (event.weather === "Clear") weatherIcon = "☀️";
      else if (event.weather === "Clouds") weatherIcon = "☁️";
      else if (event.weather === "Rain") weatherIcon = "🌧️";
      else if (event.weather === "Snow") weatherIcon = "❄️";

      const weatherText = event.weatherDescription || event.weather;

      // 체감온도
      const feelsLikeText = event.feelsLikeC !== null && event.feelsLikeC !== event.temperature
        ? ` (체감 ${event.feelsLikeC}°)`
        : "";

      // 풍속
      let windText = "";
      if (event.windKph !== null) {
        const wind = getWindGrade(event.windKph);
        if (wind && wind.ms >= 4) windText = ` · 💨 ${wind.ms}m/s ${wind.label}`;
      }

      // 대기질 정보 추가
      let aqText = "";
      if (event.airQualityIndex !== null) {
        const aqGrade = getAirQualityGrade(event.airQualityIndex);
        aqText = ` · 대기질 ${aqGrade.emoji}`;
      }

      try {
        // 팀 전체에게 푸시 알림
        await sendPushToTeam("", event.teamId, {
          title: "내일 운동 날씨",
          body: `${event.title} · ${dateStr} · ${weatherIcon} ${weatherText} ${event.temperature}°C${feelsLikeText}${windText}${aqText}`,
          url: `/training/${event.id}`,
        });

        console.log(`[WEATHER REMINDER] Sent notification for event ${event.id} to team ${event.teamId}`);
        results.push({ eventId: event.id, teamId: event.teamId, success: true });
      } catch (error) {
        console.error(`[WEATHER REMINDER] Failed to send notification for event ${event.id}:`, error);
        results.push({ eventId: event.id, teamId: event.teamId, success: false, error: String(error) });
      }
    }

    return NextResponse.json({
      message: `Processed ${events.length} events`,
      results,
    });
  } catch (error) {
    console.error("[WEATHER REMINDER] Error:", error);
    return NextResponse.json(
      { error: "Failed to process weather reminders" },
      { status: 500 }
    );
  }
}
