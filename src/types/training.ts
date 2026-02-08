export interface TrainingLog {
  id: string;
  trainingDate: string;
  condition: number;
  conditionReason: string;
  keyPoints: string;
  improvement: string;
  imageUrl: string | null;
  title?: string | null;
  trainingEventId?: string | null;
  trainingEvent?: {
    id: string;
    title: string | null;
    date: string;
  } | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    image: string | null;
    position: string | null;
    number: number | null;
  };
  _count: {
    comments: number;
    likes: number;
  };
  isLiked: boolean;
}

export interface TeamMember {
  id: string;
  name: string | null;
  image: string | null;
  position: string | null;
  number: number | null;
  role: string;
}

export interface GroupedLogs {
  displayDate: string;
  logs: TrainingLog[];
}
