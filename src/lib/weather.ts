// 시간대 타입
export type TimeOfDay = "day" | "sunset" | "night";

// 일출/일몰 시간과 운동 시간으로 시간대 판별
export function getTimeOfDay(
  eventTime: Date,
  sunrise: string | null,
  sunset: string | null
): TimeOfDay {
  if (!sunrise || !sunset) return "day"; // 기본값

  // "06:30 AM" 형식을 24시간제로 변환
  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 12;

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();

    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return hours + minutes / 60;
  };

  const sunriseHour = parseTime(sunrise);
  const sunsetHour = parseTime(sunset);
  const eventHour = eventTime.getHours() + eventTime.getMinutes() / 60;

  // 석양: 일몰 1시간 전 ~ 일몰 30분 후
  const sunsetStart = sunsetHour - 1;
  const sunsetEnd = sunsetHour + 0.5;

  if (eventHour >= sunsetStart && eventHour <= sunsetEnd) {
    return "sunset";
  } else if (eventHour < sunriseHour || eventHour > sunsetEnd) {
    return "night";
  } else {
    return "day";
  }
}

// 날씨 영문을 한글로 변환
export function getWeatherInKorean(weather: string | null): string {
  if (!weather) return "";

  const weatherMap: Record<string, string> = {
    "Clear": "맑음",
    "Clouds": "흐림",
    "Rain": "비",
    "Drizzle": "이슬비",
    "Snow": "눈",
    "Thunderstorm": "천둥번개",
    "Mist": "안개",
    "Fog": "안개",
    "Haze": "실안개",
    "Dust": "황사",
    "Sand": "황사", // Dust와 동일하게 처리
    "Smoke": "연무",
  };

  return weatherMap[weather] || weather;
}

// 자외선 지수 등급 판별
export function getUvGrade(uv: number | null): {
  grade: string;
  color: string;
} {
  if (uv === null || uv === undefined) {
    return { grade: "알 수 없음", color: "#9CA3AF" };
  }

  if (uv <= 2) return { grade: "낮음", color: "#10B981" }; // 초록
  if (uv <= 5) return { grade: "보통", color: "#F59E0B" }; // 노랑
  if (uv <= 7) return { grade: "높음", color: "#F97316" }; // 주황
  if (uv <= 10) return { grade: "매우높음", color: "#EF4444" }; // 빨강
  return { grade: "위험", color: "#A855F7" }; // 보라
}

// 대기질 등급 계산 (US EPA 기준)
export function getAirQualityGrade(aqi: number | null): {
  grade: string;
  color: string;
  emoji: string;
} {
  if (aqi === null) return { grade: "정보없음", color: "#9CA3AF", emoji: "❓" };

  if (aqi <= 50) return { grade: "좋음", color: "#10B981", emoji: "🟢" };
  if (aqi <= 100) return { grade: "보통", color: "#F59E0B", emoji: "🟡" };
  if (aqi <= 150) return { grade: "나쁨", color: "#EF4444", emoji: "🟠" };
  return { grade: "매우나쁨", color: "#991B1B", emoji: "🔴" };
}

// 날씨 기반 준비물 추천 (축구 훈련용)
export function getWeatherRecommendations(
  weather: string | null,
  temperature: number | null,
  aqi: number | null
): string[] {
  const recommendations: string[] = [];

  // 날씨별 추천
  if (weather === "Rain") {
    recommendations.push("👕 여벌 옷, 양말 필수");
    recommendations.push("🧴 수건 챙기기");
    recommendations.push("⚽ 미끄럼 주의, 워밍업 철저히");
  } else if (weather === "Snow") {
    recommendations.push("❄️ 미끄럼 주의, 워밍업 충분히");
    recommendations.push("🧤 방한 장갑 챙기기");
  }

  // 온도별 추천 (한국 날씨 기준, 극단적인 날씨만)
  if (temperature !== null) {
    if (temperature < 0) {
      recommendations.push("🧥 방한복, 여벌 옷 필수");
      recommendations.push("🔥 충분한 워밍업으로 부상 예방");
      if (temperature < -5) {
        recommendations.push("🧤 장갑, 핫팩 챙기기");
        recommendations.push("❄️ 극한 추위 주의");
      }
    } else if (temperature > 30) {
      recommendations.push("💧 물, 이온음료 넉넉히");
      if (temperature > 36) {
        recommendations.push("☀️ 자외선 차단제 필수");
        recommendations.push("🚨 폭염주의보 - 온열질환 주의");
      }
    }
  }

  // 대기질별 추천
  if (aqi !== null && aqi > 100) {
    recommendations.push("😷 마스크 착용, 격한 운동 자제");
  }

  // 복합 조건: 더위 + 나쁜 대기질 = 특히 위험
  if (temperature !== null && temperature > 30 && aqi !== null && aqi > 100) {
    recommendations.push("⚠️ 더위+미세먼지 - 운동 자제 권장");
  }

  return recommendations;
}

// 날씨별 배경 그라데이션 스타일 (시간대 반영)
export function getWeatherCardStyle(
  weather: string | null,
  timeOfDay: TimeOfDay = "day"
): {
  gradient: string;
  border: string;
  iconColor: string;
} {
  if (!weather) {
    return {
      gradient: "from-gray-50 to-slate-50",
      border: "border-gray-200",
      iconColor: "text-gray-500",
    };
  }

  // 시간대별 스타일 맵 (모든 날씨)
  const timeBasedStyles: Record<string, Record<TimeOfDay, { gradient: string; border: string; iconColor: string }>> = {
    "Clear": {
      day: {
        gradient: "from-amber-50 via-yellow-50 to-orange-50",
        border: "border-amber-200",
        iconColor: "text-amber-600",
      },
      sunset: {
        gradient: "from-orange-100 via-pink-100 to-purple-100",
        border: "border-orange-300",
        iconColor: "text-orange-600",
      },
      night: {
        gradient: "from-indigo-950 via-blue-950 to-slate-900",
        border: "border-indigo-800",
        iconColor: "text-indigo-300",
      },
    },
    "Clouds": {
      day: {
        gradient: "from-slate-100 via-gray-100 to-slate-50",
        border: "border-gray-300",
        iconColor: "text-gray-600",
      },
      sunset: {
        gradient: "from-slate-200 via-gray-200 to-stone-100",
        border: "border-gray-400",
        iconColor: "text-gray-700",
      },
      night: {
        gradient: "from-slate-800 via-gray-800 to-slate-700",
        border: "border-slate-600",
        iconColor: "text-slate-300",
      },
    },
    "Rain": {
      day: {
        gradient: "from-blue-100 via-sky-50 to-cyan-50",
        border: "border-blue-200",
        iconColor: "text-blue-600",
      },
      sunset: {
        gradient: "from-blue-200 via-slate-200 to-gray-200",
        border: "border-blue-300",
        iconColor: "text-blue-700",
      },
      night: {
        gradient: "from-blue-950 via-slate-900 to-gray-900",
        border: "border-blue-800",
        iconColor: "text-blue-300",
      },
    },
    "Drizzle": {
      day: {
        gradient: "from-sky-50 via-blue-50 to-slate-50",
        border: "border-sky-200",
        iconColor: "text-sky-600",
      },
      sunset: {
        gradient: "from-sky-100 via-slate-100 to-gray-100",
        border: "border-sky-300",
        iconColor: "text-sky-700",
      },
      night: {
        gradient: "from-slate-900 via-gray-900 to-blue-950",
        border: "border-slate-700",
        iconColor: "text-sky-300",
      },
    },
    "Snow": {
      day: {
        gradient: "from-white via-slate-50 to-gray-100",
        border: "border-slate-200",
        iconColor: "text-slate-600",
      },
      sunset: {
        gradient: "from-slate-100 via-gray-100 to-stone-100",
        border: "border-slate-300",
        iconColor: "text-slate-700",
      },
      night: {
        gradient: "from-slate-900 via-gray-900 to-slate-800",
        border: "border-slate-700",
        iconColor: "text-slate-200",
      },
    },
    "Thunderstorm": {
      day: {
        gradient: "from-slate-300 via-gray-300 to-slate-200",
        border: "border-slate-400",
        iconColor: "text-slate-700",
      },
      sunset: {
        gradient: "from-slate-400 via-gray-400 to-stone-300",
        border: "border-slate-500",
        iconColor: "text-slate-800",
      },
      night: {
        gradient: "from-slate-950 via-gray-950 to-stone-950",
        border: "border-slate-800",
        iconColor: "text-yellow-300",
      },
    },
    "Mist": {
      day: {
        gradient: "from-blue-50 via-slate-50 to-gray-50",
        border: "border-slate-200",
        iconColor: "text-slate-500",
      },
      sunset: {
        gradient: "from-slate-100 via-gray-100 to-blue-100",
        border: "border-slate-300",
        iconColor: "text-slate-600",
      },
      night: {
        gradient: "from-slate-900 via-gray-900 to-slate-800",
        border: "border-slate-700",
        iconColor: "text-slate-300",
      },
    },
    "Fog": {
      day: {
        gradient: "from-slate-100 via-gray-100 to-blue-50",
        border: "border-slate-300",
        iconColor: "text-slate-600",
      },
      sunset: {
        gradient: "from-slate-200 via-gray-200 to-stone-100",
        border: "border-slate-400",
        iconColor: "text-slate-700",
      },
      night: {
        gradient: "from-gray-950 via-slate-950 to-gray-900",
        border: "border-gray-800",
        iconColor: "text-gray-300",
      },
    },
    "Haze": {
      day: {
        gradient: "from-yellow-50 via-slate-50 to-gray-100",
        border: "border-amber-200",
        iconColor: "text-amber-600",
      },
      sunset: {
        gradient: "from-yellow-100 via-amber-100 to-stone-100",
        border: "border-amber-300",
        iconColor: "text-amber-700",
      },
      night: {
        gradient: "from-slate-900 via-gray-900 to-stone-900",
        border: "border-slate-700",
        iconColor: "text-amber-300",
      },
    },
    "Dust": {
      day: {
        gradient: "from-yellow-100 via-amber-100 to-orange-50",
        border: "border-yellow-300",
        iconColor: "text-yellow-700",
      },
      sunset: {
        gradient: "from-orange-200 via-amber-200 to-yellow-100",
        border: "border-orange-400",
        iconColor: "text-orange-800",
      },
      night: {
        gradient: "from-amber-950 via-orange-950 to-yellow-950",
        border: "border-amber-800",
        iconColor: "text-amber-300",
      },
    },
    "Sand": {
      day: {
        gradient: "from-orange-100 via-amber-50 to-yellow-100",
        border: "border-orange-300",
        iconColor: "text-orange-700",
      },
      sunset: {
        gradient: "from-orange-200 via-amber-100 to-yellow-200",
        border: "border-orange-400",
        iconColor: "text-orange-800",
      },
      night: {
        gradient: "from-orange-950 via-amber-950 to-stone-950",
        border: "border-orange-900",
        iconColor: "text-orange-300",
      },
    },
    "Smoke": {
      day: {
        gradient: "from-gray-100 via-slate-100 to-stone-100",
        border: "border-gray-300",
        iconColor: "text-gray-600",
      },
      sunset: {
        gradient: "from-gray-200 via-slate-200 to-stone-200",
        border: "border-gray-400",
        iconColor: "text-gray-700",
      },
      night: {
        gradient: "from-gray-900 via-slate-900 to-stone-900",
        border: "border-gray-800",
        iconColor: "text-gray-300",
      },
    },
  };

  // 시간대별 스타일이 있으면 사용
  if (timeBasedStyles[weather]) {
    return timeBasedStyles[weather][timeOfDay];
  }

  // 시간대별 스타일이 없으면 기본 스타일 사용
  const styleMap: Record<string, { gradient: string; border: string; iconColor: string }> = {
    // 맑음 (fallback, 위에서 처리됨)
    "Clear": {
      gradient: "from-amber-50 via-yellow-50 to-orange-50",
      border: "border-amber-200",
      iconColor: "text-amber-600",
    },
    // 흐림 (fallback, 위에서 처리됨)
    "Clouds": {
      gradient: "from-slate-100 via-gray-100 to-slate-50",
      border: "border-gray-300",
      iconColor: "text-gray-600",
    },
    // 비 (fallback, 위에서 처리됨)
    "Rain": {
      gradient: "from-blue-100 via-sky-50 to-cyan-50",
      border: "border-blue-200",
      iconColor: "text-blue-600",
    },
    // 이슬비 - 연한 파란색
    "Drizzle": {
      gradient: "from-sky-50 via-blue-50 to-slate-50",
      border: "border-sky-200",
      iconColor: "text-sky-600",
    },
    // 눈 - 하얀색/회색
    "Snow": {
      gradient: "from-white via-slate-50 to-gray-100",
      border: "border-slate-200",
      iconColor: "text-slate-600",
    },
    // 천둥번개 - 어두운 먹구름
    "Thunderstorm": {
      gradient: "from-slate-300 via-gray-300 to-slate-200",
      border: "border-slate-400",
      iconColor: "text-slate-700",
    },
    // 안개 - 부드러운 청회색 그라데이션
    "Mist": {
      gradient: "from-blue-50 via-slate-50 to-gray-50",
      border: "border-slate-200",
      iconColor: "text-slate-500",
    },
    // 짙은 안개 - 조금 더 진한 회색
    "Fog": {
      gradient: "from-slate-100 via-gray-100 to-blue-50",
      border: "border-slate-300",
      iconColor: "text-slate-600",
    },
    // 실안개 - 노란 기미 도는 안개
    "Haze": {
      gradient: "from-yellow-50 via-slate-50 to-gray-100",
      border: "border-amber-200",
      iconColor: "text-amber-600",
    },
    // 황사 - 갈색/노란색
    "Dust": {
      gradient: "from-yellow-100 via-amber-100 to-orange-50",
      border: "border-yellow-300",
      iconColor: "text-yellow-700",
    },
    // 모래바람 - 갈색
    "Sand": {
      gradient: "from-orange-100 via-amber-50 to-yellow-100",
      border: "border-orange-300",
      iconColor: "text-orange-700",
    },
    // 연무 - 회색과 갈색의 중간
    "Smoke": {
      gradient: "from-gray-100 via-slate-100 to-stone-100",
      border: "border-gray-300",
      iconColor: "text-gray-600",
    },
  };

  return styleMap[weather] || {
    gradient: "from-sky-50 to-blue-50",
    border: "border-sky-100",
    iconColor: "text-sky-600",
  };
}

// 날씨별 아이콘 타입 (lucide-react 아이콘 이름)
export function getWeatherIcon(weather: string | null, timeOfDay?: TimeOfDay): string {
  if (!weather) return "Cloud";

  // 맑은 날씨는 시간대에 따라 다른 아이콘
  if (weather === "Clear" && timeOfDay === "night") {
    return "Moon";
  }

  const iconMap: Record<string, string> = {
    "Clear": "Sun",
    "Clouds": "Cloud",
    "Rain": "CloudRain",
    "Drizzle": "CloudDrizzle",
    "Snow": "Snowflake",
    "Thunderstorm": "CloudLightning",
    "Mist": "CloudFog",
    "Fog": "CloudFog",
    "Haze": "CloudFog",
    "Dust": "Wind",
    "Sand": "Wind",
    "Smoke": "Wind",
  };

  return iconMap[weather] || "Cloud";
}
