"use client";

import { useState, useMemo, useCallback } from "react";
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
import { getAirQualityGrade, getWeatherRecommendations, getWeatherInKorean, getWeatherCardStyle, getWeatherIcon, getTimeOfDay, getUvGrade } from "@/lib/weather";

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
  const [rsvpStatus, setRsvpStatus] = useState<RsvpStatus | null>(event.myRsvp);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showEditRsvp, setShowEditRsvp] = useState(false);
  const [showAttendance, setShowAttendance] = useState(true);

  // 실시간 날씨 조회
  const shouldFetchWeather = event.venue?.latitude && event.venue?.longitude;
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
  const { attendees, absentees, lateComers, noResponse } = useMemo(() => {
    const attend: RsvpEntry[] = [];
    const absent: RsvpEntry[] = [];
    const late: RsvpEntry[] = [];
    const respondedIds = new Set<string>();
    for (const r of event.rsvps) {
      respondedIds.add(r.userId);
      if (r.status === "ATTEND") attend.push(r);
      else if (r.status === "ABSENT") absent.push(r);
      else if (r.status === "LATE") late.push(r);
    }
    const noResp = teamData?.members.filter((m) => !respondedIds.has(m.id)) || [];
    return { attendees: attend, absentees: absent, lateComers: late, noResponse: noResp };
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
        setRsvpStatus(status);
        onRefresh();
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.error || "응답 저장에 실패했습니다");
      }
    } catch {
      showToast("네트워크 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  }, [event.id, reason, onRefresh, showToast]);

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
            <span className="font-semibold">{dateStr}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {event.isFriendlyMatch && (
              <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full">친선경기</span>
            )}
            {event.isRegular && (
              <span className="px-2 py-0.5 bg-team-50 text-team-600 text-[10px] font-medium rounded-full">정기</span>
            )}
          </div>
        </div>
        {/* 상대팀 (친선경기) */}
        {event.isFriendlyMatch && event.opponentTeamName && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="w-4 h-4 text-team-500 flex-shrink-0" strokeWidth={1.5} />
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

      {/* 예상 날씨 카드 (미래 운동만) */}
      {displayWeather.weather && new Date(event.date) > new Date() && (() => {
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
                <div className="flex items-baseline gap-2 flex-wrap">
                  {displayWeather.temperature !== null && (
                    <>
                      <span className={`text-3xl font-extrabold ${textColor} tracking-tight`}>{displayWeather.temperature}°C</span>
                      {displayWeather.feelsLikeC !== null && displayWeather.feelsLikeC !== displayWeather.temperature && (
                        <span className={`text-xs ${secondaryTextColor} font-medium`}>체감 {displayWeather.feelsLikeC}°</span>
                      )}
                    </>
                  )}
                  {displayWeather.minTempC !== null && displayWeather.maxTempC !== null && (
                    <span className={`text-xs ${secondaryTextColor} font-semibold`}>
                      ↓{displayWeather.minTempC}° ↑{displayWeather.maxTempC}°
                    </span>
                  )}
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
                  {displayWeather.windKph !== null && displayWeather.windKph !== undefined && (
                    <div className={`flex items-center gap-0.5 text-[10px] ${tertiaryTextColor}`}>
                      <span className="font-medium">풍속</span>
                      <span>{displayWeather.windKph}km/h</span>
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
          quarterMinutes={event.matchRules?.quarterMinutes || 12}
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
            <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showPomVoting ? '' : '-rotate-90'}`} />
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
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showAttendees ? '' : '-rotate-90'}`} />
            </div>
            {showAttendees && (
            <div className="pb-3 space-y-2">
              {attendees.map((r: RsvpEntry) => {
                const isMe = r.user.id === session?.user?.id;
                const checkIn = checkInsMap.get(r.userId);
                return (
                  <div key={r.id}>
                    <div className="flex items-center gap-3 py-1.5">
                      {/* 프로필 이미지 */}
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {r.user.image ? (
                          <Image
                            src={r.user.image}
                            alt={r.user.name || ""}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                            unoptimized
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

                        {/* 체크인 시간 */}
                        {checkIn && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <span>
                              {new Date(checkIn.checkedInAt).toLocaleTimeString("ko-KR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            {checkIn.isLate ? (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-red-500 flex-shrink-0">
                                <circle cx="12" cy="12" r="10" fill="currentColor" />
                              </svg>
                            ) : (
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-green-500 flex-shrink-0">
                                <circle cx="12" cy="12" r="10" fill="currentColor" />
                                <path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </span>
                        )}

                        {/* 뱃지 및 버튼 */}
                        {isMe && !isDeadlinePassed && (
                          <div className="flex items-center gap-2 ml-auto">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowEditRsvp(!showEditRsvp);
                              }}
                              className="text-xs text-team-600 hover:text-team-700 font-medium underline"
                            >
                              수정
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {isMe && showEditRsvp && (
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
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showAbsentees ? '' : '-rotate-90'}`} />
            </div>
            {showAbsentees && (
            <div className="pb-3 space-y-2">
              {absentees.map((r: RsvpEntry) => {
                const isMe = r.user.id === session?.user?.id;
                return (
                  <div key={r.id}>
                    <div className="flex items-center gap-3 py-1.5">
                      {/* 프로필 이미지 */}
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {r.user.image ? (
                          <Image
                            src={r.user.image}
                            alt={r.user.name || ""}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                            unoptimized
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
                          {isMe && !isDeadlinePassed && (
                            <div className="flex items-center gap-2 ml-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEditRsvp(!showEditRsvp);
                                }}
                                className="text-xs text-team-600 hover:text-team-700 font-medium underline"
                              >
                                수정
                              </button>
                            </div>
                          )}
                        </div>
                        {/* 불참 사유 */}
                        <div className="text-xs text-gray-500 mt-0.5">{r.reason}</div>
                      </div>
                    </div>
                    {isMe && showEditRsvp && (
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
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showLateComers ? '' : '-rotate-90'}`} />
            </div>
            {showLateComers && (
            <div className="pb-3 space-y-2">
              {lateComers.map((r: RsvpEntry) => {
                const isMe = r.user.id === session?.user?.id;
                const checkIn = checkInsMap.get(r.userId);
                return (
                  <div key={r.id}>
                    <div className="flex items-center gap-3 py-1.5">
                      {/* 프로필 이미지 */}
                      <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {r.user.image ? (
                          <Image
                            src={r.user.image}
                            alt={r.user.name || ""}
                            width={24}
                            height={24}
                            className="w-full h-full object-cover"
                            unoptimized
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

                          {/* 체크인 시간 */}
                          {checkIn && (
                            <span className="flex items-center gap-1 text-xs text-gray-500">
                              <span>
                                {new Date(checkIn.checkedInAt).toLocaleTimeString("ko-KR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                              {checkIn.isLate ? (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-red-500 flex-shrink-0">
                                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                                </svg>
                              ) : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="text-green-500 flex-shrink-0">
                                  <circle cx="12" cy="12" r="10" fill="currentColor" />
                                  <path d="M7 12l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                          )}

                          {/* 뱃지 및 버튼 */}
                          {isMe && !isDeadlinePassed && (
                            <div className="flex items-center gap-2 ml-auto">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowEditRsvp(!showEditRsvp);
                                }}
                                className="text-xs text-team-600 hover:text-team-700 font-medium underline"
                              >
                                수정
                              </button>
                            </div>
                          )}
                        </div>
                        {/* 늦참 사유 */}
                        <div className="text-xs text-gray-500 mt-0.5">{r.reason}</div>
                      </div>
                    </div>
                    {isMe && showEditRsvp && (
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
              <ChevronDown className={`w-3.5 h-3.5 text-gray-500 transition-transform ${showNoResponse ? '' : '-rotate-90'}`} />
            </div>
            {showNoResponse && (
            <div className="pb-3 space-y-2">
              {noResponse.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 py-1.5">
                    {/* 프로필 이미지 */}
                    <div className="w-6 h-6 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                      {member.image ? (
                        <Image
                          src={member.image}
                          alt={member.name || ""}
                          width={24}
                          height={24}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-team-50" />
                      )}
                    </div>

                    <span className="text-sm font-medium text-gray-900">
                      {member.name || "익명"}
                    </span>
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
              className={`text-gray-500 transition-transform ${showSessions ? '' : '-rotate-90'}`}
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
    </div>
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
