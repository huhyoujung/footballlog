# 라커룸 - 전체 기능 맵

> 축구 팀원들을 위한 운동 일지 SNS 플랫폼

## 기술 스택
- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript 5
- **Styling**: Tailwind CSS v4
- **Data Fetching**: SWR 2.4 (5분 캐시, dedup)
- **Auth**: NextAuth.js 4 (Google OAuth + JWT)
- **DB**: PostgreSQL + Prisma ORM (40+ 모델)
- **Storage**: Supabase (이미지)
- **Push**: Web Push API (VAPID)
- **Deploy**: Vercel + PWA

---

## 기능 목록

| # | 기능 | 명세서 |
|---|------|--------|
| 1 | 인증 & 온보딩 | [auth-onboarding.md](features/auth-onboarding.md) |
| 2 | 팀 관리 | [team-management.md](features/team-management.md) |
| 3 | 훈련 이벤트 | [training-events.md](features/training-events.md) |
| 4 | 훈련 일지 | [training-logs.md](features/training-logs.md) |
| 5 | 소셜 | [social.md](features/social.md) |
| 6 | 피드 | [feed.md](features/feed.md) |
| 7 | 친선 경기 | [friendly-match.md](features/friendly-match.md) |
| 8 | 인프라 | [infrastructure.md](features/infrastructure.md) |

### 하위 기능 ID

| ID | 하위 기능 | 설명 |
|----|-----------|------|
| **1. 인증 & 온보딩** | | |
| 1-1 | 인증 | Google OAuth, NextAuth JWT 전략, 인증 미들웨어 |
| 1-2 | 온보딩 | 팀 검색/생성/가입, 4단계 모드 전환 플로우 |
| 1-3 | 프로필 | 포지션/등번호/이미지 프로필 조회·수정 |
| **2. 팀 관리** | | |
| 2-1 | 팀 설정 | 팀 생성/수정, 초대 코드 재생성, 팀 색상, 출석률 |
| 2-2 | 멤버/역할 관리 | ADMIN/MEMBER 역할 변경, 권한 제어 |
| 2-3 | 장비 관리 | 장비 CRUD, 이름 유니크, orderIndex 자동 증가 |
| 2-4 | 유니폼 관리 | 유니폼 CRUD, 이름 유니크, 색상 코드 |
| 2-5 | 조끼 당번 | 조끼 빨래 순서 관리, 중복/팀원 검증 |
| **3. 훈련 이벤트** | | |
| 3-1 | 이벤트 CRUD | 운동 생성/수정/삭제/목록/상세, 구장 자동 생성, 푸시 알림 |
| 3-2 | RSVP | 참석/불참/지각 응답, 마감 시간, 사유 필수, upsert |
| 3-3 | 체크인 | 2시간 전~후 시간 제한, 지각 자동 판정, 중복 방지 |
| 3-4 | 세션 & 팀 배정 | 훈련 세션 CRUD, 팀 배정, orderIndex |
| 3-5 | 지각비 | ADMIN 부과, 금액 검증, PENDING/PAID 상태 |
| 3-6 | 장비 배정 | 운동별 장비 배정, 담당자 지정 |
| **4. 훈련 일지** | | |
| 4-1 | 일지 CRUD | 일지 작성/수정/삭제, @멘션 파싱, 이미지 압축·업로드 |
| 4-2 | 댓글 | 댓글 작성, @멘션(최대 5명), 다중 알림 |
| 4-3 | 좋아요 | 토글 방식, Optimistic UI, 푸시 알림 |
| **5. 소셜** | | |
| 5-1 | 락커 쪽지 | 포스트잇 형태 칭찬 쪽지, 색상/스탯 태그/익명, 하루 1장 |
| 5-2 | 닦달 | "일지 써!" 재촉, 1시간 쿨타임, 메시지 첨부 |
| 5-3 | POM/MVP 투표 | 운동 후 MVP 투표, 2시간 후~다음날 23:59, 전광판 |
| 5-4 | 칭찬 플로우 | 팀원 선택 → 락커 쪽지 작성 전용 진입점 |
| **6. 피드** | | |
| 6-1 | 메인 피드 | 폴라로이드 스택/캐러셀, 초대장/체크인 카드, SWR 병렬 페칭 |
| 6-2 | 티커 배너 | LED 전광판, 8초 롤링, 운동·MVP·활동 메시지 |
| **7. 친선 경기** | | |
| 7-1 | 매칭 & 경기 규칙 | 매칭 요청/수락/거절/취소, 룰 합의, 상태 전이 |
| 7-2 | 심판/득점/교체 | 쿼터별 심판 배정, 실시간 득점, 선수 교체 기록 |
| **8. 인프라** | | |
| 8-1 | 푸시 알림 | Web Push(VAPID), 팀/개인 발송, 만료 구독 정리 |
| 8-2 | 이미지 업로드 | Supabase Storage, 5MB 제한, 클라이언트 압축 |
| 8-3 | PWA | Service Worker, 동적 매니페스트, 자동 업데이트 |
| 8-4 | 날씨 API | WeatherAPI.com 프록시, 대기질, 준비물 추천 |
| 8-5 | 크론잡 | RSVP 리마인더(30분), 날씨 알림(매일 20시) |
| 8-6 | 피드백 | 피드백 수집, 10분 쿨다운, Resend 이메일 전송 |

---

## 주요 라우트 맵

### 페이지 (20+)
```
/                           메인 피드
/login                      로그인
/onboarding                 팀 선택/생성/프로필 설정
/write                      일지 작성 (?edit={id} 수정)
/log/[id]                   일지 상세
/training/create            훈련 이벤트 생성 (ADMIN)
/training/[id]              훈련 이벤트 상세
/training/[id]/edit         훈련 이벤트 수정 (ADMIN)
/training/[id]/manage       훈련 이벤트 관리 (ADMIN)
/locker/[userId]            사용자 락커 (프로필 + 쪽지)
/compliment                 칭찬하기 (팀원 선택)
/my                         마이페이지
/my/training-events         팀 운동 목록
/my/training                내 훈련 일지
/my/logs                    내 로그
/my/settings                프로필 설정
/my/feedback                피드백 보내기
/my/team-admin              팀 관리 (ADMIN)
/my/team-admin/admins       관리자 관리
/my/team-admin/vest         조끼 당번 관리
/my/team-equipment          장비 관리
/my/team-settings           팀 설정
```

### API (~75 엔드포인트)
```
/api/auth/[...nextauth]     인증
/api/profile                프로필 CRUD
/api/teams                  팀 CRUD
/api/teams/search           팀 검색
/api/teams/join             팀 가입
/api/teams/role             역할 변경
/api/teams/equipment        장비 관리
/api/teams/uniforms         유니폼 관리
/api/teams/vest-order       조끼 당번
/api/teams/attendance-rate  출석률
/api/training-events        훈련 이벤트 CRUD
/api/training-events/[id]   상세/수정/삭제
  /rsvp                     참석 응답
  /check-in                 체크인
  /pom                      MVP 투표
  /sessions                 세션 관리
  /late-fees                지각비
  /equipment                장비 배정
  /comments                 댓글
/api/training-logs          일지 CRUD
/api/training-logs/[id]     상세/수정/삭제
  /comments                 댓글
  /likes                    좋아요
/api/locker-notes           락커 쪽지
/api/nudges                 닦달
/api/pom/recent-mvp         최근 MVP
/api/feedback               피드백
/api/upload                 이미지 업로드
/api/weather                날씨
/api/push                   푸시 알림
/api/venues                 장소 검색
/api/match-pairing          친선 경기 매칭
/api/match-rules            경기 규칙
/api/match-score            득점 기록
/api/referee-assignment     심판 배정
/api/player-substitution    선수 교체
```

---

## 접근 제어

| 역할 | 가능한 동작 |
|------|------------|
| 비인증 | 로그인 페이지만 접근 |
| MEMBER | 일지 CRUD(본인), 피드 조회, RSVP, 체크인, MVP 투표, 쪽지, 닦달 |
| ADMIN | MEMBER 권한 + 이벤트 생성/수정/삭제, 세션/지각비/장비 관리, 팀 설정, 역할 변경 |

## 시간 제한 규칙

| 기능 | 제한 |
|------|------|
| 체크인 | 이벤트 2시간 전 ~ 2시간 후 |
| MVP 투표 | 이벤트 2시간 후 ~ 다음날 23:59 |
| 닦달 | 같은 사람에게 1시간 1회 |
| 피드백 | 10분 쿨다운 |
| 락커 쪽지 | 피드 노출 24시간 |

## Provider 계층

```
SessionProvider (NextAuth)
  └─ SWRProvider (전역 캐시 설정)
      └─ TeamProvider (팀 데이터 컨텍스트)
          └─ TeamColorProvider (팀 컬러 CSS 변수)
              └─ PWAManager (서비스 워커 + 푸시)
                  └─ {children}
```
