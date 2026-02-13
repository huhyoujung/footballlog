import { NextResponse } from "next/server";

// WeatherAPI.com으로 날씨 정보 조회
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");
    const date = searchParams.get("date");

    if (!lat || !lon || !date) {
      return NextResponse.json(
        { error: "위도, 경도, 날짜가 필요합니다" },
        { status: 400 }
      );
    }

    const apiKey = process.env.WEATHERAPI_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "WeatherAPI 키가 설정되지 않았습니다" },
        { status: 500 }
      );
    }

    const targetDate = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil(
      (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // 날짜 형식: YYYY-MM-DD
    const dateStr = targetDate.toISOString().split("T")[0];

    // 3일 이내면 forecast API, 그 이후면 future API
    // 무료 플랜은 forecast만 지원 (3일 예보)
    const endpoint = diffDays <= 3 ? "forecast.json" : "forecast.json";
    const url = `https://api.weatherapi.com/v1/${endpoint}?key=${apiKey}&q=${lat},${lon}&dt=${dateStr}&lang=ko&aqi=yes`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error("날씨 정보를 가져올 수 없습니다");
    }

    const data = await response.json();

    // 예보 데이터에서 목표 날짜 찾기
    const forecastDay = data.forecast?.forecastday?.[0];

    if (!forecastDay) {
      throw new Error("예보 데이터를 찾을 수 없습니다");
    }

    // 목표 시간에 가장 가까운 시간대 찾기
    const targetHour = targetDate.getHours();
    const hourData = forecastDay.hour?.find(
      (h: any) => new Date(h.time).getHours() === targetHour
    ) || forecastDay.hour?.[12] || forecastDay.day; // 기본값: 낮 12시 또는 일평균

    // 날씨 코드 매핑
    const condition = hourData.condition?.text || forecastDay.day?.condition?.text || "";
    let weather = "Clear";
    let weatherDescription = condition;

    // WeatherAPI condition code로 날씨 분류
    if (condition.includes("비") || condition.includes("rain") || condition.includes("Rainy")) {
      weather = "Rain";
    } else if (condition.includes("눈") || condition.includes("snow") || condition.includes("Snowy")) {
      weather = "Snow";
    } else if (condition.includes("흐림") || condition.includes("cloud") || condition.includes("Cloudy")) {
      weather = "Clouds";
    } else if (condition.includes("맑음") || condition.includes("clear") || condition.includes("Sunny")) {
      weather = "Clear";
    }

    // 대기질 정보 (air_quality는 hourly data에만 있음)
    const airQuality = hourData.air_quality || null;
    const airQualityIndex = airQuality ? Math.round(airQuality["us-epa-index"] || 0) : null;
    const pm25 = airQuality ? Math.round(airQuality.pm2_5 * 10) / 10 : null;
    const pm10 = airQuality ? Math.round(airQuality.pm10 * 10) / 10 : null;

    // 일출/일몰 시간 (astro 정보)
    const sunrise = forecastDay.astro?.sunrise || null;
    const sunset = forecastDay.astro?.sunset || null;

    const weatherData = {
      weather,
      weatherDescription: condition,
      temperature: Math.round(hourData.temp_c || forecastDay.day?.avgtemp_c || 0),
      minTempC: Math.round(forecastDay.day?.mintemp_c || 0),
      maxTempC: Math.round(forecastDay.day?.maxtemp_c || 0),
      feelsLikeC: Math.round(hourData.feelslike_c || forecastDay.day?.avgtemp_c || 0),
      precipMm: hourData.precip_mm || forecastDay.day?.totalprecip_mm || 0,
      chanceOfRain: hourData.chance_of_rain || forecastDay.day?.daily_chance_of_rain || 0,
      windKph: Math.round((hourData.wind_kph || forecastDay.day?.maxwind_kph || 0) * 10) / 10,
      uvIndex: hourData.uv || forecastDay.day?.uv || 0,
      airQualityIndex,
      pm25,
      pm10,
      sunrise,
      sunset,
      icon: hourData.condition?.icon || forecastDay.day?.condition?.icon || "",
    };

    return NextResponse.json(weatherData);
  } catch (error) {
    console.error("날씨 조회 오류:", error);
    return NextResponse.json(
      { error: "날씨 정보를 가져오지 못했습니다" },
      { status: 500 }
    );
  }
}
