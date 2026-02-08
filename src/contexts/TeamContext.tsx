"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";

interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  role: string;
  position: string | null;
  number: number | null;
  attendanceRate: number;
}

interface TeamData {
  id: string;
  name: string;
  inviteCode: string;
  logoUrl: string | null;
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
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTeam = async () => {
    if (!session?.user?.teamId) {
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/teams");
      if (res.ok) {
        const data = await res.json();
        setTeamData(data);
      }
    } catch (error) {
      console.error("팀 데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeam();
  }, [session?.user?.teamId]);

  const refetch = async () => {
    setLoading(true);
    await fetchTeam();
  };

  return (
    <TeamContext.Provider value={{ teamData, loading, refetch }}>
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
