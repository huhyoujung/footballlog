export type RsvpStatus = "ATTEND" | "ABSENT" | "LATE";
export type LateFeeStatus = "PENDING" | "PAID";

export interface TrainingEventSummary {
  id: string;
  title: string;
  isRegular: boolean;
  date: string;
  location: string;
  rsvpDeadline: string;
  myRsvp: RsvpStatus | null;
  _count: { rsvps: number };
}

export interface TrainingEventDetail {
  id: string;
  teamId: string;
  createdById: string;
  title: string;
  isRegular: boolean;
  date: string;
  location: string;
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
  orderIndex: number;
  teamAssignments: {
    id: string;
    userId: string;
    teamLabel: string;
    user: { id: string; name: string | null; image: string | null };
  }[];
}
