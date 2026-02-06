"use client";

import { getConditionTextColor } from "@/lib/condition";

interface Props {
  condition: number;
}

export default function ConditionBadge({ condition }: Props) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-bold ${getConditionTextColor(condition)}`}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="none">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
      </svg>
      {condition}
    </span>
  );
}
