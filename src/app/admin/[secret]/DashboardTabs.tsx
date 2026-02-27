"use client";

import { useState } from "react";
import type { ReactNode } from "react";

const TABS = ["개요", "유저", "팀", "피드백", "AI 사용량"] as const;
type Tab = (typeof TABS)[number];

interface Props {
  overview: ReactNode;
  users: ReactNode;
  teams: ReactNode;
  feedbacks: ReactNode;
  aiUsage: ReactNode;
}

export default function DashboardTabs({ overview, users, teams, feedbacks, aiUsage }: Props) {
  const [active, setActive] = useState<Tab>("개요");

  const content: Record<Tab, ReactNode> = {
    개요: overview,
    유저: users,
    팀: teams,
    피드백: feedbacks,
    "AI 사용량": aiUsage,
  };

  return (
    <div>
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
      <div className="space-y-8">{content[active]}</div>
    </div>
  );
}
