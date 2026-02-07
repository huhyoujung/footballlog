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
      className="block px-6 my-4"
    >
      <div className="relative max-w-sm mx-auto invite-card-emerge">
        {/* 편지지 (봉투에서 위로 삐져나옴) */}
        <div className="relative z-10 mx-4 -mb-1">
          <div className="bg-white border-2 border-team-500 rounded-t px-5 pt-5 pb-6">
            <div className="text-center">
              {/* INVITATION 레이블 */}
              <div className="mb-3">
                <span className="text-team-400 text-[10px] font-semibold tracking-[0.2em] uppercase">
                  INVITATION
                </span>
              </div>

              {/* 타이틀 */}
              <h3 className="text-base font-bold text-team-700">{event.title}</h3>

              {/* 정보 */}
              <div className="mt-2.5 space-y-1">
                <div className="text-sm text-team-600">{dateStr}</div>
                <div className="text-sm text-team-500">{event.location}</div>
              </div>

              {/* 구분선 + 축구공 */}
              <div className="flex items-center gap-3 my-3">
                <div className="flex-1 border-t border-team-200" />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" className="text-team-300" />
                  <path d="M12 7 L15.5 10 L14 14.5 L10 14.5 L8.5 10 Z" stroke="currentColor" strokeWidth="1" fill="none" className="text-team-300" />
                </svg>
                <div className="flex-1 border-t border-team-200" />
              </div>

              {/* CTA */}
              <p className="text-sm font-semibold text-team-700">
                참석 여부를 알려주세요
              </p>
              <div className="flex items-center justify-center gap-3 mt-1.5">
                <span className="text-[11px] text-team-400">마감 {deadlineStr}</span>
                <span className="text-[11px] text-team-400">{event._count.rsvps}명 응답</span>
              </div>
            </div>
          </div>
        </div>

        {/* 봉투 */}
        <div className="relative z-20">
          {/* 열린 봉투 뚜껑 (위로 펼쳐진 삼각형 아웃라인) */}
          <svg
            viewBox="0 0 300 55"
            preserveAspectRatio="none"
            className="w-full block"
            style={{ height: 36, marginBottom: -2 }}
          >
            <polygon
              points="5,53 150,5 295,53"
              fill="white"
              stroke="var(--color-team-500)"
              strokeWidth="4"
              strokeLinejoin="round"
            />
          </svg>

          {/* 봉투 몸체 */}
          <div
            className="relative border-[2.5px] border-t-0 border-team-500 bg-white overflow-hidden"
            style={{ height: 52, borderRadius: '0 0 6px 6px' }}
          >
            {/* 앞면 V 접힘선 */}
            <svg
              viewBox="0 0 300 65"
              preserveAspectRatio="none"
              className="absolute inset-0 w-full h-full"
            >
              <polyline
                points="4,0 150,62 296,0"
                fill="none"
                stroke="var(--color-team-500)"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
