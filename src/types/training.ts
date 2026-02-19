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
    mvpId?: string | null;
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
  isMvp?: boolean; // MVP 여부 (본인이 MVP인 경우)
  eventHasMvp?: boolean; // 해당 이벤트에 MVP가 선출된 경우
  matchedEventId?: string; // 매칭된 운동 이벤트 ID
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
  date: string; // 실제 날짜 (YYYY-MM-DD)
  displayDate: string; // 표시용 날짜 ("오늘", "어제", "1월 5일")
  logs: TrainingLog[];
}
