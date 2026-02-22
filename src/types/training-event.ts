export type RsvpStatus = "ATTEND" | "ABSENT" | "LATE";
export type LateFeeStatus = "PENDING" | "PAID";

export interface TrainingEventSummary {
  id: string;
  title: string;
  isRegular: boolean;
  date: string;
  location: string;
  venue: { name: string } | null;
  weather: string | null;
  weatherDescription: string | null;
  temperature: number | null;
  minTempC: number | null;
  maxTempC: number | null;
  feelsLikeC: number | null;
  precipMm: number | null;
  chanceOfRain: number | null;
  windKph: number | null;
  uvIndex: number | null;
  airQualityIndex: number | null;
  pm25: number | null;
  pm10: number | null;
  sunrise: string | null;
  sunset: string | null;
  rsvpDeadline: string;
  myRsvp: RsvpStatus | null;
  myCheckIn: string | null; // checkedInAt ISO string
  _count: { rsvps: number };
}

export interface TrainingEventDetail {
  id: string;
  teamId: string;
  createdById: string;
  title: string;
  isRegular: boolean;
  isFriendlyMatch: boolean;
  opponentTeamName: string | null;
  minimumPlayers: number | null;
  enablePomVoting: boolean;
  pomVotingDeadline: string | null;
  pomVotesPerPerson: number;
  date: string;
  location: string;
  venue: {
    id: string;
    name: string;
    mapUrl: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  weather: string | null;
  weatherDescription: string | null;
  temperature: number | null;
  minTempC: number | null;
  maxTempC: number | null;
  feelsLikeC: number | null;
  precipMm: number | null;
  chanceOfRain: number | null;
  windKph: number | null;
  uvIndex: number | null;
  airQualityIndex: number | null;
  pm25: number | null;
  pm10: number | null;
  sunrise: string | null;
  sunset: string | null;
  shoes: string[];
  uniform: string | null;
  notes: string | null;
  vestBringer: { id: string; name: string | null } | null;
  vestReceiver: { id: string; name: string | null } | null;
  rsvpDeadline: string;
  createdAt: string;
  rsvps: RsvpEntry[];
  checkIns: CheckInEntry[];
  sessions: SessionEntry[];
  // 관리 페이지(?includeManagement=true)에서만 포함
  lateFees?: LateFeeEntry[];
  equipmentAssignments?: EquipmentAssignmentEntry[];
  // 친선경기 관련
  matchStatus: "DRAFT" | "CHALLENGE_SENT" | "CONFIRMED" | "RULES_PENDING" | "RULES_CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  linkedEventId: string | null;
  linkedEvent: { id: string; challengeToken: string | null; _count: { rsvps: number } } | null;
  opponentTeamId: string | null;
  opponentTeam: { id: string; name: string; logoUrl: string | null; primaryColor: string | null } | null;
  challengeToken: string | null;
  challengeTokenExpiresAt: string | null;
  challengeRejectionReason: string | null;
  teamAScore: number;
  teamBScore: number;
  matchRules?: MatchRulesEntry | null;
  refereeAssignment?: RefereeAssignmentEntry | null;
  goalRecords?: GoalRecordEntry[];
  playerSubstitutions?: SubstitutionEntry[];
  cardRecords?: CardRecordEntry[];
  myRsvp: RsvpStatus | null;
  myCheckIn: string | null; // checkedInAt ISO string
}

export interface RsvpEntry {
  id: string;
  userId: string;
  status: RsvpStatus;
  reason: string | null;
  user: { id: string; name: string | null; image: string | null };
}

export interface CheckInEntry {
  id: string;
  userId: string;
  checkedInAt: string;
  isLate: boolean;
  manualEntry?: boolean;
  user: { id: string; name: string | null; image: string | null };
}

export interface LateFeeEntry {
  id: string;
  userId: string;
  amount: number;
  status: LateFeeStatus;
  createdAt: string;
  user: { id: string; name: string | null; image: string | null };
}

export interface SessionEntry {
  id: string;
  title: string | null;
  memo: string | null;
  requiresTeams: boolean;
  sessionType?: string;
  orderIndex: number;
  formation?: string | null;
  positions: Record<string, { x: number; y: number }> | null;
  teamAssignments: {
    id: string;
    userId: string;
    teamLabel: string;
    user: {
      id: string;
      name: string | null;
      image: string | null;
      position: string | null;
      number: number | null;
    };
  }[];
}

export interface QuarterRefereeEntry {
  id: string;
  quarter: number;
  userId: string;
  teamSide: "TEAM_A" | "TEAM_B";
  timerStatus: "IDLE" | "RUNNING" | "PAUSED" | "ENDED";
  elapsedSeconds: number;
  lastResumedAt: string | null;
  startedAt: string | null;
  endedAt: string | null;
  user: { id: string; name: string | null; image: string | null };
}

export interface RefereeAssignmentEntry {
  id: string;
  status: "DRAFT" | "PENDING_APPROVAL" | "CONFIRMED";
  quarterReferees: QuarterRefereeEntry[];
}

export interface MatchRulesEntry {
  id: string;
  template: "FUTSAL" | "ELEVEN_HALVES" | "CUSTOM";
  kickoffTime: string | null;
  quarterCount: number;
  quarterMinutes: number;
  quarterBreak: number;
  halftime: number;
  playersPerSide: number;
  allowBackpass: boolean;
  allowOffside: boolean;
  quarterRefereeTeams: ("TEAM_A" | "TEAM_B")[] | null;
}

export interface EquipmentAssignmentEntry {
  id: string;
  equipmentId: string;
  userId: string | null;
  memo: string | null;
  equipment: { id: string; name: string; description: string | null };
  user: { id: string; name: string | null; image: string | null } | null;
}

export interface GoalRecordEntry {
  id: string;
  quarter: number;
  minute: number | null;
  scoringTeam: "TEAM_A" | "TEAM_B";
  isOwnGoal: boolean;
  scorer: { id: string; name: string | null; image: string | null } | null;
  assistant: { id: string; name: string | null; image: string | null } | null;
  createdAt: string;
}

export interface SubstitutionEntry {
  id: string;
  quarter: number;
  minute: number | null;
  teamSide: "TEAM_A" | "TEAM_B";
  playerOut: { id: string; name: string | null; image: string | null } | null;
  playerIn: { id: string; name: string | null; image: string | null } | null;
  createdAt: string;
}

export interface CardRecordEntry {
  id: string;
  quarter: number;
  minute: number | null;
  cardType: "YELLOW" | "RED";
  teamSide: "TEAM_A" | "TEAM_B";
  player: { id: string; name: string | null; image: string | null } | null;
  createdAt: string;
}
