"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface MemberOption {
  id: string;
  name: string | null;
  image: string | null;
}

export default function TrainingCreatePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [members, setMembers] = useState<MemberOption[]>([]);

  const [title, setTitle] = useState("");
  const [isRegular, setIsRegular] = useState(true);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("14:00");
  const [location, setLocation] = useState("");
  const [uniform, setUniform] = useState("");
  const [vestBringerId, setVestBringerId] = useState("");
  const [vestReceiverId, setVestReceiverId] = useState("");
  const [rsvpDeadlineDate, setRsvpDeadlineDate] = useState("");
  const [rsvpDeadlineTime, setRsvpDeadlineTime] = useState("22:00");

  const [vestLoading, setVestLoading] = useState(true);

  useEffect(() => {
    fetchVestSuggestion();
  }, []);

  const fetchVestSuggestion = async () => {
    try {
      const res = await fetch("/api/training-events/vest-suggestion");
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        if (data.bringer) setVestBringerId(data.bringer.id);
        if (data.receiver) setVestReceiverId(data.receiver.id);
      }
    } catch {
      // ignore
    } finally {
      setVestLoading(false);
    }
  };

  const isFormComplete = title && date && time && location && rsvpDeadlineDate && rsvpDeadlineTime;

  const handleSubmit = async () => {
    if (!isFormComplete) return;
    setLoading(true);
    setError("");

    try {
      const dateTime = new Date(`${date}T${time}:00`);
      const rsvpDeadline = new Date(`${rsvpDeadlineDate}T${rsvpDeadlineTime}:00`);

      const res = await fetch("/api/training-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          isRegular,
          date: dateTime.toISOString(),
          location,
          uniform: uniform || null,
          vestBringerId: vestBringerId || null,
          vestReceiverId: vestReceiverId || null,
          rsvpDeadline: rsvpDeadline.toISOString(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "생성에 실패했습니다");
      }

      const event = await res.json();
      router.push(`/training/${event.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="text-gray-500 hover:text-gray-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">팀 운동</h1>
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

        {/* 장소 */}
        <div className="bg-white rounded-xl p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">장소</label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="운동 장소를 입력하세요"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-team-500 focus:border-transparent"
          />
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
          {vestLoading ? (
            <div className="text-sm text-gray-400">로딩 중...</div>
          ) : (
            <div className="space-y-3">
              <div>
                <span className="text-xs text-gray-500">가져오는 사람</span>
                <select
                  value={vestBringerId}
                  onChange={(e) => setVestBringerId(e.target.value)}
                  className="w-full mt-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent"
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
                  className="w-full mt-1 px-4 py-2.5 border border-gray-300 rounded-lg text-gray-900 text-sm focus:ring-2 focus:ring-team-500 focus:border-transparent"
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
              disabled={loading}
              className="w-full py-3.5 bg-team-500 text-white rounded-xl font-semibold hover:bg-team-600 transition-colors disabled:opacity-50"
            >
              {loading ? "생성 중..." : "운동 올리기"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
