"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";

interface MemberOption {
  id: string;
  name: string | null;
  image: string | null;
}

interface EventData {
  id: string;
  title: string;
  isRegular: boolean;
  date: string;
  location: string;
  shoes: string[];
  uniform: string | null;
  vestBringerId: string | null;
  vestReceiverId: string | null;
  rsvpDeadline: string;
}

export default function TrainingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [eventId, setEventId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);
  const [event, setEvent] = useState<EventData | null>(null);

  const [title, setTitle] = useState("");
  const [isRegular, setIsRegular] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [location, setLocation] = useState("");
  const [shoes, setShoes] = useState<string[]>([]);
  const [uniform, setUniform] = useState("");
  const [vestBringerId, setVestBringerId] = useState("");
  const [vestReceiverId, setVestReceiverId] = useState("");
  const [rsvpDeadlineDate, setRsvpDeadlineDate] = useState("");
  const [rsvpDeadlineTime, setRsvpDeadlineTime] = useState("22:00");

  useEffect(() => {
    params.then((p) => setEventId(p.id));
  }, [params]);

  useEffect(() => {
    if (eventId) {
      fetchEvent();
      fetchMembers();
    }
  }, [eventId]);

  const fetchEvent = async () => {
    try {
      const res = await fetch(`/api/training-events/${eventId}`);
      if (res.ok) {
        const data = await res.json();
        setEvent(data);

        // 폼 데이터 설정
        setTitle(data.title || "");
        setIsRegular(data.isRegular);
        setLocation(data.location || "");
        setShoes(data.shoes || []);
        setUniform(data.uniform || "");
        setVestBringerId(data.vestBringerId || "");
        setVestReceiverId(data.vestReceiverId || "");

        // 날짜/시간 파싱
        const eventDate = new Date(data.date);
        setDate(eventDate.toISOString().split("T")[0]);
        setTime(eventDate.toTimeString().slice(0, 5));

        const deadline = new Date(data.rsvpDeadline);
        setRsvpDeadlineDate(deadline.toISOString().split("T")[0]);
        setRsvpDeadlineTime(deadline.toTimeString().slice(0, 5));
      }
    } catch {
      setError("운동 정보를 불러오지 못했습니다");
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      }
    } catch {
      // ignore
    }
  };

  const toggleShoe = (shoe: string) => {
    setShoes((prev) =>
      prev.includes(shoe) ? prev.filter((s) => s !== shoe) : [...prev, shoe]
    );
  };

  const isFormComplete = title && date && time && location && rsvpDeadlineDate && rsvpDeadlineTime;

  const handleSubmit = async () => {
    if (!isFormComplete) return;
    setSaving(true);
    setError("");

    try {
      const dateTime = new Date(`${date}T${time}:00`);
      const rsvpDeadline = new Date(`${rsvpDeadlineDate}T${rsvpDeadlineTime}:00`);

      const res = await fetch(`/api/training-events/${eventId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          isRegular,
          date: dateTime.toISOString(),
          location,
          shoes,
          uniform: uniform || null,
          vestBringerId: vestBringerId || null,
          vestReceiverId: vestReceiverId || null,
          rsvpDeadline: rsvpDeadline.toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "저장에 실패했습니다");
      }

      router.push(`/training/${eventId}/manage`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">운동을 찾을 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href={`/training/${eventId}/manage`} className="text-gray-500 hover:text-gray-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">운동 정보 수정</h1>
          <div className="w-6" />
        </div>
      </header>

      <main className="max-w-lg mx-auto p-4 space-y-4">
        {/* 제목 + 정기 여부 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">제목</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 주말 운동"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
          <div className="flex items-center justify-between mt-4">
            <div>
              <span className="text-sm font-medium text-gray-700">정기 운동</span>
              <p className="text-xs text-gray-400 mt-0.5">출석률 집계에 포함됩니다</p>
            </div>
            <button
              type="button"
              onClick={() => setIsRegular(!isRegular)}
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
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
          <label className="block text-sm font-medium text-gray-700 mt-3 mb-2">시간</label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
        </div>

        {/* 장소 + 신발 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">장소</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="운동 장소를 입력하세요"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />

          {/* 신발 선택 */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">신발 추천</label>
            <div className="flex gap-2">
              {["축구화", "풋살화"].map((shoe) => (
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
          <label className="block text-sm font-medium text-gray-700 mb-2">
            유니폼 <span className="text-gray-400 font-normal">(선택)</span>
          </label>
          <input
            type="text"
            value={uniform}
            onChange={(e) => setUniform(e.target.value)}
            placeholder="예: 홈 유니폼 (흰색)"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
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
                className="w-full max-w-full mt-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent overflow-hidden"
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
                className="w-full max-w-full mt-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent overflow-hidden"
              >
                <option value="">선택안함</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || "이름 없음"}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 응답 마감 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">참석 응답 마감</label>
          <input
            type="date"
            value={rsvpDeadlineDate}
            onChange={(e) => setRsvpDeadlineDate(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
          <label className="block text-sm font-medium text-gray-700 mt-3 mb-2">마감 시간</label>
          <input
            type="time"
            value={rsvpDeadlineTime}
            onChange={(e) => setRsvpDeadlineTime(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
        </div>

        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
      </main>

      {isFormComplete && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 z-10">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full py-3.5 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
