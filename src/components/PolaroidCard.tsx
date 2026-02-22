"use client";

import Link from "next/link";
import Image from "next/image";
import ConditionBadge from "./ConditionBadge";
import { getConditionBgColor, getConditionTextColor } from "@/lib/condition";
import { useTeam } from "@/contexts/TeamContext";
import type { TrainingLog } from "@/types/training";

interface Props {
  log: TrainingLog;
  variant: "stack" | "full";
  onLikeToggle?: (logId: string) => void;
}

function TeamLogoFallback({ size }: { size: "sm" | "lg" }) {
  const { teamData } = useTeam();
  const logoUrl = teamData?.logoUrl;
  const dim = size === "sm" ? 48 : 72;

  if (logoUrl) {
    return (
      <div className="rounded-full overflow-hidden opacity-40" style={{ width: dim, height: dim }}>
        <Image
          src={logoUrl}
          alt="팀 로고"
          width={dim}
          height={dim}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <svg width={dim} height={dim} viewBox="0 0 32 32" fill="none" className="opacity-30">
      <circle cx="16" cy="16" r="15" className="fill-team-500" />
      <circle cx="16" cy="16" r="7" fill="none" className="stroke-team-50" strokeWidth="1.5" />
      <path d="M16 9 L16 23 M9 16 L23 16" className="stroke-team-50" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="16" r="2.5" className="fill-team-50" />
    </svg>
  );
}

export default function PolaroidCard({ log, variant, onLikeToggle }: Props) {
  if (variant === "stack") {
    return (
      <div className="w-36 h-44 bg-white rounded-sm p-1.5 pb-4 border border-gray-100/50" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)' }}>
        {log.imageUrl ? (
          <div className="w-full h-full relative rounded-sm overflow-hidden">
            <Image
              src={log.imageUrl}
              alt=""
              fill
              className="object-cover"
              sizes="144px"
            />
          </div>
        ) : (
          <div className="w-full h-full rounded-sm bg-team-50 flex items-center justify-center">
            <TeamLogoFallback size="sm" />
          </div>
        )}
      </div>
    );
  }

  // variant === "full" — large polaroid, tap to go to detail
  return (
    <Link href={`/log/${log.id}`} prefetch={true} className="block touch-manipulation active:scale-[0.98] transition-transform">
      <div className="w-64 bg-white rounded-sm p-2 pb-5 border border-gray-100/50" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}>
        {/* 사진 또는 팀 로고 + 컨디션 */}
        {log.imageUrl ? (
          <div className="w-full aspect-[3/4] relative rounded-sm overflow-hidden">
            <Image
              src={log.imageUrl}
              alt="운동 사진"
              fill
              className="object-cover"
              sizes="256px"
            />
          </div>
        ) : (
          <div
            className={`w-full aspect-[3/4] rounded-sm flex flex-col items-center justify-center gap-2 ${getConditionBgColor(log.condition)}`}
          >
            <TeamLogoFallback size="lg" />
            <span
              className={`text-3xl font-bold ${getConditionTextColor(log.condition)}`}
            >
              {log.condition}
            </span>
          </div>
        )}

        {/* 하단: 작성자 + 에너지 레벨 */}
        <div className="mt-2 flex items-center justify-between px-0.5">
          <span className="font-medium text-sm text-gray-900 truncate">
            {log.user.name || "익명"}
          </span>
          <ConditionBadge condition={log.condition} />
        </div>
      </div>
    </Link>
  );
}
