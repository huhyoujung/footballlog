"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { withEulReul } from "@/lib/korean";
import dynamic from "next/dynamic";
import type { TrainingEventDetail, RsvpEntry, RsvpStatus } from "@/types/training-event";
import type { Session } from "next-auth";
import PomVoting from "@/components/PomVoting";
import { useTeam } from "@/contexts/TeamContext";
import { useToast } from "@/lib/useToast";
import Toast from "@/components/Toast";
import Image from "next/image";
import { Clock, MapPin, Footprints, Shirt, MessageSquare, Package, Bell, Check, ChevronDown, Users, Cloud, Sun, Moon, CloudRain, CloudDrizzle, Snowflake, CloudLightning, CloudFog, Wind } from "lucide-react";
import useSWR from "swr";
import { getAirQualityGrade, getWeatherRecommendations, getWeatherInKorean, getWeatherCardStyle, getWeatherIcon, getTimeOfDay, getUvGrade, getWindGrade } from "@/lib/weather";

const RefereeTimer = dynamic(() => import("@/components/match/RefereeTimer"), { ssr: false });

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Props {
  event: TrainingEventDetail;
  session: Session | null;
  onRefresh: () => void;
}

export default function BasicInfoTab({ event, session, onRefresh }: Props) {
  const { teamData } = useTeam();
  const { toast, showToast, hideToast } = useToast();
  const isAdmin = session?.user?.role === "ADMIN";
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | null>(event.myRsvp);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showEditRsvp, setShowEditRsvp] = useState(false);
  const [showAttendance, setShowAttendance] = useState(true);
  const [adminUpdatingId, setAdminUpdatingId] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string | null; phoneNumber: string | null } | null>(null);
  const [nudgedToday, setNudgedToday] = useState<Set<string>>(new Set());
  const [nudgeMessage, setNudgeMessage] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const getMemberPhone = (userId: string) =>
    teamData?.members.find((m) => m.id === userId)?.phoneNumber ?? null;

  const openMemberSheet = (userId: string, name: string | null, phoneNumber?: string | null) => {
    setSelectedMember({ id: userId, name, phoneNumber: phoneNumber ?? getMemberPhone(userId) });
  };

  const handleNudge = async (recipientId: string, recipientName: string) => {
    const message = nudgeMessage.trim();
    setSelectedMember(null);
    setNudgeMessage("");
    setNudgedToday((prev) => new Set(prev).add(recipientId));
    showToast(`${withEulReul(recipientName)} 닦달했습니다! 👉`);
    fetch("/api/nudges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId, message }),
    }).then(async (res) => {
      if (!res.ok) {
        setNudgedToday((prev) => { const next = new Set(prev); next.delete(recipientId); return next; });
        const data = await res.json();
        showToast(data.error || "닦달에 실패했습니다");
      }
    }).catch(() => {
      setNudgedToday((prev) => { const next = new Set(prev); next.delete(recipientId); return next; });
    });
  };

  // MVP 투표와 동일 기준: 경기 시작 2시간 후를 "경기 종료"로 판단
  const isMatchOver = Date.now() > new Date(event.date).getTime() + 2 * 60 * 60 * 1000;
  // 실시간 날씨 조회 (경기 종료 전에만 API 호출)
  const shouldFetchWeather = event.venue?.latitude && event.venue?.longitude && !isMatchOver;
  const weatherUrl = shouldFetchWeather
    ? `/api/weather?lat=${event.venue!.latitude}&lon=${event.venue!.longitude}&date=${new Date(event.date).toISOString().split('T')[0]}`
    : null;
  const { data: liveWeather } = useSWR<{
    weather: string;
    weatherDescription: string;
    temperature: number;
    minTempC: number;
    maxTempC: number;
    feelsLikeC: number;
    precipMm: number;
    chanceOfRain: number;
    windKph: number;
    uvIndex: number;
    airQualityIndex: number | null;
    pm25: number | null;
    pm10: number | null;
    sunrise: string | null;
    sunset: string | null;
  }>(weatherUrl, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  // 실시간 날씨가 있으면 사용, 없으면 DB 저장 데이터 사용
  const displayWeather = liveWeather || {
    weather: event.weather,
    weatherDescription: event.weatherDescription,
    temperature: event.temperature,
    minTempC: event.minTempC,
    maxTempC: event.maxTempC,
    feelsLikeC: event.feelsLikeC,
    precipMm: event.precipMm,
    chanceOfRain: event.chanceOfRain,
    windKph: event.windKph,
    uvIndex: event.uvIndex,
    airQualityIndex: event.airQualityIndex,
    pm25: event.pm25,
    pm10: event.pm10,
    sunrise: event.sunrise,
    sunset: event.sunset,
  };

  const [showAttendees, setShowAttendees] = useState(true);
  const [showAbsentees, setShowAbsentees] = useState(true);
  const [showLateComers, setShowLateComers] = useState(true);
  const [showNoShows, setShowNoShows] = useState(true);
  const [showNoResponse, setShowNoResponse] = useState(true);
  const [showSessions, setShowSessions] = useState(true);
  const [showPomVoting, setShowPomVoting] = useState(true);

  // 유니폼 목록 가져오기
  const { data: uniformData } = useSWR<{ uniforms: Array<{ id: string; name: string; color: string }> }>(
    "/api/teams/uniforms",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );

  // 유니폼 색상 찾기
  const uniformColor = event.uniform
    ? uniformData?.uniforms.find(
        (u) => u.name.toLowerCase() === event.uniform?.toLowerCase()
      )?.color
    : null;

  const isDeadlinePassed = new Date() > new Date(event.rsvpDeadline);

  // 체크인 가능 시간: 운동 시작 2시간 전 ~ 운동 시작 2시간 후까지
  const canCheckIn = useMemo(() => {
    const now = Date.now();
    const eventTime = new Date(event.date).getTime();
    return now >= eventTime - 7200000 && now <= eventTime + 7200000;
  }, [event.date]);

  const dateStr = useMemo(() =>
    new Date(event.date).toLocaleDateString("ko-KR", {
      year: "numeric", month: "long", day: "numeric", weekday: "long", hour: "2-digit", minute: "2-digit",
    }), [event.date]);

  const deadlineStr = useMemo(() =>
    new Date(event.rsvpDeadline).toLocaleDateString("ko-KR", {
      month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
    }), [event.rsvpDeadline]);

  // RSVP 분류 + 미응답자 (한번에 계산)
  const { attendees, absentees, lateComers, noShows, noResponse } = useMemo(() => {
    const attend: RsvpEntry[] = [];
    const absent: RsvpEntry[] = [];
    const late: RsvpEntry[] = [];
    const noShow: RsvpEntry[] = [];
    const respondedIds = new Set<string>();
    for (const r of event.rsvps) {
      respondedIds.add(r.userId);
      if (r.status === "ATTEND") attend.push(r);
      else if (r.status === "ABSENT") absent.push(r);
      else if (r.status === "LATE") late.push(r);
      else if (r.status === "NO_SHOW") noShow.push(r);
    }
    const noResp = teamData?.members.filter((m) => !respondedIds.has(m.id)) || [];
    return { attendees: attend, absentees: absent, lateComers: late, noShows: noShow, noResponse: noResp };
  }, [event.rsvps, teamData?.members, session?.user?.id]);

  // 체크인 맵 (O(n) → O(1) 조회)
  const checkInsMap = useMemo(() => {
    const map = new Map<string, (typeof event.checkIns)[number]>();
    for (const c of event.checkIns) map.set(c.userId, c);
    return map;
  }, [event.checkIns]);

  const handleRsvp = useCallback(async (status: RsvpStatus) => {
    if ((status === "ABSENT" || status === "LATE") && !reason.trim()) {
      return;
    }

    // Optimistic update — 즉시 UI 반영, 서버 응답 기다리지 않음
    const prevStatus = rsvpStatus;
    setRsvpStatus(status);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/training-events/${event.id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason.trim() || null }),
      });
      if (res.ok) {
        const label = status === "ATTEND" ? "참석" : status === "ABSENT" ? "불참" : "늦참";
        showToast(`${label}으로 응답했습니다 ✓`);
        onRefresh();
      } else {
        // 실패 시 이전 상태로 복구
        setRsvpStatus(prevStatus);
        const data = await res.json().catch(() => null);
        showToast(data?.error || "응답 저장에 실패했습니다");
      }
    } catch {
      setRsvpStatus(prevStatus);
      showToast("네트워크 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  }, [event.id, reason, rsvpStatus, onRefresh, showToast]);

  const handleCheckIn = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${event.id}/check-in`, {
        method: "POST",
      });
      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json();
        showToast(data.error || "체크인에 실패했습니다");
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }, [event.id, onRefresh, showToast]);

  const handleAdminRsvp = useCallback(async (userId: string, status: "ATTEND" | "ABSENT" | "LATE" | "NO_SHOW") => {
    setAdminUpdatingId(userId);
    try {
      const res = await fetch(`/api/training-events/${event.id}/rsvp/admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, status }),
      });
      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.error || "변경에 실패했습니다");
      }
    } catch {
      showToast("네트워크 오류가 발생했습니다");
    } finally {
      setAdminUpdatingId(null);
    }
  }, [event.id, onRefresh, showToast]);

  const handleCancelCheckIn = useCallback(async () => {
    if (!confirm("체크인을 취소하시겠습니까?")) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/training-events/${event.id}/check-in`, {
        method: "DELETE",
      });
      if (res.ok) {
        onRefresh();
      } else {
        const data = await res.json();
        showToast(data.error || "취소에 실패했습니다");
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }, [event.id, onRefresh, showToast]);


  return (
    <div className="space-y-3">
      {/* 운동 정보 */}
      <div className="bg-white rounded-xl p-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-900">
            <Clock className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
            <span className="font-semibold">{dateStr} 집결</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {event.isFriendlyMatch && (
              <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full whitespace-nowrap">친선경기</span>
            )}
            {event.isRegular && (
              <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full whitespace-nowrap">정기</span>
            )}
            {event.isFriendlyMatch && event.matchStatus === "DRAFT" && (() => {
              const required = event.matchRules?.playersPerSide ?? event.minimumPlayers ?? 0;
              if (required === 0) return null;
              const attended = attendees.length;
              const met = attended >= required;
              return (
                <span className={`text-[10px] font-semibold ${met ? "text-green-600" : "text-gray-400"}`}>
                  {attended}/{required}명
                </span>
              );
            })()}
          </div>
        </div>
        {/* 상대팀 (친선경기) */}
        {event.isFriendlyMatch && event.opponentTeamName && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {event.opponentTeam?.logoUrl ? (
              <div className="w-4 h-4 rounded-full overflow-hidden flex-shrink-0">
                <Image src={event.opponentTeam.logoUrl} alt={event.opponentTeamName} width={16} height={16} sizes="16px" className="w-full h-full object-cover" />
              </div>
            ) : (
              <Users className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
            )}
            <span>vs <strong className="text-gray-900">{event.opponentTeamName}</strong></span>
          </div>
        )}

        {/* 장소 */}
        {(() => {
          const mapUrl = event.venue?.mapUrl?.trim()
            || (event.venue?.latitude && event.venue?.longitude
              ? `https://map.naver.com/v5/search/${encodeURIComponent(event.location)}`
              : null);
          return mapUrl ? (
            <a
              href={mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-team-600 active:text-team-700 transition-colors cursor-pointer touch-manipulation"
            >
              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
              <span className="underline underline-offset-2">{event.location}</span>
            </a>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
              <span>{event.location}</span>
            </div>
          );
        })()}

        {/* 신발/유니폼 (2열 그리드) */}
        {(event.shoes.length > 0 || event.uniform) && (
          <div className="grid grid-cols-2 gap-2.5">
            {/* 신발 */}
            {event.shoes.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Footprints className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
                <span>{event.shoes.join(", ")}</span>
              </div>
            )}
            {/* 유니폼 */}
            {event.uniform && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Shirt
                  className="w-4 h-4 flex-shrink-0"
                  strokeWidth={1.5}
                  style={{ fill: uniformColor || "transparent", stroke: uniformColor ? "#9CA3AF" : "currentColor" }}
                />
                <span>{event.uniform}</span>
              </div>
            )}
          </div>
        )}

        {/* 조끼 순서 (전체 너비) */}
        {(event.vestBringer || event.vestReceiver) && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Package className="w-4 h-4 text-gray-500 flex-shrink-0" strokeWidth={1.5} />
            <span className="flex items-center gap-1.5 flex-wrap">
              <span className="bg-team-100 text-team-700 px-1 rounded font-medium">
                {event.vestBringer?.name || "미정"}
              </span>
              <span className="text-gray-400">→</span>
              <span className="bg-team-100 text-team-700 px-1 rounded font-medium">
                {event.vestReceiver?.name || "미정"}
              </span>
            </span>
          </div>
        )}
        {event.notes && (
          <div className="text-sm text-gray-600 border-t border-gray-100 -mx-5 px-5 pt-2.5 whitespace-pre-wrap leading-relaxed">
            {event.notes}
          </div>
        )}
      </div>

      {/* 날씨 정보 안내 (3일 이후 미래 운동) */}
      {!displayWeather.weather && (() => {
        const diff = Math.ceil((new Date(event.date).getTime() - Date.now()) / 86400000);
        if (diff <= 3) return null;
        const availFrom = new Date(event.date);
        availFrom.setDate(availFrom.getDate() - 3);
        return (
          <div className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 text-xs text-gray-400">
            <Cloud className="w-4 h-4 flex-shrink-0" strokeWidth={1.5} />
            <span>날씨 정보는 {availFrom.toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}부터 제공됩니다</span>
          </div>
        );
      })()}

      {/* 예상 날씨 카드 (경기 종료 전에만 표시) */}
      {displayWeather.weather && !isMatchOver && (() => {
        const timeOfDay = getTimeOfDay(new Date(event.date), displayWeather.sunrise, displayWeather.sunset);
        const weatherStyle = getWeatherCardStyle(displayWeather.weather, timeOfDay);
        const iconName = getWeatherIcon(displayWeather.weather, timeOfDay);
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

        const isNight = timeOfDay === "night";
        const textColor = isNight ? "text-white" : "text-gray-900";
        const secondaryTextColor = isNight ? "text-gray-200" : "text-gray-600";
        const tertiaryTextColor = isNight ? "text-gray-300" : "text-gray-700";

        return (
        <div className="max-w-md mx-auto">
        <div className={`relative overflow-hidden bg-gradient-to-br ${weatherStyle.gradient} rounded-xl p-3 border ${weatherStyle.border} shadow-sm backdrop-blur-sm space-y-2`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-1.5 mb-2">
                <IconComponent className={`w-4 h-4 ${weatherStyle.iconColor}`} strokeWidth={2} />
                <h3 className={`text-xs font-bold ${textColor}`}>예상 날씨</h3>
              </div>
              <div className="space-y-2">
                <div className="space-y-0.5">
                  {displayWeather.temperature !== null && (
                    <span className={`text-3xl font-extrabold ${textColor} tracking-tight`}>{displayWeather.temperature}°C</span>
                  )}
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {displayWeather.minTempC !== null && displayWeather.maxTempC !== null && (
                      <span className={`text-sm ${secondaryTextColor} font-semibold`}>
                        ↓{displayWeather.minTempC}° ↑{displayWeather.maxTempC}°
                      </span>
                    )}
                    {displayWeather.feelsLikeC !== null && displayWeather.feelsLikeC !== displayWeather.temperature && (
                      <span className={`text-sm ${secondaryTextColor} font-medium`}>체감 {displayWeather.feelsLikeC}°C</span>
                    )}
                  </div>
                </div>
                {displayWeather.weatherDescription && (
                  <span className={`text-xs ${secondaryTextColor} font-medium`}>{displayWeather.weatherDescription}</span>
                )}
                <div className="mt-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {displayWeather.weather && (
                    <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isNight ? 'bg-white/10 backdrop-blur-sm' : 'bg-white/60'}`}>
                      <span className={`text-[11px] font-medium ${isNight ? 'text-gray-100' : 'text-gray-700'}`}>{getWeatherInKorean(displayWeather.weather)}</span>
                    </div>
                  )}
                  {displayWeather.airQualityIndex !== null && (() => {
                    const aqGrade = getAirQualityGrade(displayWeather.airQualityIndex);
                    return (
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isNight ? 'bg-white/10 backdrop-blur-sm' : 'bg-white/60'}`}>
                        <span className="text-[11px]">{aqGrade.emoji}</span>
                        <span className="text-[11px] font-medium" style={{ color: isNight ? '#d1d5db' : aqGrade.color }}>
                          대기질
                        </span>
                      </div>
                    );
                  })()}
                  {/* 자외선 칩 - 낮에만 표시 */}
                  {!isNight && displayWeather.uvIndex !== null && displayWeather.uvIndex !== undefined && displayWeather.uvIndex > 0 && (() => {
                    const uvGrade = getUvGrade(displayWeather.uvIndex);
                    return (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/60 rounded-full">
                        <span className="text-[11px]">☀️</span>
                        <span className="text-[11px] font-medium" style={{ color: uvGrade.color }}>
                          자외선 {uvGrade.grade}
                        </span>
                      </div>
                    );
                  })()}
                  {/* 풍속 칩 */}
                  {(() => {
                    const wind = getWindGrade(displayWeather.windKph);
                    if (!wind) return null;
                    return (
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${isNight ? 'bg-white/10 backdrop-blur-sm' : 'bg-white/60'}`}>
                        <span className="text-[11px]">💨</span>
                        <span className="text-[11px] font-medium" style={{ color: isNight ? '#d1d5db' : wind.color }}>
                          {wind.ms}m/s {wind.label}
                        </span>
                      </div>
                    );
                  })()}
                </div>
                {/* 추가 날씨 정보 - 한 줄로 표시 */}
                <div className="flex items-center gap-2 flex-wrap mt-1.5">
                  {displayWeather.chanceOfRain !== null && displayWeather.chanceOfRain !== undefined && displayWeather.chanceOfRain > 0 && (
                    <div className={`flex items-center gap-0.5 text-[10px] ${tertiaryTextColor}`}>
                      <span className="font-medium">강수확률</span>
                      <span>{displayWeather.chanceOfRain}%</span>
                    </div>
                  )}
                  {displayWeather.precipMm !== null && displayWeather.precipMm !== undefined && displayWeather.precipMm > 0 && (
                    <div className={`flex items-center gap-0.5 text-[10px] ${tertiaryTextColor}`}>
                      <span className="font-medium">강수량</span>
                      <span>{displayWeather.precipMm}mm</span>
                    </div>
                  )}
                </div>
                </div>
              </div>
            </div>
          </div>

          {/* 준비물 추천 */}
          {(() => {
            const recommendations = getWeatherRecommendations(
              displayWeather.weather,
              displayWeather.temperature,
              displayWeather.airQualityIndex
            );
            if (recommendations.length === 0) return null;
            return (
              <div className={`border-t ${weatherStyle.border} pt-2 space-y-0.5`}>
                <p className="text-[10px] font-semibold text-gray-700">준비물 추천</p>
                {recommendations.map((rec, idx) => (
                  <p key={idx} className="text-[10px] text-gray-600">• {rec}</p>
                ))}
              </div>
            );
          })()}
        </div>
        </div>
      );
    })()}

      {/* 심판 타이머 (친선경기 + 심판배정 있을 때) */}
      {event.isFriendlyMatch && event.refereeAssignment && event.refereeAssignment.quarterReferees.length > 0 && (
        <RefereeTimerSection
          refereeAssignment={event.refereeAssignment}
          quarterMinutes={event.matchRules?.quarterMinutes || 20}
        />
      )}

      {/* 체크인 (운동 2시간 전부터) */}
      {canCheckIn && (
        <div className="bg-white rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">체크인</h3>
          {event.myCheckIn ? (
            <div className="text-center py-3">
              <div className="text-green-500 text-lg font-semibold flex items-center justify-center gap-2">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5l10 -10" />
                </svg>
                <span>체크인 완료</span>
              </div>
              <div className="text-sm text-gray-500 mt-1">
                도착: {new Date(event.myCheckIn).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
              </div>
              <button
                onClick={handleCancelCheckIn}
                disabled={submitting}
                className="mt-3 text-sm text-gray-500 hover:text-gray-700 underline disabled:opacity-50"
              >
                체크인 취소
              </button>
            </div>
          ) : (rsvpStatus === "ATTEND" || rsvpStatus === "LATE") ? (
            <button
              onClick={handleCheckIn}
              disabled={submitting}
              className="w-full py-3 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? (
                "체크인 중..."
              ) : (
                <>
                  <Check className="w-[18px] h-[18px]" strokeWidth={2.5} />
                  <span>도착 체크인</span>
                </>
              )}
            </button>
          ) : (
            <p className="text-sm text-gray-400 text-center py-3">
              RSVP 후 체크인할 수 있습니다
            </p>
          )}
        </div>
      )}

      {/* POM 투표 (체크인한 사람들 대상) - enablePomVoting이 true이고 체크인한 사람들이 있을 때만 표시 */}
      {event.enablePomVoting && event.checkIns.length > 0 && (
        <div className="bg-white rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setShowPomVoting(!showPomVoting)}>
            <h3 className="text-sm font-semibold text-gray-900">MVP 투표</h3>
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showPomVoting ? '' : 'rotate-180'}`} />
          </div>
          {showPomVoting && (
            <div className="pt-3 border-t border-gray-100">
              <PomVoting
                eventId={event.id}
                eventDate={event.date}
                pomVotingDeadline={event.pomVotingDeadline}
                pomVotesPerPerson={event.pomVotesPerPerson}
                checkIns={event.checkIns}
                teamName={teamData?.name}
              />
            </div>
          )}
        </div>
      )}

      {/* 참석 현황 */}
      <div className="bg-white rounded-xl p-5">
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">참석 현황</h3>
              {event.checkIns.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {event.checkIns.length}/{attendees.length + lateComers.length}명 도착
                </p>
              )}
            </div>
          </div>
        </div>

        {/* 응답 마감 (마감 전에만 표시) */}
        {!isDeadlinePassed && (
          <div className="text-sm text-gray-600 mb-4 pb-3 border-b border-gray-100">
            응답 마감: {deadlineStr}~까지
          </div>
        )}

        {/* 나의 응답 입력 (미응답자만) */}
        {!isDeadlinePassed && !event.myRsvp && (
          <div className="mb-4 pb-4 border-b border-gray-100">
            <h4 className="text-xs font-semibold text-gray-700 mb-3">나의 응답</h4>
            <div className="flex gap-2 mb-3">
              {(["ATTEND", "ABSENT", "LATE"] as RsvpStatus[]).map((s) => {
                const labels = { ATTEND: "정참", ABSENT: "불참", LATE: "늦참" };
                const colors = {
                  ATTEND: rsvpStatus === "ATTEND" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700",
                  ABSENT: rsvpStatus === "ABSENT" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-700",
                  LATE: rsvpStatus === "LATE" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700",
                };
                return (
                  <button
                    key={s}
                    onClick={() => {
                      if (s === "ATTEND") handleRsvp("ATTEND");
                      else setRsvpStatus(s);
                    }}
                    disabled={submitting}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${colors[s]}`}
                  >
                    {labels[s]}
                  </button>
                );
              })}
            </div>
            {(rsvpStatus === "ABSENT" || rsvpStatus === "LATE") && (
              <div className="space-y-2">
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="사유를 입력해주세요"
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
                />
                <button
                  onClick={() => handleRsvp(rsvpStatus)}
                  disabled={!reason.trim() || submitting}
                  className="w-full py-2 bg-team-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                >
                  {submitting ? "전송 중..." : "응답 제출"}
                </button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
        {attendees.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between py-3 cursor-pointer"
              onClick={() => setShowAttendees(!showAttendees)}
            >
              <div className="text-xs font-semibold text-gray-700">정참 ({attendees.length}명)</div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showAttendees ? '' : 'rotate-180'}`} />
            </div>
            {showAttendees && (
            <div className="pb-3 space-y-2">
              {attendees.map((r: RsvpEntry) => {
                const isMe = r.user.id === session?.user?.id;
                const checkIn = checkInsMap.get(r.userId);
                return (
                  <div key={r.id}>
                    <div
                      className={`flex items-center gap-3 py-1.5 ${!isMe ? "cursor-pointer rounded-lg hover:bg-gray-50 -mx-2 px-2" : ""}`}
                      onClick={() => { if (!isMe) openMemberSheet(r.userId, r.user.name); }}
                    >
                      {/* 프로필 이미지 */}
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {r.user.image ? (
                          <Image
                            src={r.user.image}
                            alt={r.user.name || ""}
                            width={24}
                            height={24}
                            sizes="24px"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-team-50" />
                        )}
                      </div>

                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {/* 이름 */}
                        <span className="text-sm font-medium text-gray-900">
                          {r.user.name || "익명"}
                        </span>

                        {/* 뱃지 및 버튼 */}
                        {!isAdmin && (
                          <div className="flex items-center gap-2 ml-auto">
                            {checkIn && (
                              <span className="text-xs text-gray-400">
                                {new Date(checkIn.checkedInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            <StatusBadge status="ATTEND" />
                            {isMe && !isDeadlinePassed && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEditRsvp(!showEditRsvp);
                                }}
                                className="text-xs text-team-600 hover:text-team-700 font-medium underline"
                              >
                                수정
                              </button>
                            )}
                          </div>
                        )}
                        {isAdmin && (
                          <div className="flex items-center gap-2 ml-auto">
                            {checkIn && (
                              <span className="text-xs text-gray-400">
                                {new Date(checkIn.checkedInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                            <AdminRsvpPicker
                              userId={r.userId}
                              currentStatus="ATTEND"
                              updating={adminUpdatingId === r.userId}
                              onUpdate={handleAdminRsvp}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                    {!isAdmin && isMe && showEditRsvp && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex gap-2">
                          {(["ATTEND", "ABSENT", "LATE"] as RsvpStatus[]).map((s) => {
                            const labels = { ATTEND: "정참", ABSENT: "불참", LATE: "늦참" };
                            const colors = {
                              ATTEND: rsvpStatus === "ATTEND" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700",
                              ABSENT: rsvpStatus === "ABSENT" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-700",
                              LATE: rsvpStatus === "LATE" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700",
                            };
                            return (
                              <button
                                key={s}
                                onClick={() => {
                                  if (s === "ATTEND") {
                                    handleRsvp("ATTEND");
                                    setShowEditRsvp(false);
                                  } else {
                                    setRsvpStatus(s);
                                  }
                                }}
                                disabled={submitting}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${colors[s]}`}
                              >
                                {labels[s]}
                              </button>
                            );
                          })}
                        </div>
                        {(rsvpStatus === "ABSENT" || rsvpStatus === "LATE") && (
                          <div className="space-y-2">
                            <textarea
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="사유를 입력해주세요"
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
                            />
                            <button
                              onClick={() => {
                                handleRsvp(rsvpStatus);
                                setShowEditRsvp(false);
                              }}
                              disabled={!reason.trim() || submitting}
                              className="w-full py-2 bg-team-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                              {submitting ? "전송 중..." : "응답 수정"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}
        {absentees.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between py-3 cursor-pointer"
              onClick={() => setShowAbsentees(!showAbsentees)}
            >
              <div className="text-xs font-semibold text-gray-700">불참 ({absentees.length}명)</div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showAbsentees ? '' : 'rotate-180'}`} />
            </div>
            {showAbsentees && (
            <div className="pb-3 space-y-2">
              {absentees.map((r: RsvpEntry) => {
                const isMe = r.user.id === session?.user?.id;
                return (
                  <div key={r.id}>
                    <div
                      className={`flex items-center gap-3 py-1.5 ${!isMe ? "cursor-pointer rounded-lg hover:bg-gray-50 -mx-2 px-2" : ""}`}
                      onClick={() => { if (!isMe) openMemberSheet(r.userId, r.user.name); }}
                    >
                      {/* 프로필 이미지 */}
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {r.user.image ? (
                          <Image
                            src={r.user.image}
                            alt={r.user.name || ""}
                            width={24}
                            height={24}
                            sizes="24px"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-team-50" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {/* 이름 */}
                          <span className="text-sm font-medium text-gray-900">
                            {r.user.name || "익명"}
                          </span>

                          {/* 뱃지 및 버튼 */}
                          {!isAdmin && (
                            <div className="flex items-center gap-2 ml-auto">
                              <StatusBadge status="ABSENT" />
                              {isMe && !isDeadlinePassed && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowEditRsvp(!showEditRsvp);
                                  }}
                                  className="text-xs text-team-600 hover:text-team-700 font-medium underline"
                                >
                                  수정
                                </button>
                              )}
                            </div>
                          )}
                          {isAdmin && (
                            <AdminRsvpPicker
                              userId={r.userId}
                              currentStatus="ABSENT"
                              updating={adminUpdatingId === r.userId}
                              onUpdate={handleAdminRsvp}
                            />
                          )}
                        </div>
                        {/* 불참 사유 */}
                        <div className="text-xs text-gray-500 mt-0.5">{r.reason}</div>
                      </div>
                    </div>
                    {!isAdmin && isMe && showEditRsvp && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex gap-2">
                          {(["ATTEND", "ABSENT", "LATE"] as RsvpStatus[]).map((s) => {
                            const labels = { ATTEND: "정참", ABSENT: "불참", LATE: "늦참" };
                            const colors = {
                              ATTEND: rsvpStatus === "ATTEND" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700",
                              ABSENT: rsvpStatus === "ABSENT" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-700",
                              LATE: rsvpStatus === "LATE" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700",
                            };
                            return (
                              <button
                                key={s}
                                onClick={() => {
                                  if (s === "ATTEND") {
                                    handleRsvp("ATTEND");
                                    setShowEditRsvp(false);
                                  } else {
                                    setRsvpStatus(s);
                                  }
                                }}
                                disabled={submitting}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${colors[s]}`}
                              >
                                {labels[s]}
                              </button>
                            );
                          })}
                        </div>
                        {(rsvpStatus === "ABSENT" || rsvpStatus === "LATE") && (
                          <div className="space-y-2">
                            <textarea
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="사유를 입력해주세요"
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
                            />
                            <button
                              onClick={() => {
                                handleRsvp(rsvpStatus);
                                setShowEditRsvp(false);
                              }}
                              disabled={!reason.trim() || submitting}
                              className="w-full py-2 bg-team-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                              {submitting ? "전송 중..." : "응답 수정"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}
        {lateComers.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between py-3 cursor-pointer"
              onClick={() => setShowLateComers(!showLateComers)}
            >
              <div className="text-xs font-semibold text-gray-700">늦참 ({lateComers.length}명)</div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showLateComers ? '' : 'rotate-180'}`} />
            </div>
            {showLateComers && (
            <div className="pb-3 space-y-2">
              {lateComers.map((r: RsvpEntry) => {
                const isMe = r.user.id === session?.user?.id;
                const checkIn = checkInsMap.get(r.userId);
                return (
                  <div key={r.id}>
                    <div
                      className={`flex items-center gap-3 py-1.5 ${!isMe ? "cursor-pointer rounded-lg hover:bg-gray-50 -mx-2 px-2" : ""}`}
                      onClick={() => { if (!isMe) openMemberSheet(r.userId, r.user.name); }}
                    >
                      {/* 프로필 이미지 */}
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {r.user.image ? (
                          <Image
                            src={r.user.image}
                            alt={r.user.name || ""}
                            width={24}
                            height={24}
                            sizes="24px"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full bg-team-50" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          {/* 이름 */}
                          <span className="text-sm font-medium text-gray-900">
                            {r.user.name || "익명"}
                          </span>

                          {/* 뱃지 및 버튼 */}
                          {!isAdmin && (
                            <div className="flex items-center gap-2 ml-auto">
                              {checkIn && (
                                <span className="text-xs text-gray-400">
                                  {new Date(checkIn.checkedInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                              <StatusBadge status="LATE" />
                              {isMe && !isDeadlinePassed && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowEditRsvp(!showEditRsvp);
                                  }}
                                  className="text-xs text-team-600 hover:text-team-700 font-medium underline"
                                >
                                  수정
                                </button>
                              )}
                            </div>
                          )}
                          {isAdmin && (
                            <div className="flex items-center gap-2 ml-auto">
                              {checkIn && (
                                <span className="text-xs text-gray-400">
                                  {new Date(checkIn.checkedInAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              )}
                              <AdminRsvpPicker
                                userId={r.userId}
                                currentStatus="LATE"
                                updating={adminUpdatingId === r.userId}
                                onUpdate={handleAdminRsvp}
                              />
                            </div>
                          )}
                        </div>
                        {/* 늦참 사유 */}
                        <div className="text-xs text-gray-500 mt-0.5">{r.reason}</div>
                      </div>
                    </div>
                    {!isAdmin && isMe && showEditRsvp && (
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                        <div className="flex gap-2">
                          {(["ATTEND", "ABSENT", "LATE"] as RsvpStatus[]).map((s) => {
                            const labels = { ATTEND: "정참", ABSENT: "불참", LATE: "늦참" };
                            const colors = {
                              ATTEND: rsvpStatus === "ATTEND" ? "bg-green-500 text-white" : "bg-gray-100 text-gray-700",
                              ABSENT: rsvpStatus === "ABSENT" ? "bg-red-500 text-white" : "bg-gray-100 text-gray-700",
                              LATE: rsvpStatus === "LATE" ? "bg-yellow-500 text-white" : "bg-gray-100 text-gray-700",
                            };
                            return (
                              <button
                                key={s}
                                onClick={() => {
                                  if (s === "ATTEND") {
                                    handleRsvp("ATTEND");
                                    setShowEditRsvp(false);
                                  } else {
                                    setRsvpStatus(s);
                                  }
                                }}
                                disabled={submitting}
                                className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${colors[s]}`}
                              >
                                {labels[s]}
                              </button>
                            );
                          })}
                        </div>
                        {(rsvpStatus === "ABSENT" || rsvpStatus === "LATE") && (
                          <div className="space-y-2">
                            <textarea
                              value={reason}
                              onChange={(e) => setReason(e.target.value)}
                              placeholder="사유를 입력해주세요"
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
                            />
                            <button
                              onClick={() => {
                                handleRsvp(rsvpStatus);
                                setShowEditRsvp(false);
                              }}
                              disabled={!reason.trim() || submitting}
                              className="w-full py-2 bg-team-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                            >
                              {submitting ? "전송 중..." : "응답 수정"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            )}
          </div>
        )}
        {noShows.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between py-3 cursor-pointer"
              onClick={() => setShowNoShows(!showNoShows)}
            >
              <div className="text-xs font-semibold text-gray-700">노쇼 ({noShows.length}명)</div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showNoShows ? '' : 'rotate-180'}`} />
            </div>
            {showNoShows && (
            <div className="pb-3 space-y-2">
              {noShows.map((r: RsvpEntry) => (
                <div
                  key={r.id}
                  className={`flex items-center gap-3 py-1.5 ${r.userId !== session?.user?.id ? "cursor-pointer rounded-lg hover:bg-gray-50 -mx-2 px-2" : ""}`}
                  onClick={() => { if (r.userId !== session?.user?.id) openMemberSheet(r.userId, r.user.name); }}
                >
                  <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                    {r.user.image ? (
                      <Image
                        src={r.user.image}
                        alt={r.user.name || ""}
                        width={24}
                        height={24}
                        sizes="24px"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-team-50" />
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-900 flex-1 min-w-0">{r.user.name || "익명"}</span>
                  {!isAdmin && <StatusBadge status="NO_SHOW" />}
                  {isAdmin && (
                    <AdminRsvpPicker
                      userId={r.userId}
                      currentStatus="NO_SHOW"
                      updating={adminUpdatingId === r.userId}
                      onUpdate={handleAdminRsvp}
                    />
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
        )}
        {noResponse.length > 0 && (
          <div>
            <div
              className="flex items-center justify-between py-3 cursor-pointer"
              onClick={() => setShowNoResponse(!showNoResponse)}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-gray-700">미응답 ({noResponse.length}명)</span>
                {session?.user?.role === "ADMIN" && noResponse.length > 0 && (
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (submitting) return;
                      if (!confirm(`미응답자 ${noResponse.length}명에게 알림을 보내시겠습니까?`)) return;

                      try {
                        const res = await fetch(`/api/training-events/${event.id}/notify-rsvp`, {
                          method: "POST",
                        });
                        const data = await res.json();
                        if (res.ok) {
                          showToast(`${data.recipientCount}명에게 알림을 보냈습니다 ✓`);
                        } else {
                          showToast(data.error || "알림 전송에 실패했습니다");
                        }
                      } catch (error) {
                        showToast("알림 전송에 실패했습니다");
                      }
                    }}
                    className="flex items-center gap-0.5 text-xs text-team-600 hover:text-team-700 font-medium px-1.5 py-0.5 rounded hover:bg-team-50"
                  >
                    <Bell className="w-3 h-3" strokeWidth={2} />
                    <span>독려</span>
                  </button>
                )}
              </div>
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showNoResponse ? '' : 'rotate-180'}`} />
            </div>
            {showNoResponse && (
            <div className="pb-3 space-y-2">
              {noResponse.map((member) => (
                  <div
                    key={member.id}
                    className={`flex items-center gap-3 py-1.5 ${member.id !== session?.user?.id ? "cursor-pointer rounded-lg hover:bg-gray-50 -mx-2 px-2" : ""}`}
                    onClick={() => { if (member.id !== session?.user?.id) openMemberSheet(member.id, member.name, member.phoneNumber); }}
                  >
                    {/* 프로필 이미지 */}
                    <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={member.name || ""}
                          width={24}
                          height={24}
                          sizes="24px"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-team-50" />
                      )}
                    </div>

                    <span className="text-sm font-medium text-gray-900 flex-1 min-w-0">
                      {member.name || "익명"}
                    </span>

                    {!isAdmin && <StatusBadge status={null} />}
                    {isAdmin && (
                      <AdminRsvpPicker
                        userId={member.id}
                        currentStatus={null}
                        updating={adminUpdatingId === member.id}
                        onUpdate={handleAdminRsvp}
                      />
                    )}
                  </div>
              ))}
            </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* 세션 정보 (모두 볼 수 있음) */}
      {event.sessions.length > 0 && (
        <div className="bg-white rounded-xl p-5">
          <div className="flex items-center justify-between mb-3 cursor-pointer" onClick={() => setShowSessions(!showSessions)}>
            <h3 className="text-sm font-semibold text-gray-900">세션</h3>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-gray-500 transition-transform ${showSessions ? '' : 'rotate-180'}`}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </div>
          {showSessions && (
          <div className="pt-3 border-t border-gray-100 space-y-3">
            {event.sessions.map((s, idx) => (
              <div key={s.id}>
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-team-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                    {idx + 1}
                  </span>
                  <h4 className="text-sm font-semibold text-gray-900">
                    {s.title || `세션 ${idx + 1}`}
                  </h4>
                </div>
                {s.memo && <p className="text-xs text-gray-500 mt-1 ml-8">{s.memo}</p>}
                {s.teamAssignments.length > 0 && (
                  <div className="mt-2.5 space-y-2">
                    {Object.entries(
                      s.teamAssignments.reduce<Record<string, { name: string; position: string | null }[]>>((acc, a) => {
                        if (!acc[a.teamLabel]) acc[a.teamLabel] = [];
                        acc[a.teamLabel].push({
                          name: a.user.name || "이름 없음",
                          position: a.user.position || null,
                        });
                        return acc;
                      }, {})
                    ).sort((a, b) => a[0].localeCompare(b[0])).map(([label, members]) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-3">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 bg-team-500 text-white text-[11px] font-bold rounded-md whitespace-nowrap">
                            {label}
                          </span>
                          <span className="text-xs text-gray-500">{members.length}명</span>
                        </div>
                        <div className="flex flex-wrap gap-x-1 gap-y-1">
                          {members.map((m, i) => (
                            <span key={i} className="text-[13px] text-gray-700">
                              {m.name}{i < members.length - 1 && <span className="text-gray-300 mx-0.5">·</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      )}

      {/* Toast */}
      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />

      {/* 팀원 바텀시트 */}
      {mounted && selectedMember && createPortal(
        <>
          <div
            onClick={() => { setSelectedMember(null); setNudgeMessage(""); }}
            className="fixed inset-0 bg-black/50 z-50"
          />
          <div
            onClick={(e) => e.stopPropagation()}
            className="fixed bottom-0 left-0 right-0 z-51 animate-slide-up"
          >
            <div className="bg-white rounded-t-[20px] max-w-lg mx-auto px-5 pt-3 pb-6">
              {/* 핸들바 */}
              <div className="relative flex justify-center mb-5">
                <div className="w-10 h-1 bg-gray-300 rounded-full self-center" />
                {selectedMember.phoneNumber ? (
                  <a
                    href={`tel:${selectedMember.phoneNumber}`}
                    className="absolute left-0 top-1/2 -translate-y-1/2 p-1.5 text-team-500"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 5.54 5.54l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </a>
                ) : (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 p-1.5 text-gray-300">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.62 3.38 2 2 0 0 1 3.59 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.56a16 16 0 0 0 5.54 5.54l.94-.94a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  </div>
                )}
              </div>
              {/* 헤더 */}
              <div className="text-center mb-5">
                <h3 className="text-lg font-bold text-gray-900 mb-1">{selectedMember.name} 닦달하기</h3>
                <p className="text-xs text-gray-400">한 사람에게 하루에 한 번만 닦달할 수 있어요</p>
              </div>
              {!nudgedToday.has(selectedMember.id) && (
                <div className="mb-5">
                  <div className="relative">
                    <textarea
                      value={nudgeMessage}
                      onChange={(e) => { if (e.target.value.length <= 50) setNudgeMessage(e.target.value); }}
                      placeholder="닦달 메시지를 입력하세요 (선택)"
                      rows={2}
                      maxLength={50}
                      className="w-full p-3 pb-7 bg-gray-50 border border-gray-200 rounded-xl text-sm resize-none outline-none focus:border-team-500 transition-colors"
                    />
                    <div className={`absolute bottom-2 right-3 text-[11px] ${nudgeMessage.length >= 50 ? "text-red-500" : "text-gray-400"}`}>
                      {nudgeMessage.length}/50
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => handleNudge(selectedMember.id, selectedMember.name || "팀원")}
                disabled={nudgedToday.has(selectedMember.id)}
                className={`w-full py-3.5 rounded-[14px] font-semibold transition-all flex items-center justify-center gap-2 ${
                  nudgedToday.has(selectedMember.id)
                    ? "bg-gray-50 text-gray-400 cursor-not-allowed border-2 border-gray-200"
                    : "bg-team-500 text-white hover:bg-team-600 active:scale-[0.98]"
                }`}
              >
                {nudgedToday.has(selectedMember.id) ? (
                  <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>오늘 닦달 완료</>
                ) : (
                  <><span className="text-xl">👉</span>닦달하기</>
                )}
              </button>
              <div className="flex gap-2.5 mt-6">
                <Link
                  href={`/locker/${selectedMember.id}`}
                  onClick={() => { setSelectedMember(null); setNudgeMessage(""); }}
                  className="flex-1 py-2.5 bg-team-50 text-team-600 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  🗃️ 락커 보기
                </Link>
                <Link
                  href={`/locker/${selectedMember.id}?openNote=true`}
                  onClick={() => { setSelectedMember(null); setNudgeMessage(""); }}
                  className="flex-1 py-2.5 bg-team-50 text-team-600 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-1.5 active:scale-[0.98]"
                >
                  💌 칭찬 쪽지 놓고 오기
                </Link>
              </div>
            </div>
          </div>
        </>,
        document.getElementById("modal-root")!
      )}
    </div>
  );
}

// 읽기 전용 상태 칩 (non-admin)
function StatusBadge({ status }: { status: "ATTEND" | "ABSENT" | "LATE" | "NO_SHOW" | null }) {
  const map: Record<string, { label: string; cls: string }> = {
    ATTEND:  { label: "정참", cls: "bg-green-100 text-green-700" },
    LATE:    { label: "늦참", cls: "bg-yellow-100 text-yellow-700" },
    ABSENT:  { label: "불참", cls: "bg-orange-100 text-orange-700" },
    NO_SHOW: { label: "노쇼", cls: "bg-red-100 text-red-700" },
  };
  const chip = status ? map[status] : { label: "미응답", cls: "bg-gray-100 text-gray-400" };
  return (
    <span className={`px-2 py-1 rounded-full text-[11px] font-medium shrink-0 ${chip.cls}`}>
      {chip.label}
    </span>
  );
}

// 어드민용 출석 상태 칩 — 탭하면 바텀시트로 선택
function AdminRsvpPicker({
  userId,
  currentStatus,
  updating,
  onUpdate,
}: {
  userId: string;
  currentStatus: "ATTEND" | "ABSENT" | "LATE" | "NO_SHOW" | null;
  updating: boolean;
  onUpdate: (userId: string, status: "ATTEND" | "ABSENT" | "LATE" | "NO_SHOW") => void;
}) {
  const [open, setOpen] = useState(false);

  const chipMap: Record<string, { label: string; cls: string }> = {
    ATTEND:  { label: "정참", cls: "bg-green-100 text-green-700" },
    LATE:    { label: "늦참", cls: "bg-yellow-100 text-yellow-700" },
    ABSENT:  { label: "불참", cls: "bg-orange-100 text-orange-700" },
    NO_SHOW: { label: "노쇼", cls: "bg-red-100 text-red-700" },
  };
  const chip = currentStatus ? chipMap[currentStatus] : { label: "미응답", cls: "bg-gray-100 text-gray-400" };

  const options: { s: "ATTEND" | "LATE" | "ABSENT" | "NO_SHOW"; label: string; textCls: string }[] = [
    { s: "ATTEND",  label: "정참", textCls: "text-green-700" },
    { s: "LATE",    label: "늦참", textCls: "text-yellow-700" },
    { s: "ABSENT",  label: "불참", textCls: "text-orange-700" },
    { s: "NO_SHOW", label: "노쇼",  textCls: "text-red-700" },
  ];

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        disabled={updating}
        className={`flex items-center gap-0.5 px-2 py-1 rounded-full text-[11px] font-medium ml-auto shrink-0 disabled:opacity-50 ${chip.cls}`}
      >
        {updating && (
          <span className="w-2.5 h-2.5 rounded-full border border-current border-t-transparent animate-spin mr-0.5" />
        )}
        {chip.label}
        <ChevronDown className="w-2.5 h-2.5 opacity-50" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full bg-white rounded-t-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-4 pb-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">출석 상태 변경</p>
            </div>
            <div className="p-3 pb-8 space-y-1">
              {options.map(({ s, label, textCls }) => (
                <button
                  key={s}
                  onClick={() => {
                    if (currentStatus !== s) onUpdate(userId, s);
                    setOpen(false);
                  }}
                  className={`w-full px-4 py-3 rounded-xl text-sm font-medium text-left flex items-center justify-between ${textCls} ${
                    currentStatus === s ? "bg-gray-100" : "hover:bg-gray-50"
                  }`}
                >
                  {label}
                  {currentStatus === s && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// 심판 타이머 쿼터 탭 + 타이머 래퍼
function RefereeTimerSection({
  refereeAssignment,
  quarterMinutes,
}: {
  refereeAssignment: NonNullable<TrainingEventDetail["refereeAssignment"]>;
  quarterMinutes: number;
}) {
  const quarters = refereeAssignment.quarterReferees
    .map((qr) => qr.quarter)
    .sort((a, b) => a - b);
  const [selectedQuarter, setSelectedQuarter] = useState(quarters[0] || 1);

  return (
    <div className="bg-white rounded-xl p-5 space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">경기 타이머</h3>

      {/* 쿼터 탭 */}
      {quarters.length > 1 && (
        <div className="flex gap-1.5">
          {quarters.map((q) => (
            <button
              key={q}
              onClick={() => setSelectedQuarter(q)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                selectedQuarter === q
                  ? "bg-team-500 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {q}쿼터
            </button>
          ))}
        </div>
      )}

      <RefereeTimer
        assignmentId={refereeAssignment.id}
        quarter={selectedQuarter}
        quarterDuration={quarterMinutes * 60}
      />
    </div>
  );
}
