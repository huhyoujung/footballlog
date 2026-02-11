# Football Log - 네모의 꿈

축구팀을 위한 종합 SNS 플랫폼. 팀 운동 관리, 운동 일지 공유, 출석 체크, MVP 투표 등 팀 활동에 필요한 모든 기능을 제공합니다.

## 🎯 주요 기능

### 📱 Feed (홈)
- 폴라로이드 스타일 운동 일지 피드
- 오늘/어제 단위로 그룹화된 일지 카드
- 게이미피케이션 정렬 로직
  - 오늘: 최신순 (신규 글 노출 극대화)
  - 과거: 등록 시간순 (먼저 올리는 경쟁 유도)
- 탭하여 수평 캐러셀로 확장
- 실시간 활동 배너 (팀 운동 공지 + 오늘 1등 + 닦달 메시지)

### 🏃 팀 운동 (Training Events)
- **운동 생성 및 관리**
  - 제목, 날짜/시간, 장소, 신발 추천
  - 유니폼 정보, 유의사항
  - 정기 운동 여부 설정
  - MVP 투표 활성화 옵션
- **RSVP 시스템**
  - 참석/불참/미정 응답
  - 마감 시간 설정 (운동 시간 이전)
  - 푸시 알림으로 닦달
- **체크인 시스템**
  - 운동 시작 전후 체크인
  - 실시간 체크인 시간 기록
  - 지각/정상 출석 표시
- **MVP 투표**
  - 체크인한 사람만 투표 가능
  - 1인당 투표 가능 인원 설정 (1-10명)
  - 투표 마감 시간 설정 (운동 시간 이후)
  - 최근 MVP 표시
- **세션 관리 (운영진 전용)**
  - 여러 세션으로 운동 분할
  - 세션별 참석자 관리
  - 출석률 통계 모달
- **지각비 관리 (운영진 전용)**
  - 체크인 기록 기반 자동 지각 판정
  - 지각비 금액 설정
  - 지각비 납부 상태 관리
  - 합계 및 미납액 통계
- **장비 관리 (운영진 전용)**
  - 팀 장비 목록 관리
  - 드래그 앤 드롭으로 관리자 배정
  - 터치 기반 모바일 드래그 지원

### ✍️ 운동 일지 (Training Logs)
- 폴라로이드 스타일 사진 업로드
- 주요 내용 (Key Points) 작성
- 좋아요 및 댓글 기능
- 멘션 기능 (@사용자명)

### 👤 마이 페이지 (My Page)
- **내 운동 일지** - 작성한 일지 목록
- **내가 참여한 운동** - 참여한 팀 운동 히스토리
- **팀 관리 (운영진 전용)**
  - 운영진 관리 (다중 운영진 시스템)
  - 조끼 빨래 당번 순서 관리
  - 지각비 기준 시간 설정
- **팀 장비** - 전체 장비 목록 조회
- **팀 정보** - 팀 이름, 코드 표시
- **설정** - 알림 설정, 로그아웃

### 🔔 푸시 알림
- PWA 기반 웹 푸시 알림
- RSVP 닦달 (운동 2시간 전)
- 실시간 활동 알림

## 🛠 기술 스택

- **Frontend**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL (Prisma ORM)
- **Authentication**: NextAuth.js (Google OAuth)
- **Deployment**: Vercel
- **Push Notifications**: Web Push API, Service Worker

## 📁 프로젝트 구조

```
src/
├── app/
│   ├── page.tsx                    # Feed (홈)
│   ├── write/page.tsx              # 운동 일지 작성
│   ├── log/[id]/page.tsx           # 운동 일지 상세
│   ├── training/
│   │   ├── create/page.tsx         # 팀 운동 생성
│   │   ├── [id]/page.tsx           # 팀 운동 상세
│   │   └── [id]/edit/page.tsx      # 팀 운동 수정
│   ├── my/                         # 마이 페이지
│   │   ├── page.tsx                # 메인
│   │   ├── logs/page.tsx           # 내 운동 일지
│   │   ├── training/page.tsx       # 내가 참여한 운동
│   │   ├── team-admin/             # 팀 관리 (운영진)
│   │   ├── team-equipment/         # 팀 장비
│   │   ├── team-settings/          # 팀 정보
│   │   └── settings/page.tsx       # 설정
│   ├── onboarding/page.tsx         # 온보딩 (팀 생성/가입)
│   └── api/                        # API Routes
│       ├── training-events/        # 팀 운동 API
│       ├── training-logs/          # 운동 일지 API
│       ├── teams/                  # 팀 관리 API
│       ├── push/                   # 푸시 알림 API
│       └── ...
├── components/
│   ├── Feed.tsx                    # 피드 컴포넌트
│   ├── PolaroidStack.tsx           # 폴라로이드 스택
│   ├── PolaroidCarousel.tsx        # 폴라로이드 캐러셀
│   ├── TickerBanner.tsx            # 전광판 배너
│   ├── TrainingCheckInCard.tsx     # 체크인 카드
│   ├── TrainingInviteCard.tsx      # 팀 운동 초대 카드
│   └── training/                   # 팀 운동 관련 컴포넌트
│       ├── BasicInfoTab.tsx        # 기본 정보 탭
│       ├── SessionTab.tsx          # 세션 탭
│       ├── LateFeeTab.tsx          # 지각비 탭
│       └── EquipmentTab.tsx        # 장비 탭
├── contexts/
│   └── TeamContext.tsx             # 팀 컨텍스트
├── lib/
│   ├── prisma.ts                   # Prisma 클라이언트
│   ├── timeUntil.ts                # 시간 계산 유틸
│   └── ...
└── types/
    └── training-event.ts           # 타입 정의
```

## 🎨 디자인 시스템

### 컬러 팔레트
- **Team Colors**: `team-50` ~ `team-700` (#F5F0EB ~ #685643, 따뜻한 브라운 톤)
- **Accent**: 팀 컬러 기반 그라데이션

### 디자인 원칙
- 폴라로이드 스타일 카드 (흰색 외부 프레임, team-50 내부 배경)
- 미니멀한 아이콘과 이모지 사용
- 부드러운 그림자와 라운드 처리
- 모바일 우선 반응형 디자인

## 🚀 시작하기

### 환경 변수 설정

```bash
# .env.local
DATABASE_URL="postgresql://..."
NEXTAUTH_SECRET="..."
NEXTAUTH_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
NEXT_PUBLIC_VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
```

### 개발 서버 실행

```bash
npm install
npm run dev
```

### 데이터베이스 마이그레이션

```bash
npx prisma generate
npx prisma db push
```

## 📝 주요 변경사항 (최근)

### UI/UX 개선
- 팀 운동 폼 인풋 필드 폰트 사이즈 축소 (일관성 개선)
- 저장 버튼 너비 조정 (max-w-xs, 중앙 정렬)
- 배경색 통일 (모든 페이지 흰색 배경)
- 헤더 높이 및 정렬 통일

### 기능 추가
- **유효성 검사**
  - RSVP 마감은 운동 시간 이전만 가능
  - MVP 투표 마감은 운동 시간 이후만 가능
- **캐시 최적화**
  - SWR 캐시 전략 개선 (detail/edit 페이지)
  - revalidateOnFocus, dedupingInterval 최적화

### 버그 수정
- Feed 페이지 날짜 표시 버그 (timezone 이슈)
- 세션 탭 텍스트 스타일 정리
- 폴라로이드 확장 시 뒤로가기 버튼 터치 영역 확대

## 📱 PWA 지원

- 오프라인 지원
- 홈 화면 추가 가능
- 웹 푸시 알림
- Service Worker 기반 백그라운드 동기화

## 🔐 권한 시스템

- **USER**: 일반 사용자
- **ADMIN**: 운영진 (다중 운영진 시스템)
  - 팀 운동 수정/삭제
  - 세션 관리
  - 지각비 관리
  - 장비 관리
  - 운영진 추가/제거

## 📄 라이선스

Private Project

## 👥 개발팀

- **기획/개발**: 허효정
- **AI 페어 프로그래밍**: Claude Sonnet 4.5
