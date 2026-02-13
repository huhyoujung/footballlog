"use client";

import { Cloud, Sun, Moon, CloudRain, CloudDrizzle, Snowflake, CloudLightning, CloudFog, Wind } from "lucide-react";
import { getWeatherCardStyle, getWeatherInKorean, getAirQualityGrade, getWeatherIcon, type TimeOfDay, getUvGrade } from "@/lib/weather";

export default function TestWeatherPage() {
  const weatherTypes = [
    { code: "Clear", temp: 25, min: 18, max: 28, feels: 27, rain: 0, precip: 0, wind: 5.2, uv: 7, aqi: 45 },
    { code: "Clouds", temp: 18, min: 15, max: 22, feels: 17, rain: 20, precip: 0, wind: 8.5, uv: 4, aqi: 65 },
    { code: "Rain", temp: 15, min: 12, max: 18, feels: 13, rain: 80, precip: 8.5, wind: 12.3, uv: 1, aqi: 55 },
    { code: "Drizzle", temp: 17, min: 14, max: 19, feels: 16, rain: 50, precip: 2.3, wind: 6.8, uv: 2, aqi: 60 },
    { code: "Snow", temp: -2, min: -5, max: 2, feels: -5, rain: 0, precip: 0, wind: 15.2, uv: 1, aqi: 40 },
    { code: "Thunderstorm", temp: 20, min: 17, max: 23, feels: 19, rain: 90, precip: 15.2, wind: 18.5, uv: 1, aqi: 70 },
    { code: "Mist", temp: 12, min: 9, max: 15, feels: 11, rain: 30, precip: 0.5, wind: 4.2, uv: 2, aqi: 80 },
    { code: "Fog", temp: 10, min: 7, max: 13, feels: 9, rain: 40, precip: 1.2, wind: 3.5, uv: 1, aqi: 75 },
    { code: "Haze", temp: 22, min: 19, max: 26, feels: 24, rain: 10, precip: 0, wind: 7.2, uv: 5, aqi: 90 },
    { code: "Dust", temp: 24, min: 20, max: 28, feels: 26, rain: 0, precip: 0, wind: 22.5, uv: 6, aqi: 150 },
    { code: "Sand", temp: 28, min: 24, max: 32, feels: 30, rain: 0, precip: 0, wind: 28.8, uv: 8, aqi: 180 },
    { code: "Smoke", temp: 19, min: 16, max: 22, feels: 20, rain: 5, precip: 0, wind: 6.5, uv: 3, aqi: 120 },
  ];

  const timesOfDay: Array<{ time: TimeOfDay; label: string }> = [
    { time: "day", label: "낮" },
    { time: "sunset", label: "석양" },
    { time: "night", label: "밤" },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-8">날씨 카드 미리보기 (시간대별)</h1>

        <div className="space-y-12">
          {weatherTypes.map((weather) => {
            const aqGrade = getAirQualityGrade(weather.aqi);

            return (
              <div key={weather.code}>
                <h2 className="text-lg font-semibold text-gray-800 mb-4">
                  {weather.code} ({getWeatherInKorean(weather.code)})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {timesOfDay.map(({ time, label }) => {
                    const weatherStyle = getWeatherCardStyle(weather.code, time);
                    const iconName = getWeatherIcon(weather.code, time);
                    const IconComponent = {
                      Sun,
                      Moon,
                      Cloud,
                      CloudRain,
                      CloudDrizzle,
                      Snowflake,
                      CloudLightning,
                      CloudFog,
                      Wind,
                    }[iconName] || Cloud;
                    const isNight = time === "night";
                    const textColor = isNight ? "text-white" : "text-gray-900";
                    const secondaryTextColor = isNight ? "text-gray-200" : "text-gray-600";
                    const tertiaryTextColor = isNight ? "text-gray-300" : "text-gray-700";

                    return (
                      <div key={`${weather.code}-${time}`}>
                        <p className="text-xs font-medium text-gray-600 mb-2">
                          {label}
                        </p>
                <div className={`relative overflow-hidden bg-gradient-to-br ${weatherStyle.gradient} rounded-2xl p-6 border ${weatherStyle.border} shadow-xl backdrop-blur-sm space-y-3`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-4">
                        <IconComponent className={`w-6 h-6 ${weatherStyle.iconColor}`} strokeWidth={2} />
                        <h3 className={`text-base font-bold ${textColor}`}>예상 날씨</h3>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-3 flex-wrap">
                          <span className={`text-5xl font-extrabold ${textColor} tracking-tight`}>{weather.temp}°C</span>
                          {weather.feels !== weather.temp && (
                            <span className={`text-base ${secondaryTextColor} font-medium`}>체감 {weather.feels}°</span>
                          )}
                          <span className={`text-base ${secondaryTextColor} font-semibold`}>
                            ↓{weather.min}° ↑{weather.max}°
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isNight ? 'bg-white/10 backdrop-blur-sm' : 'bg-white/60'}`}>
                            <span className={`text-xs font-medium ${isNight ? 'text-gray-100' : tertiaryTextColor}`}>
                              {getWeatherInKorean(weather.code)}
                            </span>
                          </div>
                          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${isNight ? 'bg-white/10 backdrop-blur-sm' : 'bg-white/60'}`}>
                            <span className="text-xs">{aqGrade.emoji}</span>
                            <span className="text-xs font-medium" style={{ color: isNight ? '#d1d5db' : aqGrade.color }}>
                              대기질
                            </span>
                          </div>
                          {/* 자외선 칩 - 낮에만 표시 */}
                          {!isNight && weather.uv > 0 && (() => {
                            const uvGrade = getUvGrade(weather.uv);
                            return (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/60 rounded-full">
                                <span className="text-xs">☀️</span>
                                <span className="text-xs font-medium" style={{ color: uvGrade.color }}>
                                  자외선 {uvGrade.grade}
                                </span>
                              </div>
                            );
                          })()}
                        </div>
                        {/* 추가 날씨 정보 - 한 줄로 표시 */}
                        <div className="flex items-center gap-3 flex-wrap mt-3">
                          {weather.rain > 0 && (
                            <div className={`flex items-center gap-1.5 text-xs ${tertiaryTextColor}`}>
                              <span className="font-medium">강수확률</span>
                              <span>{weather.rain}%</span>
                            </div>
                          )}
                          {weather.precip > 0 && (
                            <div className={`flex items-center gap-1.5 text-xs ${tertiaryTextColor}`}>
                              <span className="font-medium">강수량</span>
                              <span>{weather.precip}mm</span>
                            </div>
                          )}
                          <div className={`flex items-center gap-1.5 text-xs ${tertiaryTextColor}`}>
                            <span className="font-medium">풍속</span>
                            <span>{weather.wind}km/h</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
