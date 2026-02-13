"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { useTeam } from "@/contexts/TeamContext";
import BackButton from "@/components/BackButton";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Shirt } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface MemberOption {
  id: string;
  name: string | null;
  image: string | null;
}

interface VenueOption {
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

interface EventData {
  id: string;
  title: string;
  isRegular: boolean;
  isFriendlyMatch: boolean;
  minimumPlayers: number | null;
  rsvpDeadlineOffset: number | null;
  enablePomVoting: boolean;
  pomVotingDeadline: string | null;
  pomVotesPerPerson: number;
  date: string;
  location: string;
  venue: {
    id: string;
    name: string;
    mapUrl: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  shoes: string[];
  uniform: string | null;
  notes: string | null;
  vestBringerId: string | null;
  vestReceiverId: string | null;
  rsvpDeadline: string;
}

export default function TrainingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { teamData } = useTeam();
  const [eventId, setEventId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const members = teamData?.members || [];

  const [title, setTitle] = useState("");
  const [isRegular, setIsRegular] = useState(true);
  const [isFriendlyMatch, setIsFriendlyMatch] = useState(false);
  const [minimumPlayers, setMinimumPlayers] = useState(10);
  const [rsvpDeadlineOffset, setRsvpDeadlineOffset] = useState(-3);
  const [enablePomVoting, setEnablePomVoting] = useState(true);
  const [pomVotingDeadlineDate, setPomVotingDeadlineDate] = useState("");
  const [pomVotingDeadlineTime, setPomVotingDeadlineTime] = useState("22:00");
  const [pomVotesPerPerson, setPomVotesPerPerson] = useState(1);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [location, setLocation] = useState("");
  const [shoes, setShoes] = useState<string[]>([]);
  const [uniform, setUniform] = useState("");
  const [notes, setNotes] = useState("");
  const [vestBringerId, setVestBringerId] = useState("");
  const [vestReceiverId, setVestReceiverId] = useState("");
  const [rsvpDeadlineDate, setRsvpDeadlineDate] = useState("");
  const [rsvpDeadlineTime, setRsvpDeadlineTime] = useState("22:00");

  const [venues, setVenues] = useState<VenueOption[]>([]);
  const [showVenueList, setShowVenueList] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<VenueOption | null>(null);
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
  const [showUniformList, setShowUniformList] = useState(false);
  const [selectedUniformColor, setSelectedUniformColor] = useState<string | null>(null);


  // 유니폼 목록 가져오기
  const { data: uniformData } = useSWR<{ uniforms: UniformOption[] }>(
    "/api/teams/uniforms",
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 300000,
    }
  );

  const uniforms = uniformData?.uniforms || [];

  const handleUniformChange = (value: string) => {
    setUniform(value);

    // 등록된 유니폼 중에서 매칭되는 것이 있으면 색상 설정
    const matchedUniform = uniforms.find(
      (u) => u.name.toLowerCase() === value.toLowerCase()
    );

    if (matchedUniform) {
      setSelectedUniformColor(matchedUniform.color);
      setShowUniformList(false);
    } else {
      setSelectedUniformColor(null);
      // 타이핑 중에 자동완성 목록 표시
      if (value.trim()) {
        const filtered = uniforms.filter((u) =>
          u.name.toLowerCase().includes(value.toLowerCase())
        );
        setShowUniformList(filtered.length > 0);
      } else {
        setShowUniformList(false);
      }
    }
  };

  const handleUniformSelect = (uniformOption: UniformOption) => {
    setUniform(uniformOption.name);
    setSelectedUniformColor(uniformOption.color);
    setShowUniformList(false);
  };

  useEffect(() => {
    params.then((p) => setEventId(p.id));
  }, [params]);

  // SWR로 event 데이터 페칭
  const { data: event, isLoading } = useSWR<EventData>(
    eventId ? `/api/training-events/${eventId}?edit=true` : null,
    fetcher,
    {
      revalidateOnFocus: true,
      revalidateOnMount: true, // 컴포넌트 마운트 시 항상 최신 데이터 로드
      revalidateIfStale: true,
      dedupingInterval: 0, // 캐시 비활성화
    }
  );

  // event 데이터가 로드되면 폼 필드 채우기
  useEffect(() => {
    if (!event) return;

    // 폼 데이터 설정
    setTitle(event.title || "");
    setIsRegular(event.isRegular);
    setIsFriendlyMatch(event.isFriendlyMatch ?? false);
    setMinimumPlayers(event.minimumPlayers ?? 10);
    setRsvpDeadlineOffset(event.rsvpDeadlineOffset ?? -3);
    setEnablePomVoting(event.enablePomVoting ?? true);
    setPomVotesPerPerson(event.pomVotesPerPerson ?? 1);
    setLocation(event.location || "");
    setShoes(event.shoes || []);
    setUniform(event.uniform || "");
    setNotes(event.notes || "");
    setVestBringerId(event.vestBringerId || "");
    setVestReceiverId(event.vestReceiverId || "");

    // 장소 정보 설정
    if (event.venue) {
      setSelectedVenue({
        name: event.venue.name,
        address: event.location,
        mapUrl: event.venue.mapUrl,
        latitude: event.venue.latitude,
        longitude: event.venue.longitude,
      });
    }

    // 날짜/시간 파싱 - 유효성 검사 추가
    if (event.date) {
      const eventDate = new Date(event.date);
      if (!isNaN(eventDate.getTime())) {
        setDate(eventDate.toISOString().split("T")[0]);
        setTime(eventDate.toTimeString().slice(0, 5));

        // POM 투표 마감 시간 파싱
        if (event.pomVotingDeadline) {
          const pomDeadline = new Date(event.pomVotingDeadline);
          if (!isNaN(pomDeadline.getTime())) {
            setPomVotingDeadlineDate(pomDeadline.toISOString().split("T")[0]);
            setPomVotingDeadlineTime(pomDeadline.toTimeString().slice(0, 5));
          }
        } else {
          // 기본값: 운동 시작 2시간 후
          const defaultPomDeadline = new Date(eventDate);
          defaultPomDeadline.setHours(defaultPomDeadline.getHours() + 2);
          setPomVotingDeadlineDate(defaultPomDeadline.toISOString().split("T")[0]);
          setPomVotingDeadlineTime(defaultPomDeadline.toTimeString().slice(0, 5));
        }
      }
    }

    if (event.rsvpDeadline) {
      const deadline = new Date(event.rsvpDeadline);
      if (!isNaN(deadline.getTime())) {
        setRsvpDeadlineDate(deadline.toISOString().split("T")[0]);
        setRsvpDeadlineTime(deadline.toTimeString().slice(0, 5));
      }
    }
  }, [event]);

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
      }
    } catch {
      // ignore
    }
  };

  const handleLocationChange = (value: string) => {
    setLocation(value);
    setSelectedVenue(null);
    searchVenues(value);
  };

  const fetchWeather = async (venue: VenueOption, trainingDate: string, trainingTime: string) => {
    if (!venue.latitude || !venue.longitude || !trainingDate) return;

    setLoadingWeather(true);
    try {
      const res = await fetch(
        `/api/weather?lat=${venue.latitude}&lon=${venue.longitude}&date=${trainingDate}T${trainingTime}:00`
      );
      if (res.ok) {
        const data = await res.json();
        setWeather(data);
      }
    } catch (error) {
      console.error("날씨 조회 실패:", error);
    } finally {
      setLoadingWeather(false);
    }
  };

  const handleVenueSelect = (venue: VenueOption) => {
    setLocation(venue.name);
    setSelectedVenue(venue);
    if (venue.recommendedShoes) {
      setShoes(venue.recommendedShoes);
    }
    setShowVenueList(false);

    // 날짜가 이미 선택되어 있으면 날씨 조회
    if (date && venue.latitude && venue.longitude) {
      fetchWeather(venue, date, time);
    }
  };

  const toggleShoe = (shoe: string) => {
    setShoes((prev) =>
      prev.includes(shoe) ? prev.filter((s) => s !== shoe) : [...prev, shoe]
    );
  };

  // 날짜 변경 시 날씨 업데이트
  useEffect(() => {
    if (selectedVenue && date && time && selectedVenue.latitude && selectedVenue.longitude) {
      fetchWeather(selectedVenue, date, time);
    }
  }, [date, time]);

  // 친선경기 모드: RSVP 마감 자동 계산
  useEffect(() => {
    if (isFriendlyMatch && date && rsvpDeadlineOffset) {
      const trainingDate = new Date(date);
      const deadline = new Date(trainingDate);
      deadline.setDate(deadline.getDate() + rsvpDeadlineOffset); // -3이면 3일 전

      setRsvpDeadlineDate(deadline.toISOString().split('T')[0]);
    }
  }, [isFriendlyMatch, date, rsvpDeadlineOffset]);

  const isFormComplete = title && date && time && location && rsvpDeadlineDate && rsvpDeadlineTime;

  const handleSubmit = async () => {
    if (!isFormComplete) return;
    setSaving(true);
    setError("");

    try {
      const dateTime = new Date(`${date}T${time}:00`);
      const rsvpDeadline = new Date(`${rsvpDeadlineDate}T${rsvpDeadlineTime}:00`);

      // RSVP 마감은 운동 시간 전이어야 함
      if (rsvpDeadline >= dateTime) {
        setError("RSVP 마감은 운동 시간 전이어야 합니다");
        setSaving(false);
        return;
      }

      const pomVotingDeadline = enablePomVoting && pomVotingDeadlineDate && pomVotingDeadlineTime
        ? new Date(`${pomVotingDeadlineDate}T${pomVotingDeadlineTime}:00`).toISOString()
        : null;

      // MVP 투표 마감은 운동 시간 이후여야 함
      if (enablePomVoting && pomVotingDeadlineDate && pomVotingDeadlineTime) {
        const pomDeadline = new Date(`${pomVotingDeadlineDate}T${pomVotingDeadlineTime}:00`);
        if (pomDeadline <= dateTime) {
          setError("MVP 투표 마감은 운동 시간 이후여야 합니다");
          setSaving(false);
          return;
        }
      }

      const res = await fetch(`/api/training-events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          isRegular,
          isFriendlyMatch,
          minimumPlayers: isFriendlyMatch ? minimumPlayers : null,
          rsvpDeadlineOffset: isFriendlyMatch ? rsvpDeadlineOffset : null,
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
          // 지도 정보
          venueData: selectedVenue ? {
            address: selectedVenue.address,
            mapUrl: selectedVenue.mapUrl,
            latitude: selectedVenue.latitude,
            longitude: selectedVenue.longitude,
          } : null,
          // 날씨 정보
          weatherData: weather ? {
            weather: weather.weather,
            weatherDescription: weather.weatherDescription,
            temperature: weather.temperature,
            airQualityIndex: weather.airQualityIndex,
            pm25: weather.pm25,
            pm10: weather.pm10,
          } : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장에 실패했습니다");
      }

      // SWR 캐시 무효화하여 상세 페이지에서 최신 데이터 표시
      await mutate(`/api/training-events/${eventId}`);
      await mutate(`/api/training-events/${eventId}?includeSessions=true`);
      router.push(`/training/${eventId}?tab=info`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">운동을 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href={`/training/${eventId}`} />
          <h1 className="text-base font-semibold text-gray-900">운동 정보 수정</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 space-y-4">
        {/* 제목 + 정기 여부 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 주말 운동"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
          <div className="flex items-center justify-between mt-4">
            <div>
              <span className="text-sm font-medium text-gray-700">친선경기</span>
              <p className="text-xs text-gray-400 mt-0.5">다른 팀에 도전장 보내기</p>
            </div>
            <button
              type="button"
              onClick={() => setIsFriendlyMatch(!isFriendlyMatch)}
              aria-label={isFriendlyMatch ? "친선경기 해제" : "친선경기 활성화"}
              className={`relative w-11 h-6 rounded-full transition-colors ${isFriendlyMatch ? "bg-team-500" : "bg-gray-300"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isFriendlyMatch ? "translate-x-5" : ""}`}
              />
            </button>
          </div>

          {/* 친선경기 설정 */}
          {isFriendlyMatch && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">최소 인원</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={minimumPlayers}
                  onChange={(e) => setMinimumPlayers(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-400 mt-1">친선경기 진행을 위한 최소 인원입니다</p>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">RSVP 마감 시점</label>
                <select
                  value={rsvpDeadlineOffset}
                  onChange={(e) => setRsvpDeadlineOffset(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                >
                  <option value={-7}>경기 7일 전</option>
                  <option value={-5}>경기 5일 전</option>
                  <option value={-3}>경기 3일 전</option>
                  <option value={-1}>경기 1일 전</option>
                </select>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
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
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isRegular ? "translate-x-5" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* 운동 날짜/시간 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">운동 날짜</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full max-w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent overflow-hidden"
          />
          <label className="block text-sm font-medium text-gray-700 mt-3 mb-2">시간</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full max-w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent overflow-hidden"
          />
        </div>

        {/* 장소 + 신발 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">장소</label>

          <div className="relative">
            <input
              type="text"
              value={location}
              onChange={(e) => handleLocationChange(e.target.value)}
              onFocus={() => location && searchVenues(location)}
              placeholder="운동 장소를 입력하세요"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
            />
            {/* 장소 검색 결과 리스트 */}
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


          {/* 신발 선택 */}
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
              <Shirt
                className="w-4 h-4 inline-block"
                style={{ fill: selectedUniformColor, stroke: '#9CA3AF' }}
                strokeWidth={1.5}
              />
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
            {/* 유니폼 자동완성 리스트 */}
            {showUniformList && uniforms.filter((u) =>
              u.name.toLowerCase().includes(uniform.toLowerCase())
            ).length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {uniforms
                  .filter((u) => u.name.toLowerCase().includes(uniform.toLowerCase()))
                  .map((uniformOption) => (
                    <button
                      key={uniformOption.id}
                      type="button"
                      onClick={() => handleUniformSelect(uniformOption)}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 flex items-center gap-3"
                    >
                      <Shirt
                        className="w-5 h-5"
                        style={{ fill: uniformOption.color, stroke: '#9CA3AF' }}
                        strokeWidth={1.5}
                      />
                      <div className="text-sm font-medium text-gray-900">{uniformOption.name}</div>
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
          <label className="block text-sm font-medium text-gray-700 mb-3">조끼 당번</label>
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
                  <option key={m.id} value={m.id}>{m.name || "이름 없음"}</option>
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
                  <option key={m.id} value={m.id}>{m.name || "이름 없음"}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 응답 마감 (정기운동 모드에서만 수동 입력) */}
        {!isFriendlyMatch && (
          <div className="bg-white rounded-xl p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">RSVP 마감</label>
            <input
              type="date"
              value={rsvpDeadlineDate}
              onChange={(e) => setRsvpDeadlineDate(e.target.value)}
              className="w-full max-w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent overflow-hidden"
            />
            <label className="block text-sm font-medium text-gray-700 mt-3 mb-2">마감 시간</label>
            <input
              type="time"
              value={rsvpDeadlineTime}
              onChange={(e) => setRsvpDeadlineTime(e.target.value)}
            className="w-full max-w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent overflow-hidden"
            />
          </div>
        )}

        {/* MVP 투표 */}
        <div className="bg-white rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">MVP 투표</span>
              <p className="text-xs text-gray-400 mt-0.5">체크인한 사람들 대상 투표</p>
            </div>
            <button
              type="button"
              onClick={() => setEnablePomVoting(!enablePomVoting)}
              className={`relative w-11 h-6 rounded-full transition-colors ${enablePomVoting ? "bg-team-500" : "bg-gray-300"}`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${enablePomVoting ? "translate-x-5" : ""}`}
              />
            </button>
          </div>

          {/* POM 투표 설정 */}
          {enablePomVoting && (
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">투표 마감 날짜</label>
                <input
                  type="date"
                  value={pomVotingDeadlineDate}
                  onChange={(e) => setPomVotingDeadlineDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">투표 마감 시간</label>
                <input
                  type="time"
                  value={pomVotingDeadlineTime}
                  onChange={(e) => setPomVotingDeadlineTime(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">1인당 투표 가능 인원</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={pomVotesPerPerson}
                  onChange={(e) => setPomVotesPerPerson(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                />
              </div>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </main>

      {isFormComplete && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-10">
          <div className="max-w-2xl mx-auto flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full max-w-xs py-3.5 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
