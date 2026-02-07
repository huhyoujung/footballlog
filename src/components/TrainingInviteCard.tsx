"use client";

import Link from "next/link";
import type { TrainingEventSummary } from "@/types/training-event";

interface Props {
  event: TrainingEventSummary;
}

export default function TrainingInviteCard({ event }: Props) {
  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  const deadlineStr = new Date(event.rsvpDeadline).toLocaleDateString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link
      href={`/training/${event.id}`}
      className="block mx-4 my-4"
    >
      <div className="relative">
        {/* 글로우 효과 */}
        <div
          className="absolute -inset-2 rounded-3xl opacity-30 blur-xl"
          style={{ background: 'radial-gradient(ellipse at center top, #967B5D 0%, transparent 70%)' }}
        />

        {/* 카드 (봉투에서 나온 편지) */}
        <div
          className="relative z-10 invite-card-emerge"
          style={{ marginBottom: -28 }}
        >
          <div
            className="rounded-t-2xl px-5 pt-5 pb-10"
            style={{
              background: 'linear-gradient(160deg, #F5F0EB 0%, #EBE1D7 40%, #DDD2C6 100%)',
              boxShadow: '0 -4px 20px rgba(150, 123, 93, 0.2)',
            }}
          >
            {/* INVITATION 레이블 */}
            <div className="flex items-center justify-center mb-4">
              <span className="text-team-500 text-[10px] font-semibold tracking-[0.25em] uppercase">INVITATION</span>
            </div>

            {/* 타이틀 */}
            <h3 className="text-center text-lg font-bold text-team-700">{event.title}</h3>

            {/* 정보 */}
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-center gap-2 text-sm text-team-600">
                <span>{dateStr}</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm text-team-500">
                <span>{event.location}</span>
              </div>
            </div>

            {/* 구분선 */}
            <div className="flex items-center gap-3 mt-4">
              <div className="flex-1 border-t border-team-300/40" />
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="11" fill="none" stroke="#967B5D" strokeWidth="1.5" opacity="0.4" />
                <path d="M12 7 L16 10.2 L14.5 14.8 L9.5 14.8 L8 10.2 Z" fill="#967B5D" opacity="0.4" />
              </svg>
              <div className="flex-1 border-t border-team-300/40" />
            </div>

            {/* CTA + 마감 */}
            <p className="text-center text-sm font-semibold text-team-700 mt-3">
              참석 여부를 알려주세요
            </p>
            <div className="flex items-center justify-center gap-3 mt-2">
              <span className="text-[11px] text-team-400">마감 {deadlineStr}</span>
              <span className="text-[11px] text-team-400">{event._count.rsvps}명 응답</span>
            </div>
          </div>
        </div>

        {/* 봉투 본체 */}
        <div className="relative z-20">
          {/* 봉투 뚜껑 (삼각형) */}
          <div
            className="absolute left-0 right-0 -top-[1px] h-12 overflow-hidden"
            style={{ zIndex: 21 }}
          >
            <div
              className="absolute inset-x-0 top-0 h-24"
              style={{
                background: '#685643',
                clipPath: 'polygon(0 0, 50% 100%, 100% 0)',
              }}
            />
            {/* 뚜껑 안쪽 그림자 */}
            <div
              className="absolute inset-x-0 top-0 h-24"
              style={{
                background: 'linear-gradient(180deg, rgba(0,0,0,0.08) 0%, transparent 60%)',
                clipPath: 'polygon(0 0, 50% 100%, 100% 0)',
              }}
            />
          </div>

          {/* 봉투 몸체 */}
          <div
            className="rounded-b-2xl pt-12 pb-5 px-5"
            style={{
              background: 'linear-gradient(180deg, #7F6850 0%, #685643 100%)',
              boxShadow: '0 8px 30px rgba(104, 86, 67, 0.35)',
            }}
          >
            {/* 봉투 안쪽 삼각형 장식 */}
            <div
              className="absolute left-0 right-0 top-0 h-full opacity-[0.06]"
              style={{
                background: 'radial-gradient(ellipse at center top, white 0%, transparent 50%)',
              }}
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
