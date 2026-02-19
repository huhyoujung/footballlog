// 팀 운동 생성/수정 공유 폼 - 장소검색, 날씨, 유니폼, 조끼당번, MVP 투표 등 모든 폼 필드 포함
"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import Toast from "@/components/Toast";
import { useToast } from "@/lib/useToast";
import { Shirt } from "lucide-react";

function debounce<T extends (...args: Parameters<T>) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

// ── 타입 ──

export interface MemberOption {
  id: string;
  name: string | null;
  image: string | null;
}

export interface VenueOption {
  id?: string;
  name: string;
  address: string | null;
  roadAddress?: string;
  mapUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  surface?: string | null;
  recommendedShoes?: string[];
  usageCount?: number;
  category?: string;
}

interface UniformOption {
  id: string;
  name: string;
  color: string;
}

export interface TrainingEventFormData {
  title: string;
  isRegular: boolean;
  isFriendlyMatch: boolean;
  opponentTeam: string | null;
  minimumPlayers: number | null;
  enablePomVoting: boolean;
  pomVotingDeadline: string | null;
  pomVotesPerPerson: number;
  date: string;
  location: string;
  shoes: string[];
  uniform: string | null;
  notes: string | null;
  vestBringerId: string | null;
  vestReceiverId: string | null;
  rsvpDeadline: string;
  venueData: {
    address: string | null;
    mapUrl: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  weatherData: {
    weather: string;
    weatherDescription: string;
    temperature: number;
    airQualityIndex: number | null;
    pm25: number | null;
    pm10: number | null;
  } | null;
}

export interface InitialFormValues {
  title?: string;
  isRegular?: boolean;
  isFriendlyMatch?: boolean;
  minimumPlayers?: number;
  enablePomVoting?: boolean;
  pomVotingDeadlineDate?: string;
  pomVotingDeadlineTime?: string;
  pomVotesPerPerson?: number;
  date?: string;
  time?: string;
  location?: string;
  shoes?: string[];
  uniform?: string;
  notes?: string;
  vestBringerId?: string;
  vestReceiverId?: string;
  rsvpDeadlineDate?: string;
  rsvpDeadlineTime?: string;
  selectedVenue?: VenueOption | null;
  opponentTeam?: string;
}

interface Props {
  mode: "create" | "edit";
  initialValues?: InitialFormValues;
  members: MemberOption[];
  /** 생성 모드에서 조끼 당번 자동 추천 텍스트 표시 여부 */
  showVestSuggestion?: boolean;
  /** RSVP 마감 이후 친선경기 필드(상대팀, 최소인원 등) 수정 불가 */
  lockFriendlyFields?: boolean;
  onSubmit: (data: TrainingEventFormData) => Promise<void>;
  submitLabel: string;
  submittingLabel: string;
}

// ── 컴포넌트 ──

export default function TrainingEventForm({
  mode,
  initialValues,
  members,
  showVestSuggestion = false,
  lockFriendlyFields = false,
  onSubmit,
  submitLabel,
  submittingLabel,
}: Props) {
  const { toast, showToast, hideToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  // 폼 상태
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [isRegular, setIsRegular] = useState(initialValues?.isRegular ?? true);
  const [isFriendlyMatch, setIsFriendlyMatch] = useState(initialValues?.isFriendlyMatch ?? false);
  const [minimumPlayers, setMinimumPlayers] = useState(initialValues?.minimumPlayers ?? 11);
  const [enablePomVoting, setEnablePomVoting] = useState(initialValues?.enablePomVoting ?? true);
  const [pomVotingDeadlineDate, setPomVotingDeadlineDate] = useState(initialValues?.pomVotingDeadlineDate ?? "");
  const [pomVotingDeadlineTime, setPomVotingDeadlineTime] = useState(initialValues?.pomVotingDeadlineTime ?? "22:00");
  const [pomVotesPerPerson, setPomVotesPerPerson] = useState(initialValues?.pomVotesPerPerson ?? 1);
  const [date, setDate] = useState(initialValues?.date ?? "");
  const [time, setTime] = useState(initialValues?.time ?? "14:00");
  const [location, setLocation] = useState(initialValues?.location ?? "");
  const [shoes, setShoes] = useState<string[]>(initialValues?.shoes ?? []);
  const [uniform, setUniform] = useState(initialValues?.uniform ?? "");
  const [notes, setNotes] = useState(initialValues?.notes ?? "");
  const [vestBringerId, setVestBringerId] = useState(initialValues?.vestBringerId ?? "");
  const [vestReceiverId, setVestReceiverId] = useState(initialValues?.vestReceiverId ?? "");
  const [rsvpDeadlineDate, setRsvpDeadlineDate] = useState(initialValues?.rsvpDeadlineDate ?? "");
  const [rsvpDeadlineTime, setRsvpDeadlineTime] = useState(initialValues?.rsvpDeadlineTime ?? "22:00");
  const [opponentTeam, setOpponentTeam] = useState(initialValues?.opponentTeam ?? "");

  // 상대팀 검색
  const [teamResults, setTeamResults] = useState<{ id: string; name: string; logoUrl: string | null; _count: { members: number } }[]>([]);
  const [showTeamList, setShowTeamList] = useState(false);

  // 장소 검색
  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [showVenueList, setShowVenueList] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<VenueOption | null>(initialValues?.selectedVenue ?? null);

  // 날씨
  const [weather, setWeather] = useState<{
    weather: string;
    weatherDescription: string;
    temperature: number;
    airQualityIndex: number | null;
    pm25: number | null;
    pm10: number | null;
    icon: string;
  } | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);

  // 유니폼
  const [showUniformList, setShowUniformList] = useState(false);
  const [selectedUniformColor, setSelectedUniformColor] = useState<string | null>(null);

  // initialValues가 바뀌면 (edit 모드에서 서버 데이터 로드 시) 폼 갱신
  useEffect(() => {
    if (!initialValues) return;
    if (initialValues.title !== undefined) setTitle(initialValues.title);
    if (initialValues.isRegular !== undefined) setIsRegular(initialValues.isRegular);
    if (initialValues.isFriendlyMatch !== undefined) setIsFriendlyMatch(initialValues.isFriendlyMatch);
    if (initialValues.minimumPlayers !== undefined) setMinimumPlayers(initialValues.minimumPlayers);
    if (initialValues.enablePomVoting !== undefined) setEnablePomVoting(initialValues.enablePomVoting);
    if (initialValues.pomVotingDeadlineDate !== undefined) setPomVotingDeadlineDate(initialValues.pomVotingDeadlineDate);
    if (initialValues.pomVotingDeadlineTime !== undefined) setPomVotingDeadlineTime(initialValues.pomVotingDeadlineTime);
    if (initialValues.pomVotesPerPerson !== undefined) setPomVotesPerPerson(initialValues.pomVotesPerPerson);
    if (initialValues.date !== undefined) setDate(initialValues.date);
    if (initialValues.time !== undefined) setTime(initialValues.time);
    if (initialValues.location !== undefined) setLocation(initialValues.location);
    if (initialValues.shoes !== undefined) setShoes(initialValues.shoes);
    if (initialValues.uniform !== undefined) setUniform(initialValues.uniform);
    if (initialValues.notes !== undefined) setNotes(initialValues.notes);
    if (initialValues.vestBringerId !== undefined) setVestBringerId(initialValues.vestBringerId);
    if (initialValues.vestReceiverId !== undefined) setVestReceiverId(initialValues.vestReceiverId);
    if (initialValues.rsvpDeadlineDate !== undefined) setRsvpDeadlineDate(initialValues.rsvpDeadlineDate);
    if (initialValues.rsvpDeadlineTime !== undefined) setRsvpDeadlineTime(initialValues.rsvpDeadlineTime);
    if (initialValues.selectedVenue !== undefined) setSelectedVenue(initialValues.selectedVenue);
    if (initialValues.opponentTeam !== undefined) setOpponentTeam(initialValues.opponentTeam);
  }, [initialValues]);

  // ── 유니폼 ──

  const { data: uniformData } = useSWR<{ uniforms: UniformOption[] }>(
    "/api/teams/uniforms",
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 300000 }
  );
  const uniforms = uniformData?.uniforms || [];

  const handleUniformChange = (value: string) => {
    setUniform(value);
    const matched = uniforms.find((u) => u.name.toLowerCase() === value.toLowerCase());
    if (matched) {
      setSelectedUniformColor(matched.color);
      setShowUniformList(false);
    } else {
      setSelectedUniformColor(null);
      if (value.trim()) {
        const filtered = uniforms.filter((u) => u.name.toLowerCase().includes(value.toLowerCase()));
        setShowUniformList(filtered.length > 0);
      } else {
        setShowUniformList(false);
      }
    }
  };

  const handleUniformSelect = (opt: UniformOption) => {
    setUniform(opt.name);
    setSelectedUniformColor(opt.color);
    setShowUniformList(false);
  };

  // ── 상대팀 검색 (디바운스) ──

  const searchTeams = async (query: string) => {
    if (!query.trim()) {
      setTeamResults([]);
      setShowTeamList(false);
      return;
    }
    try {
      const res = await fetch(`/api/teams/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setTeamResults(data.teams || []);
        setShowTeamList(data.teams && data.teams.length > 0);
      }
    } catch {
      // ignore
    }
  };

  const debouncedSearchTeams = useMemo(() => debounce(searchTeams, 300), []);

  const handleOpponentTeamChange = (value: string) => {
    setOpponentTeam(value);
    debouncedSearchTeams(value);
  };

  const handleTeamSelect = (team: { name: string }) => {
    setOpponentTeam(team.name);
    setShowTeamList(false);
  };

  // ── 장소 검색 (디바운스) ──

  const searchVenues = async (query: string) => {
    if (!query.trim()) {
      setVenues([]);
      setShowVenueList(false);
      return;
    }
    try {
      const res = await fetch(`/api/places/search?query=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setVenues(data.places || []);
        setShowVenueList(data.places && data.places.length > 0);
      } else {
        console.error("장소 검색 실패:", res.status, await res.text().catch(() => ""));
      }
    } catch (err) {
      console.error("장소 검색 오류:", err);
    }
  };

  const debouncedSearchVenues = useMemo(() => debounce(searchVenues, 300), []);

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setSelectedVenue(null);
    debouncedSearchVenues(value);
  };

  // ── 날씨 ──

  const fetchWeather = async (venue: VenueOption, d: string, t: string) => {
    if (!venue.latitude || !venue.longitude || !d) return;
    setLoadingWeather(true);
    try {
      const res = await fetch(`/api/weather?lat=${venue.latitude}&lon=${venue.longitude}&date=${d}T${t}:00`);
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingWeather(false);
    }
  };

  const handleVenueSelect = (venue: VenueOption) => {
    setLocation(venue.name);
    setSelectedVenue(venue);
    if (venue.recommendedShoes) setShoes(venue.recommendedShoes);
    setShowVenueList(false);
    if (date && venue.latitude && venue.longitude) {
      fetchWeather(venue, date, time);
    }
  };

  // 날짜 또는 시간 변경 시 날씨 갱신
  useEffect(() => {
    if (selectedVenue && date && time && selectedVenue.latitude && selectedVenue.longitude) {
      fetchWeather(selectedVenue, date, time);
    }
  }, [date, time]);

  // ── 신발 ──

  const toggleShoe = (shoe: string) => {
    setShoes((prev) => (prev.includes(shoe) ? prev.filter((s) => s !== shoe) : [...prev, shoe]));
  };

  // ── 제출 ──

  const isFormComplete = title && date && time && location && rsvpDeadlineDate && rsvpDeadlineTime;

  const handleSubmit = async () => {
    if (!isFormComplete) return;
    setSubmitting(true);

    try {
      const dateTime = new Date(`${date}T${time}:00`);
      const rsvpDeadline = new Date(`${rsvpDeadlineDate}T${rsvpDeadlineTime}:00`);

      if (rsvpDeadline >= dateTime) {
        showToast("RSVP 마감은 운동 시간 전이어야 합니다");
        setSubmitting(false);
        return;
      }

      // POM 투표 마감
      let pomVotingDeadline: string | null = null;
      if (enablePomVoting) {
        if (pomVotingDeadlineDate && pomVotingDeadlineTime) {
          const pomDeadline = new Date(`${pomVotingDeadlineDate}T${pomVotingDeadlineTime}:00`);
          if (pomDeadline <= dateTime) {
            showToast("MVP 투표 마감은 운동 시간 이후여야 합니다");
            setSubmitting(false);
            return;
          }
          pomVotingDeadline = pomDeadline.toISOString();
        } else if (mode === "create") {
          // 생성 시 미설정이면 운동 2시간 후 기본값
          pomVotingDeadline = new Date(dateTime.getTime() + 2 * 60 * 60 * 1000).toISOString();
        }
      }

      await onSubmit({
        title,
        isRegular,
        isFriendlyMatch,
        opponentTeam: isFriendlyMatch ? (opponentTeam.trim() || null) : null,
        minimumPlayers: isFriendlyMatch ? minimumPlayers : null,
        enablePomVoting,
        pomVotingDeadline,
        pomVotesPerPerson: enablePomVoting ? pomVotesPerPerson : 0,
        date: dateTime.toISOString(),
        location,
        shoes,
        uniform: uniform || null,
        notes: notes || null,
        vestBringerId: vestBringerId || null,
        vestReceiverId: vestReceiverId || null,
        rsvpDeadline: rsvpDeadline.toISOString(),
        venueData: selectedVenue
          ? {
              address: selectedVenue.address,
              mapUrl: selectedVenue.mapUrl ?? null,
              latitude: selectedVenue.latitude ?? null,
              longitude: selectedVenue.longitude ?? null,
            }
          : null,
        weatherData: weather
          ? {
              weather: weather.weather,
              weatherDescription: weather.weatherDescription,
              temperature: weather.temperature,
              airQualityIndex: weather.airQualityIndex,
              pm25: weather.pm25,
              pm10: weather.pm10,
            }
          : null,
      });
    } catch (err) {
      let errorMessage = "오류가 발생했습니다";
      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes("401") || msg.includes("unauthorized")) errorMessage = "로그인이 필요합니다";
        else if (msg.includes("403") || msg.includes("forbidden")) errorMessage = "권한이 없습니다";
        else if (msg.includes("운영진")) errorMessage = "운영진만 생성할 수 있습니다";
        else errorMessage = err.message;
      }
      showToast(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // ── JSX ──

  return (
    <>
      <div className="space-y-6">
        {/* ── 섹션 1: 기본 정보 ── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">기본 정보</h3>
          <div className="bg-white rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 주말 운동"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">날짜</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full min-w-0 px-3 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-sm font-medium text-gray-700 mb-2">시간</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full min-w-0 px-3 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2">
              <div>
                <span className="text-sm font-medium text-gray-700">정기 운동</span>
                <p className="text-xs text-gray-400 mt-0.5">출석률 집계에 포함됩니다</p>
              </div>
              <button
                type="button"
                onClick={() => setIsRegular(!isRegular)}
                aria-label={isRegular ? "정기 운동 해제" : "정기 운동 활성화"}
                className={`relative w-11 h-6 rounded-full transition-colors ${isRegular ? "bg-team-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isRegular ? "translate-x-5" : ""}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── 섹션 2: 친선경기 ── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">친선경기</h3>
          <div className="bg-white rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">친선경기</span>
                <p className="text-xs text-gray-400 mt-0.5">다른 팀에 도전장 보내기</p>
              </div>
              <button
                type="button"
                onClick={() => !lockFriendlyFields && setIsFriendlyMatch(!isFriendlyMatch)}
                disabled={lockFriendlyFields}
                aria-label={isFriendlyMatch ? "친선경기 해제" : "친선경기 활성화"}
                className={`relative w-11 h-6 rounded-full transition-colors ${lockFriendlyFields ? "opacity-50 cursor-not-allowed" : ""} ${isFriendlyMatch ? "bg-team-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isFriendlyMatch ? "translate-x-5" : ""}`} />
              </button>
            </div>

            {lockFriendlyFields && isFriendlyMatch && (
              <p className="mt-2 text-xs text-amber-600">RSVP 마감 이후에는 친선경기 설정을 변경할 수 없습니다</p>
            )}

            {isFriendlyMatch && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">상대팀</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={opponentTeam}
                      onChange={(e) => handleOpponentTeamChange(e.target.value)}
                      onFocus={() => opponentTeam && debouncedSearchTeams(opponentTeam)}
                      onBlur={() => setTimeout(() => setShowTeamList(false), 200)}
                      disabled={lockFriendlyFields}
                      placeholder="상대팀 이름을 검색하세요"
                      className={`w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent ${lockFriendlyFields ? "bg-gray-50 opacity-60 cursor-not-allowed" : ""}`}
                    />
                    {showTeamList && teamResults.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                        {teamResults.map((team) => (
                          <button
                            key={team.id}
                            type="button"
                            onClick={() => handleTeamSelect(team)}
                            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                          >
                            <div className="text-sm font-medium text-gray-900">{team.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{team._count.members}명</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">최소 인원</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setMinimumPlayers(Math.max(1, minimumPlayers - 1))}
                      disabled={minimumPlayers <= 1 || lockFriendlyFields}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 text-gray-700 font-bold text-lg flex items-center justify-center transition-colors hover:border-team-500 hover:text-team-500 disabled:opacity-30 disabled:hover:border-gray-300 disabled:hover:text-gray-700"
                    >
                      -
                    </button>
                    <span className="text-lg font-semibold text-gray-900 w-8 text-center">{minimumPlayers}</span>
                    <button
                      type="button"
                      onClick={() => setMinimumPlayers(Math.min(30, minimumPlayers + 1))}
                      disabled={minimumPlayers >= 30 || lockFriendlyFields}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 text-gray-700 font-bold text-lg flex items-center justify-center transition-colors hover:border-team-500 hover:text-team-500 disabled:opacity-30 disabled:hover:border-gray-300 disabled:hover:text-gray-700"
                    >
                      +
                    </button>
                    <span className="text-xs text-gray-400">명</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">친선경기 진행을 위한 최소 인원입니다</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── 섹션 3: 장소/장비 ── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">장소 · 장비</h3>
          <div className="space-y-3">

        {/* 장소 + 신발 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">장소</label>
          <div className="relative">
            <input
              type="text"
              value={location}
              onChange={(e) => handleLocationChange(e.target.value)}
              onFocus={() => location && debouncedSearchVenues(location)}
              onBlur={() => setTimeout(() => setShowVenueList(false), 200)}
              placeholder="운동 장소를 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
            />
            {showVenueList && venues.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-y-auto">
                {venues.map((venue, index) => (
                  <button
                    key={venue.id || `place-${index}`}
                    type="button"
                    onClick={() => handleVenueSelect(venue)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                  >
                    <div className="text-sm font-medium text-gray-900">{venue.name}</div>
                    {venue.address && (
                      <div className="text-xs text-gray-500 mt-1">{venue.roadAddress || venue.address}</div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">신발 추천</label>
            <div className="flex gap-2">
              {["축구화", "풋살화", "운동화"].map((shoe) => (
                <button
                  key={shoe}
                  type="button"
                  onClick={() => toggleShoe(shoe)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors border-2 ${
                    shoes.includes(shoe)
                      ? "bg-team-500 border-team-500 text-white"
                      : "bg-white border-gray-200 text-gray-700 hover:border-team-300"
                  }`}
                >
                  {shoes.includes(shoe) && "✓ "}
                  {shoe}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 유니폼 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            유니폼 <span className="text-gray-400 font-normal">(선택)</span>
            {selectedUniformColor && (
              <Shirt className="w-4 h-4 inline-block" style={{ fill: selectedUniformColor, stroke: "#9CA3AF" }} strokeWidth={1.5} />
            )}
          </label>
          <div className="relative">
            <input
              type="text"
              value={uniform}
              onChange={(e) => handleUniformChange(e.target.value)}
              onFocus={() => uniform && handleUniformChange(uniform)}
              placeholder="예: 홈, 원정, 3rd"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
            />
            {showUniformList &&
              uniforms.filter((u) => u.name.toLowerCase().includes(uniform.toLowerCase())).length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                  {uniforms
                    .filter((u) => u.name.toLowerCase().includes(uniform.toLowerCase()))
                    .map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleUniformSelect(opt)}
                        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 flex items-center gap-3"
                      >
                        <Shirt className="w-5 h-5" style={{ fill: opt.color, stroke: "#9CA3AF" }} strokeWidth={1.5} />
                        <div className="text-sm font-medium text-gray-900">{opt.name}</div>
                      </button>
                    ))}
                </div>
              )}
          </div>
        </div>

        {/* 유의점/메모 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            유의점 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="예: 오늘은 패스 연습 집중, 짧은 패스 위주로"
            rows={3}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent resize-none"
          />
        </div>

        {/* 조끼 당번 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">조끼 당번</label>
          {showVestSuggestion && vestBringerId && vestReceiverId && (
            <p className="text-xs text-team-500 mb-3">💡 조끼 순서에 따라 자동 추천되었습니다</p>
          )}
          <div className="space-y-3">
            <div>
              <span className="text-xs text-gray-500">가져오는 사람</span>
              <select
                value={vestBringerId}
                onChange={(e) => setVestBringerId(e.target.value)}
                className="w-full max-w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent overflow-hidden"
              >
                <option value="">선택안함</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || "이름 없음"}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="text-xs text-gray-500">받는 사람 (다음 당번)</span>
              <select
                value={vestReceiverId}
                onChange={(e) => setVestReceiverId(e.target.value)}
                className="w-full max-w-full mt-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent overflow-hidden"
              >
                <option value="">선택안함</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || "이름 없음"}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

          </div>
        </div>

        {/* ── 섹션 4: 참석 마감 ── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">참석 마감</h3>
          <div className="bg-white rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">RSVP 마감</label>
            <div className="flex gap-3">
              <input
                type="date"
                value={rsvpDeadlineDate}
                onChange={(e) => setRsvpDeadlineDate(e.target.value)}
                className="flex-1 min-w-0 px-3 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
              />
              <input
                type="time"
                value={rsvpDeadlineTime}
                onChange={(e) => setRsvpDeadlineTime(e.target.value)}
                className="flex-1 min-w-0 px-3 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* ── 섹션 5: MVP 투표 ── */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">MVP 투표</h3>
          <div className="bg-white rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-gray-700">MVP 투표</span>
                <p className="text-xs text-gray-400 mt-0.5">체크인한 사람들 대상 투표</p>
              </div>
              <button
                type="button"
                onClick={() => setEnablePomVoting(!enablePomVoting)}
                aria-label={enablePomVoting ? "MVP 투표 해제" : "MVP 투표 활성화"}
                className={`relative w-11 h-6 rounded-full transition-colors ${enablePomVoting ? "bg-team-500" : "bg-gray-300"}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enablePomVoting ? "translate-x-5" : ""}`} />
              </button>
            </div>

            {enablePomVoting && (
              <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    투표 마감 {mode === "create" && <span className="text-gray-400">(선택)</span>}
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="date"
                      value={pomVotingDeadlineDate}
                      onChange={(e) => setPomVotingDeadlineDate(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                    />
                    <input
                      type="time"
                      value={pomVotingDeadlineTime}
                      onChange={(e) => setPomVotingDeadlineTime(e.target.value)}
                      className="flex-1 min-w-0 px-3 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                    />
                  </div>
                  {mode === "create" && (
                    <p className="text-xs text-gray-400 mt-1">비워두면 운동 시작 2시간 후로 자동 설정됩니다</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">1인당 투표 가능 인원</label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setPomVotesPerPerson(Math.max(1, pomVotesPerPerson - 1))}
                      disabled={pomVotesPerPerson <= 1}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 text-gray-700 font-bold text-lg flex items-center justify-center transition-colors hover:border-team-500 hover:text-team-500 disabled:opacity-30 disabled:hover:border-gray-300 disabled:hover:text-gray-700"
                    >
                      -
                    </button>
                    <span className="text-lg font-semibold text-gray-900 w-8 text-center">{pomVotesPerPerson}</span>
                    <button
                      type="button"
                      onClick={() => setPomVotesPerPerson(Math.min(10, pomVotesPerPerson + 1))}
                      disabled={pomVotesPerPerson >= 10}
                      className="w-10 h-10 rounded-lg border-2 border-gray-300 text-gray-700 font-bold text-lg flex items-center justify-center transition-colors hover:border-team-500 hover:text-team-500 disabled:opacity-30 disabled:hover:border-gray-300 disabled:hover:text-gray-700"
                    >
                      +
                    </button>
                    <span className="text-xs text-gray-400">명</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단 제출 버튼 */}
      {isFormComplete && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-10">
          <div className="max-w-2xl mx-auto flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full max-w-xs py-3.5 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
            >
              {submitting ? submittingLabel : submitLabel}
            </button>
          </div>
        </div>
      )}

      <Toast message={toast?.message || ""} visible={!!toast} onHide={hideToast} />
    </>
  );
}
