# 푸시 알림 시스템 기획 문서

## 📱 개요

- **기술**: Web Push API (표준)
- **인증 방식**: VAPID (Voluntary Application Server Identification)
- **구독 관리**: 설정 페이지에서 토글 ON/OFF
- **브라우저 지원**: Chrome, Firefox, Edge, Safari 16.4+

---

## 🔔 알림 종류

### 1. 💪 닦달 (Nudge)

- **발송자**: 팀원
- **수신자**: 선택한 특정 팀원 1명
- **조건**: 같은 팀원, 1시간에 1회만 가능
- **내용**: "{발송자}님이 운동하래요! 일지 올려주세요~"
- **이동**: `/write` (일지 작성 페이지)
- **API**: `POST /api/nudges`
- **구현 파일**: `src/app/api/nudges/route.ts`

### 2. ⏰ RSVP 리마인더

- **발송자**: 시스템 (Cron Job, 30분 간격)
- **수신자**: 참석 여부 미응답 팀원
- **조건**: 마감 2시간 전
- **내용**: "참석 여부를 알려주세요! 마감: {마감시간}"
- **이동**: `/training/{eventId}`
- **API**: `GET /api/cron/rsvp-reminder`
- **구현 파일**: `src/app/api/cron/rsvp-reminder/route.ts`

### 3. ⚽ 팀 배정 알리기

- **발송자**: 운영진 (ADMIN)
- **수신자**: 팀 배정된 모든 팀원
- **조건**: 운영진이 "팀 배정 알리기" 버튼 클릭 시 (수동)
- **내용**: "{운동명} - 내가 어떤 팀에 배정되었는지 확인해볼까요?"
- **이동**: `/training/{eventId}`
- **API**: `POST /api/training-events/{id}/notify-team-assignments`
- **구현 파일**: `src/app/api/training-events/[id]/notify-team-assignments/route.ts`
- **특징**: 여러 세션 배정 후 한 번만 알림 (스팸 방지)

### 4. ❤️ 좋아요

- **발송자**: 팀원
- **수신자**: 일지 작성자 (본인 제외)
- **조건**: 일지에 좋아요 누름
- **내용**: "{발송자}님이 회원님의 일지에 좋아요를 눌렀어요"
- **이동**: `/log/{logId}`
- **API**: `POST /api/training-logs/{id}/likes`
- **구현 파일**: `src/app/api/training-logs/[id]/likes/route.ts`

### 5. 💬 댓글 (3가지 케이스)

- **발송자**: 팀원
- **수신자**:
  - A) 일지 작성자 (본인 제외)
  - B) 멘션된 사용자 (@username)
  - C) 같은 일지에 댓글 남긴 사람들
- **내용**:
  - 일지 작성자: "새 댓글 - {발송자}님이 회원님의 일지에 댓글을 남겼어요"
  - 멘션: "💬 댓글에서 멘션 - {발송자}님이 댓글에서 회원님을 멘션했어요"
- **이동**: `/log/{logId}`
- **API**: `POST /api/training-logs/{id}/comments`
- **구현 파일**: `src/app/api/training-logs/[id]/comments/route.ts`

### 6. 📝 새 운동 일지

- **발송자**: 팀원
- **수신자**: 같은 팀 전체 (작성자 제외)
- **조건**: 일지 작성 시
- **내용**: "{작성자}님이 운동 일지를 올렸어요!"
- **이동**: `/log/{logId}`
- **API**: `POST /api/training-logs`
- **구현 파일**: `src/app/api/training-logs/route.ts`

### 7. 📢 일지 태그/멘션

- **발송자**: 팀원
- **수신자**: 일지에서 태그된 사용자
- **조건**: 일지 본문에 @username 포함
- **내용**: "{작성자}님이 운동 일지에서 회원님을 언급했습니다"
- **이동**: `/log/{logId}`
- **API**: `POST /api/training-logs`
- **구현 파일**: `src/app/api/training-logs/route.ts`

### 8. 💰 지각비 알리기

- **발송자**: 운영진 (ADMIN)
- **수신자**: 지각비 부과 대상자
- **조건**: 운영진이 "지각비 알리기" 버튼 클릭 시 (수동)
- **내용**: "지각비 {금액}원이 부과되었습니다"
- **이동**: `/training/{eventId}`
- **API**: `POST /api/training-events/{id}/notify-late-fees`
- **구현 파일**: `src/app/api/training-events/[id]/notify-late-fees/route.ts`
- **특징**: 여러 명 지각비 부과 후 한 번만 알림 (스팸 방지)

### 9. 🏃 새 팀 운동

- **발송자**: 운영진
- **수신자**: 같은 팀 전체 (생성자 제외)
- **조건**: 새 팀 운동 일정 생성 시
- **내용**: "새 운동이 올라왔어요! {날짜}"
- **이동**: `/training/{eventId}`
- **API**: `POST /api/training-events`
- **구현 파일**: `src/app/api/training-events/route.ts`

### 10. 👕 조끼 담당자 지정

- **발송자**: 운영진 (ADMIN)
- **수신자**: 조끼 담당자로 지정된 사용자
- **조건**: 조끼 담당자 지정 또는 변경 시
- **내용**:
  - 가져오기 담당: "조끼를 가져와주세요! {날짜}"
  - 가져가기 담당: "조끼를 가져가주세요! {날짜}"
  - 둘 다 담당: "조끼를 가져오고 가져가주세요! {날짜}"
- **이동**: `/training/{eventId}`
- **API**:
  - `POST /api/training-events` (새 운동 생성 시)
  - `PUT /api/training-events/{id}` (기존 운동 수정 시)
- **구현 파일**:
  - `src/app/api/training-events/route.ts`
  - `src/app/api/training-events/[id]/route.ts`

---

## 🎯 알림 우선순위

| 우선순위 | 알림 종류 | 중요도 | 특징 |
|---------|---------|-------|------|
| 🔴 긴급 | RSVP 리마인더, 지각비 | 시간 제약 | 즉시 확인 필요 |
| 🟡 중간 | 닦달, 팀 배정, 새 운동, 조끼 담당 | 참여 독려 | 당일 확인 권장 |
| 🟢 일반 | 좋아요, 댓글, 일지 | 소셜 활동 | 시간 여유 |

---

## ⚙️ 구독 관리

### 사용자 인터페이스

**설정 페이지** (`/my/settings`)
- 토글 스위치로 간단히 ON/OFF
- 브라우저 알림 권한 자동 요청
- 구독 상태: "닦달, 댓글, 좋아요 등의 알림을 받고 있습니다"
- 미구독 상태: "알림을 켜면 중요한 소식을 놓치지 않아요"

### 기술 구현

```typescript
// 구독
await subscribe()
// → 브라우저 알림 권한 요청
// → VAPID 키로 Push Manager 구독
// → 구독 정보 DB 저장

// 해제
await unsubscribe()
// → 브라우저 구독 해제
// → DB에서 구독 정보 삭제
```

**구현 파일**:
- Hook: `src/lib/usePushSubscription.ts`
- API: `src/app/api/push/subscribe/route.ts`
- UI: `src/app/my/settings/page.tsx`

---

## 🔒 보안 및 제약

### 1. 발송 제약

- **닦달**: 1시간 1회 제한 (spam 방지)
- **같은 팀 확인**: 모든 알림은 팀원 간에만 발송
- **권한 확인**: ADMIN 전용 알림 (팀 배정, 지각비 등)
- **자기 자신 제외**: 본인이 작성한 콘텐츠에는 알림 미발송

### 2. 구독 정보 저장 (Database)

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  userId    String
  endpoint  String   // 브라우저별 고유 엔드포인트
  p256dh    String   // 암호화 공개 키
  auth      String   // 인증 비밀 키
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id])

  @@unique([userId, endpoint]) // 동일 사용자의 여러 디바이스 지원
}
```

### 3. 만료 구독 자동 삭제

- Push 발송 시 410 에러 (Gone) 수신 → DB에서 자동 삭제
- 구독 만료 원인: 브라우저 재설치, 캐시 삭제, 권한 취소 등

---

## 🛠️ 기술 스택

### 서버 사이드

```typescript
// 푸시 발송 (서버)
import webPush from "web-push";

// VAPID 설정
webPush.setVapidDetails(
  "mailto:noreply@football-log.app",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// 팀 전체에게 발송
export async function sendPushToTeam(
  teamId: string,
  excludeUserId: string,
  payload: { title: string; body: string; url?: string }
) {
  // 팀원들의 구독 정보 조회
  const subscriptions = await prisma.pushSubscription.findMany({
    where: {
      user: { teamId },
      userId: { not: excludeUserId },
    },
  });

  // 각 구독에 푸시 발송
  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      );
    })
  );

  return results;
}
```

**구현 파일**: `src/lib/push.ts`

### 클라이언트 사이드

```typescript
// Service Worker (브라우저)
// 푸시 알림 수신
self.addEventListener('push', (event) => {
  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: { url: data.url || '/' },
      vibrate: [200, 100, 200],
    })
  );
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  // 앱 열기 또는 포커스
  event.waitUntil(
    clients.openWindow(url)
  );
});
```

**구현 파일**: `public/custom-sw.js`

### 환경 변수

```bash
# .env
NEXT_PUBLIC_VAPID_PUBLIC_KEY="BFeDQlE8Cw3ClJNNjViUUCyuhpmns8VywVfWTWWC_..."
VAPID_PRIVATE_KEY="-DclO0nJ7I2kDPkbnHjB1v8ncQanTIFekp0G5XJi6YY"
```

VAPID 키 생성:
```bash
npx web-push generate-vapid-keys
```

---

## 📊 모니터링 및 로깅

### 현재 구현

모든 푸시 발송은 서버 콘솔에 로그 출력:

```typescript
console.log(`[NUDGE] Sending push to user ${recipientId}`);
console.log(`[NUDGE] Push sent, results:`, results);
console.error('[NUDGE] Push notification failed:', error);
```

### Service Worker 로그

브라우저 DevTools에서 확인 가능:

```javascript
[SW] Push event received: PushEvent { ... }
[SW] Push data: { title: "💪 닦달!", body: "...", url: "/write" }
[SW] Notification shown
[SW] Notification clicked: NotificationEvent { ... }
```

### 향후 개선 방향

추가 가능한 통계 지표:
- 알림 발송 성공/실패율
- 사용자별 구독률
- 알림 종류별 발송 횟수
- 클릭률 (CTR - Click Through Rate)
- 평균 응답 시간

---

## 🚀 향후 개선 방향

### 1. 알림 설정 세분화

사용자가 받고 싶은 알림만 선택:
- ✅ 닦달만 받기
- ✅ 댓글/좋아요만 받기
- ✅ 팀 운동 알림만 받기
- ✅ RSVP 리마인더만 받기

### 2. 알림 음소거 시간대

- 야간 알림 OFF (예: 22:00 ~ 08:00)
- 사용자 지정 시간대 설정

### 3. 중요 알림 우선순위

- RSVP 리마인더는 음소거 무시
- 긴급 알림은 항상 발송

### 4. 알림 히스토리

- 받은 알림 목록 보기
- 읽음/안 읽음 표시
- 알림 삭제 기능

### 5. 알림 그룹화

- 같은 종류 알림 묶어서 표시
- 예: "5명이 일지에 좋아요를 눌렀어요"

### 6. Rich Notification

- 이미지 포함 알림
- 액션 버튼 추가 (예: "답장하기", "확인")

---

## 🔧 트러블슈팅

### 알림이 오지 않을 때

1. **브라우저 권한 확인**
   - 주소창 자물쇠 아이콘 → 알림 권한 "허용" 확인

2. **Service Worker 등록 확인**
   ```javascript
   // DevTools Console
   navigator.serviceWorker.getRegistrations()
   // → custom-sw.js 등록 확인
   ```

3. **구독 상태 확인**
   ```javascript
   // DevTools Console
   navigator.serviceWorker.ready.then(reg =>
     reg.pushManager.getSubscription()
   )
   // → null이 아닌 객체 반환 확인
   ```

4. **환경 변수 확인**
   - VAPID 공개 키가 브라우저에 전달되는지 확인
   - 서버의 VAPID 개인 키 설정 확인

5. **HTTPS 환경 확인**
   - 푸시 알림은 HTTPS 또는 localhost에서만 작동
   - 프로덕션 배포 시 SSL 인증서 필요

### 브라우저별 호환성

| 브라우저 | 지원 여부 | 비고 |
|---------|----------|------|
| Chrome (Desktop) | ✅ 완벽 지원 | v42+ |
| Chrome (Android) | ✅ 완벽 지원 | v42+ |
| Firefox | ✅ 완벽 지원 | v44+ |
| Edge | ✅ 완벽 지원 | v17+ |
| Safari (macOS) | ✅ 지원 | v16.0+ |
| Safari (iOS) | ✅ 지원 | v16.4+ (PWA 설치 필요) |
| Opera | ✅ 지원 | v39+ |

---

## 📝 체크리스트

### 개발 단계

- [x] Web Push API 구현
- [x] Service Worker 등록
- [x] VAPID 키 생성 및 설정
- [x] 푸시 구독/해제 API
- [x] 10가지 알림 시나리오 구현
- [x] 만료 구독 자동 삭제
- [x] 에러 핸들링 및 로깅

### 배포 전 확인

- [ ] VAPID 키 환경 변수 설정 (Vercel)
- [ ] HTTPS 환경 확인
- [ ] 브라우저별 테스트 (Chrome, Safari, Firefox)
- [ ] 모바일 테스트 (iOS Safari PWA, Android Chrome)
- [ ] Cron Job 설정 (RSVP 리마인더)

### 운영 모니터링

- [ ] 구독자 수 추적
- [ ] 발송 성공률 모니터링
- [ ] 에러 로그 분석
- [ ] 사용자 피드백 수집

---

## 📚 참고 자료

- [Web Push API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [VAPID Protocol](https://datatracker.ietf.org/doc/html/rfc8292)
- [web-push Library](https://github.com/web-push-libs/web-push)

---

**최종 수정일**: 2026-02-09
**작성자**: Claude Sonnet 4.5
**버전**: 1.0.0
