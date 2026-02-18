<!-- 메인 피드 페이지 기능 명세서 -->

# 메인 피드

> 팀원들의 운동 기록을 폴라로이드 카드 형태로 날짜별 그룹핑하여 보여주는 메인 피드 페이지

## 개요

메인 피드는 football-log 앱의 랜딩 페이지로, 팀원들의 운동 일지를 폴라로이드 사진 스택 형태로 시각화한다. 상단에는 전광판(티커 배너)이 실시간 정보를 롤링 표시하고, 팀 운동 이벤트에 대한 참석 투표 초대장과 체크인 카드가 피드 상단에 노출된다. 운동 기록은 날짜별로 그룹핑되어 폴라로이드 스택으로 쌓이고, 클릭 시 캐러셀로 펼쳐진다. 칭찬 쪽지(포스트잇)도 폴라로이드 옆에 함께 배치된다.

### 하위 기능

| ID | 하위 기능 | 설명 |
|----|-----------|------|
| 6-1 | 메인 피드 | 폴라로이드 스택/캐러셀, 초대장/체크인 카드, SWR 병렬 페칭 |
| 6-2 | 티커 배너 | LED 전광판, 8초 롤링, 운동·MVP·활동 메시지 |

## 관련 파일

| 파일 경로 | 역할 |
|-----------|------|
| `src/app/page.tsx` | 홈 페이지 - 인증 상태 분기 및 Feed 렌더링 |
| `src/components/Feed.tsx` | 메인 피드 오케스트레이터 (데이터 페칭, 그룹핑, 레이아웃) |
| `src/components/TickerBanner.tsx` | 전광판 배너 (LED 도트 매트릭스 스타일) |
| `src/components/TrainingInviteCard.tsx` | 팀 운동 참석 투표 초대장 카드 |
| `src/components/TrainingCheckInCard.tsx` | 팀 운동 체크인 유도 카드 |
| `src/components/PolaroidDateGroup.tsx` | 날짜별 그룹 (스택/캐러셀 전환) |
| `src/components/PolaroidStack.tsx` | 폴라로이드 스택 (겹쳐진 카드 + 포스트잇) |
| `src/components/PolaroidCard.tsx` | 개별 폴라로이드 카드 (stack/full 두 가지 변형) |
| `src/components/SWRProvider.tsx` | 글로벌 SWR 캐시 프로바이더 |

## API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/training-logs?limit=20` | 최신 운동 일지 20개 조회 |
| GET | `/api/nudges` | 닦달 메시지 조회 |
| GET | `/api/training-events/next` | 다가오는 팀 운동 이벤트 목록 |
| GET | `/api/pom/recent-mvp` | 최근 MVP 정보 |
| GET | `/api/locker-notes` | 최근 칭찬 쪽지 목록 |
| POST | `/api/training-logs/{id}/likes` | 좋아요 토글 |
| POST | `/api/training-events/{id}/check-in` | 체크인 처리 |

## 주요 코드

### 6-1. 메인 피드

#### 1. 홈 페이지 인증 분기 (`src/app/page.tsx`)

인증 상태에 따라 로그인/온보딩 페이지로 리다이렉트하고, 로딩 중에는 스켈레톤 UI를 표시한다.

```tsx
// src/app/page.tsx
export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    } else if (status === "authenticated" && !session?.user?.teamId) {
      router.replace("/onboarding");
    }
  }, [session, status, router]);

  // 세션 로딩 중이거나 미인증이면 스켈레톤 (빈 화면 대신 즉각 피드백)
  if (status !== "authenticated") {
    return (
      <div className="min-h-screen bg-white">
        {/* ...스켈레톤 UI... */}
      </div>
    );
  }

  return <Feed />;
}
```

#### 2. SWR 데이터 페칭 패턴 (`src/components/Feed.tsx`)

모든 데이터를 SWR로 병렬 페칭하며, 5분 캐시와 `keepPreviousData`로 뒤로가기 시 즉시 표시한다.

```tsx
// src/components/Feed.tsx

// SWR 설정 (컴포넌트 밖으로 이동 -- 매 렌더마다 재생성 방지)
// 글로벌 SWRProvider의 5분 캐시와 동일 -- 뒤로가기 시 캐시에서 즉시 표시
const swrConfig = {
  revalidateOnFocus: false,
  revalidateIfStale: false,
  dedupingInterval: 300000, // 5분 -- 글로벌 캐시와 동일
  keepPreviousData: true,
};

export default function Feed() {
  // SWR로 데이터 페칭 - 최신 20개만 먼저 로드 (속도 개선)
  const { data: logsData, mutate: mutateLogs } = useSWR<{ logs: TrainingLog[] }>(
    "/api/training-logs?limit=20",
    fetcher,
    swrConfig
  );

  const { data: nudgesData } = useSWR<{ nudges: Nudge[] }>(
    "/api/nudges",
    fetcher,
    swrConfig
  );

  const { data: eventsData, mutate: mutateEvents } = useSWR<{ events: TrainingEventSummary[] }>(
    "/api/training-events/next",
    fetcher,
    swrConfig
  );

  const { data: mvpData } = useSWR<{ mvp: RecentMvp | null }>(
    "/api/pom/recent-mvp",
    fetcher,
    swrConfig
  );

  const { data: recentNotesData } = useSWR<LockerNote[]>(
    "/api/locker-notes",
    fetcher,
    swrConfig
  );
  // ...
}
```

#### 3. 글로벌 SWR 캐시 프로바이더 (`src/components/SWRProvider.tsx`)

페이지 전환 시에도 캐시를 유지하기 위해 `useState`로 Map 기반 캐시를 관리한다.

```tsx
// src/components/SWRProvider.tsx
export default function SWRProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // SWR 캐시를 컴포넌트 상태로 관리하여 페이지 전환 시에도 유지
  const [cache] = useState(() => new Map());

  return (
    <SWRConfig
      value={{
        provider: () => cache, // 전역 캐시 공유
        dedupingInterval: 300000, // 5분 - 같은 요청 중복 방지
        focusThrottleInterval: 300000, // 5분 - 포커스 시 재검증 제한
        revalidateOnFocus: false, // 탭 전환 시 자동 새로고침 비활성화
        revalidateOnReconnect: false, // 재연결 시 새로고침 비활성화 (캐시 우선)
        revalidateIfStale: false, // stale 데이터도 그대로 사용
        errorRetryCount: 2, // 에러 시 2번까지 재시도
        errorRetryInterval: 1000, // 1초 간격으로 재시도
        shouldRetryOnError: true,
        keepPreviousData: true, // 새 데이터 로드 중에도 이전 데이터 유지
        fetcher: (url: string) => fetch(url).then((res) => res.json()),
      }}
    >
      {children}
    </SWRConfig>
  );
}
```

#### 4. 날짜별 그룹핑 로직 (`src/components/Feed.tsx`)

운동 기록과 쪽지를 날짜별로 그룹핑하며, 오늘/어제는 한국어로 표시한다. 오늘 날짜의 기록은 최신순, 그 외는 시간순으로 정렬한다.

```tsx
// src/components/Feed.tsx

// 쪽지를 날짜별로 미리 그룹핑 (O(n) 1회만)
const notesByDate = useMemo(() => {
  const map: Record<string, LockerNote[]> = {};
  for (const note of recentNotes) {
    const date = getNoteDateString(note);
    if (!map[date]) map[date] = [];
    map[date].push(note);
  }
  return map;
}, [recentNotes]);

// 날짜별 그룹핑 (쪽지만 있는 날짜도 포함)
const groupedLogs = useMemo((): GroupedLogs[] => {
  const today = getLocalDateString(new Date());
  const yesterday = getLocalDateString(new Date(Date.now() - 86400000));

  const grouped: Record<string, TrainingLog[]> = {};
  for (const log of logs) {
    const date = getLocalDateString(new Date(log.trainingDate));
    if (!grouped[date]) grouped[date] = [];
    grouped[date].push(log);
  }

  // 쪽지만 있는 날짜도 그룹에 추가
  for (const date of Object.keys(notesByDate)) {
    if (!grouped[date]) grouped[date] = [];
  }

  return Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dateLogs]) => {
      const sortedLogs = [...dateLogs].sort((a, b) => {
        if (date === today) {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        } else {
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
      });

      return {
        date,
        displayDate:
          date === today
            ? "오늘"
            : date === yesterday
              ? "어제"
              : new Date(date).toLocaleDateString("ko-KR", {
                  month: "long",
                  day: "numeric",
                }),
        logs: sortedLogs,
      };
    });
}, [logs, notesByDate]);
```

### 6-2. 티커 배너

#### 5. 전광판 메시지 생성 (`src/components/Feed.tsx`)

팀 운동 일정, MVP, 오늘 1등, 닦달, 쪽지, 활동 현황 등 다양한 소스에서 메시지를 수집한다.

```tsx
// src/components/Feed.tsx

const tickerMessages = useMemo(() => {
  const messages: { key: string; text: string; url?: string }[] = [];

  // 팀 운동 (최우선)
  for (const event of nextEvents) {
    const d = new Date(event.date);
    const dateStr = d.toLocaleDateString("ko-KR", { month: "numeric", day: "numeric", weekday: "short" });
    const timeStr = d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });

    let weatherIcon = "";
    if (event.weather) {
      if (event.weather === "Clear") weatherIcon = "☀️";
      else if (event.weather === "Clouds") weatherIcon = "☁️";
      else if (event.weather === "Rain") weatherIcon = "🌧️";
      else if (event.weather === "Snow") weatherIcon = "❄️";
    }

    let weatherInfo = "";
    if (event.weather && event.temperature !== null) {
      weatherInfo = ` · ${weatherIcon} ${event.temperature}°C`;
    }

    if (event.airQualityIndex !== null) {
      const aqGrade = getAirQualityGrade(event.airQualityIndex);
      weatherInfo += ` · 대기질 ${aqGrade.emoji}`;
    }

    messages.push({
      key: `event-${event.id}`,
      text: `📢 ${event.title || "팀 운동"} · ${dateStr} ${timeStr} · ${event.location}${weatherInfo}`,
      url: `/training/${event.id}`,
    });
  }

  // MVP 메시지 (24시간 이내)
  if (recentMvp) {
    const mvpName = recentMvp.user.name || "팀원";
    const whenText = recentMvp.isToday ? "오늘" : recentMvp.isYesterday ? "어제" : "최근";
    messages.push({
      key: "mvp",
      text: `🏆 ${mvpName}님이 ${whenText} MVP였습니다!`,
    });
  }

  // 활동 메시지
  const activeCount = new Set(
    logs.filter(log => getLocalDateString(new Date(log.trainingDate)) === today).map(log => log.user.id)
  ).size;
  const total = teamMembers.length;
  if (activeCount === 0) {
    messages.push({ key: "activity", text: "라커룸이 조용하네요 오늘의 첫 기록을 남겨보세요!" });
  } else if (activeCount >= total && total > 0) {
    messages.push({ key: "activity", text: `전원 출석! ${activeCount}명 운동 완료 🎉` });
  } else {
    messages.push({ key: "activity", text: `오늘 ${activeCount}명 운동 완료! 🔥` });
  }

  return messages;
}, [nextEvents, recentMvp, logs, nudges, recentNotes, teamMembers.length]);
```

#### 6. 전광판 배너 컴포넌트 (`src/components/TickerBanner.tsx`)

LED 도트 매트릭스 스타일의 전광판으로, 메시지를 8초 간격으로 롤링하며, 긴 메시지는 CSS 애니메이션으로 가로 스크롤된다.

```tsx
// src/components/TickerBanner.tsx
export default function TickerBanner({ messages }: Props) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isInitial, setIsInitial] = useState(true);

  // Message rotation
  useEffect(() => {
    if (messages.length <= 1) return;

    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % messages.length);
        setIsAnimating(false);
      }, 800);
    }, 8000);

    return () => clearInterval(interval);
  }, [messages.length]);

  // ...

  return (
    <div
      className={`overflow-hidden h-10 relative ${current.url ? "cursor-pointer" : ""}`}
      onClick={handleClick}
      style={{
        background: 'linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 50%, #000000 100%)',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 2px rgba(255,255,255,0.1), 0 1px 0 rgba(0,0,0,0.5)',
        borderTop: '1px solid #333',
        borderBottom: '1px solid #111',
      }}
    >
      {/* LED 도트 매트릭스 패턴 */}
      {/* 스캔라인 효과 */}
      {/* ...메시지 텍스트 (긴 메시지는 ticker-scroll 애니메이션)... */}
    </div>
  );
}
```

#### 7. Optimistic UI 좋아요 토글 (`src/components/Feed.tsx`)

서버 응답 전에 UI를 먼저 업데이트하고, 실패 시 롤백하는 Optimistic Update 패턴을 사용한다.

```tsx
// src/components/Feed.tsx

const handleLikeToggle = useCallback(async (logId: string) => {
  const target = logs.find((l) => l.id === logId);
  if (!target) return;

  const wasLiked = target.isLiked;
  const prevCount = target._count.likes;

  // Optimistic update - 즉시 UI 반영
  mutateLogs(
    (current) => {
      if (!current) return current;
      return {
        ...current,
        logs: current.logs.map((log) =>
          log.id === logId
            ? {
                ...log,
                isLiked: !wasLiked,
                _count: { ...log._count, likes: wasLiked ? prevCount - 1 : prevCount + 1 },
              }
            : log
        ),
      };
    },
    false // revalidate 하지 않음
  );

  try {
    const res = await fetch(`/api/training-logs/${logId}/likes`, { method: "POST" });

    if (res.ok) {
      const data = await res.json();
      // 서버 응답으로 최종 업데이트
      mutateLogs(/* 서버 데이터 반영 */, false);
      showToast(data.liked ? "좋아요를 눌렀어요" : "좋아요를 취소했어요");
    } else {
      mutateLogs(); // 실패 시 서버 데이터로 롤백
    }
  } catch (error) {
    mutateLogs(); // 에러 시 롤백
  }
}, [logs, mutateLogs, showToast]);
```

#### 8. 미투표 초대장 / 체크인 필터링 (`src/components/Feed.tsx`)

다가오는 이벤트 중 RSVP 미응답 건과 체크인 가능한 건을 필터링한다.

```tsx
// src/components/Feed.tsx

// 미투표 초대장 목록
const pendingInvites = useMemo(() =>
  nextEvents.filter(
    (event) => !event.myRsvp && new Date() < new Date(event.rsvpDeadline)
  ),
  [nextEvents]
);

// 체크인 대기 목록
const checkInEvents = useMemo(() =>
  nextEvents.filter(
    (event) =>
      (event.myRsvp === "ATTEND" || event.myRsvp === "LATE") &&
      !event.myCheckIn &&
      isCheckInPeriod(event.date)
  ),
  [nextEvents]
);
```

#### 9. 폴라로이드 스택 결정론적 배치 (`src/components/PolaroidStack.tsx`)

날짜 문자열을 시드로 한 결정론적 난수 생성기를 사용하여, 같은 날짜의 카드는 항상 같은 위치/각도로 배치된다.

```tsx
// src/components/PolaroidStack.tsx

// 날짜 문자열을 seed로 한 결정론적 난수 (같은 날짜 → 항상 같은 배치)
function seededRandom(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return (n: number) => {
    hash = (hash * 16807 + 12345) | 0;
    return ((hash & 0x7fffffff) % 1000) / 1000 * n;
  };
}

function generateStackConfigs(date: string) {
  const rand = seededRandom(date);

  return [
    {
      top: 10 + rand(10),
      left: -12 + rand(8),
      rotation: -12 + rand(10),
      zIndex: 1,
    },
    {
      top: 3 + rand(8),
      left: 4 + rand(14),
      rotation: 2 + rand(10),
      zIndex: 2,
    },
    {
      top: rand(4),
      left: -2 + rand(6),
      rotation: -8 + rand(8),
      zIndex: 3,
    },
  ];
}
```

#### 10. 날짜별 그룹 스택/캐러셀 전환 (`src/components/PolaroidDateGroup.tsx`)

`isExpanded` 상태에 따라 폴라로이드 스택과 캐러셀을 전환한다.

```tsx
// src/components/PolaroidDateGroup.tsx
export default function PolaroidDateGroup({
  logs, date, displayDate, isExpanded, isExpanding,
  onExpand, onCollapse, onLikeToggle, notes = [],
  hideCount = false, disableNoteOpen = false, currentUserId,
}: Props) {
  return (
    <div className="transition-all duration-300 ease-out">
      {isExpanded ? (
        <PolaroidCarousel
          logs={logs}
          displayDate={displayDate}
          onCollapse={onCollapse}
          onLikeToggle={onLikeToggle}
        />
      ) : (
        <PolaroidStack
          logs={logs}
          date={date}
          displayDate={displayDate}
          onClick={onExpand}
          isExpanding={isExpanding}
          notes={notes}
          hideCount={hideCount}
          disableNoteOpen={disableNoteOpen}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}
```

#### 11. 폴라로이드 카드 두 가지 변형 (`src/components/PolaroidCard.tsx`)

`stack` 변형은 스택에서 사용하는 작은 카드, `full` 변형은 캐러셀에서 사용하는 큰 카드다.

```tsx
// src/components/PolaroidCard.tsx
export default function PolaroidCard({ log, variant, onLikeToggle }: Props) {
  if (variant === "stack") {
    return (
      <div className="w-36 h-44 bg-white rounded-sm p-1.5 pb-4 border border-gray-100/50"
           style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.1), 0 1px 3px rgba(0,0,0,0.06)' }}>
        {log.imageUrl ? (
          <div className="w-full h-full relative rounded-sm overflow-hidden">
            <Image src={log.imageUrl} alt="" fill className="object-cover" sizes="144px" unoptimized />
          </div>
        ) : (
          <div className="w-full h-full rounded-sm bg-team-50" />
        )}
      </div>
    );
  }

  // variant === "full" -- large polaroid, tap to go to detail
  return (
    <Link href={`/log/${log.id}`} prefetch={true} className="block touch-manipulation active:scale-[0.98] transition-transform">
      <div className="w-64 bg-white rounded-sm p-2 pb-5 border border-gray-100/50"
           style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.08)' }}>
        {/* 사진 또는 컨디션 컬러 배경 */}
        {/* 하단: 작성자 + 에너지 레벨 */}
      </div>
    </Link>
  );
}
```

#### 12. 초대장 카드 (`src/components/TrainingInviteCard.tsx`)

RSVP 미응답 상태의 팀 운동을 카드 형태로 표시하여 참석 여부 응답을 유도한다.

```tsx
// src/components/TrainingInviteCard.tsx
export default function TrainingInviteCard({ event }: Props) {
  const dateStr = new Date(event.date).toLocaleDateString("ko-KR", {
    month: "numeric", day: "numeric", weekday: "short",
    hour: "2-digit", minute: "2-digit",
  });

  const deadlineStr = new Date(event.rsvpDeadline).toLocaleDateString("ko-KR", {
    month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit",
  });

  return (
    <Link href={`/training/${event.id}`} prefetch={true}
          className="block flex-shrink-0 w-[280px] touch-manipulation active:scale-[0.98] transition-transform">
      <div className="bg-gradient-to-br from-team-500 to-team-600 rounded-2xl p-4 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-lg font-bold text-white flex-1">{event.title}</h3>
          <span className="px-2.5 py-1 bg-white/20 text-white text-xs font-medium rounded-full flex-shrink-0">
            {event._count.rsvps}명 응답
          </span>
        </div>
        {/* 일정, 장소, 마감 정보 */}
        <div className="pt-3 border-t border-white/20 flex items-center justify-between">
          <span className="text-white/70 text-xs">마감: {deadlineStr}</span>
          <span className="text-white font-semibold text-sm">참석 여부 응답하기 →</span>
        </div>
      </div>
    </Link>
  );
}
```

#### 13. 체크인 카드 (`src/components/TrainingCheckInCard.tsx`)

체크인 시간대에 도달한 이벤트에 대해 한 번의 탭으로 체크인을 완료하는 카드다. Optimistic UI로 즉시 페이지 이동 후 백그라운드에서 API를 호출한다.

```tsx
// src/components/TrainingCheckInCard.tsx
export default function TrainingCheckInCard({
  event, onCheckInSuccess, onShowToast,
}: TrainingCheckInCardProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const { playSound } = useSound();

  const { message, isPast } = getTimeUntilEvent(event.date);

  const handleCheckIn = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitting(true);

    // Optimistic UI: 즉시 페이지 이동
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
    router.push(`/training/${event.id}`);

    // 백그라운드에서 API 호출
    try {
      const res = await fetch(`/api/training-events/${event.id}/check-in`, {
        method: "POST",
      });

      if (res.ok) {
        playSound("whistle"); // 체크인 성공 - 휘슬 소리
        onShowToast?.(timeStr + "에 체크인되었습니다");
        onCheckInSuccess?.();
      } else {
        const data = await res.json();
        onShowToast?.(data.error || "체크인에 실패했습니다");
      }
    } catch (error) {
      onShowToast?.("체크인에 실패했습니다");
    }
  };

  return (
    <div className="flex-shrink-0 w-[280px] bg-team-500 rounded-2xl p-4 pt-6 shadow-xl">
      <h3 className="text-base font-bold text-white">{event.title || "정기운동"}</h3>
      <p className="text-sm text-white">{message}</p>
      <button
        onClick={handleCheckIn}
        disabled={submitting}
        className="w-full bg-white text-team-600 font-bold py-3.5 px-4 rounded-xl ..."
      >
        여기를 눌러 체크인 →
      </button>
    </div>
  );
}
```

## 비즈니스 규칙

### 인증 및 접근 제어
- 미인증 사용자는 `/login`으로 리다이렉트
- 팀 미가입 사용자는 `/onboarding`으로 리다이렉트
- 운영진(`ADMIN` 역할)만 FAB 메뉴에서 팀 운동 생성/일지 작성 메뉴 접근 가능
- 일반 회원의 FAB는 칭찬 쪽지 작성 페이지로 바로 연결

### 초대장 표시 조건
- RSVP 미응답 (`!event.myRsvp`) 이면서 마감 전 (`new Date() < new Date(event.rsvpDeadline)`)인 이벤트만 표시

### 체크인 표시 조건
- 참석(`ATTEND`) 또는 늦참(`LATE`) 응답 후, 체크인 미완료(`!event.myCheckIn`) 이면서, 체크인 가능 시간대(`isCheckInPeriod(event.date)`)인 이벤트만 표시

### 데이터 정렬
- 날짜 그룹: 최신 날짜 먼저 (내림차순)
- 오늘 날짜 기록: 최신 작성순 (내림차순)
- 과거 날짜 기록: 시간순 (오름차순)

### 좋아요
- Optimistic Update로 즉시 UI 반영
- 서버 응답 실패 시 자동 롤백 (`mutateLogs()` 호출)

### 전광판 메시지 우선순위
1. 팀 운동 일정 (날씨/대기질 정보 포함)
2. MVP 알림
3. 오늘 첫 기록자
4. 닦달 메시지
5. 칭찬 쪽지 알림
6. 활동 현황 요약

### 캐싱 전략
- 글로벌 SWR 캐시: 5분 TTL, Map 기반
- `revalidateOnFocus: false` - 탭 전환 시 재요청 방지
- `keepPreviousData: true` - 로딩 중에도 이전 데이터 유지
- `dedupingInterval: 300000` - 5분 내 동일 요청 중복 방지

## 데이터 모델

피드에서 직접 사용하는 주요 모델은 `TrainingLog`, `TrainingEvent`, `LockerNote` 등이며, 이들은 각각의 API를 통해 조회된다. 피드 컴포넌트에서 사용하는 타입 인터페이스는 다음과 같다:

```tsx
// src/components/Feed.tsx 내 인터페이스 정의

interface Nudge {
  id: string;
  sender: { id: string; name: string | null };
  recipient: { id: string; name: string | null };
  createdAt: string;
}

interface RecentMvp {
  user: {
    id: string;
    name: string | null;
    image: string | null;
    position: string | null;
    number: number | null;
  };
  voteCount: number;
  eventDate: string;
  eventTitle: string | null;
  isToday: boolean;
  isYesterday: boolean;
}

interface LockerNote {
  id: string;
  content: string;
  color: string;
  rotation: number;
  positionX: number;
  positionY: number;
  tags: string[];
  createdAt: string;
  isAnonymous: boolean;
  recipient: { id: string; name: string | null };
  author: { id: string; name: string | null };
  trainingLog?: { trainingDate: string } | null;
  trainingEvent?: { date: string } | null;
}
```

## 프론트엔드

### 주요 페이지/컴포넌트 구조

```
page.tsx (인증 분기)
  └── Feed.tsx (오케스트레이터)
        ├── TickerBanner (전광판 - sticky)
        ├── TrainingCheckInCard[] (체크인 카드 - 가로 스크롤)
        ├── TrainingInviteCard[] (초대장 카드 - 가로 스크롤)
        └── PolaroidDateGroup[] (날짜별 그룹)
              ├── PolaroidStack (접힌 상태)
              │     ├── PolaroidCard (variant="stack") x 최대 3장
              │     └── PostItNote[] (쪽지 - 좌우/하단 배치)
              └── PolaroidCarousel (펼친 상태)
                    └── PolaroidCard (variant="full")
```

### 데이터 페칭 패턴

- **SWR (stale-while-revalidate)**: 모든 데이터를 SWR 훅으로 페칭
- **병렬 페칭**: 5개 엔드포인트를 동시에 호출 (training-logs, nudges, training-events/next, pom/recent-mvp, locker-notes)
- **캐시 우선**: 뒤로가기 시 캐시된 데이터를 즉시 표시하고 백그라운드에서 재검증
- **Optimistic Update**: 좋아요, 체크인 등 사용자 액션은 서버 응답 전에 UI 먼저 반영

### UX 특징

- **폴라로이드 스택 인터랙션**: 날짜별 카드가 실제 사진처럼 겹쳐 쌓이고, 탭 시 캐러셀로 펼쳐짐 (기록 1개면 바로 상세 페이지로 이동)
- **결정론적 배치**: 시드 기반 난수로 같은 날짜는 항상 동일한 카드 각도/위치 유지
- **LED 전광판**: 8초 간격 메시지 롤링, 50자 초과 시 CSS `ticker-scroll` 애니메이션
- **체크인 사운드**: 체크인 성공 시 휘슬 효과음 (`playSound("whistle")`)
- **스켈레톤 UI**: 인증 로딩 중 펄스 애니메이션으로 레이아웃 힌트 제공
- **빈 상태**: 기록이 없을 때 "라커룸이 조용하네요" 메시지와 "첫 기록 남기기" CTA
- **FAB 메뉴**: 운영진은 일지 작성/칭찬 쪽지/팀 운동 생성 메뉴, 일반 회원은 칭찬 쪽지 바로가기
- **포스트잇 배치**: 폴라로이드 스택 양옆에 쪽지 최대 5개씩, 넘치는 쪽지는 하단에 흩뿌리기
- **Push 알림**: 로그인 후 자동으로 푸시 구독 요청 (`usePushSubscription`)
