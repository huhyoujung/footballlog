"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import BackButton from "@/components/BackButton";
import Toast from "@/components/Toast";
import { useToast } from "@/lib/useToast";
import { Shirt } from "lucide-react";

// 디바운싱 헬퍼 함수
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

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

export default function TrainingCreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<MemberOption[]>([]);
  const { toast, showToast, hideToast } = useToast();

  const [title, setTitle] = useState("");
  const [isRegular, setIsRegular] = useState(true);
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

  // 친선경기 관련
  const [isFriendlyMatch, setIsFriendlyMatch] = useState(false);
  const [minimumPlayers, setMinimumPlayers] = useState(6);

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

  // SWR로 조끼 당번 추천 캐싱
  const { data: vestData, isLoading: vestLoading } = useSWR<{
    members: MemberOption[];
    bringer: { id: string } | null;
    receiver: { id: string } | null;
  }>("/api/training-events/vest-suggestion", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 60000,
    onSuccess: (data) => {
      setMembers(data.members || []);
      if (data.bringer) setVestBringerId(data.bringer.id);
      if (data.receiver) setVestReceiverId(data.receiver.id);
    },
  });


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

  const searchVenues = async (query: string) => {
    console.log("searchVenues 호출:", query);
    if (!query.trim()) {
      console.log("빈 검색어, 리스트 숨김");
      setVenues([]);
      setShowVenueList(false);
      return;
    }
    try {
      console.log("API 요청 시작:", `/api/places/search?query=${encodeURIComponent(query)}`);
      // 네이버 지도 API로 장소 검색
      const res = await fetch(`/api/places/search?query=${encodeURIComponent(query)}`);
      console.log("API 응답 상태:", res.status);
      if (res.ok) {
        const data = await res.json();
        console.log("검색 결과:", data);
        setVenues(data.places || []);
        setShowVenueList(data.places && data.places.length > 0);
      } else {
        const errorData = await res.json();
        console.error("장소 검색 실패:", errorData);
        showToast(errorData.error || "장소 검색에 실패했습니다");
      }
    } catch (error) {
      console.error("장소 검색 에러:", error);
      showToast("장소 검색 중 오류가 발생했습니다");
    }
  };

  // 디바운싱된 검색 함수
  const debouncedSearchVenues = useMemo(
    () => debounce(searchVenues, 300),
    []
  );

  const handleLocationChange = (value: string) => {
    console.log("장소 입력:", value);
    setLocation(value);
    setSelectedVenue(null);
    debouncedSearchVenues(value);
  };

  const fetchWeather = async (venue: VenueOption, trainingDate: string) => {
    if (!venue.latitude || !venue.longitude || !trainingDate) return;

    setLoadingWeather(true);
    try {
      const res = await fetch(
        `/api/weather?lat=${venue.latitude}&lon=${venue.longitude}&date=${trainingDate}T${time}:00`
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
      fetchWeather(venue, date);
    }
  };

  const toggleShoe = (shoe: string) => {
    setShoes((prev) =>
      prev.includes(shoe) ? prev.filter((s) => s !== shoe) : [...prev, shoe]
    );
  };

  // 날짜 변경 시 날씨 업데이트
  useEffect(() => {
    if (selectedVenue && date && selectedVenue.latitude && selectedVenue.longitude) {
      fetchWeather(selectedVenue, date);
    }
  }, [date]);


  const isFormComplete = title && date && time && location && rsvpDeadlineDate && rsvpDeadlineTime;

  const handleSubmit = async () => {
    if (!isFormComplete) return;
    setLoading(true);

    try {
      const dateTime = new Date(`${date}T${time}:00`);
      const rsvpDeadline = new Date(`${rsvpDeadlineDate}T${rsvpDeadlineTime}:00`);

      // RSVP 마감은 운동 시간 전이어야 함
      if (rsvpDeadline >= dateTime) {
        showToast("RSVP 마감은 운동 시간 전이어야 합니다");
        setLoading(false);
        return;
      }

      // POM 투표 마감 시간: 설정하지 않았으면 운동 시작 2시간 후가 기본값
      const pomVotingDeadline = enablePomVoting
        ? pomVotingDeadlineDate && pomVotingDeadlineTime
          ? new Date(`${pomVotingDeadlineDate}T${pomVotingDeadlineTime}:00`).toISOString()
          : new Date(dateTime.getTime() + 2 * 60 * 60 * 1000).toISOString()
        : null;

      // MVP 투표 마감은 운동 시간 이후여야 함
      if (enablePomVoting && pomVotingDeadlineDate && pomVotingDeadlineTime) {
        const pomDeadline = new Date(`${pomVotingDeadlineDate}T${pomVotingDeadlineTime}:00`);
        if (pomDeadline <= dateTime) {
          showToast("MVP 투표 마감은 운동 시간 이후여야 합니다");
          setLoading(false);
          return;
        }
      }

      const res = await fetch("/api/training-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          isRegular,
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
          // 친선경기 정보
          isFriendlyMatch,
          minimumPlayers: isFriendlyMatch ? minimumPlayers : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "생성에 실패했습니다");
      }

      const event = await res.json();

      // 성공 토스트 표시 후 네비게이션
      showToast("팀 운동이 생성되었습니다");
      setTimeout(() => router.push(`/training/${event.id}`), 500);
    } catch (err) {
      let errorMessage = "오류가 발생했습니다";

      if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes("401") || msg.includes("unauthorized")) {
          errorMessage = "로그인이 필요합니다";
        } else if (msg.includes("403") || msg.includes("forbidden")) {
          errorMessage = "권한이 없습니다";
        } else if (msg.includes("운영진")) {
          errorMessage = "운영진만 생성할 수 있습니다";
        } else {
          errorMessage = err.message;
        }
      }

      showToast(errorMessage);
      setLoading(false); // 에러 시에만 loading 해제
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-1 flex items-center justify-between">
          <BackButton href="/" />
          <h1 className="text-base font-semibold text-gray-900">팀 운동</h1>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">날짜</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">시간</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
              />
            </div>
          </div>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">조끼 당번</label>
          {!vestLoading && vestBringerId && vestReceiverId && (
            <p className="text-xs text-team-500 mb-3">
              💡 조끼 순서에 따라 자동 추천되었습니다
            </p>
          )}
          {vestLoading ? (
            <div className="text-sm text-gray-400">로딩 중...</div>
          ) : (
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
          )}
        </div>

        {/* 응답 마감 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">RSVP 마감</label>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="date"
              value={rsvpDeadlineDate}
              onChange={(e) => setRsvpDeadlineDate(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
            />
            <input
              type="time"
              value={rsvpDeadlineTime}
              onChange={(e) => setRsvpDeadlineTime(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
            />
          </div>
        </div>

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
              aria-label={enablePomVoting ? "MVP 투표 해제" : "MVP 투표 활성화"}
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
                <label className="block text-xs text-gray-500 mb-1">투표 마감 (선택)</label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={pomVotingDeadlineDate}
                    onChange={(e) => setPomVotingDeadlineDate(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                  />
                  <input
                    type="time"
                    value={pomVotingDeadlineTime}
                    onChange={(e) => setPomVotingDeadlineTime(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1">비워두면 운동 시작 2시간 후로 자동 설정됩니다</p>
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

      </main>

      {isFormComplete && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-10">
          <div className="max-w-2xl mx-auto flex justify-center">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full max-w-xs py-3.5 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
            >
              {loading ? "생성 중..." : "운동 올리기"}
            </button>
          </div>
        </div>
      )}

      {/* 토스트 */}
      <Toast
        message={toast?.message || ""}
        visible={!!toast}
        onHide={hideToast}
      />
    </div>
  );
}
