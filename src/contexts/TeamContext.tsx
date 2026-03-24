"use client";

import { createContext, useContext, ReactNode } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { fetcher } from "@/lib/fetcher";

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  role: string;
  position: string | null;
  number: number | null;
  phoneNumber: string | null;
  attendanceRate: number;
}

interface TeamData {
  id: string;
  name: string;
  inviteCode: string;
  logoUrl: string | null;
  vestOrder: string[];
  members: TeamMember[];
}

interface TeamContextType {
  teamData: TeamData | null;
  loading: boolean;
  refetch: () => Promise<void>;
}

const TeamContext = createContext<TeamContextType | undefined>(undefined);

export function TeamProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession();

  // SWR hook - 자동 캐싱, 백그라운드 재검증
  const { data: teamData, isLoading, mutate } = useSWR<TeamData>(
    session?.user?.teamId ? "/api/teams" : null,
    fetcher,
    {
      revalidateOnFocus: false, // 포커스 시 재검증 비활성화 (성능 개선)
      revalidateOnReconnect: true, // 네트워크 재연결 시 자동 갱신
      dedupingInterval: 60000, // 1분 캐시 (localStorage 영속 캐시 고려하여 단축)
      // revalidateIfStale: true (기본값) — localStorage 캐시 우선 표시 후 백그라운드 갱신
    }
  );

  const refetch = async () => {
    await mutate();
  };

  return (
    <TeamContext.Provider value={{ teamData: teamData || null, loading: isLoading, refetch }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const context = useContext(TeamContext);
  if (context === undefined) {
    throw new Error("useTeam must be used within a TeamProvider");
  }
  return context;
}
