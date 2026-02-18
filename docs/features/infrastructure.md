# 인프라 & 유틸리티
> 푸시 알림, 날씨 API, PWA, 피드백 시스템, 이미지 업로드/압축, 크론 작업, 구장 관리

## 개요

football-log의 핵심 기능을 지탱하는 인프라 계층이다. 서비스의 실시간성(푸시 알림), 오프라인 경험(PWA/Service Worker), 외부 데이터 통합(날씨 API), 사용자 피드백 수집, 이미지 처리, 자동화 작업(크론) 등을 담당한다.

| 기능 | 핵심 역할 |
|------|-----------|
| **푸시 알림** | Web Push(VAPID)로 팀원에게 실시간 알림 발송 |
| **날씨 API** | WeatherAPI.com에서 운동 날짜/장소 기반 예보 조회 |
| **PWA** | Service Worker 등록, 동적 매니페스트, 오프라인 캐싱 |
| **피드백** | 사용자 의견 수집 + Resend 이메일 전송 |
| **이미지 업로드** | Supabase Storage에 이미지 저장 (5MB 제한) |
| **이미지 압축** | Canvas API로 클라이언트 사이드 리사이즈/JPEG 압축 |
| **크론 작업** | Vercel Cron으로 RSVP 리마인더, 날씨 알림 자동 발송 |
| **구장 관리** | 팀별 구장 검색/자동완성 + 사용 빈도 정렬 |

### 하위 기능

| ID | 하위 기능 | 설명 |
|----|-----------|------|
| 8-1 | 푸시 알림 | Web Push(VAPID), 팀/개인 발송, 만료 구독 정리 |
| 8-2 | 이미지 업로드 | Supabase Storage, 5MB 제한, 클라이언트 압축 |
| 8-3 | PWA | Service Worker, 동적 매니페스트, 자동 업데이트 |
| 8-4 | 날씨 API | WeatherAPI.com 프록시, 대기질, 준비물 추천 |
| 8-5 | 크론잡 | RSVP 리마인더(30분), 날씨 알림(매일 20시) |
| 8-6 | 피드백 | 피드백 수집, 10분 쿨다운, Resend 이메일 전송 |

## 관련 파일

### 푸시 알림
- `src/lib/push.ts` - 서버 사이드 Web Push 발송 (sendPushToTeam, sendPushToUsers)
- `src/lib/usePushSubscription.ts` - 클라이언트 구독 관리 훅
- `src/app/api/push/subscribe/route.ts` - 구독 등록/해제 API
- `src/app/api/push/check/route.ts` - VAPID 설정 상태 확인 API
- `public/custom-sw.js` - Service Worker (푸시 수신 + 알림 표시)

### 날씨
- `src/app/api/weather/route.ts` - WeatherAPI.com 프록시 API
- `src/lib/weather.ts` - 날씨 유틸리티 (한글 변환, UV 등급, 대기질, 준비물 추천, 스타일)

### PWA
- `src/components/PWAManager.tsx` - Service Worker 등록 + 동적 매니페스트 주입
- `src/hooks/usePWA.ts` - PWA 설치/매니페스트/파비콘 관리 훅
- `public/custom-sw.js` - Network First 캐싱 전략 + 푸시 핸들러

### 피드백
- `src/app/api/feedback/route.ts` - 피드백 CRUD API
- `src/app/my/feedback/page.tsx` - 피드백 작성 페이지

### 이미지
- `src/app/api/upload/route.ts` - Supabase Storage 업로드 API
- `src/lib/compressImage.ts` - 클라이언트 이미지 압축

### 크론
- `src/app/api/cron/rsvp-reminder/route.ts` - RSVP 마감 리마인더
- `src/app/api/scheduled/weather-reminder/route.ts` - 내일 운동 날씨 알림
- `vercel.json` - Vercel Cron 스케줄 설정

### 구장
- `src/app/api/venues/route.ts` - 구장 검색 API

## API 엔드포인트

### 푸시 알림

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/push/subscribe` | 푸시 구독 등록 (upsert) |
| `DELETE` | `/api/push/subscribe` | 푸시 구독 해제 |
| `GET` | `/api/push/check` | VAPID 키 설정 상태 확인 |

### 날씨

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/weather?lat=&lon=&date=` | 위도/경도/날짜 기반 날씨 조회 |

### 피드백

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/feedback` | 피드백 제출 (로그인 필수) |
| `GET` | `/api/feedback` | 피드백 목록 조회 (ADMIN 전용) |

### 이미지

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `POST` | `/api/upload` | 이미지 파일 업로드 (FormData) |

### 크론

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/cron/rsvp-reminder` | RSVP 미응답자 리마인더 (Bearer 인증) |
| `GET` | `/api/scheduled/weather-reminder` | 내일 운동 날씨 푸시 알림 (Bearer 인증) |

### 구장

| 메서드 | 경로 | 설명 |
|--------|------|------|
| `GET` | `/api/venues?search=` | 팀 내 구장 검색 (자동완성) |

## 주요 코드

### 8-1. 푸시 알림

#### 1. 푸시 알림 발송 - 팀 전체

팀 전체 구독자에게 푸시를 보내되, 발송자 본인은 제외한다. 만료된 구독(410 응답)은 자동 삭제한다.

```ts
// src/lib/push.ts
export async function sendPushToTeam(
  teamId: string,
  excludeUserId: string,
  payload: { title: string; body: string; url?: string }
) {
  if (!ensureVapid()) return [];
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: { teamId },
      userId: { not: excludeUserId },
    },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        // 만료된 구독은 삭제
        const wpErr = err as { statusCode?: number };
        if (wpErr.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
        throw err;
      }
    })
  );

  return results;
}
```

#### 2. 푸시 알림 발송 - 특정 사용자들

RSVP 리마인더 등 특정 사용자 대상 발송에 사용한다.

```ts
// src/lib/push.ts
export async function sendPushToUsers(
  userIds: string[],
  payload: { title: string; body: string; url?: string }
) {
  if (!ensureVapid()) return [];
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: userIds } },
  });

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (err) {
        const wpErr = err as { statusCode?: number };
        if (wpErr.statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } });
        }
        throw err;
      }
    })
  );

  return results;
}
```

#### 3. 푸시 구독 등록 API

클라이언트에서 받은 PushSubscription 정보를 DB에 upsert한다. 같은 사용자 + 같은 endpoint면 키만 업데이트한다.

```ts
// src/app/api/push/subscribe/route.ts
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
  }

  const { subscription } = await req.json();
  if (!subscription?.endpoint || !subscription?.keys) {
    return NextResponse.json({ error: "잘못된 구독 정보" }, { status: 400 });
  }

  await prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: {
        userId: session.user.id,
        endpoint: subscription.endpoint,
      },
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    create: {
      userId: session.user.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });

  return NextResponse.json({ success: true });
}
```

#### 4. 클라이언트 푸시 구독 훅

브라우저 지원 여부, iOS PWA 모드 감지, Service Worker 활성화 폴링, 구독/해제 전체 흐름을 관리한다.

```ts
// src/lib/usePushSubscription.ts
export function usePushSubscription() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const browserSupported = typeof window !== 'undefined' &&
                            'serviceWorker' in navigator &&
                            'PushManager' in window;

    // iOS PWA 모드 체크 (iOS는 PWA에서만 작동)
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const isPWA = window.matchMedia('(display-mode: standalone)').matches ||
                  (window.navigator as any).standalone === true;

    const supported = browserSupported && (!isIOS || isPWA);
    setIsSupported(supported);
  }, []);

  async function subscribe(): Promise<SubscribeResult> {
    // ...VAPID 키 확인 -> 권한 요청 -> SW 등록 확인 -> 폴링으로 활성화 대기
    // -> pushManager.subscribe -> 서버에 구독 정보 전송
    const sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey as BufferSource,
    });

    const response = await fetch("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    // ...
  }

  return { isSupported, isSubscribed, isReady, subscribe, unsubscribe };
}
```

#### 5. Service Worker - 푸시 수신 + 알림 클릭

```js
// public/custom-sw.js
self.addEventListener('push', (event) => {
  let data;
  try {
    data = event.data.json();
  } catch (error) {
    return;
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { url: data.url || '/' },
    tag: 'football-log-notification',
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '네모의 꿈', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
```

### 8-4. 날씨 API

#### 6. 날씨 API 프록시

WeatherAPI.com에서 위도/경도/날짜 기반으로 예보를 조회하고, 날씨 분류 + 대기질 + 일출/일몰 등 정제된 데이터를 반환한다.

```ts
// src/app/api/weather/route.ts
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get("lat");
  const lon = searchParams.get("lon");
  const date = searchParams.get("date");

  // ...유효성 검증...

  const url = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lon}&dt=${dateStr}&lang=ko&aqi=yes`;
  const response = await fetch(url);
  const data = await response.json();

  const forecastDay = data.forecast?.forecastday?.[0];
  const targetHour = targetDate.getHours();
  const hourData = forecastDay.hour?.find(
    (h: any) => new Date(h.time).getHours() === targetHour
  ) || forecastDay.hour?.[12] || forecastDay.day;

  // 날씨 코드 분류 (한글 키워드 포함)
  if (condition.includes("비") || condition.includes("rain")) {
    weather = "Rain";
  } else if (condition.includes("눈") || condition.includes("snow")) {
    weather = "Snow";
  }
  // ...

  const weatherData = {
    weather,
    weatherDescription: condition,
    temperature: Math.round(hourData.temp_c || 0),
    feelsLikeC: Math.round(hourData.feelslike_c || 0),
    chanceOfRain: hourData.chance_of_rain || 0,
    airQualityIndex,
    pm25, pm10,
    sunrise, sunset,
    // ...
  };

  return NextResponse.json(weatherData);
}
```

#### 7. 날씨 유틸리티 - 준비물 추천

날씨, 기온, 대기질을 종합하여 축구 훈련용 준비물을 추천한다.

```ts
// src/lib/weather.ts
export function getWeatherRecommendations(
  weather: string | null,
  temperature: number | null,
  aqi: number | null
): string[] {
  const recommendations: string[] = [];

  if (weather === "Rain") {
    recommendations.push("여벌 옷, 양말 필수");
    recommendations.push("수건 챙기기");
    recommendations.push("미끄럼 주의, 워밍업 철저히");
  } else if (weather === "Snow") {
    recommendations.push("미끄럼 주의, 워밍업 충분히");
    recommendations.push("방한 장갑 챙기기");
  }

  if (temperature !== null) {
    if (temperature < 0) {
      recommendations.push("방한복, 여벌 옷 필수");
      recommendations.push("충분한 워밍업으로 부상 예방");
      if (temperature < -5) {
        recommendations.push("장갑, 핫팩 챙기기");
      }
    } else if (temperature > 30) {
      recommendations.push("물, 이온음료 넉넉히");
      if (temperature > 36) {
        recommendations.push("자외선 차단제 필수");
        recommendations.push("폭염주의보 - 온열질환 주의");
      }
    }
  }

  // 대기질별 추천
  if (aqi !== null && aqi > 100) {
    recommendations.push("마스크 착용, 격한 운동 자제");
  }

  // 복합 조건: 더위 + 나쁜 대기질
  if (temperature !== null && temperature > 30 && aqi !== null && aqi > 100) {
    recommendations.push("더위+미세먼지 - 운동 자제 권장");
  }

  return recommendations;
}
```

#### 8. 날씨 유틸리티 - 시간대 판별

일출/일몰 시간과 운동 시간을 비교하여 day/sunset/night을 구분한다. UI 스타일링에 사용된다.

```ts
// src/lib/weather.ts
export function getTimeOfDay(
  eventTime: Date,
  sunrise: string | null,
  sunset: string | null
): TimeOfDay {
  if (!sunrise || !sunset) return "day";

  const parseTime = (timeStr: string): number => {
    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!match) return 12;
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3].toUpperCase();
    if (period === "PM" && hours !== 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours + minutes / 60;
  };

  const sunsetHour = parseTime(sunset);
  const eventHour = eventTime.getHours() + eventTime.getMinutes() / 60;

  // 석양: 일몰 1시간 전 ~ 일몰 30분 후
  if (eventHour >= sunsetHour - 1 && eventHour <= sunsetHour + 0.5) {
    return "sunset";
  } else if (eventHour < parseTime(sunrise) || eventHour > sunsetHour + 0.5) {
    return "night";
  } else {
    return "day";
  }
}
```

### 8-3. PWA

#### 9. PWA 매니저 - Service Worker 등록 + 자동 업데이트

팀 정보에 따라 매니페스트를 동적으로 생성하고, 페이지 이동 시 대기 중인 새 Service Worker를 자동 활성화한다.

```tsx
// src/components/PWAManager.tsx
export default function PWAManager() {
  const { data: session } = useSession();
  const { injectManifest, injectFavicon } = usePWA();
  const pathname = usePathname();
  const waitingWorkerRef = useRef<ServiceWorker | null>(null);

  // Service Worker 등록
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      const registerServiceWorker = async () => {
        const registration = await navigator.serviceWorker.register("/custom-sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        // 업데이트 확인
        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          newWorker?.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              waitingWorkerRef.current = newWorker;
            }
          });
        });
      };
      registerServiceWorker();
    }
  }, []);

  // 페이지 이동 감지 - 자동 업데이트
  useEffect(() => {
    if (previousPathRef.current !== pathname && waitingWorkerRef.current) {
      waitingWorkerRef.current.postMessage({ type: "SKIP_WAITING" });
      window.location.reload();
    }
    previousPathRef.current = pathname;
  }, [pathname]);

  // 팀별 동적 매니페스트 주입
  useEffect(() => {
    const setupPWA = async () => {
      let teamName = "네모의 꿈";
      let teamLogo: string | null = null;
      let themeColor = "#967B5D";

      if (session?.user?.teamId) {
        const res = await fetch("/api/teams");
        if (res.ok) {
          const data = await res.json();
          teamName = `${data.name}의 락커룸`;
          teamLogo = data.logoUrl;
          themeColor = data.primaryColor || "#967B5D";
        }
      }

      injectManifest({
        name: teamName,
        shortName: teamName,
        logoUrl: teamLogo,
        description: "축구 팀 훈련 일지 공유 서비스",
        themeColor,
        backgroundColor: "white",
      });
      injectFavicon(teamLogo);
    };
    setupPWA();
  }, [session?.user?.teamId]);

  return null;
}
```

### 8-2. 이미지 업로드

#### 10. 이미지 압축 (클라이언트)

Canvas API로 이미지를 1920x1920 이내로 리사이즈하고 JPEG 80% 품질로 압축한다. 1MB 이하면 압축을 건너뛴다.

```ts
// src/lib/compressImage.ts
const MAX_WIDTH = 1920;
const MAX_HEIGHT = 1920;
const QUALITY = 0.8;
const OUTPUT_TYPE = "image/jpeg";

export async function compressImage(file: File): Promise<File> {
  // 이미 충분히 작으면 그대로 반환 (1MB 이하)
  if (file.size <= 1 * 1024 * 1024) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;

  let newWidth = width;
  let newHeight = height;

  if (width > MAX_WIDTH || height > MAX_HEIGHT) {
    const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
    newWidth = Math.round(width * ratio);
    newHeight = Math.round(height * ratio);
  }

  // OffscreenCanvas 사용 (메인 스레드 부담 감소)
  const canvas = new OffscreenCanvas(newWidth, newHeight);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, newWidth, newHeight);
  bitmap.close();

  const blob = await canvas.convertToBlob({
    type: OUTPUT_TYPE,
    quality: QUALITY,
  });

  return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
    type: OUTPUT_TYPE,
  });
}
```

#### 11. 이미지 업로드 API

Supabase Storage의 `training-images` 버킷에 이미지를 저장한다. 경로는 `{userId}/{timestamp}.{ext}` 형식이다.

```ts
// src/app/api/upload/route.ts
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  // 5MB 제한
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json(
      { error: "파일 크기는 5MB 이하여야 합니다" }, { status: 400 }
    );
  }

  // 이미지 파일만 허용
  if (!file.type.startsWith("image/")) {
    return NextResponse.json(
      { error: "이미지 파일만 업로드 가능합니다" }, { status: 400 }
    );
  }

  const ext = file.name.split(".").pop();
  const fileName = `${session.user.id}/${Date.now()}.${ext}`;

  const sb = getSupabase();
  const { error } = await sb.storage
    .from("training-images")
    .upload(fileName, buffer, { contentType: file.type });

  const { data: urlData } = sb.storage
    .from("training-images")
    .getPublicUrl(fileName);

  return NextResponse.json({ url: urlData.publicUrl });
}
```

### 8-6. 피드백

#### 12. 피드백 제출 API

피드백을 DB에 저장하고, Resend를 통해 관리자 이메일로 알림을 보낸다. 10분 내 중복 제출을 차단한다.

```ts
// src/app/api/feedback/route.ts
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { type, title, content } = await req.json();

  // 내용 길이 제한
  if (title.length > 200 || content.length > 5000) {
    return NextResponse.json(
      { error: "제목은 200자, 내용은 5000자 이내로 작성해주세요" }, { status: 400 }
    );
  }

  // 10분 내 중복 피드백 방지
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const recentFeedback = await prisma.feedback.findFirst({
    where: {
      userId: session.user.id,
      createdAt: { gte: tenMinutesAgo },
    },
  });

  if (recentFeedback) {
    return NextResponse.json(
      { error: "10분 후에 다시 피드백을 남겨주세요" }, { status: 429 }
    );
  }

  const feedback = await prisma.feedback.create({
    data: { type, title, content, userId: session.user.id,
            userEmail: session.user.email, userName: session.user.name },
    include: { user: { select: { id: true, name: true, email: true,
                                  team: { select: { name: true } } } } },
  });

  // 이메일 전송 (비동기, 실패해도 피드백은 저장됨)
  if (resend && process.env.FEEDBACK_EMAIL) {
    resend.emails.send({
      from: "라커룸 피드백 <feedback@squaretocircle.app>",
      to: process.env.FEEDBACK_EMAIL,
      subject: `[라커룸 피드백] ${feedbackTypeLabel}: ${title}`,
      text: emailContent,
    }).catch(() => {});
  }

  return NextResponse.json({ success: true, feedback });
}
```

### 8-5. 크론잡

#### 13. RSVP 마감 리마인더 (크론)

30분 간격으로 실행되어 마감 2시간 이내 이벤트의 미응답자에게 푸시 알림을 보낸다.

```ts
// src/app/api/cron/rsvp-reminder/route.ts
export async function GET(req: Request) {
  // Vercel Cron 인증
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // 마감 2시간 이내 이벤트 찾기
  const events = await prisma.trainingEvent.findMany({
    where: {
      rsvpDeadline: { gte: now, lte: twoHoursLater },
    },
    include: {
      rsvps: { select: { userId: true } },
      team: { include: { members: { select: { id: true } } } },
    },
  });

  for (const event of events) {
    const respondedIds = new Set(event.rsvps.map((r) => r.userId));
    const nonRespondedIds = event.team.members
      .filter((m) => !respondedIds.has(m.id))
      .map((m) => m.id);

    if (nonRespondedIds.length > 0) {
      await sendPushToUsers(nonRespondedIds, {
        title: "응답 마감 임박",
        body: `참석 여부를 알려주세요! 마감: ${deadlineStr}`,
        url: `/training/${event.id}`,
      });
    }
  }

  return NextResponse.json({ ok: true, eventsChecked: events.length, totalNotified });
}
```

#### 14. 날씨 리마인더 (크론)

매일 저녁 8시에 실행되어 내일 예정된 운동의 날씨 정보를 팀 전체에 푸시로 알린다.

```ts
// src/app/api/scheduled/weather-reminder/route.ts
export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 내일 예정된 운동 중 날씨 정보가 있는 것만
  const events = await prisma.trainingEvent.findMany({
    where: {
      date: { gte: tomorrow, lt: dayAfterTomorrow },
      weather: { not: null },
      temperature: { not: null },
    },
    include: { team: { select: { id: true, name: true } } },
  });

  for (const event of events) {
    let aqText = "";
    if (event.airQualityIndex !== null) {
      const aqGrade = getAirQualityGrade(event.airQualityIndex);
      aqText = ` · 대기질 ${aqGrade.emoji}`;
    }

    await sendPushToTeam("", event.teamId, {
      title: "내일 운동 날씨",
      body: `${event.title} · ${dateStr} · ${weatherIcon} ${weatherText} ${event.temperature}°C${aqText}`,
      url: `/training/${event.id}`,
    });
  }
}
```

#### 15. 구장 검색 API

팀 내 등록된 구장을 이름으로 검색한다. 사용 빈도 순으로 정렬하여 최대 10개를 반환한다.

```ts
// src/app/api/venues/route.ts
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session.user.teamId) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const venues = await prisma.venue.findMany({
    where: {
      teamId: session.user.teamId,
      name: { contains: search, mode: "insensitive" },
    },
    select: {
      id: true, name: true, address: true,
      surface: true, recommendedShoes: true, usageCount: true,
    },
    orderBy: [{ usageCount: "desc" }, { updatedAt: "desc" }],
    take: 10,
  });

  return NextResponse.json({ venues });
}
```

## 비즈니스 규칙

### 인증 & 접근 제어
- 모든 API(push check 제외)는 `getServerSession`으로 로그인을 확인한다
- 피드백 목록 조회는 `ADMIN` 역할만 가능하다
- 크론 작업은 `CRON_SECRET` Bearer 토큰으로 인증한다
- 구장 검색은 본인 팀(`session.user.teamId`)의 구장만 조회한다

### 푸시 알림
- VAPID 키가 미설정이면 `ensureVapid()`가 false를 반환하여 조용히 무시한다 (에러 없음)
- 만료된 구독(HTTP 410)은 자동 삭제된다
- `sendPushToTeam`은 `excludeUserId`로 발송자 본인을 제외한다
- iOS는 PWA(홈 화면 추가) 모드에서만 푸시를 지원한다
- Service Worker 활성화를 최대 10초(20회 x 500ms) 폴링하여 대기한다

### 이미지 업로드
- 파일 크기 제한: 5MB
- 이미지 MIME 타입만 허용 (`image/*`)
- 클라이언트에서 1MB 초과 시 자동 압축 (최대 1920x1920, JPEG 80%)
- 저장 경로: `training-images/{userId}/{timestamp}.{ext}`

### 피드백
- 제목 200자, 내용 5000자 제한
- 같은 사용자가 10분 이내 중복 제출 시 429 (Rate Limit)
- Resend 이메일 전송 실패는 무시 (피드백 저장은 보장)
- 유형: FEATURE_REQUEST, BUG_REPORT, IMPROVEMENT, OTHER

### 날씨
- WeatherAPI.com 무료 플랜 기준 3일 예보까지 지원
- 대기질(AQI)은 US EPA 기준: 0-50 좋음, 51-100 보통, 101-150 나쁨, 151+ 매우나쁨
- 자외선 지수: 0-2 낮음, 3-5 보통, 6-7 높음, 8-10 매우높음, 11+ 위험
- 준비물 추천은 극한 날씨만 (0도 미만, 30도 이상, AQI 100 초과)

### 크론 작업
- RSVP 리마인더: 마감 2시간 이내 이벤트 대상, 미응답자에게만 발송
- 날씨 리마인더: 매일 저녁 8시 UTC 실행 (`0 20 * * *`), 내일 운동 중 날씨 데이터가 있는 이벤트만

### PWA
- Service Worker 캐싱 전략: Network First (오프라인 시 캐시 폴백)
- API 요청(`/api/`)은 캐시하지 않음
- `http://`, `https://` 프로토콜만 캐싱 (chrome-extension 등 제외)
- 페이지 이동 시 waiting 중인 새 Service Worker를 자동 활성화

## 데이터 모델

### PushSubscription

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String
  p256dh    String
  auth      String
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, endpoint])
}
```

### Venue

```prisma
model Venue {
  id              String   @id @default(cuid())
  teamId          String
  name            String
  address         String?
  mapUrl          String?  // 네이버 지도 URL
  latitude        Float?   // 위도
  longitude       Float?   // 경도
  surface         String?
  recommendedShoes String[] @default([])
  usageCount      Int      @default(0)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  team            Team            @relation(fields: [teamId], references: [id], onDelete: Cascade)
  trainingEvents  TrainingEvent[]

  @@unique([teamId, name])
}
```

### Feedback

```prisma
enum FeedbackType {
  FEATURE_REQUEST  // 기능 제안
  BUG_REPORT       // 버그 신고
  IMPROVEMENT      // 개선 제안
  OTHER            // 기타
}

enum FeedbackStatus {
  NEW         // 새로운 피드백
  IN_REVIEW   // 검토 중
  PLANNED     // 계획됨
  IN_PROGRESS // 진행 중
  COMPLETED   // 완료
  REJECTED    // 거절됨
}

model Feedback {
  id        String         @id @default(cuid())
  type      FeedbackType
  title     String
  content   String         @db.Text
  status    FeedbackStatus @default(NEW)
  userId    String?
  user      User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  userEmail String?
  userName  String?
  createdAt DateTime       @default(now())
  updatedAt DateTime       @updatedAt

  @@index([status, createdAt(sort: Desc)])
  @@index([userId])
}
```

## 프론트엔드

### 주요 페이지/컴포넌트

| 파일 | 역할 |
|------|------|
| `src/components/PWAManager.tsx` | 앱 전역 - SW 등록, 매니페스트 주입, 자동 업데이트 |
| `src/hooks/usePWA.ts` | PWA 설치 프롬프트, 매니페스트/파비콘 동적 생성 |
| `src/lib/usePushSubscription.ts` | 푸시 구독/해제, 브라우저/iOS 지원 감지 |
| `src/app/my/settings/page.tsx` | 설정 - 푸시 알림 토글 스위치 |
| `src/app/my/feedback/page.tsx` | 피드백 작성 폼 (유형 선택 + 제목 + 내용) |
| `src/app/write/page.tsx` | 운동 일지 작성 - 이미지 압축 + 업로드 |
| `src/components/training/BasicInfoTab.tsx` | 운동 상세 - 날씨 카드 (실시간 조회 + DB 폴백) |
| `src/app/training/create/page.tsx` | 운동 생성 - 구장 검색 자동완성 |

### 데이터 페칭 패턴

**날씨 - SWR로 실시간 조회 + DB 폴백:**
```tsx
// src/components/training/BasicInfoTab.tsx
const shouldFetchWeather = event.venue?.latitude && event.venue?.longitude;
const weatherUrl = shouldFetchWeather
  ? `/api/weather?lat=${event.venue!.latitude}&lon=${event.venue!.longitude}&date=${new Date(event.date).toISOString().split('T')[0]}`
  : null;
const { data: liveWeather } = useSWR(weatherUrl, fetcher, {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
});

// 실시간 날씨가 있으면 사용, 없으면 DB 저장 데이터 사용
const displayWeather = liveWeather || {
  weather: event.weather,
  temperature: event.temperature,
  // ...
};
```

**이미지 업로드 - 압축 후 FormData:**
```tsx
// src/app/write/page.tsx
const compressed = await compressImage(file);
setImageFile(compressed);

// 제출 시
const uploadData = new FormData();
uploadData.append("file", imageFile);
const uploadRes = await fetch("/api/upload", {
  method: "POST",
  body: uploadData,
});
const { url } = await uploadRes.json();
```

**피드백 - 단순 POST:**
```tsx
// src/app/my/feedback/page.tsx
const res = await fetch("/api/feedback", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ type, title, content }),
});
```

### UX 특징

- **PWA 자동 업데이트**: 사용자가 페이지를 이동하면 대기 중인 새 버전이 자동 적용된다 (별도 확인 팝업 없음)
- **팀별 동적 PWA**: 팀 이름이 앱 이름이 되고, 팀 로고가 앱 아이콘/파비콘이 된다 (`${data.name}의 락커룸`)
- **iOS 푸시 안내**: iOS에서 PWA 미설치 시 "홈 화면에 추가"를 안내하는 경고 메시지를 출력한다
- **날씨 카드 시각화**: 날씨(Clear/Rain/Snow 등) x 시간대(day/sunset/night) 조합으로 12가지 이상의 그라데이션 스타일을 제공한다
- **준비물 자동 추천**: 극한 날씨(혹한, 폭염, 미세먼지)에만 표시하여 정보 과부하를 방지한다
- **이미지 자동 압축**: 사용자가 고해상도 사진(10-30MB)을 올려도 클라이언트에서 200KB~1MB로 자동 압축되어 업로드 속도가 빠르다
- **피드백 Rate Limit**: 10분 쿨다운으로 중복/스팸 피드백을 방지하되, 429 에러 메시지로 "10분 후 다시 시도"를 안내한다
- **알림 토글**: 설정 페이지에서 토글 스위치 하나로 푸시 알림을 켜고 끌 수 있다. 구독 상태가 로드될 때까지 버튼이 비활성화된다 (`isReady`)
- **구장 사용 빈도 정렬**: 자주 가는 구장이 검색 결과 상위에 노출된다
