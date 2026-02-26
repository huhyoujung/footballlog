"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const TABS = ["개요", "유저", "팀", "피드백"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  overview: ReactNode;
  users: ReactNode;
  teams: ReactNode;
  feedbacks: ReactNode;
}

export default function DashboardTabs({ overview, users, teams, feedbacks }: Props) {
  const [active, setActive] = useState<Tab>("개요");

  const content: Record<Tab, ReactNode> = { 개요: overview, 유저: users, 팀: teams, 피드백: feedbacks };

  return (
    <div>
      {/* 탭 바 */}
      <div className="flex border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActive(tab)}
            className={`px-5 py-3 text-sm font-medium transition-colors ${
              active === tab
                ? "border-b-2 border-gray-900 text-gray-900"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="space-y-8">{content[active]}</div>
    </div>
  );
}
